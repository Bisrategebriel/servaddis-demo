import "server-only";
import type { Prisma } from "@prisma/client";
import { now } from "../clock";

// Append-only audit trail for sensitive actions (doc 05 §1.6): contact reveals, moderation
// decisions, permission changes, payments, and denied attempts at sensitive permissions.

export type AuditEntry = {
  actorId: string | null;
  action: string; // e.g. "application.contact_reveal", "authz.denied"
  entity: string;
  entityId: string;
  meta?: Record<string, unknown>;
};

export function audit(tx: Prisma.TransactionClient, e: AuditEntry) {
  return tx.auditLog.create({
    data: {
      actorId: e.actorId,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      meta: e.meta ? JSON.stringify(e.meta) : null,
      at: now(),
    },
  });
}
