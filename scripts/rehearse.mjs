#!/usr/bin/env node
// `pnpm rehearse`: the automated half of the demo rehearsal (doc 06 §8, T7.4).
//   pnpm rehearse                 build once, then run the demo script 3 times in a row
//                                 (English and Amharic), stopping at the first failure
//   pnpm rehearse --runs 5        a different number of consecutive runs
//   pnpm rehearse --record        one slowed-down run in presenter mode, saving a video per window
//                                 (employer, admin, phone) and a page that plays them side by side
//   pnpm rehearse --skip-build    reuse the last .next-e2e build
// Every run starts its own isolated server from a fresh seed (scripts/e2e-server.mjs), so this
// never touches the demo data or a running `pnpm dev`.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const record = flag("--record");
const runs = record ? 1 : Number(value("--runs", "3"));
let skipBuild = flag("--skip-build");

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const recordDir = path.resolve("rehearsals", stamp);
if (record) mkdirSync(recordDir, { recursive: true });

const results = [];
for (let i = 1; i <= runs; i++) {
  console.log(`\n▸ Rehearsal ${i} of ${runs}${record ? " (recording)" : ""}`);
  const started = Date.now();
  const { status } = spawnSync(
    `node scripts/e2e.mjs ${skipBuild ? "--skip-build" : ""} -- tests/e2e/demo-script.spec.ts --retries=0`,
    {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...(record ? { E2E_RECORD_DIR: recordDir } : {}) },
    },
  );
  skipBuild = true; // one build for all runs
  results.push({ run: i, ok: status === 0, seconds: Math.round((Date.now() - started) / 1000) });
  if (status !== 0) break;
}

console.log("\n── Rehearsal summary ──");
for (const r of results)
  console.log(`  run ${r.run}: ${r.ok ? "clean" : "FAILED"} (${r.seconds} s)`);
const clean = results.filter((r) => r.ok).length;
console.log(`  ${clean} of ${runs} consecutive clean run${runs === 1 ? "" : "s"}`);

if (record && clean === 1) {
  writeFileSync(path.join(recordDir, "index.html"), player());
  console.log(`\n▸ Fallback video: open ${path.join(recordDir, "index.html")}`);
}
process.exit(clean === runs ? 0 : 1);

/** An offline page that plays the three windows' videos side by side, in sync. */
function player() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Servaddis · fallback demo recording</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: system-ui, "Segoe UI", sans-serif; background: #0e1830; color: #fff; }
  header { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 12px 16px; }
  h1 { font-size: 18px; margin: 0 auto 0 0; }
  button { min-height: 40px; padding: 0 14px; border: 0; border-radius: 8px; font: inherit; font-weight: 600;
           background: #d9a441; color: #16243f; cursor: pointer; }
  button[aria-pressed="false"] { background: #1f3358; color: #fff; }
  main { display: grid; grid-template-columns: 1fr 1fr 0.42fr; gap: 12px; padding: 0 16px 16px; }
  figure { margin: 0; }
  figcaption { font-size: 13px; opacity: 0.8; padding: 4px 0; }
  video { width: 100%; border-radius: 8px; background: #000; }
</style>
</head>
<body>
<header>
  <h1>Servaddis demo: fallback recording</h1>
  <button type="button" data-lang="en" aria-pressed="true">English</button>
  <button type="button" data-lang="am" aria-pressed="false">አማርኛ</button>
  <button type="button" id="play">Play all</button>
  <button type="button" id="restart" aria-pressed="false">Restart</button>
</header>
<main>
  <figure><figcaption>Employer (laptop)</figcaption><video id="employer" muted playsinline></video></figure>
  <figure><figcaption>Admin (laptop)</figcaption><video id="admin" muted playsinline></video></figure>
  <figure><figcaption>Jobseeker (phone)</figcaption><video id="phone" muted playsinline></video></figure>
</main>
<script>
  const videos = ["employer", "admin", "phone"].map((id) => document.getElementById(id));
  const play = document.getElementById("play");
  function load(lang) {
    for (const v of videos) v.src = lang + "-" + v.id + ".webm";
    for (const b of document.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    play.textContent = "Play all";
  }
  play.onclick = () => {
    const paused = videos[0].paused;
    for (const v of videos) { v.currentTime = videos[0].currentTime; paused ? v.play() : v.pause(); }
    play.textContent = paused ? "Pause all" : "Play all";
  };
  document.getElementById("restart").onclick = () => { for (const v of videos) v.currentTime = 0; };
  for (const b of document.querySelectorAll("[data-lang]")) b.onclick = () => load(b.dataset.lang);
  load("en");
</script>
</body>
</html>
`;
}
