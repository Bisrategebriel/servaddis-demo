import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { User } from "@prisma/client";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as logRoute } from "@/app/api/jobs/[id]/distribution/route";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { promoteJob, runDistribution, type DistributionLog } from "@/server/services/promote";
import { createJob, hiwot, resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const log = async (u: User, id: string): Promise<{ status: number; body: DistributionLog }> => {
  const res = await logRoute(
    new Request(`${BASE}/api/jobs/${id}/distribution`, {
      headers: {
        cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
      },
    }),
    { params: Promise.resolve({ id }) },
  );
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
};

describe("promote to socials (App Flow §7)", () => {
  beforeAll(() => {
    process.env.CARD_DIR = mkdtempSync(path.join(tmpdir(), "sv-cards-"));
  });
  beforeEach(resetDb);

  it("queues four posts, then renders, stores and publishes them; TikTok is a team draft", async () => {
    const selam = await byPhone("+251911000001"); // Hiwot: Pro plan includes socials
    const job = await db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent" } });
    expect(await promoteJob(selam, job)).toEqual({ created: true });
    const queued = await log(selam, job.id);
    expect(queued.body.posts.map((p) => p.status)).toEqual([
      "QUEUED",
      "QUEUED",
      "QUEUED",
      "QUEUED",
    ]);
    expect(queued.body.settled).toBe(false);

    await runDistribution(job.id);
    const { body } = await log(selam, job.id);
    expect(body.posts.map((p) => [p.channel, p.status])).toEqual([
      ["TELEGRAM", "PUBLISHED"],
      ["FACEBOOK", "PUBLISHED"],
      ["INSTAGRAM", "PUBLISHED"],
      ["TIKTOK", "DRAFT_FOR_TEAM"],
    ]);
    expect(body.posts.every((p) => p.simulated)).toBe(true);
    expect(body.settled).toBe(true);
    expect(body.posts[0].captionAm).toContain("የፊት ጽ/ቤት ሠራተኛ");
    expect(body.posts[0].captionEn).toContain(`/jobs/${job.id}`);
    for (const f of ["am-square", "am-story", "en-square", "en-story"]) {
      expect(existsSync(path.join(process.env.CARD_DIR!, `${job.id}-${f}.png`))).toBe(true);
    }
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).promoteToSocials).toBe(true);
    expect(await db.auditLog.count({ where: { action: "job.promote", entityId: job.id } })).toBe(1);
  }, 60_000);

  it("never duplicates posts when promoted twice", async () => {
    const selam = await byPhone("+251911000001");
    const job = await db.job.findFirstOrThrow({
      where: { titleEn: "Barista", venue: { nameEn: "Hiwot Garden Hotel" } },
    });
    await promoteJob(selam, job);
    expect(await promoteJob(selam, job)).toEqual({ created: false });
    expect(await db.distributionPost.count({ where: { jobId: job.id } })).toBe(4);
  });

  it("allows a paid urgent post even without a plan (Lideta)", async () => {
    const owner = await byPhone("+251911000006");
    const job = await db.job.findFirstOrThrow({ where: { urgency: "SAME_DAY" } });
    expect(job.postingSource).toBe("URGENT_PAID");
    expect(await promoteJob(owner, job)).toEqual({ created: true });
  });

  it("asks a Standard-plan venue to upgrade (Piassa)", async () => {
    const henock = await byPhone("+251911000005");
    const job = await db.job.findFirstOrThrow({
      where: { venue: { nameEn: "Piassa Terrace Restaurant" } },
    });
    await expect(promoteJob(henock, job)).rejects.toMatchObject({
      status: 409,
      details: { reason: "PLAN_UPGRADE", upgradeTo: "PRO" },
    });
    const { body } = await log(henock, job.id);
    expect(body.eligibility).toMatchObject({ allowed: false, plan: "STANDARD" });
  });

  it("only promotes live jobs", async () => {
    const { venue, selam } = await hiwot();
    const draft = await createJob(venue.id, selam.id, { status: "DRAFT" });
    await expect(promoteJob(selam, draft)).rejects.toMatchObject({
      status: 409,
      details: { reason: "NOT_LIVE" },
    });
  });

  it("the log is for members with job.view; other venues get 404", async () => {
    const job = await db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent" } });
    expect((await log(await byPhone("+251911000002"), job.id)).status).toBe(200); // Poster
    expect((await log(await byPhone("+251911000005"), job.id)).status).toBe(404);
  });
});
