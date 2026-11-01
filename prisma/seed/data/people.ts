// Doc 05 §9.4. All people, venues and phone numbers are FICTIONAL.
// Bruk Tilahun (+251911000011) is deliberately NOT seeded: he registers live in the demo.
import type { MemberRole, VenueCategory } from "@prisma/client";
import type { SubCitySlug } from "./geography";

export const ADMIN = { name: "Servaddis Moderator", phone: "+251911000009" };

export type VenueSeed = {
  key: "hiwot" | "piassa" | "lideta";
  nameEn: string;
  nameAm: string;
  category: VenueCategory;
  subCity: SubCitySlug;
  contactPhone: string;
  descriptionEn: string;
  descriptionAm: string;
  /** Active subscription plan code, or null for founding-partner venues. */
  plan: "PRO" | "STANDARD" | null;
  foundingPostsLeft: number;
  members: { name: string; phone: string; role: MemberRole }[];
};

export const VENUES: VenueSeed[] = [
  {
    key: "hiwot",
    nameEn: "Hiwot Garden Hotel",
    nameAm: "ሕይወት ጋርደን ሆቴል",
    category: "HOTEL",
    subCity: "bole",
    contactPhone: "+251116000101",
    descriptionEn: "A 60-room garden hotel in Bole with a restaurant, café and spa.",
    descriptionAm: "በቦሌ የሚገኝ ባለ 60 ክፍል የአትክልት ስፍራ ሆቴል፤ ምግብ ቤት፣ ካፌና ስፓ አለው።",
    plan: "PRO",
    foundingPostsLeft: 0,
    members: [
      { name: "Selam Getachew", phone: "+251911000001", role: "OWNER" },
      { name: "Yared Alemu", phone: "+251911000002", role: "POSTER" },
      { name: "Rahel Mekonnen", phone: "+251911000003", role: "SCREENER" },
      { name: "Meseret Abate", phone: "+251911000004", role: "HR_MANAGER" },
    ],
  },
  {
    key: "piassa",
    nameEn: "Piassa Terrace Restaurant",
    nameAm: "ፒያሳ ቴራስ ሬስቶራንት",
    category: "RESTAURANT",
    subCity: "arada",
    contactPhone: "+251111000202",
    descriptionEn: "A busy rooftop restaurant in Piassa serving Ethiopian and Italian dishes.",
    descriptionAm: "በፒያሳ የሚገኝ የኢትዮጵያና የጣሊያን ምግቦችን የሚያቀርብ የሰገነት ምግብ ቤት።",
    plan: "STANDARD",
    foundingPostsLeft: 0,
    members: [{ name: "Henock Tadesse", phone: "+251911000005", role: "OWNER" }],
  },
  {
    key: "lideta",
    nameEn: "Lideta Corner Café",
    nameAm: "ልደታ ኮርነር ካፌ",
    category: "CAFE",
    subCity: "lideta",
    contactPhone: "+251111000303",
    descriptionEn: "A neighbourhood café known for its coffee ceremony and fresh pastries.",
    descriptionAm: "በቡና ሥነ ሥርዓቱና በትኩስ ኬኮቹ የሚታወቅ የሰፈር ካፌ።",
    plan: null,
    foundingPostsLeft: 3,
    members: [{ name: "Mekdes Worku", phone: "+251911000006", role: "OWNER" }],
  },
];

export type JobseekerSeed = {
  name: string;
  /** Primary role template slug: drives skills, headline and salary expectation. */
  role: string;
  /** Fixed values for the named personas; the rest are generated deterministically. */
  fixed?: {
    experienceYears: number;
    faydaVerified: boolean;
    photo: boolean;
    headline: boolean;
    previousWorkplace: boolean;
    availability: boolean;
    preferredSubCities: SubCitySlug[];
    skills: string[];
  };
};

// Phones are +2519220000NN in list order (Dawit = 01).
export const JOBSEEKERS: JobseekerSeed[] = [
  {
    name: "Dawit Alemu", // completeness 85 (everything except a photo)
    role: "waiter",
    fixed: {
      experienceYears: 3,
      faydaVerified: true,
      photo: false,
      headline: true,
      previousWorkplace: true,
      availability: true,
      preferredSubCities: ["bole", "kirkos"],
      skills: ["table-service", "espresso", "latte-art", "amharic", "english"],
    },
  },
  {
    name: "Meron Tadesse", // completeness 100
    role: "barista",
    fixed: {
      experienceYears: 5,
      faydaVerified: true,
      photo: true,
      headline: true,
      previousWorkplace: true,
      availability: true,
      preferredSubCities: ["bole"],
      skills: ["espresso", "latte-art", "coffee-ceremony", "pos", "amharic", "english"],
    },
  },
  {
    name: "Hana Bekele", // completeness 70
    role: "front-desk",
    fixed: {
      experienceYears: 2,
      faydaVerified: false,
      photo: false,
      headline: false,
      previousWorkplace: true,
      availability: true,
      preferredSubCities: [],
      skills: ["check-in", "reservations", "english"],
    },
  },
  {
    name: "Yonas Girma",
    role: "line-cook",
    fixed: {
      experienceYears: 4,
      faydaVerified: false,
      photo: false,
      headline: true,
      previousWorkplace: true,
      availability: false,
      preferredSubCities: ["arada", "kirkos"],
      skills: ["knife-skills", "grill", "ethiopian-cuisine", "amharic"],
    },
  },
  {
    name: "Selamawit Haile",
    role: "housekeeper",
    fixed: {
      experienceYears: 6,
      faydaVerified: true,
      photo: false,
      headline: true,
      previousWorkplace: true,
      availability: true,
      preferredSubCities: ["bole", "yeka"],
      skills: ["room-turnover", "laundry", "public-areas", "amharic"],
    },
  },
  { name: "Tigist Mulugeta", role: "waiter" },
  { name: "Biniam Assefa", role: "barista" },
  { name: "Liya Wondimu", role: "front-desk" },
  { name: "Samuel Desta", role: "line-cook" },
  { name: "Mahlet Getnet", role: "housekeeper" },
  { name: "Kalkidan Ayele", role: "host-cashier" },
  { name: "Natnael Berhanu", role: "bartender" },
  { name: "Bethlehem Tesfaye", role: "waiter" },
  { name: "Eyob Fikru", role: "chef-de-partie" },
  { name: "Rediet Mengistu", role: "spa-therapist" },
  { name: "Abel Shiferaw", role: "tour-guide" },
  { name: "Hiwot Kassa", role: "barista" },
  { name: "Robel Teshome", role: "kitchen-steward" },
  { name: "Feven Alemayehu", role: "front-desk" },
  { name: "Mikiyas Bekele", role: "line-cook" },
  { name: "Tsion Girma", role: "housekeeper" },
  { name: "Henok Abera", role: "hospitality-manager" },
  { name: "Saron Lemma", role: "host-cashier" },
  { name: "Dagim Tadesse", role: "bartender" },
  { name: "Eden Wolde", role: "waiter" },
  { name: "Kidus Haile", role: "kitchen-steward" },
  { name: "Meskerem Abebe", role: "housekeeper" },
  { name: "Yohannes Negash", role: "tour-guide" },
  { name: "Lidya Asfaw", role: "spa-therapist" },
  { name: "Nahom Gebre", role: "barista" },
  { name: "Ruth Demissie", role: "front-desk" },
  { name: "Fasil Mekuria", role: "chef-de-partie" },
  { name: "Martha Yilma", role: "waiter" },
  { name: "Elias Woldemariam", role: "line-cook" },
  { name: "Genet Bogale", role: "housekeeper" },
  { name: "Tewodros Ayalew", role: "hospitality-manager" },
  { name: "Sara Hailu", role: "host-cashier" },
  { name: "Lensa Tolera", role: "barista" },
  { name: "Mekdelawit Fanta", role: "waiter" },
  { name: "Chala Gemechu", role: "tour-guide" },
];

export const jobseekerPhone = (index: number) => `+2519220000${String(index + 1).padStart(2, "0")}`;

/** Generic previous-workplace labels: deliberately not real business names (PRD R6). */
export const WORKPLACE_KINDS: Record<string, string[]> = {
  waiter: ["Family restaurant", "Hotel restaurant", "Café-restaurant"],
  barista: ["Specialty café", "Hotel lobby café", "Bakery café"],
  bartender: ["Hotel bar", "Lounge bar"],
  "host-cashier": ["Restaurant front counter", "Café till"],
  "front-desk": ["Business hotel", "Guesthouse"],
  housekeeper: ["4-star hotel", "Guesthouse", "Serviced apartments"],
  "line-cook": ["Hotel kitchen", "Busy restaurant kitchen"],
  "chef-de-partie": ["Hotel banquet kitchen", "Fine-dining restaurant"],
  "kitchen-steward": ["Catering company", "Hotel kitchen"],
  "spa-therapist": ["Hotel spa", "Beauty salon"],
  "tour-guide": ["Tour operator", "Freelance guiding"],
  "hospitality-manager": ["Mid-size hotel", "Restaurant group"],
};
