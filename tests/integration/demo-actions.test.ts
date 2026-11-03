import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as approveAllRoute } from "@/app/api/demo/approve-all/route";
import { POST as scenarioRoute } from "@/app/api/demo/scenario/route";
import { POST as simulateRoute } from "@/app/api/demo/simulate-applicant/route";
import { GET as smsRoute } from "@/app/api/demo/sms/route";
import { GET as statusRoute } from "@/app/api/demo/status/route";
import { POST as timeSkipRoute } from "@/app/api/demo/time-skip/route";
import { DAY_MS, clockOffsetMs, loadClockOffset, now } from "@/server/clock";
import { db } from "@/server/db";
import { verifySessionToken } from "@/server/session";
import { resetDb } from "./helpers";

// Toolkit fallbacks and time controls (TRD §5.10, App Flow §9).

const BASE = "http://localhost:3000";
const post = (path: string, body?: unknown) =>
  new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const simulate = (jobId?: string) =>
  simulateRoute(post("/api/demo/simulate-applicant", jobId ? { jobId } : {}), undefined);
const approveAll = () => approveAllRoute(post("/api/demo/approve-all"), undefined);
const skip = (days: unknown) => timeSkipRoute(post("/api/demo/time-skip", { days }), undefined);
const scenario = (name: string) => scenarioRoute(post("/api/demo/scenario", { name }), undefined);

const DAWIT = "+251922000001";
const BRUK = "+251911000011";

async function brukJob() {
  const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Bole Sunrise Café" } });
  return db.job.findFirstOrThrow({ where: { venueId: venue.id }, orderBy: { createdAt: "desc" } });
}

describe("demo toolkit actions", () => {
  beforeEach(async () => {
    await resetDb();
    await loadClockOffset();
  });
  afterEach(() => {
    process.env.DEMO_MODE = "1";
    delete process.env.DEMO_TOOLKIT_PASSCODE;
  });

  describe("simulate applicant", () => {
    it("Dawit applies first, then the most complete profiles; the employer is notified", async () => {
      const job = await db.job.findFirstOrThrow({
        where: { titleEn: "Housekeeper", status: "LIVE" },
      });
      const first = await (await simulate(job.id)).json();
      expect(first).toMatchObject({ jobId: job.id, name: "Dawit A.", titleEn: "Housekeeper" });

      const second = await (await simulate(job.id)).json();
      expect(second.name).not.toBe("Dawit A.");
      const apps = await db.application.findMany({
        where: { jobId: job.id },
        include: { jobseeker: { include: { profile: true } } },
        orderBy: { appliedAt: "asc" },
      });
      expect(apps).toHaveLength(2);
      const best = await db.jobseekerProfile.findFirstOrThrow({
        where: { userId: { not: apps[0].jobseekerId } },
        orderBy: [{ completeness: "desc" }, { userId: "asc" }],
      });
      expect(apps[1].jobseeker.profile?.completeness).toBe(best.completeness);

      const toasts = await db.notification.count({
        where: { kind: "APPLICATION_RECEIVED", href: `/employer/jobs/${job.id}/applicants` },
      });
      expect(toasts).toBeGreaterThan(0);
    });

    it("without a job, uses the most recently published live job", async () => {
      const newest = await db.job.findFirstOrThrow({
        where: { status: "LIVE" },
        orderBy: { publishedAt: "desc" },
      });
      expect((await (await simulate()).json()).jobId).toBe(newest.id);
    });

    it("answers 409 when nothing is live", async () => {
      await db.job.updateMany({ where: { status: "LIVE" }, data: { status: "CLOSED" } });
      const res = await simulate();
      expect(res.status).toBe(409);
      expect((await res.json()).error.details.reason).toBe("NO_LIVE_JOB");
    });
  });

  it("approve all approves every pending license and job as the moderator", async () => {
    const pending = await db.moderationItem.count({ where: { status: "PENDING" } });
    expect(pending).toBe(1); // the seeded Lideta re-upload
    const res = await approveAll();
    expect(await res.json()).toEqual({ licenses: 1, jobs: 0 });
    expect(await db.moderationItem.count({ where: { status: "PENDING" } })).toBe(0);
    const lideta = await db.venue.findFirstOrThrow({ where: { nameEn: "Lideta Corner Café" } });
    expect(lideta.verification).toBe("VERIFIED");
    const moderator = await db.user.findUniqueOrThrow({ where: { phone: "+251911000009" } });
    expect(await db.moderationItem.count({ where: { reviewerId: moderator.id } })).toBe(1);
    expect(await (await approveAll()).json()).toEqual({ licenses: 0, jobs: 0 });
  });

  describe("time-skip", () => {
    it("advances the clock and sweeps: urgent jobs expire after a day", async () => {
      const before = now().getTime();
      const res = await skip(1);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(clockOffsetMs()).toBe(DAY_MS);
      expect(new Date(body.now).getTime() - before).toBeGreaterThanOrEqual(DAY_MS);
      expect(body.expired).toBeGreaterThan(0);
      expect(await db.job.count({ where: { urgency: "HALF_DAY", status: "LIVE" } })).toBe(0);

      const status = await (
        await statusRoute(new Request(`${BASE}/api/demo/status`), undefined)
      ).json();
      expect(status.offsetDays).toBe(1);
    });

    it("only allows the toolkit's steps", async () => {
      expect((await skip(2)).status).toBe(400);
      expect((await skip(-30)).status).toBe(400);
      expect(clockOffsetMs()).toBe(0);
    });
  });

  describe("scenario jump", () => {
    it("venue-verified: Bruk's café exists, its license approved, and the presenter is Bruk", async () => {
      const res = await scenario("venue-verified");
      expect((await res.json()).redirectTo).toBe("/employer");
      const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Bole Sunrise Café" } });
      expect(venue.verification).toBe("VERIFIED");
      const token = /sv_session=([^;]+)/.exec(res.headers.get("set-cookie")!)![1];
      const session = await verifySessionToken(token);
      const bruk = await db.user.findUniqueOrThrow({ where: { phone: BRUK } });
      expect(session?.userId).toBe(bruk.id);
      // The verification SMS went through the simulated gateway, like the live flow.
      expect(await db.smsLog.count({ where: { toPhone: BRUK } })).toBeGreaterThan(0);
    });

    it("job-live: a Barista job from the template, approved and live", async () => {
      const body = await (await scenario("job-live")).json();
      const job = await brukJob();
      expect(body.redirectTo).toBe(`/employer/jobs/${job.id}`);
      expect(job).toMatchObject({
        titleEn: "Barista",
        status: "LIVE",
        postingSource: "FOUNDING_FREE",
      });
      expect(await db.jobSkill.count({ where: { jobId: job.id } })).toBeGreaterThan(0);
    });

    it("applicants-present: three applicants, Dawit first", async () => {
      const body = await (await scenario("applicants-present")).json();
      const job = await brukJob();
      expect(body.redirectTo).toBe(`/employer/jobs/${job.id}/applicants`);
      const apps = await db.application.findMany({
        where: { jobId: job.id },
        include: { jobseeker: true },
        orderBy: { appliedAt: "asc" },
      });
      expect(apps).toHaveLength(3);
      expect(apps[0].jobseeker.phone).toBe(DAWIT);
    });

    it("job-hired: Dawit hired and the one-person job closed as filled", async () => {
      await scenario("job-hired");
      const job = await brukJob();
      expect(job.status).toBe("CLOSED");
      expect(job.filledAt).not.toBeNull();
      const dawit = await db.user.findUniqueOrThrow({ where: { phone: DAWIT } });
      const app = await db.application.findUniqueOrThrow({
        where: { jobId_jobseekerId: { jobId: job.id, jobseekerId: dawit.id } },
      });
      expect(app.status).toBe("HIRED");
      expect(await db.placementCheckin.count({ where: { applicationId: app.id } })).toBe(2);
    });

    it("builds on earlier steps and is safe to repeat", async () => {
      await scenario("job-live");
      await scenario("job-live");
      await scenario("applicants-present");
      const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Bole Sunrise Café" } });
      expect(await db.venue.count({ where: { nameEn: "Bole Sunrise Café" } })).toBe(1);
      expect(await db.job.count({ where: { venueId: venue.id } })).toBe(1);
      expect(await db.licenseDocument.count({ where: { venueId: venue.id } })).toBe(1);
      const job = await brukJob();
      expect(await db.application.count({ where: { jobId: job.id } })).toBe(3);
    });

    it("rejects an unknown scenario", async () => {
      expect((await scenario("everything")).status).toBe(400);
    });
  });

  it("the phone drawer names known recipients", async () => {
    await scenario("venue-verified");
    const { items } = await (await smsRoute(new Request(`${BASE}/api/demo/sms`), undefined)).json();
    expect(items[0]).toMatchObject({ toPhone: BRUK, name: "Bruk Tilahun" });
  });

  it.each([
    ["simulate-applicant", () => simulate()],
    ["approve-all", () => approveAll()],
    ["time-skip", () => skip(1)],
    ["scenario", () => scenario("job-live")],
  ])("%s is 404 outside demo mode and 403 while the toolkit is locked", async (_, call) => {
    process.env.DEMO_MODE = "0";
    expect((await call()).status).toBe(404);
    process.env.DEMO_MODE = "1";
    process.env.DEMO_TOOLKIT_PASSCODE = "4321";
    expect((await call()).status).toBe(403);
  });
});
