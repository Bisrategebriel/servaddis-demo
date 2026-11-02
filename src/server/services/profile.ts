import "server-only";
import type { z } from "zod";
import { profileCompleteness } from "@/lib/profile-completeness";
import type { profileBody } from "@/lib/zod-schemas";
import { db } from "../db";
import { ADDIS_SUB_CITIES } from "../../../prisma/seed/data/geography";

// Jobseeker profile (J-05, SCR-J04): read-mostly. Skills, languages and past workplaces come from
// the seed; the guided profile builder is out of scope for the demo (PRD §5).

const list = <T>(json: string | undefined): T[] => (json ? (JSON.parse(json) as T[]) : []);

export async function myProfile(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { profile: { include: { skills: { include: { skill: true } } } } },
  });
  const p = user.profile;
  const preferred = list<string>(p?.preferredSubCities);
  return {
    name: user.name,
    faydaVerified: user.faydaVerified,
    photoUrl: p?.photoUrl ?? null,
    headline: p?.headline ?? null,
    experienceYears: p?.experienceYears ?? 0,
    availability: p?.availability ?? null,
    completeness: p?.completeness ?? 0,
    skills: (p?.skills ?? []).map((s) => ({ en: s.skill.nameEn, am: s.skill.nameAm })),
    languages: list<{ code: string; level: string }>(p?.languages),
    previousWorkplaces: list<{ name: string; role: string; years: number }>(p?.previousWorkplaces),
    preferredSubCities: ADDIS_SUB_CITIES.filter((s) => preferred.includes(s.slug)).map((s) => ({
      en: s.nameEn,
      am: s.nameAm,
    })),
  };
}

export type MyProfile = Awaited<ReturnType<typeof myProfile>>;

/** Saves the basics and recomputes completeness (doc 05 §6.4: "recomputed on write"). */
export async function updateProfile(userId: string, input: z.output<typeof profileBody>) {
  return db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name: input.name } });
    const existing = await tx.jobseekerProfile.findUnique({
      where: { userId },
      include: { _count: { select: { skills: true } } },
    });
    const completeness = profileCompleteness({
      photoUrl: existing?.photoUrl,
      headline: input.headline,
      skillCount: existing?._count.skills ?? 0,
      experienceYears: input.experienceYears,
      languageCount: list(existing?.languages).length,
      previousWorkplaceCount: list(existing?.previousWorkplaces).length,
      availability: input.availability,
      preferredSubCityCount: list(existing?.preferredSubCities).length,
    });
    const data = {
      headline: input.headline ?? null,
      experienceYears: input.experienceYears,
      availability: input.availability ?? null,
      completeness,
    };
    await tx.jobseekerProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return completeness;
  });
}
