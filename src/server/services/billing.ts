import "server-only";
import { randomBytes } from "node:crypto";
import type { Payment, Plan, Prisma, User } from "@prisma/client";
import { DAY_MS, now } from "../clock";
import { db } from "../db";
import { AppError, conflict, notFound } from "../http/errors";
import { audit } from "./audit";
import { submissionChecks, submitJob, venueEntitlement } from "./jobs";
import { notify, sms } from "./notifications";

// Plans and simulated checkout (E-16; App Flow §8; TRD §5.7). Prices are ILLUSTRATIVE (D-1).
// Checkout creates Payment(PENDING) and sends the owner to the simulated hosted page; its
// outcome arrives through `applyOutcome`, the same code path as the webhook, idempotent on the
// provider reference. Success: receipt number, then a subscription or the held job released.

type Tx = Prisma.TransactionClient;

export const VAT_RATE = 0.15;
/** VAT = round(amount × 15 %) to the nearest birr (doc 05 §6.4). */
export const vatOf = (amountEtb: number) => Math.round(amountEtb * VAT_RATE);

export type BuyableCode = "STANDARD" | "PRO" | "URGENT_POST";

/** Plans for the Plans screen, the venue's current plan and its payment history. */
export async function billingOverview(venueId: string) {
  const [plans, subscription, venue, payments, entitlement] = await Promise.all([
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.subscription.findFirst({
      where: { venueId, status: "ACTIVE", currentPeriodEnd: { gt: now() } },
      include: { plan: true },
    }),
    db.venue.findUniqueOrThrow({ where: { id: venueId } }),
    db.payment.findMany({
      where: { venueId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { plan: true },
    }),
    venueEntitlement(db, venueId),
  ]);
  return {
    plans: plans.map((p) => ({
      code: p.code,
      kind: p.kind,
      nameEn: p.nameEn,
      nameAm: p.nameAm,
      priceEtb: p.priceEtb,
      vatEtb: vatOf(p.priceEtb),
      periodDays: p.periodDays,
      maxLiveJobs: p.maxLiveJobs,
      includesSocial: p.includesSocial,
      features: JSON.parse(p.features) as string[],
    })),
    current: subscription
      ? { code: subscription.plan.code, until: subscription.currentPeriodEnd.toISOString() }
      : null,
    foundingPostsLeft: venue.foundingPostsLeft,
    canPost: !entitlement.requiresPayment,
    payments: payments.map((p) => ({
      id: p.id,
      planEn: p.plan.nameEn,
      planAm: p.plan.nameAm,
      totalEtb: p.amountEtb + p.vatEtb,
      status: p.status,
      provider: p.provider,
      receiptNo: p.receiptNo,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export type BillingOverview = Awaited<ReturnType<typeof billingOverview>>;

/**
 * Starts a checkout (TRD §5.7). A subscription can be bought any time (switching plans replaces
 * the current one at once, no proration in the demo); an urgent post needs a draft job of this
 * venue that would pass every submit check, so nobody pays for a job the rules would block.
 */
export async function createCheckout(
  user: User,
  venueId: string,
  input: { planCode: BuyableCode; jobId?: string },
) {
  const plan = await db.plan.findUnique({ where: { code: input.planCode } });
  if (!plan || !plan.isActive) throw notFound();
  let jobId: string | null = null;
  if (plan.code === "URGENT_POST") {
    if (!input.jobId) {
      throw new AppError("BAD_REQUEST", {
        message: "Choose the job this urgent post is for.",
        messageAm: "ይህ አስቸኳይ ማስታወቂያ ለየትኛው ሥራ እንደሆነ ይምረጡ።",
      });
    }
    const job = await db.job.findUnique({ where: { id: input.jobId } });
    if (!job || job.venueId !== venueId) throw notFound();
    if (job.status !== "DRAFT" && job.status !== "CHANGES_REQUESTED") {
      throw conflict("This job has already been submitted.", "ይህ ሥራ አስቀድሞ ገብቷል።", {
        status: job.status,
      });
    }
    await submissionChecks(job.id); // venue verified, required fields, rules
    jobId = job.id;
  } else {
    const current = await db.subscription.findFirst({
      where: { venueId, status: "ACTIVE", currentPeriodEnd: { gt: now() } },
      include: { plan: true },
    });
    if (current?.plan.code === plan.code) {
      throw conflict("You're already on this plan.", "አስቀድመው በዚህ ዕቅድ ላይ ነዎት።", {
        reason: "SAME_PLAN",
      });
    }
  }
  const payment = await db.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        venueId,
        planId: plan.id,
        jobId,
        amountEtb: plan.priceEtb,
        vatEtb: vatOf(plan.priceEtb),
        provider: "CHAPA_SIM",
        providerRef: `sim_${randomBytes(9).toString("base64url")}`,
        createdAt: now(),
      },
    });
    await audit(tx, {
      actorId: user.id,
      action: "billing.checkout",
      entity: "Payment",
      entityId: p.id,
      meta: { plan: plan.code, jobId },
    });
    return p;
  });
  return { payment, checkoutUrl: `/sim/chapa/${payment.id}` };
}

/** "SVD-2026-000042": the year's next number (doc 05 §6.4). */
async function nextReceiptNo(tx: Tx, at: Date) {
  const year = at.getUTCFullYear();
  const prefix = `SVD-${year}-`;
  const last = await tx.payment.findFirst({
    where: { receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: "desc" },
    select: { receiptNo: true },
  });
  const n = last?.receiptNo ? Number(last.receiptNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(6, "0")}`;
}

export type Outcome = "SUCCEEDED" | "FAILED" | "CANCELLED";

/**
 * The gateway's answer (webhook or simulated page). Idempotent on the provider reference: a
 * payment already decided is returned unchanged. Cancelled is stored as FAILED (no separate
 * status in the schema); the UI says which.
 */
export async function applyOutcome(providerRef: string, outcome: Outcome) {
  const payment = await db.payment.findFirst({ where: { providerRef }, include: { plan: true } });
  if (!payment) throw notFound();
  if (payment.status !== "PENDING") return { payment, changed: false };
  const at = now();

  if (outcome !== "SUCCEEDED") {
    const failed = await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    await db.auditLog.create({
      data: {
        action: "billing.payment_failed",
        entity: "Payment",
        entityId: payment.id,
        meta: JSON.stringify({ outcome }),
        at,
      },
    });
    return { payment: { ...failed, plan: payment.plan }, changed: true };
  }

  const paid = await db.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", paidAt: at, receiptNo: await nextReceiptNo(tx, at) },
    });
    if (payment.plan.kind === "SUBSCRIPTION")
      await startSubscription(tx, payment, payment.plan, at);
    if (payment.jobId) {
      // The held job now has its post; submit runs right after this transaction.
      await tx.job.update({ where: { id: payment.jobId }, data: { postingSource: "URGENT_PAID" } });
    }
    await tellOwners(tx, updated, payment.plan);
    await audit(tx, {
      actorId: null,
      action: "billing.payment_succeeded",
      entity: "Payment",
      entityId: payment.id,
      meta: { plan: payment.plan.code, receiptNo: updated.receiptNo },
    });
    return updated;
  });

  if (payment.jobId) await releaseHeldJob(payment.jobId, payment.venueId);
  return { payment: { ...paid, plan: payment.plan }, changed: true };
}

/** A new plan replaces the current one at once (demo: no proration). */
async function startSubscription(tx: Tx, payment: Payment, plan: Plan, at: Date) {
  await tx.subscription.updateMany({
    where: { venueId: payment.venueId, status: "ACTIVE" },
    data: { status: "CANCELLED", cancelledAt: at },
  });
  await tx.subscription.create({
    data: {
      venueId: payment.venueId,
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: at,
      currentPeriodEnd: new Date(at.getTime() + (plan.periodDays ?? 30) * DAY_MS),
    },
  });
}

/**
 * App Flow §4.2: after the urgent post is paid, the job moves to review by itself. If a check
 * fails now (e.g. the text was edited), it stays a draft that already has its post, and the
 * employer submits it again without paying twice.
 */
async function releaseHeldJob(jobId: string, venueId: string) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const owner = await db.venueMember.findFirst({
    where: { venueId, role: "OWNER", status: "ACTIVE", userId: { not: null } },
    include: { user: true },
  });
  if (!owner?.user || (job.status !== "DRAFT" && job.status !== "CHANGES_REQUESTED")) return;
  try {
    await submitJob(owner.user, job);
  } catch (err) {
    console.warn(`Paid job ${jobId} stays a draft:`, err instanceof Error ? err.message : err);
  }
}

async function tellOwners(tx: Tx, payment: Payment, plan: Plan) {
  const owners = await tx.venueMember.findMany({
    where: { venueId: payment.venueId, role: "OWNER", status: "ACTIVE", userId: { not: null } },
    include: { user: true },
  });
  const total = (payment.amountEtb + payment.vatEtb).toLocaleString("en-US");
  await notify(
    tx,
    owners.map((o) => o.userId!),
    {
      kind: "PAYMENT_RECEIPT",
      titleEn: "Payment received",
      titleAm: "ክፍያ ደርሷል",
      bodyEn: `${plan.nameEn}: ETB ${total} incl. VAT. Receipt ${payment.receiptNo}.`,
      bodyAm: `${plan.nameAm}፦ ተ.እ.ታን ጨምሮ ${total} ብር። ደረሰኝ ${payment.receiptNo}።`,
      href: `/employer/payments/${payment.id}`,
    },
  );
  for (const o of owners) {
    const en = `Servaddis: payment of ETB ${total} received for ${plan.nameEn}. Receipt ${payment.receiptNo}.`;
    const am = `Servaddis፦ ለ${plan.nameAm} የ${total} ብር ክፍያ ደርሷል። ደረሰኝ ${payment.receiptNo}።`;
    await sms(tx, o.user!.phone, o.user!.locale === "AM" ? am : en, "ALERT");
  }
}

/** Switch a pending checkout to the simulated bank transfer: it waits for a manual confirmation. */
export async function chooseBankTransfer(paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFound();
  if (payment.status !== "PENDING") return payment;
  return db.payment.update({ where: { id: paymentId }, data: { provider: "BANK_TRANSFER_SIM" } });
}

/** One payment of this venue, for the checkout page and the receipt. */
export async function paymentDetail(venueId: string, paymentId: string) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      plan: true,
      venue: true,
      job: { select: { id: true, titleEn: true, titleAm: true } },
    },
  });
  if (!payment || payment.venueId !== venueId) throw notFound();
  return payment;
}
