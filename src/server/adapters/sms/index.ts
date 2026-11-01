import "server-only";
import type { Prisma } from "@prisma/client";
import { simSmsAdapter } from "./sim";

// SMS seam (TRD §2 adapters). Only the simulated gateway exists in the demo; a real
// aggregator implements the same interface later.

export type SmsKind = "OTP" | "ALERT" | "CHECKIN" | "INVITE";
export type SmsMessage = { toPhone: string; body: string; kind: SmsKind };

export interface SmsAdapter {
  send(tx: Prisma.TransactionClient, message: SmsMessage): Promise<void>;
}

export const smsAdapter: SmsAdapter = simSmsAdapter;
