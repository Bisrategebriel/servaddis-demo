import { getTranslations } from "next-intl/server";
import { PagePlaceholder } from "@/components/page-placeholder";

// The 4-step composer arrives in T2.2; it reads ?template= and starts from prefillFromTemplate.
export default async function ComposePage() {
  const t = await getTranslations("jobs.picker");
  return <PagePlaceholder title={t("composeTitle")} />;
}
