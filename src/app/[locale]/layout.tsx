import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { DemoDock } from "@/components/demo/demo-dock";
import { LOCALES, isLocale } from "@/i18n/locales";
import { inter, notoEthiopic } from "../fonts";
import "../globals.css";

// Root layout. The proxy rewrites every page URL to /{locale}/…, so [locale] is the root param;
// generateStaticParams lets both language trees prerender (required with Cache Components).
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: { default: "Servaddis", template: "%s · Servaddis" },
    description: t("headline"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} className={`${inter.variable} ${notoEthiopic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          {children}
          <DemoDock />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
