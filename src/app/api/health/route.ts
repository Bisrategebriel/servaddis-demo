import { clockOffsetMs, now } from "@/server/clock";
import { db } from "@/server/db";
import { apiHandler } from "@/server/http/handler";
import { SEED_VERSION } from "../../../../prisma/seed/version";

// TRD §13: DB reachability, seed version, clock offset, demo mode.
export const GET = apiHandler(async () => {
  const stored = await db.demoSetting.findUnique({ where: { key: "seed_version" } });
  return Response.json(
    {
      ok: true,
      db: "ok",
      demoMode: process.env.DEMO_MODE === "1",
      seedVersion: { code: SEED_VERSION, database: stored?.value ?? null },
      resetNeeded: stored?.value !== SEED_VERSION,
      clock: { now: now().toISOString(), offsetMs: clockOffsetMs() },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
