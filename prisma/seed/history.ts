// Doc 05 §9.5 Hiwot Garden Hotel history, for Insights (T5.5). Deterministic: its own PRNG stream
// (seeded from PRNG_SEED) so adding it never shifts the jobseeker roster. Over the previous six
// months: 17 filled (CLOSED) jobs whose time-to-fill trends from ~11 days to ~6, and 3 that
// expired. Each has 8–30 applicants; the more complete profiles are the ones viewed, shortlisted
// and hired, giving a funnel near 100 % applied → 42 % viewed → 18 % shortlisted → 6 % hired.
import type { Prisma } from "@prisma/client";
import type { SubCitySlug } from "./data/geography";
import { ROLE_TEMPLATES } from "./data/role-templates";
import { createRng } from "./prng";
import { PRNG_SEED } from "./version";

type Tx = Prisma.TransactionClient;
type Geo = { addisId: string; subCityIds: Map<SubCitySlug, string> };

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const ROLES = [
  "waiter",
  "barista",
  "front-desk",
  "housekeeper",
  "line-cook",
  "chef-de-partie",
  "bartender",
  "kitchen-steward",
  "spa-therapist",
  "host-cashier",
];

/** Filled jobs per month, oldest (6 months ago) first; expired ones are separate. */
const FILLED_PER_MONTH = [3, 3, 3, 3, 3, 2];
const EXPIRED_IN_MONTH = [5, 3, 2]; // months ago

export async function seedHistory(tx: Tx, geo: Geo, now: Date) {
  const rng = createRng(`${PRNG_SEED}:history`);
  const venue = await tx.venue.findFirstOrThrow({
    where: { nameEn: "Hiwot Garden Hotel" },
    include: { members: { where: { role: "OWNER" } } },
  });
  const ownerId = venue.members[0].userId!;
  const seekers = await tx.user.findMany({
    // Dawit applies live in the demo (script row 8): his tracker starts empty.
    where: { platformRole: "JOBSEEKER", phone: { not: "+251922000001" } },
    orderBy: { phone: "asc" },
    select: { id: true, profile: { select: { completeness: true } } },
  });

  const plan: { monthsAgo: number; filled: boolean }[] = [];
  FILLED_PER_MONTH.forEach((n, i) => {
    for (let j = 0; j < n; j++) plan.push({ monthsAgo: 6 - i, filled: true });
  });
  for (const m of EXPIRED_IN_MONTH) plan.push({ monthsAgo: m, filled: false });

  for (const p of plan) {
    const slug = rng.pick(ROLES);
    const t = ROLE_TEMPLATES.find((r) => r.slug === slug)!;
    const d = t.defaults;
    // Published somewhere in that month window, never so late that the outcome is in the future.
    const publishedAt = new Date(now.getTime() - p.monthsAgo * 30 * DAY + rng.int(0, 15) * DAY);
    // ~11 days six months ago down to ~6 last month, ± up to a day.
    const fillDays = 11 - (6 - p.monthsAgo) + (rng.next() * 2 - 1);
    const filledAt = new Date(publishedAt.getTime() + fillDays * DAY);
    const expiresAt = new Date(publishedAt.getTime() + 30 * DAY);
    const headcount = p.filled && rng.chance(0.2) ? 2 : 1;
    const template = await tx.roleTemplate.findUniqueOrThrow({ where: { slug: t.slug } });

    const job = await tx.job.create({
      data: {
        venueId: venue.id,
        createdById: ownerId,
        roleTemplateId: template.id,
        titleEn: t.nameEn,
        titleAm: t.nameAm,
        descriptionEn: d.descriptionEn,
        descriptionAm: d.descriptionAm,
        requirementsEn: JSON.stringify(d.requirementsEn),
        requirementsAm: JSON.stringify(d.requirementsAm),
        benefitsEn: JSON.stringify(d.benefitsEn),
        benefitsAm: JSON.stringify(d.benefitsAm),
        shiftPattern: d.shiftPattern,
        salaryMin: d.salaryHint.min,
        salaryMax: d.salaryHint.max,
        salaryPeriod: d.salaryHint.period,
        employmentType: d.employmentType,
        headcount,
        hiredCount: p.filled ? headcount : 0,
        cityId: geo.addisId,
        subCityId: venue.subCityId,
        status: p.filled ? "CLOSED" : "EXPIRED",
        postingSource: "SUBSCRIPTION",
        createdAt: new Date(publishedAt.getTime() - 3 * HOUR),
        submittedAt: new Date(publishedAt.getTime() - 2 * HOUR),
        publishedAt,
        expiresAt,
        filledAt: p.filled ? filledAt : null,
        closedAt: p.filled ? filledAt : null,
      },
    });

    // Applicants, strongest profiles first (completeness plus a little noise).
    const n = rng.int(8, 30);
    const ranked = rng
      .sample(seekers, n)
      .map((s) => ({ s, score: (s.profile?.completeness ?? 0) + rng.int(-15, 15) }))
      .sort((a, b) => b.score - a.score);
    const shortlisted = Math.max(headcount, Math.round(n * 0.18));
    const viewed = Math.max(shortlisted, Math.round(n * 0.42));
    // Applications arrive before the job fills (or within two weeks, for expired ones).
    const window = (p.filled ? fillDays : 14) * DAY;

    await tx.application.createMany({
      data: ranked.map(({ s }, rank) => {
        const appliedAt = new Date(publishedAt.getTime() + rng.next() * window * 0.8);
        const isViewed = rank < viewed;
        const isShortlisted = rank < shortlisted;
        const isHired = p.filled && rank < headcount;
        const viewedAt = isViewed ? new Date(appliedAt.getTime() + rng.int(2, 30) * HOUR) : null;
        const shortlistedAt = isShortlisted
          ? new Date(viewedAt!.getTime() + rng.int(2, 24) * HOUR)
          : null;
        // Filled jobs: everyone not hired was turned down; expired ones keep their stage.
        const rejected = p.filled && !isHired;
        return {
          jobId: job.id,
          jobseekerId: s.id,
          status: isHired
            ? "HIRED"
            : rejected
              ? "REJECTED"
              : isShortlisted
                ? "SHORTLISTED"
                : isViewed
                  ? "VIEWED"
                  : "APPLIED",
          rejectReason: rejected ? (isViewed ? "SKILLS_MISMATCH" : "POSITION_FILLED") : null,
          appliedAt,
          viewedAt,
          shortlistedAt,
          hiredAt: isHired ? filledAt : null,
          rejectedAt: rejected ? filledAt : null,
        } as const;
      }),
    });
  }
}
