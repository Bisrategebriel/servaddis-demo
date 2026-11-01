import { locale as rootLocale } from "next/root-params";
import { getRequestConfig } from "next-intl/server";
import { isLocale } from "./locales";

// next-intl request config. The locale comes from the [locale] root segment, which the proxy
// fills from the sv_locale cookie (URLs stay unprefixed). Reading a root param keeps pages
// statically renderable under Cache Components, unlike reading cookies here.
export default getRequestConfig(async ({ locale: explicit }) => {
  const candidate = explicit ?? (await rootLocale());
  const locale = isLocale(candidate) ? candidate : "am";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Africa/Addis_Ababa",
  };
});
