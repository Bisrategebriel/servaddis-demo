import type { Urgency } from "@prisma/client";

// Job.expiresAt (doc 05 §6.4, doc 03 §4.1). Days end at midnight in Addis Ababa: EAT is UTC+3
// all year (no daylight saving), so plain arithmetic is exact.

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const EAT_OFFSET_MS = 3 * HOUR_MS;

/** The last millisecond of the EAT day that is `daysAhead` days after `at`'s EAT day. */
export function endOfEatDay(at: Date, daysAhead = 0): Date {
  const eatMidnight = Math.floor((at.getTime() + EAT_OFFSET_MS) / DAY_MS) * DAY_MS;
  return new Date(eatMidnight + (daysAhead + 1) * DAY_MS - 1 - EAT_OFFSET_MS);
}

export function computeExpiresAt(urgency: Urgency, publishedAt: Date): Date {
  switch (urgency) {
    case "HALF_DAY":
      return new Date(publishedAt.getTime() + 12 * HOUR_MS);
    case "SAME_DAY":
      return endOfEatDay(publishedAt, 0);
    case "NEXT_DAY":
      return endOfEatDay(publishedAt, 1);
    case "TWO_DAYS":
      return endOfEatDay(publishedAt, 2);
    case "NORMAL":
      return new Date(publishedAt.getTime() + 30 * DAY_MS);
  }
}
