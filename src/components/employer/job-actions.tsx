"use client";

import type { JobStatus } from "@prisma/client";
import { RotateCcw, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// SCR-E07 actions: close a live job (with a confirm step) and one-tap repost of an ended one.

export function JobActions({ jobId, status }: { jobId: string; status: JobStatus }) {
  const t = useTranslations("jobs.overview");
  const locale = useLocale();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "close" | "repost") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/${action}`, { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        if (action === "repost") {
          // A new job: a full load, so no cached page of it can exist (see the composer).
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- above
          window.location.assign(`/employer/jobs/${body.job.id}`);
          return;
        }
        setConfirming(false);
        router.refresh(); // the current route: refresh is enough here
      } else {
        setError(locale === "am" ? body.error.messageAm : body.error.message);
      }
    } catch {
      setError(t("actionFailed"));
    }
    setBusy(false);
  }

  if (status !== "LIVE" && status !== "EXPIRED" && status !== "CLOSED") return null;

  return (
    <div className="flex flex-col items-end gap-2">
      {status === "LIVE" ? (
        confirming ? (
          <div
            role="group"
            aria-label={t("closeConfirm")}
            className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
          >
            <p className="text-small">{t("closeConfirm")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="h-10 px-3" onClick={() => setConfirming(false)}>
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                className="h-10 px-3"
                disabled={busy}
                onClick={() => call("close")}
              >
                {t("closeJob")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="h-11 px-4" onClick={() => setConfirming(true)}>
            <XCircle className="size-4" aria-hidden />
            {t("closeJob")}
          </Button>
        )
      ) : (
        <Button className="h-11 px-4" disabled={busy} onClick={() => call("repost")}>
          <RotateCcw className="size-4" aria-hidden />
          {busy ? t("reposting") : t("repost")}
        </Button>
      )}
      {error && (
        <p
          role="alert"
          className="max-w-sm rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg"
        >
          {error}
        </p>
      )}
    </div>
  );
}
