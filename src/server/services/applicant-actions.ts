import "server-only";
import type {
  Application,
  ApplicationStatus,
  Job,
  Prisma,
  RejectReason,
  User,
} from "@prisma/client";
import { shortName } from "@/lib/names";
import { formatPhone, maskPhone } from "@/lib/phone";
import { timeToFill } from "@/lib/format";
import { DAY_MS, now } from "../clock";
import { db } from "../db";
import { conflict } from "../http/errors";
import { audit } from "./audit";
import { employerRecipients, notify, sms } from "./notifications";

// Employer actions on one application (App Flow §5.1, notification matrix §10). Each is one
// transaction: status + timestamp + ApplicationEvent + jobseeker notification (+ SMS where the
// matrix says so). Wrong state → 409 with the current status.

type Tx = Prisma.TransactionClient;

const stateError = (status: ApplicationStatus) =>
  conflict(
    "This can't be done at the applicant's current stage.",
    "በአመልካቹ የአሁኑ ደረጃ ይህን ማድረግ አይቻልም።",
    { status },
  );

/** What the jobseeker is told for each step, in both languages, with an optional SMS. */
async function tellJobseeker(
  tx: Tx,
  app: Application,
  job: Job,
  step: "VIEWED" | "SHORTLISTED" | "REJECTED" | "FILLED" | "HIRED",
) {
  const seeker = await tx.user.findUniqueOrThrow({ where: { id: app.jobseekerId } });
  const venue = await tx.venue.findUniqueOrThrow({ where: { id: job.venueId } });
  const en = job.titleEn || job.titleAm!;
  const am = job.titleAm || job.titleEn;
  const vAm = venue.nameAm ?? venue.nameEn;
  const copy = {
    VIEWED: {
      kind: "APPLICATION_VIEWED",
      titleEn: "Your application was viewed",
      titleAm: "ማመልከቻዎ ታይቷል",
      bodyEn: `${venue.nameEn} looked at your application for ${en}.`,
      bodyAm: `${vAm} ለ${am} ያቀረቡትን ማመልከቻ አይቷል።`,
    },
    SHORTLISTED: {
      kind: "APPLICATION_SHORTLISTED",
      titleEn: "You're on the shortlist",
      titleAm: "አጭር ዝርዝር ውስጥ ገብተዋል",
      bodyEn: `${venue.nameEn} shortlisted you for ${en}. They may call you.`,
      bodyAm: `${vAm} ለ${am} አጭር ዝርዝር ውስጥ አስገብቶዎታል። ሊደውሉልዎ ይችላሉ።`,
    },
    REJECTED: {
      kind: "APPLICATION_REJECTED",
      titleEn: "Update on your application",
      titleAm: "ስለ ማመልከቻዎ",
      bodyEn: `${venue.nameEn} chose other applicants for ${en} this time.`,
      bodyAm: `${vAm} ለ${am} በዚህ ጊዜ ሌሎች አመልካቾችን መርጧል።`,
    },
    FILLED: {
      kind: "APPLICATION_REJECTED",
      titleEn: "Update on your application",
      titleAm: "ስለ ማመልከቻዎ",
      bodyEn: `The ${en} position at ${venue.nameEn} has been filled.`,
      bodyAm: `በ${vAm} የነበረው የ${am} ቦታ ተይዟል።`,
    },
    HIRED: {
      kind: "APPLICATION_HIRED",
      titleEn: "You got the job!",
      titleAm: "ሥራውን አግኝተዋል!",
      bodyEn: `${venue.nameEn} hired you as ${en}. Congratulations!`,
      bodyAm: `${vAm} በ${am} ቀጥሮዎታል። እንኳን ደስ አለዎት!`,
    },
  }[step];
  await notify(tx, [seeker.id], { ...copy, kind: copy.kind as never, href: "/me/applications" });
  // SMS for the moments that matter (doc 03 §10): shortlisted and hired.
  if (step === "SHORTLISTED" || step === "HIRED") {
    const text = seeker.locale === "AM" ? `Servaddis፦ ${copy.bodyAm}` : `Servaddis: ${copy.bodyEn}`;
    await sms(tx, seeker.phone, text, "ALERT");
  }
}

/** Opening the drawer marks a new application Viewed. Later stages are left as they are. */
export async function viewApplication(user: User, app: Application, job: Job) {
  if (app.status !== "APPLIED") return app;
  const at = now();
  return db.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: app.id },
      data: { status: "VIEWED", viewedAt: app.viewedAt ?? at },
    });
    await tx.applicationEvent.create({
      data: { applicationId: app.id, type: "VIEWED", actorId: user.id, at },
    });
    await tellJobseeker(tx, app, job, "VIEWED");
    return updated;
  });
}

export async function shortlistApplication(user: User, app: Application, job: Job) {
  if (app.status !== "APPLIED" && app.status !== "VIEWED") throw stateError(app.status);
  const at = now();
  return db.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: app.id },
      // Shortlisting straight from Applied still records when it was first seen.
      data: { status: "SHORTLISTED", viewedAt: app.viewedAt ?? at, shortlistedAt: at },
    });
    await tx.applicationEvent.create({
      data: { applicationId: app.id, type: "SHORTLISTED", actorId: user.id, at },
    });
    await tellJobseeker(tx, app, job, "SHORTLISTED");
    return updated;
  });
}

export async function rejectApplication(
  user: User,
  app: Application,
  job: Job,
  reason: RejectReason,
) {
  if (app.status === "HIRED" || app.status === "REJECTED") throw stateError(app.status);
  const at = now();
  return db.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: app.id },
      data: { status: "REJECTED", rejectReason: reason, rejectedAt: at },
    });
    await tx.applicationEvent.create({
      data: {
        applicationId: app.id,
        type: "REJECTED",
        actorId: user.id,
        at,
        meta: JSON.stringify({ reason }),
      },
    });
    await tellJobseeker(tx, app, job, "REJECTED");
    return updated;
  });
}

/**
 * Hire (App Flow §5.1): Shortlisted → Hired, hiredCount + 1, and the 2-week and 30-day placement
 * check-ins scheduled (the sweep sends them when due). The hire that reaches the headcount fills
 * the job: filledAt (time-to-fill), a live job closes, every applicant still in play is rejected
 * as POSITION_FILLED and told, and the job's creator and owners get "job filled".
 */
export async function hireApplication(user: User, app: Application, job: Job) {
  if (app.status !== "SHORTLISTED") throw stateError(app.status);
  const at = now();
  return db.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: app.id },
      data: { status: "HIRED", hiredAt: at },
    });
    const counted = await tx.job.update({
      where: { id: job.id },
      data: { hiredCount: { increment: 1 } },
    });
    await tx.applicationEvent.create({
      data: { applicationId: app.id, type: "HIRED", actorId: user.id, at },
    });
    await tx.placementCheckin.createMany({
      data: [
        { applicationId: app.id, kind: "WEEK_2", dueAt: new Date(at.getTime() + 14 * DAY_MS) },
        { applicationId: app.id, kind: "DAY_30", dueAt: new Date(at.getTime() + 30 * DAY_MS) },
      ],
    });
    await tellJobseeker(tx, app, job, "HIRED");

    const filled = !counted.filledAt && counted.hiredCount >= counted.headcount;
    if (filled) await fillJob(tx, counted, at);
    return { application: updated, jobFilled: filled };
  });
}

async function fillJob(tx: Tx, job: Job, at: Date) {
  await tx.job.update({
    where: { id: job.id },
    data:
      job.status === "LIVE" ? { status: "CLOSED", closedAt: at, filledAt: at } : { filledAt: at },
  });
  const open = await tx.application.findMany({
    where: { jobId: job.id, status: { in: ["APPLIED", "VIEWED", "SHORTLISTED"] } },
  });
  for (const other of open) {
    await tx.application.update({
      where: { id: other.id },
      data: { status: "REJECTED", rejectReason: "POSITION_FILLED", rejectedAt: at },
    });
    await tx.applicationEvent.create({
      data: {
        applicationId: other.id,
        type: "REJECTED",
        at,
        meta: JSON.stringify({ reason: "POSITION_FILLED", automatic: true }),
      },
    });
    await tellJobseeker(tx, other, job, "FILLED");
  }
  const ttf = job.publishedAt ? timeToFill(job.publishedAt, at) : null;
  const en = job.titleEn || job.titleAm!;
  const am = job.titleAm || job.titleEn;
  const recipients = await employerRecipients(tx, job.venueId, job.createdById);
  await notify(
    tx,
    recipients.map((r) => r.id),
    {
      kind: "JOB_FILLED",
      titleEn: "Job filled",
      titleAm: "ቦታው ተይዟል",
      bodyEn: ttf
        ? `"${en}" is filled, in ${ttf.value} ${ttf.unit === "hours" ? "hours" : "days"}.`
        : `"${en}" is filled.`,
      bodyAm: ttf
        ? `"${am}" ተይዟል፤ በ${ttf.value} ${ttf.unit === "hours" ? "ሰዓት" : "ቀን"}።`
        : `"${am}" ተይዟል።`,
      href: `/employer/jobs/${job.id}`,
    },
  );
}

/**
 * Contact reveal (E-14): only once shortlisted or hired. The first reveal records who and when
 * (+ event); every reveal, including repeats, is written to the audit log, because each one
 * discloses the number (doc 05 §12).
 */
export async function revealContact(user: User, app: Application) {
  if (app.status !== "SHORTLISTED" && app.status !== "HIRED") throw stateError(app.status);
  const at = now();
  return db.$transaction(async (tx) => {
    const first = !app.contactRevealedAt;
    if (first) {
      await tx.application.update({
        where: { id: app.id },
        data: { contactRevealedAt: at, contactRevealedById: user.id },
      });
      await tx.applicationEvent.create({
        data: { applicationId: app.id, type: "CONTACT_REVEALED", actorId: user.id, at },
      });
    }
    await audit(tx, {
      actorId: user.id,
      action: "application.contact_reveal",
      entity: "Application",
      entityId: app.id,
      meta: { jobId: app.jobId, first },
    });
    const seeker = await tx.user.findUniqueOrThrow({ where: { id: app.jobseekerId } });
    return { phone: formatPhone(seeker.phone) };
  });
}

/**
 * The drawer (SCR-E09): the full profile, the timeline with actor names, and the phone: full
 * only if it was revealed and the viewer may reveal contacts, masked otherwise.
 */
export async function applicationDetail(app: Application, canReveal: boolean) {
  const full = await db.application.findUniqueOrThrow({
    where: { id: app.id },
    include: {
      jobseeker: {
        include: {
          profile: { include: { skills: { include: { skill: true } } } },
        },
      },
      contactRevealer: { select: { name: true } },
      events: { orderBy: { at: "asc" } },
    },
  });
  const actorIds = [...new Set(full.events.map((e) => e.actorId).filter(Boolean))] as string[];
  const actors = new Map(
    (
      await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    ).map((u) => [u.id, u.name]),
  );
  const p = full.jobseeker.profile;
  const json = <T>(s: string | undefined, fallback: T): T => (s ? (JSON.parse(s) as T) : fallback);
  const revealed = !!full.contactRevealedAt && canReveal;
  return {
    id: full.id,
    status: full.status,
    note: full.note,
    rejectReason: full.rejectReason,
    name: full.jobseeker.name,
    faydaVerified: full.jobseeker.faydaVerified,
    headline: p?.headline ?? null,
    experienceYears: p?.experienceYears ?? 0,
    completeness: p?.completeness ?? 0,
    availability: p?.availability ?? null,
    skills: (p?.skills ?? []).map((s) => ({ en: s.skill.nameEn, am: s.skill.nameAm })),
    languages: json<{ code: string; level: string }[]>(p?.languages, []),
    previousWorkplaces: json<{ name: string; role: string; years: number }[]>(
      p?.previousWorkplaces,
      [],
    ),
    phone: revealed ? formatPhone(full.jobseeker.phone) : maskPhone(full.jobseeker.phone),
    revealed,
    revealedBy: full.contactRevealedAt
      ? {
          name: shortName(full.contactRevealer?.name ?? ""),
          at: full.contactRevealedAt.toISOString(),
        }
      : null,
    events: full.events.map((e) => ({
      type: e.type,
      at: e.at.toISOString(),
      actor: e.actorId === full.jobseekerId ? null : shortName(actors.get(e.actorId ?? "") ?? ""),
    })),
  };
}

export type ApplicationDetail = Awaited<ReturnType<typeof applicationDetail>>;
