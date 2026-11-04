"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { VENUE_CATEGORIES, venueCreateBody } from "@/lib/zod-schemas";
import { ADDIS_SUB_CITIES } from "../../../prisma/seed/data/geography";

// Venue details, two uses: SCR-E01 setup (creates the venue and its owner) and SCR-E16 profile
// (edits it). The shared zod schema gives instant feedback; the API re-validates.

type Field = "ownerName" | "nameEn" | "category" | "subCity" | "contactPhone";

export type VenueDetails = {
  nameEn: string;
  nameAm: string | null;
  category: string;
  subCity: string;
  contactPhone: string;
  descriptionEn: string | null;
  descriptionAm: string | null;
};

type Props =
  | { mode: "create"; name: string; phone: string }
  | { mode: "edit"; venueId: string; initial: VenueDetails };

const control =
  "h-11 w-full rounded-sm border border-input bg-card px-3 aria-invalid:border-danger";
const editBody = venueCreateBody.omit({ ownerName: true });

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

export function VenueForm(props: Props) {
  const t = useTranslations("venue");
  const locale = useLocale();
  const router = useRouter();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const editing = props.mode === "edit";
  const initial = editing ? props.initial : null;

  const fieldProps = (id: Field) => ({
    id,
    name: id,
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": errors[id] ? `${id}-error` : undefined,
  });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (editing ? editBody : venueCreateBody).safeParse(raw);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        next[field] = t(`errors.${field}`);
      }
      setErrors(next);
      setSaved(false);
      return;
    }
    setErrors({});
    setFormError(null);
    setSaved(false);
    setBusy(true);
    try {
      // Edits send every field: an optional text left empty clears it.
      const res = await fetch(editing ? `/api/venues/${props.venueId}` : "/api/venues", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(raw),
      });
      const data = await res.json();
      if (res.ok) {
        if (!editing) {
          window.location.assign(new URL(data.redirectTo, window.location.origin).href);
          return;
        }
        setSaved(true);
        router.refresh(); // the sidebar shows the venue name
      } else {
        setFormError(locale === "am" ? data.error.messageAm : data.error.message);
      }
    } catch {
      setFormError(t("errors.network"));
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      onChange={() => setSaved(false)}
      className="flex max-w-xl flex-col gap-4"
      data-testid="venue-form"
    >
      {!editing && (
        <>
          <div>
            <h1 className="text-h1">{t("title")}</h1>
            <p className="text-text-secondary">{t("intro")}</p>
          </div>
          <Labelled id="ownerName" label={t("ownerName")} error={errors.ownerName}>
            <input {...fieldProps("ownerName")} defaultValue={props.name} className={control} />
          </Labelled>
        </>
      )}
      <Labelled id="nameEn" label={t("nameEn")} error={errors.nameEn}>
        <input {...fieldProps("nameEn")} defaultValue={initial?.nameEn} className={control} />
      </Labelled>
      <Labelled id="nameAm" label={t("nameAm")}>
        <input
          id="nameAm"
          name="nameAm"
          lang="am"
          defaultValue={initial?.nameAm ?? ""}
          className={control}
        />
      </Labelled>
      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled id="category" label={t("category")} error={errors.category}>
          <select
            {...fieldProps("category")}
            defaultValue={initial?.category ?? ""}
            className={control}
          >
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
          <select
            {...fieldProps("subCity")}
            defaultValue={initial?.subCity ?? ""}
            className={control}
          >
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
          defaultValue={editing ? props.initial.contactPhone : props.phone}
          className={control}
        />
      </Labelled>
      <Labelled id="descriptionEn" label={t("descriptionEn")}>
        <textarea
          id="descriptionEn"
          name="descriptionEn"
          rows={editing ? 3 : 2}
          maxLength={500}
          defaultValue={initial?.descriptionEn ?? ""}
          className="w-full rounded-sm border border-input bg-card p-3"
        />
      </Labelled>
      <Labelled id="descriptionAm" label={t("descriptionAm")}>
        <textarea
          id="descriptionAm"
          name="descriptionAm"
          lang="am"
          rows={editing ? 3 : 2}
          maxLength={500}
          defaultValue={initial?.descriptionAm ?? ""}
          className="w-full rounded-sm border border-input bg-card p-3"
        />
      </Labelled>

      {formError && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy} className="h-11 text-body sm:w-fit sm:px-6">
          {busy ? t("saving") : editing ? t("saveChanges") : t("save")}
        </Button>
        {saved && (
          <p role="status" className="text-small text-success-fg">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
