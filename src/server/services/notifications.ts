import "server-only";
import type { NotificationKind, Prisma } from "@prisma/client";
import { smsAdapter, type SmsKind } from "../adapters/sms";
import { now } from "../clock";

// In-app notifications and the simulated SMS gateway (TRD §5.8). Grows into the full
// notification service in T1.5; for now it holds the two primitives the sweep needs.

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
