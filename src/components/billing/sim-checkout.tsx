"use client";

import { Landmark, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

// SCR-E12: the presenter's three buttons (Pay / Fail / Cancel) plus the bank-transfer path.
// Each goes to /api/billing/sim/:id, which runs the webhook's own processing (TRD §5.7).

type Payment = {
  id: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  provider: "CHAPA_SIM" | "BANK_TRANSFER_SIM";
  reference: string;
  planName: string;
  jobTitle: string | null;
  venueName: string;
  amountEtb: number;
  vatEtb: number;
};

export function SimCheckout({ payment }: { payment: Payment }) {
  const t = useTranslations("checkout");
  const tp = useTranslations("plans");
  const locale = useLocale();
  const am = locale === "am";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bank, setBank] = useState(payment.provider === "BANK_TRANSFER_SIM");
  const money = (n: number) => n.toLocaleString("en-US");
  const total = payment.amountEtb + payment.vatEtb;

  async function act(action: "pay" | "fail" | "cancel" | "bank") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/sim/${payment.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(am ? body.error.messageAm : body.error.message);
      } else if (action === "bank") {
        setBank(true);
      } else {
        const next =
          body.receiptUrl ??
          `/employer/plans?payment=${action === "cancel" ? "cancelled" : "failed"}`;
        window.location.assign(next);
        return;
      }
    } catch {
      setError(t("error"));
    }
    setBusy(false);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <p
        role="note"
        className="flex items-start gap-2 rounded-md border border-warning-fg/30 bg-warning-bg px-3 py-2 text-small text-warning-fg"
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("banner")}
      </p>
      <section
        className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-overlay"
        data-testid="checkout"
      >
        <h1 className="text-h2 text-gray-700">{t("title")}</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-small">
          <dt className="text-gray-500">{t("merchant")}</dt>
          <dd className="text-right font-medium">Servaddis</dd>
          <dt className="text-gray-500">{t("item")}</dt>
          <dd className="text-right font-medium">
            {payment.planName}
            {payment.jobTitle && (
              <span className="block text-caption text-gray-500">
                {t("forJob", { title: payment.jobTitle })}
              </span>
            )}
          </dd>
          <dt className="text-gray-500">{t("amount")}</dt>
          <dd className="text-right">{formatMoney(payment.amountEtb, locale)}</dd>
          <dt className="text-gray-500">{t("vat")}</dt>
          <dd className="text-right">{formatMoney(payment.vatEtb, locale)}</dd>
          <div className="col-span-2 border-t border-gray-200" aria-hidden />
          <dt className="font-semibold">{t("total")}</dt>
          <dd className="text-right text-h3" data-testid="total">
            {formatMoney(total, locale)}
          </dd>
        </dl>

        {error && (
          <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
            {error}
          </p>
        )}

        {payment.status !== "PENDING" ? (
          <div className="flex flex-col gap-2">
            <p>{t("done", { status: tp(`statuses.${payment.status}`) })}</p>
            {payment.status === "SUCCEEDED" ? (
              <Link
                href={`/employer/payments/${payment.id}`}
                className="font-medium text-navy-700 underline underline-offset-4"
              >
                {t("viewReceipt")}
              </Link>
            ) : (
              <Link
                href="/employer/plans"
                className="font-medium text-navy-700 underline underline-offset-4"
              >
                {t("backToPlans")}
              </Link>
            )}
          </div>
        ) : bank ? (
          <div
            className="flex flex-col gap-2 rounded-md bg-gray-100 p-3 text-small"
            data-testid="bank"
          >
            <p className="flex items-center gap-2 font-semibold">
              <Landmark className="size-4" aria-hidden />
              {t("bankTitle")}
            </p>
            <p>{t("bankBody", { ref: payment.reference })}</p>
            <p className="font-mono text-caption">{t("bankAccount")}</p>
            <Link
              href="/employer/plans"
              className="font-medium text-navy-700 underline underline-offset-4"
            >
              {t("backToPlans")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button className="h-12 text-body" disabled={busy} onClick={() => act("pay")}>
              {busy ? t("working") : t("pay", { total: money(total) })}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1"
                disabled={busy}
                onClick={() => act("fail")}
              >
                {t("fail")}
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1"
                disabled={busy}
                onClick={() => act("cancel")}
              >
                {t("cancel")}
              </Button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("bank")}
              className="min-h-10 text-small text-navy-700 underline underline-offset-4"
            >
              {t("bank")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
