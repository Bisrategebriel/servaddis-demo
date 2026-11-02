import { beforeEach, describe, expect, it } from "vitest";
import { GET as taxonomy } from "@/app/api/taxonomy/route";
import { parseRoleTemplateDefaults, prefillFromTemplate } from "@/lib/role-template";
import { db } from "@/server/db";
import { resetDb } from "./helpers";

const ETHIOPIC = /[ሀ-፿]/;

describe("role templates", () => {
  beforeEach(resetDb);

  it("seeds the 12 roles of doc 05 §9.2, in order", async () => {
    const rows = await db.roleTemplate.findMany({ orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => r.slug)).toEqual([
      "waiter",
      "barista",
      "bartender",
      "host-cashier",
      "front-desk",
      "housekeeper",
      "line-cook",
      "chef-de-partie",
      "kitchen-steward",
      "spa-therapist",
      "tour-guide",
      "hospitality-manager",
    ]);
  });

  it("fills every composer field in English and Amharic, for each template", async () => {
    const rows = await db.roleTemplate.findMany();
    const skills = new Set((await db.skill.findMany()).map((s) => s.slug));
    for (const r of rows) {
      const f = prefillFromTemplate(r);
      const label = r.slug;
      expect(f.titleEn, label).toBe(r.nameEn);
      expect(f.titleAm, label).toMatch(ETHIOPIC);
      expect(f.descriptionEn.length, label).toBeGreaterThan(20);
      expect(f.descriptionAm, label).toMatch(ETHIOPIC);
      expect(f.requirementsEn.length, label).toBeGreaterThanOrEqual(3);
      expect(f.requirementsAm, label).toHaveLength(f.requirementsEn.length);
      expect(
        f.requirementsAm.every((x) => ETHIOPIC.test(x)),
        label,
      ).toBe(true);
      expect(f.benefitsEn.length, label).toBeGreaterThanOrEqual(2);
      expect(f.benefitsAm, label).toHaveLength(f.benefitsEn.length);
      expect(
        f.benefitsAm.every((x) => ETHIOPIC.test(x)),
        label,
      ).toBe(true);
      expect(f.salaryMax, label).toBeGreaterThan(f.salaryMin);
      expect(f.shiftPattern, label).toBeTruthy();
      expect(f.roleTemplateSlug, label).toBe(r.slug);
      for (const s of parseRoleTemplateDefaults(r.defaults).skillSlugs) {
        expect(skills.has(s), `${label}: unknown skill ${s}`).toBe(true);
      }
    }
  });

  it("matches the salary hints in doc 05 §9.2", async () => {
    const barista = await db.roleTemplate.findUniqueOrThrow({ where: { slug: "barista" } });
    expect(prefillFromTemplate(barista)).toMatchObject({ salaryMin: 5000, salaryMax: 9000 });
  });
});

describe("GET /api/taxonomy", () => {
  beforeEach(resetDb);

  it("is public, cacheable, and limited to launch cities", async () => {
    const res = await taxonomy(new Request("http://localhost:3000/api/taxonomy"), undefined);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    const body = await res.json();
    expect(body.cities.map((c: { slug: string }) => c.slug)).toEqual(["addis-ababa"]);
    expect(body.cities[0].subCities).toHaveLength(11);
    expect(body.roleTemplates).toHaveLength(12);
    expect(body.roleTemplates[0].defaults.salaryHint).toBeDefined();
    expect(body.skills.length).toBeGreaterThanOrEqual(30);
  });
});
