import { describe, expect, it } from "vitest";
import {
  COMPLETENESS_WEIGHTS,
  profileCompleteness,
  type CompletenessInput,
} from "@/lib/profile-completeness";

const empty: CompletenessInput = {
  skillCount: 0,
  experienceYears: 0,
  languageCount: 0,
  previousWorkplaceCount: 0,
  preferredSubCityCount: 0,
};

const full: CompletenessInput = {
  photoUrl: "/avatars/a1.svg",
  headline: "Barista",
  skillCount: 3,
  experienceYears: 5,
  languageCount: 2,
  previousWorkplaceCount: 1,
  availability: "Full-time",
  preferredSubCityCount: 1,
};

describe("profileCompleteness", () => {
  it("weights sum to 100", () => {
    expect(Object.values(COMPLETENESS_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("is 0 for an empty profile and 100 for a full one", () => {
    expect(profileCompleteness(empty)).toBe(0);
    expect(profileCompleteness(full)).toBe(100);
  });

  it("needs at least 3 skills for the skills points", () => {
    expect(profileCompleteness({ ...empty, skillCount: 2 })).toBe(0);
    expect(profileCompleteness({ ...empty, skillCount: 3 })).toBe(20);
  });

  it("treats blank strings as missing", () => {
    expect(profileCompleteness({ ...full, headline: "  ", availability: "" })).toBe(80);
  });

  it("is 85 for a full profile without a photo (Dawit persona)", () => {
    expect(profileCompleteness({ ...full, photoUrl: null })).toBe(85);
  });
});
