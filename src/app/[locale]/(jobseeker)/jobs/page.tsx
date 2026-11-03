import { Search } from "lucide-react";
import { CardListSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState, emptyActionClass } from "@/components/empty-state";
import { FilterSheet } from "@/components/jobseeker/filter-sheet";
import { JobCard } from "@/components/jobseeker/job-card";
import { feedQuery } from "@/lib/zod-schemas";
import { now } from "@/server/clock";
import { db } from "@/server/db";
import { listFeed, type FeedQuery } from "@/server/services/feed";
import { ADDIS_SUB_CITIES } from "../../../../../prisma/seed/data/geography";

// SCR-J01 feed: server-rendered from the URL (filters are a GET form), urgent jobs pinned first.
// Public: anyone can browse; applying needs a session (T3.2).

type Params = Record<string, string | string[] | undefined>;

/** Bad or unknown filter values are dropped, never an error page. */
function readFilters(params: Params): FeedQuery {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const parsed = feedQuery.safeParse(flat);
  if (parsed.success) return parsed.data;
  const ok = Object.fromEntries(
    Object.entries(flat).filter(
      ([k, v]) => feedQuery.shape[k as keyof FeedQuery]?.safeParse(v).success,
    ),
  );
  return feedQuery.parse(ok);
}

async function Feed({ searchParams }: { searchParams: Promise<Params> }) {
  // Expiry and "closes in" follow the demo clock: always per request, never in a prerender.
  await connection();
  const [params, locale, t] = await Promise.all([
    searchParams,
    getLocale(),
    getTranslations("feed"),
  ]);
  const lang = locale === "am" ? "am" : "en";
  const filters = readFilters(params);
  const [{ items, total, nextCursor }, roles] = await Promise.all([
    listFeed(filters),
    db.roleTemplate.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, nameEn: true, nameAm: true },
    }),
  ]);
  const at = now();
  const activeCount = [filters.role, filters.sub, filters.type, filters.urgent || undefined]
    .concat(filters.min !== undefined || filters.max !== undefined ? [true] : [])
    .filter(Boolean).length;
  const filtered = activeCount > 0 || !!filters.q;
  const moreHref = () => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
      if (typeof v === "string" && k !== "cursor") next.set(k, v);
    next.set("cursor", String(nextCursor));
    return `/jobs?${next}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <form method="get" action="/jobs" role="search" className="relative min-w-0 flex-1">
          {Object.entries(params).map(([k, v]) =>
            typeof v === "string" && k !== "q" && k !== "cursor" ? (
              <input key={k} type="hidden" name={k} value={v} />
            ) : null,
          )}
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            aria-label={t("search")}
            placeholder={t("search")}
            className="h-11 w-full rounded-sm border border-input bg-card ps-9 pe-3"
          />
        </form>
        <FilterSheet
          roles={roles}
          subCities={[...ADDIS_SUB_CITIES]}
          current={filters}
          activeCount={activeCount}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-h2" data-testid="feed-count">
          {t("count", { count: total })}
        </h1>
        {filtered && (
          <Link
            href="/jobs"
            className="inline-flex min-h-11 items-center text-small text-navy-700 underline underline-offset-4"
          >
            {t("clear")}
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          illustration="jobs"
          testId="feed-empty"
          title={filtered ? t("empty") : t("emptyAll")}
          action={
            filtered && (
              <Link href="/jobs" className={emptyActionClass}>
                {t("clear")}
              </Link>
            )
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="feed">
          {items.map((job) => (
            <li key={job.id}>
              <JobCard job={job} lang={lang} now={at} />
            </li>
          ))}
        </ul>
      )}
      {nextCursor !== null && (
        <Link
          href={moreHref()}
          className="inline-flex h-11 items-center justify-center rounded-sm border border-input bg-card font-medium"
        >
          {t("more")}
        </Link>
      )}
    </div>
  );
}

export default async function JobsPage({ searchParams }: PageProps<"/[locale]/jobs">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<CardListSkeleton label={t("loading")} />}>
      <Feed searchParams={searchParams as Promise<Params>} />
    </Suspense>
  );
}
