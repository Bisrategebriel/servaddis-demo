import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getRoute, PATCH as patchRoute } from "@/app/api/me/profile/route";
import { completenessItems } from "@/lib/profile-completeness";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const headers = async (u: User) => ({
  cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
  "content-type": "application/json",
});
const get = async (u: User) =>
  getRoute(new Request(`${BASE}/api/me/profile`, { headers: await headers(u) }), {
    params: Promise.resolve({}),
  });
const patch = async (u: User, body: unknown) =>
  patchRoute(
    new Request(`${BASE}/api/me/profile`, {
      method: "PATCH",
      headers: await headers(u),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );

describe("/api/me/profile (J-05)", () => {
  beforeEach(resetDb);

  it("returns the seeded profile: Dawit at 85% with everything but a photo", async () => {
    const dawit = await db.user.findUniqueOrThrow({ where: { phone: "+251922000001" } });
    const res = await get(dawit);
    expect(res.status).toBe(200);
    const { profile } = await res.json();
    expect(profile).toMatchObject({ name: "Dawit Alemu", completeness: 85, photoUrl: null });
    expect(profile.skills.length).toBeGreaterThanOrEqual(3);
    expect(profile.preferredSubCities.length).toBeGreaterThan(0);
    const missing = completenessItems({
      photoUrl: profile.photoUrl,
      headline: profile.headline,
      skillCount: profile.skills.length,
      experienceYears: profile.experienceYears,
      languageCount: profile.languages.length,
      previousWorkplaceCount: profile.previousWorkplaces.length,
      availability: profile.availability,
      preferredSubCityCount: profile.preferredSubCities.length,
    }).filter((i) => !i.done);
    expect(missing.map((i) => i.key)).toEqual(["photo"]);
  });

  it("lets a new jobseeker set the basics, creating the profile and its completeness", async () => {
    const fresh = await db.user.create({
      data: { phone: "+251922000777", name: "", platformRole: "JOBSEEKER", locale: "EN" },
    });
    expect((await (await get(fresh)).json()).profile.completeness).toBe(0);
    const res = await patch(fresh, {
      name: "Lily Mesfin",
      headline: "Waitress, quick learner",
      experienceYears: 1,
      availability: "Weekends",
    });
    expect(res.status).toBe(200);
    const { profile } = await res.json();
    expect(profile).toMatchObject({ name: "Lily Mesfin", completeness: 35 }); // 10 + 15 + 10
    const row = await db.jobseekerProfile.findUniqueOrThrow({ where: { userId: fresh.id } });
    expect(row.completeness).toBe(35);
  });

  it("recomputes completeness when an item is cleared", async () => {
    const dawit = await db.user.findUniqueOrThrow({ where: { phone: "+251922000001" } });
    // headline and availability left out, so both are cleared
    const res = await patch(dawit, { name: "Dawit Alemu", experienceYears: 3 });
    const { profile } = await res.json();
    expect(profile.completeness).toBe(65);
  });

  it("validates the input and is for jobseekers only", async () => {
    const dawit = await db.user.findUniqueOrThrow({ where: { phone: "+251922000001" } });
    expect((await patch(dawit, { name: "D", experienceYears: 3 })).status).toBe(400);
    expect((await patch(dawit, { name: "Dawit", experienceYears: 99 })).status).toBe(400);
    const selam = await db.user.findUniqueOrThrow({ where: { phone: "+251911000001" } });
    expect((await get(selam)).status).toBe(403);
  });
});
