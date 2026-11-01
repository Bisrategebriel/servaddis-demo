import { existsSync } from "node:fs";
import path from "node:path";
import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getFile } from "@/app/api/files/[fileKey]/route";
import { POST as uploadRoute } from "@/app/api/venues/[id]/license/route";
import { MAX_LICENSE_BYTES } from "@/lib/license-file";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const PDF = new TextEncoder().encode("%PDF-1.4 sample");
const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const cookieFor = async (u: User) =>
  `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`;

async function upload(user: User, venueId: string, file?: File) {
  const form = new FormData();
  if (file) form.append("file", file);
  return uploadRoute(
    new Request(`${BASE}/api/venues/${venueId}/license`, {
      method: "POST",
      headers: { cookie: await cookieFor(user) },
      body: form,
    }),
    { params: Promise.resolve({ id: venueId }) },
  );
}

const fetchFile = async (user: User, fileKey: string) =>
  getFile(
    new Request(`${BASE}/api/files/${fileKey}`, { headers: { cookie: await cookieFor(user) } }),
    {
      params: Promise.resolve({ fileKey }),
    },
  );

const pdf = (name = "license.pdf") => new File([PDF], name, { type: "application/pdf" });

async function newOwner() {
  const city = await db.city.findUniqueOrThrow({ where: { slug: "addis-ababa" } });
  const sub = await db.subCity.findUniqueOrThrow({ where: { slug: "bole" } });
  const owner = await db.user.create({
    data: { phone: "+251911000011", name: "Bruk", platformRole: "EMPLOYER" },
  });
  const venue = await db.venue.create({
    data: {
      nameEn: "Bole Sunrise Café",
      category: "CAFE",
      cityId: city.id,
      subCityId: sub.id,
      contactPhone: owner.phone,
      members: { create: { userId: owner.id, displayName: "Bruk", role: "OWNER" } },
    },
  });
  return { owner, venue };
}

describe("license upload", () => {
  beforeEach(resetDb);

  it("stores the file, marks the venue PENDING and queues one moderation item", async () => {
    const { owner, venue } = await newOwner();
    const res = await upload(owner, venue.id, pdf("../evil/ፈቃድ.pdf"));
    expect(res.status).toBe(201);

    const doc = await db.licenseDocument.findFirstOrThrow({ where: { venueId: venue.id } });
    expect(doc).toMatchObject({ mime: "application/pdf", status: "PENDING", fileName: "ፈቃድ.pdf" });
    expect(doc.fileKey).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(existsSync(path.join("data/test-uploads", doc.fileKey))).toBe(true);
    expect((await db.venue.findUniqueOrThrow({ where: { id: venue.id } })).verification).toBe(
      "PENDING",
    );
    const items = await db.moderationItem.findMany({ where: { licenseId: doc.id } });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "LICENSE", status: "PENDING" });
    expect(await db.auditLog.count({ where: { action: "license.upload" } })).toBe(1);
  });

  it.each([
    ["no file", undefined, "MISSING"],
    ["an empty file", new File([], "a.pdf", { type: "application/pdf" }), "MISSING"],
    [
      "a program renamed .pdf",
      new File(["MZ...."], "a.pdf", { type: "application/pdf" }),
      "BAD_TYPE",
    ],
    ["SVG sent as PNG", new File(["<svg/>"], "a.png", { type: "image/png" }), "BAD_TYPE"],
    ["a real PDF declared as PNG", new File([PDF], "a.png", { type: "image/png" }), "BAD_TYPE"],
    [
      "a file over 5 MB",
      new File([PDF, new Uint8Array(MAX_LICENSE_BYTES)], "a.pdf", { type: "application/pdf" }),
      "TOO_LARGE",
    ],
  ])("rejects %s and changes nothing", async (_label, file, reason) => {
    const { owner, venue } = await newOwner();
    const res = await upload(owner, venue.id, file);
    expect(res.status).toBe(400);
    expect((await res.json()).error.details.reason).toBe(reason);
    expect(await db.licenseDocument.count({ where: { venueId: venue.id } })).toBe(0);
    expect((await db.venue.findUniqueOrThrow({ where: { id: venue.id } })).verification).toBe(
      "UNSUBMITTED",
    );
  });

  it("follows the state machine: no re-upload while PENDING or VERIFIED, yes after REJECTED", async () => {
    const { owner, venue } = await newOwner();
    await upload(owner, venue.id, pdf());
    expect((await upload(owner, venue.id, pdf())).status).toBe(409);

    await db.venue.update({ where: { id: venue.id }, data: { verification: "REJECTED" } });
    expect((await upload(owner, venue.id, pdf())).status).toBe(201);

    await db.venue.update({ where: { id: venue.id }, data: { verification: "VERIFIED" } });
    expect((await upload(owner, venue.id, pdf())).status).toBe(409);
  });

  it("is owner-only: Poster 403, other venue 404", async () => {
    const hiwot = await db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });
    expect((await upload(await byPhone("+251911000002"), hiwot.id, pdf())).status).toBe(403);
    expect((await upload(await byPhone("+251911000005"), hiwot.id, pdf())).status).toBe(404);
  });
});

describe("/api/files", () => {
  beforeEach(resetDb);

  async function stored() {
    const { owner, venue } = await newOwner();
    await upload(owner, venue.id, pdf());
    const doc = await db.licenseDocument.findFirstOrThrow({ where: { venueId: venue.id } });
    return { owner, key: doc.fileKey };
  }

  it("serves the file to the owner, with safe headers", async () => {
    const { owner, key } = await stored();
    const res = await fetchFile(owner, key);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
  });

  it("serves it to a moderator, but not to other employers", async () => {
    const { key } = await stored();
    expect((await fetchFile(await byPhone("+251911000009"), key)).status).toBe(200);
    expect((await fetchFile(await byPhone("+251911000001"), key)).status).toBe(404);
    expect((await fetchFile(await byPhone("+251922000001"), key)).status).toBe(404);
  });

  it("is 401 signed out, and 404 for unknown or traversal keys", async () => {
    const { owner, key } = await stored();
    const res = await getFile(new Request(`${BASE}/api/files/${key}`), {
      params: Promise.resolve({ fileKey: key }),
    });
    expect(res.status).toBe(401);
    expect((await fetchFile(owner, "../../.env")).status).toBe(404);
  });
});
