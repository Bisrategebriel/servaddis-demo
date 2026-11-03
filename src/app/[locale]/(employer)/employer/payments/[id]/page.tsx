import Link from "next/link";
import { DetailSkeleton } from "@/components/skeletons";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PrintButton } from "@/components/billing/print-button";
import { Forbidden } from "@/components/employer/forbidden";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getEmployerContext } from "@/server/current-user";
import { AppError } from "@/server/http/errors";
import { paymentDetail } from "@/server/services/billing";

// SCR-E13 receipt: a clean, printable layout with the VAT line (doc 04). Only paid payments have
// one; a pending or failed payment has no receipt.

async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }, locale, t] = await Promise.all([
    getEmployerContext(),
    params,
    getLocale(),
    getTranslations("receipt"),
  ]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  if (!ctx.membership.permissions.has("billing.manage"))
    return <Forbidden venueId={ctx.membership.venueId} />;
  const p = await paymentDetail(ctx.membership.venueId, id).catch((err: unknown) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  if (p.status !== "SUCCEEDED" || !p.receiptNo) notFound();
  const am = locale === "am";
  const money = (n: number) => formatMoney(n, locale);
  const row = "flex justify-between gap-4 py-2";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 print:hidden">
        <Link
          href="/employer/plans"
          className="inline-flex h-11 items-center rounded-sm border border-input bg-card px-4 font-medium"
        >
          {t("back")}
        </Link>
        <PrintButton label={t("print")} />
      </div>
      <article
        data-testid="receipt"
        className="mx-auto w-full max-w-2xl rounded-md border border-border bg-white p-8 text-gray-700 print:max-w-none print:border-0 print:p-0"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-h1 text-navy-900">{t("title")}</h1>
            <p className="text-small">{t("seller")}</p>
          </div>
          <dl className="text-right text-small">
            <dt className="text-gray-500">{t("number")}</dt>
            <dd className="font-mono font-semibold text-navy-900" data-testid="receipt-no">
              {p.receiptNo}
            </dd>
            <dt className="mt-1 text-gray-500">{t("date")}</dt>
            <dd>{formatDateTime(p.paidAt ?? p.createdAt, locale)}</dd>
          </dl>
        </header>
        <dl className="grid gap-1 border-b border-gray-200 py-4 text-small">
          <div className={row}>
            <dt className="text-gray-500">{t("billedTo")}</dt>
            <dd className="font-medium">{(am ? p.venue.nameAm : null) || p.venue.nameEn}</dd>
          </div>
          <div className={row}>
            <dt className="text-gray-500">{t("description")}</dt>
            <dd className="text-right font-medium">
              {am ? p.plan.nameAm : p.plan.nameEn}
              {p.job && (
                <span className="block text-caption text-gray-500">
                  {am ? p.job.titleAm || p.job.titleEn : p.job.titleEn}
                </span>
              )}
            </dd>
          </div>
          <div className={row}>
            <dt className="text-gray-500">{t("method")}</dt>
            <dd>{t(`methods.${p.provider}`)}</dd>
          </div>
        </dl>
        <dl className="py-4 text-body">
          <div className={row}>
            <dt>{t("amount")}</dt>
            <dd>{money(p.amountEtb)}</dd>
          </div>
          <div className={row}>
            <dt>{t("vat")}</dt>
            <dd data-testid="vat">{money(p.vatEtb)}</dd>
          </div>
          <div className={`${row} border-t border-gray-300 text-h3 text-navy-900`}>
            <dt>{t("total")}</dt>
            <dd data-testid="receipt-total">{money(p.amountEtb + p.vatEtb)}</dd>
          </div>
        </dl>
        <p className="border-t border-gray-200 pt-3 text-caption text-gray-500">{t("demo")}</p>
      </article>
    </div>
  );
}

export default async function ReceiptPage({
  params,
}: PageProps<"/[locale]/employer/payments/[id]">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<DetailSkeleton label={t("loading")} />}>
      <Receipt params={params} />
    </Suspense>
  );
}
