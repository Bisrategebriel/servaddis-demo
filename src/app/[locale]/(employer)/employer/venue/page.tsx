import { FileText, Upload } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/employer/forbidden";
import { VenueForm } from "@/components/employer/venue-form";
import { VerificationChip } from "@/components/employer/verification-chip";
import { FormSkeleton } from "@/components/skeletons";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { getEmployerContext } from "@/server/current-user";
import { db } from "@/server/db";

// SCR-E16 venue profile (PRD E-02): edit the venue's details, see its verification and license.
// Owners only (venue.edit); anyone else gets the 403 page that says who can help.

async function VenueProfile() {
  const [ctx, locale, t] = await Promise.all([
    getEmployerContext(),
    getLocale(),
    getTranslations("venueProfile"),
  ]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  if (!ctx.membership.permissions.has("venue.edit")) {
    return <Forbidden venueId={ctx.membership.venueId} />;
  }

  const { venueId } = ctx.membership;
  const [venue, license] = await Promise.all([
    db.venue.findUniqueOrThrow({ where: { id: venueId }, include: { subCity: true } }),
    db.licenseDocument.findFirst({ where: { venueId }, orderBy: { uploadedAt: "desc" } }),
  ]);
  const status = venue.verification;
  const canUpload = status === "UNSUBMITTED" || status === "REJECTED";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">{t("title")}</h1>
        <p className="text-text-secondary">{t("intro")}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section
          aria-labelledby="venue-details"
          className="rounded-2xl border border-border bg-card p-5"
        >
          <h2 id="venue-details" className="mb-4 text-h3">
            {t("details")}
          </h2>
          <VenueForm
            mode="edit"
            venueId={venueId}
            initial={{
              nameEn: venue.nameEn,
              nameAm: venue.nameAm,
              category: venue.category,
              subCity: venue.subCity.slug,
              contactPhone: formatPhone(venue.contactPhone),
              descriptionEn: venue.descriptionEn,
              descriptionAm: venue.descriptionAm,
            }}
          />
        </section>

        <section
          aria-labelledby="venue-verification"
          data-testid="venue-verification"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
        >
          <h2 id="venue-verification" className="text-h3">
            {t("verification")}
          </h2>
          <VerificationChip status={status} />
          <p className="text-small text-text-secondary">{t(`notes.${status}`)}</p>

          {/* A venue verified with no document on file (the seeded ones) shows no license block. */}
          {(license || status !== "VERIFIED") && (
            <h3 className="mt-2 text-small font-semibold">{t("license")}</h3>
          )}
          {license ? (
            <div className="flex flex-col gap-1 text-small">
              <p className="flex items-center gap-2 font-medium wrap-break-word">
                <FileText className="size-4 shrink-0 text-text-secondary" aria-hidden />
                {license.fileName}
              </p>
              <p className="text-text-secondary">
                {t("uploaded", { date: formatDateTime(license.uploadedAt, locale) })}
              </p>
              {license.reviewedAt && (
                <p className="text-text-secondary">
                  {t("reviewed", { date: formatDateTime(license.reviewedAt, locale) })}
                </p>
              )}
              {status === "REJECTED" && license.rejectionReason && (
                <p className="rounded-sm bg-danger-bg px-3 py-2 text-danger-fg">
                  {t("reason", { reason: license.rejectionReason })}
                </p>
              )}
              <a
                href={`/api/files/${license.fileKey}`}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-10 w-fit items-center text-navy-700 underline underline-offset-4"
              >
                {t("viewDocument")}
              </a>
            </div>
          ) : (
            status !== "VERIFIED" && (
              <p className="text-small text-text-secondary">{t("noLicense")}</p>
            )
          )}
          {canUpload && (
            <Link
              href="/employer/onboarding/license"
              className="mt-1 inline-flex h-11 w-fit items-center gap-2 rounded-sm bg-primary px-4 font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Upload className="size-4" aria-hidden />
              {license ? t("uploadNew") : t("upload")}
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

export default async function VenuePage() {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<FormSkeleton label={t("loading")} fields={5} />}>
      <VenueProfile />
    </Suspense>
  );
}
