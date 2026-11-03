import type { DemoStatus } from "@/lib/demo";
import { DAY_MS, clockOffsetMs, now } from "@/server/clock";
import { db } from "@/server/db";
import { requireDemoMode, toolkitLocked } from "@/server/demo/access";
import { apiHandler } from "@/server/http/handler";
import { SEED_VERSION } from "../../../../../prisma/seed/version";

export const GET = apiHandler(async (req) => {
  requireDemoMode();
  const stored = await db.demoSetting.findUnique({ where: { key: "seed_version" } });
  const status: DemoStatus = {
    locked: toolkitLocked(req),
    seedVersion: SEED_VERSION,
    resetNeeded: stored?.value !== SEED_VERSION,
    now: now().toISOString(),
    offsetDays: Math.round((clockOffsetMs() / DAY_MS) * 10) / 10,
  };
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
});
