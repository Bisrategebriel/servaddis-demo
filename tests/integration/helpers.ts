import type { Prisma } from "@prisma/client";
import { db, ensureWal } from "@/server/db";
import { seed } from "../../prisma/seed/seed";

/** Fresh seeded database (the same data `pnpm seed` and Reset produce). */
export async function resetDb() {
  await ensureWal(); // same journal mode as the app; also much faster resets
  await seed(db);
}

export async function hiwot() {
  const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });
  const selam = await db.user.findUniqueOrThrow({ where: { phone: "+251911000001" } });
  const yared = await db.user.findUniqueOrThrow({ where: { phone: "+251911000002" } });
  return { venue, selam, yared };
}

export async function createJob(
  venueId: string,
  createdById: string,
  data: Partial<Prisma.JobUncheckedCreateInput> = {},
) {
  const venue = await db.venue.findUniqueOrThrow({ where: { id: venueId } });
  return db.job.create({
    data: {
      venueId,
      createdById,
      cityId: venue.cityId,
      subCityId: venue.subCityId,
      titleEn: "Barista",
      titleAm: "ባሪስታ",
      descriptionEn: "Prepare espresso drinks.",
      employmentType: "FULL_TIME",
      salaryMin: 5000,
      salaryMax: 9000,
      status: "LIVE",
      ...data,
    },
  });
}
