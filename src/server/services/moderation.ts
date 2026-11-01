import "server-only";
import type { ModerationStatus, ModerationType, Prisma, User } from "@prisma/client";
import { now } from "../clock";
import { db } from "../db";
import { conflict, notFound } from "../http/errors";
import { audit } from "./audit";
import { notify, sms } from "./notifications";

// Moderation queue (A-01…A-03). Every decision is one transaction: item + target + notification
// + simulated SMS + audit (TRD §5.3). Job decisions join this switch in T2.5.

export type Decision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

const itemInclude = {
  license: { include: { venue: { select: { id: true, nameEn: true, nameAm: true } } } },
} satisfies Prisma.ModerationItemInclude;

export async function listQueue(type: ModerationType | undefined, status: ModerationStatus) {
  const items = await db.moderationItem.findMany({
    where: { status, ...(type ? { type } : {}) },
    orderBy: { createdAt: "asc" },
    include: itemInclude,
  });
  const at = now().getTime();
  return items.map((i) => ({
    id: i.id,
    type: i.type,
    status: i.status,
    title: i.license?.venue.nameEn ?? "",
    fileName: i.license?.fileName ?? null,
    ageMinutes: Math.max(0, Math.floor((at - i.createdAt.getTime()) / 60_000)),
    flagCount: (JSON.parse(i.flags) as unknown[]).length,
    isFastApprove: i.isFastApprove,
  }));
}

export async function getItem(id: string) {
  const item = await db.moderationItem.findUnique({ where: { id }, include: itemInclude });
  if (!item) throw notFound();
  return item;
}

async function ownersOf(tx: Prisma.TransactionClient, venueId: string) {
  const members = await tx.venueMember.findMany({
    where: { venueId, role: "OWNER", status: "ACTIVE", userId: { not: null } },
    select: { user: { select: { id: true, phone: true, locale: true } } },
  });
  return members.map((m) => m.user!);
}

const DECIDED_STATUS: Record<Decision, ModerationStatus> = {
  APPROVE: "APPROVED",
  REQUEST_CHANGES: "CHANGES_REQUESTED",
  REJECT: "REJECTED",
};

async function decideLicense(
  tx: Prisma.TransactionClient,
  admin: User,
  item: Awaited<ReturnType<typeof getItem>>,
  decision: Decision,
  reason: string | undefined,
  at: Date,
) {
  const license = item.license!;
  const venueId = license.venueId;
  const approved = decision === "APPROVE";

  await tx.licenseDocument.update({
    where: { id: license.id },
    data: {
      status: DECIDED_STATUS[decision],
      reviewedById: admin.id,
      reviewedAt: at,
      rejectionReason: approved ? null : reason,
    },
  });
  await tx.venue.update({
    where: { id: venueId },
    data: approved
      ? { verification: "VERIFIED", verifiedAt: at }
      : { verification: "REJECTED", verifiedAt: null },
  });

  const owners = await ownersOf(tx, venueId);
  const name = { en: license.venue.nameEn, am: license.venue.nameAm ?? license.venue.nameEn };
  await notify(
    tx,
    owners.map((o) => o.id),
    approved
      ? {
          kind: "VENUE_VERIFIED",
          titleEn: "Your venue is verified",
          titleAm: "ድርጅትዎ ተረጋግጧል",
          bodyEn: `${name.en} can now publish jobs.`,
          bodyAm: `${name.am} አሁን ሥራዎችን ማውጣት ይችላል።`,
          href: "/employer",
        }
      : {
          kind: "VENUE_REJECTED",
          titleEn: "Your license was not accepted",
          titleAm: "ፈቃድዎ ተቀባይነት አላገኘም",
          bodyEn: reason,
          bodyAm: reason,
          href: "/employer/onboarding/license",
        },
  );
  for (const o of owners) {
    const am = approved
      ? `Servaddis፦ ${name.am} ተረጋግጧል። አሁን ሥራ ማውጣት ይችላሉ።`
      : `Servaddis፦ የ${name.am} ፈቃድ ተቀባይነት አላገኘም። ${reason}`;
    const en = approved
      ? `Servaddis: ${name.en} is verified. You can now publish jobs.`
      : `Servaddis: the license for ${name.en} was not accepted. ${reason}`;
    await sms(tx, o.phone, o.locale === "AM" ? am : en, "ALERT");
  }
}

export async function decide(admin: User, id: string, decision: Decision, reason?: string) {
  const item = await getItem(id);
  if (item.status !== "PENDING") {
    throw conflict("This item has already been decided.", "በዚህ ጉዳይ ላይ አስቀድሞ ውሳኔ ተሰጥቷል።", {
      status: item.status,
    });
  }
  if (item.type !== "LICENSE") {
    throw conflict("This item type can't be decided yet.", "ይህ ዓይነት ጉዳይ ገና ውሳኔ ሊሰጥበት አይችልም።");
  }
  if (decision === "REQUEST_CHANGES") {
    throw conflict(
      "A license is approved or rejected. Rejecting lets the owner upload a new one.",
      "ፈቃድ ይጸድቃል ወይም ውድቅ ይሆናል። ውድቅ ሲሆን ባለቤቱ አዲስ መጫን ይችላል።",
    );
  }

  const at = now();
  return db.$transaction(async (tx) => {
    await decideLicense(tx, admin, item, decision, reason, at);
    const updated = await tx.moderationItem.update({
      where: { id },
      data: { status: DECIDED_STATUS[decision], reviewerId: admin.id, reason, decidedAt: at },
    });
    await audit(tx, {
      actorId: admin.id,
      action: `license.${decision.toLowerCase()}`,
      entity: "ModerationItem",
      entityId: id,
      meta: { venueId: item.license!.venueId, reason },
    });
    return updated;
  });
}
