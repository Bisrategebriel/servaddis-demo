import { beforeEach, describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS, advanceClock, loadClockOffset, now } from "@/server/clock";
import { db } from "@/server/db";
import { sweep } from "@/server/sweep";
import { createJob, hiwot, resetDb } from "./helpers";

const at = new Date("2026-11-02T09:00:00Z");
const plus = (ms: number) => new Date(at.getTime() + ms);

describe("sweep", () => {
  beforeEach(async () => {
    await resetDb();
    await loadClockOffset();
  });

  it("expires LIVE jobs whose expiresAt has passed, and only those", async () => {
    const { venue, selam } = await hiwot();
    const past = await createJob(venue.id, selam.id, { expiresAt: plus(-HOUR_MS) });
    const future = await createJob(venue.id, selam.id, { expiresAt: plus(10 * DAY_MS) });
    const closed = await createJob(venue.id, selam.id, {
      status: "CLOSED",
      expiresAt: plus(-DAY_MS),
    });

    expect((await sweep(at)).expired).toBe(1);
    const status = async (id: string) => (await db.job.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(past.id)).toBe("EXPIRED");
    expect(await status(future.id)).toBe("LIVE");
    expect(await status(closed.id)).toBe("CLOSED");
  });

  it("warns the job creator and owners 3 days before expiry, once", async () => {
    const { venue, selam, yared } = await hiwot();
    const job = await createJob(venue.id, yared.id, { expiresAt: plus(2 * DAY_MS) });
    await createJob(venue.id, yared.id, { expiresAt: plus(5 * DAY_MS) }); // too far out
    await createJob(venue.id, yared.id, { urgency: "NEXT_DAY", expiresAt: plus(DAY_MS) }); // urgent

    expect((await sweep(at)).expiryWarnings).toBe(2);
    const warned = await db.notification.findMany({ where: { kind: "JOB_EXPIRING" } });
    expect(warned.map((n) => n.userId).sort()).toEqual([selam.id, yared.id].sort());
    expect(warned.every((n) => n.href === `/employer/jobs/${job.id}`)).toBe(true);
    expect(warned[0].titleAm.length).toBeGreaterThan(0);

    expect((await sweep(plus(HOUR_MS))).expiryWarnings).toBe(0);
    expect(await db.notification.count({ where: { kind: "JOB_EXPIRING" } })).toBe(2);
  });

  it("sends due placement check-ins to both sides, with simulated SMS", async () => {
    const { venue, selam, yared } = await hiwot();
    const dawit = await db.user.findUniqueOrThrow({ where: { phone: "+251922000001" } });
    const job = await createJob(venue.id, yared.id, { status: "CLOSED" });
    const app = await db.application.create({
      data: { jobId: job.id, jobseekerId: dawit.id, status: "HIRED", hiredAt: plus(-15 * DAY_MS) },
    });
    await db.placementCheckin.createMany({
      data: [
        { applicationId: app.id, kind: "WEEK_2", dueAt: plus(-DAY_MS) },
        { applicationId: app.id, kind: "DAY_30", dueAt: plus(15 * DAY_MS) },
      ],
    });

    expect((await sweep(at)).checkinsSent).toBe(1);
    const sent = await db.placementCheckin.findMany({ orderBy: { kind: "asc" } });
    expect(sent.find((c) => c.kind === "WEEK_2")?.sentAt).toEqual(at);
    expect(sent.find((c) => c.kind === "DAY_30")?.sentAt).toBeNull();

    const recipients = (await db.notification.findMany({ where: { kind: "CHECKIN_DUE" } }))
      .map((n) => n.userId)
      .sort();
    expect(recipients).toEqual([dawit.id, selam.id, yared.id].sort());
    const smsTo = (await db.smsLog.findMany({ where: { kind: "CHECKIN" } })).map((s) => s.toPhone);
    expect(smsTo.sort()).toEqual([dawit.phone, selam.phone, yared.phone].sort());
    // Dawit's locale is Amharic, so his SMS is in Amharic.
    const dawitSms = await db.smsLog.findFirstOrThrow({ where: { toPhone: dawit.phone } });
    expect(dawitSms.body).toMatch(/[ሀ-፿]/);

    expect((await sweep(plus(HOUR_MS))).checkinsSent).toBe(0);
  });

  it("fails simulated bank transfers left pending for 7 days", async () => {
    const { venue } = await hiwot();
    const plan = await db.plan.findUniqueOrThrow({ where: { code: "PRO" } });
    const payment = (createdAt: Date) =>
      db.payment.create({
        data: {
          venueId: venue.id,
          planId: plan.id,
          amountEtb: 3500,
          vatEtb: 525,
          provider: "BANK_TRANSFER_SIM",
          createdAt,
        },
      });
    const stale = await payment(plus(-8 * DAY_MS));
    const recent = await payment(plus(-2 * DAY_MS));

    expect((await sweep(at)).paymentsFailed).toBe(1);
    expect((await db.payment.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("FAILED");
    expect((await db.payment.findUniqueOrThrow({ where: { id: recent.id } })).status).toBe(
      "PENDING",
    );
  });

  it("is idempotent: a second run changes nothing", async () => {
    const { venue, selam } = await hiwot();
    await createJob(venue.id, selam.id, { expiresAt: plus(-HOUR_MS) });
    await sweep(at);
    expect(await sweep(at)).toEqual({
      expired: 0,
      expiryWarnings: 0,
      checkinsSent: 0,
      paymentsFailed: 0,
    });
  });

  it("time-skip + sweep expires a job, as the toolkit will do (TRD §5.10)", async () => {
    const { venue, selam } = await hiwot();
    const job = await createJob(venue.id, selam.id, {
      expiresAt: new Date(Date.now() + 2 * DAY_MS),
    });
    expect((await sweep()).expired).toBe(0);
    await advanceClock(3 * DAY_MS);
    expect(now().getTime()).toBeGreaterThan(job.expiresAt!.getTime());
    expect((await sweep()).expired).toBe(1);
  });

  it("shares one run between concurrent callers", async () => {
    const [a, b] = [sweep(at), sweep(at)];
    expect(a).toBe(b);
    await a;
  });
});
