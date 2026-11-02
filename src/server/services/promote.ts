import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Channel, Job, User } from "@prisma/client";
import { caption, hashtags, type CaptionJob } from "@/lib/captions";
import { distribution } from "../adapters/distribution";
import { now } from "../clock";
import { db } from "../db";
import { conflict } from "../http/errors";
import { audit } from "./audit";
import { jobUrl, renderCard, type CardJob, type CardLang, type CardSize } from "./cards";

// Promote to socials (E-15; TRD §5.6; App Flow §7). POST creates one QUEUED post per channel and
// answers at once; the cards are rendered, stored and "published" after the response, so the
// Promote screen's 2 s poll shows the log fill in. Promoting twice never duplicates posts.

export const CHANNELS: Channel[] = ["TELEGRAM", "FACEBOOK", "INSTAGRAM", "TIKTOK"];
const CARD_FOR: Record<Channel, CardSize> = {
  TELEGRAM: "square",
  FACEBOOK: "square",
  INSTAGRAM: "square",
  TIKTOK: "story",
};

const cardDir = () =>
  path.resolve(/*turbopackIgnore: true*/ process.env.CARD_DIR ?? "./data/cards");
const cardFile = (jobId: string, lang: CardLang, size: CardSize) =>
  path.join(/*turbopackIgnore: true*/ cardDir(), `${jobId}-${lang}-${size}.png`);

/**
 * Who may promote (App Flow §4.2): a job posted with a founding post or a paid urgent post, or
 * any job of a venue whose active plan includes socials (Pro, Founding). Otherwise: upsell.
 */
export async function promotionEligibility(job: Pick<Job, "venueId" | "postingSource">) {
  if (job.postingSource === "FOUNDING_FREE" || job.postingSource === "URGENT_PAID") {
    return { allowed: true as const, via: job.postingSource };
  }
  const sub = await db.subscription.findFirst({
    where: { venueId: job.venueId, status: "ACTIVE", currentPeriodEnd: { gt: now() } },
    include: { plan: true },
  });
  if (sub?.plan.includesSocial) return { allowed: true as const, via: "SUBSCRIPTION" as const };
  return { allowed: false as const, reason: "PLAN_UPGRADE" as const, plan: sub?.plan.code ?? null };
}

const isLive = (job: Pick<Job, "status" | "expiresAt">) =>
  job.status === "LIVE" && !!job.expiresAt && job.expiresAt > now();

function captionJob(job: CardJob): CaptionJob {
  return {
    titleEn: job.titleEn,
    titleAm: job.titleAm,
    venueEn: job.venue.nameEn,
    venueAm: job.venue.nameAm,
    subCityEn: job.subCity.nameEn,
    subCityAm: job.subCity.nameAm,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryPeriod: job.salaryPeriod,
    employmentType: job.employmentType,
    urgent: job.urgency !== "NORMAL",
    verified: job.venue.verification === "VERIFIED",
    url: jobUrl(job.id),
  };
}

/** Creates the four posts (QUEUED). Returns { created: false } when the job was promoted before. */
export async function promoteJob(user: User, job: Job) {
  if (!isLive(job)) {
    throw conflict("Only a live job can be promoted.", "ማስተዋወቅ የሚቻለው ክፍት ሥራ ብቻ ነው።", {
      reason: "NOT_LIVE",
    });
  }
  const eligibility = await promotionEligibility(job);
  if (!eligibility.allowed) {
    throw conflict(
      "Promote to socials is included in the Pro plan. Upgrade to promote this job.",
      "በማኅበራዊ ሚዲያ ማስተዋወቅ በPro ዕቅድ ውስጥ ተካቷል። ይህን ሥራ ለማስተዋወቅ ዕቅድዎን ያሳድጉ።",
      { reason: "PLAN_UPGRADE", upgradeTo: "PRO" },
    );
  }
  if (await db.distributionPost.count({ where: { jobId: job.id } })) return { created: false };

  const full = await db.job.findUniqueOrThrow({
    where: { id: job.id },
    include: { venue: true, subCity: true },
  });
  const c = captionJob(full);
  const at = now();
  await db.$transaction(async (tx) => {
    await tx.distributionPost.createMany({
      data: CHANNELS.map((channel) => ({
        jobId: job.id,
        channel,
        captionEn: caption(c, "en", channel),
        captionAm: caption(c, "am", channel),
        hashtags: JSON.stringify(hashtags(c)),
        createdAt: at,
      })),
    });
    await tx.job.update({ where: { id: job.id }, data: { promoteToSocials: true } });
    await audit(tx, {
      actorId: user.id,
      action: "job.promote",
      entity: "Job",
      entityId: job.id,
      meta: { via: eligibility.via },
    });
  });
  return { created: true };
}

/** Renders and stores the cards, then publishes each channel in turn (simulated in the demo). */
export async function runDistribution(jobId: string) {
  const job = await db.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { venue: true, subCity: true },
  });
  const cards = new Map<string, Uint8Array>();
  try {
    await mkdir(/*turbopackIgnore: true*/ cardDir(), { recursive: true });
    for (const lang of ["am", "en"] as const) {
      for (const size of ["square", "story"] as const) {
        const png = new Uint8Array(await (await renderCard(job, lang, size)).arrayBuffer());
        await writeFile(cardFile(jobId, lang, size), png);
        cards.set(`${lang}-${size}`, png);
      }
    }
    await db.distributionPost.updateMany({
      where: { jobId, status: "QUEUED" },
      data: { status: "RENDERED", cardKey: jobId },
    });
  } catch (err) {
    await db.distributionPost.updateMany({
      where: { jobId, status: "QUEUED" },
      data: { status: "FAILED", error: "The card could not be rendered." },
    });
    console.error(err);
    return;
  }

  for (const channel of CHANNELS) {
    const post = await db.distributionPost.findUnique({
      where: { jobId_channel: { jobId, channel } },
    });
    if (!post || post.status !== "RENDERED") continue;
    try {
      const result = await distribution.publish({
        channel,
        // Amharic first: the primary audience (TRD §6); the English caption is stored too.
        caption: post.captionAm,
        card: cards.get(`am-${CARD_FOR[channel]}`)!,
      });
      await db.distributionPost.update({
        where: { id: post.id },
        data: { ...result, publishedAt: result.status === "PUBLISHED" ? now() : null },
      });
    } catch (err) {
      await db.distributionPost.update({
        where: { id: post.id },
        data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
      });
    }
  }
}

/** The Promote screen's data: posts in channel order, plus whether promoting is possible. */
export async function distributionLog(job: Job) {
  const [posts, eligibility] = await Promise.all([
    db.distributionPost.findMany({ where: { jobId: job.id } }),
    promotionEligibility(job),
  ]);
  const order = (c: Channel) => CHANNELS.indexOf(c);
  return {
    live: isLive(job),
    eligibility,
    posts: posts
      .sort((a, b) => order(a.channel) - order(b.channel))
      .map((p) => ({
        channel: p.channel,
        status: p.status,
        captionEn: p.captionEn,
        captionAm: p.captionAm,
        simulated: p.simulated,
        publishedAt: p.publishedAt?.toISOString() ?? null,
        externalUrl: p.externalUrl,
        error: p.error,
      })),
    settled:
      posts.length > 0 && posts.every((p) => p.status !== "QUEUED" && p.status !== "RENDERED"),
  };
}

export type DistributionLog = Awaited<ReturnType<typeof distributionLog>>;
