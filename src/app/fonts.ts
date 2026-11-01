import localFont from "next/font/local";

// Self-hosted (doc 04 §2.3, TRD §6) so `pnpm demo` works offline. Files copied from
// @fontsource-variable (OFL, licences in src/fonts/). Inter covers Latin; Noto Sans Ethiopic
// only covers Ethiopic code points, so browsers fetch it only when Amharic text is on screen.

export const inter = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const notoEthiopic = localFont({
  src: "../fonts/noto-sans-ethiopic-ethiopic-wght-normal.woff2",
  variable: "--font-ethiopic",
  weight: "100 900",
  display: "swap",
  // Not preloaded: English pages should not pay for ~200 KB of Ethiopic glyphs (TRD TR6).
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+1200-1399, U+2D80-2DDE, U+AB01-AB2E" }],
});
