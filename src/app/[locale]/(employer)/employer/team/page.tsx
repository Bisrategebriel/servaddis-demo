import { redirect } from "next/navigation";
import { TableSkeleton } from "@/components/skeletons";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/employer/forbidden";
import { TeamManager } from "@/components/employer/team-manager";
import { getEmployerContext } from "@/server/current-user";
import { listTeam } from "@/server/services/team";

// SCR-E14: owners (team.manage) only; everyone else gets the 403 page.

async function Team() {
  const ctx = await getEmployerContext();
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  const { venueId, permissions, role } = ctx.membership;
  if (!permissions.has("team.manage")) return <Forbidden venueId={venueId} />;
  return (
    <TeamManager
      venueId={venueId}
      initial={await listTeam(venueId, ctx.user)}
      actorIsOwner={role === "OWNER"}
    />
  );
}

export default async function TeamPage() {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<TableSkeleton label={t("loading")} rows={4} />}>
      <Team />
    </Suspense>
  );
}
