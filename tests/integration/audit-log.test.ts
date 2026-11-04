import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as auditRoute } from "@/app/api/admin/audit/route";
import { POST as revealRoute } from "@/app/api/applications/[id]/reveal-contact/route";
import { PATCH as memberRoute } from "@/app/api/venues/[id]/team/[memberId]/route";
import en from "../../messages/en.json";
import am from "../../messages/am.json";
import { db } from "@/server/db";
import { AUDIT_CATEGORIES, listAudit, platformCounts } from "@/server/services/audit-log";
import { decide } from "@/server/services/moderation";
import { signSessionToken } from "@/server/session";
import { hiwot, resetDb } from "./helpers";

// SCR-A03 / PRD A-04 and A-05: the moderator reads who did what, with readable context.

const BASE = "http://localhost:3000";
const cookie = async (u: User) =>
  `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`;
const as = async (u: User | null, path: string, init: RequestInit = {}) =>
  new Request(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      origin: BASE,
      ...(u ? { cookie: await cookie(u) } : {}),
    },
  });
const user = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const MODERATOR = "+251911000009";
const RAHEL = "+251911000003";

async function audit(u: User | null, query = "") {
  return auditRoute(await as(u, `/api/admin/audit${query}`), { params: Promise.resolve({}) });
}

async function hana() {
  return db.application.findFirstOrThrow({
    where: { jobseeker: { name: "Hana Bekele" }, job: { titleEn: "Front Desk Agent" } },
  });
}

describe("admin audit log", () => {
  beforeEach(resetDb);

  it("starts empty after a reset", async () => {
    expect((await listAudit({})).items).toEqual([]);
  });

  it("describes real actions with the venue, job, applicant and details", async () => {
    const admin = await user(MODERATOR);
    const license = await db.moderationItem.findFirstOrThrow({ where: { type: "LICENSE" } });
    await decide(admin, license.id, "APPROVE");

    const rahel = await user(RAHEL);
    const app = await hana();
    expect(
      (
        await revealRoute(
          await as(rahel, `/api/applications/${app.id}/reveal-contact`, { method: "POST" }),
          {
            params: Promise.resolve({ id: app.id }),
          },
        )
      ).status,
    ).toBe(200);

    // Yared (Poster) tries to reveal: refused and logged (contact.reveal is sensitive).
    const { venue, selam, yared } = await hiwot();
    expect(
      (
        await revealRoute(
          await as(yared, `/api/applications/${app.id}/reveal-contact`, { method: "POST" }),
          {
            params: Promise.resolve({ id: app.id }),
          },
        )
      ).status,
    ).toBe(403);

    // Selam makes Rahel an HR Manager.
    const member = await db.venueMember.findFirstOrThrow({
      where: { venueId: venue.id, userId: rahel.id },
    });
    const patch = await memberRoute(
      await as(selam, `/api/venues/${venue.id}/team/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: "HR_MANAGER", grant: [], revoke: [] }),
      }),
      { params: Promise.resolve({ id: venue.id, memberId: member.id }) },
    );
    expect(patch.status).toBe(200);

    const { items } = await listAudit({});
    expect(items.map((i) => i.action)).toEqual([
      "team.permission_change",
      "authz.denied",
      "application.contact_reveal",
      "license.approve",
    ]);
    const [change, denied, reveal, approve] = items;
    expect(approve).toMatchObject({
      actor: { name: "Servaddis Moderator", admin: true },
      venue: { en: "Lideta Corner Café" },
    });
    expect(reveal).toMatchObject({
      actor: { name: "Rahel Mekonnen", admin: false },
      subject: { en: "Hana Bekele · Front Desk Agent" },
      venue: { en: "Hiwot Garden Hotel" },
      detail: { firstReveal: true },
    });
    expect(denied).toMatchObject({
      actor: { name: "Yared Alemu" },
      detail: { permission: "contact.reveal" },
    });
    expect(change).toMatchObject({
      actor: { name: "Selam Getachew" },
      subject: { en: "Rahel Mekonnen" },
      venue: { en: "Hiwot Garden Hotel" },
      detail: { roleFrom: "SCREENER", roleTo: "HR_MANAGER" },
    });
    // The raw meta (phone numbers, permission lists) never leaves the server.
    expect(JSON.stringify(items)).not.toMatch(/"meta"|\+2519/);

    expect((await listAudit({ category: "contact" })).items.map((i) => i.action)).toEqual([
      "application.contact_reveal",
    ]);
    expect((await listAudit({ category: "denied" })).items).toHaveLength(1);
    expect((await listAudit({ category: "billing" })).items).toHaveLength(0);
  });

  it("pages 30 at a time, newest first, with a cursor", async () => {
    const admin = await user(MODERATOR);
    const base = Date.now();
    await db.auditLog.createMany({
      data: Array.from({ length: 35 }, (_, i) => ({
        actorId: admin.id,
        action: "job.close",
        entity: "Job",
        entityId: `job-${i}`,
        at: new Date(base + i * 1000),
      })),
    });
    const first = await listAudit({});
    expect(first.items).toHaveLength(30);
    expect(first.items[0].at > first.items[29].at).toBe(true);
    const second = await listAudit({ cursor: first.nextCursor! });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const ids = new Set([...first.items, ...second.items].map((i) => i.id));
    expect(ids.size).toBe(35);
  });

  it("GET /api/admin/audit: admins only, validated filters", async () => {
    expect((await audit(null)).status).toBe(401);
    const { selam } = await hiwot();
    expect((await audit(selam)).status).toBe(403);
    const admin = await user(MODERATOR);
    const ok = await audit(admin, "?category=moderation");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ items: [], nextCursor: null });
    expect((await audit(admin, "?category=everything")).status).toBe(400);
  });

  it("every logged action has a label in both languages", () => {
    const actions = Object.values(AUDIT_CATEGORIES).flat();
    for (const messages of [en, am]) {
      for (const action of actions) {
        const [group, key] = action.split(".");
        const labels = messages.audit.actions as Record<string, Record<string, string> | string>;
        expect(typeof labels[group] === "object" && labels[group][key], `${action}`).toBeTruthy();
      }
    }
  });
});

describe("platform counts", () => {
  beforeEach(resetDb);

  it("counts the seeded platform from the demo clock", async () => {
    const c = await platformCounts();
    expect(c.venues).toMatchObject({ total: 3, verified: 3, pending: 0 });
    expect(c.jobs.live).toBe(await db.job.count({ where: { status: "LIVE" } }));
    expect(c.applications.total).toBe(await db.application.count());
    expect(c.applications.hires).toBe(await db.application.count({ where: { status: "HIRED" } }));
    expect(c.queue.pending).toBe(1);
    expect(c.people.jobseekers).toBeGreaterThan(30);
    expect(c.payments.totalEtb).toBeGreaterThanOrEqual(0);
  });
});
