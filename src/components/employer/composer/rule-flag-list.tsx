"use client";

import { CircleCheck, Info, OctagonX, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Flag } from "@/server/rules/engine";
import { cn } from "@/lib/utils";

// doc 04 §5 RuleFlagList: block (red) · warn (amber-tinted) · info. Each flag names the field and
// quotes the exact phrase, and "Fix this" takes the employer to it.

const STYLE = {
  block: { icon: OctagonX, tone: "border-danger-solid/30 bg-danger-bg text-danger-fg" },
  warn: { icon: TriangleAlert, tone: "border-warning-fg/30 bg-warning-bg text-warning-fg" },
  info: { icon: Info, tone: "border-info-fg/30 bg-info-bg text-info-fg" },
} as const;

export function RuleFlagList({
  flags,
  loading,
  onFix,
}: {
  flags: Flag[] | null;
  loading: boolean;
  onFix: (flag: Flag) => void;
}) {
  const t = useTranslations("jobs.rules");
  const am = useLocale() === "am";

  if (!flags) {
    return loading ? <p className="text-small text-text-secondary">{t("checking")}</p> : null;
  }
  if (flags.length === 0) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg bg-success-bg p-3 text-small text-success-fg"
      >
        <CircleCheck className="size-5 shrink-0" aria-hidden />
        {t("noIssues")}
      </p>
    );
  }
  return (
    <section aria-label={t("title")} className="flex flex-col gap-2" data-testid="rule-flags">
      <h2 className="text-h3">{t("title")}</h2>
      <ul className="flex flex-col gap-2">
        {flags.map((flag, i) => {
          const { icon: Icon, tone } = STYLE[flag.severity];
          return (
            <li
              key={`${flag.ruleId}-${flag.field}-${i}`}
              data-severity={flag.severity}
              className={cn(
                "flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border p-3",
                tone,
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1 text-small">
                <p className="font-semibold">{am ? flag.messageAm : flag.messageEn}</p>
                <p>
                  {t(`fields.${flag.field}`)}
                  {flag.match && (
                    <>
                      {": "}
                      <mark className="rounded-sm bg-card px-1 break-all text-foreground">
                        “{flag.match}”
                      </mark>
                    </>
                  )}
                </p>
              </div>
              {flag.field !== "role" && (
                <button
                  type="button"
                  onClick={() => onFix(flag)}
                  className="min-h-10 text-small font-semibold underline underline-offset-4"
                >
                  {t("fix")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
