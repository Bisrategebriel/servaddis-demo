"use client";

import type { ApplicationStatus } from "@prisma/client";
import { BadgeCheck, Lock, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format";
import { REJECT_REASONS } from "@/lib/zod-schemas";
import type { ApplicationDetail } from "@/server/services/applicant-actions";

// SCR-E09 drawer: right sheet on desktop, full screen on phones. Opening it marks a new
// application Viewed. Buttons a role can never use are hidden; buttons the stage blocks are
// disabled with the reason (doc 04 SCR-E08/E09).

const LANGS = ["am", "en", "om", "fr"] as const;
const LEVELS = ["native", "fluent", "good", "basic"] as const;
const EVENTS = [
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "REJECTED",
  "HIRED",
  "CONTACT_REVEALED",
] as const;
const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

type Action = "shortlist" | "reject" | "hire" | "reveal-contact";

export function ApplicantDrawer({
  applicationId,
  permissions,
  onClose,
  onChanged,
}: {
  applicationId: string | null;
  permissions: string[];
  onClose: () => void;
  onChanged: (id: string, status: ApplicationStatus) => void;
}) {
  const t = useTranslations("drawer");
  const tp = useTranslations("pipeline");
  const router = useRouter();
  const [filled, setFilled] = useState(false);
  const locale = useLocale();
  const am = locale === "am";
  const can = (p: string) => permissions.includes(p);
  const [data, setData] = useState<ApplicationDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<(typeof REJECT_REASONS)[number]>("SKILLS_MISMATCH");

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/applications/${id}`);
    if (!res.ok) throw new Error(String(res.status));
    const { application } = (await res.json()) as { application: ApplicationDetail };
    setData(application);
    return application;
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    let live = true;
    (async () => {
      try {
        const app = await load(applicationId);
        if (live && app.status === "APPLIED") {
          await fetch(`/api/applications/${applicationId}/view`, { method: "POST" });
          if (!live) return;
          onChanged(applicationId, "VIEWED");
          await load(applicationId);
        }
      } catch {
        if (live) setError(t("failed"));
      }
    })();
    return () => {
      live = false;
    };
  }, [applicationId, load, onChanged, t]);

  async function act(action: Action, body?: unknown) {
    if (!applicationId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const { error: e } = await res.json();
        setError(am ? e.messageAm : e.message);
      } else {
        setRejecting(false);
        const result = await res.json();
        const app = await load(applicationId);
        onChanged(applicationId, app.status);
        // The last opening was filled: the job closed and other applicants were rejected, so
        // the page's status chip and the other cards change too.
        if (result.jobFilled) {
          setFilled(true);
          router.refresh();
        }
      }
    } catch {
      setError(t("failed"));
    }
    setBusy(false);
  }

  const open = !!applicationId;
  const s = data?.status;
  const final = s === "HIRED" || s === "REJECTED";
  const shortlisted = s === "SHORTLISTED" || s === "HIRED";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        closeLabel={t("close")}
        data-testid="drawer"
        className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-h2">
            {data ? data.name || "—" : t("loading")}
            {data?.faydaVerified && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-success-bg px-1.5 py-0.5 text-caption font-normal text-success-fg">
                <BadgeCheck className="size-3.5" aria-hidden />
                {t("fayda")}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>{data?.headline ?? t("title")}</SheetDescription>
        </SheetHeader>

        {data && (
          <div className="flex flex-col gap-5 p-4 text-body">
            {filled && (
              <p
                role="status"
                data-testid="job-filled"
                className="rounded-sm bg-success-bg px-3 py-2 text-small text-success-fg"
              >
                {t("jobFilled")}
              </p>
            )}
            {data.status === "REJECTED" && data.rejectReason && (
              <p className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
                {t("rejected", { reason: t(`reasons.${data.rejectReason}`) })}
              </p>
            )}

            {/* Contact: masked until shortlisted and revealed (E-14) */}
            <section aria-labelledby="d-phone" className="flex flex-col gap-1.5">
              <h3 id="d-phone" className="text-small font-semibold">
                {t("phone")}
              </h3>
              <p className="flex items-center gap-2 font-mono" data-testid="phone">
                {data.revealed ? (
                  <Phone className="size-4" aria-hidden />
                ) : (
                  <Lock className="size-4" aria-hidden />
                )}
                {data.phone}
              </p>
              {data.revealed && data.revealedBy ? (
                <p className="text-caption text-text-secondary">
                  {t("revealedBy", {
                    name: data.revealedBy.name,
                    time: formatDateTime(data.revealedBy.at, locale),
                  })}
                </p>
              ) : (
                <>
                  {!shortlisted && (
                    <p className="text-caption text-text-secondary">{t("hiddenHint")}</p>
                  )}
                  {can("contact.reveal") && s !== "REJECTED" && (
                    <Button
                      variant="outline"
                      className="h-10 w-fit"
                      disabled={busy || !shortlisted}
                      title={!shortlisted ? t("shortlistFirst") : undefined}
                      onClick={() => act("reveal-contact")}
                    >
                      {t("reveal")}
                    </Button>
                  )}
                  {can("contact.reveal") && !shortlisted && s !== "REJECTED" && (
                    <span className="text-caption text-text-secondary">{t("shortlistFirst")}</span>
                  )}
                </>
              )}
            </section>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-small">
              <dt className="text-text-secondary">{t("experience")}</dt>
              <dd>{tp("years", { count: data.experienceYears })}</dd>
              {data.skills.length > 0 && (
                <>
                  <dt className="text-text-secondary">{t("skills")}</dt>
                  <dd>{data.skills.map((k) => (am ? k.am : k.en)).join(" · ")}</dd>
                </>
              )}
              {data.languages.length > 0 && (
                <>
                  <dt className="text-text-secondary">{t("languages")}</dt>
                  <dd>
                    {data.languages
                      .map(
                        (l) =>
                          `${isOneOf(LANGS, l.code) ? t(`langs.${l.code}`) : l.code} (${isOneOf(LEVELS, l.level) ? t(`levels.${l.level}`) : l.level})`,
                      )
                      .join(" · ")}
                  </dd>
                </>
              )}
              {data.previousWorkplaces.length > 0 && (
                <>
                  <dt className="text-text-secondary">{t("previous")}</dt>
                  <dd>
                    {data.previousWorkplaces.map((w, i) => (
                      <span key={i} className="block">
                        {w.name} — {t("yearsAt", { role: w.role, years: w.years })}
                      </span>
                    ))}
                  </dd>
                </>
              )}
              {data.availability && (
                <>
                  <dt className="text-text-secondary">{t("availability")}</dt>
                  <dd>{data.availability}</dd>
                </>
              )}
            </dl>

            {data.note && (
              <section className="flex flex-col gap-1">
                <h3 className="text-small font-semibold">{t("note")}</h3>
                <p className="rounded-sm bg-muted px-3 py-2 text-small">“{data.note}”</p>
              </section>
            )}

            <section aria-labelledby="d-timeline" className="flex flex-col gap-1.5">
              <h3 id="d-timeline" className="text-small font-semibold">
                {t("timeline")}
              </h3>
              <ol className="flex flex-col gap-1 text-small" data-testid="timeline">
                {data.events.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {isOneOf(EVENTS, e.type) ? t(`events.${e.type}`) : e.type}
                      {e.actor && (
                        <span className="text-text-secondary"> {t("by", { name: e.actor })}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-text-secondary">
                      {formatDateTime(e.at, locale)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {error && (
              <p
                role="alert"
                className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg"
              >
                {error}
              </p>
            )}

            {!final && (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                {rejecting ? (
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1 text-small">
                      {t("rejectReason")}
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as typeof reason)}
                        className="h-10 rounded-sm border border-input bg-card px-2"
                      >
                        {REJECT_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {t(`reasons.${r}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="h-11 flex-1"
                        onClick={() => setRejecting(false)}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-11 flex-1"
                        disabled={busy}
                        onClick={() => act("reject", { reason })}
                      >
                        {t("rejectConfirm")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {can("applicant.reject") && (
                      <Button
                        variant="outline"
                        className="h-11 flex-1"
                        disabled={busy}
                        onClick={() => setRejecting(true)}
                      >
                        {t("reject")}
                      </Button>
                    )}
                    {can("applicant.shortlist") && !shortlisted && (
                      <Button
                        className="h-11 flex-1"
                        disabled={busy}
                        onClick={() => act("shortlist")}
                      >
                        {t("shortlist")}
                      </Button>
                    )}
                    {can("applicant.hire") && (
                      <Button
                        className="h-11 flex-1"
                        disabled={busy || s !== "SHORTLISTED"}
                        title={s !== "SHORTLISTED" ? t("shortlistFirst") : undefined}
                        onClick={() => act("hire")}
                      >
                        {t("hire")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {!data && error && (
          <p
            role="alert"
            className="m-4 rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg"
          >
            {error}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
