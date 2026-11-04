import "server-only";
import type { AuditLog } from "@prisma/client";
import { DAY_MS, now } from "../clock";
import { db } from "../db";

// Admin side of the audit trail (SCR-A03, PRD A-04) and the platform counts (A-05). Rows are
// written by services/audit.ts; here they are filtered, paged and given readable context: which
// venue, which job, which applicant. The meta JSON is never sent raw.

export const AUDIT_CATEGORIES = {
  moderation: [
    "license.approve",
    "license.reject",
    "job.approve",
    "job.request_changes",
    "job.reject",
  ],
  contact: ["application.contact_reveal"],
  team: ["team.invite", "team.permission_change", "team.remove"],
  billing: ["billing.checkout", "billing.payment_succeeded", "billing.payment_failed"],
  jobs: ["job.submit", "job.repost", "job.close", "job.promote"],
  venues: ["venue.create", "venue.update", "license.upload"],
  denied: ["authz.denied"],
} as const;

export type AuditCategory = keyof typeof AUDIT_CATEGORIES;
export const AUDIT_CATEGORY_KEYS = Object.keys(AUDIT_CATEGORIES) as [
  AuditCategory,
  ...AuditCategory[],
];

const PAGE = 30;

type Bilingual = { en: string; am: string };
const both = (en: string | null | undefined, am: string | null | undefined): Bilingual => ({
  en: en || am || "",
  am: am || en || "",
});

export type AuditRow = {
  id: string;
  at: string;
  action: string;
  actor: { name: string; admin: boolean } | null;
  /** What the action was about: a job title, an applicant, a member, a plan. */
  subject: Bilingual | null;
  venue: Bilingual | null;
  /** Small, safe facts for the details column. */
  detail: {
    reason?: string;
    permission?: string;
    role?: string;
    roleFrom?: string;
    roleTo?: string;
    plan?: string;
    receiptNo?: string;
    totalEtb?: number;
    firstReveal?: boolean;
    outcome?: string;
  };
};

const parse = (meta: string | null): Record<string, unknown> => {
  try {
    return meta ? (JSON.parse(meta) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Newest first, optionally one category, 30 per page with a cursor. */
export async function listAudit({
  category,
  cursor,
}: {
  category?: AuditCategory;
  cursor?: string;
}): Promise<{ items: AuditRow[]; nextCursor: string | null }> {
  const rows = await db.auditLog.findMany({
    where: category ? { action: { in: [...AUDIT_CATEGORIES[category]] } } : {},
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { actor: { select: { name: true, phone: true, platformRole: true } } },
  });
  const page = rows.slice(0, PAGE);
  const context = await loadContext(page);
  return {
    items: page.map((r) => describe(r, context)),
    nextCursor: rows.length > PAGE ? page[page.length - 1].id : null,
  };
}

type Row = AuditLog & { actor: { name: string; phone: string; platformRole: string } | null };

/** One query per entity type for the whole page, not one per row. */
async function loadContext(rows: Row[]) {
  const ids = (entity: string) => [
    ...new Set(rows.filter((r) => r.entity === entity).map((r) => r.entityId)),
  ];
  const venueIds = new Set<string>();
  for (const r of rows) {
    const v = str(parse(r.meta).venueId);
    if (v) venueIds.add(v);
    if (r.entity === "Venue") venueIds.add(r.entityId);
  }
  const jobSelect = {
    id: true,
    titleEn: true,
    titleAm: true,
    venue: { select: { nameEn: true, nameAm: true } },
  } as const;
  const [items, apps, members, payments, jobs, licenses, venues] = await Promise.all([
    db.moderationItem.findMany({
      where: { id: { in: ids("ModerationItem") } },
      select: {
        id: true,
        job: { select: jobSelect },
        license: { select: { venue: { select: { nameEn: true, nameAm: true } } } },
      },
    }),
    db.application.findMany({
      where: { id: { in: ids("Application") } },
      select: { id: true, jobseeker: { select: { name: true } }, job: { select: jobSelect } },
    }),
    db.venueMember.findMany({
      where: { id: { in: ids("VenueMember") } },
      select: {
        id: true,
        displayName: true,
        user: { select: { name: true } },
        venue: { select: { nameEn: true, nameAm: true } },
      },
    }),
    db.payment.findMany({
      where: { id: { in: ids("Payment") } },
      select: {
        id: true,
        amountEtb: true,
        vatEtb: true,
        plan: { select: { nameEn: true, nameAm: true } },
        venue: { select: { nameEn: true, nameAm: true } },
      },
    }),
    db.job.findMany({ where: { id: { in: ids("Job") } }, select: jobSelect }),
    db.licenseDocument.findMany({
      where: { id: { in: ids("LicenseDocument") } },
      select: { id: true, venue: { select: { nameEn: true, nameAm: true } } },
    }),
    db.venue.findMany({
      where: { id: { in: [...venueIds] } },
      select: { id: true, nameEn: true, nameAm: true },
    }),
  ]);
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  return {
    items: byId(items),
    apps: byId(apps),
    members: byId(members),
    payments: byId(payments),
    jobs: byId(jobs),
    licenses: byId(licenses),
    venues: byId(venues),
  };
}

type Context = Awaited<ReturnType<typeof loadContext>>;
type Named = { nameEn: string; nameAm: string | null };
const venueOf = (v: Named | null | undefined) => (v ? both(v.nameEn, v.nameAm) : null);
const jobOf = (j: { titleEn: string | null; titleAm: string | null } | null | undefined) =>
  j ? both(j.titleEn, j.titleAm) : null;

function describe(r: Row, c: Context): AuditRow {
  const meta = parse(r.meta);
  const row: AuditRow = {
    id: r.id,
    at: r.at.toISOString(),
    action: r.action,
    actor: r.actor
      ? { name: r.actor.name || r.actor.phone, admin: r.actor.platformRole === "ADMIN" }
      : null,
    subject: null,
    venue: venueOf(c.venues.get(str(meta.venueId) ?? "")),
    detail: {},
  };

  switch (r.entity) {
    case "ModerationItem": {
      const item = c.items.get(r.entityId);
      row.subject = jobOf(item?.job);
      row.venue = venueOf(item?.job?.venue ?? item?.license?.venue) ?? row.venue;
      row.detail.reason = str(meta.reason);
      break;
    }
    case "Application": {
      const app = c.apps.get(r.entityId);
      if (app) {
        const job = jobOf(app.job)!;
        row.subject = {
          en: `${app.jobseeker.name || "Jobseeker"} · ${job.en}`,
          am: `${app.jobseeker.name || "ሥራ ፈላጊ"} · ${job.am}`,
        };
        row.venue = venueOf(app.job.venue);
      }
      if (typeof meta.first === "boolean") row.detail.firstReveal = meta.first;
      break;
    }
    case "VenueMember": {
      const m = c.members.get(r.entityId);
      const name = m?.user?.name || m?.displayName || str(meta.displayName);
      if (name) row.subject = both(name, name);
      row.venue = venueOf(m?.venue) ?? row.venue;
      const before = meta.before as { role?: string } | undefined;
      const after = meta.after as { role?: string } | undefined;
      if (before?.role && after?.role && before.role !== after.role) {
        row.detail.roleFrom = before.role;
        row.detail.roleTo = after.role;
      }
      row.detail.role = str(meta.role) ?? after?.role;
      break;
    }
    case "Payment": {
      const p = c.payments.get(r.entityId);
      if (p) {
        row.subject = both(p.plan.nameEn, p.plan.nameAm);
        row.venue = venueOf(p.venue);
        row.detail.totalEtb = p.amountEtb + p.vatEtb;
      }
      row.detail.receiptNo = str(meta.receiptNo);
      row.detail.outcome = str(meta.outcome);
      break;
    }
    case "Job": {
      const j = c.jobs.get(r.entityId);
      row.subject = jobOf(j);
      row.venue = venueOf(j?.venue) ?? row.venue;
      break;
    }
    case "LicenseDocument":
      row.venue = venueOf(c.licenses.get(r.entityId)?.venue) ?? row.venue;
      break;
  }
  if (r.action === "authz.denied") row.detail.permission = str(meta.permission);
  return row;
}

/** A-05: the platform at a glance, from the demo clock's now. */
export async function platformCounts() {
  const at = now();
  const weekAgo = new Date(at.getTime() - 7 * DAY_MS);
  const [
    venues,
    liveJobs,
    inReview,
    applications,
    applicationsWeek,
    hires,
    jobseekers,
    employers,
    pending,
    paid,
  ] = await Promise.all([
    db.venue.groupBy({ by: ["verification"], _count: { _all: true } }),
    db.job.count({ where: { status: "LIVE", expiresAt: { gt: at } } }),
    db.job.count({ where: { status: "PENDING_REVIEW" } }),
    db.application.count(),
    db.application.count({ where: { appliedAt: { gte: weekAgo } } }),
    db.application.count({ where: { status: "HIRED" } }),
    db.user.count({ where: { platformRole: "JOBSEEKER" } }),
    db.user.count({ where: { platformRole: "EMPLOYER" } }),
    db.moderationItem.count({ where: { status: "PENDING" } }),
    db.payment.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amountEtb: true, vatEtb: true },
      _count: { _all: true },
    }),
  ]);
  const byStatus = Object.fromEntries(venues.map((v) => [v.verification, v._count._all]));
  return {
    venues: {
      total: venues.reduce((n, v) => n + v._count._all, 0),
      verified: byStatus.VERIFIED ?? 0,
      pending: byStatus.PENDING ?? 0,
      unsubmitted: byStatus.UNSUBMITTED ?? 0,
      rejected: byStatus.REJECTED ?? 0,
    },
    jobs: { live: liveJobs, inReview },
    applications: { total: applications, lastWeek: applicationsWeek, hires },
    people: { jobseekers, employers },
    queue: { pending },
    payments: {
      count: paid._count._all,
      totalEtb: (paid._sum.amountEtb ?? 0) + (paid._sum.vatEtb ?? 0),
    },
  };
}
