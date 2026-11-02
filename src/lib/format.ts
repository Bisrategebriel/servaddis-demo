// Display formatting shared by server and client. Dates are shown in Addis Ababa time (EAT).

export function formatDate(date: Date | string, locale: string) {
  return new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Addis_Ababa",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string, locale: string) {
  return new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Addis_Ababa",
  }).format(new Date(date));
}

/**
 * Money in the viewer's language: "ETB 4,025" in English, "4,025 ብር" in Amharic (doc 04 §3:
 * "ደመወዝ (በወር፣ በብር)"). Figures stay Western digits in both.
 */
export function formatMoney(amount: number, lang = "en") {
  const n = amount.toLocaleString("en-US");
  return lang === "am" ? `${n} ብር` : `ETB ${n}`;
}

/** "ETB 5,000–9,000" / "5,000–9,000 ብር" (period label added by the caller). */
export function formatSalary(min: number, max: number, lang = "en") {
  const range = `${min.toLocaleString("en-US")}–${max.toLocaleString("en-US")}`;
  return lang === "am" ? `${range} ብር` : `ETB ${range}`;
}

/** Time-to-fill (App Flow §5.1: filledAt − publishedAt): hours under a day, else days (0.1). */
export function timeToFill(publishedAt: Date | string, filledAt: Date | string) {
  const hours = (+new Date(filledAt) - +new Date(publishedAt)) / 3_600_000;
  return hours < 24
    ? { unit: "hours" as const, value: Math.max(1, Math.round(hours)) }
    : { unit: "days" as const, value: Math.round((hours / 24) * 10) / 10 };
}
