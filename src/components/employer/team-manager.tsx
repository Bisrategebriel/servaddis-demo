"use client";

import type { MemberRole } from "@prisma/client";
import { ChevronDown, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OWNER_ONLY_GRANTS, PRESETS, type VenuePermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/server/services/team";

// SCR-E14 Team (E-17): members with role preset and per-permission toggles (doc 04
// PermissionMatrix), invite by phone, remove. The server enforces every guard (T4.1); the
// screen mirrors them so people aren't offered a switch that will be refused.

const ROLES: MemberRole[] = ["OWNER", "HR_MANAGER", "POSTER", "SCREENER", "VIEWER"];
const GROUPS: { key: "jobs" | "applicants" | "business"; perms: VenuePermission[] }[] = [
  {
    key: "jobs",
    perms: ["job.view", "job.create", "job.edit", "job.submit", "job.close", "social.promote"],
  },
  {
    key: "applicants",
    perms: [
      "applicant.view",
      "applicant.shortlist",
      "applicant.reject",
      "applicant.hire",
      "contact.reveal",
    ],
  },
  { key: "business", perms: ["insights.view", "billing.manage", "team.manage", "venue.edit"] },
];
const field = "h-11 w-full rounded-sm border border-input bg-card px-3";

type Draft = { role: MemberRole; perms: Set<VenuePermission> };

/** Grant/revoke relative to the role's preset: what the API stores. */
function overrides(d: Draft) {
  const preset = new Set<VenuePermission>(PRESETS[d.role]);
  return {
    role: d.role,
    grant: [...d.perms].filter((p) => !preset.has(p)),
    revoke: [...preset].filter((p) => !d.perms.has(p)),
  };
}

function PermissionMatrix({
  draft,
  disabled,
  onToggle,
}: {
  draft: Draft;
  disabled: (p: VenuePermission) => string | null;
  onToggle: (p: VenuePermission) => void;
}) {
  const t = useTranslations("permissions");
  const preset = new Set<VenuePermission>(PRESETS[draft.role]);
  return (
    <div className="grid gap-4 sm:grid-cols-3" data-testid="matrix">
      {GROUPS.map((g) => (
        <fieldset key={g.key} className="flex flex-col gap-1">
          <legend className="mb-1 text-small font-semibold">{t(`groups.${g.key}`)}</legend>
          {g.perms.map((p) => {
            const on = draft.perms.has(p);
            const reason = disabled(p);
            const changed = on !== preset.has(p);
            return (
              <div
                key={p}
                className="flex items-center justify-between gap-2"
                title={reason ?? undefined}
              >
                <span className={cn("text-small", changed && "font-semibold")}>
                  {t(`keys.${p}`)}
                  {changed && <span className="sr-only"> *</span>}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t(`keys.${p}`)}
                  disabled={!!reason}
                  onClick={() => onToggle(p)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    on ? "bg-primary" : "bg-gray-300",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-5 rounded-full bg-white shadow transition-transform",
                      on ? "translate-x-5.5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

export function TeamManager({
  venueId,
  initial,
  actorIsOwner,
}: {
  venueId: string;
  initial: TeamMember[];
  actorIsOwner: boolean;
}) {
  const t = useTranslations("team");
  const tr = useTranslations("roles");
  const am = useLocale() === "am";
  const [members, setMembers] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const reload = async () => {
    const res = await fetch(`/api/venues/${venueId}/team`);
    if (res.ok) setMembers((await res.json()).members);
  };
  const failMessage = async (res: Response) => {
    const { error: e } = await res.json();
    return am ? e.messageAm : e.message;
  };

  function expand(m: TeamMember) {
    setError(null);
    setNotice(null);
    setConfirmRemove(false);
    if (open === m.id) {
      setOpen(null);
      return;
    }
    setOpen(m.id);
    setDraft({ role: m.role, perms: new Set(m.permissions) });
  }

  async function send(method: "PATCH" | "DELETE", m: TeamMember, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/venues/${venueId}/team/${m.id}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        await reload();
        setNotice(t("saved"));
        if (method === "DELETE") setOpen(null);
      } else {
        setError(await failMessage(res));
      }
    } catch {
      setError(t("failed"));
    }
    setBusy(false);
  }

  async function invite(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/venues/${venueId}/team`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone"),
          role: form.get("role"),
        }),
      });
      if (res.ok) {
        await reload();
        setInviting(false);
        setNotice(t("invited"));
      } else {
        setError(await failMessage(res));
      }
    } catch {
      setError(t("failed"));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">{t("title")}</h1>
        {!inviting && (
          <Button
            className="h-11 px-4"
            onClick={() => {
              setInviting(true);
              setOpen(null);
              setError(null);
              setNotice(null);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {t("invite")}
          </Button>
        )}
      </div>

      {notice && (
        <p role="status" className="text-small text-success-fg">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
          {error}
        </p>
      )}

      {inviting && (
        <form
          action={invite}
          aria-label={t("inviteTitle")}
          className="flex flex-col gap-3 rounded-md border border-border bg-card p-4"
        >
          <h2 className="text-h3">{t("inviteTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-small font-medium">{t("name")}</span>
              <input name="name" required minLength={2} maxLength={80} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-small font-medium">{t("phone")}</span>
              <input name="phone" required inputMode="tel" placeholder="09…" className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-small font-medium">{t("role")}</span>
              <select name="role" defaultValue="SCREENER" className={field}>
                {ROLES.filter((r) => actorIsOwner || r !== "OWNER").map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={() => setInviting(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" className="h-11 px-4" disabled={busy}>
              {busy ? t("sending") : t("send")}
            </Button>
          </div>
        </form>
      )}

      <ul
        className="flex flex-col divide-y divide-border rounded-md border border-border bg-card"
        data-testid="team"
      >
        {members.map((m) => {
          const customised = m.grant.length > 0 || m.revoke.length > 0;
          const expanded = open === m.id && draft;
          return (
            <li key={m.id} data-member={m.name}>
              <button
                type="button"
                aria-expanded={open === m.id}
                onClick={() => expand(m)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-muted"
              >
                <span className="min-w-40 font-semibold">
                  {m.name}
                  {m.isSelf && (
                    <span className="font-normal text-text-secondary"> ({t("you")})</span>
                  )}
                </span>
                <span className="text-small">{tr(m.role)}</span>
                <span
                  className={cn(
                    "rounded-sm px-2 py-0.5 text-caption",
                    customised ? "bg-warning-bg text-warning-fg" : "bg-gray-100 text-gray-700",
                  )}
                >
                  {customised ? t("customised") : t("preset")}
                </span>
                {m.status === "INVITED" && (
                  <span className="rounded-sm bg-info-bg px-2 py-0.5 text-caption text-info-fg">
                    {t("pending")}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "ml-auto size-4 transition-transform",
                    open === m.id && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              {expanded && (
                <div
                  className="flex flex-col gap-4 border-t border-border px-4 py-4"
                  aria-label={t("expand", { name: m.name })}
                >
                  <label className="flex max-w-xs flex-col gap-1.5">
                    <span className="text-small font-medium">{t("role")}</span>
                    <select
                      value={draft.role}
                      disabled={m.isSelf}
                      onChange={(e) => {
                        const role = e.target.value as MemberRole;
                        setDraft({ role, perms: new Set(PRESETS[role]) });
                      }}
                      className={field}
                    >
                      {ROLES.filter((r) => actorIsOwner || r !== "OWNER" || m.role === "OWNER").map(
                        (r) => (
                          <option key={r} value={r}>
                            {tr(r)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <p className="text-small text-text-secondary">{t(`helper.${draft.role}`)}</p>
                  <PermissionMatrix
                    draft={draft}
                    disabled={(p) =>
                      m.isSelf && p === "team.manage"
                        ? t("selfLock")
                        : !actorIsOwner && OWNER_ONLY_GRANTS.includes(p) && !draft.perms.has(p)
                          ? t("ownerOnly")
                          : null
                    }
                    onToggle={(p) => {
                      const perms = new Set(draft.perms);
                      if (perms.has(p)) perms.delete(p);
                      else perms.add(p);
                      setDraft({ ...draft, perms });
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="h-11 px-4"
                      disabled={busy}
                      onClick={() => send("PATCH", m, overrides(draft))}
                    >
                      {busy ? t("saving") : t("save")}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 px-4"
                      onClick={() =>
                        setDraft({ role: draft.role, perms: new Set(PRESETS[draft.role]) })
                      }
                    >
                      {t("reset")}
                    </Button>
                    {!m.isSelf &&
                      (confirmRemove ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-small">{t("removeConfirm", { name: m.name })}</span>
                          <Button
                            variant="destructive"
                            className="h-11 px-4"
                            disabled={busy}
                            onClick={() => send("DELETE", m)}
                          >
                            {t("confirmRemove")}
                          </Button>
                          <Button
                            variant="outline"
                            className="h-11 px-4"
                            onClick={() => setConfirmRemove(false)}
                          >
                            {t("cancel")}
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          className="ml-auto h-11 px-4 text-danger-fg"
                          onClick={() => setConfirmRemove(true)}
                        >
                          {t("remove")}
                        </Button>
                      ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
