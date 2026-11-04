import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { MemberRole, User } from "@prisma/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET as auditGet } from "@/app/api/admin/audit/route";
import { POST as decisionPost } from "@/app/api/admin/moderation/[id]/decision/route";
import { GET as moderationItemGet } from "@/app/api/admin/moderation/[id]/route";
import { GET as moderationGet } from "@/app/api/admin/moderation/route";
import { POST as hirePost } from "@/app/api/applications/[id]/hire/route";
import { POST as rejectPost } from "@/app/api/applications/[id]/reject/route";
import { POST as revealPost } from "@/app/api/applications/[id]/reveal-contact/route";
import { GET as applicationGet } from "@/app/api/applications/[id]/route";
import { POST as shortlistPost } from "@/app/api/applications/[id]/shortlist/route";
import { POST as viewPost } from "@/app/api/applications/[id]/view/route";
import { POST as checkoutPost } from "@/app/api/billing/checkout/route";
import { GET as paymentGet } from "@/app/api/billing/payments/[id]/route";
import { GET as plansGet } from "@/app/api/billing/plans/route";
import { POST as simPost } from "@/app/api/billing/sim/[paymentId]/route";
import { GET as fileGet } from "@/app/api/files/[fileKey]/route";
import { GET as applicantsGet } from "@/app/api/jobs/[id]/applicants/route";
import { POST as applyPost } from "@/app/api/jobs/[id]/apply/route";
import { POST as closePost } from "@/app/api/jobs/[id]/close/route";
import { GET as distributionGet } from "@/app/api/jobs/[id]/distribution/route";
import { POST as promotePost } from "@/app/api/jobs/[id]/promote/route";
import { POST as repostPost } from "@/app/api/jobs/[id]/repost/route";
import { GET as jobGet, PATCH as jobPatch } from "@/app/api/jobs/[id]/route";
import { POST as submitPost } from "@/app/api/jobs/[id]/submit/route";
import { POST as checkPost } from "@/app/api/jobs/check/route";
import { POST as jobsPost } from "@/app/api/jobs/route";
import { GET as myApplicationsGet } from "@/app/api/me/applications/route";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/me/profile/route";
import { POST as readPost } from "@/app/api/notifications/read/route";
import { GET as notificationsGet } from "@/app/api/notifications/route";
import { GET as insightsGet } from "@/app/api/venues/[id]/insights/route";
import { POST as licensePost } from "@/app/api/venues/[id]/license/route";
import { GET as venueGet, PATCH as venuePatch } from "@/app/api/venues/[id]/route";
import { GET as summaryGet } from "@/app/api/venues/[id]/summary/route";
import {
  DELETE as memberDelete,
  PATCH as memberPatch,
} from "@/app/api/venues/[id]/team/[memberId]/route";
import { GET as teamGet, POST as teamPost } from "@/app/api/venues/[id]/team/route";
import { POST as venuesPost } from "@/app/api/venues/route";
import { PRESETS, type VenuePermission } from "@/lib/permissions";
import { db } from "@/server/db";
import { signSessionToken } from "@/server/session";
import { createJob, resetDb } from "./helpers";

// Promote hands rendering to after(), which needs a real request scope. The matrix is about the
// guard, so the background work is skipped here (tests/integration/promote.test.ts covers it).
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => {},
}));

// TRD §12 "API/integration: each endpoint × role matrix". Every guarded route, called through
// its real handler, by every persona. The expected outcome comes from the role presets (which
// tests/integration/authorize.test.ts checks against doc 03 §6.1):
//   signed out → 401 · not a member of the resource's venue → 404 (no existence leak)
//   member without the permission → 403 · wrong platform role → 403
//   allowed → anything else below 500 (200, 201, or a 400/409 from the body or state).

type Persona = "anon" | "selam" | "meseret" | "yared" | "rahel" | "henock" | "dawit" | "admin";
const PHONES: Record<Exclude<Persona, "anon">, string> = {
  selam: "+251911000001", // Hiwot OWNER
  meseret: "+251911000004", // Hiwot HR_MANAGER
  yared: "+251911000002", // Hiwot POSTER
  rahel: "+251911000003", // Hiwot SCREENER
  henock: "+251911000005", // Piassa OWNER (outsider to Hiwot)
  dawit: "+251922000001", // jobseeker
  admin: "+251911000009", // moderator
};
const HIWOT_ROLE: Partial<Record<Persona, MemberRole>> = {
  selam: "OWNER",
  meseret: "HR_MANAGER",
  yared: "POSTER",
  rahel: "SCREENER",
};
const PERSONAS: Persona[] = [
  "anon",
  "selam",
  "meseret",
  "yared",
  "rahel",
  "henock",
  "dawit",
  "admin",
];

type Expect = "allowed" | 401 | 403 | 404;
const hiwotHas = (p: Persona, perm: VenuePermission) =>
  !!HIWOT_ROLE[p] && PRESETS[HIWOT_ROLE[p]!].includes(perm);

/** A Hiwot resource guarded by a venue permission. */
const venuePerm =
  (perm: VenuePermission) =>
  (p: Persona): Expect =>
    p === "anon" ? 401 : !HIWOT_ROLE[p] ? 404 : hiwotHas(p, perm) ? "allowed" : 403;
/** Platform role only (`withAuth({ role })`). */
const role =
  (r: "JOBSEEKER" | "EMPLOYER") =>
  (p: Persona): Expect =>
    p === "anon"
      ? 401
      : (r === "JOBSEEKER" ? p === "dawit" : !!HIWOT_ROLE[p] || p === "henock")
        ? "allowed"
        : 403;
/** Employer role, then a permission on the caller's own venue (Henock owns Piassa). */
const ownVenue =
  (perm: VenuePermission) =>
  (p: Persona): Expect =>
    p === "anon"
      ? 401
      : p === "henock"
        ? "allowed"
        : role("EMPLOYER")(p) === 403
          ? 403
          : hiwotHas(p, perm)
            ? "allowed"
            : 403;
/** As ownVenue, but the resource (a payment) belongs to Hiwot: Henock can't see it. */
const ownVenueHiwot =
  (perm: VenuePermission) =>
  (p: Persona): Expect =>
    p === "henock" ? 404 : ownVenue(perm)(p);
const platform = (p: Persona): Expect => (p === "anon" ? 401 : p === "admin" ? "allowed" : 403);
const signedIn = (p: Persona): Expect => (p === "anon" ? 401 : "allowed");
/** A license file: the moderator, or someone who may edit that venue (Lideta: none of ours). */
const lidetaFile = (p: Persona): Expect => (p === "anon" ? 401 : p === "admin" ? "allowed" : 404);

type Ctx = {
  job: string; // Hiwot's live Front Desk Agent
  draft: string; // a Hiwot draft
  app: string; // Hana's shortlisted application
  venue: string; // Hiwot
  member: string; // Rahel's membership
  payment: string; // a pending Hiwot payment
  item: string; // the pending Lideta license item
  fileKey: string;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx: any) => Promise<Response>;
type Row = {
  name: string;
  route: string; // route folder, for the completeness check
  method: "GET" | "POST" | "PATCH" | "DELETE";
  handler: Handler;
  params: (c: Ctx) => Record<string, string>;
  body?: unknown;
  expect: (p: Persona) => Expect;
};

const none = () => ({});
// Mutations run after the reads, and the most destructive last, so earlier rows see the
// seeded state. Each persona starts from a fresh seed.
const ROWS: Row[] = [
  {
    name: "GET job",
    route: "jobs/[id]",
    method: "GET",
    handler: jobGet,
    params: (c) => ({ id: c.job }),
    expect: venuePerm("job.view"),
  },
  {
    name: "GET applicants",
    route: "jobs/[id]/applicants",
    method: "GET",
    handler: applicantsGet,
    params: (c) => ({ id: c.job }),
    expect: venuePerm("applicant.view"),
  },
  {
    name: "GET distribution",
    route: "jobs/[id]/distribution",
    method: "GET",
    handler: distributionGet,
    params: (c) => ({ id: c.job }),
    expect: venuePerm("job.view"),
  },
  {
    name: "GET application",
    route: "applications/[id]",
    method: "GET",
    handler: applicationGet,
    params: (c) => ({ id: c.app }),
    expect: venuePerm("applicant.view"),
  },
  {
    name: "GET venue",
    route: "venues/[id]",
    method: "GET",
    handler: venueGet,
    params: (c) => ({ id: c.venue }),
    expect: venuePerm("job.view"),
  },
  {
    name: "GET summary",
    route: "venues/[id]/summary",
    method: "GET",
    handler: summaryGet,
    params: (c) => ({ id: c.venue }),
    expect: venuePerm("job.view"),
  },
  {
    name: "GET insights",
    route: "venues/[id]/insights",
    method: "GET",
    handler: insightsGet,
    params: (c) => ({ id: c.venue }),
    expect: venuePerm("insights.view"),
  },
  {
    name: "GET team",
    route: "venues/[id]/team",
    method: "GET",
    handler: teamGet,
    params: (c) => ({ id: c.venue }),
    expect: venuePerm("team.manage"),
  },
  {
    name: "GET plans",
    route: "billing/plans",
    method: "GET",
    handler: plansGet,
    params: none,
    expect: ownVenue("billing.manage"),
  },
  {
    name: "GET payment",
    route: "billing/payments/[id]",
    method: "GET",
    handler: paymentGet,
    params: (c) => ({ id: c.payment }),
    expect: ownVenueHiwot("billing.manage"),
  },
  {
    name: "GET my applications",
    route: "me/applications",
    method: "GET",
    handler: myApplicationsGet,
    params: none,
    expect: role("JOBSEEKER"),
  },
  {
    name: "GET profile",
    route: "me/profile",
    method: "GET",
    handler: profileGet,
    params: none,
    expect: role("JOBSEEKER"),
  },
  {
    name: "GET notifications",
    route: "notifications",
    method: "GET",
    handler: notificationsGet,
    params: none,
    expect: signedIn,
  },
  {
    name: "GET moderation queue",
    route: "admin/moderation",
    method: "GET",
    handler: moderationGet,
    params: none,
    expect: platform,
  },
  {
    name: "GET moderation item",
    route: "admin/moderation/[id]",
    method: "GET",
    handler: moderationItemGet,
    params: (c) => ({ id: c.item }),
    expect: platform,
  },
  {
    name: "GET audit",
    route: "admin/audit",
    method: "GET",
    handler: auditGet,
    params: none,
    expect: platform,
  },
  {
    name: "GET license file",
    route: "files/[fileKey]",
    method: "GET",
    handler: fileGet,
    params: (c) => ({ fileKey: c.fileKey }),
    expect: lidetaFile,
  },

  {
    name: "POST check draft",
    route: "jobs/check",
    method: "POST",
    handler: checkPost,
    params: none,
    body: {},
    expect: ownVenue("job.create"),
  },
  {
    name: "POST create job",
    route: "jobs",
    method: "POST",
    handler: jobsPost,
    params: none,
    body: {},
    expect: ownVenue("job.create"),
  },
  {
    name: "POST create venue",
    route: "venues",
    method: "POST",
    handler: venuesPost,
    params: none,
    body: {},
    expect: role("EMPLOYER"),
  },
  {
    name: "PATCH job",
    route: "jobs/[id]",
    method: "PATCH",
    handler: jobPatch,
    params: (c) => ({ id: c.draft }),
    body: {},
    expect: venuePerm("job.edit"),
  },
  {
    name: "PATCH venue",
    route: "venues/[id]",
    method: "PATCH",
    handler: venuePatch,
    params: (c) => ({ id: c.venue }),
    body: { nameEn: "" },
    expect: venuePerm("venue.edit"),
  },
  {
    name: "POST license",
    route: "venues/[id]/license",
    method: "POST",
    handler: licensePost,
    params: (c) => ({ id: c.venue }),
    expect: venuePerm("venue.edit"),
  },
  {
    name: "POST invite",
    route: "venues/[id]/team",
    method: "POST",
    handler: teamPost,
    params: (c) => ({ id: c.venue }),
    body: {},
    expect: venuePerm("team.manage"),
  },
  {
    name: "PATCH member",
    route: "venues/[id]/team/[memberId]",
    method: "PATCH",
    handler: memberPatch,
    params: (c) => ({ id: c.venue, memberId: c.member }),
    body: {},
    expect: venuePerm("team.manage"),
  },
  {
    name: "POST view applicant",
    route: "applications/[id]/view",
    method: "POST",
    handler: viewPost,
    params: (c) => ({ id: c.app }),
    expect: venuePerm("applicant.view"),
  },
  {
    name: "POST shortlist",
    route: "applications/[id]/shortlist",
    method: "POST",
    handler: shortlistPost,
    params: (c) => ({ id: c.app }),
    expect: venuePerm("applicant.shortlist"),
  },
  {
    name: "POST reveal contact",
    route: "applications/[id]/reveal-contact",
    method: "POST",
    handler: revealPost,
    params: (c) => ({ id: c.app }),
    expect: venuePerm("contact.reveal"),
  },
  {
    name: "POST reject",
    route: "applications/[id]/reject",
    method: "POST",
    handler: rejectPost,
    params: (c) => ({ id: c.app }),
    body: {},
    expect: venuePerm("applicant.reject"),
  },
  {
    name: "POST hire",
    route: "applications/[id]/hire",
    method: "POST",
    handler: hirePost,
    params: (c) => ({ id: c.app }),
    expect: venuePerm("applicant.hire"),
  },
  {
    name: "POST apply",
    route: "jobs/[id]/apply",
    method: "POST",
    handler: applyPost,
    params: (c) => ({ id: c.job }),
    body: {},
    expect: role("JOBSEEKER"),
  },
  {
    name: "PATCH profile",
    route: "me/profile",
    method: "PATCH",
    handler: profilePatch,
    params: none,
    body: {},
    expect: role("JOBSEEKER"),
  },
  {
    name: "POST mark read",
    route: "notifications/read",
    method: "POST",
    handler: readPost,
    params: none,
    body: { ids: [] },
    expect: signedIn,
  },
  {
    name: "POST promote",
    route: "jobs/[id]/promote",
    method: "POST",
    handler: promotePost,
    params: (c) => ({ id: c.job }),
    body: {},
    expect: venuePerm("social.promote"),
  },
  {
    name: "POST submit",
    route: "jobs/[id]/submit",
    method: "POST",
    handler: submitPost,
    params: (c) => ({ id: c.draft }),
    expect: venuePerm("job.submit"),
  },
  {
    name: "POST checkout",
    route: "billing/checkout",
    method: "POST",
    handler: checkoutPost,
    params: none,
    body: {},
    expect: ownVenue("billing.manage"),
  },
  {
    name: "POST simulated payment",
    route: "billing/sim/[paymentId]",
    method: "POST",
    handler: simPost,
    params: (c) => ({ paymentId: c.payment }),
    body: {},
    expect: ownVenueHiwot("billing.manage"),
  },
  {
    name: "POST decision",
    route: "admin/moderation/[id]/decision",
    method: "POST",
    handler: decisionPost,
    params: (c) => ({ id: c.item }),
    body: {},
    expect: platform,
  },
  {
    name: "POST close",
    route: "jobs/[id]/close",
    method: "POST",
    handler: closePost,
    params: (c) => ({ id: c.job }),
    expect: venuePerm("job.close"),
  },
  {
    name: "POST repost",
    route: "jobs/[id]/repost",
    method: "POST",
    handler: repostPost,
    params: (c) => ({ id: c.job }),
    expect: venuePerm("job.close"),
  },
  {
    name: "DELETE member",
    route: "venues/[id]/team/[memberId]",
    method: "DELETE",
    handler: memberDelete,
    params: (c) => ({ id: c.venue, memberId: c.member }),
    expect: venuePerm("team.manage"),
  },
];

const BASE = "http://localhost:3000";

async function call(row: Row, user: User | null, c: Ctx) {
  const headers: Record<string, string> = { origin: BASE };
  if (row.body !== undefined) headers["content-type"] = "application/json";
  if (user) {
    headers.cookie = `sv_session=${await signSessionToken({ userId: user.id, role: user.platformRole })}`;
  }
  const req = new Request(`${BASE}/api/${row.route}`, {
    method: row.method,
    headers,
    body: row.body === undefined ? undefined : JSON.stringify(row.body),
  });
  return row.handler(req, { params: Promise.resolve(row.params(c)) });
}

async function fixture(): Promise<Ctx> {
  const venue = await db.venue.findFirstOrThrow({ where: { nameEn: "Hiwot Garden Hotel" } });
  const selam = await db.user.findUniqueOrThrow({ where: { phone: PHONES.selam } });
  const job = await db.job.findFirstOrThrow({
    where: { titleEn: "Front Desk Agent", status: "LIVE" },
  });
  const draft = await createJob(venue.id, selam.id, { status: "DRAFT" });
  const app = await db.application.findFirstOrThrow({
    where: { jobId: job.id, jobseeker: { name: "Hana Bekele" } },
  });
  const rahel = await db.user.findUniqueOrThrow({ where: { phone: PHONES.rahel } });
  const member = await db.venueMember.findFirstOrThrow({
    where: { venueId: venue.id, userId: rahel.id },
  });
  const plan = await db.plan.findUniqueOrThrow({ where: { code: "STANDARD" } });
  const payment = await db.payment.create({
    data: {
      venueId: venue.id,
      planId: plan.id,
      provider: "CHAPA_SIM",
      providerRef: `rbac-${Date.now()}`,
      amountEtb: plan.priceEtb,
      vatEtb: Math.round(plan.priceEtb * 0.15),
    },
  });
  const item = await db.moderationItem.findFirstOrThrow({
    where: { type: "LICENSE", status: "PENDING" },
    include: { license: true },
  });
  return {
    job: job.id,
    draft: draft.id,
    app: app.id,
    venue: venue.id,
    member: member.id,
    payment: payment.id,
    item: item.id,
    fileKey: item.license!.fileKey,
  };
}

describe("RBAC API matrix (TRD §12)", () => {
  it("covers every guarded route and method", () => {
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? walk(path.join(d, e.name))
          : e.name === "route.ts"
            ? [path.join(d, e.name)]
            : [],
      );
    const guarded = walk("src/app/api").flatMap((file) => {
      const src = readFileSync(file, "utf8");
      const route = path.relative("src/app/api", path.dirname(file)).split(path.sep).join("/");
      return [...src.matchAll(/export const (GET|POST|PATCH|DELETE) = withAuth\(/g)].map(
        (m) => `${m[1]} ${route}`,
      );
    });
    const covered = new Set(ROWS.map((r) => `${r.method} ${r.route}`));
    expect(guarded.filter((g) => !covered.has(g))).toEqual([]);
  });

  describe.each(PERSONAS)("%s", (persona) => {
    let user: User | null = null;
    let ctx: Ctx;
    beforeAll(async () => {
      await resetDb();
      ctx = await fixture();
      user =
        persona === "anon"
          ? null
          : await db.user.findUniqueOrThrow({ where: { phone: PHONES[persona] } });
    });

    it("gets exactly the outcome its role allows on every endpoint", async () => {
      const wrong: string[] = [];
      for (const row of ROWS) {
        const want = row.expect(persona);
        const got = (await call(row, user, ctx)).status;
        const ok = want === "allowed" ? got < 500 && ![401, 403, 404].includes(got) : got === want;
        if (!ok) wrong.push(`${row.name}: expected ${want}, got ${got}`);
      }
      expect(wrong).toEqual([]);
    }, 60_000);
  });
});
