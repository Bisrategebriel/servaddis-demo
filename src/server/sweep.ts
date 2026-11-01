import "server-only";
import type { CheckinKind, Prisma } from "@prisma/client";
import { DAY_MS, now } from "./clock";
import { db } from "./db";
import { notify, sms } from "./services/notifications";

// Time-based work without background workers (TRD §5.9). Idempotent, so it is safe to call
// from the 60 s timer, after a time-skip, and on admin-queue load.

type Tx = Prisma.TransactionClient;

export const EXPIRY_WARNING_MS = 3 * DAY_MS;
export const BANK_TRANSFER_TIMEOUT_MS = 7 * DAY_MS;

export type SweepResult = {
  expired: number;
  expiryWarnings: number;
  checkinsSent: number;
  paymentsFailed: number;
};

const store = globalThis as unknown as { svSweepRunning?: Promise<SweepResult> };

/** Runs one sweep; concurrent callers share the in-flight run instead of starting another. */
export function sweep(at: Date = now()): Promise<SweepResult> {
  store.svSweepRunning ??= db
    .$transaction((tx) => runSweep(tx, at), { timeout: 30_000 })
    .finally(() => {
      store.svSweepRunning = undefined;
    });
  return store.svSweepRunning;
}

async function runSweep(tx: Tx, at: Date): Promise<SweepResult> {
  return {
    expired: await expireJobs(tx, at),
    expiryWarnings: await warnExpiringJobs(tx, at),
    checkinsSent: await sendDueCheckins(tx, at),
    paymentsFailed: await failStaleBankTransfers(tx, at),
  };
}

/** LIVE → EXPIRED once expiresAt has passed (doc 05 §6.1). Applicants are left unchanged. */
async function expireJobs(tx: Tx, at: Date) {
  const { count } = await tx.job.updateMany({
    where: { status: "LIVE", expiresAt: { lte: at } },
    data: { status: "EXPIRED" },
  });
  return count;
}

/** venue owners + the job's creator: the "job creator + Owner" recipients in doc 03 §10. */
async function employerRecipients(tx: Tx, venueId: string, createdById: string) {
  const owners = await tx.venueMember.findMany({
    where: { venueId, role: "OWNER", status: "ACTIVE", userId: { not: null } },
    select: { user: { select: { id: true, phone: true, locale: true } } },
  });
  const creator = await tx.user.findUniqueOrThrow({
    where: { id: createdById },
    select: { id: true, phone: true, locale: true },
  });
  const byId = new Map([creator, ...owners.map((o) => o.user!)].map((u) => [u.id, u]));
  return [...byId.values()];
}

/**
 * T-3 days warning for normal 30-day posts (E-11). Urgent posts live for hours, so warning
 * them would fire at publish time. Deduplicated per user + job via the notification href.
 */
async function warnExpiringJobs(tx: Tx, at: Date) {
  const jobs = await tx.job.findMany({
    where: {
      status: "LIVE",
      urgency: "NORMAL",
      expiresAt: { gt: at, lte: new Date(at.getTime() + EXPIRY_WARNING_MS) },
    },
    select: { id: true, venueId: true, createdById: true, titleEn: true, titleAm: true },
  });
  let sent = 0;
  for (const job of jobs) {
    const href = `/employer/jobs/${job.id}`;
    const recipients = await employerRecipients(tx, job.venueId, job.createdById);
    const already = await tx.notification.findMany({
      where: { kind: "JOB_EXPIRING", href, userId: { in: recipients.map((r) => r.id) } },
      select: { userId: true },
    });
    const done = new Set(already.map((n) => n.userId));
    sent += await notify(
      tx,
      recipients.filter((r) => !done.has(r.id)).map((r) => r.id),
      {
        kind: "JOB_EXPIRING",
        titleEn: "Job expiring soon",
        titleAm: "የሥራ ማስታወቂያው ጊዜ ሊያልፍ ነው",
        bodyEn: `"${job.titleEn}" closes to applicants in less than 3 days.`,
        bodyAm: `"${job.titleAm ?? job.titleEn}" ከ3 ቀን ባነሰ ጊዜ ውስጥ ለአመልካቾች ይዘጋል።`,
        href,
      },
    );
  }
  return sent;
}

const CHECKIN_LABEL: Record<CheckinKind, { en: string; am: string }> = {
  WEEK_2: { en: "2-week check-in", am: "የ2 ሳምንት ክትትል" },
  DAY_30: { en: "30-day check-in", am: "የ30 ቀን ክትትል" },
};

/** Placement check-ins scheduled at hire (+14 d, +30 d) become due (doc 03 §10). */
async function sendDueCheckins(tx: Tx, at: Date) {
  const due = await tx.placementCheckin.findMany({
    where: { sentAt: null, dueAt: { lte: at } },
    include: {
      application: {
        include: {
          jobseeker: { select: { id: true, name: true, phone: true, locale: true } },
          job: {
            select: {
              id: true,
              venueId: true,
              createdById: true,
              titleEn: true,
              titleAm: true,
              venue: { select: { nameEn: true, nameAm: true } },
            },
          },
        },
      },
    },
  });

  for (const c of due) {
    const { jobseeker, job } = c.application;
    const label = CHECKIN_LABEL[c.kind];
    const titleAm = job.titleAm ?? job.titleEn;
    const venueAm = job.venue.nameAm ?? job.venue.nameEn;

    await tx.placementCheckin.update({ where: { id: c.id }, data: { sentAt: at } });

    const seekerEn = `How is your new role as ${job.titleEn} at ${job.venue.nameEn}?`;
    const seekerAm = `በ${venueAm} ያለዎት አዲስ የ${titleAm} ሥራ እንዴት ነው?`;
    await notify(tx, [jobseeker.id], {
      kind: "CHECKIN_DUE",
      titleEn: label.en,
      titleAm: label.am,
      bodyEn: seekerEn,
      bodyAm: seekerAm,
      href: "/me/applications",
    });
    await sms(tx, jobseeker.phone, jobseeker.locale === "AM" ? seekerAm : seekerEn, "CHECKIN");

    const employerEn = `How is ${jobseeker.name} doing as ${job.titleEn}?`;
    const employerAm = `${jobseeker.name} በ${titleAm} ሥራው እንዴት ነው?`;
    const employers = await employerRecipients(tx, job.venueId, job.createdById);
    await notify(
      tx,
      employers.map((e) => e.id),
      {
        kind: "CHECKIN_DUE",
        titleEn: label.en,
        titleAm: label.am,
        bodyEn: employerEn,
        bodyAm: employerAm,
        href: `/employer/jobs/${job.id}/applicants`,
      },
    );
    for (const e of employers) {
      await sms(tx, e.phone, e.locale === "AM" ? employerAm : employerEn, "CHECKIN");
    }
  }
  return due.length;
}

/** Simulated bank transfers nobody confirmed within 7 days are marked failed (TRD §5.7, §5.9). */
async function failStaleBankTransfers(tx: Tx, at: Date) {
  const { count } = await tx.payment.updateMany({
    where: {
      provider: "BANK_TRANSFER_SIM",
      status: "PENDING",
      createdAt: { lte: new Date(at.getTime() - BANK_TRANSFER_TIMEOUT_MS) },
    },
    data: { status: "FAILED" },
  });
  return count;
}
