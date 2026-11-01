import { existsSync } from "node:fs";
import path from "node:path";
import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as decisionRoute } from "@/app/api/admin/moderation/[id]/decision/route";
import { GET as itemRoute } from "@/app/api/admin/moderation/[id]/route";
import { GET as listRoute } from "@/app/api/admin/moderation/route";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const moderator = () => byPhone("+251911000009");
const cookieFor = async (u: User) =>
  `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`;

const list = async (user: User, query = "?status=PENDING") =>
  listRoute(
    new Request(`${BASE}/api/admin/moderation${query}`, {
      headers: { cookie: await cookieFor(user) },
    }),
    { params: Promise.resolve({}) },
  );

const decide = async (user: User, id: string, body: unknown) =>
  decisionRoute(
    new Request(`${BASE}/api/admin/moderation/${id}/decision`, {
      method: "POST",
      headers: { cookie: await cookieFor(user), "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

/** A second venue with a pending license, like Bruk's café after upload. */
async function pendingCafe() {
  const city = await db.city.findUniqueOrThrow({ where: { slug: "addis-ababa" } });
  const sub = await db.subCity.findUniqueOrThrow({ where: { slug: "bole" } });
  const owner = await db.user.create({
    data: { phone: "+251911000011", name: "Bruk", platformRole: "EMPLOYER", locale: "AM" },
  });
  const venue = await db.venue.create({
    data: {
      nameEn: "Bole Sunrise Café",
      category: "CAFE",
      cityId: city.id,
      subCityId: sub.id,
      contactPhone: owner.phone,
      verification: "PENDING",
      members: { create: { userId: owner.id, displayName: "Bruk", role: "OWNER" } },
    },
  });
  const license = await db.licenseDocument.create({
    data: {
      venueId: venue.id,
      fileKey: "k.pdf",
      fileName: "l.pdf",
      mime: "application/pdf",
      sizeBytes: 9,
    },
  });
  const item = await db.moderationItem.create({ data: { type: "LICENSE", licenseId: license.id } });
  return { owner, venue, license, item };
}

describe("seeded queue", () => {
  beforeEach(resetDb);

  it("starts with the Lideta re-upload and its file on disk (doc 05 §9.5)", async () => {
    const res = await list(await moderator());
    expect(res.status).toBe(200);
    const { items } = await res.json();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "LICENSE", title: "Lideta Corner Café" });
    const doc = await db.licenseDocument.findFirstOrThrow();
    expect(existsSync(path.join("data/test-uploads", doc.fileKey))).toBe(true);
  });
});

describe("license decisions", () => {
  beforeEach(resetDb);

  it("approve: venue VERIFIED, owner notified by app and SMS, audited", async () => {
    const admin = await moderator();
    const { owner, venue, license, item } = await pendingCafe();
    const res = await decide(admin, item.id, { decision: "APPROVE" });
    expect(res.status).toBe(200);

    const v = await db.venue.findUniqueOrThrow({ where: { id: venue.id } });
    expect(v.verification).toBe("VERIFIED");
    expect(v.verifiedAt).not.toBeNull();
    const doc = await db.licenseDocument.findUniqueOrThrow({ where: { id: license.id } });
    expect(doc).toMatchObject({ status: "APPROVED", reviewedById: admin.id });
    const note = await db.notification.findFirstOrThrow({ where: { userId: owner.id } });
    expect(note).toMatchObject({ kind: "VENUE_VERIFIED", href: "/employer" });
    const sms = await db.smsLog.findFirstOrThrow({ where: { toPhone: owner.phone } });
    expect(sms.body).toMatch(/[ሀ-፿]/); // Bruk's locale here is Amharic
    expect(
      await db.auditLog.count({ where: { action: "license.approve", actorId: admin.id } }),
    ).toBe(1);
  });

  it("reject: needs a reason, which reaches the license and the owner", async () => {
    const admin = await moderator();
    const { owner, venue, license, item } = await pendingCafe();
    expect((await decide(admin, item.id, { decision: "REJECT" })).status).toBe(400);
    expect((await decide(admin, item.id, { decision: "REJECT", reason: "  " })).status).toBe(400);

    const reason = "The license has expired.";
    expect((await decide(admin, item.id, { decision: "REJECT", reason })).status).toBe(200);
    expect((await db.venue.findUniqueOrThrow({ where: { id: venue.id } })).verification).toBe(
      "REJECTED",
    );
    const doc = await db.licenseDocument.findUniqueOrThrow({ where: { id: license.id } });
    expect(doc).toMatchObject({ status: "REJECTED", rejectionReason: reason });
    const note = await db.notification.findFirstOrThrow({ where: { userId: owner.id } });
    expect(note).toMatchObject({ kind: "VENUE_REJECTED", href: "/employer/onboarding/license" });
    expect(note.bodyEn).toBe(reason);
  });

  it("removes a decided item from the queue, and can't be decided twice", async () => {
    const admin = await moderator();
    const { item } = await pendingCafe();
    await decide(admin, item.id, { decision: "APPROVE" });
    const { items } = await (await list(admin)).json();
    expect(items.map((i: { id: string }) => i.id)).not.toContain(item.id);
    expect((await decide(admin, item.id, { decision: "REJECT", reason: "x" })).status).toBe(409);
  });

  it("offers no request-changes path for a license", async () => {
    const { item } = await pendingCafe();
    const res = await decide(await moderator(), item.id, {
      decision: "REQUEST_CHANGES",
      reason: "x",
    });
    expect(res.status).toBe(409);
  });

  it("is 404 for an unknown item", async () => {
    expect((await decide(await moderator(), "nope", { decision: "APPROVE" })).status).toBe(404);
  });
});

describe("access", () => {
  beforeEach(resetDb);

  it("is for moderators only", async () => {
    const { item } = await pendingCafe();
    const owner = await byPhone("+251911000001");
    expect((await list(owner)).status).toBe(403);
    expect((await decide(owner, item.id, { decision: "APPROVE" })).status).toBe(403);
    const res = await itemRoute(
      new Request(`${BASE}/api/admin/moderation/${item.id}`, {
        headers: { cookie: await cookieFor(await byPhone("+251922000001")) },
      }),
      { params: Promise.resolve({ id: item.id }) },
    );
    expect(res.status).toBe(403);
    const anon = await listRoute(new Request(`${BASE}/api/admin/moderation`), {
      params: Promise.resolve({}),
    });
    expect(anon.status).toBe(401);
  });
});
