import { useTranslations } from "next-intl";

// Honesty marker (doc 04 §6.1): anything not real says so.
export function SimulatedTag() {
  const t = useTranslations("common");
  return (
    <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700">
      {t("simulated")}
    </span>
  );
}
