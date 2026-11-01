import { describe, expect, it } from "vitest";
import am from "../../messages/am.json";
import en from "../../messages/en.json";

// TRD §8: 0 untranslated keys. Both message files must define exactly the same keys.
function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("messages", () => {
  it("en.json and am.json have identical key sets", () => {
    const enKeys = keys(en).sort();
    const amKeys = keys(am).sort();
    expect(
      amKeys.filter((k) => !enKeys.includes(k)),
      "only in am.json",
    ).toEqual([]);
    expect(
      enKeys.filter((k) => !amKeys.includes(k)),
      "only in en.json",
    ).toEqual([]);
  });

  it("has no empty strings", () => {
    const empty = (m: object) =>
      keys(m).filter((k) => k.split(".").reduce<unknown>((o, p) => (o as never)[p], m) === "");
    expect(empty(en)).toEqual([]);
    expect(empty(am)).toEqual([]);
  });

  it("Amharic strings are actually in Ethiopic script (except names/codes)", () => {
    const latinOnly = new Set(["common.appName", "lang.en"]);
    const get = (k: string) =>
      k.split(".").reduce<unknown>((o, p) => (o as never)[p], am) as string;
    const untranslated = keys(am).filter((k) => !latinOnly.has(k) && !/[ሀ-፿]/.test(get(k)));
    expect(untranslated).toEqual([]);
  });
});
