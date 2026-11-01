import { describe, expect, it } from "vitest";
import { createRng } from "../../prisma/seed/prng";

describe("seed PRNG", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng("servaddis-demo-1");
    const b = createRng("servaddis-demo-1");
    expect(Array.from({ length: 5 }, a.next)).toEqual(Array.from({ length: 5 }, b.next));
  });

  it("differs for different seeds", () => {
    expect(createRng("a").next()).not.toBe(createRng("b").next());
  });

  it("keeps int() within bounds and sample() distinct", () => {
    const r = createRng("bounds");
    for (let i = 0; i < 200; i++) {
      const n = r.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
    const s = r.sample([1, 2, 3, 4, 5], 3);
    expect(new Set(s).size).toBe(3);
  });
});
