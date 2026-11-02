"use client";

import { BadgeCheck, Check, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { completenessItems } from "@/lib/profile-completeness";
import type { MyProfile } from "@/server/services/profile";

// SCR-J04 read-mostly profile (J-05): completeness meter with what is missing, the seeded
// profile, and a small form for the basics. Plain class strings (no `cn`): jobseeker budget.

const LANGS = ["am", "en", "om", "fr"] as const;
const LEVELS = ["native", "fluent", "good", "basic"] as const;
const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);
const field = "h-11 w-full rounded-sm border border-input bg-card px-3";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <dt className="text-small text-text-secondary">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ProfileView({ initial }: { initial: MyProfile }) {
  const t = useTranslations("profile");
  const td = useTranslations("drawer");
  const tp = useTranslations("pipeline");
  const am = useLocale() === "am";
  const [profile, setProfile] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const items = completenessItems({
    photoUrl: profile.photoUrl,
    headline: profile.headline,
    skillCount: profile.skills.length,
    experienceYears: profile.experienceYears,
    languageCount: profile.languages.length,
    previousWorkplaceCount: profile.previousWorkplaces.length,
    availability: profile.availability,
    preferredSubCityCount: profile.preferredSubCities.length,
  });
  const missing = items.filter((i) => !i.done);
  const pct = profile.completeness;
  const none = <span className="text-text-secondary">{t("none")}</span>;

  async function save(form: FormData) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          headline: form.get("headline") || undefined,
          experienceYears: form.get("experienceYears") || 0,
          availability: form.get("availability") || undefined,
        }),
      });
      const body = await res.json();
      if (res.ok) {
        setProfile(body.profile);
        setEditing(false);
        setSaved(true);
      } else {
        setError(am ? body.error.messageAm : body.error.message);
      }
    } catch {
      setError(t("failed"));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        {profile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny local SVG avatar
          <img src={profile.photoUrl} alt="" className="size-16 rounded-full bg-muted" />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-8 text-text-secondary" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-h1 wrap-break-word">{profile.name || t("title")}</h1>
          {profile.headline && <p className="text-text-secondary">{profile.headline}</p>}
          {profile.faydaVerified && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-success-bg px-1.5 py-0.5 text-caption text-success-fg">
              <BadgeCheck className="size-3.5" aria-hidden />
              {t("fayda")}
            </span>
          )}
        </div>
      </header>

      <section
        aria-labelledby="meter"
        className="flex flex-col gap-2 rounded-md border border-border bg-card p-4"
      >
        <h2 id="meter" className="text-h3" data-testid="completeness">
          {t("complete", { percent: pct })}
        </h2>
        <div
          role="progressbar"
          aria-label={t("meter")}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full rounded-full ${pct === 100 ? "bg-success" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-small text-text-secondary">{t("meterHint")}</p>
        {missing.length === 0 ? (
          <p className="inline-flex items-center gap-1.5 font-medium text-success-fg">
            <Check className="size-4" aria-hidden />
            {t("done")}
          </p>
        ) : (
          <div>
            <h3 className="text-small font-semibold">{t("missing")}</h3>
            <ul className="flex flex-col gap-1 pt-1" data-testid="missing">
              {missing.map((i) => (
                <li key={i.key} className="flex justify-between gap-3 text-small">
                  <span>{t(`items.${i.key}`)}</span>
                  <span className="shrink-0 font-semibold text-navy-700">
                    {t("points", { points: i.points })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {saved && (
        <p role="status" className="text-small text-success-fg">
          {t("saved")}
        </p>
      )}

      {editing ? (
        <form
          action={save}
          className="flex flex-col gap-3 rounded-md border border-border bg-card p-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t("name")}</span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={profile.name}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t("headline")}</span>
            <input
              name="headline"
              maxLength={120}
              defaultValue={profile.headline ?? ""}
              placeholder={t("headlineHint")}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t("years")}</span>
            <input
              name="experienceYears"
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              defaultValue={profile.experienceYears}
              className={`${field} w-28`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t("availability")}</span>
            <input
              name="availability"
              maxLength={80}
              defaultValue={profile.availability ?? ""}
              placeholder={t("availabilityHint")}
              className={field}
            />
          </label>
          {error && (
            <p role="alert" className="text-small text-danger-fg">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-sm border border-input font-medium"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-sm bg-primary font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setSaved(false);
          }}
          className="inline-flex h-11 w-fit items-center rounded-sm border border-input bg-card px-4 font-medium"
        >
          {t("edit")}
        </button>
      )}

      <dl className="flex flex-col gap-3">
        <Row label={t("experience")}>{tp("years", { count: profile.experienceYears })}</Row>
        <Row label={t("skills")}>
          {profile.skills.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {profile.skills.map((s, i) => (
                <li
                  key={i}
                  className="rounded-full bg-navy-50 px-2.5 py-0.5 text-small text-navy-800"
                >
                  {am ? s.am : s.en}
                </li>
              ))}
            </ul>
          ) : (
            none
          )}
        </Row>
        <Row label={t("languages")}>
          {profile.languages.length
            ? profile.languages
                .map(
                  (l) =>
                    `${isOneOf(LANGS, l.code) ? td(`langs.${l.code}`) : l.code} (${isOneOf(LEVELS, l.level) ? td(`levels.${l.level}`) : l.level})`,
                )
                .join(" · ")
            : none}
        </Row>
        <Row label={t("previous")}>
          {profile.previousWorkplaces.length
            ? profile.previousWorkplaces.map((w, i) => (
                <span key={i} className="block">
                  {w.name} — {td("yearsAt", { role: w.role, years: w.years })}
                </span>
              ))
            : none}
        </Row>
        <Row label={t("availability")}>{profile.availability ?? none}</Row>
        <Row label={t("preferred")}>
          {profile.preferredSubCities.length
            ? profile.preferredSubCities.map((s) => (am ? s.am : s.en)).join(" · ")
            : none}
        </Row>
      </dl>
      <p className="text-caption text-text-secondary">{t("builderNote")}</p>
    </div>
  );
}
