import "server-only";
import type { Job, Prisma } from "@prisma/client";
import type { z } from "zod";
import type { feedQuery } from "@/lib/zod-schemas";
import { now } from "../clock";
import { db } from "../db";
import { notFound } from "../http/errors";

// Public jobseeker feed (J-01, J-02; doc 05 §10). Only LIVE jobs that haven't expired by the demo
// clock, so a time-skip hides them even before the sweep runs.

export type FeedQuery = z.output<typeof feedQuery>;

const cardSelect = {
  id: true,
  titleEn: true,
  titleAm: true,
  salaryMin: true,
  salaryMax: true,
  salaryPeriod: true,
  employmentType: true,
  urgency: true,
  headcount: true,
  publishedAt: true,
  expiresAt: true,
  venue: { select: { nameEn: true, nameAm: true, verification: true } },
  subCity: { select: { slug: true, nameEn: true, nameAm: true } },
} satisfies Prisma.JobSelect;

type CardRow = Prisma.JobGetPayload<{ select: typeof cardSelect }>;

function toCard(j: CardRow) {
  return {
    id: j.id,
    titleEn: j.titleEn,
    titleAm: j.titleAm,
    venueEn: j.venue.nameEn,
    venueAm: j.venue.nameAm,
    verified: j.venue.verification === "VERIFIED",
    subCity: j.subCity,
    salaryMin: j.salaryMin,
    salaryMax: j.salaryMax,
    salaryPeriod: j.salaryPeriod,
    employmentType: j.employmentType,
    urgency: j.urgency,
    headcount: j.headcount,
    publishedAt: j.publishedAt!.toISOString(),
    expiresAt: j.expiresAt!.toISOString(),
  };
}

export type FeedCard = ReturnType<typeof toCard>;

export async function listFeed(q: FeedQuery) {
  const at = now();
  const where: Prisma.JobWhereInput = {
    status: "LIVE",
    expiresAt: { gt: at },
    ...(q.sub && { subCity: { slug: q.sub } }),
    ...(q.type && { employmentType: q.type }),
    ...(q.role && { roleTemplate: { slug: q.role } }),
    ...(q.urgent && { urgency: { not: "NORMAL" } }),
    // Salary ranges overlap the wanted range (doc 05 §10).
    ...(q.min !== undefined && { salaryMax: { gte: q.min } }),
    ...(q.max !== undefined && { salaryMin: { lte: q.max } }),
    ...(q.q && {
      OR: [
        { titleEn: { contains: q.q } },
        { titleAm: { contains: q.q } },
        { venue: { nameEn: { contains: q.q } } },
        { venue: { nameAm: { contains: q.q } } },
      ],
    }),
  };
  // The feed is small (tens of jobs), so it is ordered in memory: urgent first, soonest deadline
  // first among them, then newest. SQLite can't sort the Urgency enum that way.
  const rows = await db.job.findMany({ where, select: cardSelect });
  rows.sort((a, b) => {
    const ua = a.urgency !== "NORMAL";
    const ub = b.urgency !== "NORMAL";
    if (ua !== ub) return ua ? -1 : 1;
    if (ua) return +a.expiresAt! - +b.expiresAt!;
    return +b.publishedAt! - +a.publishedAt!;
  });
  const start = q.cursor ?? 0;
  const page = rows.slice(start, start + q.limit);
  return {
    items: page.map(toCard),
    total: rows.length,
    nextCursor: start + q.limit < rows.length ? start + q.limit : null,
  };
}

/** A published job for its public page. Expired or closed jobs still show, marked not open. */
export async function feedJob(id: string) {
  const job = await db.job.findUnique({
    where: { id },
    select: {
      ...cardSelect,
      status: true,
      descriptionEn: true,
      descriptionAm: true,
      requirementsEn: true,
      requirementsAm: true,
      benefitsEn: true,
      benefitsAm: true,
      shiftPattern: true,
    },
  });
  const published: Job["status"][] = ["LIVE", "EXPIRED", "CLOSED"];
  if (!job || !job.publishedAt || !published.includes(job.status)) throw notFound();
  const list = (json: string) => JSON.parse(json) as string[];
  return {
    ...toCard(job),
    open: job.status === "LIVE" && job.expiresAt! > now(),
    descriptionEn: job.descriptionEn,
    descriptionAm: job.descriptionAm,
    requirementsEn: list(job.requirementsEn),
    requirementsAm: list(job.requirementsAm),
    benefitsEn: list(job.benefitsEn),
    benefitsAm: list(job.benefitsAm),
    shiftPattern: job.shiftPattern,
  };
}

export type FeedJob = Awaited<ReturnType<typeof feedJob>>;
