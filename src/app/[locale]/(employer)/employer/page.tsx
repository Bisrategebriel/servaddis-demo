import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PagePlaceholder } from "@/components/page-placeholder";
import { getEmployerContext } from "@/server/current-user";

// The proxy can't see memberships (no DB in proxy), so employers without a venue land here
// first and are sent on to onboarding (App Flow §2).
async function RequireVenue() {
  const ctx = await getEmployerContext();
  if (!ctx) redirect("/"); // session ended, e.g. by a demo reset
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  return null;
}

export default async function DashboardPage() {
  const t = await getTranslations("pages");
  return (
    <>
      <Suspense fallback={null}>
        <RequireVenue />
      </Suspense>
      <PagePlaceholder title={t("dashboard")} />
    </>
  );
}
