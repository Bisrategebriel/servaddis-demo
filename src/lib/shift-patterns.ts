// Amharic for the role templates' shift patterns (doc 05 §9.2). Job.shiftPattern is one free-text
// column, so a job started from a template shows its pattern in the viewer's language; text an
// employer typed themselves stays as typed. All Amharic is a DRAFT pending native review (D-6).
const SHIFT_AM: Record<string, string> = {
  "6 days/week, rotating shifts": "በሳምንት 6 ቀን፣ በፈረቃ",
  "6 days/week, 8 h": "በሳምንት 6 ቀን፣ በቀን 8 ሰዓት",
  "Evenings, 6 days/week": "ምሽት፣ በሳምንት 6 ቀን",
  "6 days/week": "በሳምንት 6 ቀን",
  "3 rotating shifts": "3 ተዘዋዋሪ ፈረቃዎች",
  "6 days/week, mornings": "በሳምንት 6 ቀን፣ ጠዋት",
  "6 days/week, split shift": "በሳምንት 6 ቀን፣ የተከፈለ ፈረቃ",
  "Per-shift": "በፈረቃ",
  "Per-tour, flexible": "በጉብኝት፣ ተለዋዋጭ",
  "Mon–Sat": "ከሰኞ እስከ ቅዳሜ",
};

export function shiftPatternIn(lang: string, text: string): string {
  return lang === "am" ? (SHIFT_AM[text.trim()] ?? text) : text;
}

export const TEMPLATE_SHIFT_PATTERNS = Object.keys(SHIFT_AM);
