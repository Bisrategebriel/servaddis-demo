import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as hireRoute } from "@/app/api/applications/[id]/hire/route";
import { POST as rejectRoute } from "@/app/api/applications/[id]/reject/route";
import { POST as revealRoute } from "@/app/api/applications/[id]/reveal-contact/route";
import { GET as detailRoute } from "@/app/api/applications/[id]/route";
import { POST as shortlistRoute } from "@/app/api/applications/[id]/shortlist/route";
import { POST as viewRoute } from "@/app/api/applications/[id]/view/route";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const SELAM = "+251911000001"; // Owner
const YARED = "+251911000002"; // Poster: no applicant.view
const RAHEL = "+251911000003"; // Screener: view, shortlist, reject, reveal; no hire
const HENOCK = "+251911000005"; // other venue
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });

type Route = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const call = async (route: Route, u: User, id: string, body?: unknown) =>
  route(
    new Request(`${BASE}/api/applications/${id}/x`, {
      method: "POST",
      headers: {
        cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    }),
    { params: Promise.resolve({ id }) },
  );
const get = async (u: User, id: string) =>
  detailRoute(
    new Request(`${BASE}/api/applications/${id}`, {
      headers: {
        cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
      },
    }),
    { params: Promise.resolve({ id }) },
  );

/** A seeded Front Desk Agent applicant by name. */
const appOf = async (name: string) => {
  const seeker = await db.user.findFirstOrThrow({ where: { name } });
  return db.application.findFirstOrThrow({
    where: { jobseekerId: seeker.id, job: { status: "LIVE" } },
  });
};
const status = async (id: string) =>
  (await db.application.findUniqueOrThrow({ where: { id } })).status;
const notesFor = (userId: string) =>
  db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

describe("applicant actions (App Flow §5.1)", () => {
  beforeEach(resetDb);

  it("view: Applied → Viewed once, with event and a bell note for the jobseeker", async () => {
    const app = await appOf("Feven Alemayehu");
    const rahel = await byPhone(RAHEL);
    expect((await call(viewRoute, rahel, app.id)).status).toBe(200);
    expect(await status(app.id)).toBe("VIEWED");
    await call(viewRoute, rahel, app.id); // opening again changes nothing
    expect(
      await db.applicationEvent.count({ where: { applicationId: app.id, type: "VIEWED" } }),
    ).toBe(1);
    const notes = await notesFor(app.jobseekerId);
    expect(notes.map((n) => n.kind)).toEqual(["APPLICATION_VIEWED"]);
    expect(
      await db.smsLog.count({
        where: {
          toPhone: (await db.user.findUniqueOrThrow({ where: { id: app.jobseekerId } })).phone,
        },
      }),
    ).toBe(0);
  });

  it("shortlist from Applied sets viewedAt too, and texts the jobseeker", async () => {
    const app = await appOf("Liya Wondimu");
    expect((await call(shortlistRoute, await byPhone(RAHEL), app.id)).status).toBe(200);
    const row = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(row.status).toBe("SHORTLISTED");
    expect(row.viewedAt).not.toBeNull();
    const seeker = await db.user.findUniqueOrThrow({ where: { id: app.jobseekerId } });
    expect(await db.smsLog.count({ where: { toPhone: seeker.phone } })).toBe(1);
    expect((await notesFor(seeker.id)).map((n) => n.kind)).toEqual(["APPLICATION_SHORTLISTED"]);
  });

  it("reject needs a valid reason and stores it", async () => {
    const app = await appOf("Ruth Demissie");
    const rahel = await byPhone(RAHEL);
    expect((await call(rejectRoute, rahel, app.id, {})).status).toBe(400);
    expect((await call(rejectRoute, rahel, app.id, { reason: "SKILLS_MISMATCH" })).status).toBe(
      200,
    );
    const row = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(row).toMatchObject({ status: "REJECTED", rejectReason: "SKILLS_MISMATCH" });
    expect(row.rejectedAt).not.toBeNull();
  });

  it("hire only from Shortlisted; hiredCount goes up; jobseeker is told by app and SMS", async () => {
    const selam = await byPhone(SELAM);
    const viewed = await appOf("Abel Shiferaw");
    const res = await call(hireRoute, selam, viewed.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error.details).toEqual({ status: "VIEWED" });

    const hana = await appOf("Hana Bekele"); // seeded as shortlisted
    expect((await call(hireRoute, selam, hana.id)).status).toBe(200);
    expect(await status(hana.id)).toBe("HIRED");
    expect((await db.job.findUniqueOrThrow({ where: { id: hana.jobId } })).hiredCount).toBe(1);
    expect((await notesFor(hana.jobseekerId)).map((n) => n.kind)).toEqual(["APPLICATION_HIRED"]);
  });

  it("refuses actions on a terminal application with 409", async () => {
    const rejected = await appOf("Tewodros Ayalew");
    const selam = await byPhone(SELAM);
    expect((await call(shortlistRoute, selam, rejected.id)).status).toBe(409);
    expect((await call(rejectRoute, selam, rejected.id, { reason: "OTHER" })).status).toBe(409);
    expect((await call(revealRoute, selam, rejected.id)).status).toBe(409);
  });

  describe("contact reveal (E-14)", () => {
    it("is refused before shortlisting, with the current status", async () => {
      const app = await appOf("Abel Shiferaw");
      const res = await call(revealRoute, await byPhone(RAHEL), app.id);
      expect(res.status).toBe(409);
      expect((await res.json()).error.details).toEqual({ status: "VIEWED" });
      expect(await db.auditLog.count({ where: { action: "application.contact_reveal" } })).toBe(0);
    });

    it("after shortlisting returns the number, records who and when, and audits every reveal", async () => {
      const app = await appOf("Hana Bekele");
      const rahel = await byPhone(RAHEL);
      const res = await call(revealRoute, rahel, app.id);
      expect(res.status).toBe(200);
      const seeker = await db.user.findUniqueOrThrow({ where: { id: app.jobseekerId } });
      expect((await res.json()).phone.replace(/\s/g, "")).toBe(seeker.phone);
      const row = await db.application.findUniqueOrThrow({ where: { id: app.id } });
      expect(row.contactRevealedById).toBe(rahel.id);
      expect(row.contactRevealedAt).not.toBeNull();

      await call(revealRoute, await byPhone(SELAM), app.id); // a second reveal
      const audits = await db.auditLog.findMany({
        where: { action: "application.contact_reveal", entityId: app.id },
        orderBy: { at: "asc" },
      });
      expect(audits.map((a) => a.actorId)).toEqual([rahel.id, (await byPhone(SELAM)).id]);
      expect(
        await db.applicationEvent.count({
          where: { applicationId: app.id, type: "CONTACT_REVEALED" },
        }),
      ).toBe(1);
      const again = await db.application.findUniqueOrThrow({ where: { id: app.id } });
      expect(again.contactRevealedById).toBe(rahel.id); // the first reveal stays on record
    });

    it("the drawer shows the full number only after a reveal, and only to members who may reveal", async () => {
      const app = await appOf("Henok Abera");
      const selam = await byPhone(SELAM);
      const before = (await (await get(selam, app.id)).json()).application;
      expect(before.revealed).toBe(false);
      expect(before.phone).toMatch(/•/);
      await call(revealRoute, selam, app.id);
      const after = (await (await get(selam, app.id)).json()).application;
      expect(after.revealed).toBe(true);
      expect(after.phone).not.toMatch(/•/);
      expect(after.revealedBy.name).toBe("Selam G.");
      expect(after.events.map((e: { type: string }) => e.type)).toContain("CONTACT_REVEALED");
    });
  });

  describe("permissions", () => {
    it("Poster can't open applicants (403); Screener can't hire (403, audited); other venue 404", async () => {
      const hana = await appOf("Hana Bekele");
      expect((await get(await byPhone(YARED), hana.id)).status).toBe(403);
      const res = await call(hireRoute, await byPhone(RAHEL), hana.id);
      expect(res.status).toBe(403);
      expect((await res.json()).error.details).toEqual({ permission: "applicant.hire" });
      expect((await call(revealRoute, await byPhone(HENOCK), hana.id)).status).toBe(404);
      expect(await status(hana.id)).toBe("SHORTLISTED");
    });

    it("a denied reveal is audited", async () => {
      const hana = await appOf("Hana Bekele");
      expect((await call(revealRoute, await byPhone(YARED), hana.id)).status).toBe(403);
      expect(
        await db.auditLog.count({ where: { action: "authz.denied", entityId: hana.id } }),
      ).toBe(1);
    });
  });
});
