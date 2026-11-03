import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

// doc 04 §5 EmptyState: line illustration + one sentence + one action. The six drawings are the
// doc 04 §10 set (jobs, applicants, team, notifications, offline, 403). Inline SVG with no hooks,
// so server and client components can both use it; decorative, so hidden from screen readers.

const LINE = { fill: "none", stroke: "var(--navy-300)", strokeWidth: 2.5 } as const;
const ACCENT = { fill: "none", stroke: "var(--amber-500)", strokeWidth: 2.5 } as const;
const ROUND = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

const DRAWINGS = {
  jobs: (
    <>
      <rect x="30" y="34" width="56" height="38" rx="6" {...LINE} />
      <path d="M48 34v-5a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v5M30 50h56" {...LINE} />
      <circle cx="84" cy="64" r="10" {...ACCENT} fill="var(--card)" />
      <path d="M91 71l8 8" {...ACCENT} />
    </>
  ),
  applicants: (
    <>
      <circle cx="48" cy="38" r="9" {...LINE} />
      <path d="M32 72c0-9 7-16 16-16s16 7 16 16" {...LINE} />
      <circle cx="76" cy="42" r="8" strokeDasharray="4 5" {...ACCENT} />
      <path d="M62 74c1-8 7-14 14-14s13 6 14 14" strokeDasharray="4 5" {...ACCENT} />
    </>
  ),
  team: (
    <>
      <circle cx="38" cy="44" r="7" {...LINE} />
      <path d="M26 72c0-7 5-12 12-12s12 5 12 12" {...LINE} />
      <circle cx="82" cy="44" r="7" {...LINE} />
      <path d="M70 72c0-7 5-12 12-12s12 5 12 12" {...LINE} />
      <circle cx="60" cy="36" r="9" {...ACCENT} fill="var(--card)" />
      <path d="M44 72c0-9 7-16 16-16s16 7 16 16" {...ACCENT} fill="var(--card)" />
    </>
  ),
  notifications: (
    <>
      <path d="M60 26a17 17 0 0 0-17 17c0 13-6 19-6 19h46s-6-6-6-19a17 17 0 0 0-17-17z" {...LINE} />
      <path d="M54 68a6 6 0 0 0 12 0" {...LINE} />
      <circle cx="60" cy="19" r="3" fill="var(--amber-500)" />
      <path d="M86 30l6-4M88 42h7M30 30l-6-4M28 42h-7" {...ACCENT} />
    </>
  ),
  offline: (
    <>
      <path d="M40 68h40a13 13 0 0 0 1-26 19 19 0 0 0-36-3 15 15 0 0 0-5 29z" {...LINE} />
      <path d="M34 26l52 50" {...ACCENT} />
    </>
  ),
  forbidden: (
    <>
      <rect x="40" y="46" width="40" height="30" rx="6" {...LINE} />
      <path d="M48 46v-8a12 12 0 0 1 24 0v8" {...LINE} />
      <circle cx="60" cy="58" r="4" {...ACCENT} />
      <path d="M60 62v6" {...ACCENT} />
    </>
  ),
};

export type Illustration = keyof typeof DRAWINGS;

export function EmptyIllustration({ name, className }: { name: Illustration; className?: string }) {
  return (
    <svg viewBox="0 0 120 96" className={className} aria-hidden {...ROUND}>
      <circle cx="60" cy="50" r="40" fill="var(--navy-50)" />
      {DRAWINGS[name]}
    </svg>
  );
}

export function EmptyState({
  illustration,
  title,
  action,
  compact = false,
  className,
  testId,
}: {
  illustration: Illustration;
  /** The one sentence. */
  title: ReactNode;
  /** The one action: a link or button. */
  action?: ReactNode;
  /** Smaller drawing, no card: inside popovers and columns. */
  compact?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cx(
        "flex flex-col items-center text-center",
        compact ? "gap-2 px-2 py-4" : "gap-3 rounded-2xl border border-border bg-card px-6 py-8",
        className,
      )}
    >
      <EmptyIllustration name={illustration} className={compact ? "h-16 w-20" : "h-24 w-30"} />
      <p className={cx("max-w-sm text-pretty", compact ? "text-small text-text-secondary" : "")}>
        {title}
      </p>
      {action}
    </div>
  );
}

/** The standard action button look for an EmptyState link. */
export const emptyActionClass =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-primary px-4 font-medium text-primary-foreground transition-colors duration-150 ease-out hover:bg-primary-hover";
