import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { DashboardSkeleton } from "@/components/skeletons";
import { getCurrentUser } from "@/server/current-user";
import { platformCounts } from "@/server/services/audit-log";

// PRD A-05: basic counts (venues, live jobs, applications) for the moderator.

function Tile({
  label,
  value,
  sub,
  testId,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-5"
    >
      <p className="text-small text-text-secondary">{label}</p>
      <p className="text-display font-bold">{value}</p>
      {sub && <div className="text-small text-text-secondary">{sub}</div>}
    </div>
  );
}

async function Counts() {
  // Live jobs depend on the demo clock: always per request.
  await connection();
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("overview")]);
  if (user?.platformRole !== "ADMIN") redirect("/");
  const c = await platformCounts();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        testId="count-venues"
        label={t("venues")}
        value={c.venues.total}
        sub={t("venuesBreakdown", c.venues)}
      />
      <Tile
        testId="count-live-jobs"
        label={t("liveJobs")}
        value={c.jobs.live}
        sub={t("inReview", { count: c.jobs.inReview })}
      />
      <Tile
        testId="count-applications"
        label={t("applications")}
        value={c.applications.total}
        sub={t("lastWeek", { count: c.applications.lastWeek })}
      />
      <Tile testId="count-hires" label={t("hires")} value={c.applications.hires} />
      <Tile testId="count-jobseekers" label={t("jobseekers")} value={c.people.jobseekers} />
      <Tile testId="count-employers" label={t("employers")} value={c.people.employers} />
      <Tile
        testId="count-queue"
        label={t("queue")}
        value={c.queue.pending}
        sub={
          <Link
            href="/admin/queue"
            className="inline-flex min-h-10 items-center text-navy-700 underline underline-offset-4"
          >
            {t("openQueue")}
          </Link>
        }
      />
      <Tile
        testId="count-payments"
        label={t("payments")}
        value={c.payments.count}
        sub={t("paymentsTotal", { total: c.payments.totalEtb.toLocaleString("en-US") })}
      />
    </div>
  );
}

export default async function OverviewPage() {
  const [t, common] = await Promise.all([getTranslations("overview"), getTranslations("common")]);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">{t("title")}</h1>
        <p className="text-text-secondary">{t("intro")}</p>
      </div>
      <Suspense fallback={<DashboardSkeleton label={common("loading")} />}>
        <Counts />
      </Suspense>
    </section>
  );
}
