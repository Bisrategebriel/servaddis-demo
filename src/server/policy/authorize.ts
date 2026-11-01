import "server-only";
import type { Application, Job, User, VenueMember } from "@prisma/client";
import {
  effectivePermissions,
  type PlatformPermission,
  type VenuePermission,
} from "@/lib/permissions";
import { db } from "../db";
import { AppError, forbidden, notFound } from "../http/errors";
import { audit } from "../services/audit";

// Authorization decision (App Flow §6.2):
//   no session → 401 (requireUser) · not an ACTIVE member of the resource's venue → 404 (no leak)
//   permission missing → 403 (+ audit for sensitive keys) · state checks (409) belong to services
// The venue is always derived from the resource, never taken from the client (doc 05 §5.3).

/** Denials of these are worth recording: they touch personal data, money or access itself. */
const SENSITIVE: ReadonlySet<VenuePermission> = new Set([
  "contact.reveal",
  "applicant.hire",
  "billing.manage",
  "team.manage",
]);

export type VenueAccess = { member: VenueMember; permissions: Set<VenuePermission> };

async function deny(user: User, perm: VenuePermission, entity: string, entityId: string) {
  if (SENSITIVE.has(perm)) {
    await audit(db, {
      actorId: user.id,
      action: "authz.denied",
      entity,
      entityId,
      meta: { permission: perm },
    });
  }
  return forbidden(perm);
}

/** Membership + effective permissions, or null when the user is not an active member. */
export async function venueAccess(user: User, venueId: string): Promise<VenueAccess | null> {
  const member = await db.venueMember.findFirst({
    where: { venueId, userId: user.id, status: "ACTIVE" },
  });
  return member ? { member, permissions: effectivePermissions(member) } : null;
}

export async function authorizeVenue(
  user: User,
  venueId: string,
  perm: VenuePermission,
  /** Entity reported in the audit log when denied (defaults to the venue). */
  target: { entity: string; entityId: string } = { entity: "Venue", entityId: venueId },
): Promise<VenueAccess> {
  const access = await venueAccess(user, venueId);
  if (!access) throw notFound();
  if (!access.permissions.has(perm)) throw await deny(user, perm, target.entity, target.entityId);
  return access;
}

export async function authorizeJob(
  user: User,
  jobId: string,
  perm: VenuePermission,
): Promise<VenueAccess & { job: Job }> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw notFound();
  const access = await authorizeVenue(user, job.venueId, perm, { entity: "Job", entityId: job.id });
  return { ...access, job };
}

export async function authorizeApplication(
  user: User,
  applicationId: string,
  perm: VenuePermission,
): Promise<VenueAccess & { application: Application; job: Job }> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });
  if (!application) throw notFound();
  const access = await authorizeVenue(user, application.job.venueId, perm, {
    entity: "Application",
    entityId: application.id,
  });
  const { job, ...app } = application;
  return { ...access, application: app, job };
}

/** Platform admins hold admin.moderate + admin.audit and no venue permissions (doc 05 §5.2). */
export function authorizePlatform(user: User, perm: PlatformPermission): void {
  if (user.platformRole !== "ADMIN") throw forbidden(perm);
}

/** Jobseeker-only endpoints (apply, my applications). */
export function requireJobseeker(user: User): void {
  if (user.platformRole !== "JOBSEEKER") {
    throw new AppError("FORBIDDEN", {
      message: "Only jobseeker accounts can do this.",
      messageAm: "ይህን ማድረግ የሚችሉት የሥራ ፈላጊ መለያዎች ብቻ ናቸው።",
    });
  }
}
