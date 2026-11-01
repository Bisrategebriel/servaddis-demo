// Doc 05 §9.1. Only Addis Ababa is a launch city; the corridor cities are seeded but disabled.

export const CITIES = [
  { slug: "addis-ababa", nameEn: "Addis Ababa", nameAm: "አዲስ አበባ", isLaunch: true },
  { slug: "bahir-dar", nameEn: "Bahir Dar", nameAm: "ባሕር ዳር", isLaunch: false },
  { slug: "hawassa", nameEn: "Hawassa", nameAm: "ሐዋሳ", isLaunch: false },
  { slug: "adama", nameEn: "Adama", nameAm: "አዳማ", isLaunch: false },
  { slug: "lalibela", nameEn: "Lalibela", nameAm: "ላሊበላ", isLaunch: false },
  { slug: "gondar", nameEn: "Gondar", nameAm: "ጎንደር", isLaunch: false },
] as const;

/** Addis Ababa's 11 sub-cities. */
export const ADDIS_SUB_CITIES = [
  { slug: "addis-ketema", nameEn: "Addis Ketema", nameAm: "አዲስ ከተማ" },
  { slug: "akaky-kaliti", nameEn: "Akaky Kaliti", nameAm: "አቃቂ ቃሊቲ" },
  { slug: "arada", nameEn: "Arada", nameAm: "አራዳ" },
  { slug: "bole", nameEn: "Bole", nameAm: "ቦሌ" },
  { slug: "gullele", nameEn: "Gullele", nameAm: "ጉለሌ" },
  { slug: "kirkos", nameEn: "Kirkos", nameAm: "ቂርቆስ" },
  { slug: "kolfe-keranio", nameEn: "Kolfe Keranio", nameAm: "ኮልፌ ቀራኒዮ" },
  { slug: "lideta", nameEn: "Lideta", nameAm: "ልደታ" },
  { slug: "nifas-silk-lafto", nameEn: "Nifas Silk-Lafto", nameAm: "ንፋስ ስልክ ላፍቶ" },
  { slug: "yeka", nameEn: "Yeka", nameAm: "የካ" },
  { slug: "lemi-kura", nameEn: "Lemi Kura", nameAm: "ለሚ ኩራ" },
] as const;

export type SubCitySlug = (typeof ADDIS_SUB_CITIES)[number]["slug"];
