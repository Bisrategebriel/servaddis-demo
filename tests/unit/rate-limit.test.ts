import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, resetRateLimits, take } from "@/server/rate-limit";

const rule = { capacity: 3, refillEveryMs: 10_000 };

describe("token bucket", () => {
  beforeEach(resetRateLimits);

  it("allows up to capacity, then reports the wait", () => {
    const t = 1_000_000;
    expect([take("k", rule, t), take("k", rule, t), take("k", rule, t)]).toEqual([0, 0, 0]);
    expect(take("k", rule, t)).toBe(10);
    expect(take("k", rule, t + 4_000)).toBe(6);
  });

  it("refills one token per interval, never above capacity", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) take("k", rule, t);
    expect(take("k", rule, t + 10_000)).toBe(0);
    expect(take("k", rule, t + 10_000)).toBeGreaterThan(0);
    // a long pause refills to capacity, not beyond
    const later = t + 10 * 60_000;
    expect([take("k", rule, later), take("k", rule, later), take("k", rule, later)]).toEqual([
      0, 0, 0,
    ]);
    expect(take("k", rule, later)).toBeGreaterThan(0);
  });

  it("keeps keys independent", () => {
    for (let i = 0; i < 3; i++) take("a", rule, 0);
    expect(take("a", rule, 0)).toBeGreaterThan(0);
    expect(take("b", rule, 0)).toBe(0);
  });

  it("uses the first X-Forwarded-For hop as the client IP", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "41.1.2.3, 10.0.0.1" } });
    expect(clientIp(req)).toBe("41.1.2.3");
    expect(clientIp(new Request("http://x/"))).toBe("local");
  });
});
