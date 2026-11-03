import { getTranslations } from "next-intl/server";
import { FormSkeleton } from "@/components/skeletons";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

// useSearchParams reads request data, so the form renders inside <Suspense>.
export default async function LoginPage() {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<FormSkeleton label={t("loading")} fields={1} />}>
      <LoginForm />
    </Suspense>
  );
}
