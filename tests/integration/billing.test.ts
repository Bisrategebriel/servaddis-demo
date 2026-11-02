import type { User } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as checkoutRoute } from "@/app/api/billing/checkout/route";
import { GET as plansRoute } from "@/app/api/billing/plans/route";
import { POST as simRoute } from "@/app/api/billing/sim/[paymentId]/route";
import { POST as webhookRoute } from "@/app/api/billing/webhook/route";
import { toJobPayload, formFromTemplate } from "@/lib/job-form";
import { prefillFromTemplate } from "@/lib/role-template";
import { db } from "@/server/db";
import { vatOf } from "@/server/services/billing";
import { promotionEligibility } from "@/server/services/promote";
import { signSessionToken } from "@/server/session";
import { POST as createJobRoute } from "@/app/api/jobs/route";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const HENOCK = "+251911000005"; // Piassa: Standard, plan full (5 live jobs)
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const headers = async (u: User) => ({
  cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
  "content-type": "application/json",
});
const call = async (route: typeof checkoutRoute, u: User, body: unknown, params = {}) =>
  route(
    new Request(`${BASE}/api/billing/x`, {
      method: "POST",
      headers: await headers(u),
      body: JSON.stringify(body),
    }),
    {
      params: Promise.resolve(params),
    },
  );
const checkout = async (u: User, body: unknown) => call(checkoutRoute, u, body);
const sim = async (u: User, paymentId: string, action: string) =>
  call(simRoute as typeof checkoutRoute, u, { action }, { paymentId });
const webhook = (body: unknown, secret?: string) =>
  webhookRoute(
    new Request(`${BASE}/api/billing/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-webhook-secret": secret } : {}),
      },
      body: JSON.stringify(body),
    }),
    undefined,
  );
const piassa = () => db.venue.findFirstOrThrow({ where: { nameEn: "Piassa Terrace Restaurant" } });

describe("billing (App Flow §8, TRD §5.7)", () => {
  const savedSecret = process.env.WEBHOOK_SECRET;
  beforeAll(() => {
    process.env.WEBHOOK_SECRET = "test-webhook-secret";
  });
  afterAll(() => {
    process.env.WEBHOOK_SECRET = savedSecret;
  });
  beforeEach(resetDb);

  it("lists plans with VAT, the current plan, and history", async () => {
    const res = await plansRoute(
      new Request(`${BASE}/api/billing/plans`, { headers: await headers(await byPhone(HENOCK)) }),
      {
        params: Promise.resolve({}),
      },
    );
    const body = await res.json();
    expect(body.current.code).toBe("STANDARD");
    expect(body.plans.find((p: { code: string }) => p.code === "PRO")).toMatchObject({
      priceEtb: 3500,
      vatEtb: 525,
    });
    expect(body.canPost).toBe(false); // Standard plan full
  });

  it("VAT is 15 % rounded to the birr", () => {
    expect(vatOf(3500)).toBe(525);
    expect(vatOf(1500)).toBe(225);
    expect(vatOf(333)).toBe(50);
  });

  it("upgrade to Pro: pay → receipt, subscription switched, Promote unlocked, owner told", async () => {
    const henock = await byPhone(HENOCK);
    const venue = await piassa();
    const job = await db.job.findFirstOrThrow({ where: { venueId: venue.id } });
    expect((await promotionEligibility(job)).allowed).toBe(false);

    const res = await checkout(henock, { planCode: "PRO" });
    expect(res.status).toBe(201);
    const { paymentId, checkoutUrl } = await res.json();
    expect(checkoutUrl).toBe(`/sim/chapa/${paymentId}`);
    expect(await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).toMatchObject({
      status: "PENDING",
      amountEtb: 3500,
      vatEtb: 525,
      provider: "CHAPA_SIM",
    });

    const paid = await sim(henock, paymentId, "pay");
    expect(await paid.json()).toMatchObject({
      status: "SUCCEEDED",
      receiptUrl: `/employer/payments/${paymentId}`,
    });
    const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.receiptNo).toMatch(/^SVD-\d{4}-000001$/);
    const subs = await db.subscription.findMany({
      where: { venueId: venue.id },
      include: { plan: true },
    });
    expect(subs.map((s) => `${s.plan.code}:${s.status}`).sort()).toEqual([
      "PRO:ACTIVE",
      "STANDARD:CANCELLED",
    ]);
    expect((await promotionEligibility(job)).allowed).toBe(true);
    const note = await db.notification.findFirstOrThrow({
      where: { kind: "PAYMENT_RECEIPT", userId: henock.id },
    });
    expect(note.bodyEn).toContain("ETB 4,025");
    expect(
      await db.smsLog.count({ where: { toPhone: HENOCK, body: { contains: payment.receiptNo! } } }),
    ).toBe(1);
  });

  it("receipt numbers count up within the year", async () => {
    const henock = await byPhone(HENOCK);
    const a = (await (await checkout(henock, { planCode: "PRO" })).json()).paymentId;
    await sim(henock, a, "pay");
    const b = (await (await checkout(henock, { planCode: "STANDARD" })).json()).paymentId;
    await sim(henock, b, "pay");
    const nos = (
      await db.payment.findMany({
        where: { receiptNo: { not: null } },
        orderBy: { receiptNo: "asc" },
      })
    ).map((p) => p.receiptNo!.slice(-6));
    expect(nos).toEqual(["000001", "000002"]);
  });

  it("fail and cancel leave the plan as it was", async () => {
    const henock = await byPhone(HENOCK);
    for (const action of ["fail", "cancel"]) {
      const id = (await (await checkout(henock, { planCode: "PRO" })).json()).paymentId;
      expect((await (await sim(henock, id, action)).json()).status).toBe("FAILED");
    }
    const active = await db.subscription.findFirstOrThrow({
      where: { venueId: (await piassa()).id, status: "ACTIVE" },
      include: { plan: true },
    });
    expect(active.plan.code).toBe("STANDARD");
  });

  it("the webhook needs the shared secret and is idempotent", async () => {
    const henock = await byPhone(HENOCK);
    const id = (await (await checkout(henock, { planCode: "PRO" })).json()).paymentId;
    const { providerRef } = await db.payment.findUniqueOrThrow({ where: { id } });
    expect((await webhook({ providerRef, outcome: "SUCCEEDED" })).status).toBe(401);
    expect(
      (await webhook({ providerRef, outcome: "SUCCEEDED" }, "wrong-secret-value!")).status,
    ).toBe(401);
    const first = await webhook({ providerRef, outcome: "SUCCEEDED" }, "test-webhook-secret");
    expect(await first.json()).toEqual({ status: "SUCCEEDED", changed: true });
    const again = await webhook({ providerRef, outcome: "FAILED" }, "test-webhook-secret");
    expect(await again.json()).toEqual({ status: "SUCCEEDED", changed: false });
    expect(
      await db.subscription.count({ where: { venueId: (await piassa()).id, status: "ACTIVE" } }),
    ).toBe(1);
  });

  it("an urgent post pays for a held draft and sends it to review", async () => {
    const henock = await byPhone(HENOCK);
    const row = await db.roleTemplate.findUniqueOrThrow({ where: { slug: "barista" } });
    const created = await createJobRoute(
      new Request(`${BASE}/api/jobs`, {
        method: "POST",
        headers: await headers(henock),
        body: JSON.stringify(toJobPayload(formFromTemplate(prefillFromTemplate(row), "arada"))),
      }),
      { params: Promise.resolve({}) },
    );
    const { job } = await created.json();
    expect((await checkout(henock, { planCode: "URGENT_POST" })).status).toBe(400); // needs a job
    const res = await checkout(henock, { planCode: "URGENT_POST", jobId: job.id });
    const { paymentId } = await res.json();
    expect(await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).toMatchObject({
      amountEtb: 300,
      vatEtb: 45,
      jobId: job.id,
    });
    await sim(henock, paymentId, "pay");
    const after = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after).toMatchObject({ status: "PENDING_REVIEW", postingSource: "URGENT_PAID" });
    expect(await db.moderationItem.count({ where: { jobId: job.id } })).toBe(1);
  });

  it("won't take money for a job the rules would block", async () => {
    const henock = await byPhone(HENOCK);
    const row = await db.roleTemplate.findUniqueOrThrow({ where: { slug: "barista" } });
    const body = {
      ...toJobPayload(formFromTemplate(prefillFromTemplate(row), "arada")),
      descriptionEn: "Registration fee ETB 200.",
    };
    const { job } = await (
      await createJobRoute(
        new Request(`${BASE}/api/jobs`, {
          method: "POST",
          headers: await headers(henock),
          body: JSON.stringify(body),
        }),
        {
          params: Promise.resolve({}),
        },
      )
    ).json();
    expect((await checkout(henock, { planCode: "URGENT_POST", jobId: job.id })).status).toBe(422);
    expect(await db.payment.count()).toBe(0);
  });

  it("refuses buying the plan you already have, and is for billing.manage only", async () => {
    expect((await checkout(await byPhone(HENOCK), { planCode: "STANDARD" })).status).toBe(409);
    const selam = await byPhone("+251911000001");
    expect((await checkout(selam, { planCode: "PRO" })).status).toBe(409); // Hiwot is already Pro
    expect((await checkout(await byPhone("+251911000004"), { planCode: "STANDARD" })).status).toBe(
      403,
    ); // HR manager
  });

  it("another venue's payment is not found", async () => {
    const id = (await (await checkout(await byPhone(HENOCK), { planCode: "PRO" })).json())
      .paymentId;
    expect((await sim(await byPhone("+251911000001"), id, "pay")).status).toBe(404);
  });
});
