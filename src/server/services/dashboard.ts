import "server-only";
import type { VenuePermission } from "@/lib/permissions";
import { now } from "../clock";
import { db } from "../db";

// SCR-E03 data: everything the dashboard polls. The checklist follows App Flow §3.

const DAY_MS = 86_400_000;

/** "Dawit Alemu" → "Dawit A." (doc 04 LiveToast): activity never shows full names. */
const shortName = (name: string) => {
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
};

export async function venueSummary(venueId: string, permissions: Set<VenuePermission>) {
  const [venue, latestLicense, everLive, liveJobs, newApplicants, filled, subscription] =
    await Promise.all([
      db.venue.findUniqueOrThrow({ where: { id: venueId } }),
      db.licenseDocument.findFirst({ where: { venueId }, orderBy: { uploadedAt: "desc" } }),
      db.job.count({ where: { venueId, publishedAt: { not: null } } }),
      db.job.count({ where: { venueId, status: "LIVE" } }),
      db.application.count({ where: { status: "APPLIED", job: { venueId } } }),
      db.job.findMany({
        where: { venueId, filledAt: { not: null }, publishedAt: { not: null } },
        select: { filledAt: true, publishedAt: true },
      }),
      db.subscription.findFirst({
        where: { venueId, status: "ACTIVE", currentPeriodEnd: { gt: now() } },
        include: { plan: true },
      }),
    ]);

  const avgDaysToFill = filled.length
    ? Math.round(
        (filled.reduce((sum, j) => sum + (+j.filledAt! - +j.publishedAt!), 0) /
          filled.length /
          DAY_MS) *
          10,
      ) / 10
    : null;

  // Applicant names are only for members who may see applicants (a Poster sees counts only).
  const events = permissions.has("applicant.view")
    ? await db.applicationEvent.findMany({
        where: { type: "APPLIED", application: { job: { venueId } } },
        orderBy: { at: "desc" },
        take: 5,
        include: {
          application: {
            select: {
              jobseeker: { select: { name: true } },
              job: { select: { titleEn: true, titleAm: true } },
            },
          },
        },
      })
    : [];

  return {
    now: now().toISOString(),
    venue: { nameEn: venue.nameEn, nameAm: venue.nameAm, verification: venue.verification },
    checklist: {
      rejectionReason:
        venue.verification === "REJECTED" ? (latestLicense?.rejectionReason ?? null) : null,
      firstJob: everLive > 0,
      hidden: venue.onboardingDismissed,
    },
    kpis: {
      liveJobs,
      newApplicants,
      avgDaysToFill,
      plan: subscription
        ? { nameEn: subscription.plan.nameEn, nameAm: subscription.plan.nameAm }
        : null,
      foundingPostsLeft: venue.foundingPostsLeft,
    },
    activity: events.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      name: shortName(e.application.jobseeker.name),
      jobEn: e.application.job.titleEn,
      jobAm: e.application.job.titleAm,
    })),
  };
}

export type VenueSummary = Awaited<ReturnType<typeof venueSummary>>;
