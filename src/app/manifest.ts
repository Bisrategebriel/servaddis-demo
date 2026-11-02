import type { MetadataRoute } from "next";

// Web app manifest (TRD §3 PWA). Installs as the jobseeker app: it opens on the job feed.
// Prices, data and sign-in all stay online; only the offline page is available without a network.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Servaddis",
    short_name: "Servaddis",
    description: "Hospitality jobs in Addis Ababa. ሥራ በሆቴልና በምግብ ቤቶች።",
    start_url: "/jobs",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#16243f",
    theme_color: "#16243f",
    lang: "am",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
