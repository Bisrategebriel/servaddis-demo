import { describe, expect, it } from "vitest";
import { formatMoney, formatSalary } from "@/lib/format";
import { TEMPLATE_SHIFT_PATTERNS, shiftPatternIn } from "@/lib/shift-patterns";
import { ROLE_TEMPLATES } from "../../prisma/seed/data/role-templates";

describe("Amharic formatting (T6.1)", () => {
  it("writes money as birr after the figure in Amharic, ETB before it in English", () => {
    expect(formatMoney(4025, "en")).toBe("ETB 4,025");
    expect(formatMoney(4025, "am")).toBe("4,025 ብር");
    expect(formatSalary(5000, 9000, "en")).toBe("ETB 5,000–9,000");
    expect(formatSalary(5000, 9000, "am")).toBe("5,000–9,000 ብር");
  });

  it("has Amharic for every role template's shift pattern", () => {
    const patterns = new Set(ROLE_TEMPLATES.map((t) => t.defaults.shiftPattern));
    for (const p of patterns) {
      expect(TEMPLATE_SHIFT_PATTERNS, p).toContain(p);
      expect(shiftPatternIn("am", p)).toMatch(/[ሀ-፿]/);
    }
  });

  it("leaves typed shift text and English alone", () => {
    expect(shiftPatternIn("am", "Weekends from 2 pm")).toBe("Weekends from 2 pm");
    expect(shiftPatternIn("en", "6 days/week")).toBe("6 days/week");
  });
});
