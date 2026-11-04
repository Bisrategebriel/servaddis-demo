import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type User } from "@prisma/client";
import { shortName } from "@/lib/names";
import { effectivePermissions } from "@/lib/permissions";
import { now } from "../clock";
import { db } from "../db";
import { conflict, notFound } from "../http/errors";
import { notify } from "./notifications";

// Jobseeker side of applications (J-03, J-04; App Flow §5.2).

type Tx = Prisma.TransactionClient;

/** Venue members who may see applicants: they get the "new applicant" notification. */
async function applicantViewers(tx: Tx, venueId: string) {
  const members = await tx.venueMember.findMany({
    where: { venueId, status: "ACTIVE", userId: { not: null } },
  });
  return members.filter((m) => effectivePermissions(m).has("applicant.view")).map((m) => m.userId!);
}

type ApplyResult = { application: Prisma.ApplicationGetPayload<object>; created: boolean };

// Taps in flight, per jobseeker + job. Kept on globalThis so route handlers share one map.
const inFlight = ((
  globalThis as unknown as { svApplyInFlight?: Map<string, Promise<ApplyResult>> }
).svApplyInFlight ??= new Map());

/**
 * One-tap apply (TRD §5.4): an upsert on (jobId, jobseekerId). A repeated tap, even one racing
 * the first, returns the existing application instead of creating a second.
 *
 * Taps that race in this process share the first tap's work instead of each opening a write
 * transaction: SQLite takes one writer at a time, and on Linux CI the waiting transactions
 * stalled past the test timeout. The unique-constraint fallback below still covers a race
 * across processes.
 */
export async function apply(user: User, jobId: string, note?: string): Promise<ApplyResult> {
  const id = `${user.id}:${jobId}`;
  const running = inFlight.get(id);
  if (running) return { application: (await running).application, created: false };
  const attempt = applyOnce(user, jobId, note).finally(() => inFlight.delete(id));
  inFlight.set(id, attempt);
  return attempt;
}

async function applyOnce(user: User, jobId: string, note?: string): Promise<ApplyResult> {
  const key = { jobId_jobseekerId: { jobId, jobseekerId: user.id } };
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || !job.publishedAt) throw notFound();
  const existing = await db.application.findUnique({ where: key });
  if (existing) return { application: existing, created: false };
  if (job.status !== "LIVE" || !job.expiresAt || job.expiresAt <= now()) {
    throw conflict("This job is no longer open.", "ይህ ሥራ ከእንግዲህ ክፍት አይደለም።", {
      status: job.status,
    });
  }

  const at = now();
  try {
    const application = await db.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          jobId,
          jobseekerId: user.id,
          note: note || null,
          appliedAt: at,
          events: { create: { type: "APPLIED", actorId: user.id, at } },
        },
      });
      const name = shortName(user.name);
      await notify(tx, await applicantViewers(tx, job.venueId), {
        kind: "APPLICATION_RECEIVED",
        titleEn: "New applicant",
        titleAm: "አዲስ አመልካች",
        bodyEn: `${name || "A jobseeker"} applied to "${job.titleEn || job.titleAm}".`,
        bodyAm: `${name || "አንድ ሥራ ፈላጊ"} ለ"${job.titleAm || job.titleEn}" አመልክተዋል።`,
        href: `/employer/jobs/${jobId}/applicants`,
      });
      return created;
    });
    return { application, created: true };
  } catch (err) {
    // A concurrent tap won the unique (jobId, jobseekerId) insert: hand back its row.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        application: await db.application.findUniqueOrThrow({ where: key }),
        created: false,
      };
    }
    throw err;
  }
}

/** The tracker (SCR-J03): newest first, with the job as the jobseeker should see it. */
export async function myApplications(userId: string) {
  const rows = await db.application.findMany({
    where: { jobseekerId: userId },
    orderBy: { appliedAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          titleEn: true,
          titleAm: true,
          status: true,
          expiresAt: true,
          venue: { select: { nameEn: true, nameAm: true } },
        },
      },
    },
  });
  const at = now();
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  return rows.map((a) => ({
    id: a.id,
    status: a.status,
    appliedAt: a.appliedAt.toISOString(),
    viewedAt: iso(a.viewedAt),
    shortlistedAt: iso(a.shortlistedAt),
    rejectedAt: iso(a.rejectedAt),
    hiredAt: iso(a.hiredAt),
    job: {
      id: a.job.id,
      titleEn: a.job.titleEn,
      titleAm: a.job.titleAm,
      venueEn: a.job.venue.nameEn,
      venueAm: a.job.venue.nameAm,
      open: a.job.status === "LIVE" && !!a.job.expiresAt && a.job.expiresAt > at,
    },
  }));
}

export type MyApplication = Awaited<ReturnType<typeof myApplications>>[number];

/** Weak ETag of the tracker payload, for 304s on the 5 s poll (TRD §7.2). */
export const etagOf = (body: unknown) =>
  `W/"${createHash("sha1").update(JSON.stringify(body)).digest("base64url")}"`;
