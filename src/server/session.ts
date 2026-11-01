import "server-only";
import type { PlatformRole } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";

// Minimal session (TRD §5.1): after OTP, an HS256 JWT { sub, role } in an httpOnly cookie, 12 h.
// Proxy uses verifySessionToken for optimistic redirects; route handlers re-check the user in
// the database (auth.ts → requireUser), so a reset — which recreates every user — ends all sessions.

export const SESSION_COOKIE = "sv_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export type SessionClaims = { userId: string; role: PlatformRole };

const ROLES: readonly PlatformRole[] = ["EMPLOYER", "JOBSEEKER", "ADMIN"];

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters (see .env.example)");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  // Expiry uses real time on purpose: a demo time-skip must not log everyone out.
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Null for a missing, tampered, expired or malformed token. Never throws. */
export async function verifySessionToken(token?: string | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const role = payload.role as PlatformRole;
    if (typeof payload.sub !== "string" || !ROLES.includes(role)) return null;
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}

/** Reads one cookie from a raw Cookie header (route handlers get a plain Request). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Secure only over HTTPS. The phone joins the demo over plain http on the LAN (D-9), where a
 * Secure cookie would be dropped; the Cloudflare tunnel arrives with X-Forwarded-Proto: https.
 */
export function isSecureRequest(req: Request): boolean {
  return new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

export function sessionCookie(req: Request, token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearedSessionCookie(req: Request) {
  return { ...sessionCookie(req, ""), maxAge: 0 };
}
