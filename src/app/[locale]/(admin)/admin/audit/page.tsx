import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/server/current-user";
import {
  AUDIT_CATEGORY_KEYS,
  listAudit,
  type AuditCategory,
  type AuditRow,
} from "@/server/services/audit-log";

// SCR-A03 (PRD A-04): who approved what, who revealed which contact, who changed whose access.
// Server-rendered from the URL like the feed: filters are links, paging is an "older" link.

type Params = Record<string, string | string[] | undefined>;
type T = Awaited<ReturnType<typeof getTranslations<"audit">>>;
type TAll = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Action, role and permission names come from stored audit rows, not from code, so they are
 * looked up by string and fall back to the raw value when a key is missing.
 */
type Loose = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
};
const loose = (t: T | TAll) => t as unknown as Loose;
const lookup = (t: T | TAll, key: string, fallback: string) =>
  loose(t).has(key) ? loose(t)(key) : fallback;

function Details({ row, t, tAll }: { row: AuditRow; t: T; tAll: TAll }) {
  const d = row.detail;
  const role = (r: string) => lookup(tAll, `roles.${r}`, r);
  const parts: string[] = [];
  if (d.permission) {
    parts.push(
      t("permission", {
        permission: lookup(tAll, `permissions.keys.${d.permission}`, d.permission),
      }),
    );
  }
  if (d.roleFrom && d.roleTo)
    parts.push(t("roleChange", { from: role(d.roleFrom), to: role(d.roleTo) }));
  else if (d.role) parts.push(t("role", { role: role(d.role) }));
  if (d.firstReveal) parts.push(t("firstReveal"));
  if (d.totalEtb !== undefined)
    parts.push(t("total", { total: d.totalEtb.toLocaleString("en-US") }));
  if (d.receiptNo) parts.push(t("receipt", { receiptNo: d.receiptNo }));
  if (d.outcome && d.outcome !== "SUCCEEDED") {
    parts.push(lookup(t, `outcome.${d.outcome}`, d.outcome));
  }
  if (d.reason) parts.push(t("reason", { reason: d.reason }));
  return parts.length ? (
    <ul className="flex flex-col gap-0.5 text-small text-text-secondary">
      {parts.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  ) : (
    <span className="text-small text-text-secondary">—</span>
  );
}

async function Log({ searchParams }: { searchParams: Promise<Params> }) {
  const [user, params, locale, t, tAll] = await Promise.all([
    getCurrentUser(),
    searchParams,
    getLocale(),
    getTranslations("audit"),
    getTranslations(),
  ]);
  if (user?.platformRole !== "ADMIN") redirect("/");
  const am = locale === "am";
  const raw = typeof params.category === "string" ? params.category : undefined;
  const category = AUDIT_CATEGORY_KEYS.includes(raw as AuditCategory)
    ? (raw as AuditCategory)
    : undefined;
  const cursor = typeof params.cursor === "string" ? params.cursor.slice(0, 40) : undefined;
  const { items, nextCursor } = await listAudit({ category, cursor });
  const href = (c?: string, next?: string) => {
    const q = new URLSearchParams();
    if (c) q.set("category", c);
    if (next) q.set("cursor", next);
    return q.size ? `/admin/audit?${q}` : "/admin/audit";
  };
  const label = (action: string) => lookup(t, `actions.${action}`, t("actions.unknown"));

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("filters")} className="flex flex-wrap gap-2">
        {[undefined, ...AUDIT_CATEGORY_KEYS].map((c) => (
          <Link
            key={c ?? "all"}
            href={href(c)}
            aria-current={c === category ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-3 text-small",
              c === category
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-border-strong",
            )}
          >
            {t(`categories.${c ?? "all"}`)}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          illustration="forbidden"
          testId="audit-empty"
          title={category || cursor ? t("emptyCategory") : t("empty")}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div
            aria-hidden
            className="hidden grid-cols-[9rem_11rem_minmax(0,1fr)_minmax(0,16rem)] gap-4 border-b border-border px-4 py-2 text-caption text-text-secondary lg:grid"
          >
            <span>{t("colWhen")}</span>
            <span>{t("colWho")}</span>
            <span>{t("colWhat")}</span>
            <span>{t("colDetails")}</span>
          </div>
          <ol className="divide-y divide-border" data-testid="audit-log">
            {items.map((row) => (
              <li
                key={row.id}
                data-testid="audit-row"
                data-action={row.action}
                className="grid gap-1 px-4 py-3 lg:grid-cols-[9rem_11rem_minmax(0,1fr)_minmax(0,16rem)] lg:gap-4"
              >
                <time dateTime={row.at} className="text-small text-text-secondary">
                  {formatDateTime(row.at, locale)}
                </time>
                <span className="text-small font-medium">
                  {row.actor ? row.actor.name : t("system")}
                  {row.actor?.admin && (
                    <span className="ms-1.5 rounded-sm bg-amber-100 px-1.5 py-0.5 text-caption text-amber-800">
                      {t("admin")}
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 font-medium">
                    {row.action === "authz.denied" && (
                      <ShieldAlert className="size-4 shrink-0 text-danger-fg" aria-hidden />
                    )}
                    {label(row.action)}
                  </span>
                  {(row.subject || row.venue) && (
                    <span className="text-small wrap-break-word text-text-secondary">
                      {[row.subject?.[am ? "am" : "en"], row.venue?.[am ? "am" : "en"]]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                <Details row={row} t={t} tAll={tAll} />
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {cursor && (
          <Link
            href={href(category)}
            className="inline-flex min-h-10 items-center rounded-sm border border-input bg-card px-4 font-medium"
          >
            {t("newest")}
          </Link>
        )}
        {nextCursor && (
          <Link
            href={href(category, nextCursor)}
            className="inline-flex min-h-10 items-center rounded-sm border border-input bg-card px-4 font-medium"
          >
            {t("older")}
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function AuditPage({ searchParams }: PageProps<"/[locale]/admin/audit">) {
  const [t, common] = await Promise.all([getTranslations("audit"), getTranslations("common")]);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">{t("title")}</h1>
        <p className="max-w-3xl text-text-secondary">{t("intro")}</p>
      </div>
      <Suspense fallback={<TableSkeleton label={common("loading")} heading={false} />}>
        <Log searchParams={searchParams as Promise<Params>} />
      </Suspense>
    </section>
  );
}
