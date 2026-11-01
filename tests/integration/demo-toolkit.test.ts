import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as personaRoute } from "@/app/api/demo/persona/route";
import { POST as resetRoute } from "@/app/api/demo/reset/route";
import { GET as statusRoute } from "@/app/api/demo/status/route";
import { POST as unlockRoute } from "@/app/api/demo/unlock/route";
import { DAY_MS, clockOffsetMs, loadClockOffset, setClockOffset } from "@/server/clock";
import { db } from "@/server/db";
import { resetRateLimits } from "@/server/rate-limit";
import { verifySessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const BASE = "http://localhost:3000";
const post = (path: string, body?: unknown, cookie?: string) =>
  new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const asPersona = (persona: string, cookie?: string) =>
  personaRoute(post("/api/demo/persona", { persona }, cookie), undefined);
const reset = () => resetRoute(post("/api/demo/reset"), undefined);
const status = () => statusRoute(new Request(`${BASE}/api/demo/status`), undefined);

describe("demo toolkit", () => {
  beforeEach(async () => {
    await resetDb();
    await loadClockOffset();
    resetRateLimits();
  });
  afterEach(() => {
    process.env.DEMO_MODE = "1";
    delete process.env.DEMO_TOOLKIT_PASSCODE;
  });

  it.each([
    ["selam", "/employer"],
    ["yared", "/employer"],
    ["rahel", "/employer"],
    ["dawit", "/jobs"],
    ["moderator", "/admin/queue"],
    ["bruk", "/employer/onboarding/venue"],
  ])("%s lands on %s with a valid session", async (persona, path) => {
    const res = await asPersona(persona);
    expect(res.status).toBe(200);
    expect((await res.json()).redirectTo).toBe(path);
    const token = /sv_session=([^;]+)/.exec(res.headers.get("set-cookie")!)![1];
    expect(await verifySessionToken(token)).not.toBeNull();
  });

  it("creates Bruk once, and Reset removes him", async () => {
    await asPersona("bruk");
    await asPersona("bruk");
    const phone = "+251911000011";
    expect(await db.user.count({ where: { phone } })).toBe(1);
    await reset();
    expect(await db.user.count({ where: { phone } })).toBe(0);
  });

  it("rejects an unknown persona", async () => {
    expect((await asPersona("root")).status).toBe(400);
  });

  it("resets data, clock, uploads and sessions within 10 s", async () => {
    await db.venue.updateMany({ data: { nameEn: "Changed" } });
    await setClockOffset(14 * DAY_MS);
    mkdirSync("data/test-uploads", { recursive: true });
    writeFileSync("data/test-uploads/license.pdf", "x");

    const res = await reset();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirectTo).toBe("/");
    expect(body.tookMs).toBeLessThan(10_000);
    expect(await db.venue.count({ where: { nameEn: "Changed" } })).toBe(0);
    expect(clockOffsetMs()).toBe(0);
    expect(existsSync("data/test-uploads/license.pdf")).toBe(false);
    expect(res.headers.getSetCookie().join("\n")).toMatch(/sv_session=;.*Max-Age=0/i);
  });

  it("does not exist outside demo mode, even if the proxy is bypassed", async () => {
    process.env.DEMO_MODE = "0";
    expect((await asPersona("selam")).status).toBe(404);
    expect((await reset()).status).toBe(404);
    expect((await status()).status).toBe(404);
  });

  it("requires the passcode when one is set (public tunnel)", async () => {
    process.env.DEMO_TOOLKIT_PASSCODE = "482913";
    expect((await (await status()).json()).locked).toBe(true);
    expect((await asPersona("moderator")).status).toBe(403);
    expect((await reset()).status).toBe(403);

    const wrong = await unlockRoute(post("/api/demo/unlock", { passcode: "000000" }), undefined);
    expect(wrong.status).toBe(403);
    const right = await unlockRoute(post("/api/demo/unlock", { passcode: "482913" }), undefined);
    expect(right.status).toBe(200);
    const cookie = right.headers.get("set-cookie")!.split(";")[0];
    expect((await asPersona("moderator", cookie)).status).toBe(200);
  });

  it("refuses to unlock when no passcode is configured", async () => {
    const res = await unlockRoute(post("/api/demo/unlock", { passcode: "1" }), undefined);
    expect(res.status).toBe(403);
  });
});
