"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// SCR-A02 decision panel. A reason is required to reject, because the owner reads it.
export function LicenseDecision({ itemId }: { itemId: string }) {
  const t = useTranslations("moderation");
  const locale = useLocale();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(decision: "APPROVE" | "REJECT") {
    if (decision === "REJECT" && !reason.trim()) return setError(t("reasonRequired"));
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
          {t("reason")}
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
      <div className="flex gap-2">
        <Button className="h-11 flex-1 text-body" disabled={busy} onClick={() => send("APPROVE")}>
          {t("approve")}
        </Button>
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
