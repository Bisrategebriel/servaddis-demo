import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DashboardView } from "@/components/employer/dashboard-view";
import { getEmployerContext } from "@/server/current-user";

// The proxy can't see memberships (no DB in proxy), so employers without a venue land here
// first and are sent on to onboarding (App Flow §2).
async function Dashboard() {
  const ctx = await getEmployerContext();
  if (!ctx) redirect("/"); // session ended, e.g. by a demo reset
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  const perms = ctx.membership.permissions;
  return (
    <DashboardView
      venueId={ctx.membership.venueId}
      name={ctx.user.name.split(" ")[0]}
      can={{ createJob: perms.has("job.create"), editVenue: perms.has("venue.edit") }}
    />
  );
}

export default async function DashboardPage() {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-text-secondary">{t("loading")}</p>}>
      <Dashboard />
    </Suspense>
  );
}
