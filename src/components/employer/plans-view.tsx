"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BillingOverview } from "@/server/services/billing";

// SCR-E11 Plans: Standard, Pro (recommended) and the one-time urgent post, the current plan,
// and the payment history with receipts. Prices are illustrative placeholders (D-1).

const SHOWN = ["STANDARD", "PRO", "URGENT_POST"];
const FEATURES = [
  "free_posts_3",
  "one_job",
  "live_jobs_5",
  "unlimited_jobs",
  "pipeline",
  "social",
  "priority_placement",
  "insights",
  "urgent_badge",
] as const;
const isFeature = (f: string): f is (typeof FEATURES)[number] =>
  (FEATURES as readonly string[]).includes(f);

export function PlansView({
  data,
  notice,
}: {
  data: BillingOverview;
  notice: "failed" | "cancelled" | null;
}) {
  const t = useTranslations("plans");
  const locale = useLocale();
  const am = locale === "am";
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(planCode: string) {
    setBusy(planCode);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const body = await res.json();
      if (res.ok) {
        window.location.assign(body.checkoutUrl);
        return;
      }
      setError(am ? body.error.messageAm : body.error.message);
    } catch {
      setError(t("error"));
    }
    setBusy(null);
  }

  // Standard, Pro, then the one-time urgent post (doc 04 SCR-E11), whatever the seed order.
  const plans = data.plans
    .filter((p) => SHOWN.includes(p.code))
    .sort((a, b) => SHOWN.indexOf(a.code) - SHOWN.indexOf(b.code));
  const money = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">{t("title")}</h1>
        <p className="text-small text-text-secondary">{t("illustrative")}</p>
        {data.foundingPostsLeft > 0 && (
          <p className="text-small">{t("founding", { count: data.foundingPostsLeft })}</p>
        )}
      </div>

      {notice && (
        <p role="alert" className="rounded-sm bg-warning-bg px-3 py-2 text-small text-warning-fg">
          {t(notice)}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3" data-testid="plans">
        {plans.map((p) => {
          const current = data.current?.code === p.code;
          const recommended = p.code === "PRO";
          const name = am ? p.nameAm : p.nameEn;
          return (
            <section
              key={p.code}
              data-plan={p.code}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border bg-card p-5",
                recommended ? "border-2 border-brand-accent" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-h3">{name}</h2>
                {recommended && (
                  <span className="rounded-full bg-brand-accent px-2 py-0.5 text-caption font-semibold text-navy-900">
                    {t("recommended")}
                  </span>
                )}
                {current && (
                  <span className="rounded-full bg-success-bg px-2 py-0.5 text-caption font-semibold text-success-fg">
                    {t("current")}
                  </span>
                )}
              </div>
              <p className="text-h2">
                {p.kind === "SUBSCRIPTION"
                  ? t("perMonth", { price: money(p.priceEtb) })
                  : t("oneTime", { price: money(p.priceEtb) })}
              </p>
              {current && data.current && (
                <p className="text-caption text-text-secondary">
                  {t("until", { date: formatDate(data.current.until, locale) })}
                </p>
              )}
              <ul className="flex flex-col gap-1.5 text-small">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-success-fg" aria-hidden />
                    {isFeature(f) ? t(`features.${f}`) : f}
                  </li>
                ))}
                {!p.includesSocial && (
                  <li className="flex items-center gap-2 text-text-secondary" data-locked="social">
                    <X className="size-4 shrink-0" aria-hidden />
                    <span className="line-through">{t("noSocial")}</span>
                  </li>
                )}
              </ul>
              <div className="mt-auto pt-2">
                {p.code === "URGENT_POST" ? (
                  <p className="text-small text-text-secondary">{t("urgentHow")}</p>
                ) : current ? null : (
                  <Button
                    className={cn(
                      "h-11 w-full",
                      !recommended && "border border-input bg-card text-foreground hover:bg-muted",
                    )}
                    disabled={!!busy}
                    onClick={() => choose(p.code)}
                  >
                    {busy === p.code
                      ? t("redirecting")
                      : data.current
                        ? t("switch", { name })
                        : t("choose")}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section aria-labelledby="history" className="flex flex-col gap-2">
        <h2 id="history" className="text-h3">
          {t("history")}
        </h2>
        {data.payments.length === 0 ? (
          <p className="text-small text-text-secondary">{t("noPayments")}</p>
        ) : (
          <ul
            className="flex flex-col divide-y divide-border rounded-md border border-border bg-card"
            data-testid="payments"
          >
            {data.payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-small"
              >
                <span className="font-medium">{am ? p.planAm : p.planEn}</span>
                <span>ETB {money(p.totalEtb)}</span>
                <span className="text-text-secondary">{formatDate(p.createdAt, locale)}</span>
                <span
                  className={cn(
                    "rounded-sm px-2 py-0.5 text-caption",
                    p.status === "SUCCEEDED"
                      ? "bg-success-bg text-success-fg"
                      : p.status === "FAILED"
                        ? "bg-danger-bg text-danger-fg"
                        : "bg-gray-100 text-gray-700",
                  )}
                >
                  {t(`statuses.${p.status}`)}
                </span>
                {p.receiptNo && (
                  <Link
                    href={`/employer/payments/${p.id}`}
                    className="ml-auto text-navy-700 underline underline-offset-4"
                  >
                    {t("receipt")} {p.receiptNo}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
