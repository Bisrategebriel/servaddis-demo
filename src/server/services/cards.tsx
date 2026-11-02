import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Job, SubCity, Venue } from "@prisma/client";
import { createTranslator } from "next-intl";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { eatDaysBetween } from "@/lib/expiry";
import { formatSalary } from "@/lib/format";
import am from "../../../messages/am.json";
import en from "../../../messages/en.json";
import { now } from "../clock";

// Social job card (doc 02 §5.6, doc 04 SCR-E10) rendered with next/og (Satori + resvg):
// 1080×1080 for Instagram/Facebook/Telegram, 1080×1920 for stories and TikTok, in Amharic or
// English. Satori reads TTF/OTF/WOFF but not WOFF2, so static WOFF files live in src/fonts/og.
// Ethiopic needs no complex shaping (pre-composed syllables), so it renders correctly as long as
// Noto Sans Ethiopic is in the font list; Satori falls back to it for every Ethiopic glyph.

export type CardLang = "am" | "en";
export type CardSize = "square" | "story";
export const CARD_SIZES: Record<CardSize, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

const NAVY_950 = "#0e1830";
const NAVY_900 = "#16243f";
const NAVY_200 = "#b9c8e3";
const AMBER = "#d9a441";
const WHITE = "#ffffff";

// Read once per server process, not per card (Next docs: fonts don't depend on the request).
// Literal paths, as in the Next docs: a path built from a variable makes the build's file
// tracing scan whole folders (it once walked into data/ and tripped over the SQLite lock file).
const loaded = Promise.all([
  readFile(path.join(process.cwd(), "src/fonts/og/inter-latin-400-normal.woff")),
  readFile(path.join(process.cwd(), "src/fonts/og/inter-latin-700-normal.woff")),
  readFile(path.join(process.cwd(), "src/fonts/og/noto-sans-ethiopic-ethiopic-400-normal.woff")),
  readFile(path.join(process.cwd(), "src/fonts/og/noto-sans-ethiopic-ethiopic-700-normal.woff")),
  readFile(path.join(process.cwd(), "public/icons/servaddis-icon-reversed.svg")),
]).then(([inter400, inter700, eth400, eth700, icon]) => ({
  fonts: [
    { name: "Inter", data: inter400, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: inter700, weight: 700 as const, style: "normal" as const },
    { name: "Noto Sans Ethiopic", data: eth400, weight: 400 as const, style: "normal" as const },
    { name: "Noto Sans Ethiopic", data: eth700, weight: 700 as const, style: "normal" as const },
  ],
  icon: `data:image/svg+xml;base64,${icon.toString("base64")}`,
}));

// Symbols as SVG, not text: a glyph missing from our fonts (✓, ⚡) makes Satori fetch a font
// from Google, which hangs for 10 s offline. Paths are lucide's (ISC), 24×24.
const CHECK = "M20 6 9 17l-5-5";
const BOLT =
  "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z";

function Icon({ d, size, color }: { d: string; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The QR code as one SVG path (one 1×1 square per dark module). */
function QrSvg({ url, size }: { url: string; size: number }) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges">
      <path d={d} fill={NAVY_950} />
    </svg>
  );
}

export type CardJob = Job & { venue: Venue; subCity: SubCity };

export const jobUrl = (jobId: string) =>
  `${(process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/jobs/${jobId}`;

export async function renderCard(job: CardJob, lang: CardLang, size: CardSize) {
  const { fonts, icon } = await loaded;
  // Plain translators: a card is rendered for a chosen language, not the request's locale.
  const messages = lang === "am" ? am : en;
  const t = createTranslator({ locale: lang, messages, namespace: "card" });
  const tp = createTranslator({ locale: lang, messages, namespace: "jobs.preview" });
  const tf = createTranslator({ locale: lang, messages, namespace: "feed" });
  const isAm = lang === "am";
  const title = (isAm ? job.titleAm || job.titleEn : job.titleEn || job.titleAm) ?? "";
  const venue = (isAm ? job.venue.nameAm : null) || job.venue.nameEn;
  const subCity = isAm ? job.subCity.nameAm : job.subCity.nameEn;
  const story = size === "story";
  const { width, height } = CARD_SIZES[size];

  let deadline: string | null = null;
  if (job.urgency !== "NORMAL" && job.expiresAt) {
    const days = eatDaysBetween(now(), job.expiresAt);
    deadline =
      job.urgency === "HALF_DAY"
        ? tf("closesInHours", {
            hours: Math.max(1, Math.ceil((+job.expiresAt - +now()) / 3_600_000)),
          })
        : days <= 0
          ? tf("closesToday")
          : days === 1
            ? tf("closesTomorrow")
            : tf("closesInDays", { days });
  }
  // Long titles step down so they fit in two or three lines.
  const titleSize = (story ? 112 : 96) * (title.length > 24 ? 0.66 : title.length > 14 ? 0.76 : 1);

  return new ImageResponse(
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: story ? 96 : 72,
        gap: story ? 48 : 24, // header, body and footer never touch, even with a long title
        background: `linear-gradient(160deg, ${NAVY_900} 0%, ${NAVY_950} 100%)`,
        color: WHITE,
        fontFamily: "Inter, Noto Sans Ethiopic",
      }}
    >
      {/* Header: bell badge + wordmark, urgent ribbon */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
          <img src={icon} width={story ? 104 : 88} height={story ? 104 : 88} alt="" />
          <div style={{ display: "flex", fontSize: story ? 52 : 44, fontWeight: 700 }}>
            <span>Serv</span>
            <span style={{ color: AMBER }}>አዲስ</span>
          </div>
        </div>
        {deadline && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: AMBER,
              color: NAVY_950,
              fontSize: story ? 36 : 30,
              fontWeight: 700,
              padding: "12px 24px",
              borderRadius: 999,
            }}
          >
            <Icon d={BOLT} size={story ? 34 : 28} color={NAVY_950} />
            {`${t("urgent")} · ${deadline}`}
          </div>
        )}
      </div>

      {/* Body: title, venue, place and type, salary */}
      <div style={{ display: "flex", flexDirection: "column", gap: story ? 36 : 20 }}>
        <div style={{ display: "flex", fontSize: story ? 40 : 32, color: AMBER, fontWeight: 700 }}>
          {t("hiring")}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: isAm ? 1.25 : 1.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: story ? 44 : 38,
            color: NAVY_200,
          }}
        >
          <span>{venue}</span>
          {job.venue.verification === "VERIFIED" && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: story ? 30 : 26,
                color: AMBER,
                fontWeight: 700,
              }}
            >
              <Icon d={CHECK} size={story ? 32 : 28} color={AMBER} />
              {t("verified")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", fontSize: story ? 38 : 32, color: NAVY_200 }}>
          {[
            subCity,
            tp(`employment.${job.employmentType}`),
            t("openings", { count: job.headcount }),
          ].join(" · ")}
        </div>
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              background: AMBER,
              color: NAVY_950,
              fontSize: story ? 52 : 44,
              fontWeight: 700,
              padding: story ? "18px 36px" : "14px 30px",
              borderRadius: 999,
              gap: story ? 14 : 12,
            }}
          >
            {/* Separate pieces: Satori adds extra space where the text switches fonts. */}
            <span>{formatSalary(job.salaryMin, job.salaryMax, lang)}</span>
            <span>/</span>
            <span>{tp(`period.${job.salaryPeriod}`)}</span>
          </div>
        </div>
      </div>

      {/* Footer: call to action + domain placeholder, QR on a white tile */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: story ? 48 : 40, fontWeight: 700 }}>
            {t("apply")}
          </div>
          <div style={{ display: "flex", fontSize: story ? 32 : 28, color: NAVY_200 }}>
            {t("noFee")}
          </div>
          <div
            style={{ display: "flex", fontSize: story ? 30 : 26, color: NAVY_200, marginTop: 16 }}
          >
            servaddis.com
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            background: WHITE,
            borderRadius: 24,
            padding: 20,
          }}
        >
          <QrSvg url={jobUrl(job.id)} size={story ? 300 : 210} />
          <div
            style={{ display: "flex", fontSize: story ? 26 : 22, color: NAVY_950, fontWeight: 700 }}
          >
            {t("scan")}
          </div>
        </div>
      </div>
    </div>,
    { width, height, fonts },
  );
}
