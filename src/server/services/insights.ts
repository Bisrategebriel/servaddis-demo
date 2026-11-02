import "server-only";
import { DAY_MS, now } from "../clock";
import { db } from "../db";

// Insights (E-18; doc 04 SCR-E15; doc 05 §10.1). Aggregated in TypeScript rather than raw SQL
// (doc 05 §10.1 allows either): the data is one venue's few hundred rows, and the months are
// Addis Ababa months, which SQLite's strftime can't bucket without a time-zone shift.

export const RANGES = { "30d": 30, "90d": 90, "180d": 180 } as const;
export type Range = keyof typeof RANGES;

const EAT_MS = 3 * 60 * 60 * 1000;
/** "2026-10" for a moment, in EAT. */
const monthOf = (d: Date) => new Date(d.getTime() + EAT_MS).toISOString().slice(0, 7);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

/** The last `n` EAT months ending with the given one, oldest first. */
function monthsEndingAt(end: string, n: number) {
  const [y, m] = end.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

export async function venueInsights(venueId: string, range: Range) {
  const at = now();
  const from = new Date(at.getTime() - RANGES[range] * DAY_MS);
  const sixMonthsAgo = new Date(at.getTime() - 200 * DAY_MS);

  const [liveJobs, filled, apps] = await Promise.all([
    db.job.count({ where: { venueId, status: "LIVE" } }),
    db.job.findMany({
      where: { venueId, filledAt: { not: null }, publishedAt: { not: null } },
      select: { publishedAt: true, filledAt: true },
    }),
    db.application.findMany({
      where: { job: { venueId }, appliedAt: { gte: sixMonthsAgo } },
      select: {
        jobId: true,
        appliedAt: true,
        viewedAt: true,
        shortlistedAt: true,
        hiredAt: true,
        jobseeker: { select: { faydaVerified: true, profile: { select: { completeness: true } } } },
      },
    }),
  ]);
  const days = (j: (typeof filled)[number]) => (+j.filledAt! - +j.publishedAt!) / DAY_MS;

  // Funnel for the range (doc 05 §10.1), by when people applied.
  const inRange = apps.filter((a) => a.appliedAt >= from);
  const funnel = {
    applied: inRange.length,
    viewed: inRange.filter((a) => a.viewedAt).length,
    shortlisted: inRange.filter((a) => a.shortlistedAt).length,
    hired: inRange.filter((a) => a.hiredAt).length,
  };
  const jobsWithApplicants = new Set(inRange.map((a) => a.jobId)).size;

  // Six-month trend. If the current month has no filled job yet, end with the last full month,
  // so the line doesn't trail off into an empty bucket.
  const current = monthOf(at);
  const filledThisMonth = filled.some((j) => monthOf(j.filledAt!) === current);
  const lastFull = monthsEndingAt(current, 2)[0];
  const months = monthsEndingAt(filledThisMonth ? current : lastFull, 6);
  const trend = months.map((month) => {
    const js = filled.filter((j) => monthOf(j.filledAt!) === month);
    return { month, daysToFill: round1(avg(js.map(days))), filledJobs: js.length };
  });
  const quality = months.map((month) => {
    const as = apps.filter((a) => monthOf(a.appliedAt) === month);
    const comp = avg(as.map((a) => a.jobseeker.profile?.completeness ?? 0));
    const verified = avg(as.map((a) => (a.jobseeker.faydaVerified ? 100 : 0)));
    return {
      month,
      avgCompleteness: comp === null ? null : Math.round(comp),
      pctVerified: verified === null ? null : Math.round(verified),
      applicants: as.length,
    };
  });

  // "Hires are filling 5 days faster than six months ago": first vs last month with data.
  const withData = trend.filter((t) => t.daysToFill !== null);
  const first = withData[0];
  const last = withData[withData.length - 1];
  const fasterBy =
    first && last && first !== last ? round1(first.daysToFill! - last.daysToFill!) : null;

  return {
    range,
    kpis: {
      liveJobs,
      applicants: inRange.length,
      avgDaysToFill: round1(avg(filled.filter((j) => j.filledAt! >= from).map(days))),
      hires: funnel.hired,
    },
    funnel,
    applicantsPerJob: jobsWithApplicants ? round1(inRange.length / jobsWithApplicants) : null,
    trend,
    quality,
    fasterBy,
  };
}

export type VenueInsights = Awaited<ReturnType<typeof venueInsights>>;
