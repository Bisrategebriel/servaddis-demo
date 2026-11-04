import type { VerificationStatus } from "@prisma/client";
import { Circle, Hourglass, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// doc 04 §6.2 venue states: Pending / Verified / Rejected, icon + label, never colour alone.

const CHIP: Record<VerificationStatus, { icon: LucideIcon; tone: string }> = {
  UNSUBMITTED: { icon: Circle, tone: "bg-gray-100 text-gray-700" },
  PENDING: { icon: Hourglass, tone: "bg-info-bg text-info-fg" },
  VERIFIED: { icon: ShieldCheck, tone: "bg-success-bg text-success-fg" },
  REJECTED: { icon: ShieldAlert, tone: "bg-danger-bg text-danger-fg" },
};

export function VerificationChip({ status }: { status: VerificationStatus }) {
  const t = useTranslations("dashboard");
  const { icon: Icon, tone } = CHIP[status];
  return (
    <span
      data-testid="verification"
      data-status={status}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-sm px-2 py-1 text-caption",
        tone,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {t(`verification.${status}`)}
    </span>
  );
}
