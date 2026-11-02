import "server-only";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { compareApplicants, type ApplicantSort } from "@/lib/applicant-sort";
import { maskPhone } from "@/lib/phone";
import { now } from "../clock";
import { db } from "../db";

// Employer side of applications (E-12, E-19; TRD §7.1): the pipeline list, polled every 3 s.
// Phones are always masked here; the full number only comes from a reveal (T3.4).

/** Polls re-read this much before the cursor, so a write that committed late is not missed. */
const OVERLAP_MS = 10_000;

const STATUSES: ApplicationStatus[] = ["APPLIED", "VIEWED", "SHORTLISTED", "HIRED", "REJECTED"];

const include = {
  jobseeker: {
    select: {
      name: true,
      phone: true,
      faydaVerified: true,
      profile: {
        select: {
          headline: true,
          experienceYears: true,
          completeness: true,
          reliabilityScore: true,
          skills: { select: { skill: { select: { nameEn: true, nameAm: true } } } },
        },
      },
    },
  },
} satisfies Prisma.ApplicationInclude;

type Row = Prisma.ApplicationGetPayload<{ include: typeof include }>;

function toItem(a: Row) {
  const p = a.jobseeker.profile;
  return {
    id: a.id,
    status: a.status,
    name: a.jobseeker.name,
    phoneMasked: maskPhone(a.jobseeker.phone),
    verified: a.jobseeker.faydaVerified || (p?.reliabilityScore ?? 0) >= 4,
    faydaVerified: a.jobseeker.faydaVerified,
    headline: p?.headline ?? null,
    experienceYears: p?.experienceYears ?? 0,
    completeness: p?.completeness ?? 0,
    skills: (p?.skills ?? []).slice(0, 4).map((s) => ({ en: s.skill.nameEn, am: s.skill.nameAm })),
    note: a.note,
    /** Not opened by anyone yet: the "new" dot. */
    isNew: a.status === "APPLIED" && !a.viewedAt,
    appliedAt: a.appliedAt.toISOString(),
  };
}

export type PipelineItem = ReturnType<typeof toItem>;

export async function listApplicants(
  jobId: string,
  opts: { sort: ApplicantSort; status?: ApplicationStatus; since?: Date },
) {
  const cursor = now();
  const where: Prisma.ApplicationWhereInput = {
    jobId,
    ...(opts.status && { status: opts.status }),
    // Changes since the last poll: any application with an event after the cursor.
    ...(opts.since && {
      events: { some: { at: { gt: new Date(opts.since.getTime() - OVERLAP_MS) } } },
    }),
  };
  const [rows, grouped] = await Promise.all([
    db.application.findMany({ where, include }),
    db.application.groupBy({ by: ["status"], where: { jobId }, _count: true }),
  ]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    ApplicationStatus,
    number
  >;
  for (const g of grouped) counts[g.status] = g._count;
  return {
    items: rows.map(toItem).sort(compareApplicants(opts.sort)),
    counts,
    cursor: cursor.toISOString(),
  };
}
