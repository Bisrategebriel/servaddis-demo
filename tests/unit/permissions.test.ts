import { readFileSync } from "node:fs";
import path from "node:path";
import type { MemberRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  PRESETS,
  VENUE_PERMISSIONS,
  effectivePermissions,
  isCustomised,
  parsePermissionList,
  permissionList,
  type VenuePermission,
} from "@/lib/permissions";

// The spec is the test oracle: these tests parse the tables in /docs, so code and spec
// cannot drift apart silently.
const docs = (file: string) =>
  readFileSync(path.resolve(import.meta.dirname, "../../docs", file), "utf8");

/** Rows of App Flow §6.1 "Role presets": label + one ✔/— per role column. */
function appFlowMatrix() {
  const text = docs("03-App-Flow.md");
  const section = text.slice(text.indexOf("### 6.1 Role presets")).split("\n");
  // the first contiguous run of table lines in the section
  const start = section.findIndex((l) => l.startsWith("|"));
  const end = section.findIndex((l, i) => i > start && !l.startsWith("|"));
  const lines = section.slice(start, end);
  const header = lines[0]
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  const rows = lines.slice(2).map((l) =>
    l
      .split("|")
      .map((c) => c.trim())
      .slice(1, -1),
  );
  return { header, rows };
}

// App Flow labels → permission keys (a row may cover two keys).
const LABEL_KEYS: Record<string, VenuePermission[]> = {
  "View jobs": ["job.view"],
  "Create / edit jobs": ["job.create", "job.edit"],
  "Submit job for review": ["job.submit"],
  "Close / repost job": ["job.close"],
  "Promote to socials": ["social.promote"],
  "View applicants": ["applicant.view"],
  Shortlist: ["applicant.shortlist"],
  Reject: ["applicant.reject"],
  "Mark hired": ["applicant.hire"],
  "Reveal contact": ["contact.reveal"],
  "View insights": ["insights.view"],
  "Billing & plans": ["billing.manage"],
  "Manage team": ["team.manage"],
  "Edit venue profile": ["venue.edit"],
};

const COLUMN_ROLE: Record<string, MemberRole> = {
  Owner: "OWNER",
  "HR Manager": "HR_MANAGER",
  Poster: "POSTER",
  Screener: "SCREENER",
  Viewer: "VIEWER",
};

describe("role presets match App Flow §6.1", () => {
  const { header, rows } = appFlowMatrix();
  const roleColumns = header.slice(1);

  it("has the expected shape: 14 rows × 5 roles", () => {
    expect(roleColumns).toEqual(Object.keys(COLUMN_ROLE));
    expect(rows).toHaveLength(14);
  });

  it("maps every row label to permission keys", () => {
    for (const [label] of rows)
      expect(LABEL_KEYS, `unmapped label "${label}"`).toHaveProperty([label]);
  });

  it("covers every venue permission key", () => {
    const covered = new Set(Object.values(LABEL_KEYS).flat());
    expect([...covered].sort()).toEqual([...VENUE_PERMISSIONS].sort());
  });

  const cells = rows.flatMap(([label, ...marks]) =>
    marks.map((mark, i) => ({ label, column: roleColumns[i], allowed: mark === "✔" })),
  );

  it.each(cells)("$label · $column → $allowed", ({ label, column, allowed }) => {
    const perms = effectivePermissions({ role: COLUMN_ROLE[column] });
    for (const key of LABEL_KEYS[label]) expect(perms.has(key), key).toBe(allowed);
  });
});

describe("presets match Backend Schema §5.2", () => {
  const text = docs("05-Backend-Schema.md");
  const block = text.slice(
    text.indexOf("export const PRESETS"),
    text.indexOf("};", text.indexOf("export const PRESETS")),
  );

  it.each(Object.keys(PRESETS) as MemberRole[])("%s", (role) => {
    const m = new RegExp(`${role}:\\s*\\[([^\\]]*)\\]`).exec(block);
    expect(m, `${role} missing in doc 05`).not.toBeNull();
    const fromDoc = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect([...PRESETS[role]].sort()).toEqual(fromDoc.sort());
  });
});

describe("effective = (preset ∪ grant) − revoke", () => {
  const json = (keys: string[]) => JSON.stringify(keys);

  it("grant adds to the preset", () => {
    const p = effectivePermissions({ role: "POSTER", grant: json(["applicant.view"]) });
    expect(p.has("applicant.view")).toBe(true);
    expect(p.has("job.create")).toBe(true);
  });

  it("revoke removes from the preset", () => {
    const p = effectivePermissions({ role: "SCREENER", revoke: json(["contact.reveal"]) });
    expect(p.has("contact.reveal")).toBe(false);
    expect(p.has("applicant.shortlist")).toBe(true);
  });

  it("revoke wins over grant for the same key", () => {
    const p = effectivePermissions({
      role: "VIEWER",
      grant: json(["applicant.hire"]),
      revoke: json(["applicant.hire"]),
    });
    expect(p.has("applicant.hire")).toBe(false);
  });

  it("ignores unknown keys, platform keys and malformed JSON", () => {
    expect(parsePermissionList(json(["admin.moderate", "root", "job.view"]))).toEqual(["job.view"]);
    expect(parsePermissionList("not json")).toEqual([]);
    expect(parsePermissionList('{"job.view":true}')).toEqual([]);
    const p = effectivePermissions({ role: "VIEWER", grant: json(["admin.audit"]) });
    expect([...p].some((k) => k.startsWith("admin."))).toBe(false);
  });

  it("lists permissions in canonical order", () => {
    expect(permissionList(effectivePermissions({ role: "VIEWER" }))).toEqual([
      "job.view",
      "insights.view",
    ]);
  });

  it("flags customised members, but not a no-op override", () => {
    expect(isCustomised({ role: "SCREENER" })).toBe(false);
    expect(isCustomised({ role: "SCREENER", revoke: json(["contact.reveal"]) })).toBe(true);
    expect(isCustomised({ role: "SCREENER", grant: json(["job.view"]) })).toBe(false);
  });
});
