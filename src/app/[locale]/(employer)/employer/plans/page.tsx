import { redirect } from "next/navigation";
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

export default function PlansPage({ searchParams }: PageProps<"/[locale]/employer/plans">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-muted" aria-hidden />}>
      <Plans searchParams={searchParams as Promise<{ payment?: string }>} />
    </Suspense>
  );
}
