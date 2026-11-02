import type { Prisma, User } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as decisionRoute } from "@/app/api/admin/moderation/[id]/decision/route";
import { computeExpiresAt } from "@/lib/expiry";
import { DAY_MS, now, setClockOffset } from "@/server/clock";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { sweep } from "@/server/sweep";
import { createJob, hiwot, resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const moderator = () => db.user.findUniqueOrThrow({ where: { phone: "+251911000009" } });

const decide = async (user: User, id: string, body: unknown) =>
  decisionRoute(
    new Request(`${BASE}/api/admin/moderation/${id}/decision`, {
      method: "POST",
      headers: {
        cookie: `sv_session=${await signSessionToken({ userId: user.id, role: user.platformRole })}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

/** A job waiting for review, created by Yared (Poster) at Hiwot, as submit leaves it. */
async function pending(data: Partial<Prisma.JobUncheckedCreateInput> = {}) {
  const { venue, yared } = await hiwot();
  const job = await createJob(venue.id, yared.id, {
    status: "PENDING_REVIEW",
    postingSource: "SUBSCRIPTION",
    submittedAt: now(),
    ...data,
  });
  const item = await db.moderationItem.create({
    data: { type: "JOB", jobId: job.id, createdAt: now() },
  });
  return { job, item };
}

const notes = (kind: Prisma.NotificationWhereInput["kind"]) =>
  db.notification.findMany({ where: { kind }, include: { user: true } });

describe("job decisions (doc 05 §6.1)", () => {
  beforeEach(resetDb);
  afterEach(() => setClockOffset(0));

  it("approve: LIVE with publishedAt and a 30-day expiry, creator + owner notified", async () => {
    await setClockOffset(3 * DAY_MS);
    const { job, item } = await pending();
    const res = await decide(await moderator(), item.id, { decision: "APPROVE" });
    expect(res.status).toBe(200);
    const live = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(live.status).toBe("LIVE");
    expect(Math.abs(+live.publishedAt! - +now())).toBeLessThan(5_000);
    expect(live.expiresAt).toEqual(computeExpiresAt("NORMAL", live.publishedAt!));
    expect(live.needByAt).toBeNull();
    const sent = await notes("JOB_APPROVED");
    expect(sent.map((n) => n.user.name).sort()).toEqual(["Selam Getachew", "Yared Alemu"]);
    expect(sent[0].href).toBe(`/employer/jobs/${job.id}`);
    expect(await db.smsLog.count({ where: { body: { contains: "Barista" } } })).toBe(0);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "job.approve" } });
    expect(JSON.parse(audit.meta!)).toMatchObject({ jobId: job.id });
  });

  it("approve: an urgent job expires at its EAT deadline and gets needByAt", async () => {
    const { job, item } = await pending({ urgency: "SAME_DAY" });
    await decide(await moderator(), item.id, { decision: "APPROVE" });
    const live = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(live.expiresAt).toEqual(computeExpiresAt("SAME_DAY", live.publishedAt!));
    expect(live.needByAt).toEqual(live.expiresAt);
  });

  it("approve: uses up a founding post; a subscription post doesn't", async () => {
    const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Lideta Corner Café" } });
    const owner = await db.user.findUniqueOrThrow({ where: { phone: "+251911000006" } });
    const job = await createJob(venue.id, owner.id, {
      status: "PENDING_REVIEW",
      postingSource: "FOUNDING_FREE",
    });
    const item = await db.moderationItem.create({ data: { type: "JOB", jobId: job.id } });
    await decide(await moderator(), item.id, { decision: "APPROVE" });
    expect((await db.venue.findUniqueOrThrow({ where: { id: venue.id } })).foundingPostsLeft).toBe(
      2,
    );

    const sub = await pending();
    await decide(await moderator(), sub.item.id, { decision: "APPROVE" });
    const { venue: hotel } = await hiwot();
    expect(hotel.foundingPostsLeft).toBe(0);
  });

  it("request changes: needs a reason; creator gets it by app and SMS with an edit link", async () => {
    const { job, item } = await pending();
    const mod = await moderator();
    expect((await decide(mod, item.id, { decision: "REQUEST_CHANGES" })).status).toBe(400);
    const reason = "Add the shift times in Amharic.";
    expect((await decide(mod, item.id, { decision: "REQUEST_CHANGES", reason })).status).toBe(200);
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      "CHANGES_REQUESTED",
    );
    expect(await db.moderationItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
      status: "CHANGES_REQUESTED",
      reason,
    });
    const sent = await notes("JOB_CHANGES_REQUESTED");
    expect(sent.map((n) => n.user.name)).toEqual(["Yared Alemu"]); // creator only
    expect(sent[0]).toMatchObject({ href: `/employer/jobs/${job.id}/edit` });
    expect(sent[0].bodyEn).toContain(reason);
    const sms = await db.smsLog.findMany({ where: { body: { contains: reason } } });
    expect(sms.map((s) => s.toPhone)).toEqual(["+251911000002"]);
  });

  it("reject: creator + owner told by app and SMS; the job can't come back", async () => {
    const { job, item } = await pending();
    const reason = "This role isn't hospitality work.";
    await decide(await moderator(), item.id, { decision: "REJECT", reason });
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("REJECTED");
    expect((await notes("JOB_REJECTED")).length).toBe(2);
    expect(await db.smsLog.count({ where: { body: { contains: reason } } })).toBe(2);
  });

  it("can't decide twice, nor a job that left review", async () => {
    const { job, item } = await pending();
    const mod = await moderator();
    await decide(mod, item.id, { decision: "APPROVE" });
    expect((await decide(mod, item.id, { decision: "APPROVE" })).status).toBe(409);

    const other = await pending();
    await db.job.update({ where: { id: other.job.id }, data: { status: "DRAFT" } });
    expect((await decide(mod, other.item.id, { decision: "APPROVE" })).status).toBe(409);
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("LIVE");
  });

  it("an approved half-day job expires 12 hours later through the sweep", async () => {
    const { job, item } = await pending({ urgency: "HALF_DAY" });
    await decide(await moderator(), item.id, { decision: "APPROVE" });
    await setClockOffset(13 * 3_600_000);
    await sweep();
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("EXPIRED");
  });

  it("is for moderators only", async () => {
    const { item } = await pending();
    const { selam } = await hiwot();
    expect((await decide(selam, item.id, { decision: "APPROVE" })).status).toBe(403);
  });
});
