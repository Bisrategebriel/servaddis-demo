import type { JobStatus } from "@prisma/client";
import {
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  MessageCircle,
  Pencil,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// doc 04 §6.2 status chip mapping: icon + label, never colour alone.

const CHIP: Record<JobStatus, { icon: LucideIcon; tone: string }> = {
  DRAFT: { icon: Pencil, tone: "bg-gray-100 text-gray-700" },
  PENDING_REVIEW: { icon: Hourglass, tone: "bg-info-bg text-info-fg" },
  CHANGES_REQUESTED: { icon: MessageCircle, tone: "bg-warning-bg text-warning-fg" },
  LIVE: { icon: Radio, tone: "bg-success-bg text-success-fg" },
  EXPIRED: { icon: Clock, tone: "bg-gray-100 text-gray-600" },
  CLOSED: { icon: CircleCheck, tone: "bg-navy-50 text-navy-800" },
  REJECTED: { icon: CircleX, tone: "bg-danger-bg text-danger-fg" },
};

/** `highlight`: a brief pulse for an important success, e.g. a job that has just gone live. */
export function JobStatusChip({ status, highlight }: { status: JobStatus; highlight?: boolean }) {
  const t = useTranslations("jobs.status");
  const { icon: Icon, tone } = CHIP[status];
  return (
    <span
      data-testid="job-status"
      data-status={status}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-caption",
        tone,
        highlight && "chip-highlight",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {t(status)}
    </span>
  );
}
