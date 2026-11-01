import { CheckCircle2, ConciergeBell, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

// SCR-00 Landing (doc 04 §7): two big choices. The choice travels to sign-in as the intent
// for new accounts (App Flow §2). Full sign-in UI arrives in T1.1.
export default async function LandingPage() {
  const t = await getTranslations("landing");
  const choice =
    "flex min-h-16 items-center gap-4 rounded-2xl border px-5 py-4 text-h3 transition-colors";
  return (
    <section className="flex flex-col gap-8 py-6">
      <h1 className="text-display text-primary">{t("headline")}</h1>
      <div className="flex flex-col gap-3">
        <Link
          href="/login?intent=EMPLOYER"
          className={`${choice} border-primary bg-primary text-primary-foreground hover:bg-primary-hover`}
        >
          <ConciergeBell className="size-6 shrink-0" aria-hidden />
          {t("hiring")}
        </Link>
        <Link
          href="/login?intent=JOBSEEKER"
          className={`${choice} border-primary bg-card text-primary hover:bg-accent`}
        >
          <UtensilsCrossed className="size-6 shrink-0" aria-hidden />
          {t("looking")}
        </Link>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-small text-text-secondary">
        {[t("verifiedVenues"), t("freeToApply")].map((label) => (
          <li key={label} className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
