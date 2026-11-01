"use client";

import { CheckCircle2, FileUp, Hourglass, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ChangeEvent, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { MAX_LICENSE_BYTES, isLicenseMime } from "@/lib/license-file";
import { cn } from "@/lib/utils";

// SCR-E02 License upload (doc 04 §5 FileDropzone). XHR rather than fetch, because fetch can't
// report upload progress.

type Props = {
  venueId: string;
  verification: "UNSUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED";
  fileName: string | null;
  rejectionReason: string | null;
  showSample: boolean;
};

export function LicenseUpload({
  venueId,
  verification,
  fileName,
  rejectionReason,
  showSample,
}: Props) {
  const t = useTranslations("license");
  const locale = useLocale();
  const [status, setStatus] = useState(verification);
  const [name, setName] = useState(fileName);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    if (!isLicenseMime(file.type)) return setError(t("badType"));
    if (file.size > MAX_LICENSE_BYTES) return setError(t("tooLarge"));

    setError(null);
    setProgress(0);
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/venues/${venueId}/license`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status === 201) {
        setName(file.name);
        setStatus("PENDING");
      } else {
        const body = xhr.response?.error;
        setError(body ? (locale === "am" ? body.messageAm : body.message) : t("failed"));
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError(t("failed"));
    };
    xhr.send(form);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = ""; // so choosing the same file again still fires
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  const dashboard = (
    <Button asChild className="h-11 w-fit px-6 text-body">
      <Link href="/employer">{t("toDashboard")}</Link>
    </Button>
  );

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-h1">{t("title")}</h1>
        <p className="text-text-secondary">{t("intro")}</p>
      </div>

      {status === "VERIFIED" && (
        <p className="flex items-center gap-2 rounded-lg bg-success-bg p-3 text-success-fg">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          {t("verified")}
        </p>
      )}

      {status === "PENDING" && (
        <div role="status" className="flex flex-col gap-1 rounded-lg bg-info-bg p-3 text-info-fg">
          <p className="flex items-center gap-2 font-semibold">
            <Hourglass className="size-5 shrink-0" aria-hidden />
            {t("pending")}
          </p>
          {name && <p className="text-small break-all">{name}</p>}
          <p className="text-small">{t("pendingHint")}</p>
        </div>
      )}

      {status === "REJECTED" && (
        <div className="flex flex-col gap-1 rounded-lg bg-danger-bg p-3 text-danger-fg">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-5 shrink-0" aria-hidden />
            {t("rejected")}
          </p>
          {rejectionReason && <p className="text-small">{rejectionReason}</p>}
        </div>
      )}

      {(status === "UNSUBMITTED" || status === "REJECTED") && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
            dragging ? "border-primary bg-accent" : "border-border-strong bg-card",
          )}
        >
          <FileUp className="size-8 text-navy-600" aria-hidden />
          <span className="font-semibold">{t("choose")}</span>
          <span className="text-small text-text-secondary">{t("rules")}</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={onPick}
            disabled={progress !== null}
            className="sr-only"
          />
        </label>
      )}

      {progress !== null && (
        <div>
          <p className="text-small">{t("uploading", { progress })}</p>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("choose")}
            className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
          {error}
        </p>
      )}

      {showSample && (status === "UNSUBMITTED" || status === "REJECTED") && (
        <a
          href="/samples/license-sample.pdf"
          download
          className="w-fit text-small text-navy-700 underline underline-offset-4"
        >
          {t("sample")}
        </a>
      )}

      {(status === "PENDING" || status === "VERIFIED") && dashboard}
    </section>
  );
}
