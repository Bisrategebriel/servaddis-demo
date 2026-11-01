import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

// useSearchParams reads request data, so the form renders inside <Suspense>.
export default async function LoginPage() {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="py-6 text-text-secondary">{t("loading")}</p>}>
      <LoginForm />
    </Suspense>
  );
}
