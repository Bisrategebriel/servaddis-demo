import { getTranslations } from "next-intl/server";

export async function SkipLink() {
  const t = await getTranslations("common");
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-md bg-card px-4 py-2 text-foreground shadow-overlay focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      {t("skipToContent")}
    </a>
  );
}
