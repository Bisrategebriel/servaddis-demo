import "server-only";
import type { Prisma, User } from "@prisma/client";
import type { z } from "zod";
import type { venueCreateBody, venuePatchBody } from "@/lib/zod-schemas";
import { now } from "../clock";
import { db } from "../db";
import { conflict } from "../http/errors";
import { audit } from "./audit";

// Venue profile (E-02). New venues start UNSUBMITTED with the 3 founding-partner posts.

type VenueCreate = z.output<typeof venueCreateBody>;
type VenuePatch = z.output<typeof venuePatchBody>;

const subCityId = async (tx: Prisma.TransactionClient, slug: string) =>
  (await tx.subCity.findUniqueOrThrow({ where: { slug }, select: { id: true } })).id;

/** Creates the venue and its OWNER membership, and saves the owner's name (empty after OTP). */
export async function createVenue(user: User, input: VenueCreate) {
  const existing = await db.venueMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
  });
  if (existing) {
    throw conflict("You already have a venue.", "ድርጅት አስቀድመው አለዎት።", {
      reason: "VENUE_EXISTS",
    });
  }

  const at = now();
  const { ownerName, subCity, ...fields } = input;
  return db.$transaction(async (tx) => {
    const city = await tx.city.findUniqueOrThrow({ where: { slug: "addis-ababa" } });
    await tx.user.update({ where: { id: user.id }, data: { name: ownerName } });
    const venue = await tx.venue.create({
      data: {
        ...fields,
        cityId: city.id,
        subCityId: await subCityId(tx, subCity),
        createdAt: at,
        members: {
          create: {
            userId: user.id,
            displayName: ownerName,
            role: "OWNER",
            status: "ACTIVE",
            createdAt: at,
          },
        },
      },
    });
    await audit(tx, {
      actorId: user.id,
      action: "venue.create",
      entity: "Venue",
      entityId: venue.id,
    });
    return venue;
  });
}

export async function updateVenue(venueId: string, input: VenuePatch) {
  const { subCity, ...fields } = input;
  return db.$transaction(async (tx) =>
    tx.venue.update({
      where: { id: venueId },
      data: { ...fields, ...(subCity ? { subCityId: await subCityId(tx, subCity) } : {}) },
    }),
  );
}
