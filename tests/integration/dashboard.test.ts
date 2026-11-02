import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as readRoute } from "@/app/api/notifications/read/route";
import { GET as listRoute } from "@/app/api/notifications/route";
import { GET as summaryRoute } from "@/app/api/venues/[id]/summary/route";
import { GET as smsRoute } from "@/app/api/demo/sms/route";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { createJob, resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const cookie = async (u: User) => ({
  cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
});
const noParams = { params: Promise.resolve({}) };

const summary = async (user: User, id: string) =>
  summaryRoute(new Request(`${BASE}/api/venues/${id}/summary`, { headers: await cookie(user) }), {
    params: Promise.resolve({ id }),
  });
const list = async (user: User) =>
  listRoute(new Request(`${BASE}/api/notifications`, { headers: await cookie(user) }), noParams);
const read = async (user: User, body: unknown) =>
  readRoute(
    new Request(`${BASE}/api/notifications/read`, {
      method: "POST",
      headers: { ...(await cookie(user)), "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    noParams,
  );

const hiwot = () => db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });
/** Hiwot with its seeded feed jobs (and their applicants) removed, for exact counts. */
const emptyHiwot = async () => {
  const venue = await hiwot();
  await db.job.deleteMany({ where: { venueId: venue.id } });
  return venue;
};
const lideta = () => db.venue.findFirstOrThrow({ where: { nameEn: "Lideta Corner Café" } });
const SELAM = "+251911000001";
const YARED = "+251911000002";
const RAHEL = "+251911000003";
const MEKDES = "+251911000006";

describe("venue summary", () => {
  beforeEach(resetDb);

  it("reports the verification state and rejection reason", async () => {
    const venue = await lideta();
    const owner = await byPhone(MEKDES);
    await db.venue.update({ where: { id: venue.id }, data: { verification: "REJECTED" } });
    await db.licenseDocument.updateMany({
      where: { venueId: venue.id },
      data: { rejectionReason: "Expired" },
    });
    const body = await (await summary(owner, venue.id)).json();
    expect(body.venue.verification).toBe("REJECTED");
    expect(body.checklist.rejectionReason).toBe("Expired");
  });

  it("marks the first job done once one has been published", async () => {
    const venue = await emptyHiwot();
    const selam = await byPhone(SELAM);
    expect((await (await summary(selam, venue.id)).json()).checklist.firstJob).toBe(false);
    await createJob(venue.id, selam.id, { publishedAt: new Date() });
    expect((await (await summary(selam, venue.id)).json()).checklist.firstJob).toBe(true);
  });

  it("computes KPIs and the plan", async () => {
    const venue = await emptyHiwot();
    const selam = await byPhone(SELAM);
    const dawit = await byPhone("+251922000001");
    const job = await createJob(venue.id, selam.id);
    await db.application.create({ data: { jobId: job.id, jobseekerId: dawit.id } });
    const published = new Date("2026-01-01T00:00:00Z");
    for (const days of [4, 8]) {
      await createJob(venue.id, selam.id, {
        status: "CLOSED",
        publishedAt: published,
        filledAt: new Date(published.getTime() + days * 86_400_000),
      });
    }
    const { kpis } = await (await summary(selam, venue.id)).json();
    expect(kpis).toMatchObject({ liveJobs: 1, newApplicants: 1, avgDaysToFill: 6 });
    expect(kpis.plan.nameEn).toBe("Pro");
  });

  it("shows applicant names only to members who may see applicants", async () => {
    const venue = await emptyHiwot();
    const selam = await byPhone(SELAM);
    const dawit = await byPhone("+251922000001");
    const job = await createJob(venue.id, selam.id);
    const app = await db.application.create({ data: { jobId: job.id, jobseekerId: dawit.id } });
    await db.applicationEvent.create({ data: { applicationId: app.id, type: "APPLIED" } });

    const rahel = await (await summary(await byPhone(RAHEL), venue.id)).json();
    expect(rahel.activity[0].name).toBe("Dawit A.");
    const yared = await (await summary(await byPhone(YARED), venue.id)).json();
    expect(yared.activity).toEqual([]);
    expect(yared.kpis.newApplicants).toBe(1); // counts stay visible (PRD Q3)
  });

  it("is 404 for another venue", async () => {
    expect((await summary(await byPhone(SELAM), (await lideta()).id)).status).toBe(404);
  });
});

describe("notifications", () => {
  beforeEach(resetDb);

  const seedFor = (userId: string, n: number) =>
    db.notification.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        userId,
        kind: "JOB_APPROVED" as const,
        titleEn: `Note ${i}`,
        titleAm: "ማስታወሻ",
      })),
    });

  it("lists only the user's own, with the unread count", async () => {
    const selam = await byPhone(SELAM);
    const yared = await byPhone(YARED);
    await seedFor(selam.id, 2);
    await seedFor(yared.id, 1);
    const body = await (await list(selam)).json();
    expect(body.unreadCount).toBe(2);
    expect(body.items.every((n: { userId: string }) => n.userId === selam.id)).toBe(true);
  });

  it("marks one, then all, as read", async () => {
    const selam = await byPhone(SELAM);
    await seedFor(selam.id, 3);
    const { items } = await (await list(selam)).json();
    await read(selam, { ids: [items[0].id] });
    expect((await (await list(selam)).json()).unreadCount).toBe(2);
    await read(selam, {});
    expect((await (await list(selam)).json()).unreadCount).toBe(0);
  });

  it("can't touch someone else's notifications", async () => {
    const selam = await byPhone(SELAM);
    const yared = await byPhone(YARED);
    await seedFor(selam.id, 1);
    const { items } = await (await list(selam)).json();
    expect(await (await read(yared, { ids: [items[0].id] })).json()).toEqual({ updated: 0 });
    expect((await (await list(selam)).json()).unreadCount).toBe(1);
  });

  it("requires a session", async () => {
    expect((await listRoute(new Request(`${BASE}/api/notifications`), noParams)).status).toBe(401);
  });
});

describe("simulated SMS log", () => {
  beforeEach(resetDb);

  it("lists newest first, and only in demo mode", async () => {
    await db.smsLog.create({ data: { toPhone: "+251911000011", body: "Hello", kind: "ALERT" } });
    const body = await (await smsRoute(new Request(`${BASE}/api/demo/sms`), undefined)).json();
    expect(body.items[0].body).toBe("Hello");
    process.env.DEMO_MODE = "0";
    expect((await smsRoute(new Request(`${BASE}/api/demo/sms`), undefined)).status).toBe(404);
    process.env.DEMO_MODE = "1";
  });
});
