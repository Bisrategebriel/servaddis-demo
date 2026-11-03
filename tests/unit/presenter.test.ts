import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { PRESENTER_KEY, presenterScript } from "@/lib/presenter-script";

// The inline script runs before React, in every page's <body>: it must set the attribute from
// storage, follow other windows, and never throw (blocked storage, private mode).

function run(stored: string | null, { storageThrows = false } = {}) {
  const attrs = new Set<string>();
  const listeners: ((e: { key: string }) => void)[] = [];
  let value = stored;
  const sandbox = {
    document: {
      documentElement: {
        setAttribute: (n: string) => attrs.add(n),
        removeAttribute: (n: string) => attrs.delete(n),
      },
    },
    localStorage: {
      getItem: (k: string) => {
        if (storageThrows) throw new Error("SecurityError");
        return k === PRESENTER_KEY ? value : null;
      },
    },
    addEventListener: (type: string, fn: (e: { key: string }) => void) => {
      if (type === "storage") listeners.push(fn);
    },
  };
  runInNewContext(presenterScript, sandbox);
  return {
    on: () => attrs.has("data-presenter"),
    storage(key: string, next: string | null) {
      value = next;
      listeners.forEach((fn) => fn({ key }));
    },
  };
}

describe("presenter script", () => {
  it('turns presenter mode on only when stored as "1"', () => {
    expect(run("1").on()).toBe(true);
    expect(run(null).on()).toBe(false);
    expect(run("0").on()).toBe(false);
  });

  it("follows a toggle made in another window", () => {
    const page = run(null);
    page.storage(PRESENTER_KEY, "1");
    expect(page.on()).toBe(true);
    page.storage("something-else", null);
    expect(page.on()).toBe(true);
    page.storage(PRESENTER_KEY, null);
    expect(page.on()).toBe(false);
  });

  it("does not throw when storage is blocked", () => {
    expect(() => run("1", { storageThrows: true })).not.toThrow();
    expect(run("1", { storageThrows: true }).on()).toBe(false);
  });
});
