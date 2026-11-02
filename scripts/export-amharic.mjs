// Exports every Amharic string the app can show into one spreadsheet for a native-speaker review
// (D-6, T6.1): the UI messages, plus Amharic written in server code (errors, notifications, SMS,
// rule messages, captions, shift patterns) and seed data (role templates, skills, places, plans).
//   pnpm amharic:review            → docs/amharic-review.csv  (UTF-8 with BOM, opens in Excel)
// Re-run after changes; the reviewer fills "Suggested Amharic" and "Notes".
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ETHIOPIC = /[ሀ-᎟ⶀ-⷟꬀-꬯]/;
const rows = [];

// 1) UI messages: key, English, Amharic, side by side.
const en = JSON.parse(readFileSync(path.join(ROOT, "messages/en.json"), "utf8"));
const am = JSON.parse(readFileSync(path.join(ROOT, "messages/am.json"), "utf8"));
const flat = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
const enMap = new Map(flat(en));
for (const [key, amText] of flat(am)) {
  rows.push({
    area: `UI · ${key.split(".")[0]}`,
    where: `messages · ${key}`,
    english: enMap.get(key) ?? "",
    amharic: amText,
  });
}

// 2) Amharic string literals in code and seed data, with the English sibling when the code keeps
//    one nearby (titleAm next to titleEn, messageAm next to messageEn, [en, am] pairs, …).
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx|json)$/.test(name) ? [p] : [];
  });
const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "prisma/seed"))].filter(
  (f) => !f.endsWith(".d.ts"),
);
const LITERAL = /(["'`])((?:\\.|(?!\1).)*)\1/g;
for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!ETHIOPIC.test(line) || /^\s*\/\//.test(line)) return;
    for (const m of line.matchAll(LITERAL)) {
      const text = m[2];
      if (!ETHIOPIC.test(text)) continue;
      // English sibling: same key with En, or the previous string on a [en, am] line.
      const keyMatch = /(\w+)Am\s*:/.exec(line.slice(0, m.index));
      let english = "";
      if (keyMatch) {
        const want = new RegExp(`${keyMatch[1]}En\\s*:\\s*(["'\`])((?:\\\\.|(?!\\1).)*)\\1`);
        // Nearest line first: the same line, then one above, one below, two above, …
        for (let d = 0; d <= 8 && !english; d++) {
          for (const j of d === 0 ? [i] : [i - d, i + d]) {
            if (j < 0 || j >= lines.length || english) continue;
            english = want.exec(lines[j])?.[2] ?? "";
          }
        }
      }
      // Otherwise the closest Latin string before it: on the same line ([en, am] pairs), or on
      // the line above (conflict("English", "Amharic") split over two lines).
      const latinBefore = (text) =>
        [...text.matchAll(LITERAL)]
          .filter((x) => !ETHIOPIC.test(x[2]) && /[A-Za-z]{3}/.test(x[2]))
          .pop()?.[2] ?? "";
      if (!english) english = latinBefore(line.slice(0, m.index));
      if (!english && i > 0) english = latinBefore(lines[i - 1]);
      rows.push({
        area: rel.startsWith("prisma/") ? "Seed data" : "Server / code",
        where: `${rel}:${i + 1}`,
        english,
        amharic: text,
      });
    }
  });
}

const cell = (s) => `"${String(s).replaceAll('"', '""')}"`;
const header = ["Area", "Where", "English", "Amharic (draft)", "Suggested Amharic", "Notes"];
const csv = [header, ...rows.map((r) => [r.area, r.where, r.english, r.amharic, "", ""])]
  .map((r) => r.map(cell).join(","))
  .join("\r\n");
writeFileSync(path.join(ROOT, "docs/amharic-review.csv"), "﻿" + csv + "\r\n");
console.log(
  `docs/amharic-review.csv: ${rows.length} strings (${rows.filter((r) => r.area.startsWith("UI")).length} UI, ${rows.filter((r) => r.area === "Server / code").length} code, ${rows.filter((r) => r.area === "Seed data").length} seed)`,
);
