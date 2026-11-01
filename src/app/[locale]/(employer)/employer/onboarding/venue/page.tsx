import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { VenueSetupForm } from "@/components/employer/venue-setup-form";
import { getEmployerContext } from "@/server/current-user";

async function Setup() {
  const ctx = await getEmployerContext();
  if (!ctx) redirect("/");
  if (ctx.membership) redirect("/employer");
  return <VenueSetupForm name={ctx.user.name} phone={ctx.user.phone} />;
}

export default async function VenueSetupPage() {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-text-secondary">{t("loading")}</p>}>
      <Setup />
    </Suspense>
  );
}
