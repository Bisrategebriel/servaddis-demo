import "server-only";
import { PrismaClient } from "@prisma/client";

// One client per process. In dev, Next re-evaluates modules on reload, so cache it on globalThis.
const globalForDb = globalThis as unknown as { db?: PrismaClient; walReady?: Promise<void> };

export const db = globalForDb.db ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;

/**
 * WAL lets readers (polling screens) run alongside a writer (TRD §3).
 * journal_mode is stored in the database file, so setting it once per process is enough.
 * PRAGMA returns a row, hence $queryRawUnsafe rather than $executeRaw.
 */
export function ensureWal(): Promise<void> {
  globalForDb.walReady ??= db
    .$queryRawUnsafe("PRAGMA journal_mode = WAL;")
    .then(() => undefined)
    .catch((err: unknown) => {
      globalForDb.walReady = undefined;
      throw err;
    });
  return globalForDb.walReady;
}
