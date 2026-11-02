import { describe, expect, it } from "vitest";
import { caption, hashtags, type CaptionJob } from "@/lib/captions";

const job: CaptionJob = {
  titleEn: "Waiter / Waitress",
  titleAm: "አስተናጋጅ",
  venueEn: "Hiwot Garden Hotel",
  venueAm: "ሕይወት ጋርደን ሆቴል",
  subCityEn: "Kirkos",
  subCityAm: "ቂርቆስ",
  salaryMin: 4000,
  salaryMax: 8000,
  salaryPeriod: "MONTH",
  employmentType: "FULL_TIME",
  urgent: true,
  verified: true,
  url: "https://example.test/jobs/abc",
};

describe("captions (TRD §5.6: templates, not an LLM)", () => {
  it("is deterministic and bilingual", () => {
    expect(caption(job, "en", "TELEGRAM")).toBe(caption(job, "en", "TELEGRAM"));
    expect(caption(job, "en", "TELEGRAM")).toBe(
      [
        "📣 Now hiring: Waiter / Waitress",
        "🏨 Hiwot Garden Hotel · Kirkos",
        "💰 ETB 4,000–8,000 / month · Full-time",
        "⚡ Urgent hire",
        "✅ Verified venue · Free to apply",
        "👉 Apply on Servaddis: https://example.test/jobs/abc",
        "",
        "#ServaddisJobs #AddisJobs #ሥራ #Waiter",
      ].join("\n"),
    );
    const am = caption(job, "am", "TELEGRAM");
    expect(am).toContain("አስተናጋጅ");
    expect(am).toContain("ሕይወት ጋርደን ሆቴል · ቂርቆስ");
    expect(am).toContain("https://example.test/jobs/abc");
  });

  it("uses 'link in bio' where links aren't clickable", () => {
    for (const ch of ["INSTAGRAM", "TIKTOK"] as const) {
      expect(caption(job, "en", ch)).toContain("link in bio");
      expect(caption(job, "en", ch)).not.toContain("https://");
    }
    expect(caption(job, "en", "FACEBOOK")).toContain("https://example.test/jobs/abc");
  });

  it("leaves out the urgent and verified lines when they don't apply", () => {
    const plain = caption({ ...job, urgent: false, verified: false }, "en", "FACEBOOK");
    expect(plain).not.toContain("Urgent");
    expect(plain).toContain("✅ Free to apply");
  });

  it("falls back to English text when Amharic is missing", () => {
    expect(caption({ ...job, titleAm: null, venueAm: null }, "am", "FACEBOOK")).toContain(
      "Waiter / Waitress",
    );
  });

  it("builds a role hashtag from the English title", () => {
    expect(hashtags({ titleEn: "Chef de Partie" })).toContain("#ChefdePartie");
  });
});
