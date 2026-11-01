"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { AppLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

// አማ | EN segmented control (doc 04 §5 LangToggle). Always in the top bar, never in a menu.
// The choice is saved server-side (cookie + User.locale), then the page reloads so <html lang>,
// fonts and every message switch together.
export function LangToggle({ surface = "light" }: { surface?: "light" | "navy" }) {
  const t = useTranslations("lang");
  const current = useLocale() as AppLocale;
  const [pending, setPending] = useState<AppLocale | null>(null);

  async function choose(locale: AppLocale) {
    if (locale === current || pending) return;
    setPending(locale);
    const res = await fetch("/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    if (res.ok) window.location.reload();
    else setPending(null);
  }

  // Each language is named in itself ("አማርኛ", "English") whatever the page language, so people
  // can find their own language; the button's lang attribute makes screen readers say it right.
  const options: { locale: AppLocale; label: string; name: string }[] = [
    { locale: "am", label: t("am"), name: "አማርኛ" },
    { locale: "en", label: t("en"), name: "English" },
  ];

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "inline-flex rounded-md border p-0.5",
        surface === "navy" ? "border-navy-700" : "border-border-strong",
      )}
    >
      {options.map((o) => {
        const active = o.locale === current;
        return (
          <button
            key={o.locale}
            type="button"
            lang={o.locale}
            aria-pressed={active}
            aria-label={o.name}
            disabled={pending !== null}
            onClick={() => choose(o.locale)}
            className={cn(
              "min-h-9 min-w-11 rounded-sm px-2.5 text-small font-semibold transition-colors",
              surface === "navy"
                ? active
                  ? "bg-amber-500 text-navy-900"
                  : "text-gray-300 hover:text-white"
                : active
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
