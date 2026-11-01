import type { DemoStatus } from "@/lib/demo";
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
  };
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
});
