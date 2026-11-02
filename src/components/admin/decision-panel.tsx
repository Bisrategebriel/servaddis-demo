"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// SCR-A02 decision panel. A reason is required to reject or request changes: the employer reads
// it. Licenses have no request-changes path (a rejected owner uploads again).
type Decision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

export function DecisionPanel({ itemId, allowChanges }: { itemId: string; allowChanges: boolean }) {
  const t = useTranslations("moderation");
  const locale = useLocale();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(decision: Decision) {
    if (decision !== "APPROVE" && !reason.trim()) return setError(t("reasonRequired"));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/moderation/${itemId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason: reason.trim() || undefined }),
      });
      if (res.ok) {
        router.push("/admin/queue");
        router.refresh();
        return;
      }
      const body = await res.json();
      setError(locale === "am" ? body.error.messageAm : body.error.message);
    } catch {
      setError(t("loadFailed"));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reason" className="text-small font-medium">
          {allowChanges ? t("reasonJob") : t("reason")}
        </label>
        <textarea
          id="reason"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-sm border border-input bg-card p-3"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 flex-1 text-body" disabled={busy} onClick={() => send("APPROVE")}>
          {t("approve")}
        </Button>
        {allowChanges && (
          <Button
            variant="outline"
            className="h-11 flex-1 text-body"
            disabled={busy}
            onClick={() => send("REQUEST_CHANGES")}
          >
            {t("requestChanges")}
          </Button>
        )}
        <Button
          variant="destructive"
          className="h-11 flex-1 text-body"
          disabled={busy}
          onClick={() => send("REJECT")}
        >
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}
