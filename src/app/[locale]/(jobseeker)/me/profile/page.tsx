import { getTranslations } from "next-intl/server";
import { PagePlaceholder } from "@/components/page-placeholder";

export default async function Page() {
  const t = await getTranslations("pages");
  return <PagePlaceholder title={t("profile")} />;
}
