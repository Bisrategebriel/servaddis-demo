import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { PlatformRole, Prisma, User } from "@prisma/client";
import { MINUTE_MS, now } from "../clock";
import { db } from "../db";
import { AppError, unauthorized } from "../http/errors";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "../session";
import { sms } from "./notifications";

// Phone + OTP sign-in (TRD §5.1, App Flow §2).
// Lockout: on the 5th wrong code the Otp row's expiresAt is moved to "now + 10 min" and read as
// "locked until" (attempts ≥ MAX_ATTEMPTS). The schema has no lock column, and this keeps the
// whole lifecycle on one row.

export const OTP_TTL_MS = 5 * MINUTE_MS;
export const OTP_RESEND_SECONDS = 30;
export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 10 * MINUTE_MS;

const demoMode = () => process.env.DEMO_MODE === "1";

function hashCode(phone: string, code: string): string {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret) throw new Error("OTP_HMAC_SECRET must be set (see .env.example)");
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

function sameHash(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

function lockedError(until: Date) {
  const retryAfterSec = Math.max(1, Math.ceil((until.getTime() - now().getTime()) / 1000));
  return new AppError("RATE_LIMITED", {
    message: "Too many wrong codes. Try again in 10 minutes.",
    messageAm: "በጣም ብዙ የተሳሳቱ ኮዶች። ከ10 ደቂቃ በኋላ እንደገና ይሞክሩ።",
    details: { reason: "LOCKED", retryAfterSec },
    headers: { "Retry-After": String(retryAfterSec) },
  });
}

async function activeLock(phone: string) {
  return db.otp.findFirst({
    where: { phone, attempts: { gte: MAX_ATTEMPTS }, expiresAt: { gt: now() } },
    orderBy: { expiresAt: "desc" },
  });
}

export async function requestOtp(phone: string): Promise<{ resendInSec: number }> {
  const lock = await activeLock(phone);
  if (lock) throw lockedError(lock.expiresAt);

  const last = await db.otp.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  const sinceLast = last ? (now().getTime() - last.createdAt.getTime()) / 1000 : Infinity;
  if (sinceLast < OTP_RESEND_SECONDS) {
    const retryAfterSec = Math.ceil(OTP_RESEND_SECONDS - sinceLast);
    throw new AppError("RATE_LIMITED", {
      message: `Wait ${retryAfterSec} seconds before asking for a new code.`,
      messageAm: `አዲስ ኮድ ከመጠየቅዎ በፊት ${retryAfterSec} ሰከንድ ይጠብቁ።`,
      details: { reason: "RESEND_COOLDOWN", retryAfterSec },
      headers: { "Retry-After": String(retryAfterSec) },
    });
  }

  // Demo mode uses the fixed code but still writes the row and enforces lockout (doc 05 §3).
  const code = demoMode()
    ? (process.env.DEMO_OTP ?? "123456")
    : String(randomInt(0, 1_000_000)).padStart(6, "0");
  const at = now();
  await db.$transaction(async (tx) => {
    await tx.otp.create({
      data: {
        phone,
        codeHash: hashCode(phone, code),
        expiresAt: new Date(at.getTime() + OTP_TTL_MS),
        createdAt: at,
      },
    });
    await sms(
      tx,
      phone,
      `የServaddis ኮድዎ ${code} ነው። በ5 ደቂቃ ውስጥ ጊዜው ያልፋል።\nYour Servaddis code is ${code}. It expires in 5 minutes.`,
      "OTP",
    );
  });
  return { resendInSec: OTP_RESEND_SECONDS };
}

export type SignUpIntent = "EMPLOYER" | "JOBSEEKER";

export async function verifyOtp(
  phone: string,
  code: string,
  intent?: SignUpIntent,
): Promise<{ user: User; isNew: boolean; redirectTo: string }> {
  const lock = await activeLock(phone);
  if (lock) throw lockedError(lock.expiresAt);

  const otp = await db.otp.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt <= now()) {
    throw new AppError("BAD_REQUEST", {
      message: "This code has expired. Ask for a new one.",
      messageAm: "ይህ ኮድ ጊዜው አልፏል። አዲስ ኮድ ይጠይቁ።",
      details: { reason: "EXPIRED" },
    });
  }

  if (!sameHash(otp.codeHash, hashCode(phone, code))) {
    const attempts = otp.attempts + 1;
    const locking = attempts >= MAX_ATTEMPTS;
    const lockedUntil = new Date(now().getTime() + LOCK_MS);
    await db.otp.update({
      where: { id: otp.id },
      data: { attempts, ...(locking ? { expiresAt: lockedUntil } : {}) },
    });
    if (locking) throw lockedError(lockedUntil);
    const left = MAX_ATTEMPTS - attempts;
    throw new AppError("BAD_REQUEST", {
      message: `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`,
      messageAm: `ኮዱ ትክክል አይደለም። ${left} ሙከራ ቀርቷል።`,
      details: { reason: "WRONG_CODE", attemptsLeft: left },
    });
  }

  const existing = await db.user.findUnique({ where: { phone } });
  const invited = await db.venueMember.findFirst({
    where: { invitedPhone: phone, status: "INVITED", userId: null },
  });
  // New users say whether they are hiring or looking (landing choice). Invited staff are employers.
  // The code stays unconsumed so the client can resend it with the intent.
  if (!existing && !intent && !invited) {
    throw new AppError("BAD_REQUEST", {
      message: "Tell us whether you're hiring or looking for work.",
      messageAm: "ሠራተኛ እየፈለጉ ወይም ሥራ እየፈለጉ መሆኑን ይንገሩን።",
      details: { reason: "INTENT_REQUIRED", needsIntent: true },
    });
  }

  const at = now();
  const user = await db.$transaction(async (tx) => {
    await tx.otp.update({ where: { id: otp.id }, data: { consumedAt: at } });
    const u = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { lastLoginAt: at } })
      : await tx.user.create({
          data: {
            phone,
            name: "",
            platformRole: invited ? "EMPLOYER" : intent!,
            locale: "AM",
            createdAt: at,
            lastLoginAt: at,
          },
        });
    if (u.platformRole === "EMPLOYER") await linkInvites(tx, u.id, phone);
    return u;
  });

  return { user, isNew: !existing, redirectTo: await homePathFor(user.id, user.platformRole) };
}

/** Invited staff: first sign-in with the invited phone activates the membership (App Flow §2). */
async function linkInvites(tx: Prisma.TransactionClient, userId: string, phone: string) {
  const invites = await tx.venueMember.findMany({
    where: { invitedPhone: phone, status: "INVITED", userId: null },
  });
  for (const inv of invites) {
    const already = await tx.venueMember.findFirst({ where: { venueId: inv.venueId, userId } });
    if (already) continue;
    await tx.venueMember.update({ where: { id: inv.id }, data: { userId, status: "ACTIVE" } });
  }
}

/** Where a role lands after sign-in (App Flow §2). */
export async function homePathFor(userId: string, role: PlatformRole): Promise<string> {
  if (role === "ADMIN") return "/admin/queue";
  if (role === "JOBSEEKER") return "/jobs";
  const membership = await db.venueMember.findFirst({ where: { userId, status: "ACTIVE" } });
  return membership ? "/employer" : "/employer/onboarding/venue";
}

/** The user fields any client may see about themselves. */
export function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    platformRole: u.platformRole,
    locale: u.locale,
    faydaVerified: u.faydaVerified,
  };
}

/**
 * The signed-in user, checked against the database. Throws 401 when the cookie is missing,
 * invalid or points at a user that no longer exists (e.g. after a demo reset).
 */
export async function requireUser(req: Request): Promise<User> {
  const claims = await verifySessionToken(readCookie(req, SESSION_COOKIE));
  if (!claims) throw unauthorized();
  const user = await db.user.findUnique({ where: { id: claims.userId } });
  if (!user || user.platformRole !== claims.role) throw unauthorized();
  return user;
}
