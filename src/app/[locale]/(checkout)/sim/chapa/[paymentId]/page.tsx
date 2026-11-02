import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { SimCheckout } from "@/components/billing/sim-checkout";
import { getEmployerContext } from "@/server/current-user";
import { AppError } from "@/server/http/errors";
import { paymentDetail } from "@/server/services/billing";

async function Checkout({ params }: { params: Promise<{ paymentId: string }> }) {
  const [ctx, { paymentId }, locale] = await Promise.all([
    getEmployerContext(),
    params,
    getLocale(),
  ]);
  if (!ctx) redirect("/");
  if (!ctx.membership?.permissions.has("billing.manage")) notFound();
  const p = await paymentDetail(ctx.membership.venueId, paymentId).catch((err: unknown) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  const am = locale === "am";
  return (
    <SimCheckout
      payment={{
        id: p.id,
        status: p.status,
        provider: p.provider,
        reference: p.providerRef ?? p.id,
        planName: am ? p.plan.nameAm : p.plan.nameEn,
        jobTitle: p.job ? (am ? p.job.titleAm || p.job.titleEn : p.job.titleEn) : null,
        venueName: (am ? p.venue.nameAm : null) || p.venue.nameEn,
        amountEtb: p.amountEtb,
        vatEtb: p.vatEtb,
      }}
    />
  );
}

export default function SimCheckoutPage({ params }: PageProps<"/[locale]/sim/chapa/[paymentId]">) {
  return (
    <Suspense
      fallback={
        <div className="h-80 w-full max-w-md animate-pulse rounded-2xl bg-white" aria-hidden />
      }
    >
      <Checkout params={params} />
    </Suspense>
  );
}
