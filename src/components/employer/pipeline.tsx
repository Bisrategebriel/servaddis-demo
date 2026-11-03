"use client";

import type { ApplicationStatus } from "@prisma/client";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EmptyState, emptyActionClass } from "@/components/empty-state";
import { APPLICANT_SORTS, compareApplicants, type ApplicantSort } from "@/lib/applicant-sort";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PipelineItem } from "@/server/services/pipeline";
import { ApplicantDrawer } from "./applicant-drawer";

// SCR-E08 pipeline: board (one column per status) or list, verified first, then the chosen sort.
// Polls every 3 s with the last cursor, so each poll returns only applications that changed
// (TRD §7.2). The "New applicant" toast itself is shell-wide, driven by the bell (E-19).

const COLUMNS: ApplicationStatus[] = ["APPLIED", "VIEWED", "SHORTLISTED", "HIRED", "REJECTED"];
const POLL_MS = 3000;
const VIEW_KEY = "sv_pipeline_view";

type View = "board" | "list";

/** The viewer's last board/list choice (per-browser convenience; null on the server). */
function readSavedView(): View | null {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === "list" || saved === "board" ? saved : null;
  } catch {
    return null; // storage blocked
  }
}
const noSubscribe = () => () => {};

type Data = { items: PipelineItem[]; counts: Record<ApplicationStatus, number>; cursor: string };

function ApplicantCard({
  a,
  arrived,
  onOpen,
}: {
  a: PipelineItem;
  arrived: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("pipeline");
  const locale = useLocale();
  const am = locale === "am";
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="applicant"
      data-status={a.status}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md border border-border bg-card p-3 text-left transition-shadow hover:border-border-strong hover:shadow-card",
        arrived && "ring-2 ring-brand-accent",
      )}
    >
      <div className="flex items-center gap-1.5">
        {a.isNew && (
          <span
            className="size-2 shrink-0 rounded-full bg-brand-accent"
            aria-label={t("newDot")}
            role="img"
          />
        )}
        <span className="font-semibold wrap-break-word">{a.name || t("unnamed")}</span>
        {a.verified && (
          <BadgeCheck
            className="size-4 shrink-0 text-success-fg"
            aria-label={t("verified")}
            role="img"
          />
        )}
      </div>
      <p className="text-small text-text-secondary">
        {t("years", { count: a.experienceYears })} · {t("complete", { percent: a.completeness })}
      </p>
      {a.skills.length > 0 && (
        <p className="text-caption text-text-secondary">
          {a.skills.map((s) => (am ? s.am : s.en)).join(" · ")}
        </p>
      )}
      <p className="text-caption text-text-secondary">
        {t("applied", { date: formatDateTime(a.appliedAt, locale) })}
      </p>
    </button>
  );
}

export function Pipeline({
  jobId,
  initial,
  permissions,
}: {
  jobId: string;
  initial: Data;
  permissions: string[];
}) {
  const t = useTranslations("pipeline");
  const tp = useTranslations("promote");
  const [items, setItems] = useState(() => new Map(initial.items.map((a) => [a.id, a])));
  const [counts, setCounts] = useState(initial.counts);
  const [sort, setSort] = useState<ApplicantSort>("completeness");
  const saved = useSyncExternalStore(noSubscribe, readSavedView, () => null);
  const [chosen, setChosen] = useState<View | null>(null);
  const view = chosen ?? saved ?? "board";
  const [arrived, setArrived] = useState<Set<string>>(new Set());
  const cursor = useRef(initial.cursor);
  const [openId, setOpenId] = useState<string | null>(null);
  // The drawer changed a status: move the card now instead of waiting for the next poll.
  const onChanged = useCallback((id: string, status: ApplicationStatus) => {
    setItems((prev) => {
      const a = prev.get(id);
      if (!a || a.status === status) return prev;
      const next = new Map(prev);
      next.set(id, { ...a, status, isNew: false });
      setCounts((c) => ({ ...c, [a.status]: c[a.status] - 1, [status]: c[status] + 1 }));
      return next;
    });
  }, []);

  const chooseView = (v: View) => {
    setChosen(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // per-viewer convenience only
    }
  };

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/jobs/${jobId}/applicants?since=${encodeURIComponent(cursor.current)}`,
        );
        if (!res.ok || stop) return;
        const data: Data = await res.json();
        cursor.current = data.cursor;
        setCounts(data.counts);
        if (data.items.length === 0) return;
        setItems((prev) => {
          const next = new Map(prev);
          const fresh: string[] = [];
          for (const a of data.items) {
            if (!prev.has(a.id)) fresh.push(a.id);
            next.set(a.id, a);
          }
          if (fresh.length) {
            setArrived((s) => new Set([...s, ...fresh]));
            setTimeout(
              () => setArrived((s) => new Set([...s].filter((id) => !fresh.includes(id)))),
              6000,
            );
          }
          return next;
        });
      } catch {
        // offline or a deploy restart: the next tick retries
      }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [jobId]);

  const sorted = [...items.values()].sort(compareApplicants(sort));
  const toggle = (v: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => chooseView(v)}
      className={cn(
        "min-h-10 rounded-sm px-3 text-small font-medium",
        view === v ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t("view")} className="flex gap-1">
          {toggle("board", t("board"))}
          {toggle("list", t("list"))}
        </div>
        <label className="flex items-center gap-2 text-small">
          {t("sort")}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ApplicantSort)}
            className="h-10 rounded-sm border border-input bg-card px-2"
          >
            {APPLICANT_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sorts.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-caption text-text-secondary">{t("live")}</span>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          illustration="applicants"
          testId="pipeline-empty"
          title={t("empty")}
          action={
            permissions.includes("social.promote") && (
              <Link href={`/employer/jobs/${jobId}/promote`} className={emptyActionClass}>
                {tp("title")}
              </Link>
            )
          }
        />
      ) : view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2" data-testid="board">
          {/* px, not rem: five columns must fit a 1280 px window in presenter mode too (18 px root) */}
          <div className="grid min-w-[900px] grid-cols-5 gap-3">
            {COLUMNS.map((status) => {
              const column = sorted.filter((a) => a.status === status);
              return (
                <section
                  key={status}
                  aria-labelledby={`col-${status}`}
                  className="flex flex-col gap-2"
                >
                  <h2 id={`col-${status}`} className="text-small font-semibold">
                    {t(`columns.${status}`)} ({counts[status]})
                  </h2>
                  <div className="flex min-h-24 flex-col gap-2 rounded-md bg-muted p-2">
                    {column.length === 0 ? (
                      <p className="p-2 text-caption text-text-secondary">{t("emptyColumn")}</p>
                    ) : (
                      column.map((a) => (
                        <ApplicantCard
                          key={a.id}
                          a={a}
                          arrived={arrived.has(a.id)}
                          onOpen={() => setOpenId(a.id)}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="list">
          {sorted.map((a) => (
            <li key={a.id} className="flex flex-col gap-1">
              <span className="text-caption text-text-secondary">{t(`columns.${a.status}`)}</span>
              <ApplicantCard a={a} arrived={arrived.has(a.id)} onOpen={() => setOpenId(a.id)} />
            </li>
          ))}
        </ul>
      )}
      <ApplicantDrawer
        key={openId ?? "closed"} // fresh state for each applicant
        applicationId={openId}
        permissions={permissions}
        onClose={() => setOpenId(null)}
        onChanged={onChanged}
      />
    </div>
  );
}
