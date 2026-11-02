import "server-only";
import type { ModerationStatus, ModerationType, Prisma, User } from "@prisma/client";
import { computeExpiresAt } from "@/lib/expiry";
import { now } from "../clock";
import { db } from "../db";
import { conflict, notFound } from "../http/errors";
import { audit } from "./audit";
import { employerRecipients, notify, sms } from "./notifications";

// Moderation queue (A-01…A-03). Every decision is one transaction: item + target + notification
// + simulated SMS + audit (TRD §5.3).

export type Decision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

const itemInclude = {
  license: { include: { venue: { select: { id: true, nameEn: true, nameAm: true } } } },
  job: {
    include: {
      venue: { select: { id: true, nameEn: true, nameAm: true } },
      subCity: true,
      roleTemplate: true,
    },
  },
} satisfies Prisma.ModerationItemInclude;

export async function listQueue(type: ModerationType | undefined, status: ModerationStatus) {
  const items = await db.moderationItem.findMany({
    where: { status, ...(type ? { type } : {}) },
    orderBy: { createdAt: "asc" },
    include: itemInclude,
  });
  const at = now().getTime();
  return items.map((i) => ({
    id: i.id,
    type: i.type,
    status: i.status,
    title: i.job
      ? `${i.job.titleEn || i.job.titleAm} · ${i.job.venue.nameEn}`
      : (i.license?.venue.nameEn ?? ""),
    fileName: i.license?.fileName ?? null,
    ageMinutes: Math.max(0, Math.floor((at - i.createdAt.getTime()) / 60_000)),
    flagCount: (JSON.parse(i.flags) as unknown[]).length,
    isFastApprove: i.isFastApprove,
  }));
}

export async function getItem(id: string) {
  const item = await db.moderationItem.findUnique({ where: { id }, include: itemInclude });
  if (!item) throw notFound();
  return item;
}

async function ownersOf(tx: Prisma.TransactionClient, venueId: string) {
  const members = await tx.venueMember.findMany({
    where: { venueId, role: "OWNER", status: "ACTIVE", userId: { not: null } },
    select: { user: { select: { id: true, phone: true, locale: true } } },
  });
  return members.map((m) => m.user!);
}

const DECIDED_STATUS: Record<Decision, ModerationStatus> = {
  APPROVE: "APPROVED",
  REQUEST_CHANGES: "CHANGES_REQUESTED",
  REJECT: "REJECTED",
};

async function decideLicense(
  tx: Prisma.TransactionClient,
  admin: User,
  item: Item,
  decision: Decision,
  reason: string | undefined,
  at: Date,
) {
  const license = item.license!;
  const venueId = license.venueId;
  const approved = decision === "APPROVE";

  await tx.licenseDocument.update({
    where: { id: license.id },
    data: {
      status: DECIDED_STATUS[decision],
      reviewedById: admin.id,
      reviewedAt: at,
      rejectionReason: approved ? null : reason,
    },
  });
  await tx.venue.update({
    where: { id: venueId },
    data: approved
      ? { verification: "VERIFIED", verifiedAt: at }
      : { verification: "REJECTED", verifiedAt: null },
  });

  const owners = await ownersOf(tx, venueId);
  const name = { en: license.venue.nameEn, am: license.venue.nameAm ?? license.venue.nameEn };
  await notify(
    tx,
    owners.map((o) => o.id),
    approved
      ? {
          kind: "VENUE_VERIFIED",
          titleEn: "Your venue is verified",
          titleAm: "ድርጅትዎ ተረጋግጧል",
          bodyEn: `${name.en} can now publish jobs.`,
          bodyAm: `${name.am} አሁን ሥራዎችን ማውጣት ይችላል።`,
          href: "/employer",
        }
      : {
          kind: "VENUE_REJECTED",
          titleEn: "Your license was not accepted",
          titleAm: "ፈቃድዎ ተቀባይነት አላገኘም",
          bodyEn: reason,
          bodyAm: reason,
          href: "/employer/onboarding/license",
        },
  );
  for (const o of owners) {
    const am = approved
      ? `Servaddis፦ ${name.am} ተረጋግጧል። አሁን ሥራ ማውጣት ይችላሉ።`
      : `Servaddis፦ የ${name.am} ፈቃድ ተቀባይነት አላገኘም። ${reason}`;
    const en = approved
      ? `Servaddis: ${name.en} is verified. You can now publish jobs.`
      : `Servaddis: the license for ${name.en} was not accepted. ${reason}`;
    await sms(tx, o.phone, o.locale === "AM" ? am : en, "ALERT");
  }
}

type Item = Awaited<ReturnType<typeof getItem>>;

/** Job decisions (doc 05 §6.1, notification matrix doc 03 §10). */
async function decideJob(
  tx: Prisma.TransactionClient,
  item: Item,
  decision: Decision,
  reason: string | undefined,
  at: Date,
) {
  const job = item.job!;
  if (job.status !== "PENDING_REVIEW") {
    throw conflict("This job is no longer waiting for review.", "ይህ ሥራ ከእንግዲህ ግምገማ አይጠብቅም።", {
      status: job.status,
    });
  }
  const titleAm = job.titleAm || job.titleEn;
  const titleEn = job.titleEn || job.titleAm!;
  const everyone = await employerRecipients(tx, job.venueId, job.createdById);
  const creator = everyone.filter((u) => u.id === job.createdById);

  if (decision === "APPROVE") {
    const expiresAt = computeExpiresAt(job.urgency, at);
    await tx.job.update({
      where: { id: job.id },
      data: {
        status: "LIVE",
        publishedAt: at,
        expiresAt,
        needByAt: job.urgency === "NORMAL" ? null : expiresAt,
      },
    });
    // The founding post was only held at submit; approval uses it up (doc 05 §6.1).
    if (job.postingSource === "FOUNDING_FREE") {
      await tx.venue.updateMany({
        where: { id: job.venueId, foundingPostsLeft: { gt: 0 } },
        data: { foundingPostsLeft: { decrement: 1 } },
      });
    }
    await notify(
      tx,
      everyone.map((u) => u.id),
      {
        kind: "JOB_APPROVED",
        titleEn: "Your job is live",
        titleAm: "ሥራዎ ወጥቷል",
        bodyEn: `"${titleEn}" is now in the jobseeker feed.`,
        bodyAm: `"${titleAm}" አሁን በሥራ ፈላጊዎች ዝርዝር ውስጥ ይታያል።`,
        href: `/employer/jobs/${job.id}`,
      },
    );
    return;
  }

  const changes = decision === "REQUEST_CHANGES";
  await tx.job.update({
    where: { id: job.id },
    data: { status: changes ? "CHANGES_REQUESTED" : "REJECTED" },
  });
  const recipients = changes ? creator : everyone;
  await notify(
    tx,
    recipients.map((u) => u.id),
    changes
      ? {
          kind: "JOB_CHANGES_REQUESTED",
          titleEn: "Changes requested",
          titleAm: "ማስተካከያ ተጠይቋል",
          bodyEn: `"${titleEn}": ${reason}`,
          bodyAm: `"${titleAm}"፦ ${reason}`,
          href: `/employer/jobs/${job.id}/edit`,
        }
      : {
          kind: "JOB_REJECTED",
          titleEn: "Your job was not accepted",
          titleAm: "ሥራዎ ተቀባይነት አላገኘም",
          bodyEn: `"${titleEn}": ${reason}`,
          bodyAm: `"${titleAm}"፦ ${reason}`,
          href: `/employer/jobs/${job.id}`,
        },
  );
  for (const u of recipients) {
    const en = changes
      ? `Servaddis: please update your job "${titleEn}". ${reason}`
      : `Servaddis: your job "${titleEn}" was not accepted. ${reason}`;
    const am = changes
      ? `Servaddis፦ እባክዎ "${titleAm}" የሚለውን ሥራ ያስተካክሉ። ${reason}`
      : `Servaddis፦ "${titleAm}" የሚለው ሥራ ተቀባይነት አላገኘም። ${reason}`;
    await sms(tx, u.phone, u.locale === "AM" ? am : en, "ALERT");
  }
}

export async function decide(admin: User, id: string, decision: Decision, reason?: string) {
  const item = await getItem(id);
  if (item.status !== "PENDING") {
    throw conflict("This item has already been decided.", "በዚህ ጉዳይ ላይ አስቀድሞ ውሳኔ ተሰጥቷል።", {
      status: item.status,
    });
  }
  if (item.type === "REPORT") {
    throw conflict("This item type can't be decided yet.", "ይህ ዓይነት ጉዳይ ገና ውሳኔ ሊሰጥበት አይችልም።");
  }
  if (item.type === "LICENSE" && decision === "REQUEST_CHANGES") {
    throw conflict(
      "A license is approved or rejected. Rejecting lets the owner upload a new one.",
      "ፈቃድ ይጸድቃል ወይም ውድቅ ይሆናል። ውድቅ ሲሆን ባለቤቱ አዲስ መጫን ይችላል።",
    );
  }

  const at = now();
  return db.$transaction(async (tx) => {
    if (item.type === "JOB") await decideJob(tx, item, decision, reason, at);
    else await decideLicense(tx, admin, item, decision, reason, at);
    const updated = await tx.moderationItem.update({
      where: { id },
      data: { status: DECIDED_STATUS[decision], reviewerId: admin.id, reason, decidedAt: at },
    });
    await audit(tx, {
      actorId: admin.id,
      action: `${item.type.toLowerCase()}.${decision.toLowerCase()}`,
      entity: "ModerationItem",
      entityId: id,
      meta: { venueId: item.license?.venueId ?? item.job!.venueId, jobId: item.jobId, reason },
    });
    return updated;
  });
}
