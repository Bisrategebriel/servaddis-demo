import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { openWindow, post, type Lang } from "./support";

// TRD §8 / §12: axe on every P0 screen, in both languages (WCAG 2.1 A and AA rules, which
// include colour contrast). Read-only after one Reset, so the order of screens doesn't matter.

type Persona = "dawit" | "selam" | "yared" | "bruk" | "moderator" | null;
type Screen = {
  name: string;
  persona: Persona;
  path: (ids: Ids) => string;
  phone?: boolean;
  /** Something to do first, e.g. open the applicant drawer. */
  prepare?: (page: Page) => Promise<void>;
};
type Ids = { frontDesk: string; urgent: string; housekeeper: string; license: string };

const SCREENS: Screen[] = [
  { name: "landing", persona: null, path: () => "/", phone: true },
  { name: "login", persona: null, path: () => "/login", phone: true },
  { name: "feed", persona: null, path: () => "/jobs", phone: true },
  { name: "feed, no results", persona: null, path: () => "/jobs?q=zzzzqq", phone: true },
  {
    name: "job detail, signed out",
    persona: null,
    path: (i) => `/jobs/${i.frontDesk}`,
    phone: true,
  },
  {
    name: "job detail, jobseeker",
    persona: "dawit",
    path: (i) => `/jobs/${i.urgent}`,
    phone: true,
  },
  { name: "my applications", persona: "dawit", path: () => "/me/applications", phone: true },
  { name: "profile", persona: "dawit", path: () => "/me/profile", phone: true },
  { name: "dashboard", persona: "selam", path: () => "/employer" },
  { name: "jobs list", persona: "selam", path: () => "/employer/jobs" },
  { name: "template picker", persona: "selam", path: () => "/employer/jobs/new" },
  { name: "composer", persona: "selam", path: () => "/employer/jobs/new/compose?template=barista" },
  { name: "job overview", persona: "selam", path: (i) => `/employer/jobs/${i.frontDesk}` },
  {
    name: "pipeline with drawer",
    persona: "selam",
    path: (i) => `/employer/jobs/${i.frontDesk}/applicants`,
    prepare: async (page) => {
      await page.getByTestId("applicant").filter({ hasText: "Hana" }).first().click();
      await page.getByTestId("drawer").getByRole("heading").first().waitFor();
    },
  },
  {
    name: "pipeline, empty",
    persona: "selam",
    path: (i) => `/employer/jobs/${i.housekeeper}/applicants`,
  },
  { name: "promote", persona: "selam", path: (i) => `/employer/jobs/${i.frontDesk}/promote` },
  { name: "team", persona: "selam", path: () => "/employer/team" },
  { name: "plans", persona: "selam", path: () => "/employer/plans" },
  { name: "insights", persona: "selam", path: () => "/employer/insights" },
  { name: "403 page", persona: "yared", path: (i) => `/employer/jobs/${i.frontDesk}/applicants` },
  { name: "venue setup", persona: "bruk", path: () => "/employer/onboarding/venue" },
  { name: "admin queue", persona: "moderator", path: () => "/admin/queue" },
  { name: "admin review", persona: "moderator", path: (i) => `/admin/queue/${i.license}` },
  { name: "admin audit", persona: "moderator", path: () => "/admin/audit" },
  { name: "admin overview", persona: "moderator", path: () => "/admin/overview" },
];

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("accessibility (axe)", () => {
  let ids: Ids;
  const contexts = new Map<string, BrowserContext>();

  test.beforeAll(async ({ browser, baseURL }) => {
    const setup = await openWindow(browser, baseURL!, "en", "desktop");
    await post(setup, baseURL!, "/api/demo/reset");
    const { items } = await (await setup.request.get(`${baseURL}/api/public/jobs?limit=50`)).json();
    const find = (pred: (j: { titleEn: string; urgency: string; venueEn: string }) => boolean) =>
      items.find(pred).id as string;
    await post(setup, baseURL!, "/api/demo/persona", { persona: "moderator" });
    const queue = await (await setup.request.get(`${baseURL}/api/admin/moderation`)).json();
    ids = {
      frontDesk: find((j) => j.titleEn === "Front Desk Agent"),
      urgent: find((j) => j.urgency === "SAME_DAY"),
      housekeeper: find((j) => j.titleEn === "Housekeeper"),
      license: queue.items[0].id,
    };
    await setup.close();
  });

  test.afterAll(async () => {
    await Promise.all([...contexts.values()].map((c) => c.close()));
  });

  for (const lang of ["en", "am"] as Lang[]) {
    for (const screen of SCREENS) {
      test(`${screen.name} (${lang})`, async ({ browser, baseURL }) => {
        const key = `${screen.persona}:${lang}:${screen.phone ? "phone" : "desktop"}`;
        if (!contexts.has(key)) {
          const ctx = await openWindow(browser, baseURL!, lang, screen.phone ? "phone" : "desktop");
          if (screen.persona) {
            await post(ctx, baseURL!, "/api/demo/persona", { persona: screen.persona });
            await post(ctx, baseURL!, "/api/locale", { locale: lang });
          }
          contexts.set(key, ctx);
        }
        const page = await contexts.get(key)!.newPage();
        await page.goto(screen.path(ids), { waitUntil: "networkidle" });
        await screen.prepare?.(page);
        // Let entrance animations (toasts, sheets) settle so contrast is measured at rest.
        await page.waitForTimeout(400);
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        const summary = violations.map(
          (v) =>
            `${v.id} (${v.impact}): ${v.help}\n` +
            v.nodes
              .slice(0, 4)
              .map((n) => `    ${n.target.join(" ")} ${n.failureSummary?.split("\n")[1] ?? ""}`)
              .join("\n"),
        );
        expect(summary, summary.join("\n")).toEqual([]);
        await page.close();
      });
    }
  }
});
