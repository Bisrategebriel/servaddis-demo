import "server-only";
import { createHash } from "node:crypto";
import type { Job, Prisma, User } from "@prisma/client";
import type { z } from "zod";
import { resolveEntitlement } from "@/lib/entitlement";
import { firstInvalidStep, formFromJob, toJobPayload } from "@/lib/job-form";
import { parseRoleTemplateDefaults } from "@/lib/role-template";
import { jobDraftBody } from "@/lib/zod-schemas";
import { now } from "../clock";
import { db } from "../db";
import { AppError, conflict } from "../http/errors";
import { hasBlock } from "../rules/engine";
import { audit } from "./audit";
import { checkDraft } from "./rules-check";

// Job drafts (E-07) and submit (E-10). A draft may be incomplete and may belong to an unverified
// venue; those checks happen at submit. The venue always comes from the membership or the job.

type JobDraft = z.output<typeof jobDraftBody>;
type Tx = Prisma.TransactionClient;

const EDITABLE: Job["status"][] = ["DRAFT", "CHANGES_REQUESTED"];

async function draftColumns(tx: Tx, input: JobDraft) {
  const {
    roleTemplateSlug,
    subCity,
    requirementsEn,
    requirementsAm,
    benefitsEn,
    benefitsAm,
    ...rest
  } = input;
  const sub = await tx.subCity.findUnique({ where: { slug: subCity } });
  if (!sub) throw new AppError("BAD_REQUEST");
  const template = roleTemplateSlug
    ? await tx.roleTemplate.findUnique({ where: { slug: roleTemplateSlug } })
    : null;
  if (roleTemplateSlug && !template) throw new AppError("BAD_REQUEST");
  return {
    template,
    data: {
      ...rest,
      subCityId: sub.id,
      roleTemplateId: template?.id ?? null,
      requirementsEn: JSON.stringify(requirementsEn),
      requirementsAm: JSON.stringify(requirementsAm),
      benefitsEn: JSON.stringify(benefitsEn),
      benefitsAm: JSON.stringify(benefitsAm),
    },
  };
}

export async function createDraft(user: User, venueId: string, input: JobDraft) {
  const at = now();
  return db.$transaction(async (tx) => {
    const venue = await tx.venue.findUniqueOrThrow({ where: { id: venueId } });
    const { template, data } = await draftColumns(tx, input);
    const job = await tx.job.create({
      data: { ...data, venueId, cityId: venue.cityId, createdById: user.id, createdAt: at },
    });
    if (template) {
      const slugs = parseRoleTemplateDefaults(template.defaults).skillSlugs;
      const skills = await tx.skill.findMany({ where: { slug: { in: slugs } } });
      await tx.jobSkill.createMany({
        data: skills.map((s) => ({ jobId: job.id, skillId: s.id })),
      });
    }
    return job;
  });
}

/** The venue's posting entitlement right now (doc 03 §4.2). */
export async function venueEntitlement(tx: Tx | typeof db, venueId: string) {
  const [venue, subscription, liveOrPending, pendingFounding] = await Promise.all([
    tx.venue.findUniqueOrThrow({ where: { id: venueId } }),
    tx.subscription.findFirst({
      where: { venueId, status: "ACTIVE", currentPeriodEnd: { gt: now() } },
      include: { plan: true },
    }),
    tx.job.count({ where: { venueId, status: { in: ["LIVE", "PENDING_REVIEW"] } } }),
    tx.job.count({
      where: { venueId, status: "PENDING_REVIEW", postingSource: "FOUNDING_FREE" },
    }),
  ]);
  return {
    ...resolveEntitlement(venue, subscription, { liveOrPending, pendingFounding }),
    plan: subscription
      ? { nameEn: subscription.plan.nameEn, nameAm: subscription.plan.nameAm }
      : null,
    foundingLeft: venue.foundingPostsLeft - pendingFounding,
  };
}

// Editing any of these on a LIVE job re-queues it; they also make up the repost hash (doc 05 §6.1).
const MATERIAL_FIELDS = [
  "titleEn",
  "titleAm",
  "descriptionEn",
  "descriptionAm",
  "salaryMin",
  "salaryMax",
  "salaryPeriod",
  "requirementsEn",
  "requirementsAm",
  "employmentType",
  "subCityId",
  "urgency",
] as const;

/** SHA-256 of the normalised material fields, JSON with sorted keys (doc 05 §6.4). */
export function contentHash(job: Pick<Job, (typeof MATERIAL_FIELDS)[number]>) {
  const normalised = Object.fromEntries(
    [...MATERIAL_FIELDS].sort().map((k) => {
      const v = job[k];
      return [k, typeof v === "string" ? v.trim() : (v ?? "")];
    }),
  );
  return createHash("sha256").update(JSON.stringify(normalised)).digest("hex");
}

const SUBMITTABLE: Job["status"][] = ["DRAFT", "CHANGES_REQUESTED"];

/**
 * DRAFT or CHANGES_REQUESTED → PENDING_REVIEW (TRD §5.3), checked in this order: venue VERIFIED
 * → required fields → rules → entitlement. A resubmit after requested changes keeps the job's
 * posting source, so it never uses a second post.
 */
export async function submitJob(user: User, job: Job) {
  if (!SUBMITTABLE.includes(job.status)) {
    throw conflict("This job has already been submitted.", "ይህ ሥራ አስቀድሞ ገብቷል።", {
      status: job.status,
    });
  }
  const full = await db.job.findUniqueOrThrow({
    where: { id: job.id },
    include: { venue: true, subCity: true, roleTemplate: true },
  });
  if (full.venue.verification !== "VERIFIED") {
    throw conflict(
      "You can't submit yet: your venue is awaiting verification.",
      "ገና ማስገባት አይችሉም፦ ድርጅትዎ በማረጋገጥ ላይ ነው።",
      { reason: "VENUE_UNVERIFIED" },
    );
  }
  const form = formFromJob(full, full.subCity.slug, full.roleTemplate?.slug ?? null);
  const step = firstInvalidStep(form);
  if (step !== null) {
    throw new AppError("BAD_REQUEST", {
      message: "Some required details are missing.",
      messageAm: "አንዳንድ አስፈላጊ መረጃዎች ጎድለዋል።",
      details: { step },
    });
  }
  const flags = await checkDraft(jobDraftBody.parse(toJobPayload(form)));
  if (hasBlock(flags)) throw new AppError("RULE_BLOCKED", { details: { flags } });

  const at = now();
  return db.$transaction(async (tx) => {
    let source = job.postingSource;
    if (!source) {
      const entitlement = await venueEntitlement(tx, job.venueId);
      if (entitlement.requiresPayment) {
        throw conflict(
          "You have no posts left. Buy a one-time urgent post to submit this job.",
          "የቀረዎት የማስታወቂያ ዕድል የለም። ይህን ሥራ ለማስገባት የአንድ ጊዜ አስቸኳይ ማስታወቂያ ይግዙ።",
          { reason: "NO_ENTITLEMENT", requiresPayment: true },
        );
      }
      source = entitlement.source;
    }
    const updated = await tx.job.update({
      where: { id: job.id },
      data: {
        status: "PENDING_REVIEW",
        postingSource: source,
        submittedAt: at,
        contentHash: contentHash(full),
      },
    });
    await tx.moderationItem.create({
      data: { type: "JOB", jobId: job.id, flags: JSON.stringify(flags), createdAt: at },
    });
    await audit(tx, {
      actorId: user.id,
      action: "job.submit",
      entity: "Job",
      entityId: job.id,
      meta: { postingSource: source, flags: flags.map((f) => f.ruleId) },
    });
    return updated;
  });
}

export async function updateDraft(job: Job, input: JobDraft) {
  if (!EDITABLE.includes(job.status)) {
    throw conflict("This job can't be edited now.", "ይህን ሥራ አሁን ማስተካከል አይቻልም።", {
      status: job.status,
    });
  }
  return db.$transaction(async (tx) => {
    const { data } = await draftColumns(tx, input);
    return tx.job.update({ where: { id: job.id }, data });
  });
}
