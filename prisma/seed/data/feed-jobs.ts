// Doc 05 §9.5 marketplace feed: 18 LIVE jobs across the three seeded venues, 12 role templates,
// 5 sub-cities, 3 urgent (Half-day, Same-day, Next-day). Content comes from each role template;
// salaries are the template hints unless a job says otherwise. All fictional.
import type { PostingSource, Urgency } from "@prisma/client";
import type { SubCitySlug } from "./geography";

export type FeedJobSeed = {
  venue: "Hiwot Garden Hotel" | "Piassa Terrace Restaurant" | "Lideta Corner Café";
  template: string;
  subCity: SubCitySlug;
  /** How long ago it was published, in hours. Urgent jobs are recent so they are still open. */
  ageHours: number;
  urgency?: Urgency;
  headcount?: number;
  salary?: [number, number];
  source: PostingSource;
};

export const FEED_JOBS: FeedJobSeed[] = [
  // Hiwot Garden Hotel (PRO, unlimited). The Front Desk Agent job carries the pipeline applicants.
  {
    venue: "Hiwot Garden Hotel",
    template: "front-desk",
    subCity: "bole",
    ageHours: 72,
    headcount: 2,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "housekeeper",
    subCity: "bole",
    ageHours: 120,
    headcount: 3,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "spa-therapist",
    subCity: "bole",
    ageHours: 190,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "chef-de-partie",
    subCity: "bole",
    ageHours: 290,
    salary: [11000, 17000],
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "waiter",
    subCity: "kirkos",
    ageHours: 2,
    urgency: "HALF_DAY",
    headcount: 2,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "tour-guide",
    subCity: "bole",
    ageHours: 360,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "bartender",
    subCity: "bole",
    ageHours: 460,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "hospitality-manager",
    subCity: "bole",
    ageHours: 520,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "kitchen-steward",
    subCity: "kirkos",
    ageHours: 30,
    headcount: 2,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "line-cook",
    subCity: "kirkos",
    ageHours: 210,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Hiwot Garden Hotel",
    template: "barista",
    subCity: "bole",
    ageHours: 100,
    salary: [5500, 9000],
    source: "SUBSCRIPTION",
  },

  // Piassa Terrace Restaurant (STANDARD: 5 live jobs, so the plan is full at reset).
  {
    venue: "Piassa Terrace Restaurant",
    template: "waiter",
    subCity: "arada",
    ageHours: 50,
    headcount: 3,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Piassa Terrace Restaurant",
    template: "line-cook",
    subCity: "arada",
    ageHours: 140,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Piassa Terrace Restaurant",
    template: "bartender",
    subCity: "arada",
    ageHours: 250,
    salary: [5000, 8500],
    source: "SUBSCRIPTION",
  },
  {
    venue: "Piassa Terrace Restaurant",
    template: "host-cashier",
    subCity: "addis-ketema",
    ageHours: 330,
    source: "SUBSCRIPTION",
  },
  {
    venue: "Piassa Terrace Restaurant",
    template: "kitchen-steward",
    subCity: "addis-ketema",
    ageHours: 410,
    source: "SUBSCRIPTION",
  },

  // Lideta Corner Café (founding partner; its 3 free posts are untouched, so these were paid urgent posts).
  {
    venue: "Lideta Corner Café",
    template: "barista",
    subCity: "lideta",
    ageHours: 1,
    urgency: "SAME_DAY",
    source: "URGENT_PAID",
  },
  {
    venue: "Lideta Corner Café",
    template: "waiter",
    subCity: "lideta",
    ageHours: 3,
    urgency: "NEXT_DAY",
    source: "URGENT_PAID",
  },
];

/** The job that carries the pre-seeded pipeline (doc 05 §9.5). */
export const PIPELINE_JOB = { venue: "Hiwot Garden Hotel", template: "front-desk" } as const;

/**
 * Its 9 applicants in mixed statuses, by jobseeker name. Dawit is left out on purpose: he applies
 * live to the café job in the demo (script row 8).
 */
export const PIPELINE_APPLICANTS: {
  name: string;
  status: "APPLIED" | "VIEWED" | "SHORTLISTED" | "REJECTED";
  /** Hours after the job was published. */
  appliedAfterHours: number;
  note?: string;
}[] = [
  {
    name: "Hana Bekele",
    status: "SHORTLISTED",
    appliedAfterHours: 2,
    note: "Two years at a Bole guesthouse front desk.",
  },
  { name: "Henok Abera", status: "SHORTLISTED", appliedAfterHours: 5 },
  { name: "Ruth Demissie", status: "VIEWED", appliedAfterHours: 9 },
  {
    name: "Abel Shiferaw",
    status: "VIEWED",
    appliedAfterHours: 20,
    note: "I speak English and French.",
  },
  { name: "Tewodros Ayalew", status: "REJECTED", appliedAfterHours: 26 },
  { name: "Feven Alemayehu", status: "APPLIED", appliedAfterHours: 40 },
  { name: "Liya Wondimu", status: "APPLIED", appliedAfterHours: 52 },
  { name: "Yohannes Negash", status: "APPLIED", appliedAfterHours: 61 },
  { name: "Kalkidan Ayele", status: "APPLIED", appliedAfterHours: 68 },
];
