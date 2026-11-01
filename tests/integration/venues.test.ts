import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getVenue, PATCH as patchVenue } from "@/app/api/venues/[id]/route";
import { POST as createVenue } from "@/app/api/venues/route";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const valid = {
  ownerName: "Bruk Tilahun",
  nameEn: "Bole Sunrise Café",
  nameAm: "ቦሌ ሰንራይዝ ካፌ",
  category: "CAFE",
  subCity: "bole",
  contactPhone: "0911000011",
};

const cookieFor = async (u: User) =>
  `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`;

async function call(
  method: string,
  user: User | null,
  body?: unknown,
): Promise<{ headers: Record<string, string>; init: RequestInit }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (user) headers.cookie = await cookieFor(user);
  return {
    headers,
    init: { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
  };
}
const post = async (user: User | null, body: unknown) =>
  createVenue(new Request(`${BASE}/api/venues`, (await call("POST", user, body)).init), {
    params: Promise.resolve({}),
  });
const patch = async (user: User, id: string, body: unknown) =>
  patchVenue(new Request(`${BASE}/api/venues/${id}`, (await call("PATCH", user, body)).init), {
    params: Promise.resolve({ id }),
  });
const get = async (user: User, id: string) =>
  getVenue(new Request(`${BASE}/api/venues/${id}`, (await call("GET", user)).init), {
    params: Promise.resolve({ id }),
  });

const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const newEmployer = () =>
  db.user.create({ data: { phone: "+251911000011", name: "", platformRole: "EMPLOYER" } });
const hiwot = () => db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });

describe("venue API", () => {
  beforeEach(resetDb);

  it("creates an unverified venue with an OWNER membership", async () => {
    const bruk = await newEmployer();
    const res = await post(bruk, valid);
    expect(res.status).toBe(201);
    const { venue, redirectTo } = await res.json();
    expect(redirectTo).toBe("/employer/onboarding/license");
    expect(venue).toMatchObject({
      nameEn: "Bole Sunrise Café",
      verification: "UNSUBMITTED",
      foundingPostsLeft: 3,
      contactPhone: "+251911000011",
    });
    const member = await db.venueMember.findFirstOrThrow({ where: { venueId: venue.id } });
    expect(member).toMatchObject({ userId: bruk.id, role: "OWNER", status: "ACTIVE" });
    expect((await byPhone(bruk.phone)).name).toBe("Bruk Tilahun");
    expect(await db.auditLog.count({ where: { action: "venue.create" } })).toBe(1);
  });

  it("refuses a second venue", async () => {
    const bruk = await newEmployer();
    await post(bruk, valid);
    expect((await post(bruk, valid)).status).toBe(409);
  });

  it("is limited to signed-in employers", async () => {
    expect((await post(null, valid)).status).toBe(401);
    expect((await post(await byPhone("+251922000001"), valid)).status).toBe(403);
  });

  it.each([
    ["missing name", { ...valid, nameEn: " " }],
    ["bad category", { ...valid, category: "CASINO" }],
    ["bad sub-city", { ...valid, subCity: "atlantis" }],
    ["bad phone", { ...valid, contactPhone: "123" }],
  ])("rejects %s", async (_label, body) => {
    expect((await post(await newEmployer(), body)).status).toBe(400);
  });

  it("lets the owner edit, not a Poster or an outsider", async () => {
    const venue = await hiwot();
    const owner = await byPhone("+251911000001");
    const res = await patch(owner, venue.id, { descriptionEn: "Updated", subCity: "kirkos" });
    expect(res.status).toBe(200);
    const updated = await db.venue.findUniqueOrThrow({
      where: { id: venue.id },
      include: { subCity: true },
    });
    expect(updated.descriptionEn).toBe("Updated");
    expect(updated.subCity.slug).toBe("kirkos");

    expect((await patch(await byPhone("+251911000002"), venue.id, {})).status).toBe(403);
    expect((await patch(await byPhone("+251911000005"), venue.id, {})).status).toBe(404);
  });

  it("cannot be used to change verification", async () => {
    const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Lideta Corner Café" } });
    await db.venue.update({ where: { id: venue.id }, data: { verification: "PENDING" } });
    await patch(await byPhone("+251911000006"), venue.id, { verification: "VERIFIED" });
    const after = await db.venue.findUniqueOrThrow({ where: { id: venue.id } });
    expect(after.verification).toBe("PENDING");
  });

  it("shows a venue to its members only", async () => {
    const venue = await hiwot();
    expect((await get(await byPhone("+251911000003"), venue.id)).status).toBe(200);
    expect((await get(await byPhone("+251911000005"), venue.id)).status).toBe(404);
  });
});
