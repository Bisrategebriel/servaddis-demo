import "server-only";
import { db } from "./db";

// The only source of time for services (doc 05 §8). now() = real time + demo offset.
// Prisma's @default(now()) uses real time, so services must pass timestamps from now() explicitly.

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const OFFSET_KEY = "clock_offset_ms";

// Kept on globalThis so instrumentation, route handlers and server components share one value.
const store = globalThis as unknown as { svClockOffsetMs?: number };

const demoMode = () => process.env.DEMO_MODE === "1";

export function now(): Date {
  return new Date(Date.now() + clockOffsetMs());
}

export function clockOffsetMs(): number {
  return demoMode() ? (store.svClockOffsetMs ?? 0) : 0;
}

/** Read the persisted offset (server start, after reset). Outside demo mode time is always real. */
export async function loadClockOffset(): Promise<number> {
  const row = await db.demoSetting.findUnique({ where: { key: OFFSET_KEY } });
  const parsed = Number(row?.value ?? 0);
  store.svClockOffsetMs = Number.isFinite(parsed) ? parsed : 0;
  return clockOffsetMs();
}

export async function setClockOffset(ms: number): Promise<number> {
  if (!demoMode()) throw new Error("The demo clock can only be changed when DEMO_MODE=1");
  const value = String(Math.trunc(ms));
  await db.demoSetting.upsert({
    where: { key: OFFSET_KEY },
    create: { key: OFFSET_KEY, value },
    update: { value },
  });
  store.svClockOffsetMs = Math.trunc(ms);
  return store.svClockOffsetMs;
}

/** Time-skip (+1, +3, +14, +30 days from the toolkit). Callers run sweep() afterwards. */
export function advanceClock(ms: number): Promise<number> {
  return setClockOffset(clockOffsetMs() + ms);
}
