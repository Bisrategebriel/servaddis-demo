// Social captions (TRD §5.6, App Flow §7): filled-in bilingual templates, never an LLM, so a
// demo always produces the same words. All Amharic is a DRAFT pending native review (D-6).

export type CaptionChannel = "TELEGRAM" | "FACEBOOK" | "INSTAGRAM" | "TIKTOK";

export type CaptionJob = {
  titleEn: string;
  titleAm: string | null;
  venueEn: string;
  venueAm: string | null;
  subCityEn: string;
  subCityAm: string;
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: "MONTH" | "DAY" | "SHIFT";
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "SHIFT";
  urgent: boolean;
  verified: boolean;
  url: string;
};

const PERIOD = {
  en: { MONTH: "month", DAY: "day", SHIFT: "shift" },
  am: { MONTH: "በወር", DAY: "በቀን", SHIFT: "በፈረቃ" },
} as const;
const TYPE = {
  en: { FULL_TIME: "Full-time", PART_TIME: "Part-time", CONTRACT: "Contract", SHIFT: "Shift work" },
  am: { FULL_TIME: "ሙሉ ጊዜ", PART_TIME: "የትርፍ ሰዓት", CONTRACT: "ኮንትራት", SHIFT: "የፈረቃ ሥራ" },
} as const;

const money = (n: number) => n.toLocaleString("en-US");

/** #ServaddisJobs #AddisJobs #ሥራ plus the role, e.g. #Barista. */
export function hashtags(job: Pick<CaptionJob, "titleEn">): string[] {
  const role = job.titleEn.replace(/\/.*$/, "").replace(/[^A-Za-z0-9]/g, "");
  return ["#ServaddisJobs", "#AddisJobs", "#ሥራ", ...(role ? [`#${role}`] : [])];
}

export function caption(job: CaptionJob, lang: "am" | "en", channel: CaptionChannel): string {
  const salary = `ETB ${money(job.salaryMin)}–${money(job.salaryMax)}`;
  const tags = hashtags(job).join(" ");
  // Instagram and TikTok captions can't hold a clickable link.
  const link = channel === "INSTAGRAM" || channel === "TIKTOK";
  if (lang === "am") {
    const title = job.titleAm || job.titleEn;
    const venue = job.venueAm || job.venueEn;
    return [
      `📣 ሠራተኛ እንፈልጋለን፦ ${title}`,
      `🏨 ${venue} · ${job.subCityAm}`,
      `💰 ${money(job.salaryMin)}–${money(job.salaryMax)} ብር ${PERIOD.am[job.salaryPeriod]} · ${TYPE.am[job.employmentType]}`,
      ...(job.urgent ? ["⚡ አስቸኳይ ቅጥር"] : []),
      `✅ ${job.verified ? "የተረጋገጠ ድርጅት · " : ""}ማመልከት ነፃ ነው`,
      link ? "👉 በServaddis ይፈልጉና ያመልክቱ (ሊንኩ በገጻችን ላይ)" : `👉 በServaddis ያመልክቱ፦ ${job.url}`,
      "",
      tags,
    ].join("\n");
  }
  return [
    `📣 Now hiring: ${job.titleEn || job.titleAm}`,
    `🏨 ${job.venueEn} · ${job.subCityEn}`,
    `💰 ${salary} / ${PERIOD.en[job.salaryPeriod]} · ${TYPE.en[job.employmentType]}`,
    ...(job.urgent ? ["⚡ Urgent hire"] : []),
    `✅ ${job.verified ? "Verified venue · " : ""}Free to apply`,
    link ? "👉 Apply on Servaddis (link in bio)" : `👉 Apply on Servaddis: ${job.url}`,
    "",
    tags,
  ].join("\n");
}
