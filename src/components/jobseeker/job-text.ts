import { eatDaysBetween } from "@/lib/expiry";

// Viewer-language helpers for jobseeker screens (TRD §6: the feed shows the viewer's language
// with a fallback tag when a job has only the other one).

type Lang = "am" | "en";

/** The text in the viewer's language, or the other language plus which one it is. */
export function pick(lang: Lang, en: string | null, am: string | null) {
  const mine = (lang === "am" ? am : en)?.trim();
  if (mine) return { text: mine, fallback: null };
  const other = (lang === "am" ? en : am)?.trim() ?? "";
  return { text: other, fallback: lang === "am" ? ("en" as const) : ("am" as const) };
}

/** Which "closes …" message an urgent job shows, from the demo clock's now. */
export function deadline(
  expiresAt: string,
  urgency: string,
  at: Date,
): {
  key: "closesInHours" | "closesToday" | "closesTomorrow" | "closesInDays";
  values: Record<string, number>;
} {
  const end = new Date(expiresAt);
  if (urgency === "HALF_DAY") {
    const hours = Math.max(1, Math.ceil((+end - +at) / 3_600_000));
    return { key: "closesInHours", values: { hours } };
  }
  const days = eatDaysBetween(at, end);
  if (days <= 0) return { key: "closesToday", values: {} };
  if (days === 1) return { key: "closesTomorrow", values: {} };
  return { key: "closesInDays", values: { days } };
}
