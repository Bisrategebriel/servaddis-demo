"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { VENUE_CATEGORIES, venueCreateBody } from "@/lib/zod-schemas";
import { ADDIS_SUB_CITIES } from "../../../prisma/seed/data/geography";

// SCR-E01 Venue setup. The shared zod schema gives instant feedback; the API re-validates.

type Field = "ownerName" | "nameEn" | "category" | "subCity" | "contactPhone";

const control =
  "h-11 w-full rounded-sm border border-input bg-card px-3 aria-invalid:border-danger";

function Labelled({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-small text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

export function VenueSetupForm({ name, phone }: { name: string; phone: string }) {
  const t = useTranslations("venue");
  const locale = useLocale();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fieldProps = (id: Field) => ({
    id,
    name: id,
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": errors[id] ? `${id}-error` : undefined,
  });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = venueCreateBody.safeParse(raw);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        next[field] = t(`errors.${field}`);
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(raw),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.assign(new URL(data.redirectTo, window.location.origin).href);
        return;
      }
      setFormError(locale === "am" ? data.error.messageAm : data.error.message);
    } catch {
      setFormError(t("errors.network"));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-h1">{t("title")}</h1>
        <p className="text-text-secondary">{t("intro")}</p>
      </div>

      <Labelled id="ownerName" label={t("ownerName")} error={errors.ownerName}>
        <input {...fieldProps("ownerName")} defaultValue={name} className={control} />
      </Labelled>
      <Labelled id="nameEn" label={t("nameEn")} error={errors.nameEn}>
        <input {...fieldProps("nameEn")} className={control} />
      </Labelled>
      <Labelled id="nameAm" label={t("nameAm")}>
        <input id="nameAm" name="nameAm" lang="am" className={control} />
      </Labelled>
      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled id="category" label={t("category")} error={errors.category}>
          <select {...fieldProps("category")} defaultValue="" className={control}>
            <option value="" disabled>
              {t("choose")}
            </option>
            {VENUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled id="subCity" label={t("subCity")} error={errors.subCity}>
          <select {...fieldProps("subCity")} defaultValue="" className={control}>
            <option value="" disabled>
              {t("choose")}
            </option>
            {ADDIS_SUB_CITIES.map((s) => (
              <option key={s.slug} value={s.slug}>
                {locale === "am" ? s.nameAm : s.nameEn}
              </option>
            ))}
          </select>
        </Labelled>
      </div>
      <Labelled id="contactPhone" label={t("contactPhone")} error={errors.contactPhone}>
        <input
          {...fieldProps("contactPhone")}
          type="tel"
          defaultValue={phone}
          className={control}
        />
      </Labelled>
      <Labelled id="descriptionEn" label={t("descriptionEn")}>
        <textarea
          id="descriptionEn"
          name="descriptionEn"
          rows={2}
          maxLength={500}
          className="w-full rounded-sm border border-input bg-card p-3"
        />
      </Labelled>
      <Labelled id="descriptionAm" label={t("descriptionAm")}>
        <textarea
          id="descriptionAm"
          name="descriptionAm"
          lang="am"
          rows={2}
          maxLength={500}
          className="w-full rounded-sm border border-input bg-card p-3"
        />
      </Labelled>

      {formError && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={busy} className="h-11 text-body sm:w-fit sm:px-6">
        {busy ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
