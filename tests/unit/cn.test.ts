import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

const has = (classes: string, ...wanted: string[]) =>
  wanted.every((w) => classes.split(" ").includes(w));

describe("cn with the Servaddis type scale", () => {
  it.each(["display", "h1", "h2", "h3", "body", "small", "caption"])(
    "text-%s is a size, so it keeps the text colour",
    (size) => {
      const merged = cn("bg-primary text-primary-foreground", `text-${size}`);
      expect(has(merged, "text-primary-foreground", `text-${size}`)).toBe(true);
    },
  );

  it("replaces another size, like any size utility", () => {
    expect(cn("text-sm text-primary-foreground", "text-body").split(" ")).not.toContain("text-sm");
  });

  it("still lets a later colour win", () => {
    expect(cn("text-gray-300", "text-white")).toBe("text-white");
  });

  it("keeps our token colours next to a size", () => {
    expect(has(cn("text-small", "text-text-secondary"), "text-small", "text-text-secondary")).toBe(
      true,
    );
    expect(has(cn("text-caption", "text-danger-fg"), "text-caption", "text-danger-fg")).toBe(true);
  });
});
