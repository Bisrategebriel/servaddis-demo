import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as detailRoute } from "@/app/api/public/jobs/[id]/route";
import { GET as feedRoute } from "@/app/api/public/jobs/route";
import { DAY_MS, setClockOffset } from "@/server/clock";
import { db } from "@/server/db";
import type { FeedCard } from "@/server/services/feed";
import { createJob, hiwot, resetDb } from "./helpers";

const BASE = "http://localhost:3000";

async function feed(
  query = "",
): Promise<{ items: FeedCard[]; total: number; nextCursor: number | null }> {
  const res = await feedRoute(new Request(`${BASE}/api/public/jobs${query}`), undefined);
  expect(res.status).toBe(200);
  return res.json();
}
const detail = (id: string) =>
  detailRoute(new Request(`${BASE}/api/public/jobs/${id}`), { params: Promise.resolve({ id }) });

describe("seeded feed (doc 05 §9.5)", () => {
  beforeEach(resetDb);

  it("has 18 live jobs: 3 urgent, 3 venues, 5 sub-cities, 8+ roles", async () => {
    const jobs = await db.job.findMany({ where: { status: "LIVE" }, include: { subCity: true } });
    expect(jobs).toHaveLength(18);
    expect(
      jobs
        .filter((j) => j.urgency !== "NORMAL")
        .map((j) => j.urgency)
        .sort(),
    ).toEqual(["HALF_DAY", "NEXT_DAY", "SAME_DAY"]);
    expect(new Set(jobs.map((j) => j.venueId)).size).toBe(3);
    expect(new Set(jobs.map((j) => j.subCity.slug)).size).toBe(5);
    expect(new Set(jobs.map((j) => j.roleTemplateId)).size).toBeGreaterThanOrEqual(8);
    for (const j of jobs) expect(j.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("gives the Front Desk Agent job 9 applicants in mixed statuses, with events", async () => {
    const job = await db.job.findFirstOrThrow({
      where: { titleEn: "Front Desk Agent", status: "LIVE" },
      include: { applications: { include: { events: true } } },
    });
    const statuses = job.applications.map((a) => a.status);
    expect(statuses).toHaveLength(9);
    expect(new Set(statuses)).toEqual(new Set(["APPLIED", "VIEWED", "SHORTLISTED", "REJECTED"]));
    for (const a of job.applications) {
      expect(a.events.map((e) => e.type)[0]).toBe("APPLIED");
      if (a.status === "SHORTLISTED") expect(a.shortlistedAt! > a.viewedAt!).toBe(true);
    }
    const dawit = await db.user.findUniqueOrThrow({ where: { phone: "+251922000001" } });
    expect(await db.application.count({ where: { jobseekerId: dawit.id } })).toBe(0);
  });

  it("leaves Piassa's Standard plan full and Lideta's founding posts untouched", async () => {
    const piassa = await db.venue.findFirstOrThrow({
      where: { nameEn: "Piassa Terrace Restaurant" },
    });
    expect(await db.job.count({ where: { venueId: piassa.id, status: "LIVE" } })).toBe(5);
    const lideta = await db.venue.findFirstOrThrow({ where: { nameEn: "Lideta Corner Café" } });
    expect(lideta.foundingPostsLeft).toBe(3);
  });
});

describe("GET /api/public/jobs", () => {
  beforeEach(resetDb);
  afterEach(() => setClockOffset(0));

  it("is public and pins urgent jobs first, soonest deadline first, then newest", async () => {
    const { items, total } = await feed();
    expect(total).toBe(18);
    expect(items.slice(0, 3).map((j) => j.urgency)).toEqual(["HALF_DAY", "SAME_DAY", "NEXT_DAY"]);
    const rest = items.slice(3).map((j) => +new Date(j.publishedAt));
    expect(rest).toEqual([...rest].sort((a, b) => b - a));
    expect(items[0]).toMatchObject({ venueEn: "Hiwot Garden Hotel", verified: true });
  });

  it.each([
    ["?sub=lideta", 2],
    ["?type=PART_TIME", -1],
    ["?role=waiter", 3],
    ["?urgent=1", 3],
    ["?q=Barista", 2],
    ["?q=Piassa", 5],
    ["?role=waiter&sub=arada", 1],
  ])("filters %s", async (query, expected) => {
    const { items } = await feed(query);
    if (expected >= 0) expect(items).toHaveLength(expected);
    if (query.includes("PART_TIME")) {
      for (const j of items) expect(j.employmentType).toBe("PART_TIME");
    }
  });

  it("filters salary by overlap with the wanted range", async () => {
    const { items } = await feed("?min=15000");
    expect(items.length).toBeGreaterThan(0);
    for (const j of items) expect(j.salaryMax).toBeGreaterThanOrEqual(15000);
    const low = await feed("?max=4500");
    for (const j of low.items) expect(j.salaryMin).toBeLessThanOrEqual(4500);
  });

  it("treats empty form fields as no filter", async () => {
    const { total } = await feed("?sub=&type=&role=&min=&max=&q=");
    expect(total).toBe(18);
  });

  it("pages with a cursor", async () => {
    const first = await feed("?limit=10");
    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).toBe(10);
    const second = await feed("?limit=10&cursor=10");
    expect(second.items).toHaveLength(8);
    expect(second.nextCursor).toBeNull();
    const ids = new Set([...first.items, ...second.items].map((j) => j.id));
    expect(ids.size).toBe(18);
  });

  it("hides drafts, jobs in review and jobs past expiry by the demo clock", async () => {
    const { venue, selam } = await hiwot();
    await createJob(venue.id, selam.id, { status: "DRAFT" });
    await createJob(venue.id, selam.id, { status: "PENDING_REVIEW" });
    expect((await feed()).total).toBe(18);
    await setClockOffset(DAY_MS); // the half-day and same-day jobs are past their deadline
    const { items } = await feed();
    expect(items.map((j) => j.urgency)).not.toContain("HALF_DAY");
    expect(items.map((j) => j.urgency)).not.toContain("SAME_DAY");
  });

  it("rejects bad filter values", async () => {
    const res = await feedRoute(new Request(`${BASE}/api/public/jobs?type=ASTRONAUT`), undefined);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/public/jobs/:id", () => {
  beforeEach(resetDb);

  it("returns the full post, open", async () => {
    const job = await db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent" } });
    const res = await detail(job.id);
    expect(res.status).toBe(200);
    const body = (await res.json()).job;
    expect(body).toMatchObject({ open: true, titleAm: "የፊት ጽ/ቤት ሠራተኛ", headcount: 2 });
    expect(body.requirementsEn.length).toBeGreaterThan(0);
    expect(body).not.toHaveProperty("contentHash");
  });

  it("shows a closed job as not open, and hides unpublished ones", async () => {
    const job = await db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent" } });
    await db.job.update({ where: { id: job.id }, data: { status: "CLOSED" } });
    expect((await (await detail(job.id)).json()).job.open).toBe(false);
    const { venue, selam } = await hiwot();
    const draft = await createJob(venue.id, selam.id, { status: "DRAFT" });
    expect((await detail(draft.id)).status).toBe(404);
    expect((await detail("nope")).status).toBe(404);
  });
});
