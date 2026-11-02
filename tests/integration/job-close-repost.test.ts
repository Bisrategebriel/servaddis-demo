import type { Prisma, User } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as closeRoute } from "@/app/api/jobs/[id]/close/route";
import { POST as repostRoute } from "@/app/api/jobs/[id]/repost/route";
import { DAY_MS, now, setClockOffset } from "@/server/clock";
import { db } from "@/server/db";
import { venueSummary } from "@/server/services/dashboard";
import { contentHash } from "@/server/services/jobs";
import { signSessionToken } from "@/server/session";
import { createJob, hiwot, resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });

const call = async (route: typeof closeRoute, action: "close" | "repost", u: User, id: string) =>
  route(
    new Request(`${BASE}/api/jobs/${id}/${action}`, {
      method: "POST",
      headers: {
        cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
      },
    }),
    { params: Promise.resolve({ id }) },
  );
const close = (u: User, id: string) => call(closeRoute, "close", u, id);
const repost = (u: User, id: string) => call(repostRoute, "repost", u, id);

/** A Hiwot job as approval leaves it, hashed at submit like a real one. */
async function hotelJob(data: Partial<Prisma.JobUncheckedCreateInput> = {}) {
  const { venue, yared } = await hiwot();
  const job = await createJob(venue.id, yared.id, {
    postingSource: "SUBSCRIPTION",
    publishedAt: now(),
    expiresAt: new Date(now().getTime() + 30 * DAY_MS),
    ...data,
  });
  return db.job.update({ where: { id: job.id }, data: { contentHash: contentHash(job) } });
}

describe("POST /api/jobs/:id/close", () => {
  beforeEach(resetDb);

  it("closes a live job with closedAt and an audit entry", async () => {
    const job = await hotelJob();
    const res = await close(await byPhone("+251911000002"), job.id); // Poster has job.close
    expect(res.status).toBe(200);
    const closed = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(closed.status).toBe("CLOSED");
    expect(Math.abs(+closed.closedAt! - +now())).toBeLessThan(5_000);
    expect(await db.auditLog.count({ where: { action: "job.close", entityId: job.id } })).toBe(1);
  });

  it("only closes a live job; Screener 403; other venue 404", async () => {
    const draft = await hotelJob({ status: "DRAFT" });
    expect((await close(await byPhone("+251911000001"), draft.id)).status).toBe(409);
    const live = await hotelJob();
    expect((await close(await byPhone("+251911000003"), live.id)).status).toBe(403);
    expect((await close(await byPhone("+251911000005"), live.id)).status).toBe(404);
  });
});

describe("POST /api/jobs/:id/repost", () => {
  beforeEach(resetDb);
  afterEach(() => setClockOffset(0));

  it("clones an expired job into review, marked fast-approve; the original is untouched", async () => {
    const original = await hotelJob({ status: "EXPIRED", urgency: "NORMAL" });
    const selam = await byPhone("+251911000001");
    const res = await repost(selam, original.id);
    expect(res.status).toBe(201);
    const { job } = await res.json();
    expect(job.id).not.toBe(original.id);
    expect(job).toMatchObject({
      status: "PENDING_REVIEW",
      isRepost: true,
      repostOfId: original.id,
      createdById: selam.id,
      postingSource: "SUBSCRIPTION",
      titleEn: original.titleEn,
      salaryMax: original.salaryMax,
      contentHash: original.contentHash,
      publishedAt: null,
      expiresAt: null,
    });
    const item = await db.moderationItem.findFirstOrThrow({ where: { jobId: job.id } });
    expect(item.isFastApprove).toBe(true);
    expect((await db.job.findUniqueOrThrow({ where: { id: original.id } })).status).toBe("EXPIRED");
  });

  it("is not fast-approve when the content differs from what was approved", async () => {
    const original = await hotelJob({ status: "CLOSED" });
    await db.job.update({ where: { id: original.id }, data: { salaryMax: 9500 } });
    const { job } = await (await repost(await byPhone("+251911000001"), original.id)).json();
    const item = await db.moderationItem.findFirstOrThrow({ where: { jobId: job.id } });
    expect(item.isFastApprove).toBe(false);
  });

  it("copies the job's skills", async () => {
    const original = await hotelJob({ status: "CLOSED" });
    const skills = await db.skill.findMany({ take: 2 });
    await db.jobSkill.createMany({
      data: skills.map((s) => ({ jobId: original.id, skillId: s.id })),
    });
    const { job } = await (await repost(await byPhone("+251911000001"), original.id)).json();
    expect(await db.jobSkill.count({ where: { jobId: job.id } })).toBe(2);
  });

  it("needs a post like any submission", async () => {
    const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Lideta Corner Café" } });
    const owner = await byPhone("+251911000006");
    await db.venue.update({ where: { id: venue.id }, data: { foundingPostsLeft: 0 } });
    const original = await createJob(venue.id, owner.id, { status: "EXPIRED" });
    const res = await repost(owner, original.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error.details.reason).toBe("NO_ENTITLEMENT");
    expect(await db.job.count({ where: { repostOfId: original.id } })).toBe(0);
  });

  it("only reposts an expired or closed job", async () => {
    const live = await hotelJob();
    expect((await repost(await byPhone("+251911000001"), live.id)).status).toBe(409);
  });
});

describe("expiry banner data (E-11)", () => {
  beforeEach(resetDb);
  afterEach(() => setClockOffset(0));

  it("lists normal live jobs in their last three days, not urgent ones", async () => {
    const soon = await hotelJob({ expiresAt: new Date(now().getTime() + 2 * DAY_MS) });
    await hotelJob({ expiresAt: new Date(now().getTime() + 10 * DAY_MS) });
    await hotelJob({ urgency: "NEXT_DAY", expiresAt: new Date(now().getTime() + DAY_MS) });
    const { venue } = await hiwot();
    const summary = await venueSummary(venue.id, new Set());
    expect(summary.expiringSoon.map((j) => j.id)).toEqual([soon.id]);
  });
});
