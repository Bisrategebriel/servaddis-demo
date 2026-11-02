import "server-only";
import type { MemberRole, Prisma, User, VenueMember } from "@prisma/client";
import {
  OWNER_ONLY_GRANTS,
  PRESETS,
  effectivePermissions,
  parsePermissionList,
  permissionList,
  type VenuePermission,
} from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { db } from "../db";
import { AppError, conflict, notFound } from "../http/errors";
import type { VenueAccess } from "../policy/authorize";
import { audit } from "./audit";
import { sms } from "./notifications";

// Team management (E-17; App Flow §6.3; doc 05 §5.3). Every guard is enforced here, on the
// server: the UI only mirrors them.
//   · a venue always keeps ≥ 1 active OWNER (no removing or downgrading the last one)
//   · nobody can take away their own team.manage, or remove themselves
//   · only an OWNER may hand out team.manage / billing.manage, or make someone an OWNER
// grant/revoke are stored normalised: grant = keys beyond the preset, revoke = preset keys removed.

type Tx = Prisma.TransactionClient;

export type MemberInput = { role: MemberRole; grant: VenuePermission[]; revoke: VenuePermission[] };

function normalise(input: MemberInput) {
  const preset = new Set<VenuePermission>(PRESETS[input.role]);
  return {
    grant: [...new Set(input.grant)].filter((k) => !preset.has(k)),
    revoke: [...new Set(input.revoke)].filter((k) => preset.has(k)),
  };
}

const guard = (message: string, messageAm: string, reason: string) =>
  conflict(message, messageAm, { reason });

/** Only an Owner may give out the owner-only permissions or the Owner role itself. */
function checkOwnerOnly(actor: VenueMember, input: MemberInput, before?: VenueMember) {
  if (actor.role === "OWNER") return;
  const had = before ? effectivePermissions(before) : new Set<VenuePermission>();
  const after = effectivePermissions({
    role: input.role,
    ...stored(normalise(input)),
  });
  const newlyOwnerOnly = OWNER_ONLY_GRANTS.some((k) => after.has(k) && !had.has(k));
  if (input.role === "OWNER" || newlyOwnerOnly) {
    throw new AppError("FORBIDDEN", {
      message: "Only an owner can give team or billing access.",
      messageAm: "የቡድን ወይም የክፍያ ፈቃድ መስጠት የሚችለው ባለቤት ብቻ ነው።",
      details: { reason: "OWNER_ONLY" },
    });
  }
}

const stored = (n: { grant: VenuePermission[]; revoke: VenuePermission[] }) => ({
  grant: JSON.stringify(n.grant),
  revoke: JSON.stringify(n.revoke),
});

async function activeOwners(tx: Tx, venueId: string) {
  return tx.venueMember.count({ where: { venueId, role: "OWNER", status: "ACTIVE" } });
}

function toMember(
  m: VenueMember & { user: { name: string; phone: string } | null },
  selfId: string,
) {
  const phone = m.user?.phone ?? m.invitedPhone ?? "";
  return {
    id: m.id,
    name: m.user?.name || m.displayName,
    phone: phone ? formatPhone(phone) : "",
    role: m.role,
    status: m.status,
    grant: parsePermissionList(m.grant),
    revoke: parsePermissionList(m.revoke),
    permissions: permissionList(effectivePermissions(m)),
    isSelf: m.userId === selfId,
  };
}

export type TeamMember = ReturnType<typeof toMember>;

export async function listTeam(venueId: string, actor: User) {
  const members = await db.venueMember.findMany({
    where: { venueId, status: { not: "REMOVED" } },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, phone: true } } },
  });
  // Owners first, then by role preset order, then by who joined first.
  const order: MemberRole[] = ["OWNER", "HR_MANAGER", "POSTER", "SCREENER", "VIEWER"];
  members.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  return members.map((m) => toMember(m, actor.id));
}

const ROLE_EN: Record<MemberRole, string> = {
  OWNER: "Owner",
  HR_MANAGER: "HR manager",
  POSTER: "Poster",
  SCREENER: "Screener",
  VIEWER: "Viewer",
};

/**
 * Invite by phone (App Flow §6.3). An existing employer account with no venue joins at once;
 * otherwise the row waits as INVITED and activates when that phone signs in. A simulated SMS
 * tells the invitee either way.
 */
export async function inviteMember(
  actor: User,
  access: VenueAccess,
  venueId: string,
  input: MemberInput & { name: string; phone: string },
) {
  checkOwnerOnly(access.member, input);
  const n = normalise(input);
  const user = await db.user.findUnique({
    where: { phone: input.phone },
    include: { memberships: { where: { status: "ACTIVE" } } },
  });
  if (user && user.platformRole !== "EMPLOYER") {
    throw guard(
      "This number belongs to a jobseeker account, so it can't join a venue team.",
      "ይህ ቁጥር የሥራ ፈላጊ መለያ ስለሆነ የድርጅት ቡድን መቀላቀል አይችልም።",
      "NOT_AN_EMPLOYER",
    );
  }
  if (user && user.memberships.some((m) => m.venueId !== venueId)) {
    throw guard(
      "This person already works with another venue on Servaddis.",
      "ይህ ሰው በServaddis ላይ ከሌላ ድርጅት ጋር ይሠራል።",
      "OTHER_VENUE",
    );
  }
  const existing = await db.venueMember.findFirst({
    where: {
      venueId,
      OR: [{ invitedPhone: input.phone }, ...(user ? [{ userId: user.id }] : [])],
    },
  });
  if (existing && existing.status !== "REMOVED") {
    throw guard(
      "This person is already on your team.",
      "ይህ ሰው አስቀድሞ በቡድንዎ ውስጥ አለ።",
      "ALREADY_MEMBER",
    );
  }

  const venue = await db.venue.findUniqueOrThrow({ where: { id: venueId } });
  return db.$transaction(async (tx) => {
    const data = {
      displayName: input.name,
      role: input.role,
      ...stored(n),
      invitedPhone: input.phone,
      userId: user?.id ?? null,
      status: user ? ("ACTIVE" as const) : ("INVITED" as const),
    };
    const member = existing
      ? await tx.venueMember.update({ where: { id: existing.id }, data })
      : await tx.venueMember.create({ data: { venueId, ...data } });
    const url = process.env.PUBLIC_BASE_URL ?? "";
    await sms(
      tx,
      input.phone,
      `Servaddis: ${venue.nameEn} invited you to join their team as ${ROLE_EN[input.role]}. ` +
        `Sign in with this number${url ? ` at ${url}/login` : ""}. / ` +
        `Servaddis፦ ${venue.nameAm ?? venue.nameEn} ቡድናቸውን እንዲቀላቀሉ ጋብዘዎታል። በዚህ ቁጥር ይግቡ።`,
      "INVITE",
    );
    await audit(tx, {
      actorId: actor.id,
      action: "team.invite",
      entity: "VenueMember",
      entityId: member.id,
      meta: { venueId, role: input.role, ...n },
    });
    return member;
  });
}

async function memberOf(venueId: string, memberId: string) {
  const member = await db.venueMember.findUnique({ where: { id: memberId } });
  // Another venue's member, or a removed one, looks like a missing one (doc 05 §5.3).
  if (!member || member.venueId !== venueId || member.status === "REMOVED") throw notFound();
  return member;
}

/** Role and toggles. Takes effect on the member's next request (App Flow §6.3 step 4). */
export async function updateMember(
  actor: User,
  access: VenueAccess,
  venueId: string,
  memberId: string,
  input: MemberInput,
) {
  const before = await memberOf(venueId, memberId);
  checkOwnerOnly(access.member, input, before);
  const n = normalise(input);
  const after = effectivePermissions({ role: input.role, ...stored(n) });

  if (before.id === access.member.id && !after.has("team.manage")) {
    throw guard(
      "You can't take away your own team access. Ask another owner.",
      "የራስዎን የቡድን አስተዳደር ፈቃድ ማንሳት አይችሉም። ሌላ ባለቤት ይጠይቁ።",
      "SELF_LOCKOUT",
    );
  }
  return db.$transaction(async (tx) => {
    if (before.role === "OWNER" && input.role !== "OWNER" && before.status === "ACTIVE") {
      if ((await activeOwners(tx, venueId)) <= 1) {
        throw guard(
          "A venue needs at least one owner. Make someone else an owner first.",
          "ድርጅቱ ቢያንስ አንድ ባለቤት ያስፈልገዋል። መጀመሪያ ሌላ ሰው ባለቤት ያድርጉ።",
          "LAST_OWNER",
        );
      }
    }
    const updated = await tx.venueMember.update({
      where: { id: memberId },
      data: { role: input.role, ...stored(n) },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "team.permission_change",
      entity: "VenueMember",
      entityId: memberId,
      meta: {
        venueId,
        before: {
          role: before.role,
          grant: parsePermissionList(before.grant),
          revoke: parsePermissionList(before.revoke),
        },
        after: { role: input.role, ...n },
      },
    });
    return updated;
  });
}

/** Removed members lose venue access on their next request; the row stays for the audit trail. */
export async function removeMember(
  actor: User,
  access: VenueAccess,
  venueId: string,
  memberId: string,
) {
  const member = await memberOf(venueId, memberId);
  if (member.id === access.member.id) {
    throw guard(
      "You can't remove yourself. Ask another owner.",
      "ራስዎን ማስወገድ አይችሉም። ሌላ ባለቤት ይጠይቁ።",
      "SELF_REMOVE",
    );
  }
  return db.$transaction(async (tx) => {
    if (
      member.role === "OWNER" &&
      member.status === "ACTIVE" &&
      (await activeOwners(tx, venueId)) <= 1
    ) {
      throw guard("A venue needs at least one owner.", "ድርጅቱ ቢያንስ አንድ ባለቤት ያስፈልገዋል።", "LAST_OWNER");
    }
    const removed = await tx.venueMember.update({
      where: { id: memberId },
      data: { status: "REMOVED" },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "team.remove",
      entity: "VenueMember",
      entityId: memberId,
      meta: { venueId, role: member.role },
    });
    return removed;
  });
}
