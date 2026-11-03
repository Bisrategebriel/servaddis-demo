"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { EmptyState, emptyActionClass } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import type { Range, VenueInsights } from "@/server/services/insights";

// SCR-E15 Insights. Hand-drawn SVG following the dataviz skill's mark specs: one validated series
// hue (--viz-series), 2px lines, ≥ 8px markers with a 2px surface ring, bars ≤ 24px with a 4px
// rounded data end, hairline grid, selective direct labels, text in text colours only, a hover
// tooltip on every mark, and a table view for each chart. Single series → no legend box.

const RANGES: Range[] = ["30d", "90d", "180d"];
const SERIES = "var(--viz-series)";
const GRID = "var(--viz-grid)";
const SURFACE = "var(--card)";

function monthLabel(month: string, locale: string) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-GB", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function Card({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:p-5">
      <div>
        <h2 className="text-h3">{title}</h2>
        {sub && <p className="text-small text-text-secondary">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function TableView({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  const t = useTranslations("insights");
  return (
    <details className="text-small">
      <summary className="min-h-10 cursor-pointer py-2 text-navy-700 underline underline-offset-4">
        {t("showTable")}
      </summary>
      <table className="mt-1 w-full text-left">
        <thead className="text-text-secondary">
          <tr>
            <th className="py-1 font-medium">{head[0]}</th>
            <th className="py-1 text-right font-medium">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a} className="border-t border-border">
              <td className="py-1">{a}</td>
              <td className="py-1 text-right tabular-nums">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/**
 * The chart's real width in px, so SVGs draw at 1:1: text stays 11–12px and bars stay ≤ 24px
 * at any container width (a scaled viewBox would blow both up or shrink them).
 */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width || fallback] as const;
}

/** Tooltip positioned over the chart; text in text colours, never the series colour. */
function Tip({ x, y, lines }: { x: number; y: number; lines: string[] }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-card px-2 py-1 text-caption whitespace-nowrap shadow-overlay"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {lines.map((l, i) => (
        <div key={i} className={i === 0 ? "font-semibold" : "text-text-secondary"}>
          {l}
        </div>
      ))}
    </div>
  );
}

/** Six-month line: time to fill. Gaps where a month had no filled job. */
function TrendChart({ data }: { data: VenueInsights["trend"] }) {
  const t = useTranslations("insights");
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth(560);
  const H = 220;
  const pad = { l: 36, r: 40, t: 16, b: 28 };
  const vals = data.map((d) => d.daysToFill).filter((v): v is number => v !== null);
  const max = Math.max(12, Math.ceil(Math.max(...vals, 0) / 4) * 4);
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (data.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ticks = [0, max / 2, max];
  const points = data.map((d, i) =>
    d.daysToFill === null ? null : ([x(i), y(d.daysToFill)] as const),
  );
  // Line segments only between consecutive months that both have data.
  let path = "";
  points.forEach((p, i) => {
    if (!p) return;
    path += `${i > 0 && points[i - 1] ? "L" : "M"}${p[0]} ${p[1]}`;
  });
  const lastIdx = points
    .map((p, i) => (p ? i : -1))
    .filter((i) => i >= 0)
    .pop();
  const h = hover !== null ? data[hover] : null;

  return (
    <>
      <div className="relative" ref={box}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block"
          role="img"
          aria-label={t("trendTitle")}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text
                x={pad.l - 8}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-text-secondary text-[0.6875rem]"
              >
                {v}
              </text>
            </g>
          ))}
          {data.map((d, i) => (
            <text
              key={d.month}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-text-secondary text-[0.6875rem]"
            >
              {monthLabel(d.month, locale)}
            </text>
          ))}
          {hover !== null && points[hover] && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={H - pad.b}
              stroke={GRID}
              strokeWidth={1}
            />
          )}
          <path
            d={path}
            fill="none"
            stroke={SERIES}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map(
            (p, i) =>
              p && (
                <circle
                  key={i}
                  cx={p[0]}
                  cy={p[1]}
                  r={hover === i ? 6 : 4}
                  fill={SERIES}
                  stroke={SURFACE}
                  strokeWidth={2}
                />
              ),
          )}
          {/* Direct label on the latest point only. */}
          {lastIdx !== undefined && points[lastIdx] && (
            <text
              x={points[lastIdx]![0] + 10}
              y={points[lastIdx]![1] + 4}
              className="fill-foreground text-[0.75rem] font-semibold"
            >
              {data[lastIdx].daysToFill}
            </text>
          )}
          {/* Hit targets wider than the marks: one column per month. */}
          {data.map((d, i) => (
            <rect
              key={d.month}
              x={x(i) - (W - pad.l - pad.r) / (data.length - 1) / 2}
              y={0}
              width={(W - pad.l - pad.r) / (data.length - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {h && points[hover!] && (
          <Tip
            x={(x(hover!) / W) * 100}
            y={(points[hover!]![1] / H) * 100 - 4}
            lines={[
              monthLabel(h.month, locale),
              t("days", { count: h.daysToFill! }),
              t("filledJobs", { count: h.filledJobs }),
            ]}
          />
        )}
      </div>
      <TableView
        head={[t("month"), t("trendTitle")]}
        rows={data.map((d) => [
          monthLabel(d.month, locale),
          d.daysToFill === null ? "—" : t("days", { count: d.daysToFill }),
        ])}
      />
    </>
  );
}

/** Horizontal bars: applied → viewed → shortlisted → hired, value and % at each tip. */
function FunnelChart({ funnel }: { funnel: VenueInsights["funnel"] }) {
  const t = useTranslations("insights");
  const [hover, setHover] = useState<number | null>(null);
  const steps = (["applied", "viewed", "shortlisted", "hired"] as const).map((k) => ({
    k,
    v: funnel[k],
  }));
  const max = Math.max(funnel.applied, 1);
  const pct = (v: number) => Math.round((100 * v) / max);
  return (
    <>
      <ul className="flex flex-col gap-3" data-testid="funnel">
        {steps.map((s, i) => (
          <li
            key={s.k}
            className="relative grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="text-small">{t(`funnel.${s.k}`)}</span>
            <span className="flex items-center gap-2">
              {/* ≤ 24px thick, 4px rounded data end, square at the baseline. */}
              <span
                className="h-5 rounded-r-[4px]"
                style={{
                  width: `${Math.max(pct(s.v), s.v ? 1 : 0)}%`,
                  background: SERIES,
                  opacity: hover === null || hover === i ? 1 : 0.55,
                }}
              />
              <span className="shrink-0 text-small tabular-nums">
                <span className="font-semibold">{s.v}</span>
                {i > 0 && <span className="text-text-secondary"> · {pct(s.v)}%</span>}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <TableView
        head={[t("funnelTitle"), t("value")]}
        rows={steps.map((s) => [t(`funnel.${s.k}`), `${s.v} (${pct(s.v)}%)`])}
      />
    </>
  );
}

/** Monthly columns on a 0–100 % scale; direct label on the latest month only. */
function MonthColumns({
  title,
  data,
  unitLines,
}: {
  title: string;
  data: { month: string; value: number | null; applicants: number }[];
  unitLines: (d: { value: number | null; applicants: number }) => string[];
}) {
  const t = useTranslations("insights");
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth(280);
  const H = 160;
  const pad = { l: 28, r: 8, t: 18, b: 24 };
  const band = (W - pad.l - pad.r) / data.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const last = data
    .map((d, i) => (d.value === null ? -1 : i))
    .filter((i) => i >= 0)
    .pop();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-small font-semibold">{title}</h3>
      <div className="relative" ref={box}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block"
          role="img"
          aria-label={title}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text
                x={pad.l - 6}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-text-secondary text-[0.6875rem]"
              >
                {v}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.l + band * i + band / 2;
            const top = d.value === null ? y(0) : y(d.value);
            const hgt = y(0) - top;
            return (
              <g key={d.month} onMouseEnter={() => setHover(i)}>
                <rect x={pad.l + band * i} y={0} width={band} height={H} fill="transparent" />
                {d.value !== null && hgt > 0 && (
                  <path
                    // 4px rounded top (data end), square at the baseline
                    d={`M${cx - bw / 2} ${y(0)}V${top + 4}Q${cx - bw / 2} ${top} ${cx - bw / 2 + 4} ${top}H${cx + bw / 2 - 4}Q${cx + bw / 2} ${top} ${cx + bw / 2} ${top + 4}V${y(0)}Z`}
                    fill={SERIES}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )}
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-text-secondary text-[0.6875rem]"
                >
                  {monthLabel(d.month, locale)}
                </text>
                {i === last && d.value !== null && (
                  <text
                    x={cx}
                    y={top - 5}
                    textAnchor="middle"
                    className="fill-foreground text-[0.6875rem] font-semibold"
                  >
                    {d.value}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <Tip
            x={((pad.l + band * hover + band / 2) / W) * 100}
            y={((data[hover].value === null ? y(0) : y(data[hover].value!)) / H) * 100 - 4}
            lines={[monthLabel(data[hover].month, locale), ...unitLines(data[hover])]}
          />
        )}
      </div>
      <TableView
        head={[t("month"), title]}
        rows={data.map((d) => [
          monthLabel(d.month, locale),
          d.value === null ? "—" : `${d.value}%`,
        ])}
      />
    </div>
  );
}

export function InsightsView({ data }: { data: VenueInsights }) {
  const t = useTranslations("insights");
  const tn = useTranslations("nav");
  const kpi = (label: string, value: string, testid: string) => (
    <div className="rounded-2xl border border-border bg-card p-4" data-testid={testid}>
      <p className="text-small text-text-secondary">{label}</p>
      <p className="text-h1 tabular-nums">{value}</p>
    </div>
  );
  const empty = data.funnel.applied === 0 && data.trend.every((d) => d.daysToFill === null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">{t("title")}</h1>
        {/* Filters in one row above the charts (dataviz interaction spec). */}
        <nav aria-label={t("range")} className="flex gap-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/employer/insights?range=${r}`}
              aria-current={data.range === r ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-sm px-3 text-small font-medium",
                data.range === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {t(`ranges.${r}`)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpi(t("kpis.liveJobs"), String(data.kpis.liveJobs), "kpi-live")}
        {kpi(t("kpis.applicants"), String(data.kpis.applicants), "kpi-applicants")}
        {kpi(
          t("kpis.avgDaysToFill"),
          data.kpis.avgDaysToFill === null
            ? t("noData")
            : t("days", { count: data.kpis.avgDaysToFill }),
          "kpi-ttf",
        )}
        {kpi(t("kpis.hires"), String(data.kpis.hires), "kpi-hires")}
      </div>

      {empty ? (
        <EmptyState
          illustration="applicants"
          testId="insights-empty"
          title={t("empty")}
          action={
            <Link href="/employer/jobs" className={emptyActionClass}>
              {tn("jobs")}
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card title={t("trendTitle")} sub={t("trendSub")}>
              {data.fasterBy !== null && data.fasterBy !== 0 && (
                <p className="font-medium" data-testid="headline">
                  {data.fasterBy > 0
                    ? t("faster", { days: data.fasterBy })
                    : t("slower", { days: Math.abs(data.fasterBy) })}
                </p>
              )}
              <TrendChart data={data.trend} />
            </Card>
            <Card title={t("funnelTitle")} sub={t("funnelSub")}>
              <FunnelChart funnel={data.funnel} />
              {data.applicantsPerJob !== null && (
                <p className="text-small text-text-secondary">
                  {t("perJob", { count: data.applicantsPerJob })}
                </p>
              )}
            </Card>
          </div>
          <Card title={t("qualityTitle")}>
            {/* Two measures → two small charts on the same 0–100 scale, never one dual-axis chart. */}
            <div className="grid gap-6 sm:grid-cols-2">
              <MonthColumns
                title={t("completeness")}
                data={data.quality.map((q) => ({
                  month: q.month,
                  value: q.avgCompleteness,
                  applicants: q.applicants,
                }))}
                unitLines={(d) => [
                  d.value === null ? "—" : `${d.value}%`,
                  t("applicantsCount", { count: d.applicants }),
                ]}
              />
              <MonthColumns
                title={t("verified")}
                data={data.quality.map((q) => ({
                  month: q.month,
                  value: q.pctVerified,
                  applicants: q.applicants,
                }))}
                unitLines={(d) => [
                  d.value === null ? "—" : `${d.value}%`,
                  t("applicantsCount", { count: d.applicants }),
                ]}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
