import { redirect } from "next/navigation";
import { DashboardSkeleton } from "@/components/skeletons";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/employer/forbidden";
import { InsightsView } from "@/components/employer/insights-view";
import { getEmployerContext } from "@/server/current-user";
import { RANGES, venueInsights, type Range } from "@/server/services/insights";

// SCR-E15, insights.view only. ?range=30d|90d|180d (default 90d).

async function Insights({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const [ctx, { range }] = await Promise.all([getEmployerContext(), searchParams]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  if (!ctx.membership.permissions.has("insights.view")) {
    return <Forbidden venueId={ctx.membership.venueId} />;
  }
  const r: Range = range && range in RANGES ? (range as Range) : "90d";
  return <InsightsView data={await venueInsights(ctx.membership.venueId, r)} />;
}

export default async function InsightsPage({
  searchParams,
}: PageProps<"/[locale]/employer/insights">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<DashboardSkeleton label={t("loading")} />}>
      <Insights searchParams={searchParams as Promise<{ range?: string }>} />
    </Suspense>
  );
}
