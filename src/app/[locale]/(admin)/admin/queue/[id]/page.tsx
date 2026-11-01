import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LicenseDecision } from "@/components/admin/license-decision";
import { getCurrentUser } from "@/server/current-user";
import { AppError } from "@/server/http/errors";
import { getItem } from "@/server/services/moderation";

// SCR-A02 review. The id and session are request data, so everything sits inside <Suspense>.
async function Review({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, t] = await Promise.all([
    params,
    getCurrentUser(),
    getTranslations("moderation"),
  ]);
  if (user?.platformRole !== "ADMIN") redirect("/");
  const item = await getItem(id).catch((err: unknown) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  const license = item.license;
  if (!license) notFound();
  const fileUrl = `/api/files/${license.fileKey}`;

  return (
    <section className="flex flex-col gap-4">
      <Link
        href="/admin/queue"
        className="w-fit text-small text-navy-700 underline underline-offset-4"
      >
        {t("back")}
      </Link>
      <div>
        <h1 className="text-h1">{license.venue.nameEn}</h1>
        <p className="text-small break-all text-text-secondary">{license.fileName}</p>
        {/* Not every browser can show a PDF inside the page. */}
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener"
          className="text-small text-navy-700 underline underline-offset-4"
        >
          {t("openDocument")}
        </a>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {license.mime === "application/pdf" ? (
          <iframe
            src={fileUrl}
            title={license.fileName}
            className="h-[60vh] w-full rounded-2xl border border-border bg-card"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- private, authorized file
          <img
            src={fileUrl}
            alt={license.fileName}
            className="max-h-[60vh] w-full rounded-2xl border border-border bg-card object-contain"
          />
        )}
        {item.status === "PENDING" ? (
          <LicenseDecision itemId={item.id} />
        ) : (
          <p role="status" className="text-text-secondary">
            {t("decided")}
          </p>
        )}
      </div>
    </section>
  );
}

export default async function ReviewPage({ params }: PageProps<"/[locale]/admin/queue/[id]">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-text-secondary">{t("loading")}</p>}>
      <Review params={params} />
    </Suspense>
  );
}
