import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

// doc 04 §6.1 Loading: skeletons shaped like the content, never a bare "Loading…". Each preset
// mirrors the layout of the page it stands in for, so nothing jumps when the data arrives. The
// pulse is motion-safe only; screen readers hear the label once (role="status").

export function Bone({ className }: { className?: string }) {
  return <div className={cx("rounded-sm bg-muted motion-safe:animate-pulse", className)} />;
}

function Loading({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}

const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cx("flex flex-col gap-2 rounded-md border border-border bg-card p-4", className)}>
    {children}
  </div>
);

/** Job feed, employer jobs list, tracker: stacked cards with a title and two meta lines. */
export function CardListSkeleton({ label, count = 4 }: { label: string; count?: number }) {
  return (
    <Loading label={label} className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <Bone className="h-5 w-2/3" />
          <Bone className="h-4 w-2/5" />
          <Bone className="h-4 w-1/2" />
        </Card>
      ))}
    </Loading>
  );
}

/** Page heading with a status chip: the top of every detail page. */
function Heading() {
  return (
    <div className="flex flex-col gap-2">
      <Bone className="h-4 w-24" />
      <Bone className="h-8 w-3/5 max-w-md" />
      <Bone className="h-6 w-20 rounded-full" />
    </div>
  );
}

/** Job overview, review, promote, receipt: heading, main card, side card. */
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label} className="flex flex-col gap-5">
      <Heading />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="gap-3 p-5">
          <Bone className="h-5 w-1/3" />
          {Array.from({ length: 5 }, (_, i) => (
            <Bone key={i} className={cx("h-4", i % 2 ? "w-4/5" : "w-full")} />
          ))}
        </Card>
        <Card className="gap-3 p-5">
          <Bone className="h-5 w-1/2" />
          <Bone className="h-11 w-full" />
          <Bone className="h-11 w-full" />
        </Card>
      </div>
    </Loading>
  );
}

/** Dashboard and insights: KPI tiles over a wide card. */
export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label} className="flex flex-col gap-5">
      <Bone className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <Bone className="h-4 w-1/2" />
            <Bone className="h-7 w-1/3" />
          </Card>
        ))}
      </div>
      <Card className="gap-3 p-5">
        <Bone className="h-5 w-1/4" />
        <Bone className="h-40 w-full" />
      </Card>
    </Loading>
  );
}

/** Admin queue, audit log, team list: a header row and rows. */
export function TableSkeleton({
  label,
  rows = 6,
  heading = true,
}: {
  label: string;
  rows?: number;
  /** Off where the page title is already on screen. */
  heading?: boolean;
}) {
  return (
    <Loading label={label} className="flex flex-col gap-4">
      {heading && <Bone className="h-8 w-48" />}
      <div className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Bone className="size-9 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-4 w-1/3" />
              <Bone className="h-3 w-1/2" />
            </div>
            <Bone className="hidden h-6 w-20 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Template picker and plans: a grid of tiles. */
export function TileGridSkeleton({ label, count = 6 }: { label: string; count?: number }) {
  return (
    <Loading label={label} className="flex flex-col gap-4">
      <Bone className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <Card key={i} className="gap-3 p-5">
            <Bone className="size-10 rounded-lg" />
            <Bone className="h-5 w-2/3" />
            <Bone className="h-4 w-1/2" />
          </Card>
        ))}
      </div>
    </Loading>
  );
}

/** Composer, venue setup, profile, license upload: labelled fields. */
export function FormSkeleton({ label, fields = 4 }: { label: string; fields?: number }) {
  return (
    <Loading label={label} className="flex flex-col gap-5">
      <Bone className="h-8 w-56" />
      <Card className="gap-5 p-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-11 w-full" />
          </div>
        ))}
        <Bone className="h-11 w-32 self-end" />
      </Card>
    </Loading>
  );
}

/** Applicant pipeline: toolbar, then columns on desktop and a list on mobile. */
export function PipelineSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label} className="flex flex-col gap-4">
      <Heading />
      <Bone className="h-10 w-full max-w-sm" />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} className={cx(i > 0 && "hidden md:flex", i > 2 && "md:hidden xl:flex")}>
            <Bone className="h-4 w-1/2" />
            <Bone className="h-16 w-full" />
            <Bone className="h-16 w-full" />
          </Card>
        ))}
      </div>
    </Loading>
  );
}
