import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import { PRESETS, VENUE_PERMISSIONS, type VenuePermission } from "@/lib/permissions";
import { db } from "@/server/db";
import { AppError } from "@/server/http/errors";
import {
  authorizeApplication,
  authorizeJob,
  authorizePlatform,
  authorizeVenue,
  requireJobseeker,
} from "@/server/policy/authorize";
import { withAuth } from "@/server/policy/with-auth";
import { signSessionToken } from "@/server/session";
import { createJob, resetDb } from "./helpers";

const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const PHONES = {
  selam: "+251911000001", // Hiwot OWNER
  yared: "+251911000002", // Hiwot POSTER
  rahel: "+251911000003", // Hiwot SCREENER
  meseret: "+251911000004", // Hiwot HR_MANAGER
  henock: "+251911000005", // Piassa OWNER
  admin: "+251911000009",
  dawit: "+251922000001",
};

async function statusOf(p: Promise<unknown>): Promise<number> {
  try {
    await p;
    return 200;
  } catch (err) {
    if (err instanceof AppError) return err.status;
    throw err;
  }
}

async function fixture() {
  const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });
  const users = Object.fromEntries(
    await Promise.all(Object.entries(PHONES).map(async ([k, p]) => [k, await byPhone(p)])),
  ) as Record<keyof typeof PHONES, User>;
  const job = await createJob(venue.id, users.selam.id);
  const application = await db.application.create({
    data: { jobId: job.id, jobseekerId: users.dawit.id, status: "SHORTLISTED" },
  });
  return { venue, users, job, application };
}

const setOverrides = (venueId: string, userId: string, grant: string[], revoke: string[]) =>
  db.venueMember.updateMany({
    where: { venueId, userId },
    data: { grant: JSON.stringify(grant), revoke: JSON.stringify(revoke) },
  });

describe("authorize* against the seeded Hiwot team", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeEach(async () => {
    await resetDb();
    f = await fixture();
  });

  const members = [
    ["selam", "OWNER"],
    ["meseret", "HR_MANAGER"],
    ["yared", "POSTER"],
    ["rahel", "SCREENER"],
  ] as const;

  it.each(members)("%s (%s) gets exactly the preset, enforced on every key", async (who, role) => {
    for (const perm of VENUE_PERMISSIONS) {
      const expected = PRESETS[role].includes(perm) ? 200 : 403;
      expect(await statusOf(authorizeVenue(f.users[who], f.venue.id, perm)), perm).toBe(expected);
    }
  });

  it("derives the venue from the job and the application", async () => {
    const viaJob = await authorizeJob(f.users.rahel, f.job.id, "applicant.view");
    expect(viaJob.job.id).toBe(f.job.id);
    const viaApp = await authorizeApplication(f.users.rahel, f.application.id, "contact.reveal");
    expect(viaApp.job.venueId).toBe(f.venue.id);
  });

  it("returns 404 for another venue's resources, never 403 (no existence leak)", async () => {
    const henock = f.users.henock; // owner of Piassa, owns every permission there
    expect(await statusOf(authorizeVenue(henock, f.venue.id, "job.view"))).toBe(404);
    expect(await statusOf(authorizeJob(henock, f.job.id, "job.view"))).toBe(404);
    expect(await statusOf(authorizeApplication(henock, f.application.id, "applicant.view"))).toBe(
      404,
    );
  });

  it("returns 404 for ids that do not exist", async () => {
    expect(await statusOf(authorizeJob(f.users.selam, "nope", "job.view"))).toBe(404);
    expect(await statusOf(authorizeApplication(f.users.selam, "nope", "applicant.view"))).toBe(404);
  });

  it("applies grant and revoke on the next request", async () => {
    expect(await statusOf(authorizeJob(f.users.yared, f.job.id, "applicant.view"))).toBe(403);
    await setOverrides(f.venue.id, f.users.yared.id, ["applicant.view"], []);
    expect(await statusOf(authorizeJob(f.users.yared, f.job.id, "applicant.view"))).toBe(200);

    await setOverrides(f.venue.id, f.users.rahel.id, [], ["contact.reveal"]);
    expect(
      await statusOf(authorizeApplication(f.users.rahel, f.application.id, "contact.reveal")),
    ).toBe(403);
  });

  it("treats REMOVED and INVITED members as outsiders (404)", async () => {
    await db.venueMember.updateMany({
      where: { venueId: f.venue.id, userId: f.users.rahel.id },
      data: { status: "REMOVED" },
    });
    expect(await statusOf(authorizeJob(f.users.rahel, f.job.id, "job.view"))).toBe(404);
    await db.venueMember.updateMany({
      where: { venueId: f.venue.id, userId: f.users.meseret.id },
      data: { status: "INVITED" },
    });
    expect(await statusOf(authorizeJob(f.users.meseret, f.job.id, "job.view"))).toBe(404);
  });

  it("gives platform admins moderation rights but no venue rights", async () => {
    expect(await statusOf(authorizeVenue(f.users.admin, f.venue.id, "job.view"))).toBe(404);
    expect(() => authorizePlatform(f.users.admin, "admin.moderate")).not.toThrow();
    expect(() => authorizePlatform(f.users.selam, "admin.moderate")).toThrow(AppError);
  });

  it("limits jobseeker endpoints to jobseekers", () => {
    expect(() => requireJobseeker(f.users.dawit)).not.toThrow();
    expect(() => requireJobseeker(f.users.selam)).toThrow(AppError);
  });

  it("audits denied sensitive actions only", async () => {
    await statusOf(authorizeApplication(f.users.yared, f.application.id, "contact.reveal"));
    await statusOf(authorizeJob(f.users.rahel, f.job.id, "job.edit")); // not sensitive
    const rows = await db.auditLog.findMany({ where: { action: "authz.denied" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: f.users.yared.id,
      entity: "Application",
      entityId: f.application.id,
    });
    expect(JSON.parse(rows[0].meta!)).toEqual({ permission: "contact.reveal" });
  });
});

describe("withAuth", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeEach(async () => {
    await resetDb();
    f = await fixture();
  });

  const cookieFor = async (u: User) =>
    `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`;
  const call = async (
    handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
    user: User | null,
    params: Record<string, string>,
  ) =>
    handler(
      new Request("http://localhost:3000/api/x", {
        headers: user ? { cookie: await cookieFor(user) } : {},
      }),
      { params: Promise.resolve(params) },
    );

  const applicants = withAuth({ perm: "applicant.view", resource: "job" }, (_req, a) =>
    Response.json({ jobId: a.job.id, role: a.access.member.role }),
  );

  it("401 without a session", async () => {
    expect((await call(applicants, null, { id: f.job.id })).status).toBe(401);
  });

  it("403 with the missing permission named (Poster opens applicants)", async () => {
    const res = await call(applicants, f.users.yared, { id: f.job.id });
    expect(res.status).toBe(403);
    expect((await res.json()).error.details).toEqual({ permission: "applicant.view" });
  });

  it("200 with the resource and membership loaded (Screener)", async () => {
    const res = await call(applicants, f.users.rahel, { id: f.job.id });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jobId: f.job.id, role: "SCREENER" });
  });

  it("404 for another venue's job and for a missing route param", async () => {
    expect((await call(applicants, f.users.henock, { id: f.job.id })).status).toBe(404);
    expect((await call(applicants, f.users.rahel, {})).status).toBe(404);
  });

  it("supports a custom param name and venue resources", async () => {
    const team = withAuth({ perm: "team.manage", resource: "venue", param: "venueId" }, (_r, a) =>
      Response.json({ venueId: a.venueId }),
    );
    expect((await call(team, f.users.selam, { venueId: f.venue.id })).status).toBe(200);
    expect((await call(team, f.users.meseret, { venueId: f.venue.id })).status).toBe(403);
  });

  it("supports role and platform requirements", async () => {
    const apply = withAuth({ role: "JOBSEEKER" }, () => Response.json({ ok: true }));
    expect((await call(apply, f.users.dawit, {})).status).toBe(200);
    expect((await call(apply, f.users.selam, {})).status).toBe(403);
    const queue = withAuth({ platform: "admin.moderate" }, () => Response.json({ ok: true }));
    expect((await call(queue, f.users.admin, {})).status).toBe(200);
    expect((await call(queue, f.users.rahel, {})).status).toBe(403);
  });
});

describe("/api/me permissions", () => {
  beforeEach(resetDb);

  const me = async (phone: string) => {
    const u = await byPhone(phone);
    const cookie = `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`;
    const res = await getMe(
      new Request("http://localhost:3000/api/me", { headers: { cookie } }),
      {},
    );
    return res.json();
  };

  it("lists each membership's effective permissions", async () => {
    const yared = await me(PHONES.yared);
    expect(yared.memberships[0].permissions).toEqual(
      VENUE_PERMISSIONS.filter((k: VenuePermission) => PRESETS.POSTER.includes(k)),
    );
    expect(yared.platformPermissions).toEqual([]);
  });

  it("gives the admin platform permissions and no memberships", async () => {
    const admin = await me(PHONES.admin);
    expect(admin.memberships).toEqual([]);
    expect(admin.platformPermissions).toEqual(["admin.moderate", "admin.audit"]);
  });
});
