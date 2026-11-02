import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as insightsRoute } from "@/app/api/venues/[id]/insights/route";
import { db } from "@/server/db";
import { venueInsights } from "@/server/services/insights";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const hiwot = () => db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });
const get = async (u: User, venueId: string, query = "") =>
  insightsRoute(
    new Request(`${BASE}/api/venues/${venueId}/insights${query}`, {
      headers: {
        cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
      },
    }),
    { params: Promise.resolve({ id: venueId }) },
  );

describe("seeded history (doc 05 §9.5)", () => {
  beforeEach(resetDb);

  it("adds 17 filled and 3 expired Hiwot jobs to its 11 live ones", async () => {
    const venue = await hiwot();
    const count = (status: "CLOSED" | "EXPIRED" | "LIVE") =>
      db.job.count({ where: { venueId: venue.id, status } });
    expect(await count("CLOSED")).toBe(17);
    expect(await count("EXPIRED")).toBe(3);
    expect(await count("LIVE")).toBe(11);
    expect(await db.job.count({ where: { venueId: venue.id, filledAt: { not: null } } })).toBe(17);
  });

  it("is deterministic: the same history every reset", async () => {
    const snapshot = async () =>
      (
        await db.job.findMany({
          where: { status: { in: ["CLOSED", "EXPIRED"] } },
          orderBy: { publishedAt: "asc" },
          select: { titleEn: true, _count: { select: { applications: true } } },
        })
      ).map((j) => `${j.titleEn}:${j._count.applications}`);
    const first = await snapshot();
    await resetDb();
    expect(await snapshot()).toEqual(first);
  });
});

describe("venue insights (E-18)", () => {
  beforeEach(resetDb);

  it("shows time to fill improving over six months, with the headline", async () => {
    const data = await venueInsights((await hiwot()).id, "180d");
    expect(data.trend).toHaveLength(6);
    const vals = data.trend.map((t) => t.daysToFill).filter((v): v is number => v !== null);
    expect(vals[0]).toBeGreaterThan(9);
    expect(vals[vals.length - 1]).toBeLessThan(7.5);
    expect(data.fasterBy).toBeGreaterThanOrEqual(3);
  });

  it("has a funnel near 100 → 42 → 18 → 6 % over six months", async () => {
    const { funnel } = await venueInsights((await hiwot()).id, "180d");
    const pct = (v: number) => (100 * v) / funnel.applied;
    expect(funnel.applied).toBeGreaterThan(200);
    expect(pct(funnel.viewed)).toBeGreaterThan(35);
    expect(pct(funnel.viewed)).toBeLessThan(50);
    expect(pct(funnel.shortlisted)).toBeGreaterThan(14);
    expect(pct(funnel.shortlisted)).toBeLessThan(24);
    expect(pct(funnel.hired)).toBeGreaterThan(3);
    expect(pct(funnel.hired)).toBeLessThan(9);
  });

  it("applicants who get further have more complete profiles", async () => {
    const apps = await db.application.findMany({
      where: { job: { status: "CLOSED" } },
      include: { jobseeker: { include: { profile: true } } },
    });
    const avg = (xs: typeof apps) =>
      xs.reduce((s, a) => s + (a.jobseeker.profile?.completeness ?? 0), 0) / xs.length;
    expect(avg(apps.filter((a) => a.shortlistedAt))).toBeGreaterThan(avg(apps) + 5);
  });

  it("scopes KPIs to the range", async () => {
    const venueId = (await hiwot()).id;
    const month = await venueInsights(venueId, "30d");
    const half = await venueInsights(venueId, "180d");
    expect(month.kpis.liveJobs).toBe(11);
    expect(month.kpis.applicants).toBeLessThan(half.kpis.applicants);
    expect(half.kpis.hires).toBeGreaterThanOrEqual(17);
  });

  it("is for insights.view: Owner and Viewer yes, Screener 403, other venue 404", async () => {
    const venueId = (await hiwot()).id;
    const res = await get(await byPhone("+251911000001"), venueId, "?range=30d");
    expect(res.status).toBe(200);
    expect((await res.json()).range).toBe("30d");
    expect((await get(await byPhone("+251911000003"), venueId)).status).toBe(403);
    expect((await get(await byPhone("+251911000005"), venueId)).status).toBe(404);
    expect((await get(await byPhone("+251911000001"), venueId, "?range=1y")).status).toBe(400);
  });
});
