import { describe, expect, it } from "vitest";
import {
  emptyJobForm,
  firstInvalidStep,
  salaryLooksUnusual,
  toJobPayload,
  validateStep,
  type JobForm,
} from "@/lib/job-form";

const complete: JobForm = {
  ...emptyJobForm("bole"),
  titleEn: "Barista",
  descriptionEn: "Prepare espresso drinks.",
  salaryMin: "5000",
  salaryMax: "9000",
};

describe("validateStep", () => {
  it("needs a title and description in at least one language", () => {
    expect(validateStep(emptyJobForm("bole"), 0)).toEqual({ title: true, description: true });
    const amharicOnly = { ...emptyJobForm("bole"), titleAm: "ባሪስታ", descriptionAm: "ቡና" };
    expect(validateStep(amharicOnly, 0)).toEqual({});
  });

  it.each([
    ["empty", "", ""],
    ["zero", "0", "0"],
    ["max below min", "9000", "5000"],
    ["no max", "5000", ""],
  ])("makes the salary mandatory: %s", (_label, salaryMin, salaryMax) => {
    expect(validateStep({ ...complete, salaryMin, salaryMax }, 2).salary).toBe(true);
  });

  it("accepts a fixed salary and needs a headcount", () => {
    expect(validateStep({ ...complete, salaryMax: "5000" }, 2)).toEqual({});
    expect(validateStep({ ...complete, headcount: "0" }, 2).headcount).toBe(true);
    expect(validateStep({ ...complete, headcount: "" }, 2).headcount).toBe(true);
  });
});

describe("firstInvalidStep", () => {
  it("finds where the form is stuck, or null when it is complete", () => {
    expect(firstInvalidStep(emptyJobForm("bole"))).toBe(0);
    expect(firstInvalidStep({ ...complete, salaryMin: "" })).toBe(2);
    expect(firstInvalidStep(complete)).toBeNull();
  });
});

describe("salaryLooksUnusual", () => {
  const hint = { min: 5000, max: 9000 };
  const form = (salaryMin: string, salaryMax: string) => ({ ...complete, salaryMin, salaryMax });

  it("warns above 3× the hint max or below 0.3× the hint min", () => {
    expect(salaryLooksUnusual(form("5000", "27001"), hint)).toBe(true);
    expect(salaryLooksUnusual(form("1499", "9000"), hint)).toBe(true);
  });

  it("stays quiet inside the limits, without a hint, or on empty input", () => {
    expect(salaryLooksUnusual(form("1500", "27000"), hint)).toBe(false);
    expect(salaryLooksUnusual(form("1", "999999"), null)).toBe(false);
    expect(salaryLooksUnusual(form("", ""), hint)).toBe(false);
  });
});

describe("toJobPayload", () => {
  it("turns lines into trimmed lists and text into numbers", () => {
    const body = toJobPayload({
      ...complete,
      titleEn: "  Barista ",
      requirementsEn: " One \n\n  Two\n",
      headcount: "2",
    });
    expect(body.titleEn).toBe("Barista");
    expect(body.requirementsEn).toEqual(["One", "Two"]);
    expect(body).toMatchObject({ headcount: 2, salaryMin: 5000, salaryMax: 9000 });
  });

  it("keeps an incomplete draft saveable", () => {
    const body = toJobPayload(emptyJobForm("bole"));
    expect(body).toMatchObject({ titleEn: "", salaryMin: 0, salaryMax: 0, headcount: 1 });
  });
});
