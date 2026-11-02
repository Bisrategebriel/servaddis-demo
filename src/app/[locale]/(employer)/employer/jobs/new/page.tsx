import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TemplatePicker } from "@/components/employer/template-picker";
import { parseRoleTemplateDefaults } from "@/lib/role-template";
import { Forbidden } from "@/components/employer/forbidden";
import { getEmployerContext } from "@/server/current-user";
import { db } from "@/server/db";

async function Picker() {
  const [ctx, t] = await Promise.all([getEmployerContext(), getTranslations("jobs.picker")]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  if (!ctx.membership.permissions.has("job.create"))
    return <Forbidden venueId={ctx.membership.venueId} />;

  const [venue, rows] = await Promise.all([
    db.venue.findUniqueOrThrow({
      where: { id: ctx.membership.venueId },
      select: { verification: true },
    }),
    db.roleTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const templates = rows.map((r) => {
    const { salaryHint } = parseRoleTemplateDefaults(r.defaults);
    return {
      slug: r.slug,
      nameEn: r.nameEn,
      nameAm: r.nameAm,
      salaryMin: salaryHint.min,
      salaryMax: salaryHint.max,
    };
  });

  return (
    <>
      {venue.verification !== "VERIFIED" && (
        <p role="status" className="rounded-lg bg-warning-bg p-3 text-small text-warning-fg">
          {t("unverified")}
        </p>
      )}
      <TemplatePicker templates={templates} />
    </>
  );
}

export default async function NewJobPage() {
  const [t, common] = await Promise.all([
    getTranslations("jobs.picker"),
    getTranslations("common"),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-h1">{t("title")}</h1>
      <Suspense fallback={<p className="text-text-secondary">{common("loading")}</p>}>
        <Picker />
      </Suspense>
    </section>
  );
}
