// Doc 05 §9.2. Salary hints are ILLUSTRATIVE, not market data.
// All Amharic strings are DRAFTS pending native-speaker review (D-6).
import type { RoleFamily, RoleTemplateDefaults } from "../../../src/lib/role-template";
import type { SkillSlug } from "./skills";

type TemplateSeed = {
  slug: string;
  nameEn: string;
  nameAm: string;
  family: RoleFamily;
  defaults: RoleTemplateDefaults & { skillSlugs: SkillSlug[] };
};

// Shared benefit lines (EN, AM)
const B = {
  meals: ["Meals on shift", "በሥራ ሰዓት ምግብ"],
  uniform: ["Uniform provided", "የደንብ ልብስ ይሰጣል"],
  serviceCharge: ["Share of service charge", "ከአገልግሎት ክፍያ ድርሻ"],
  training: ["On-the-job training", "በሥራ ላይ ሥልጠና"],
  transport: ["Transport allowance", "የትራንስፖርት አበል"],
  leave: ["Paid annual leave", "ደመወዝ የሚከፈልበት የዓመት ፈቃድ"],
  medical: ["Medical coverage", "የሕክምና ሽፋን"],
  tourCosts: ["Travel and meals covered on tours", "በጉብኝት ወቅት የጉዞና የምግብ ወጪ ይሸፈናል"],
  tips: ["Tips from guests", "ከእንግዶች የሚገኝ ጉርሻ"],
} as const satisfies Record<string, readonly [string, string]>;

type Line = readonly [en: string, am: string];
const en = (lines: readonly Line[]) => lines.map((l) => l[0]);
const am = (lines: readonly Line[]) => lines.map((l) => l[1]);

function template(
  t: Omit<TemplateSeed, "defaults"> & {
    employmentType: RoleTemplateDefaults["employmentType"];
    shiftPattern: string;
    salary: [min: number, max: number];
    description: Line;
    requirements: readonly Line[];
    benefits: readonly Line[];
    skills: SkillSlug[];
  },
): TemplateSeed {
  return {
    slug: t.slug,
    nameEn: t.nameEn,
    nameAm: t.nameAm,
    family: t.family,
    defaults: {
      employmentType: t.employmentType,
      shiftPattern: t.shiftPattern,
      salaryHint: { min: t.salary[0], max: t.salary[1], period: "MONTH" },
      descriptionEn: t.description[0],
      descriptionAm: t.description[1],
      requirementsEn: en(t.requirements),
      requirementsAm: am(t.requirements),
      benefitsEn: en(t.benefits),
      benefitsAm: am(t.benefits),
      skillSlugs: t.skills,
    },
  };
}

export const ROLE_TEMPLATES: TemplateSeed[] = [
  template({
    slug: "waiter",
    nameEn: "Waiter / Waitress",
    nameAm: "አስተናጋጅ",
    family: "FRONT_OF_HOUSE",
    employmentType: "FULL_TIME",
    shiftPattern: "6 days/week, rotating shifts",
    salary: [4000, 8000],
    description: [
      "Welcome guests, take orders and serve food and drinks with care. You keep tables ready and make every guest feel looked after.",
      "እንግዶችን በአክብሮት ይቀበላሉ፣ ትዕዛዝ ይቀበላሉ፣ ምግብና መጠጥ በጥንቃቄ ያቀርባሉ። ጠረጴዛዎችን ዝግጁ በማድረግ እያንዳንዱ እንግዳ በደንብ እንደተስተናገደ እንዲሰማው ያደርጋሉ።",
    ],
    requirements: [
      [
        "At least 1 year of experience in a restaurant, café or hotel",
        "በምግብ ቤት፣ በካፌ ወይም በሆቴል ቢያንስ የ1 ዓመት የሥራ ልምድ",
      ],
      ["Friendly and clear with guests", "ከእንግዶች ጋር በትሕትናና በግልጽ መግባባት"],
      ["Basic English for menus and orders", "ለምግብ ዝርዝርና ለትዕዛዝ መሠረታዊ እንግሊዝኛ"],
      ["Able to work evenings and weekends", "ምሽትና በሳምንቱ መጨረሻ ለመሥራት ዝግጁ መሆን"],
    ],
    benefits: [B.meals, B.uniform, B.serviceCharge],
    skills: ["table-service", "pos", "upselling", "amharic", "english"],
  }),
  template({
    slug: "barista",
    nameEn: "Barista",
    nameAm: "ባሪስታ",
    family: "FRONT_OF_HOUSE",
    employmentType: "FULL_TIME",
    shiftPattern: "6 days/week, 8 h",
    salary: [5000, 9000],
    description: [
      "Prepare espresso drinks and traditional coffee to a consistent standard, keep the bar clean and serve guests quickly.",
      "የኤስፕሬሶ መጠጦችንና ባህላዊ ቡናን በወጥ ጥራት ያዘጋጃሉ፣ የቡና ባሩን ንጹሕ ያደርጋሉ፣ እንግዶችን በፍጥነት ያስተናግዳሉ።",
    ],
    requirements: [
      ["Experience with an espresso machine", "የኤስፕሬሶ ማሽን የመጠቀም ልምድ"],
      ["Knows milk steaming and basic latte art", "ወተት ማፍላትና መሠረታዊ የላቴ አርት ዕውቀት"],
      ["Clean, organised and quick during rush hours", "በሥራ በሚበዛበት ሰዓት ንጹሕ፣ ሥርዓታማና ፈጣን መሆን"],
      ["Friendly with guests", "ከእንግዶች ጋር ተግባቢ መሆን"],
    ],
    benefits: [B.meals, B.uniform, B.training],
    skills: ["espresso", "latte-art", "coffee-ceremony", "pos", "amharic"],
  }),
  template({
    slug: "bartender",
    nameEn: "Bartender",
    nameAm: "ባርቴንደር",
    family: "BAR",
    employmentType: "FULL_TIME",
    shiftPattern: "Evenings, 6 days/week",
    salary: [6000, 11000],
    description: [
      "Mix and serve drinks, look after bar guests and keep stock and the bar area in order.",
      "መጠጦችን ቀላቅለው ያቀርባሉ፣ የባር እንግዶችን ያስተናግዳሉ፣ የዕቃ ክምችቱንና የባሩን አካባቢ በሥርዓት ይይዛሉ።",
    ],
    requirements: [
      ["At least 1 year behind a bar", "በባር ውስጥ ቢያንስ የ1 ዓመት ልምድ"],
      ["Knows common cocktails, beers and wines", "የተለመዱ ኮክቴሎች፣ ቢራዎችና ወይኖች ዕውቀት"],
      ["Handles cash and POS accurately", "ጥሬ ገንዘብንና POSን በትክክል መያዝ"],
      ["Able to work evenings", "ምሽት ለመሥራት ዝግጁ መሆን"],
    ],
    benefits: [B.transport, B.serviceCharge, B.uniform],
    skills: ["wine-knowledge", "upselling", "pos", "english"],
  }),
  template({
    slug: "host-cashier",
    nameEn: "Host / Cashier",
    nameAm: "እንግዳ ተቀባይ / ገንዘብ ተቀባይ",
    family: "FRONT_OF_HOUSE",
    employmentType: "FULL_TIME",
    shiftPattern: "6 days/week",
    salary: [5000, 8000],
    description: [
      "Greet and seat guests, manage the waiting list and handle bills and payments at the front.",
      "እንግዶችን ተቀብለው ቦታ ያስይዛሉ፣ የተጠባባቂዎችን ዝርዝር ያስተዳድራሉ፣ ሂሳብና ክፍያ ይቀበላሉ።",
    ],
    requirements: [
      ["Experience with cash handling or POS", "ገንዘብ በመያዝ ወይም POS በመጠቀም ልምድ"],
      ["Well presented and welcoming", "ንጹሕ አለባበስና እንግዳ ተቀባይነት"],
      ["Good Amharic and English", "ጥሩ የአማርኛና የእንግሊዝኛ ችሎታ"],
    ],
    benefits: [B.meals, B.uniform],
    skills: ["pos", "reservations", "upselling", "amharic", "english"],
  }),
  template({
    slug: "front-desk",
    nameEn: "Front Desk Agent",
    nameAm: "የፊት ጽ/ቤት ሠራተኛ",
    family: "FRONT_OF_HOUSE",
    employmentType: "FULL_TIME",
    shiftPattern: "3 rotating shifts",
    salary: [7000, 12000],
    description: [
      "Check guests in and out, manage reservations and answer guest requests at the hotel front desk.",
      "እንግዶችን ይመዘግባሉ፣ ያስወጣሉ፣ የቦታ ማስያዣዎችን ያስተዳድራሉ፣ በሆቴሉ የፊት ጽ/ቤት የእንግዶችን ጥያቄዎች ያስተናግዳሉ።",
    ],
    requirements: [
      [
        "Diploma or certificate in hospitality or a related field",
        "በሆቴል አስተዳደር ወይም በተዛማጅ ዘርፍ ዲፕሎማ ወይም ሰርተፊኬት",
      ],
      ["Good spoken and written English", "ጥሩ የንግግርና የጽሑፍ እንግሊዝኛ"],
      [
        "Comfortable with computers; PMS experience is a plus",
        "ኮምፒውተር የመጠቀም ችሎታ፤ የPMS ልምድ ተጨማሪ ጥቅም ነው",
      ],
      ["Able to work rotating shifts, including nights", "ሌሊትን ጨምሮ በፈረቃ ለመሥራት ዝግጁ መሆን"],
    ],
    benefits: [B.meals, B.transport, B.leave],
    skills: ["check-in", "reservations", "opera-pms", "english", "amharic"],
  }),
  template({
    slug: "housekeeper",
    nameEn: "Housekeeper",
    nameAm: "የቤት ጽዳት ሠራተኛ",
    family: "HOUSEKEEPING",
    employmentType: "FULL_TIME",
    shiftPattern: "6 days/week, mornings",
    salary: [4000, 7000],
    description: [
      "Clean and prepare guest rooms and public areas to the hotel's standard, and report anything that needs repair.",
      "የእንግዳ ክፍሎችንና የጋራ ቦታዎችን በሆቴሉ ደረጃ ያጸዳሉ፣ ያዘጋጃሉ፣ ጥገና የሚያስፈልገውን ነገር ያሳውቃሉ።",
    ],
    requirements: [
      [
        "Experience in hotel or guesthouse housekeeping preferred",
        "በሆቴል ወይም በእንግዳ ማረፊያ የጽዳት ሥራ ልምድ ቢኖር ይመረጣል",
      ],
      ["Careful and trustworthy", "ጥንቁቅና ታማኝ መሆን"],
      ["Able to work early mornings", "በማለዳ ለመሥራት ዝግጁ መሆን"],
    ],
    benefits: [B.meals, B.uniform, B.transport],
    skills: ["room-turnover", "laundry", "public-areas", "amharic"],
  }),
  template({
    slug: "line-cook",
    nameEn: "Line Cook",
    nameAm: "ምግብ አብሳይ",
    family: "KITCHEN",
    employmentType: "FULL_TIME",
    shiftPattern: "6 days/week, split shift",
    salary: [6000, 10000],
    description: [
      "Prepare dishes on your station to the recipe, keep your area clean and follow food-safety rules.",
      "በተመደቡበት ክፍል ምግቦችን በአዘገጃጀቱ መሠረት ያዘጋጃሉ፣ አካባቢዎን ንጹሕ ያደርጋሉ፣ የምግብ ደኅንነት ሕጎችን ይከተላሉ።",
    ],
    requirements: [
      ["At least 1 year in a professional kitchen", "በሙያዊ ኩሽና ቢያንስ የ1 ዓመት ልምድ"],
      ["Good knife skills", "ጥሩ የቢላ አጠቃቀም ክህሎት"],
      ["Knows Ethiopian and international dishes", "የኢትዮጵያና የዓለም አቀፍ ምግቦች ዕውቀት"],
      ["Follows hygiene and food-safety rules", "የንጽሕናና የምግብ ደኅንነት ሕጎችን መከተል"],
    ],
    benefits: [B.meals, B.uniform, B.training],
    skills: ["knife-skills", "grill", "ethiopian-cuisine", "haccp"],
  }),
  template({
    slug: "chef-de-partie",
    nameEn: "Chef de Partie",
    nameAm: "ሼፍ",
    family: "KITCHEN",
    employmentType: "FULL_TIME",
    shiftPattern: "6 days/week",
    salary: [9000, 16000],
    description: [
      "Run a section of the kitchen, lead junior cooks and keep quality and food cost on target.",
      "የኩሽናውን አንድ ክፍል ይመራሉ፣ ጀማሪ ምግብ አብሳዮችን ያሠለጥናሉ፣ ጥራትንና የምግብ ወጪን በዕቅዱ መሠረት ይጠብቃሉ።",
    ],
    requirements: [
      ["At least 3 years in a hotel or restaurant kitchen", "በሆቴል ወይም በምግብ ቤት ኩሽና ቢያንስ የ3 ዓመት ልምድ"],
      ["Culinary diploma or equivalent experience", "የምግብ ዝግጅት ዲፕሎማ ወይም ተመጣጣኝ ልምድ"],
      ["Can lead and train a small team", "ትንሽ ቡድን መምራትና ማሠልጠን መቻል"],
      ["Knows HACCP food-safety practice", "የHACCP የምግብ ደኅንነት አሠራር ዕውቀት"],
    ],
    benefits: [B.meals, B.medical, B.leave],
    skills: ["knife-skills", "grill", "pastry", "haccp", "team-leadership"],
  }),
  template({
    slug: "kitchen-steward",
    nameEn: "Kitchen Steward",
    nameAm: "የኩሽና ረዳት",
    family: "KITCHEN",
    employmentType: "SHIFT",
    shiftPattern: "Per-shift",
    salary: [3500, 6000],
    description: [
      "Wash dishes and kitchen equipment, keep the kitchen clean and help cooks with basic preparation.",
      "ሳህኖችንና የኩሽና ዕቃዎችን ያጥባሉ፣ ኩሽናውን ንጹሕ ያደርጋሉ፣ ምግብ አብሳዮችን በመሠረታዊ ዝግጅት ያግዛሉ።",
    ],
    requirements: [
      ["No experience needed; training provided", "ልምድ አያስፈልግም፤ ሥልጠና ይሰጣል"],
      ["Reliable and on time", "አስተማማኝና ሰዓት አክባሪ መሆን"],
      ["Able to stand and lift for a full shift", "ሙሉ ፈረቃ ቆሞ መሥራትና ዕቃ ማንሳት መቻል"],
    ],
    benefits: [B.meals, B.training],
    skills: ["haccp", "public-areas", "knife-skills"],
  }),
  template({
    slug: "spa-therapist",
    nameEn: "Spa Therapist",
    nameAm: "የስፓ ባለሙያ",
    family: "SPA",
    employmentType: "FULL_TIME",
    shiftPattern: "6 days/week",
    salary: [6000, 12000],
    description: [
      "Give massages and facial treatments, look after guests' comfort and keep treatment rooms clean and ready.",
      "ማሳጅና የፊት እንክብካቤ አገልግሎት ይሰጣሉ፣ የእንግዶችን ምቾት ይጠብቃሉ፣ የሕክምና ክፍሎችን ንጹሕና ዝግጁ ያደርጋሉ።",
    ],
    requirements: [
      ["Certificate in massage or beauty therapy", "በማሳጅ ወይም በውበት እንክብካቤ ሰርተፊኬት"],
      ["At least 1 year of spa or salon experience", "በስፓ ወይም በውበት ሳሎን ቢያንስ የ1 ዓመት ልምድ"],
      ["Professional and discreet with guests", "ከእንግዶች ጋር ሙያዊና ሚስጥር ጠባቂ መሆን"],
    ],
    benefits: [B.uniform, B.serviceCharge, B.training],
    skills: ["massage", "facials", "english"],
  }),
  template({
    slug: "tour-guide",
    nameEn: "Tour Guide",
    nameAm: "አስጎብኚ",
    family: "TOURISM",
    employmentType: "CONTRACT",
    shiftPattern: "Per-tour, flexible",
    salary: [8000, 18000],
    description: [
      "Lead city and heritage tours, share Ethiopia's history clearly and keep groups safe and on schedule.",
      "የከተማና የቅርስ ጉብኝቶችን ይመራሉ፣ የኢትዮጵያን ታሪክ በግልጽ ያስረዳሉ፣ ቡድኖችን በደኅንነትና በሰዓቱ ይመራሉ።",
    ],
    requirements: [
      ["Licensed or trained tour guide", "ፈቃድ ያለው ወይም የሠለጠነ አስጎብኚ"],
      [
        "Fluent English; a second foreign language is a plus",
        "እንግሊዝኛን አቀላጥፎ መናገር፤ ሁለተኛ የውጭ ቋንቋ ተጨማሪ ጥቅም ነው",
      ],
      ["Strong knowledge of Ethiopian history and sites", "ስለ ኢትዮጵያ ታሪክና ቅርሶች ጥልቅ ዕውቀት"],
      ["Comfortable with travel and long days", "ለጉዞና ለረጅም የሥራ ቀናት ዝግጁ መሆን"],
    ],
    benefits: [B.tourCosts, B.tips],
    skills: ["city-tours", "historical-sites", "trekking", "english", "french"],
  }),
  template({
    slug: "hospitality-manager",
    nameEn: "Hospitality Manager",
    nameAm: "የእንግዳ ተቀባይነት ሥራ አስኪያጅ",
    family: "MANAGEMENT",
    employmentType: "FULL_TIME",
    shiftPattern: "Mon–Sat",
    salary: [25000, 50000],
    description: [
      "Lead daily operations, manage staff schedules and budgets, and make sure every guest gets a consistent experience.",
      "የዕለት ተዕለት ሥራዎችን ይመራሉ፣ የሠራተኞችን የሥራ ፈረቃና በጀት ያስተዳድራሉ፣ እያንዳንዱ እንግዳ ወጥ የሆነ አገልግሎት እንዲያገኝ ያረጋግጣሉ።",
    ],
    requirements: [
      ["Degree in hospitality, business or a related field", "በሆቴል አስተዳደር፣ በንግድ ወይም በተዛማጅ ዘርፍ ዲግሪ"],
      [
        "At least 5 years in hospitality, 2 as a supervisor or manager",
        "በእንግዳ ተቀባይነት ዘርፍ ቢያንስ 5 ዓመት፣ ከዚህም 2 ዓመት በተቆጣጣሪነት ወይም በሥራ አስኪያጅነት",
      ],
      ["Strong leadership and cost control", "ጠንካራ የአመራርና የወጪ ቁጥጥር ችሎታ"],
      ["Fluent Amharic and English", "አማርኛንና እንግሊዝኛን አቀላጥፎ መናገር"],
    ],
    benefits: [B.medical, B.leave, B.transport],
    skills: ["rostering", "cost-control", "team-leadership", "english"],
  }),
];
