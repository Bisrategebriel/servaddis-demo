import type { User } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as applyRoute } from "@/app/api/jobs/[id]/apply/route";
import { GET as mineRoute } from "@/app/api/me/applications/route";
import { DAY_MS, setClockOffset } from "@/server/clock";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { createJob, hiwot, resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const DAWIT = "+251922000001";
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const cookie = async (u: User) =>
  `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`;

const apply = async (u: User, id: string, body: unknown = {}) =>
  applyRoute(
    new Request(`${BASE}/api/jobs/${id}/apply`, {
      method: "POST",
      headers: { cookie: await cookie(u), "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
const mine = async (u: User, headers: Record<string, string> = {}) =>
  mineRoute(
    new Request(`${BASE}/api/me/applications`, {
      headers: { cookie: await cookie(u), ...headers },
    }),
    { params: Promise.resolve({}) },
  );

/** The Lideta café's same-day barista job: live, no applicants (doc 05 §9.5). */
const cafeJob = () =>
  db.job.findFirstOrThrow({ where: { titleEn: "Barista", urgency: "SAME_DAY", status: "LIVE" } });

describe("POST /api/jobs/:id/apply", () => {
  beforeEach(resetDb);
  afterEach(() => setClockOffset(0));

  it("creates the application with its event, and tells members who may see applicants", async () => {
    const dawit = await byPhone(DAWIT);
    const job = await cafeJob();
    const res = await apply(dawit, job.id, { note: "I can start today." });
    expect(res.status).toBe(201);
    const { application } = await res.json();
    expect(application).toMatchObject({ status: "APPLIED", note: "I can start today." });
    expect(await db.applicationEvent.count({ where: { applicationId: application.id } })).toBe(1);
    const notes = await db.notification.findMany({
      where: { kind: "APPLICATION_RECEIVED" },
      include: { user: true },
    });
    expect(notes.map((n) => n.user.phone)).toEqual(["+251911000006"]); // Lideta's owner
    expect(notes[0]).toMatchObject({
      bodyEn: 'Dawit A. applied to "Barista".',
      href: `/employer/jobs/${job.id}/applicants`,
    });
  });

  it("notifies Owner, HR manager and Screener at Hiwot, not the Poster", async () => {
    const job = await db.job.findFirstOrThrow({
      where: { titleEn: "Housekeeper", status: "LIVE" },
    });
    await apply(await byPhone(DAWIT), job.id);
    const notes = await db.notification.findMany({
      where: { kind: "APPLICATION_RECEIVED" },
      include: { user: true },
    });
    expect(notes.map((n) => n.user.name).sort()).toEqual([
      "Meseret Abate",
      "Rahel Mekonnen",
      "Selam Getachew",
    ]);
  });

  it("is idempotent: a repeat tap returns the same application (200)", async () => {
    const dawit = await byPhone(DAWIT);
    const job = await cafeJob();
    const first = await (await apply(dawit, job.id)).json();
    const again = await apply(dawit, job.id, { note: "second tap" });
    expect(again.status).toBe(200);
    expect((await again.json()).application.id).toBe(first.application.id);
    expect(await db.application.count({ where: { jobId: job.id } })).toBe(1);
    expect(await db.notification.count({ where: { kind: "APPLICATION_RECEIVED" } })).toBe(1);
  });

  it("survives simultaneous taps with one application", async () => {
    const dawit = await byPhone(DAWIT);
    const job = await cafeJob();
    const results = await Promise.all(Array.from({ length: 5 }, () => apply(dawit, job.id)));
    // One tap creates; the others share its result instead of racing it for SQLite's lock.
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await db.notification.count({ where: { kind: "APPLICATION_RECEIVED" } })).toBe(1);
    const ids = new Set(
      await Promise.all(results.map(async (r) => (await r.json()).application.id)),
    );
    expect(ids.size).toBe(1);
    expect(await db.application.count({ where: { jobId: job.id } })).toBe(1);
  });

  it("refuses a closed or expired job (409) and an unpublished one (404)", async () => {
    const dawit = await byPhone(DAWIT);
    const job = await cafeJob();
    await setClockOffset(2 * DAY_MS); // past the same-day deadline, before the sweep
    expect((await apply(dawit, job.id)).status).toBe(409);
    await setClockOffset(0);
    const { venue, selam } = await hiwot();
    const draft = await createJob(venue.id, selam.id, { status: "DRAFT" });
    expect((await apply(dawit, draft.id)).status).toBe(404);
  });

  it("still returns an existing application after the job closes", async () => {
    const dawit = await byPhone(DAWIT);
    const job = await cafeJob();
    await apply(dawit, job.id);
    await db.job.update({ where: { id: job.id }, data: { status: "CLOSED" } });
    expect((await apply(dawit, job.id)).status).toBe(200);
  });

  it("is for jobseekers only; notes are capped", async () => {
    const job = await cafeJob();
    expect((await apply(await byPhone("+251911000001"), job.id)).status).toBe(403);
    expect((await apply(await byPhone(DAWIT), job.id, { note: "x".repeat(301) })).status).toBe(400);
  });
});

describe("GET /api/me/applications", () => {
  beforeEach(resetDb);

  it("lists the jobseeker's own applications with step times", async () => {
    const hana = await db.user.findFirstOrThrow({ where: { name: "Hana Bekele" } });
    const res = await mine(hana);
    expect(res.status).toBe(200);
    const { items } = await res.json();
    // Her live application (the seeded history adds older ones on closed jobs).
    const live = items.filter((i: { job: { open: boolean } }) => i.job.open);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({
      status: "SHORTLISTED",
      job: { titleEn: "Front Desk Agent", venueEn: "Hiwot Garden Hotel", open: true },
    });
    expect(live[0].viewedAt).not.toBeNull();
    expect(live[0].shortlistedAt).not.toBeNull();
  });

  it("answers 304 to an unchanged poll, 200 once something changed", async () => {
    const dawit = await byPhone(DAWIT);
    const first = await mine(dawit);
    const etag = first.headers.get("etag")!;
    expect(etag).toBeTruthy();
    expect((await mine(dawit, { "if-none-match": etag })).status).toBe(304);
    await apply(dawit, (await cafeJob()).id);
    const changed = await mine(dawit, { "if-none-match": etag });
    expect(changed.status).toBe(200);
    expect((await changed.json()).items).toHaveLength(1);
  });

  it("is for jobseekers only", async () => {
    expect((await mine(await byPhone("+251911000001"))).status).toBe(403);
  });
});
