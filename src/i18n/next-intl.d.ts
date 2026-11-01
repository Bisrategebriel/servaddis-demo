import type en from "../../messages/en.json";
import type { AppLocale } from "./locales";

// Typed message keys: t("nav.team") is checked by tsc against en.json.
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof en;
  }
}
