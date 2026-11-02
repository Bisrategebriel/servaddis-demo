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

/** "ETB 5,000–9,000" (period label added by the caller). */
export const formatSalary = (min: number, max: number) =>
  `ETB ${min.toLocaleString("en-US")}–${max.toLocaleString("en-US")}`;
