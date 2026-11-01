import type { Locale as DbLocale } from "@prisma/client";

// UI locales (lowercase, used in URLs, <html lang> and message files) and their DB enum twins.
export const LOCALES = ["am", "en"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "sv_locale";
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export const isLocale = (v: unknown): v is AppLocale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

export const toDbLocale = (l: AppLocale): DbLocale => (l === "am" ? "AM" : "EN");
export const fromDbLocale = (l: DbLocale): AppLocale => (l === "AM" ? "am" : "en");

/** Cookie written by the language toggle and at sign-in; read by the proxy. */
export function localeCookie(locale: AppLocale, secure: boolean) {
  return {
    name: LOCALE_COOKIE,
    value: locale,
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
    secure,
  };
}

/**
 * Locale when no choice is stored yet (App Flow §12): Amharic for the public and jobseeker
 * side, English for employer and admin screens. The toggle's cookie always wins.
 */
export function defaultLocaleFor(pathname: string): AppLocale {
  return /^\/(employer|admin)(\/|$)/.test(pathname) ? "en" : "am";
}
