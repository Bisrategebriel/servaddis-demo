import { describe, expect, it } from "vitest";
import { resolveEntitlement } from "@/lib/entitlement";

const standard = { plan: { maxLiveJobs: 3 } };
const pro = { plan: { maxLiveJobs: null } };

describe("resolveEntitlement (doc 03 §4.2 truth table)", () => {
  it.each([
    // [label, foundingPostsLeft, subscription, liveOrPending, pendingFounding, expected source]
    ["unlimited plan", 0, pro, 40, 0, "SUBSCRIPTION"],
    ["plan with room", 0, standard, 2, 0, "SUBSCRIPTION"],
    ["full plan, no founding posts", 0, standard, 3, 0, null],
    ["full plan falls back to founding", 2, standard, 3, 0, "FOUNDING_FREE"],
    ["no plan, founding posts left", 3, null, 0, 0, "FOUNDING_FREE"],
    ["no plan, last founding post", 1, null, 0, 0, "FOUNDING_FREE"],
    ["founding posts all pending", 2, null, 2, 2, null],
    ["no plan, no founding posts", 0, null, 0, 0, null],
  ] as const)(
    "%s",
    (_label, foundingPostsLeft, subscription, liveOrPending, pendingFounding, source) => {
      const result = resolveEntitlement({ foundingPostsLeft }, subscription, {
        liveOrPending,
        pendingFounding,
      });
      expect(result).toEqual({ source, requiresPayment: source === null });
    },
  );
});
