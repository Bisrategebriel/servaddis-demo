import "server-only";
import type { User } from "@prisma/client";
import {
  LICENSE_MIME_EXT,
  MAX_LICENSE_BYTES,
  isLicenseMime,
  safeFileName,
  sniffMime,
} from "@/lib/license-file";
import { storage } from "../adapters/storage";
import { now } from "../clock";
import { db } from "../db";
import { AppError, conflict } from "../http/errors";
import { audit } from "./audit";

// Business-license upload (E-03). UNSUBMITTED or REJECTED → PENDING (doc 05 §6.3); the file goes
// into the moderation queue as one LICENSE item.

const badFile = (reason: string, message: string, messageAm: string) =>
  new AppError("BAD_REQUEST", { message, messageAm, details: { reason } });

const tooLarge = () => badFile("TOO_LARGE", "The file is larger than 5 MB.", "ፋይሉ ከ5 ሜባ በላይ ነው።");

/** Rejects an oversized body before it is read into memory. */
export function assertUploadSize(req: Request) {
  const length = Number(req.headers.get("content-length") ?? 0);
  // A little slack: the multipart wrapper adds bytes around the file.
  if (length > MAX_LICENSE_BYTES + 64 * 1024) throw tooLarge();
}

export async function uploadLicense(user: User, venueId: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) {
    throw badFile("MISSING", "Choose a file to upload.", "የሚጫን ፋይል ይምረጡ።");
  }
  if (file.size > MAX_LICENSE_BYTES) throw tooLarge();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime || !isLicenseMime(file.type) || file.type !== mime) {
    throw badFile("BAD_TYPE", "Upload a PDF, JPG or PNG file.", "PDF፣ JPG ወይም PNG ፋይል ይጫኑ።");
  }

  const venue = await db.venue.findUniqueOrThrow({ where: { id: venueId } });
  if (venue.verification !== "UNSUBMITTED" && venue.verification !== "REJECTED") {
    throw conflict(
      venue.verification === "PENDING"
        ? "Your license is already under review."
        : "Your venue is already verified.",
      venue.verification === "PENDING" ? "ፈቃድዎ አስቀድሞ በግምገማ ላይ ነው።" : "ድርጅትዎ አስቀድሞ ተረጋግጧል።",
      { verification: venue.verification },
    );
  }

  const fileKey = await storage.save(bytes, LICENSE_MIME_EXT[mime]);
  const at = now();
  try {
    return await db.$transaction(async (tx) => {
      const license = await tx.licenseDocument.create({
        data: {
          venueId,
          fileKey,
          fileName: safeFileName(file.name),
          mime,
          sizeBytes: file.size,
          uploadedAt: at,
        },
      });
      await tx.moderationItem.create({
        data: { type: "LICENSE", licenseId: license.id, createdAt: at },
      });
      await tx.venue.update({ where: { id: venueId }, data: { verification: "PENDING" } });
      await audit(tx, {
        actorId: user.id,
        action: "license.upload",
        entity: "LicenseDocument",
        entityId: license.id,
        meta: { venueId },
      });
      return license;
    });
  } catch (err) {
    await storage.remove(fileKey);
    throw err;
  }
}
