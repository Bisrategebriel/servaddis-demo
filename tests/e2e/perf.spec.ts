import { expect, test, type Browser } from "@playwright/test";
import { post } from "./support";

// TRD §8 budgets for jobseeker routes, on a cold load at 360 × 740:
//   ≤ 200 KB of JS + CSS (compressed, as transferred) before the load event
//   FCP ≤ 3.5 s on Lighthouse's mobile "Slow 4G" profile with 4× CPU slowdown
// Lighthouse's own DevTools-throttling constants are applied through CDP, so this measures the
// same thing without adding Lighthouse as a dependency (decision log, T7.3).

const KB = 1024;
const BUDGET_BYTES = 200 * KB;
const FCP_BUDGET_MS = 3500;
const RUNS = 3;
// lighthouse-core/config/constants.js → throttling.mobileSlow4G (DevTools mode)
const SLOW_4G = {
  latency: 150 * 3.75, // requestLatencyMs
  downloadThroughput: (1.6 * 1024 * 0.9 * 1024) / 8, // bytes/s
  uploadThroughput: (750 * 0.9 * 1024) / 8,
  cpuSlowdown: 4,
};

const ROUTES: { path: string; signedIn: boolean }[] = [
  { path: "/", signedIn: false },
  { path: "/jobs", signedIn: false },
  { path: "/jobs/:id", signedIn: false },
  { path: "/jobs/:id", signedIn: true },
  { path: "/me/applications", signedIn: true },
  { path: "/me/profile", signedIn: true },
];

test.describe.serial("jobseeker performance budgets (Slow 4G, 4× CPU)", () => {
  let jobId = "";

  test.beforeAll(async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    await post(ctx, baseURL!, "/api/demo/reset");
    const { items } = await (await ctx.request.get(`${baseURL}/api/public/jobs`)).json();
    jobId = items.find((j: { titleEn: string }) => j.titleEn === "Front Desk Agent").id;
    // Warm the server, not the browser: the first request after `next start` pays one-off
    // server costs a running demo server has long since paid. Each browser load stays cold.
    const signedIn = await browser.newContext({ baseURL });
    await post(signedIn, baseURL!, "/api/demo/persona", { persona: "dawit" });
    for (const route of ROUTES) {
      const client = route.signedIn ? signedIn : ctx;
      await client.request.get(`${baseURL}${route.path.replace(":id", jobId)}`);
    }
    await signedIn.close();
    // Warm the browser too (GPU and network processes start on its first page). A separate
    // context shares no HTTP cache with the measured ones.
    const warm = await ctx.newPage();
    await warm.goto("/jobs");
    await ctx.close();
  });

  /** One cold, throttled load of a route: JS+CSS bytes before load, and FCP. */
  async function measure(browser: Browser, baseURL: string, route: (typeof ROUTES)[number]) {
    // A fresh context each time: empty cache, like a first visit on a phone.
    const ctx = await browser.newContext({
      baseURL,
      viewport: { width: 360, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    await post(ctx, baseURL, "/api/locale", { locale: "am" }); // the jobseeker default
    if (route.signedIn) {
      await post(ctx, baseURL, "/api/demo/persona", { persona: "dawit" });
      await post(ctx, baseURL, "/api/locale", { locale: "am" });
    }
    const page = await ctx.newPage();
    // Warm the renderer's system fonts first. A fresh Chrome renderer on a desktop OS spends
    // 1–2 s (at 4× CPU) mapping system font files during its first layout, a cost phones don't
    // pay (their system fonts are mapped system-wide). /offline.html is same-origin, so the
    // same renderer process, renders system-font text, and loads none of the app's CSS or JS,
    // so the measured load below is still cold for everything the budget is about.
    await page.goto("/offline.html");
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: SLOW_4G.latency,
      downloadThroughput: SLOW_4G.downloadThroughput,
      uploadThroughput: SLOW_4G.uploadThroughput,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: SLOW_4G.cpuSlowdown });

    // JS and CSS transferred before the load event (later prefetches don't count).
    const kinds = new Set<string>();
    let loaded = false;
    let bytes = 0;
    cdp.on("Network.responseReceived", (e) => {
      if (e.type === "Script" || e.type === "Stylesheet") kinds.add(e.requestId);
    });
    cdp.on("Network.loadingFinished", (e) => {
      if (!loaded && kinds.has(e.requestId)) bytes += e.encodedDataLength;
    });

    await page.goto(route.path.replace(":id", jobId), { waitUntil: "load", timeout: 60_000 });
    loaded = true;
    const fcp = await page.evaluate(
      () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? Infinity,
    );
    await ctx.close();
    return { bytes, fcp };
  }

  for (const route of ROUTES) {
    const label = `${route.path}${route.signedIn ? " (signed in)" : ""}`;
    test(`${label}: ≤ 200 KB JS+CSS, FCP ≤ 3.5 s`, async ({ browser, baseURL }) => {
      // Single cold loads vary by up to a second; like Lighthouse CI, judge the median of runs.
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, baseURL!, route));
      const fcps = runs.map((r) => r.fcp).sort((a, b) => a - b);
      const fcp = fcps[Math.floor(fcps.length / 2)];
      // Bytes too: the page's own JS+CSS is the same every load, but a prefetch for another route
      // occasionally lands before the load event and inflates one run (seen once: 180 → 253 KB).
      const sizes = runs.map((r) => r.bytes).sort((a, b) => a - b);
      const bytes = sizes[Math.floor(sizes.length / 2)];
      const kb = (n: number) => (n / KB).toFixed(0);
      const line = `${label}: ${kb(bytes)} KB JS+CSS (${sizes.map(kb).join(", ")}), FCP median ${Math.round(fcp)} ms (${fcps.map(Math.round).join(", ")})`;
      test.info().annotations.push({ type: "measure", description: line });
      console.log(line);
      expect(bytes, `${label} JS+CSS bytes`).toBeLessThanOrEqual(BUDGET_BYTES);
      // FCP scales with the host CPU (the 4× slowdown multiplies whatever machine runs this), so it
      // is enforced on local runs and only reported on shared CI runners unless E2E_STRICT_FCP=1.
      // The byte budget doesn't depend on the host and is enforced everywhere.
      if (!process.env.CI || process.env.E2E_STRICT_FCP === "1") {
        expect(fcp, `${label} FCP ms (median of ${RUNS})`).toBeLessThanOrEqual(FCP_BUDGET_MS);
      }
    });
  }
});
