import { describe, expect, it } from "vitest";
import { hasBlock, normalise, runRules, type RuleInput } from "@/server/rules/engine";

const clean: RuleInput = {
  titleEn: "Barista",
  titleAm: "ባሪስታ",
  descriptionEn: "Prepare espresso drinks for our guests.",
  descriptionAm: "ለእንግዶቻችን የኤስፕሬሶ መጠጦችን ያዘጋጃሉ።",
  requirementsEn: "1 year of experience",
  requirementsAm: "የ1 ዓመት ልምድ",
  benefitsEn: "Meals on shift",
  benefitsAm: "በሥራ ሰዓት ምግብ",
  shiftPattern: "6 days/week",
  salaryMin: 5000,
  salaryMax: 9000,
};
const barista = { family: "FRONT_OF_HOUSE", salaryHint: { min: 5000, max: 9000 } };
const ids = (input: Partial<RuleInput>, template = barista) =>
  runRules({ ...clean, ...input }, template).map((f) => `${f.ruleId}:${f.field}`);

describe("rules engine", () => {
  it("passes a clean job", () => {
    expect(runRules(clean, barista)).toEqual([]);
  });

  describe("no-fee (block)", () => {
    it("blocks the demo script's sentence and quotes it as written", () => {
      const flags = runRules(
        { ...clean, descriptionEn: "Great team. Registration  Fee ETB 200 on day one." },
        barista,
      );
      expect(hasBlock(flags)).toBe(true);
      expect(flags[0]).toMatchObject({
        ruleId: "no-fee",
        severity: "block",
        field: "descriptionEn",
        match: "Registration  Fee",
      });
      expect(flags[0].messageAm).toMatch(/[ሀ-፿]/);
    });

    it.each([
      ["send money", "requirementsEn", "Send money to confirm your place"],
      ["pay to apply", "benefitsEn", "PAY TO APPLY"],
      ["deposit", "descriptionEn", "A small deposit is required"],
      ["Amharic: ክፍያ ይላኩ", "descriptionAm", "ለመመዝገብ ክፍያ ይላኩ።"],
      ["Amharic: የምዝገባ ክፍያ", "requirementsAm", "የምዝገባ ክፍያ 200 ብር"],
      ["Amharic with a line break", "descriptionAm", "ቅድሚያ\nክፍያ ያስፈልጋል"],
    ])("blocks %s", (_label, field, text) => {
      expect(ids({ [field]: text })).toContain(`no-fee:${field}`);
    });

    it("matches whole English words only", () => {
      expect(ids({ descriptionEn: "Our depositor-friendly bank partner" })).toEqual([]);
    });

    it("flags each field once, not every pattern in it", () => {
      const flags = runRules({ ...clean, descriptionEn: "deposit and registration fee" }, barista);
      expect(flags.filter((f) => f.ruleId === "no-fee")).toHaveLength(1);
    });
  });

  describe("Amharic homophones", () => {
    it("folds interchangeable letters, keeping the length", () => {
      expect(normalise("ሠራተኛ")).toBe(normalise("ሰራተኛ"));
      expect(normalise("ሐረግ")).toBe(normalise("ሀረግ"));
      expect(normalise("ዐመት")).toBe(normalise("አመት"));
      expect(normalise("ፀሐይ")).toBe(normalise("ጸሀይ"));
      expect(normalise("ሠራተኛ ሐረግ").length).toBe("ሠራተኛ ሐረግ".length);
    });

    it("catches a blocked phrase written with a homophone letter", () => {
      // listed as "ወደ ውጭ አገር እንልካለን"; here አ is written as its twin ዐ
      const flags = runRules({ ...clean, descriptionAm: "ወደ ውጭ ዐገር እንልካለን!" }, barista);
      expect(flags).toEqual([
        expect.objectContaining({ ruleId: "blocked-keywords", match: "ወደ ውጭ ዐገር እንልካለን" }),
      ]);
    });
  });

  it("blocks listed scam and adult-service wording", () => {
    expect(ids({ titleEn: "Escort wanted" })).toContain("blocked-keywords:titleEn");
    expect(ids({ descriptionEn: "Guaranteed  visa for all" })).toContain(
      "blocked-keywords:descriptionEn",
    );
  });

  describe("salary", () => {
    it.each([
      [0, 9000],
      [9000, 5000],
    ])("blocks min %i / max %i", (salaryMin, salaryMax) => {
      expect(ids({ salaryMin, salaryMax })).toContain("salary-required:salary");
    });

    it("warns on an outlier, but not without a template", () => {
      expect(ids({ salaryMax: 27001 })).toEqual(["salary-outlier:salary"]);
      expect(ids({ salaryMin: 1000 })).toEqual(["salary-outlier:salary"]);
      expect(runRules({ ...clean, salaryMax: 99999 }, null)).toEqual([]);
    });
  });

  describe("off-platform contact (warn)", () => {
    it.each([
      ["+251 911223344", "+251 911223344"],
      ["0911223344", "0911223344"],
      ["0711223344", "0711223344"],
      ["t.me/hiwot_jobs", "t.me/"],
      ["hr@hiwot.example", "hr@hiwot.example"],
      ["Telegram @hiwothr", "@hiwothr"],
    ])("warns on %s", (text, match) => {
      const flags = runRules({ ...clean, descriptionEn: `Contact ${text} today` }, barista);
      expect(flags).toEqual([
        expect.objectContaining({ ruleId: "offplatform-contact", severity: "warn", match }),
      ]);
      expect(hasBlock(flags)).toBe(false);
    });

    it("ignores ordinary numbers and an @ inside an email-free sentence", () => {
      expect(ids({ descriptionEn: "Serve 120 guests at 5 tables, 6 days a week" })).toEqual([]);
    });
  });

  it("adds an info flag for sensitive families (spa)", () => {
    const flags = runRules(clean, { family: "SPA", salaryHint: { min: 6000, max: 12000 } });
    expect(flags).toEqual([
      expect.objectContaining({ ruleId: "sensitive-family", severity: "info" }),
    ]);
    expect(hasBlock(flags)).toBe(false);
  });
});
