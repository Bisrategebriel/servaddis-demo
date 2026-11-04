import { expect, test, type BrowserContext } from "@playwright/test";
import { ErrorLog, MESSAGES, keepLanguage, openWindow, post, type Lang } from "./support";

// SCR-E16 venue profile (PRD E-02): an owner edits the venue and sees its verification; a new,
// unverified owner is sent to upload a license; other roles get the 403 page.

for (const lang of ["en", "am"] as Lang[]) {
  test.describe.serial(`venue profile (${lang})`, () => {
    const m = MESSAGES[lang];
    const log = new ErrorLog();
    let ctx: BrowserContext;
    let base = "";

    test.beforeAll(async ({ browser, baseURL }) => {
      base = baseURL!;
      ctx = await openWindow(browser, base, lang, "desktop");
      await post(ctx, base, "/api/demo/reset");
    });
    test.afterAll(async () => ctx?.close());

    async function as(persona: string) {
      await ctx.clearCookies();
      await post(ctx, base, "/api/demo/persona", { persona });
      await post(ctx, base, "/api/locale", { locale: lang });
    }

    test("Selam edits the venue; it survives a reload and shows in the sidebar", async () => {
      await as("selam");
      const page = log.watch(await ctx.newPage(), "selam");
      await page.goto("/employer/venue");
      await keepLanguage(page, lang);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.venueProfile.title);
      await expect(page.getByTestId("verification")).toHaveAttribute("data-status", "VERIFIED");
      await expect(page.getByTestId("venue-verification")).toContainText(
        m.venueProfile.notes.VERIFIED,
      );

      const form = page.getByTestId("venue-form");
      await expect(form.getByLabel(m.venue.nameEn)).toHaveValue("Hiwot Garden Hotel");
      await form.getByLabel(m.venue.nameAm).fill("ሕይወት ጋርደን ሆቴል");
      await form.getByLabel(m.venue.descriptionEn).fill("Garden hotel in Bole, 60 rooms.");
      await form.getByLabel(m.venue.descriptionAm).fill("");
      await form.getByRole("button", { name: m.venue.saveChanges }).click();
      await expect(form.getByRole("status")).toHaveText(m.venue.saved);

      await page.reload();
      await expect(form.getByLabel(m.venue.descriptionEn)).toHaveValue(
        "Garden hotel in Bole, 60 rooms.",
      );
      await expect(form.getByLabel(m.venue.descriptionAm)).toHaveValue("");
      // The sidebar names the venue in the page language.
      await expect(page.locator("aside").first()).toContainText(
        lang === "am" ? "ሕይወት ጋርደን ሆቴል" : "Hiwot Garden Hotel",
      );
    });

    test("an invalid edit shows the field error and saves nothing", async () => {
      const page = log.watch(await ctx.newPage(), "selam-invalid");
      await page.goto("/employer/venue");
      const form = page.getByTestId("venue-form");
      await form.getByLabel(m.venue.nameEn).fill("");
      await form.getByRole("button", { name: m.venue.saveChanges }).click();
      await expect(form.getByText(m.venue.errors.nameEn)).toBeVisible();
      await page.reload();
      await expect(form.getByLabel(m.venue.nameEn)).toHaveValue("Hiwot Garden Hotel");
    });

    test("a new, unverified owner is pointed to the license upload", async () => {
      // Skip to state: venue created and verified is the toolkit's earliest step, so create
      // Bruk's venue through the real API instead and leave it unsubmitted.
      await as("bruk");
      await post(ctx, base, "/api/venues", {
        ownerName: "Bruk Tilahun",
        nameEn: "Bole Sunrise Café",
        category: "CAFE",
        subCity: "bole",
        contactPhone: "0911000011",
      });
      const page = log.watch(await ctx.newPage(), "bruk");
      await page.goto("/employer/venue");
      await keepLanguage(page, lang);
      await expect(page.getByTestId("verification")).toHaveAttribute("data-status", "UNSUBMITTED");
      await expect(page.getByText(m.venueProfile.noLicense)).toBeVisible();
      await page.getByRole("link", { name: m.venueProfile.upload }).click();
      await page.waitForURL(/\/employer\/onboarding\/license$/);
    });

    test("a Poster gets the 403 page, and there is no Venue link in the nav", async () => {
      await as("yared");
      const page = log.watch(await ctx.newPage(), "yared");
      await page.goto("/employer/venue");
      await expect(page.getByTestId("forbidden")).toBeVisible();
      const nav = page.getByRole("navigation", { name: m.shell.mainNav }).first();
      await expect(nav.getByRole("link", { name: m.nav.venue })).toHaveCount(0);
    });

    test("no page errors or server errors", () => {
      expect(log.errors).toEqual([]);
    });
  });
}
