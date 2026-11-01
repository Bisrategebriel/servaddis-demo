// Doc 05 §9.1 skill list. Amharic names are DRAFTS pending native-speaker review (D-6).

export const SKILLS = [
  // service
  { slug: "table-service", group: "service", nameEn: "Table service", nameAm: "የጠረጴዛ አገልግሎት" },
  { slug: "pos", group: "service", nameEn: "POS", nameAm: "የሽያጭ ማሽን (POS)" },
  { slug: "upselling", group: "service", nameEn: "Upselling", nameAm: "ተጨማሪ ሽያጭ" },
  { slug: "wine-knowledge", group: "service", nameEn: "Wine knowledge", nameAm: "የወይን ዕውቀት" },
  // barista
  { slug: "espresso", group: "barista", nameEn: "Espresso", nameAm: "ኤስፕሬሶ" },
  { slug: "latte-art", group: "barista", nameEn: "Latte art", nameAm: "የላቴ አርት" },
  {
    slug: "coffee-ceremony",
    group: "barista",
    nameEn: "Coffee ceremony",
    nameAm: "የቡና ሥነ ሥርዓት",
  },
  // kitchen
  { slug: "knife-skills", group: "kitchen", nameEn: "Knife skills", nameAm: "የቢላ አጠቃቀም" },
  { slug: "grill", group: "kitchen", nameEn: "Grill", nameAm: "ጥብስ (ግሪል)" },
  {
    slug: "ethiopian-cuisine",
    group: "kitchen",
    nameEn: "Ethiopian cuisine",
    nameAm: "የኢትዮጵያ ምግብ",
  },
  { slug: "pastry", group: "kitchen", nameEn: "Pastry", nameAm: "ኬክና ዳቦ ሥራ" },
  { slug: "haccp", group: "kitchen", nameEn: "HACCP", nameAm: "የምግብ ደኅንነት (HACCP)" },
  // housekeeping
  {
    slug: "room-turnover",
    group: "housekeeping",
    nameEn: "Room turnover",
    nameAm: "የክፍል ዝግጅት",
  },
  { slug: "laundry", group: "housekeeping", nameEn: "Laundry", nameAm: "የልብስ እጥበት" },
  {
    slug: "public-areas",
    group: "housekeeping",
    nameEn: "Public areas",
    nameAm: "የጋራ ቦታዎች ጽዳት",
  },
  // front office
  { slug: "check-in", group: "front-office", nameEn: "Check-in", nameAm: "የእንግዳ ምዝገባ" },
  {
    slug: "reservations",
    group: "front-office",
    nameEn: "Reservations",
    nameAm: "የቦታ ማስያዝ",
  },
  { slug: "opera-pms", group: "front-office", nameEn: "Opera PMS", nameAm: "Opera PMS" },
  // spa
  { slug: "massage", group: "spa", nameEn: "Massage", nameAm: "ማሳጅ" },
  { slug: "facials", group: "spa", nameEn: "Facials", nameAm: "የፊት እንክብካቤ" },
  // tourism
  { slug: "city-tours", group: "tourism", nameEn: "City tours", nameAm: "የከተማ ጉብኝት" },
  {
    slug: "historical-sites",
    group: "tourism",
    nameEn: "Historical sites",
    nameAm: "ታሪካዊ ቦታዎች",
  },
  { slug: "trekking", group: "tourism", nameEn: "Trekking", nameAm: "የእግር ጉዞ" },
  // management
  { slug: "rostering", group: "management", nameEn: "Rostering", nameAm: "የፈረቃ ዝግጅት" },
  { slug: "cost-control", group: "management", nameEn: "Cost control", nameAm: "የወጪ ቁጥጥር" },
  {
    slug: "team-leadership",
    group: "management",
    nameEn: "Team leadership",
    nameAm: "የቡድን አመራር",
  },
  // languages
  { slug: "amharic", group: "language", nameEn: "Amharic", nameAm: "አማርኛ" },
  { slug: "english", group: "language", nameEn: "English", nameAm: "እንግሊዝኛ" },
  { slug: "afaan-oromo", group: "language", nameEn: "Afaan Oromo", nameAm: "አፋን ኦሮሞ" },
  { slug: "french", group: "language", nameEn: "French", nameAm: "ፈረንሳይኛ" },
  { slug: "arabic", group: "language", nameEn: "Arabic", nameAm: "ዓረብኛ" },
] as const;

export type SkillSlug = (typeof SKILLS)[number]["slug"];
