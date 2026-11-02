import { beforeEach, describe, expect, it } from "vitest";
import { POST as setLocale } from "@/app/api/locale/route";
import { POST as requestOtp } from "@/app/api/auth/otp/request/route";
import { POST as verifyOtp } from "@/app/api/auth/otp/verify/route";
import { db } from "@/server/db";
import { resetRateLimits } from "@/server/rate-limit";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const post = (path: string, body: unknown, cookie?: string) =>
  new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

describe("language toggle API", () => {
  beforeEach(async () => {
    await resetDb();
    resetRateLimits();
  });

  it("stores the choice in a year-long cookie for anonymous visitors", async () => {
    const res = await setLocale(post("/api/locale", { locale: "en" }), undefined);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^sv_locale=en;/);
    expect(cookie).toMatch(/Max-Age=31536000/);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("also saves it on the signed-in user (persists across devices)", async () => {
    const dawit = await db.user.findUniqueOrThrow({ where: { phone: "+251922000001" } });
    expect(dawit.locale).toBe("AM");
    const session = `sv_session=${await signSessionToken({ userId: dawit.id, role: "JOBSEEKER" })}`;
    await setLocale(post("/api/locale", { locale: "en" }, session), undefined);
    expect((await db.user.findUniqueOrThrow({ where: { id: dawit.id } })).locale).toBe("EN");
  });

  it("rejects unsupported locales", async () => {
    expect((await setLocale(post("/api/locale", { locale: "fr" }), undefined)).status).toBe(400);
  });

  it("keeps the language chosen before registering on a new account", async () => {
    const phone = "+251911000011";
    await requestOtp(post("/api/auth/otp/request", { phone }), undefined);
    const res = await verifyOtp(
      post("/api/auth/otp/verify", { phone, code: "123456", intent: "EMPLOYER" }, "sv_locale=en"),
      undefined,
    );
    expect(res.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { phone } })).locale).toBe("EN");
    expect(res.headers.getSetCookie().join("\n")).toMatch(/sv_locale=en;/);
  });

  it("does not let the cookie override an existing user's saved language", async () => {
    const phone = "+251922000001"; // Dawit, AM
    await requestOtp(post("/api/auth/otp/request", { phone }), undefined);
    await verifyOtp(
      post("/api/auth/otp/verify", { phone, code: "123456" }, "sv_locale=en"),
      undefined,
    );
    expect((await db.user.findUniqueOrThrow({ where: { phone } })).locale).toBe("AM");
  });

  it("applies the user's saved language at sign-in", async () => {
    await requestOtp(post("/api/auth/otp/request", { phone: "+251922000001" }), undefined);
    const res = await verifyOtp(
      post("/api/auth/otp/verify", { phone: "+251922000001", code: "123456" }),
      undefined,
    );
    expect(res.headers.get("set-cookie")).toMatch(/sv_locale=am;/); // Dawit is AM
  });
});
