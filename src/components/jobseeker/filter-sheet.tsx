"use client";

import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { EMPLOYMENT_TYPES } from "@/lib/job-form";
import type { FeedQuery } from "@/server/services/feed";

// doc 04 SCR-J01 filter bottom sheet: role, sub-city, type, salary range, urgent only. A native
// <dialog> holding a plain GET form, so filtering is a normal page load (light on phones) and
// every filtered view has a shareable URL.

type Option = { slug: string; nameEn: string; nameAm: string };

const field = "h-11 w-full rounded-sm border border-input bg-card px-3";

export function FilterSheet({
  roles,
  subCities,
  current,
  activeCount,
}: {
  roles: Option[];
  subCities: Option[];
  current: FeedQuery;
  activeCount: number;
}) {
  const t = useTranslations("feed");
  const tp = useTranslations("jobs.preview");
  const am = useLocale() === "am";
  const dialog = useRef<HTMLDialogElement>(null);
  const name = (o: Option) => (am ? o.nameAm : o.nameEn);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-sm border border-input bg-card px-3 font-medium"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {activeCount ? t("filtersOn", { count: activeCount }) : t("filters")}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="filters-title"
        // Closes on a tap outside the sheet (the backdrop is the dialog element itself).
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="sheet-up m-0 mt-auto max-h-[85vh] w-full max-w-none rounded-t-2xl bg-card p-0 text-foreground backdrop:bg-navy-950/50 sm:m-auto sm:max-w-md sm:rounded-2xl"
      >
        <form method="get" action="/jobs" className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <h2 id="filters-title" className="text-h2">
              {t("filtersTitle")}
            </h2>
            <button
              type="button"
              aria-label={t("close")}
              onClick={() => dialog.current?.close()}
              className="inline-flex size-10 items-center justify-center rounded-sm hover:bg-muted"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {current.q && <input type="hidden" name="q" value={current.q} />}

          <label className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t("role")}</span>
            <select name="role" defaultValue={current.role ?? ""} className={field}>
              <option value="">{t("anyRole")}</option>
              {roles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {name(r)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t("subCity")}</span>
            <select name="sub" defaultValue={current.sub ?? ""} className={field}>
              <option value="">{t("anySubCity")}</option>
              {subCities.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {name(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t("type")}</span>
            <select name="type" defaultValue={current.type ?? ""} className={field}>
              <option value="">{t("anyType")}</option>
              {EMPLOYMENT_TYPES.map((e) => (
                <option key={e} value={e}>
                  {tp(`employment.${e}`)}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-small font-medium">{t("salary")}</legend>
            <div className="flex items-center gap-2">
              <input
                name="min"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={t("salaryMin")}
                placeholder={t("salaryMin")}
                defaultValue={current.min ?? ""}
                className={field}
              />
              <span aria-hidden>–</span>
              <input
                name="max"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={t("salaryMax")}
                placeholder={t("salaryMax")}
                defaultValue={current.max ?? ""}
                className={field}
              />
            </div>
          </fieldset>

          <label className="inline-flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="urgent"
              value="1"
              defaultChecked={current.urgent}
              className="size-4"
            />
            {t("urgentOnly")}
          </label>

          <div className="flex gap-2 pt-2">
            <Link
              href="/jobs"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-sm border border-input font-medium"
            >
              {t("clear")}
            </Link>
            <button
              type="submit"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-sm bg-primary font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {t("apply")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
