import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DELETE as removeRoute,
  PATCH as patchRoute,
} from "@/app/api/venues/[id]/team/[memberId]/route";
import { GET as listRoute, POST as inviteRoute } from "@/app/api/venues/[id]/team/route";
import { GET as applicantsRoute } from "@/app/api/jobs/[id]/applicants/route";
import { db } from "@/server/db";
import { verifyOtp } from "@/server/services/auth";
import { signSessionToken } from "@/server/session";
import type { TeamMember } from "@/server/services/team";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const SELAM = "+251911000001"; // Owner
const YARED = "+251911000002"; // Poster
const RAHEL = "+251911000003"; // Screener
const MESERET = "+251911000004"; // HR manager
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const headers = async (u: User) => ({
  cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
  "content-type": "application/json",
});
const hiwot = () => db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });
const memberRow = async (phone: string) => {
  const u = await byPhone(phone);
  return db.venueMember.findFirstOrThrow({ where: { userId: u.id } });
};

const list = async (u: User, venueId: string) =>
  listRoute(new Request(`${BASE}/api/venues/${venueId}/team`, { headers: await headers(u) }), {
    params: Promise.resolve({ id: venueId }),
  });
const invite = async (u: User, venueId: string, body: unknown) =>
  inviteRoute(
    new Request(`${BASE}/api/venues/${venueId}/team`, {
      method: "POST",
      headers: await headers(u),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: venueId }) },
  );
const patch = async (u: User, venueId: string, memberId: string, body: unknown) =>
  patchRoute(
    new Request(`${BASE}/api/venues/${venueId}/team/${memberId}`, {
      method: "PATCH",
      headers: await headers(u),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: venueId, memberId }) },
  );
const remove = async (u: User, venueId: string, memberId: string) =>
  removeRoute(
    new Request(`${BASE}/api/venues/${venueId}/team/${memberId}`, {
      method: "DELETE",
      headers: await headers(u),
    }),
    { params: Promise.resolve({ id: venueId, memberId }) },
  );

describe("team API (App Flow §6.3, doc 05 §5.3)", () => {
  beforeEach(resetDb);

  it("lists the team with effective permissions, owner first", async () => {
    const venue = await hiwot();
    const res = await list(await byPhone(SELAM), venue.id);
    expect(res.status).toBe(200);
    const { members }: { members: TeamMember[] } = await res.json();
    expect(members.map((m) => m.role)).toEqual(["OWNER", "HR_MANAGER", "POSTER", "SCREENER"]);
    expect(members[0]).toMatchObject({ name: "Selam Getachew", isSelf: true });
    expect(members.find((m) => m.role === "POSTER")!.permissions).not.toContain("applicant.view");
  });

  it("is for team.manage only: HR manager 403, other venue 404", async () => {
    const venue = await hiwot();
    expect((await list(await byPhone(MESERET), venue.id)).status).toBe(403);
    expect((await list(await byPhone("+251911000005"), venue.id)).status).toBe(404);
  });

  describe("invite", () => {
    it("creates an INVITED member, texts the invitee, and activates on their first sign-in", async () => {
      const venue = await hiwot();
      const selam = await byPhone(SELAM);
      const res = await invite(selam, venue.id, {
        name: "Tsehay Bekele",
        phone: "0911555123",
        role: "SCREENER",
        revoke: ["contact.reveal"],
      });
      expect(res.status).toBe(201);
      const { member } = await res.json();
      expect(member).toMatchObject({
        status: "INVITED",
        userId: null,
        invitedPhone: "+251911555123",
      });
      expect(JSON.parse(member.revoke)).toEqual(["contact.reveal"]);
      const text = await db.smsLog.findFirstOrThrow({ where: { toPhone: "+251911555123" } });
      expect(text.body).toContain("Hiwot Garden Hotel invited you");
      expect(await db.auditLog.count({ where: { action: "team.invite" } })).toBe(1);

      // First sign-in with that phone: an employer account, membership ACTIVE (no intent needed)
      const { user } = await signInWithDemoCode("+251911555123");
      expect(user.platformRole).toBe("EMPLOYER");
      expect((await db.venueMember.findUniqueOrThrow({ where: { id: member.id } })).status).toBe(
        "ACTIVE",
      );
    });

    it("adds an existing employer with no venue at once", async () => {
      const venue = await hiwot();
      await db.user.create({
        data: {
          phone: "+251911000011",
          name: "Bruk Tilahun",
          platformRole: "EMPLOYER",
          locale: "EN",
        },
      });
      const res = await invite(await byPhone(SELAM), venue.id, {
        name: "Bruk",
        phone: "+251911000011",
        role: "VIEWER",
      });
      expect((await res.json()).member).toMatchObject({ status: "ACTIVE" });
    });

    it.each([
      ["a jobseeker's number", "+251922000001", "NOT_AN_EMPLOYER"],
      ["someone at another venue", "+251911000005", "OTHER_VENUE"],
      ["an existing member", YARED, "ALREADY_MEMBER"],
    ])("refuses %s (409)", async (_label, phone, reason) => {
      const venue = await hiwot();
      const res = await invite(await byPhone(SELAM), venue.id, {
        name: "Someone",
        phone,
        role: "VIEWER",
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error.details).toEqual({ reason });
    });

    it("rejects bad input", async () => {
      const venue = await hiwot();
      const selam = await byPhone(SELAM);
      for (const body of [
        { name: "X", phone: "0911555123", role: "VIEWER" },
        { name: "Abebe", phone: "12345", role: "VIEWER" },
        { name: "Abebe", phone: "0911555123", role: "BOSS" },
        { name: "Abebe", phone: "0911555123", role: "VIEWER", grant: ["admin.moderate"] },
      ]) {
        expect((await invite(selam, venue.id, body)).status).toBe(400);
      }
    });
  });

  describe("change role and toggles", () => {
    it("applies to the member's very next request", async () => {
      const venue = await hiwot();
      const yared = await byPhone(YARED);
      const job = await db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent" } });
      const applicants = async () =>
        applicantsRoute(
          new Request(`${BASE}/api/jobs/${job.id}/applicants`, { headers: await headers(yared) }),
          { params: Promise.resolve({ id: job.id }) },
        );
      expect((await applicants()).status).toBe(403);
      const res = await patch(await byPhone(SELAM), venue.id, (await memberRow(YARED)).id, {
        role: "POSTER",
        grant: ["applicant.view"],
      });
      expect(res.status).toBe(200);
      expect((await applicants()).status).toBe(200);
      const log = await db.auditLog.findFirstOrThrow({
        where: { action: "team.permission_change" },
      });
      expect(JSON.parse(log.meta!)).toMatchObject({
        after: { role: "POSTER", grant: ["applicant.view"] },
      });
    });

    it("stores overrides normalised against the preset", async () => {
      const venue = await hiwot();
      const rahel = await memberRow(RAHEL);
      await patch(await byPhone(SELAM), venue.id, rahel.id, {
        role: "SCREENER",
        grant: ["applicant.view", "insights.view"], // applicant.view is already in the preset
        revoke: ["job.create"], // not in the preset: nothing to revoke
      });
      const row = await db.venueMember.findUniqueOrThrow({ where: { id: rahel.id } });
      expect(JSON.parse(row.grant)).toEqual(["insights.view"]);
      expect(JSON.parse(row.revoke)).toEqual([]);
    });

    it("refuses to downgrade the last owner", async () => {
      const venue = await hiwot();
      const selamRow = await memberRow(SELAM);
      // Give Meseret team.manage so someone else could try; Selam stays the only OWNER.
      await patch(await byPhone(SELAM), venue.id, (await memberRow(MESERET)).id, {
        role: "HR_MANAGER",
        grant: ["team.manage"],
      });
      const res = await patch(await byPhone(MESERET), venue.id, selamRow.id, {
        role: "HR_MANAGER",
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error.details).toEqual({ reason: "LAST_OWNER" });
      expect((await db.venueMember.findUniqueOrThrow({ where: { id: selamRow.id } })).role).toBe(
        "OWNER",
      );
    });

    it("refuses to let anyone take away their own team access", async () => {
      const venue = await hiwot();
      const selamRow = await memberRow(SELAM);
      const res = await patch(await byPhone(SELAM), venue.id, selamRow.id, {
        role: "OWNER",
        revoke: ["team.manage"],
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error.details).toEqual({ reason: "SELF_LOCKOUT" });
    });

    it("lets an owner step down once there is another owner", async () => {
      const venue = await hiwot();
      const selam = await byPhone(SELAM);
      await patch(selam, venue.id, (await memberRow(MESERET)).id, { role: "OWNER" });
      const meseret = await byPhone(MESERET);
      const res = await patch(meseret, venue.id, (await memberRow(SELAM)).id, {
        role: "HR_MANAGER",
      });
      expect(res.status).toBe(200);
    });

    it("only an owner can hand out team or billing access", async () => {
      const venue = await hiwot();
      const selam = await byPhone(SELAM);
      await patch(selam, venue.id, (await memberRow(MESERET)).id, {
        role: "HR_MANAGER",
        grant: ["team.manage"],
      });
      const meseret = await byPhone(MESERET);
      const rahelId = (await memberRow(RAHEL)).id;
      for (const body of [
        { role: "SCREENER", grant: ["billing.manage"] },
        { role: "SCREENER", grant: ["team.manage"] },
        { role: "OWNER" },
      ]) {
        const res = await patch(meseret, venue.id, rahelId, body);
        expect(res.status).toBe(403);
        expect((await res.json()).error.details).toEqual({ reason: "OWNER_ONLY" });
      }
      // …but other changes are fine
      expect((await patch(meseret, venue.id, rahelId, { role: "VIEWER" })).status).toBe(200);
    });
  });

  describe("remove", () => {
    it("removes a member, who loses access on the next request", async () => {
      const venue = await hiwot();
      const rahel = await byPhone(RAHEL);
      expect((await list(await byPhone(SELAM), venue.id)).status).toBe(200);
      const res = await remove(await byPhone(SELAM), venue.id, (await memberRow(RAHEL)).id);
      expect(res.status).toBe(204);
      expect((await memberRow(RAHEL)).status).toBe("REMOVED");
      const job = await db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent" } });
      const after = await applicantsRoute(
        new Request(`${BASE}/api/jobs/${job.id}/applicants`, { headers: await headers(rahel) }),
        { params: Promise.resolve({ id: job.id }) },
      );
      expect(after.status).toBe(404);
      expect(await db.auditLog.count({ where: { action: "team.remove" } })).toBe(1);
    });

    it("refuses to remove yourself or the last owner; 404 for another venue's member", async () => {
      const venue = await hiwot();
      const selam = await byPhone(SELAM);
      const self = await remove(selam, venue.id, (await memberRow(SELAM)).id);
      expect(self.status).toBe(409);
      expect((await self.json()).error.details).toEqual({ reason: "SELF_REMOVE" });

      await patch(selam, venue.id, (await memberRow(MESERET)).id, {
        role: "HR_MANAGER",
        grant: ["team.manage"],
      });
      const last = await remove(await byPhone(MESERET), venue.id, (await memberRow(SELAM)).id);
      expect(last.status).toBe(409);
      expect((await last.json()).error.details).toEqual({ reason: "LAST_OWNER" });

      const henockRow = await memberRow("+251911000005");
      expect((await remove(selam, venue.id, henockRow.id)).status).toBe(404);
    });

    it("can re-invite a removed member", async () => {
      const venue = await hiwot();
      const selam = await byPhone(SELAM);
      await remove(selam, venue.id, (await memberRow(RAHEL)).id);
      const res = await invite(selam, venue.id, { name: "Rahel", phone: RAHEL, role: "VIEWER" });
      expect(res.status).toBe(201);
      expect((await res.json()).member).toMatchObject({ status: "ACTIVE", role: "VIEWER" });
    });
  });
});

/** Signs in with the demo code the way the OTP routes do (DEMO_MODE code 123456). */
async function signInWithDemoCode(phone: string) {
  const { requestOtp } = await import("@/server/services/auth");
  await requestOtp(phone);
  return verifyOtp(phone, "123456");
}
