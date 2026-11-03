import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Application, Job, User } from "@prisma/client";
import { SKIP_DAYS, type Scenario } from "@/lib/demo";
import { shortName } from "@/lib/names";
import { formFromTemplate, toJobPayload } from "@/lib/job-form";
import { prefillFromTemplate } from "@/lib/role-template";
import { DAY_MS, advanceClock, now } from "../clock";
import { db } from "../db";
import { conflict } from "../http/errors";
import {
  hireApplication,
  shortlistApplication,
  viewApplication,
} from "../services/applicant-actions";
import { apply } from "../services/applications";
import { createDraft, submitJob } from "../services/jobs";
import { uploadLicense } from "../services/licenses";
import { decide } from "../services/moderation";
import { createVenue } from "../services/venues";
import { sweep, type SweepResult } from "../sweep";
import { resolvePersona } from "./persona";

// Demo Toolkit actions (TRD §5.10, App Flow §9 fallbacks). Each one drives the same services as
// the real screens, so notifications, toasts, SMS and the audit log behave exactly as live.

const DAWIT = "+251922000001";
const MODERATOR = "+251911000009";

const moderator = () => db.user.findUniqueOrThrow({ where: { phone: MODERATOR } });

// ─── Simulate applicant ───────────────────────────────────────────────────

/** The job a simulated applicant applies to: the one asked for, else the newest live job. */
async function targetJob(jobId?: string) {
  const at = now();
  const job = await db.job.findFirst({
    where: { ...(jobId ? { id: jobId } : {}), status: "LIVE", expiresAt: { gt: at } },
    orderBy: { publishedAt: "desc" },
  });
  if (!job) {
    throw conflict("There is no live job to apply to.", "የሚመለከቱበት ክፍት ሥራ የለም።", {
      reason: "NO_LIVE_JOB",
    });
  }
  return job;
}

/** Dawit first, as in the script; then the most complete profiles, so the pipeline looks real. */
async function nextApplicant(jobId: string) {
  const taken = new Set(
    (await db.application.findMany({ where: { jobId }, select: { jobseekerId: true } })).map(
      (a) => a.jobseekerId,
    ),
  );
  const dawit = await db.user.findUnique({ where: { phone: DAWIT } });
  if (dawit && !taken.has(dawit.id)) return dawit;
  const profile = await db.jobseekerProfile.findFirst({
    where: { userId: { notIn: [...taken] }, user: { platformRole: "JOBSEEKER" } },
    orderBy: [{ completeness: "desc" }, { userId: "asc" }],
    include: { user: true },
  });
  return profile?.user ?? null;
}

/** The fallback for script row 8 (PRD R7): a seeded jobseeker who hasn't applied yet applies. */
export async function simulateApplicant(jobId?: string) {
  const job = await targetJob(jobId);
  const seeker = await nextApplicant(job.id);
  if (!seeker) {
    throw conflict("Every seeded jobseeker has already applied.", "ሁሉም ሥራ ፈላጊዎች አስቀድመው አመልክተዋል።", {
      reason: "NO_JOBSEEKER",
    });
  }
  await apply(seeker, job.id);
  return {
    jobId: job.id,
    name: shortName(seeker.name),
    titleEn: job.titleEn || job.titleAm,
    titleAm: job.titleAm || job.titleEn,
  };
}

// ─── Approve all pending ──────────────────────────────────────────────────

/** The fallback when the Admin window isn't available: approve every pending license and job. */
export async function approveAllPending() {
  const admin = await moderator();
  const items = await db.moderationItem.findMany({
    where: { status: "PENDING", type: { in: ["LICENSE", "JOB"] } },
    orderBy: { createdAt: "asc" },
  });
  const approved = { licenses: 0, jobs: 0 };
  for (const item of items) {
    await decide(admin, item.id, "APPROVE");
    if (item.type === "LICENSE") approved.licenses++;
    else approved.jobs++;
  }
  return approved;
}

// ─── Time-skip ────────────────────────────────────────────────────────────

/** Moves the demo clock forward and runs the sweep straight away (doc 05 §8, App Flow §11). */
export async function timeSkip(days: (typeof SKIP_DAYS)[number]) {
  await advanceClock(days * DAY_MS);
  const result: SweepResult = await sweep();
  return { now: now().toISOString(), ...result };
}

// ─── Scenario jump ────────────────────────────────────────────────────────

const SAMPLE_LICENSE = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "public/samples/license-sample.pdf",
);

/** Bruk and Bole Sunrise Café (doc 05 §9.4), created the way the onboarding screens would. */
async function brukVenue(bruk: User) {
  const member = await db.venueMember.findFirst({
    where: { userId: bruk.id, status: "ACTIVE" },
    include: { venue: true },
  });
  if (member) return member.venue;
  return createVenue(bruk, {
    ownerName: "Bruk Tilahun",
    nameEn: "Bole Sunrise Café",
    nameAm: "ቦሌ ሰንራይዝ ካፌ",
    category: "CAFE",
    subCity: "bole",
    contactPhone: "+251911000011",
    descriptionEn: undefined,
    descriptionAm: undefined,
  });
}

async function approvePendingFor(where: { licenseId?: { in: string[] }; jobId?: string }) {
  const items = await db.moderationItem.findMany({ where: { status: "PENDING", ...where } });
  const admin = items.length ? await moderator() : null;
  for (const item of items) await decide(admin!, item.id, "APPROVE");
}

async function ensureVerified(bruk: User) {
  let venue = await brukVenue(bruk);
  if (venue.verification === "UNSUBMITTED" || venue.verification === "REJECTED") {
    const bytes = await readFile(SAMPLE_LICENSE);
    const file = new File([bytes], "bole-sunrise-license.pdf", { type: "application/pdf" });
    await uploadLicense(bruk, venue.id, file);
    venue = await db.venue.findUniqueOrThrow({ where: { id: venue.id } });
  }
  if (venue.verification === "PENDING") {
    const licenses = await db.licenseDocument.findMany({
      where: { venueId: venue.id },
      select: { id: true },
    });
    await approvePendingFor({ licenseId: { in: licenses.map((l) => l.id) } });
  }
  return db.venue.findUniqueOrThrow({ where: { id: venue.id } });
}

/** The café's Barista job from the template (script row 5), submitted and approved. */
async function ensureLiveJob(bruk: User) {
  const venue = await ensureVerified(bruk);
  let job = await db.job.findFirst({
    where: {
      venueId: venue.id,
      status: { in: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "LIVE"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!job) {
    const template = await db.roleTemplate.findUniqueOrThrow({ where: { slug: "barista" } });
    job = await createDraft(
      bruk,
      venue.id,
      toJobPayload(formFromTemplate(prefillFromTemplate(template), "bole")),
    );
  }
  if (job.status === "DRAFT" || job.status === "CHANGES_REQUESTED") {
    job = await submitJob(bruk, job);
  }
  if (job.status === "PENDING_REVIEW") await approvePendingFor({ jobId: job.id });
  return db.job.findUniqueOrThrow({ where: { id: job.id } });
}

/** Dawit plus two more applicants, so the pipeline has something to sort. */
async function ensureApplicants(bruk: User) {
  const job = await ensureLiveJob(bruk);
  const count = await db.application.count({ where: { jobId: job.id } });
  for (let i = count; i < 3; i++) await simulateApplicant(job.id);
  return job;
}

/** Dawit viewed → shortlisted → hired (script row 9); headcount 1, so the job closes as filled. */
async function ensureHired(bruk: User) {
  const job = await ensureApplicants(bruk);
  const dawit = await db.user.findUniqueOrThrow({ where: { phone: DAWIT } });
  const key = { jobId_jobseekerId: { jobId: job.id, jobseekerId: dawit.id } };
  if (!(await db.application.findUnique({ where: key }))) await apply(dawit, job.id);
  type Action = (user: User, app: Application, job: Job) => Promise<unknown>;
  const step = async (from: Application["status"], action: Action) => {
    const app = await db.application.findUniqueOrThrow({ where: key });
    const current = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    if (app.status === from) await action(bruk, app, current);
  };
  await step("APPLIED", viewApplication);
  await step("VIEWED", shortlistApplication);
  await step("SHORTLISTED", hireApplication);
  return job;
}

/**
 * "Skip to state…" (App Flow §9): builds Bruk's story up to the named point, each step on top of
 * the previous one and idempotent, then signs the presenter in as Bruk on the matching screen.
 */
export async function jumpToScenario(name: Scenario) {
  const { user: bruk } = await resolvePersona("bruk");
  if (name === "venue-verified") {
    await ensureVerified(bruk);
    return { user: bruk, redirectTo: "/employer" };
  }
  if (name === "job-live") {
    const job = await ensureLiveJob(bruk);
    return { user: bruk, redirectTo: `/employer/jobs/${job.id}` };
  }
  if (name === "applicants-present") {
    const job = await ensureApplicants(bruk);
    return { user: bruk, redirectTo: `/employer/jobs/${job.id}/applicants` };
  }
  const job = await ensureHired(bruk);
  return { user: bruk, redirectTo: `/employer/jobs/${job.id}` };
}
