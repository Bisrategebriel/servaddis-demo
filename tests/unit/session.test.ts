import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  isSecureRequest,
  readCookie,
  sessionCookie,
  signSessionToken,
  verifySessionToken,
} from "@/server/session";

describe("session token", () => {
  it("round-trips user id and role", async () => {
    const token = await signSessionToken({ userId: "u1", role: "EMPLOYER" });
    expect(await verifySessionToken(token)).toEqual({ userId: "u1", role: "EMPLOYER" });
  });

  it("rejects missing, tampered and foreign tokens", async () => {
    const token = await signSessionToken({ userId: "u1", role: "JOBSEEKER" });
    const [h, p, s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "u1", role: "ADMIN" })).toString("base64url");
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
    expect(await verifySessionToken(`${h}.${forged}.${s}`)).toBeNull();
    expect(await verifySessionToken(`${h}.${p}.${s.slice(0, -2)}xx`)).toBeNull();
    const other = await new SignJWT({ role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-completely-different-secret-value-123456"));
    expect(await verifySessionToken(other)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ role: "EMPLOYER" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    expect(await verifySessionToken(expired)).toBeNull();
  });
});

describe("cookies", () => {
  it("reads a cookie from the Cookie header", () => {
    const req = new Request("http://x/", { headers: { cookie: "a=1; sv_session=abc%3D; b=2" } });
    expect(readCookie(req, "sv_session")).toBe("abc=");
    expect(readCookie(req, "missing")).toBeUndefined();
  });

  it("is Secure only over HTTPS (LAN phone uses plain http)", () => {
    expect(isSecureRequest(new Request("http://192.168.1.20:3000/"))).toBe(false);
    expect(isSecureRequest(new Request("https://demo.example/"))).toBe(true);
    const tunnelled = new Request("http://localhost:3000/", {
      headers: { "x-forwarded-proto": "https" },
    });
    expect(isSecureRequest(tunnelled)).toBe(true);
  });

  it("sets httpOnly, SameSite=Lax, path / and a 12 h lifetime", () => {
    const c = sessionCookie(new Request("http://localhost:3000/"), "t");
    expect(c).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 43200 });
  });
});
