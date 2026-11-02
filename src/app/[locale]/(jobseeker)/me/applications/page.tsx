import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ApplicationTracker } from "@/components/jobseeker/application-tracker";
import { getCurrentUser } from "@/server/current-user";
import { myApplications } from "@/server/services/applications";

// SCR-J03: rendered with the current state, then kept fresh by the tracker's poll.

async function Applications() {
  const user = await getCurrentUser();
  if (user?.platformRole !== "JOBSEEKER") redirect("/login?next=/me/applications");
  return <ApplicationTracker initial={await myApplications(user.id)} />;
}

export default async function MyApplicationsPage() {
  const t = await getTranslations("tracker");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t("title")}</h1>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted" aria-hidden />}>
        <Applications />
      </Suspense>
    </div>
  );
}
