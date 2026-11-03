import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/empty-state";
import {
  CardListSkeleton,
  DashboardSkeleton,
  DetailSkeleton,
  FormSkeleton,
  PipelineSkeleton,
  TableSkeleton,
  TileGridSkeleton,
} from "@/components/skeletons";

// doc 04 §6.1 loading and §5 EmptyState: what assistive tech and reduced-motion users get.

describe("skeletons", () => {
  it.each([
    ["CardListSkeleton", CardListSkeleton],
    ["DashboardSkeleton", DashboardSkeleton],
    ["DetailSkeleton", DetailSkeleton],
    ["FormSkeleton", FormSkeleton],
    ["PipelineSkeleton", PipelineSkeleton],
    ["TableSkeleton", TableSkeleton],
    ["TileGridSkeleton", TileGridSkeleton],
  ] as const)("%s announces its label once and pulses only when motion is allowed", (_, C) => {
    const html = renderToStaticMarkup(createElement(C, { label: "Loading…" }));
    expect(html).toMatch(/^<div role="status"/);
    expect(html.match(/Loading…/g)).toHaveLength(1);
    expect(html).toContain('<span class="sr-only">Loading…</span>');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).not.toMatch(/(^|\s)animate-pulse/);
  });

  it("TableSkeleton can leave out its heading bar", () => {
    const withHeading = renderToStaticMarkup(createElement(TableSkeleton, { label: "x", rows: 2 }));
    const without = renderToStaticMarkup(
      createElement(TableSkeleton, { label: "x", rows: 2, heading: false }),
    );
    expect(withHeading).toContain("h-8 w-48");
    expect(without).not.toContain("h-8 w-48");
  });
});

describe("EmptyState", () => {
  it("renders a decorative drawing, one sentence and the action", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        illustration: "applicants",
        title: "No applicants yet.",
        action: createElement("a", { href: "/promote" }, "Promote"),
        testId: "empty",
      }),
    );
    expect(html).toContain('data-testid="empty"');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toContain("No applicants yet.");
    expect(html).toContain('<a href="/promote">Promote</a>');
  });

  it.each(["jobs", "applicants", "team", "notifications", "offline", "forbidden"] as const)(
    "has a %s drawing",
    (illustration) => {
      const html = renderToStaticMarkup(createElement(EmptyState, { illustration, title: "x" }));
      expect(html.match(/<(path|circle|rect)/g)!.length).toBeGreaterThan(2);
    },
  );

  it("compact mode drops the card for popovers", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, { illustration: "notifications", title: "x", compact: true }),
    );
    expect(html).not.toContain("border-border");
    expect(html).toContain("h-16 w-20");
  });
});
