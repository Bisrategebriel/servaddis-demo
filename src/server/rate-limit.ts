import "server-only";

// In-memory token buckets (TRD §3: single instance, no Redis). Uses real time, not the demo
// clock: abuse protection must not be skippable with the toolkit.

type Bucket = { tokens: number; updatedAt: number };
export type BucketRule = { capacity: number; refillEveryMs: number };

const store = globalThis as unknown as { svRateBuckets?: Map<string, Bucket> };
const buckets = () => (store.svRateBuckets ??= new Map());

/** Takes one token. Returns 0 when allowed, otherwise the seconds until the next token. */
export function take(key: string, rule: BucketRule, nowMs = Date.now()): number {
  const map = buckets();
  const b = map.get(key) ?? { tokens: rule.capacity, updatedAt: nowMs };
  const refilled = Math.floor((nowMs - b.updatedAt) / rule.refillEveryMs);
  if (refilled > 0) {
    b.tokens = Math.min(rule.capacity, b.tokens + refilled);
    b.updatedAt += refilled * rule.refillEveryMs;
  }
  if (b.tokens >= rule.capacity) b.updatedAt = nowMs;
  map.set(key, b);
  if (b.tokens <= 0) return Math.ceil((b.updatedAt + rule.refillEveryMs - nowMs) / 1000);
  b.tokens -= 1;
  return 0;
}

export function resetRateLimits() {
  buckets().clear();
}

export const RATE_RULES = {
  otpRequestPerPhone: { capacity: 5, refillEveryMs: 2 * 60_000 },
  otpRequestPerIp: { capacity: 20, refillEveryMs: 30_000 },
  otpVerifyPerIp: { capacity: 30, refillEveryMs: 10_000 },
  demoUnlockPerIp: { capacity: 10, refillEveryMs: 30_000 },
} satisfies Record<string, BucketRule>;

/** Client IP for rate limiting: first X-Forwarded-For hop (tunnel/proxy), else "local". */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
