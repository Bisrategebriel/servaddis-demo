import type { User } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as applyRoute } from "@/app/api/jobs/[id]/apply/route";
import { GET as applicantsRoute } from "@/app/api/jobs/[id]/applicants/route";
import { compareApplicants } from "@/lib/applicant-sort";
import { advanceClock, setClockOffset } from "@/server/clock";
import { db } from "@/server/db";
import type { PipelineItem } from "@/server/services/pipeline";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const cookie = async (u: User) =>
  `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`;

type Body = { items: PipelineItem[]; counts: Record<string, number>; cursor: string };
const list = async (u: User, jobId: string, query = "") =>
  applicantsRoute(
    new Request(`${BASE}/api/jobs/${jobId}/applicants${query}`, {
      headers: { cookie: await cookie(u) },
    }),
    { params: Promise.resolve({ id: jobId }) },
  );
const frontDesk = () =>
  db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent", status: "LIVE" } });

describe("GET /api/jobs/:id/applicants", () => {
  beforeEach(resetDb);
  afterEach(() => setClockOffset(0));

  it("lists the 9 seeded applicants with counts per status and masked phones", async () => {
    const job = await frontDesk();
    const res = await list(await byPhone("+251911000003"), job.id); // Screener
    expect(res.status).toBe(200);
    const body: Body = await res.json();
    expect(body.items).toHaveLength(9);
    expect(body.counts).toEqual({ APPLIED: 4, VIEWED: 2, SHORTLISTED: 2, HIRED: 0, REJECTED: 1 });
    for (const a of body.items) {
      expect(a.phoneMasked).toMatch(/^\+251 \d\d• ••• •\d\d$/);
      expect(JSON.stringify(a)).not.toMatch(/\+2519\d{8}/); // never the full number
    }
    expect(body.items.filter((a) => a.isNew)).toHaveLength(4);
  });

  it("puts verified applicants first, then by the chosen sort", async () => {
    const job = await frontDesk();
    const selam = await byPhone("+251911000001");
    for (const sort of ["completeness", "experience"] as const) {
      const { items }: Body = await (await list(selam, job.id, `?sort=${sort}`)).json();
      expect(items).toEqual([...items].sort(compareApplicants(sort)));
      const firstUnverified = items.findIndex((a) => !a.verified);
      expect(items.slice(firstUnverified).every((a) => !a.verified)).toBe(true);
    }
  });

  it("filters by status", async () => {
    const job = await frontDesk();
    const { items }: Body = await (
      await list(await byPhone("+251911000001"), job.id, "?status=SHORTLISTED")
    ).json();
    expect(items.map((a) => a.name).sort()).toEqual(["Hana Bekele", "Henok Abera"]);
  });

  it("with ?since returns only what changed after the cursor", async () => {
    const job = await frontDesk();
    const selam = await byPhone("+251911000001");
    const first: Body = await (await list(selam, job.id)).json();
    await advanceClock(60_000); // later than the overlap window
    const quiet: Body = await (
      await list(selam, job.id, `?since=${encodeURIComponent(first.cursor)}`)
    ).json();
    expect(quiet.items).toEqual([]);
    expect(quiet.counts.APPLIED).toBe(4);

    const dawit = await byPhone("+251922000001");
    await applyRoute(
      new Request(`${BASE}/api/jobs/${job.id}/apply`, {
        method: "POST",
        headers: { cookie: await cookie(dawit), "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: job.id }) },
    );
    const changed: Body = await (
      await list(selam, job.id, `?since=${encodeURIComponent(quiet.cursor)}`)
    ).json();
    expect(changed.items.map((a) => a.name)).toEqual(["Dawit Alemu"]);
    expect(changed.items[0].isNew).toBe(true);
    expect(changed.counts.APPLIED).toBe(5);
  });

  it("is 403 for a Poster (no applicant.view) and 404 for another venue", async () => {
    const job = await frontDesk();
    const res = await list(await byPhone("+251911000002"), job.id);
    expect(res.status).toBe(403);
    expect((await res.json()).error.details).toEqual({ permission: "applicant.view" });
    expect((await list(await byPhone("+251911000005"), job.id)).status).toBe(404);
  });

  it("rejects a bad query", async () => {
    const job = await frontDesk();
    expect((await list(await byPhone("+251911000001"), job.id, "?sort=name")).status).toBe(400);
    expect((await list(await byPhone("+251911000001"), job.id, "?since=yesterday")).status).toBe(
      400,
    );
  });
});
