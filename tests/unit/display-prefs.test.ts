import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { DISPLAY_PREFS, displayPrefsScript } from "@/lib/display-prefs";

// The inline script runs before React, in every page's <body>: it must set the attributes from
// storage, follow other windows, and never throw (blocked storage, private mode).

const { presenter, hideSimulated } = DISPLAY_PREFS;

function run(stored: Record<string, string>, { storageThrows = false } = {}) {
  const attrs = new Set<string>();
  const listeners: ((e: { key: string }) => void)[] = [];
  const values = { ...stored };
  runInNewContext(displayPrefsScript, {
    document: {
      documentElement: {
        setAttribute: (n: string) => attrs.add(n),
        removeAttribute: (n: string) => attrs.delete(n),
      },
    },
    localStorage: {
      getItem: (k: string) => {
        if (storageThrows) throw new Error("SecurityError");
        return values[k] ?? null;
      },
    },
    addEventListener: (type: string, fn: (e: { key: string }) => void) => {
      if (type === "storage") listeners.push(fn);
    },
  });
  return {
    has: (attr: string) => attrs.has(attr),
    storage(key: string, next: string | null) {
      if (next === null) delete values[key];
      else values[key] = next;
      listeners.forEach((fn) => fn({ key }));
    },
  };
}

describe("display prefs script", () => {
  it('turns each setting on only when stored as "1"', () => {
    const page = run({ [presenter.key]: "1", [hideSimulated.key]: "0" });
    expect(page.has(presenter.attr)).toBe(true);
    expect(page.has(hideSimulated.attr)).toBe(false);
    expect(run({}).has(presenter.attr)).toBe(false);
  });

  it("follows a toggle made in another window", () => {
    const page = run({});
    page.storage(hideSimulated.key, "1");
    expect(page.has(hideSimulated.attr)).toBe(true);
    page.storage(presenter.key, "1");
    expect(page.has(presenter.attr)).toBe(true);
    page.storage("something-else", null);
    expect(page.has(presenter.attr)).toBe(true);
    page.storage(presenter.key, null);
    expect(page.has(presenter.attr)).toBe(false);
    expect(page.has(hideSimulated.attr)).toBe(true);
  });

  it("does not throw when storage is blocked", () => {
    expect(() => run({ [presenter.key]: "1" }, { storageThrows: true })).not.toThrow();
    expect(run({ [presenter.key]: "1" }, { storageThrows: true }).has(presenter.attr)).toBe(false);
  });
});
