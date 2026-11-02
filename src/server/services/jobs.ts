import "server-only";
import type { Job, Prisma, User } from "@prisma/client";
import type { z } from "zod";
import { parseRoleTemplateDefaults } from "@/lib/role-template";
import type { jobDraftBody } from "@/lib/zod-schemas";
import { now } from "../clock";
import { db } from "../db";
import { AppError, conflict } from "../http/errors";

// Job drafts (E-07). A draft may be incomplete and may belong to an unverified venue; those
// checks happen at submit (T2.4). The venue always comes from the membership or the job.

type JobDraft = z.output<typeof jobDraftBody>;
type Tx = Prisma.TransactionClient;

const EDITABLE: Job["status"][] = ["DRAFT", "CHANGES_REQUESTED"];

async function draftColumns(tx: Tx, input: JobDraft) {
  const {
    roleTemplateSlug,
    subCity,
    requirementsEn,
    requirementsAm,
    benefitsEn,
    benefitsAm,
    ...rest
  } = input;
  const sub = await tx.subCity.findUnique({ where: { slug: subCity } });
  if (!sub) throw new AppError("BAD_REQUEST");
  const template = roleTemplateSlug
    ? await tx.roleTemplate.findUnique({ where: { slug: roleTemplateSlug } })
    : null;
  if (roleTemplateSlug && !template) throw new AppError("BAD_REQUEST");
  return {
    template,
    data: {
      ...rest,
      subCityId: sub.id,
      roleTemplateId: template?.id ?? null,
      requirementsEn: JSON.stringify(requirementsEn),
      requirementsAm: JSON.stringify(requirementsAm),
      benefitsEn: JSON.stringify(benefitsEn),
      benefitsAm: JSON.stringify(benefitsAm),
    },
  };
}

export async function createDraft(user: User, venueId: string, input: JobDraft) {
  const at = now();
  return db.$transaction(async (tx) => {
    const venue = await tx.venue.findUniqueOrThrow({ where: { id: venueId } });
    const { template, data } = await draftColumns(tx, input);
    const job = await tx.job.create({
      data: { ...data, venueId, cityId: venue.cityId, createdById: user.id, createdAt: at },
    });
    if (template) {
      const slugs = parseRoleTemplateDefaults(template.defaults).skillSlugs;
      const skills = await tx.skill.findMany({ where: { slug: { in: slugs } } });
      await tx.jobSkill.createMany({
        data: skills.map((s) => ({ jobId: job.id, skillId: s.id })),
      });
    }
    return job;
  });
}

export async function updateDraft(job: Job, input: JobDraft) {
  if (!EDITABLE.includes(job.status)) {
    throw conflict("This job can't be edited now.", "ይህን ሥራ አሁን ማስተካከል አይቻልም።", {
      status: job.status,
    });
  }
  return db.$transaction(async (tx) => {
    const { data } = await draftColumns(tx, input);
    return tx.job.update({ where: { id: job.id }, data });
  });
}
