import { beforeEach, describe, expect, it } from "vitest";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as requestOtp } from "@/app/api/auth/otp/request/route";
import { POST as verifyOtp } from "@/app/api/auth/otp/verify/route";
import { GET as getMe, PATCH as patchMe } from "@/app/api/me/route";
import { MINUTE_MS, advanceClock, loadClockOffset } from "@/server/clock";
import { db } from "@/server/db";
import { resetRateLimits } from "@/server/rate-limit";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const SELAM = "+251911000001";
const DAWIT = "+251922000001";
const ADMIN = "+251911000009";
const BRUK = "+251911000011"; // not seeded: registers live

function req(path: string, init: { body?: unknown; headers?: Record<string, string> } = {}) {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const ctx = undefined as unknown;
const ask = (phone: string, headers?: Record<string, string>) =>
  requestOtp(req("/api/auth/otp/request", { body: { phone }, headers }), ctx);
const verify = (body: Record<string, string>, headers?: Record<string, string>) =>
  verifyOtp(req("/api/auth/otp/verify", { body, headers }), ctx);

/** Full sign-in; returns the Cookie header value for later requests. */
async function signIn(phone: string, intent?: string) {
  await ask(phone);
  const res = await verify({ phone, code: "123456", ...(intent ? { intent } : {}) });
  expect(res.status).toBe(200);
  const token = /sv_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1];
  return { cookie: `sv_session=${token}`, body: await res.json() };
}

describe("phone + OTP sign-in", () => {
  beforeEach(async () => {
    await resetDb();
    await loadClockOffset();
    resetRateLimits();
  });

  it("sends the demo code by simulated SMS and stores only a hash", async () => {
    const res = await ask("0911 000 001");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ resendInSec: 30, demoHint: true });
    const smsRow = await db.smsLog.findFirstOrThrow({ where: { toPhone: SELAM, kind: "OTP" } });
    expect(smsRow.body).toContain("123456");
    const otp = await db.otp.findFirstOrThrow({ where: { phone: SELAM } });
    expect(otp.codeHash).not.toContain("123456");
    expect(otp.codeHash).toHaveLength(64);
  });

  it("rejects an invalid phone number", async () => {
    const res = await ask("12345");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.details.issues[0].path).toBe("phone");
  });

  it("enforces a 30 s resend cooldown (on the demo clock)", async () => {
    await ask(SELAM);
    const again = await ask(SELAM);
    expect(again.status).toBe(429);
    expect((await again.json()).error.details.reason).toBe("RESEND_COOLDOWN");
    await advanceClock(31_000);
    expect((await ask(SELAM)).status).toBe(200);
  });

  it("signs in a seeded owner with a correct, httpOnly session cookie", async () => {
    await ask(SELAM);
    const res = await verify({ phone: SELAM, code: "123456" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ isNew: false, redirectTo: "/employer" });
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^sv_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=43200/);
    expect(cookie).not.toMatch(/Secure/i); // plain http (LAN)
    // the code is single-use
    expect((await verify({ phone: SELAM, code: "123456" })).status).toBe(400);
  });

  it("marks the cookie Secure behind HTTPS (Cloudflare tunnel)", async () => {
    await ask(DAWIT);
    const res = await verify({ phone: DAWIT, code: "123456" }, { "x-forwarded-proto": "https" });
    expect(res.headers.get("set-cookie")).toMatch(/Secure/i);
  });

  it("routes each role to its home (App Flow §2)", async () => {
    expect((await signIn(DAWIT)).body.redirectTo).toBe("/jobs");
    expect((await signIn(ADMIN)).body.redirectTo).toBe("/admin/queue");
    expect((await signIn(SELAM)).body.redirectTo).toBe("/employer");
  });

  it("locks the number for 10 minutes after 5 wrong codes", async () => {
    await ask(SELAM);
    for (let left = 4; left >= 1; left--) {
      const res = await verify({ phone: SELAM, code: "000000" });
      expect(res.status).toBe(400);
      expect((await res.json()).error.details.attemptsLeft).toBe(left);
    }
    const fifth = await verify({ phone: SELAM, code: "000000" });
    expect(fifth.status).toBe(429);
    expect((await fifth.json()).error.details.reason).toBe("LOCKED");
    expect(fifth.headers.get("retry-after")).toBe("600");

    // locked: even the right code and a fresh request are refused
    expect((await verify({ phone: SELAM, code: "123456" })).status).toBe(429);
    expect((await ask(SELAM)).status).toBe(429);

    await advanceClock(11 * MINUTE_MS);
    expect((await ask(SELAM)).status).toBe(200);
    expect((await verify({ phone: SELAM, code: "123456" })).status).toBe(200);
  });

  it("expires a code after 5 minutes", async () => {
    await ask(SELAM);
    await advanceClock(6 * MINUTE_MS);
    const res = await verify({ phone: SELAM, code: "123456" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details.reason).toBe("EXPIRED");
  });

  it("asks a new number whether they are hiring, then creates the account", async () => {
    await ask(BRUK);
    const first = await verify({ phone: BRUK, code: "123456" });
    expect(first.status).toBe(400);
    expect((await first.json()).error.details.needsIntent).toBe(true);
    expect(await db.user.findUnique({ where: { phone: BRUK } })).toBeNull();

    // same code still works once the intent is known
    const second = await verify({ phone: BRUK, code: "123456", intent: "EMPLOYER" });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      isNew: true,
      redirectTo: "/employer/onboarding/venue",
    });
    const bruk = await db.user.findUniqueOrThrow({ where: { phone: BRUK } });
    expect(bruk.platformRole).toBe("EMPLOYER");
  });

  it("activates an invited staff member on first sign-in", async () => {
    const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });
    const phone = "+251911000020";
    await db.venueMember.create({
      data: {
        venueId: venue.id,
        invitedPhone: phone,
        displayName: "Tsegaye",
        role: "SCREENER",
        status: "INVITED",
      },
    });
    const { body } = await signIn(phone); // no intent needed: the invite makes them an employer
    expect(body).toMatchObject({ isNew: true, redirectTo: "/employer" });
    const member = await db.venueMember.findFirstOrThrow({ where: { invitedPhone: phone } });
    expect(member.status).toBe("ACTIVE");
    expect(member.userId).toBe(body.user.id);
  });

  it("throttles OTP requests per IP", async () => {
    const headers = { "x-forwarded-for": "41.0.0.9" };
    for (let i = 0; i < 20; i++) {
      const phone = `+2519110001${String(i).padStart(2, "0")}`;
      expect((await ask(phone, headers)).status).toBe(200);
    }
    const res = await ask("+251911000199", headers);
    expect(res.status).toBe(429);
    expect((await res.json()).error.details.reason).toBe("THROTTLED");
  });
});

describe("/api/me and logout", () => {
  beforeEach(async () => {
    await resetDb();
    await loadClockOffset();
    resetRateLimits();
  });

  const me = (cookie?: string) =>
    getMe(new Request(`${BASE}/api/me`, { headers: cookie ? { cookie } : {} }), ctx);

  it("returns the user, memberships and unread count", async () => {
    const { cookie } = await signIn(SELAM);
    const res = await me(cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ phone: SELAM, platformRole: "EMPLOYER", locale: "EN" });
    expect(body.memberships).toEqual([
      expect.objectContaining({ venueNameEn: "Hiwot Garden Hotel", role: "OWNER" }),
    ]);
    expect(body.unreadCount).toBe(0);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("is 401 without a session, with a forged one, or after a reset", async () => {
    expect((await me()).status).toBe(401);
    expect((await me("sv_session=forged")).status).toBe(401);
    const { cookie } = await signIn(DAWIT);
    expect((await me(cookie)).status).toBe(200);
    await resetDb(); // reset recreates every user, which ends existing sessions
    expect((await me(cookie)).status).toBe(401);
  });

  it("updates the locale", async () => {
    const { cookie } = await signIn(DAWIT);
    const res = await patchMe(
      new Request(`${BASE}/api/me`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ locale: "EN" }),
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).user.locale).toBe("EN");
  });

  it("clears the cookie on logout", async () => {
    const res = await logout(req("/api/auth/logout"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/sv_session=;.*Max-Age=0/i);
  });
});
