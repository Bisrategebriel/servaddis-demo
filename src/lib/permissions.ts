import type { MemberRole } from "@prisma/client";

// Permission model (doc 05 §5). Pure data + logic, shared by the API (enforcement) and the UI
// (hiding/disabling controls). Hiding is cosmetic; src/server/policy/authorize.ts enforces.

export const VENUE_PERMISSIONS = [
  "job.view",
  "job.create",
  "job.edit",
  "job.submit",
  "job.close",
  "social.promote",
  "applicant.view",
  "applicant.shortlist",
  "applicant.reject",
  "applicant.hire",
  "contact.reveal",
  "insights.view",
  "billing.manage",
  "team.manage",
  "venue.edit",
] as const;

export const PLATFORM_PERMISSIONS = ["admin.moderate", "admin.audit"] as const;

export type VenuePermission = (typeof VENUE_PERMISSIONS)[number];
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
export type PermissionKey = VenuePermission | PlatformPermission;

export const PRESETS: Record<MemberRole, readonly VenuePermission[]> = {
  OWNER: [
    "job.view",
    "job.create",
    "job.edit",
    "job.submit",
    "job.close",
    "social.promote",
    "applicant.view",
    "applicant.shortlist",
    "applicant.reject",
    "applicant.hire",
    "contact.reveal",
    "insights.view",
    "billing.manage",
    "team.manage",
    "venue.edit",
  ],
  HR_MANAGER: [
    "job.view",
    "job.create",
    "job.edit",
    "job.submit",
    "job.close",
    "social.promote",
    "applicant.view",
    "applicant.shortlist",
    "applicant.reject",
    "applicant.hire",
    "contact.reveal",
    "insights.view",
  ],
  POSTER: ["job.view", "job.create", "job.edit", "job.submit", "job.close", "social.promote"],
  SCREENER: [
    "job.view",
    "applicant.view",
    "applicant.shortlist",
    "applicant.reject",
    "contact.reveal",
  ],
  VIEWER: ["job.view", "insights.view"],
};

/** Only an OWNER may grant these to someone else (doc 05 §5.3; enforced by the team API, T4.1). */
export const OWNER_ONLY_GRANTS: readonly VenuePermission[] = ["team.manage", "billing.manage"];

const isVenuePermission = (k: unknown): k is VenuePermission =>
  typeof k === "string" && (VENUE_PERMISSIONS as readonly string[]).includes(k);

/** Parses a grant/revoke column (JSON string[]). Unknown or platform keys are dropped, never granted. */
export function parsePermissionList(json: string | null | undefined): VenuePermission[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter(isVenuePermission) : [];
  } catch {
    return [];
  }
}

export type MemberPermissionInput = { role: MemberRole; grant?: string; revoke?: string };

/** effective(member) = (PRESETS[role] ∪ grant) − revoke */
export function effectivePermissions(m: MemberPermissionInput): Set<VenuePermission> {
  const result = new Set<VenuePermission>([...PRESETS[m.role], ...parsePermissionList(m.grant)]);
  for (const key of parsePermissionList(m.revoke)) result.delete(key);
  return result;
}

/** Sorted array form for JSON (/api/me) in canonical key order. */
export function permissionList(perms: Set<VenuePermission>): VenuePermission[] {
  return VENUE_PERMISSIONS.filter((k) => perms.has(k));
}

/** Whether a member's grant/revoke differs from their preset (PermissionMatrix "Customised"). */
export function isCustomised(m: MemberPermissionInput): boolean {
  const preset = new Set(PRESETS[m.role]);
  const eff = effectivePermissions(m);
  return eff.size !== preset.size || [...eff].some((k) => !preset.has(k));
}
