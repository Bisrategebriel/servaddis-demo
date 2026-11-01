import "server-only";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { seed, type SeedSummary } from "../../../prisma/seed/seed";
import { loadClockOffset } from "../clock";
import { db } from "../db";
import { resetRateLimits } from "../rate-limit";

/** Empties a storage folder. Refuses anything outside ./data, whatever the env says. */
async function clearDir(dir: string) {
  const dataDir = path.resolve("data");
  const target = path.resolve(dir);
  if (!target.startsWith(dataDir + path.sep)) {
    throw new Error(`Refusing to clear ${target}: not inside ${dataDir}`);
  }
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}

/**
 * Back to the seeded state (doc 05 §9.6): re-seed, clear uploads and cards, clock offset 0.
 * Every user is recreated with a new id, so all existing sessions end.
 */
export async function resetDemo(): Promise<SeedSummary> {
  const summary = await seed(db);
  await clearDir(process.env.UPLOAD_DIR ?? "./data/uploads");
  await clearDir(process.env.CARD_DIR ?? "./data/cards");
  await loadClockOffset();
  resetRateLimits();
  return summary;
}
