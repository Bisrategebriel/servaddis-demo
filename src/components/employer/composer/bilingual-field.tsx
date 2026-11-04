"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

// doc 04 §5 BilingualField: one input with አማ / EN tabs and completion dots.

type Lang = "am" | "en";

export function BilingualField({
  label,
  hint,
  error,
  multiline = false,
  rows = 4,
  valueEn,
  valueAm,
  onChange,
  initialLang = "am",
  autoFocus = false,
}: {
  label: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  valueEn: string;
  valueAm: string;
  onChange: (lang: Lang, value: string) => void;
  initialLang?: Lang;
  autoFocus?: boolean;
}) {
  const t = useTranslations("jobs.composer");
  const lang = useTranslations("lang");
  const id = useId();
  const [active, setActive] = useState<Lang>(initialLang);
  const value = active === "am" ? valueAm : valueEn;
  const filled = { am: !!valueAm.trim(), en: !!valueEn.trim() };
  const oneOnly = filled.am !== filled.en;
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ");
  const control = {
    id,
    lang: active,
    autoFocus,
    value,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
    onChange: (e: { target: { value: string } }) => onChange(active, e.target.value),
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-small font-medium">
          {label} ({active === "am" ? "አማርኛ" : "English"})
        </label>
        <div role="group" aria-label={label} className="flex gap-1">
          {(["am", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={active === l}
              // WCAG 2.5.3: the name starts with the visible label ("EN (English): filled in")
              aria-label={`${lang(l)} (${l === "am" ? "አማርኛ" : "English"}): ${filled[l] ? t("filled") : t("empty")}`}
              onClick={() => setActive(l)}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-sm px-2.5 text-caption",
                active === l ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  filled[l] ? "bg-success" : "border border-border-strong bg-card",
                )}
              />
              {lang(l)}
            </button>
          ))}
        </div>
      </div>
      {multiline ? (
        <textarea
          {...control}
          rows={rows}
          maxLength={3000}
          className="w-full rounded-sm border border-input bg-card p-3 aria-invalid:border-danger"
        />
      ) : (
        <input
          {...control}
          maxLength={120}
          className="h-11 w-full rounded-sm border border-input bg-card px-3 aria-invalid:border-danger"
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-small text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-small text-danger-fg">
          {error}
        </p>
      )}
      {!error && oneOnly && (
        <p className="text-small text-warning-fg">
          {t("oneLanguage", { language: filled.am ? "English" : "አማርኛ" })}
        </p>
      )}
    </div>
  );
}
