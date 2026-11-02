import type { User } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as submitRoute } from "@/app/api/jobs/[id]/submit/route";
import { POST as createRoute } from "@/app/api/jobs/route";
import { emptyJobForm, formFromTemplate, toJobPayload } from "@/lib/job-form";
import { prefillFromTemplate } from "@/lib/role-template";
import { DAY_MS, now, setClockOffset } from "@/server/clock";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const SELAM = "+251911000001"; // Hiwot, PRO (unlimited)
const YARED = "+251911000002"; // Hiwot Poster
const RAHEL = "+251911000003"; // Hiwot Screener
const HENOCK = "+251911000005"; // Piassa, STANDARD (5 live jobs)
const LIDETA = "+251911000006"; // Lideta, founding (3 free posts)
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const headers = async (u: User) => ({
  cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
  "content-type": "application/json",
});

async function baristaBody(change: Record<string, unknown> = {}) {
  const row = await db.roleTemplate.findUniqueOrThrow({ where: { slug: "barista" } });
  return { ...toJobPayload(formFromTemplate(prefillFromTemplate(row), "bole")), ...change };
}

async function draft(u: User, body?: unknown): Promise<string> {
  const res = await createRoute(
    new Request(`${BASE}/api/jobs`, {
      method: "POST",
      headers: await headers(u),
      body: JSON.stringify(body ?? (await baristaBody())),
    }),
    { params: Promise.resolve({}) },
  );
  return (await res.json()).job.id;
}

const submit = async (u: User, id: string) =>
  submitRoute(
    new Request(`${BASE}/api/jobs/${id}/submit`, { method: "POST", headers: await headers(u) }),
    { params: Promise.resolve({ id }) },
  );

describe("POST /api/jobs/:id/submit", () => {
  beforeEach(resetDb);
  afterEach(() => setClockOffset(0));

  it("moves a draft to review with a moderation item, hash and audit entry", async () => {
    await setClockOffset(2 * DAY_MS); // timestamps follow the demo clock
    const selam = await byPhone(SELAM);
    const id = await draft(selam);
    const res = await submit(selam, id);
    expect(res.status).toBe(200);
    const job = await db.job.findUniqueOrThrow({ where: { id } });
    expect(job).toMatchObject({ status: "PENDING_REVIEW", postingSource: "SUBSCRIPTION" });
    expect(Math.abs(+job.submittedAt! - +now())).toBeLessThan(5_000);
    expect(job.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const item = await db.moderationItem.findFirstOrThrow({ where: { jobId: id } });
    expect(item).toMatchObject({ type: "JOB", status: "PENDING", flags: "[]" });
    expect(await db.auditLog.count({ where: { action: "job.submit", entityId: id } })).toBe(1);
  });

  it("lets warnings through and keeps them for the moderator", async () => {
    const selam = await byPhone(SELAM);
    const id = await draft(selam, await baristaBody({ descriptionEn: "Call 0911223344 today." }));
    expect((await submit(selam, id)).status).toBe(200);
    const item = await db.moderationItem.findFirstOrThrow({ where: { jobId: id } });
    expect(JSON.parse(item.flags)).toEqual([
      expect.objectContaining({ ruleId: "offplatform-contact", severity: "warn" }),
    ]);
  });

  it("blocks a fee request with 422 and the flags; the job stays a draft", async () => {
    const selam = await byPhone(SELAM);
    const id = await draft(
      selam,
      await baristaBody({ descriptionEn: "Registration fee ETB 200 on day one." }),
    );
    const res = await submit(selam, id);
    expect(res.status).toBe(422);
    const { error } = await res.json();
    expect(error.code).toBe("RULE_BLOCKED");
    expect(error.details.flags).toEqual([
      expect.objectContaining({ ruleId: "no-fee", match: "Registration fee" }),
    ]);
    expect((await db.job.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
    expect(await db.moderationItem.count({ where: { jobId: id } })).toBe(0);
  });

  it("locks an unverified venue (drafts still allowed)", async () => {
    const owner = await byPhone(LIDETA);
    const id = await draft(owner);
    await db.venue.updateMany({
      where: { nameEn: "Lideta Corner Café" },
      data: { verification: "PENDING" },
    });
    const res = await submit(owner, id);
    expect(res.status).toBe(409);
    expect((await res.json()).error.details).toEqual({ reason: "VENUE_UNVERIFIED" });
  });

  it("refuses an incomplete draft and names the step", async () => {
    const selam = await byPhone(SELAM);
    const id = await draft(selam, toJobPayload(emptyJobForm("bole")));
    const res = await submit(selam, id);
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual({ step: 0 });
  });

  it("uses founding posts, holding pending ones, then asks for payment", async () => {
    const owner = await byPhone(LIDETA);
    for (let i = 0; i < 3; i++) {
      const id = await draft(owner);
      expect((await submit(owner, id)).status).toBe(200);
      expect((await db.job.findUniqueOrThrow({ where: { id } })).postingSource).toBe(
        "FOUNDING_FREE",
      );
    }
    const fourth = await draft(owner);
    const res = await submit(owner, fourth);
    expect(res.status).toBe(409);
    expect((await res.json()).error.details).toEqual({
      reason: "NO_ENTITLEMENT",
      requiresPayment: true,
    });
    expect((await db.job.findUniqueOrThrow({ where: { id: fourth } })).status).toBe("DRAFT");
    // The counter itself drops on approval (doc 05 §6.1), not at submit.
    const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Lideta Corner Café" } });
    expect(venue.foundingPostsLeft).toBe(3);
  });

  it("counts live and pending jobs against the plan's limit", async () => {
    const henock = await byPhone(HENOCK);
    const venue = await db.venue.findFirstOrThrow({
      where: { nameEn: "Piassa Terrace Restaurant" },
    });
    // The seed leaves Piassa at its Standard limit: 5 live jobs.
    const id = await draft(henock);
    expect((await submit(henock, id)).status).toBe(409);
    const live = await db.job.findFirstOrThrow({ where: { venueId: venue.id, status: "LIVE" } });
    await db.job.update({ where: { id: live.id }, data: { status: "CLOSED" } });
    expect((await submit(henock, id)).status).toBe(200);
    const another = await draft(henock);
    expect((await submit(henock, another)).status).toBe(409); // 4 live + 1 pending = 5
  });

  it("ignores an expired subscription", async () => {
    const selam = await byPhone(SELAM);
    const id = await draft(selam);
    await setClockOffset(40 * DAY_MS); // past the seeded 30-day period
    expect((await submit(selam, id)).status).toBe(409);
  });

  it("can't submit twice", async () => {
    const selam = await byPhone(SELAM);
    const id = await draft(selam);
    await submit(selam, id);
    const res = await submit(selam, id);
    expect(res.status).toBe(409);
    expect(await db.moderationItem.count({ where: { jobId: id } })).toBe(1);
  });

  it("resubmits after requested changes on the same post, with a new review item", async () => {
    const owner = await byPhone(LIDETA);
    const id = await draft(owner);
    await submit(owner, id);
    await db.job.update({ where: { id }, data: { status: "CHANGES_REQUESTED" } });
    await db.venue.updateMany({
      where: { nameEn: "Lideta Corner Café" },
      data: { foundingPostsLeft: 0 }, // nothing left, yet the resubmit still goes through
    });
    expect((await submit(owner, id)).status).toBe(200);
    const job = await db.job.findUniqueOrThrow({ where: { id } });
    expect(job).toMatchObject({ status: "PENDING_REVIEW", postingSource: "FOUNDING_FREE" });
    expect(await db.moderationItem.count({ where: { jobId: id } })).toBe(2);
  });

  it("follows the permissions: Poster yes, Screener 403, other venue 404", async () => {
    const id = await draft(await byPhone(SELAM));
    expect((await submit(await byPhone(RAHEL), id)).status).toBe(403);
    expect((await submit(await byPhone(HENOCK), id)).status).toBe(404);
    expect((await submit(await byPhone(YARED), id)).status).toBe(200);
  });
});
