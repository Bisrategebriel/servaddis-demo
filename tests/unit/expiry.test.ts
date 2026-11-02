import { describe, expect, it } from "vitest";
import { computeExpiresAt, endOfEatDay } from "@/lib/expiry";

// Times are written in UTC; EAT is UTC+3.
const at = (iso: string) => new Date(iso);

describe("computeExpiresAt (doc 05 §6.4)", () => {
  const noonEat = at("2026-11-02T09:00:00Z"); // 12:00 EAT, 2 Nov

  it.each([
    ["NORMAL", "2026-12-02T09:00:00.000Z"], // +30 days
    ["HALF_DAY", "2026-11-02T21:00:00.000Z"], // +12 h
    ["SAME_DAY", "2026-11-02T20:59:59.999Z"], // 23:59:59.999 EAT, 2 Nov
    ["NEXT_DAY", "2026-11-03T20:59:59.999Z"],
    ["TWO_DAYS", "2026-11-04T20:59:59.999Z"],
  ] as const)("%s from noon EAT", (urgency, expected) => {
    expect(computeExpiresAt(urgency, noonEat).toISOString()).toBe(expected);
  });

  it("uses the EAT day, not the UTC day, just after midnight in Addis", () => {
    // 00:30 EAT on 3 Nov is still 2 Nov in UTC
    const justAfterMidnight = at("2026-11-02T21:30:00Z");
    expect(computeExpiresAt("SAME_DAY", justAfterMidnight).toISOString()).toBe(
      "2026-11-03T20:59:59.999Z",
    );
  });

  it("uses the EAT day late in the evening", () => {
    // 23:30 EAT on 2 Nov
    const lateEvening = at("2026-11-02T20:30:00Z");
    expect(computeExpiresAt("SAME_DAY", lateEvening).toISOString()).toBe(
      "2026-11-02T20:59:59.999Z",
    );
    expect(computeExpiresAt("NEXT_DAY", lateEvening).toISOString()).toBe(
      "2026-11-03T20:59:59.999Z",
    );
  });

  it("crosses month and year ends", () => {
    expect(endOfEatDay(at("2026-12-31T12:00:00Z"), 1).toISOString()).toBe(
      "2027-01-01T20:59:59.999Z",
    );
  });
});
