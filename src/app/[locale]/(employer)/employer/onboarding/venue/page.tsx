import { redirect } from "next/navigation";
import { FormSkeleton } from "@/components/skeletons";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { VenueForm } from "@/components/employer/venue-form";
import { getEmployerContext } from "@/server/current-user";

async function Setup() {
  const ctx = await getEmployerContext();
  if (!ctx) redirect("/");
  if (ctx.membership) redirect("/employer");
  return <VenueForm mode="create" name={ctx.user.name} phone={ctx.user.phone} />;
}

export default async function VenueSetupPage() {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<FormSkeleton label={t("loading")} fields={5} />}>
      <Setup />
    </Suspense>
  );
}
