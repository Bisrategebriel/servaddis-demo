import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as cardRoute } from "@/app/api/jobs/[id]/card/route";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { createJob, hiwot, resetDb } from "./helpers";

const BASE = "http://localhost:3000";

const card = async (id: string, query = "", user?: User) =>
  cardRoute(
    new Request(`${BASE}/api/jobs/${id}/card${query}`, {
      headers: user
        ? {
            cookie: `sv_session=${await signSessionToken({ userId: user.id, role: user.platformRole })}`,
          }
        : {},
    }),
    { params: Promise.resolve({ id }) },
  );

/** Width and height from the PNG header (IHDR follows the 8-byte signature). */
async function pngSize(res: Response) {
  const buf = Buffer.from(await res.arrayBuffer());
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("GET /api/jobs/:id/card (TRD §5.6)", () => {
  beforeEach(resetDb);

  it.each([
    ["en", "square", 1080, 1080],
    ["am", "square", 1080, 1080],
    ["en", "story", 1080, 1920],
    ["am", "story", 1080, 1920],
  ] as const)(
    "renders a %s %s PNG at %i×%i, publicly for a live job",
    async (lang, size, w, h) => {
      const job = await db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent" } });
      const res = await card(job.id, `?lang=${lang}&size=${size}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(await pngSize(res)).toEqual({ width: w, height: h });
    },
    30_000,
  );

  it("defaults to an English square card", async () => {
    const job = await db.job.findFirstOrThrow({ where: { urgency: "HALF_DAY" } });
    expect(await pngSize(await card(job.id))).toEqual({ width: 1080, height: 1080 });
  }, 30_000);

  it("needs a venue member with job.view for a job that isn't live", async () => {
    const { venue, selam } = await hiwot();
    const draft = await createJob(venue.id, selam.id, { status: "DRAFT" });
    expect((await card(draft.id)).status).toBe(401);
    const henock = await db.user.findUniqueOrThrow({ where: { phone: "+251911000005" } });
    expect((await card(draft.id, "", henock)).status).toBe(404);
    expect((await card(draft.id, "", selam)).status).toBe(200);
  }, 30_000);

  it("rejects bad options and unknown jobs", async () => {
    const job = await db.job.findFirstOrThrow({ where: { titleEn: "Front Desk Agent" } });
    expect((await card(job.id, "?lang=fr")).status).toBe(400);
    expect((await card(job.id, "?size=banner")).status).toBe(400);
    expect((await card("nope")).status).toBe(404);
  });
});
