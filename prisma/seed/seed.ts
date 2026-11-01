// Seed v1 (doc 05 §9.1–9.4). Idempotent: wipes every table and re-inserts, in one transaction.
// Shared by `pnpm seed` and the Demo Toolkit reset (T0.9), so it takes the client as a parameter
// and never imports `src/server/db` (which is server-only).
//
// Not here yet, added by the tasks that build their features (PLAN.md §9):
//   live feed jobs + pipeline applicants (§9.5) → T3.1 · 6-month history → T5.5
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { profileCompleteness } from "../../src/lib/profile-completeness";
import { ADDIS_SUB_CITIES, CITIES, type SubCitySlug } from "./data/geography";
import {
  ADMIN,
  JOBSEEKERS,
  VENUES,
  WORKPLACE_KINDS,
  jobseekerPhone,
  type JobseekerSeed,
} from "./data/people";
import { PLANS } from "./data/plans";
import { ROLE_TEMPLATES } from "./data/role-templates";
import { SKILLS } from "./data/skills";
import { createRng, type Rng } from "./prng";
import { PRNG_SEED, SEED_VERSION } from "./version";

type Tx = Prisma.TransactionClient;

const DAY = 24 * 60 * 60 * 1000;
const AVATAR_COUNT = 8; // public/avatars/a1…a8.svg (abstract, not real photos)
const AVAILABILITY = [
  "Full-time, any shift",
  "Full-time, day shifts",
  "Evenings and weekends",
  "Mornings only",
  "Weekends only",
];
const OROMO_SPEAKERS = new Set(["Lensa Tolera", "Chala Gemechu"]);

export type SeedSummary = Record<string, number> & { seedVersion: number };

export async function seed(db: PrismaClient, now = new Date()): Promise<SeedSummary> {
  const summary = await db.$transaction(
    async (tx) => {
      await clearAll(tx);
      const geo = await seedGeography(tx);
      const skillIds = await seedSkills(tx);
      await seedRoleTemplates(tx);
      const planIds = await seedPlans(tx);
      await tx.user.create({
        data: { ...ADMIN, platformRole: "ADMIN", locale: "EN", isDemoSeed: true },
      });
      await seedVenues(tx, geo, planIds, now);
      await seedJobseekers(tx, geo, skillIds);
      await seedPendingLicense(tx, now);
      await tx.demoSetting.createMany({
        data: [
          { key: "clock_offset_ms", value: "0" },
          { key: "seed_version", value: SEED_VERSION },
        ],
      });
      return summarise(tx);
    },
    { timeout: 60_000 },
  );
  copySampleLicense();
  return summary;
}

/** Delete every row, children before parents (doc 05 §9.6). */
export async function clearAll(tx: Tx) {
  await tx.applicationEvent.deleteMany();
  await tx.placementCheckin.deleteMany();
  await tx.moderationItem.deleteMany();
  await tx.report.deleteMany();
  await tx.application.deleteMany();
  await tx.distributionPost.deleteMany();
  await tx.payment.deleteMany();
  await tx.jobSkill.deleteMany();
  await tx.job.deleteMany();
  await tx.subscription.deleteMany();
  await tx.licenseDocument.deleteMany();
  await tx.venueMember.deleteMany();
  await tx.venue.deleteMany();
  await tx.profileSkill.deleteMany();
  await tx.jobseekerProfile.deleteMany();
  await tx.notification.deleteMany();
  await tx.auditLog.deleteMany();
  await tx.otp.deleteMany();
  await tx.smsLog.deleteMany();
  await tx.user.deleteMany();
  await tx.plan.deleteMany();
  await tx.roleTemplate.deleteMany();
  await tx.skill.deleteMany();
  await tx.subCity.deleteMany();
  await tx.city.deleteMany();
  await tx.demoSetting.deleteMany();
}

type Geo = { addisId: string; subCityIds: Map<SubCitySlug, string> };

async function seedGeography(tx: Tx): Promise<Geo> {
  await tx.city.createMany({ data: [...CITIES] });
  const addis = await tx.city.findUniqueOrThrow({ where: { slug: "addis-ababa" } });
  await tx.subCity.createMany({
    data: ADDIS_SUB_CITIES.map((s) => ({ ...s, cityId: addis.id })),
  });
  const subs = await tx.subCity.findMany({ where: { cityId: addis.id } });
  return {
    addisId: addis.id,
    subCityIds: new Map(subs.map((s) => [s.slug as SubCitySlug, s.id])),
  };
}

async function seedSkills(tx: Tx) {
  await tx.skill.createMany({ data: [...SKILLS] });
  const rows = await tx.skill.findMany({ select: { id: true, slug: true } });
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function seedRoleTemplates(tx: Tx) {
  await tx.roleTemplate.createMany({
    data: ROLE_TEMPLATES.map((t, i) => ({
      slug: t.slug,
      nameEn: t.nameEn,
      nameAm: t.nameAm,
      family: t.family,
      defaults: JSON.stringify(t.defaults),
      sortOrder: i,
    })),
  });
}

async function seedPlans(tx: Tx) {
  await tx.plan.createMany({
    data: PLANS.map((p, i) => ({ ...p, features: JSON.stringify(p.features), sortOrder: i })),
  });
  const rows = await tx.plan.findMany({ select: { id: true, code: true } });
  return new Map(rows.map((r) => [r.code, r.id]));
}

async function seedVenues(tx: Tx, geo: Geo, planIds: Map<string, string>, now: Date) {
  for (const v of VENUES) {
    const users = await Promise.all(
      v.members.map((m) =>
        tx.user.create({
          data: {
            name: m.name,
            phone: m.phone,
            platformRole: "EMPLOYER",
            locale: "EN",
            isDemoSeed: true,
          },
        }),
      ),
    );
    const venue = await tx.venue.create({
      data: {
        nameEn: v.nameEn,
        nameAm: v.nameAm,
        category: v.category,
        cityId: geo.addisId,
        subCityId: geo.subCityIds.get(v.subCity)!,
        contactPhone: v.contactPhone,
        descriptionEn: v.descriptionEn,
        descriptionAm: v.descriptionAm,
        verification: "VERIFIED",
        verifiedAt: new Date(now.getTime() - 180 * DAY),
        foundingPostsLeft: v.foundingPostsLeft,
        onboardingDismissed: true,
        members: {
          create: v.members.map((m, i) => ({
            userId: users[i].id,
            displayName: m.name,
            role: m.role,
            status: "ACTIVE",
          })),
        },
      },
    });
    if (v.plan) {
      const start = new Date(now.getTime() - 10 * DAY);
      await tx.subscription.create({
        data: {
          venueId: venue.id,
          planId: planIds.get(v.plan)!,
          status: "ACTIVE",
          currentPeriodStart: start,
          currentPeriodEnd: new Date(start.getTime() + 30 * DAY),
        },
      });
    }
  }
}

/**
 * Queue state at reset (doc 05 §9.5): one pending re-upload from Lideta Corner Café, a spare item
 * for the demo. It needs a real file, so the moderator's document viewer works.
 */
const SAMPLE_LICENSE_KEY = "00000000-0000-4000-8000-000000000001.pdf";

async function seedPendingLicense(tx: Tx, now: Date) {
  const venue = await tx.venue.findFirstOrThrow({ where: { nameEn: "Lideta Corner Café" } });
  const uploadedAt = new Date(now.getTime() - 20 * 60 * 1000);
  const license = await tx.licenseDocument.create({
    data: {
      venueId: venue.id,
      fileKey: SAMPLE_LICENSE_KEY,
      fileName: "lideta-license-renewal.pdf",
      mime: "application/pdf",
      sizeBytes: 800,
      uploadedAt,
    },
  });
  await tx.moderationItem.create({
    data: { type: "LICENSE", licenseId: license.id, createdAt: uploadedAt },
  });
}

function copySampleLicense() {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./data/uploads");
  mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  copyFileSync(
    path.resolve(/*turbopackIgnore: true*/ "public/samples/license-sample.pdf"),
    path.join(/*turbopackIgnore: true*/ dir, SAMPLE_LICENSE_KEY),
  );
}

type ProfileShape = {
  experienceYears: number;
  faydaVerified: boolean;
  photo: boolean;
  headline: boolean;
  previousWorkplace: boolean;
  availability: boolean;
  preferredSubCities: SubCitySlug[];
  skills: string[];
};

async function seedJobseekers(tx: Tx, geo: Geo, skillIds: Map<string, string>) {
  const rng = createRng(PRNG_SEED);
  const generated = JOBSEEKERS.map((j, i) => ({ index: i, j })).filter(({ j }) => !j.fixed);
  // 25 % verified overall: the fixed personas cover 3 of 40, so pick 7 more.
  const extraVerified = new Set(rng.sample(generated, 7).map((g) => g.index));

  for (const [i, j] of JOBSEEKERS.entries()) {
    const shape = j.fixed ?? generateShape(rng, j, extraVerified.has(i));
    const template = ROLE_TEMPLATES.find((t) => t.slug === j.role)!;
    const languages = languagesFor(rng, j);
    const subCityName = (slug: SubCitySlug) =>
      ADDIS_SUB_CITIES.find((s) => s.slug === slug)!.nameEn;
    const workplaceArea = shape.preferredSubCities[0] ?? "kirkos";
    const previousWorkplaces = shape.previousWorkplace
      ? [
          {
            name: `${rng.pick(WORKPLACE_KINDS[j.role])}, ${subCityName(workplaceArea)}`,
            role: template.nameEn,
            years: Math.max(1, shape.experienceYears),
          },
        ]
      : [];
    const profile = {
      headline: shape.headline ? headlineFor(template.nameEn, shape.experienceYears) : null,
      experienceYears: shape.experienceYears,
      languages: JSON.stringify(languages),
      previousWorkplaces: JSON.stringify(previousWorkplaces),
      expectedSalaryMin:
        Math.round((template.defaults.salaryHint.min * (1 + rng.next() * 0.3)) / 500) * 500,
      availability: shape.availability ? rng.pick(AVAILABILITY) : null,
      preferredSubCities: JSON.stringify(shape.preferredSubCities),
      photoUrl: shape.photo ? `/avatars/a${(i % AVATAR_COUNT) + 1}.svg` : null,
    };
    const completeness = profileCompleteness({
      ...profile,
      skillCount: shape.skills.length,
      languageCount: languages.length,
      previousWorkplaceCount: previousWorkplaces.length,
      preferredSubCityCount: shape.preferredSubCities.length,
    });

    await tx.user.create({
      data: {
        name: j.name,
        phone: jobseekerPhone(i),
        platformRole: "JOBSEEKER",
        locale: "AM",
        faydaVerified: shape.faydaVerified,
        isDemoSeed: true,
        profile: {
          create: {
            ...profile,
            completeness,
            skills: { create: shape.skills.map((slug) => ({ skillId: skillIds.get(slug)! })) },
          },
        },
      },
    });
  }
}

/** Deterministic profile for a non-persona jobseeker; completeness lands in 35–100. */
function generateShape(rng: Rng, j: JobseekerSeed, faydaVerified: boolean): ProfileShape {
  const template = ROLE_TEMPLATES.find((t) => t.slug === j.role)!;
  const [minYears, maxYears] =
    j.role === "hospitality-manager" ? [5, 12] : j.role === "chef-de-partie" ? [3, 9] : [0, 7];
  const experienceYears = rng.int(minYears, maxYears);
  const roleSkills = template.defaults.skillSlugs.filter(
    (s) => !["amharic", "english", "french"].includes(s),
  );
  const skillCount = rng.chance(0.75) ? Math.min(roleSkills.length, rng.int(3, 4)) : rng.int(1, 2);
  const subCities = ADDIS_SUB_CITIES.map((s) => s.slug);

  const shape: ProfileShape = {
    experienceYears,
    faydaVerified,
    photo: rng.chance(0.2),
    headline: rng.chance(0.7),
    previousWorkplace: experienceYears > 0 && rng.chance(0.6),
    availability: rng.chance(0.6),
    preferredSubCities: rng.sample(subCities, rng.int(1, 2)),
    skills: rng.sample(roleSkills, skillCount),
  };
  // Keep everyone at ≥ 35 % so the roster looks like real, partly-filled profiles.
  const score = () =>
    profileCompleteness({
      photoUrl: shape.photo ? "x" : null,
      headline: shape.headline ? "x" : null,
      skillCount: shape.skills.length,
      experienceYears: shape.experienceYears,
      languageCount: 1,
      previousWorkplaceCount: shape.previousWorkplace ? 1 : 0,
      availability: shape.availability ? "x" : null,
      preferredSubCityCount: shape.preferredSubCities.length,
    });
  if (score() < 35) shape.headline = true;
  if (score() < 35) shape.availability = true;
  return shape;
}

function languagesFor(rng: Rng, j: JobseekerSeed) {
  const langs: { code: string; level: string }[] = [];
  if (OROMO_SPEAKERS.has(j.name)) langs.push({ code: "om", level: "native" });
  langs.push({ code: "am", level: OROMO_SPEAKERS.has(j.name) ? "fluent" : "native" });
  const needsEnglish = ["front-desk", "tour-guide", "hospitality-manager"].includes(j.role);
  if (needsEnglish || j.fixed?.skills.includes("english") || rng.chance(0.6)) {
    langs.push({ code: "en", level: needsEnglish ? "fluent" : rng.pick(["basic", "good"]) });
  }
  if (j.role === "tour-guide" && rng.chance(0.5)) langs.push({ code: "fr", level: "good" });
  return langs;
}

function headlineFor(roleName: string, years: number) {
  if (years === 0) return `Trained ${roleName.toLowerCase()} looking for a first role`;
  return `${roleName} with ${years} year${years === 1 ? "" : "s"} of experience`;
}

async function summarise(tx: Tx): Promise<SeedSummary> {
  const [cities, subCities, skills, roleTemplates, plans, users, venues, members, profiles] =
    await Promise.all([
      tx.city.count(),
      tx.subCity.count(),
      tx.skill.count(),
      tx.roleTemplate.count(),
      tx.plan.count(),
      tx.user.count(),
      tx.venue.count(),
      tx.venueMember.count(),
      tx.jobseekerProfile.count(),
    ]);
  return {
    seedVersion: Number(SEED_VERSION),
    cities,
    subCities,
    skills,
    roleTemplates,
    plans,
    users,
    venues,
    members,
    jobseekers: profiles,
  };
}
