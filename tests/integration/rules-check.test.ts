import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as check } from "@/app/api/jobs/check/route";
import { formFromTemplate, toJobPayload } from "@/lib/job-form";
import { prefillFromTemplate } from "@/lib/role-template";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { resetDb } from "./helpers";

const byPhone = (phone: string) => db.user.findUniqueOrThrow({ where: { phone } });
const run = async (u: User, body: unknown) =>
  check(
    new Request("http://localhost:3000/api/jobs/check", {
      method: "POST",
      headers: {
        cookie: `sv_session=${await signSessionToken({ userId: u.id, role: u.platformRole })}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );
async function body(slug: string) {
  const row = await db.roleTemplate.findUniqueOrThrow({ where: { slug } });
  return toJobPayload(formFromTemplate(prefillFromTemplate(row), "bole"));
}

describe("POST /api/jobs/check", () => {
  beforeEach(resetDb);

  it("finds no issues in an untouched template", async () => {
    const res = await run(await byPhone("+251911000001"), await body("barista"));
    expect(await res.json()).toEqual({ flags: [], blocked: false });
  });

  it("blocks a fee request and warns on a phone number, without saving anything", async () => {
    const b = await body("barista");
    b.descriptionEn += " Registration fee ETB 200. Call 0911223344.";
    const before = await db.job.count();
    const out = await (await run(await byPhone("+251911000001"), b)).json();
    expect(out.blocked).toBe(true);
    expect(out.flags.map((f: { ruleId: string }) => f.ruleId)).toEqual([
      "no-fee",
      "offplatform-contact",
    ]);
    expect(await db.job.count()).toBe(before);
  });

  it("uses the template's salary hint and family", async () => {
    const spa = await body("spa-therapist");
    const out = await (await run(await byPhone("+251911000001"), spa)).json();
    expect(out.flags).toEqual([expect.objectContaining({ ruleId: "sensitive-family" })]);
  });

  it("needs job.create", async () => {
    expect((await run(await byPhone("+251911000003"), await body("barista"))).status).toBe(403);
  });
});
