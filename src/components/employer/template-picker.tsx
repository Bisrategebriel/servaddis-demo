"use client";

import {
  Briefcase,
  ChefHat,
  Coffee,
  Compass,
  ConciergeBell,
  CookingPot,
  BedDouble,
  Flower2,
  HandPlatter,
  Receipt,
  Search,
  Soup,
  Wine,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

// SCR-E05 role template picker. Both language names show on each tile (doc 04 §7).

const ICONS: Record<string, LucideIcon> = {
  waiter: HandPlatter,
  barista: Coffee,
  bartender: Wine,
  "host-cashier": Receipt,
  "front-desk": ConciergeBell,
  housekeeper: BedDouble,
  "line-cook": CookingPot,
  "chef-de-partie": ChefHat,
  "kitchen-steward": Soup,
  "spa-therapist": Flower2,
  "tour-guide": Compass,
  "hospitality-manager": Briefcase,
};

const POPULAR = new Set(["waiter", "barista"]);

export type TemplateTile = {
  slug: string;
  nameEn: string;
  nameAm: string;
  salaryMin: number;
  salaryMax: number;
};

const thousands = (n: number) => String(Math.round(n / 100) / 10);

export function TemplatePicker({ templates }: { templates: TemplateTile[] }) {
  const t = useTranslations("jobs.picker");
  const am = useLocale() === "am";
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = templates.filter(
    (x) => !q || x.nameEn.toLowerCase().includes(q) || x.nameAm.includes(q),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-11 w-full rounded-sm border border-input bg-card pr-3 pl-10"
          />
        </div>
        <Link
          href="/employer/jobs/new/compose"
          className="text-small text-navy-700 underline underline-offset-4"
        >
          {t("startBlank")}
        </Link>
      </div>

      {shown.length === 0 && <p className="text-text-secondary">{t("noMatch")}</p>}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {shown.map((x) => {
          const Icon = ICONS[x.slug] ?? Briefcase;
          return (
            <li key={x.slug}>
              <Link
                href={`/employer/jobs/new/compose?template=${x.slug}`}
                className="flex h-full min-h-32 flex-col gap-1 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <span className="flex items-start justify-between gap-2">
                  <Icon className="size-6 text-navy-600" aria-hidden />
                  {POPULAR.has(x.slug) && (
                    <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-caption text-warning-fg">
                      {t("popular")}
                    </span>
                  )}
                </span>
                <span className="text-h3">{am ? x.nameAm : x.nameEn}</span>
                <span lang={am ? "en" : "am"} className="text-small text-text-secondary">
                  {am ? x.nameEn : x.nameAm}
                </span>
                <span className="mt-auto text-small text-text-secondary tabular-nums">
                  {t("typical", { min: thousands(x.salaryMin), max: thousands(x.salaryMax) })}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
