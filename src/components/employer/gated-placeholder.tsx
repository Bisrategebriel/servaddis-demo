import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PagePlaceholder } from "@/components/page-placeholder";
import type { VenuePermission } from "@/lib/permissions";
import { getEmployerContext } from "@/server/current-user";
import { Forbidden } from "./forbidden";

/** A not-yet-built employer screen that already follows its permission (403 page otherwise). */
export async function GatedPlaceholder({
  perm,
  titleKey,
}: {
  perm: VenuePermission;
  titleKey: "venue";
}) {
  const [ctx, t] = await Promise.all([getEmployerContext(), getTranslations("pages")]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  if (!ctx.membership.permissions.has(perm)) return <Forbidden venueId={ctx.membership.venueId} />;
  return <PagePlaceholder title={t(titleKey)} />;
}
