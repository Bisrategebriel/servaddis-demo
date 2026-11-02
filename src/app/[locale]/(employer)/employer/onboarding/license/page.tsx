import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LicenseUpload } from "@/components/employer/license-upload";
import { Forbidden } from "@/components/employer/forbidden";
import { getEmployerContext } from "@/server/current-user";
import { db } from "@/server/db";

async function License() {
  const ctx = await getEmployerContext();
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  if (!ctx.membership.permissions.has("venue.edit"))
    return <Forbidden venueId={ctx.membership.venueId} />;

  const { venueId } = ctx.membership;
  const [venue, latest] = await Promise.all([
    db.venue.findUniqueOrThrow({ where: { id: venueId }, select: { verification: true } }),
    db.licenseDocument.findFirst({ where: { venueId }, orderBy: { uploadedAt: "desc" } }),
  ]);
  return (
    <LicenseUpload
      venueId={venueId}
      verification={venue.verification}
      fileName={latest?.fileName ?? null}
      rejectionReason={latest?.rejectionReason ?? null}
      showSample={process.env.DEMO_MODE === "1"}
    />
  );
}

export default async function LicensePage() {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-text-secondary">{t("loading")}</p>}>
      <License />
    </Suspense>
  );
}
