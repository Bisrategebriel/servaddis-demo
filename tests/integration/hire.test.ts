import type { User } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as hireRoute } from "@/app/api/applications/[id]/hire/route";
import { POST as shortlistRoute } from "@/app/api/applications/[id]/shortlist/route";
import { DAY_MS, advanceClock, now, setClockOffset } from "@/server/clock";
import { db } from "@/server/db";
import { venueSummary } from "@/server/services/dashboard";
import { signSessionToken } from "@/server/session";
import { sweep } from "@/server/sweep";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const post = async (
  route: typeof hireRoute,
  u: User,
  id: string,
): Promise<{ status: number; body: { jobFilled?: boolean } }> => {
  const res = await route(
    new Request(`${BASE}/api/applications/${id}/x`, {
      method: "POST",
      headers: {
        cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
        "content-type": "application/json",
      },
      body: "{}",
    }),
    { params: Promise.resolve({ id }) },
  );
  return { status: res.status, body: await res.json() };
};
const appOf = async (name: string) => {
  const seeker = await db.user.findFirstOrThrow({ where: { name } });
  return db.application.findFirstOrThrow({ where: { jobseekerId: seeker.id } });
};

describe("hire → fill (App Flow §5.1)", () => {
  beforeEach(resetDb);
  afterEach(() => setClockOffset(0));

  it("schedules the 2-week and 30-day check-ins for each hire", async () => {
    const hana = await appOf("Hana Bekele");
    await post(hireRoute, await byPhone("+251911000001"), hana.id);
    const checkins = await db.placementCheckin.findMany({
      where: { applicationId: hana.id },
      orderBy: { dueAt: "asc" },
    });
    expect(checkins.map((c) => c.kind)).toEqual(["WEEK_2", "DAY_30"]);
    const days = (d: Date) => Math.round((+d - +now()) / DAY_MS);
    expect(checkins.map((c) => days(c.dueAt))).toEqual([14, 30]);
  });

  it("the first of two openings keeps the job live; the second fills and closes it", async () => {
    const selam = await byPhone("+251911000001");
    const job = await db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent" } });
    expect(job.headcount).toBe(2);

    const first = await post(hireRoute, selam, (await appOf("Hana Bekele")).id);
    expect(first.body.jobFilled).toBe(false);
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("LIVE");

    await advanceClock(DAY_MS);
    const second = await post(hireRoute, selam, (await appOf("Henok Abera")).id);
    expect(second.body.jobFilled).toBe(true);
    const closed = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(closed).toMatchObject({ status: "CLOSED", hiredCount: 2 });
    expect(closed.filledAt).toEqual(closed.closedAt);
    // published 72 h before the seed + 1 day skipped ≈ 4 days to fill
    expect((+closed.filledAt! - +closed.publishedAt!) / DAY_MS).toBeCloseTo(4, 0);
  });

  it("rejects everyone still in play as POSITION_FILLED and tells them; finished ones stay", async () => {
    const selam = await byPhone("+251911000001");
    await post(hireRoute, selam, (await appOf("Hana Bekele")).id);
    await post(hireRoute, selam, (await appOf("Henok Abera")).id);
    const apps = await db.application.findMany({
      where: { job: { titleEn: "Front Desk Agent" } },
      include: { jobseeker: true },
    });
    const by = (s: string) =>
      apps
        .filter((a) => a.status === s)
        .map((a) => a.jobseeker.name)
        .sort();
    expect(by("HIRED")).toEqual(["Hana Bekele", "Henok Abera"]);
    expect(by("REJECTED")).toHaveLength(7); // 4 applied + 2 viewed + Tewodros (already rejected)
    const auto = apps.filter((a) => a.rejectReason === "POSITION_FILLED");
    expect(auto).toHaveLength(6);
    const tewodros = apps.find((a) => a.jobseeker.name === "Tewodros Ayalew")!;
    expect(tewodros.rejectReason).toBe("LANGUAGE_REQUIREMENT"); // untouched
    const told = await db.notification.findMany({
      where: { kind: "APPLICATION_REJECTED", userId: { in: auto.map((a) => a.jobseekerId) } },
    });
    expect(told).toHaveLength(6);
    expect(told[0].bodyEn).toContain("has been filled");
  });

  it("tells the job's creator and owner, with the time to fill", async () => {
    const selam = await byPhone("+251911000001");
    await post(hireRoute, selam, (await appOf("Hana Bekele")).id);
    await post(hireRoute, selam, (await appOf("Henok Abera")).id);
    const notes = await db.notification.findMany({ where: { kind: "JOB_FILLED" } });
    expect(notes).toHaveLength(1); // Selam created the job and owns the venue
    expect(notes[0].bodyEn).toMatch(/^"Front Desk Agent" is filled, in 3(\.\d)? days\.$/);
  });

  it("shows on the dashboard's average time-to-fill", async () => {
    const selam = await byPhone("+251911000001");
    const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });
    expect((await venueSummary(venue.id, new Set())).kpis.avgDaysToFill).toBeNull();
    await post(hireRoute, selam, (await appOf("Hana Bekele")).id);
    await post(hireRoute, selam, (await appOf("Henok Abera")).id);
    expect((await venueSummary(venue.id, new Set())).kpis.avgDaysToFill).toBeCloseTo(3, 0);
  });

  it("a headcount-1 job closes on its first hire; the sweep later sends the check-ins", async () => {
    const selam = await byPhone("+251911000001");
    const job = await db.job.findFirstOrThrow({ where: { titleEn: "Spa Therapist" } });
    const dawit = await byPhone("+251922000001");
    const app = await db.application.create({
      data: { jobId: job.id, jobseekerId: dawit.id, appliedAt: now() },
    });
    await post(shortlistRoute, selam, app.id);
    const res = await post(hireRoute, selam, app.id);
    expect(res.body.jobFilled).toBe(true);
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("CLOSED");

    await advanceClock(15 * DAY_MS);
    const { checkinsSent } = await sweep();
    expect(checkinsSent).toBe(1); // the 2-week one
    expect(await db.notification.count({ where: { kind: "CHECKIN_DUE", userId: dawit.id } })).toBe(
      1,
    );
  });
});
