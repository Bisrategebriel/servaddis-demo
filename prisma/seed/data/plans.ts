// Doc 05 §9.3. Prices are ILLUSTRATIVE placeholders until D-1 (pricing) is decided.
// `features` are display keys, translated in the UI.
import type { PlanKind } from "@prisma/client";

export const PLANS: {
  code: "FOUNDING" | "URGENT_POST" | "STANDARD" | "PRO";
  kind: PlanKind;
  nameEn: string;
  nameAm: string;
  priceEtb: number;
  periodDays: number | null;
  maxLiveJobs: number | null;
  includesSocial: boolean;
  features: string[];
}[] = [
  {
    code: "FOUNDING",
    kind: "ONE_TIME",
    nameEn: "Founding Partner",
    nameAm: "መሥራች አጋር",
    priceEtb: 0,
    periodDays: null,
    maxLiveJobs: 3,
    includesSocial: true,
    features: ["free_posts_3", "pipeline", "social"],
  },
  {
    code: "URGENT_POST",
    kind: "ONE_TIME",
    nameEn: "Urgent Post",
    nameAm: "አስቸኳይ ማስታወቂያ",
    priceEtb: 300,
    periodDays: null,
    maxLiveJobs: 1,
    includesSocial: true,
    features: ["one_job", "pipeline", "social", "urgent_badge"],
  },
  {
    code: "STANDARD",
    kind: "SUBSCRIPTION",
    nameEn: "Standard",
    nameAm: "መደበኛ",
    priceEtb: 1500,
    periodDays: 30,
    maxLiveJobs: 5,
    includesSocial: false,
    features: ["live_jobs_5", "pipeline"],
  },
  {
    code: "PRO",
    kind: "SUBSCRIPTION",
    nameEn: "Pro",
    nameAm: "ፕሮ",
    priceEtb: 3500,
    periodDays: 30,
    maxLiveJobs: null,
    includesSocial: true,
    features: ["unlimited_jobs", "pipeline", "social", "priority_placement", "insights"],
  },
];
