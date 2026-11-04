import { clockOffsetMs, now } from "@/server/clock";
import { db } from "@/server/db";
import { apiHandler } from "@/server/http/handler";
import { SEED_VERSION } from "../../../../prisma/seed/version";

// TRD §13: DB reachability, seed version, clock offset, demo mode.
export const GET = apiHandler(async (req) => {
  // Reading the request keeps this a per-request handler. Without it Next prerenders the GET at
  // build time (it does not see Prisma queries) and serves build-time data from then on.
  void req.headers;
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
