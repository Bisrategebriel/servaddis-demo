import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import am from "../../messages/am.json";
import en from "../../messages/en.json";

// Shared helpers for the browser tests. Labels come from the message files, so the same steps
// run in English and Amharic and break if a label changes in one language only.

export type Lang = "en" | "am";
export type Messages = typeof en;
export const MESSAGES: Record<Lang, Messages> = { en, am: am as Messages };

/** Fills an ICU message's simple {placeholders} (no plurals needed here). */
export const fmt = (message: string, values: Record<string, string | number>) =>
  message.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

/** Money as the app shows it (src/lib/format.ts formatMoney). */
export const money = (amount: number, lang: Lang) => {
  const n = amount.toLocaleString("en-US");
  return lang === "am" ? `${n} ብር` : `ETB ${n}`;
};

/** Escapes a label for use inside a RegExp. */
export const re = (label: string) => new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

export const SAMPLE_LICENSE = "public/samples/license-sample.pdf";

/** Set by `pnpm rehearse --record`: where the windows' videos go. */
export const RECORD_DIR = process.env.E2E_RECORD_DIR;

/** A POST the proxy accepts (same-origin check). */
export async function post(ctx: BrowserContext, baseURL: string, path: string, data?: unknown) {
  const res = await ctx.request.post(`${baseURL}${path}`, { headers: { origin: baseURL }, data });
  expect(res.ok(), `${path} → ${res.status()}`).toBe(true);
  return res;
}

/** Page errors and server errors, collected per page and asserted at the end of a run. */
export class ErrorLog {
  readonly errors: string[] = [];
  watch(page: Page, name: string) {
    page.on("pageerror", (e) => this.errors.push(`${name}: ${e.message}`));
    page.on("response", (r) => {
      if (r.status() >= 500) this.errors.push(`${name}: ${r.status()} ${r.url()}`);
    });
    return page;
  }
}

/** A browser window in one language: desktop (employer, admin) or phone (jobseeker). */
export async function openWindow(
  browser: Browser,
  baseURL: string,
  lang: Lang,
  kind: "desktop" | "phone",
) {
  const viewport = kind === "phone" ? { width: 390, height: 844 } : { width: 1280, height: 800 };
  const ctx = await browser.newContext({
    baseURL,
    viewport,
    ...(kind === "phone" ? { isMobile: true, hasTouch: true } : {}),
    // `pnpm rehearse --record` (fallback video, doc 06 §8): one video per window.
    ...(RECORD_DIR ? { recordVideo: { dir: RECORD_DIR, size: viewport } } : {}),
  });
  // Recordings show the laptop windows as the room sees them: in presenter mode.
  if (RECORD_DIR && kind === "desktop") {
    await ctx.addInitScript(() => localStorage.setItem("sv-presenter", "1"));
  }
  await post(ctx, baseURL, "/api/locale", { locale: lang });
  return ctx;
}

/** Signs in through the real phone + code screens (the demo code is shown on the page). */
export async function signIn(page: Page, localPhone: string) {
  await page.locator("#phone").fill(localPhone);
  await page.keyboard.press("Enter");
  await page.getByText("123456").first().waitFor();
  await page.getByRole("textbox").first().pressSequentially("123456");
}

/**
 * Signing in (or switching persona) applies that user's saved language, as designed: Dawit is
 * Amharic, Selam English. A presenter taps the toggle to keep one language; so do the tests.
 */
export async function keepLanguage(page: Page, lang: Lang) {
  if ((await page.locator("html").getAttribute("lang")) === lang) return;
  await page
    .getByRole("button", { name: lang === "am" ? "አማ (አማርኛ)" : "EN (English)", exact: true })
    .first()
    .click();
  await page.waitForFunction((l) => document.documentElement.lang === l, lang);
  await page.waitForLoadState("networkidle");
}
