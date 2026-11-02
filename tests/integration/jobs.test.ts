import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getJob, PATCH as patchJob } from "@/app/api/jobs/[id]/route";
import { POST as createJob } from "@/app/api/jobs/route";
import { emptyJobForm, formFromTemplate, toJobPayload } from "@/lib/job-form";
import { prefillFromTemplate } from "@/lib/role-template";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const SELAM = "+251911000001";
const YARED = "+251911000002";
const RAHEL = "+251911000003";
const HENOCK = "+251911000005";
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const headers = async (u: User) => ({
  cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
  "content-type": "application/json",
});

const post = async (u: User, body: unknown) =>
  createJob(
    new Request(`${BASE}/api/jobs`, {
      method: "POST",
      headers: await headers(u),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );
const patch = async (u: User, id: string, body: unknown) =>
  patchJob(
    new Request(`${BASE}/api/jobs/${id}`, {
      method: "PATCH",
      headers: await headers(u),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

async function baristaBody() {
  const row = await db.roleTemplate.findUniqueOrThrow({ where: { slug: "barista" } });
  return toJobPayload(formFromTemplate(prefillFromTemplate(row), "bole"));
}

describe("POST /api/jobs", () => {
  beforeEach(resetDb);

  it("creates a DRAFT from a template, in both languages, with its skills", async () => {
    const selam = await byPhone(SELAM);
    const res = await post(selam, await baristaBody());
    expect(res.status).toBe(201);
    const { job } = await res.json();
    expect(job).toMatchObject({
      status: "DRAFT",
      createdById: selam.id,
      titleEn: "Barista",
      titleAm: "ባሪስታ",
      salaryMin: 5000,
      salaryMax: 9000,
    });
    expect(JSON.parse(job.requirementsAm).length).toBeGreaterThan(0);
    expect(await db.jobSkill.count({ where: { jobId: job.id } })).toBeGreaterThan(0);
  });

  it("saves an incomplete blank draft", async () => {
    const res = await post(await byPhone(SELAM), toJobPayload(emptyJobForm("bole")));
    expect(res.status).toBe(201);
    expect((await res.json()).job).toMatchObject({ titleEn: "", salaryMin: 0 });
  });

  it("allows drafts for an unverified venue (E-04)", async () => {
    const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Lideta Corner Café" } });
    await db.venue.update({ where: { id: venue.id }, data: { verification: "PENDING" } });
    const res = await post(await byPhone("+251911000006"), await baristaBody());
    expect(res.status).toBe(201);
  });

  it("takes the venue from the membership and ignores any in the body", async () => {
    const other = await db.venue.findFirstOrThrow({
      where: { nameEn: "Piassa Terrace Restaurant" },
    });
    const body = { ...(await baristaBody()), venueId: other.id };
    const { job } = await (await post(await byPhone(SELAM), body)).json();
    expect(job.venueId).not.toBe(other.id);
  });

  it("follows the permissions: Poster yes, Screener no, jobseeker no, signed out no", async () => {
    const body = await baristaBody();
    expect((await post(await byPhone(YARED), body)).status).toBe(201);
    expect((await post(await byPhone(RAHEL), body)).status).toBe(403);
    expect((await post(await byPhone("+251922000001"), body)).status).toBe(403);
    const anon = await createJob(
      new Request(`${BASE}/api/jobs`, { method: "POST", body: JSON.stringify(body) }),
      { params: Promise.resolve({}) },
    );
    expect(anon.status).toBe(401);
  });

  it.each([
    ["an unknown sub-city", { subCity: "atlantis" }],
    ["an unknown template", { roleTemplateSlug: "astronaut" }],
    ["a negative salary", { salaryMin: -1 }],
    ["no headcount", { headcount: 0 }],
    ["a bad urgency", { urgency: "YESTERDAY" }],
  ])("rejects %s", async (_label, change) => {
    const res = await post(await byPhone(SELAM), { ...(await baristaBody()), ...change });
    expect(res.status).toBe(400);
  });
});

describe("/api/jobs/:id", () => {
  beforeEach(resetDb);

  async function draft() {
    const selam = await byPhone(SELAM);
    const { job } = await (await post(selam, await baristaBody())).json();
    return { selam, job };
  }

  it("updates a draft", async () => {
    const { selam, job } = await draft();
    const body = { ...(await baristaBody()), salaryMax: 12000, urgency: "NEXT_DAY" };
    const res = await patch(selam, job.id, body);
    expect(res.status).toBe(200);
    expect((await res.json()).job).toMatchObject({ salaryMax: 12000, urgency: "NEXT_DAY" });
  });

  it("can't change status through an edit", async () => {
    const { selam, job } = await draft();
    await patch(selam, job.id, { ...(await baristaBody()), status: "LIVE" });
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("DRAFT");
  });

  it("refuses to edit a job that is past draft", async () => {
    const { selam, job } = await draft();
    await db.job.update({ where: { id: job.id }, data: { status: "PENDING_REVIEW" } });
    expect((await patch(selam, job.id, await baristaBody())).status).toBe(409);
  });

  it("is 403 without job.edit, 404 for another venue", async () => {
    const { job } = await draft();
    const body = await baristaBody();
    expect((await patch(await byPhone(RAHEL), job.id, body)).status).toBe(403);
    expect((await patch(await byPhone(HENOCK), job.id, body)).status).toBe(404);
    const res = await getJob(
      new Request(`${BASE}/api/jobs/${job.id}`, { headers: await headers(await byPhone(HENOCK)) }),
      { params: Promise.resolve({ id: job.id }) },
    );
    expect(res.status).toBe(404);
  });
});
