import { Lock } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";

// doc 04 §6.1 "Blocked by permission": a full-page 403 that says who can help. Pages render this
// instead of redirecting, so a member who follows a link sees why, not a bounce to the dashboard.
// The API still answers 403 on its own (T0.5); this is the page-level counterpart.

export async function Forbidden({ venueId }: { venueId: string }) {
  const [t, owners] = await Promise.all([
    getTranslations("forbidden"),
    db.venueMember.findMany({
      where: { venueId, role: "OWNER", status: "ACTIVE" },
      select: { displayName: true, user: { select: { name: true } } },
    }),
  ]);
  const names = owners.map((o) => o.user?.name || o.displayName).join(", ");
  return (
    <section
      data-testid="forbidden"
      className="mx-auto flex w-full max-w-lg flex-col items-start gap-3 rounded-md border border-border bg-card p-6"
    >
      <Lock className="size-7 text-text-secondary" aria-hidden />
      <h1 className="text-h2">{t("title")}</h1>
      <p className="text-text-secondary">{t("body")}</p>
      {names && <p className="text-small">{t("owners", { names })}</p>}
      <Link
        href="/employer"
        className="mt-2 inline-flex h-11 items-center rounded-sm bg-primary px-4 font-medium text-primary-foreground hover:bg-primary-hover"
      >
        {t("back")}
      </Link>
    </section>
  );
}
