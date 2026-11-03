import { redirect } from "next/navigation";
import { TileGridSkeleton } from "@/components/skeletons";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/employer/forbidden";
import { PlansView } from "@/components/employer/plans-view";
import { getEmployerContext } from "@/server/current-user";
import { billingOverview } from "@/server/services/billing";

// SCR-E11, owners (billing.manage) only. ?payment=failed|cancelled comes back from checkout.

async function Plans({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const [ctx, { payment }] = await Promise.all([getEmployerContext(), searchParams]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  if (!ctx.membership.permissions.has("billing.manage")) {
    return <Forbidden venueId={ctx.membership.venueId} />;
  }
  const notice = payment === "failed" || payment === "cancelled" ? payment : null;
  return <PlansView data={await billingOverview(ctx.membership.venueId)} notice={notice} />;
}

export default async function PlansPage({ searchParams }: PageProps<"/[locale]/employer/plans">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<TileGridSkeleton label={t("loading")} count={3} />}>
      <Plans searchParams={searchParams as Promise<{ payment?: string }>} />
    </Suspense>
  );
}
