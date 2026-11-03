"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { EmptyIllustration } from "@/components/empty-state";

// doc 04 §6.1 Error: a server error never leaves a blank screen. Rendered by each shell's
// error.tsx inside that shell, so navigation stays usable; `retry` re-renders the segment.
export function RouteError({
  error,
  retry,
  home,
}: {
  error: unknown;
  retry: () => void;
  home: string;
}) {
  const t = useTranslations("routeError");
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <section
      role="alert"
      data-testid="route-error"
      className="mx-auto flex w-full max-w-lg flex-col items-start gap-3 rounded-md border border-border bg-card p-6"
    >
      <EmptyIllustration name="offline" className="h-24 w-30" />
      <h1 className="text-h2">{t("title")}</h1>
      <p className="text-text-secondary">{t("body")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={retry}
          className="inline-flex h-11 items-center rounded-sm bg-primary px-4 font-medium text-primary-foreground transition-colors duration-150 ease-out hover:bg-primary-hover"
        >
          {t("retry")}
        </button>
        <Link
          href={home}
          className="inline-flex h-11 items-center rounded-sm border border-input bg-card px-4 font-medium transition-colors duration-150 ease-out hover:bg-accent"
        >
          {t("home")}
        </Link>
      </div>
      {digest && <p className="text-caption text-text-secondary">{digest}</p>}
    </section>
  );
}
