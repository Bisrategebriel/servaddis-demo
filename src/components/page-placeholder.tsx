import { getTranslations } from "next-intl/server";

// Stand-in for screens built in later tasks: a real page title and one honest sentence.
export async function PagePlaceholder({ title }: { title: string }) {
  const t = await getTranslations("common");
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-h1">{title}</h1>
      <p className="text-text-secondary">{t("comingSoon")}</p>
    </section>
  );
}
