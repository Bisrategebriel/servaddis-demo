import "server-only";
import type { NotificationKind, Prisma } from "@prisma/client";
import { smsAdapter, type SmsKind } from "../adapters/sms";
import { now } from "../clock";

// In-app notifications and the simulated SMS gateway (TRD §5.8).

type Tx = Prisma.TransactionClient;

export type NotificationContent = {
  kind: NotificationKind;
  titleEn: string;
  titleAm: string;
  bodyEn?: string;
  bodyAm?: string;
  href?: string;
};

/** One notification per distinct user, stored in both languages. */
export async function notify(tx: Tx, userIds: string[], n: NotificationContent): Promise<number> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;
  const createdAt = now();
  const { count } = await tx.notification.createMany({
    data: unique.map((userId) => ({ userId, ...n, createdAt })),
  });
  return count;
}

/** Sends through the SMS adapter (simulated in the demo: SmsLog + toolkit phone drawer). */
export function sms(tx: Tx, toPhone: string, body: string, kind: SmsKind) {
  return smsAdapter.send(tx, { toPhone, body, kind });
}

/** venue owners + the job's creator: the "job creator + Owner" recipients in doc 03 §10. */
export async function employerRecipients(tx: Tx, venueId: string, createdById: string) {
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
