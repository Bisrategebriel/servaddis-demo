import "server-only";
import { now } from "../../clock";
import type { SmsAdapter } from "./index";

/** Simulated gateway: rows go to SmsLog and appear in the Demo Toolkit phone drawer. */
export const simSmsAdapter: SmsAdapter = {
  async send(tx, { toPhone, body, kind }) {
    await tx.smsLog.create({ data: { toPhone, body, kind, createdAt: now() } });
  },
};
