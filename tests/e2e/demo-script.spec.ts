import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  ErrorLog,
  MESSAGES,
  RECORD_DIR,
  SAMPLE_LICENSE,
  fmt,
  money,
  post,
  re,
  signIn,
  keepLanguage,
  openWindow,
  type Lang,
} from "./support";

// The demo script (App Flow §9, TRD §12) end to end, in both languages, from a fresh Reset:
// an Employer window, an Admin window and a phone, as on the presenter's laptop. Each row's
// "expected result" is asserted, including the ≤ 5 s live updates, contact-reveal gating,
// RBAC outcomes and the receipt's VAT.
//
// One deviation from the script: row 14 upgrades a Standard plan, but Selam's hotel is already
// on Pro, so that row runs as Henock (Piassa Terrace, Standard).

const FIVE_SECONDS = 5_000;

for (const lang of ["en", "am"] as Lang[]) {
  test.describe.serial(`demo script (${lang})`, () => {
    const m = MESSAGES[lang];
    const log = new ErrorLog();
    let employerCtx: BrowserContext;
    let adminCtx: BrowserContext;
    let phoneCtx: BrowserContext;
    let employer: Page;
    let admin: Page;
    let phone: Page;
    let cafeJobUrl = "";
    let frontDeskUrl = "";
    let base = "";

    /** The toolkit's persona switcher, as the presenter uses it. */
    async function switchPersona(persona: keyof typeof m.demo.persona) {
      await employer.getByRole("button", { name: m.demo.open }).click();
      await employer.getByRole("button", { name: m.demo.persona[persona] }).click();
      await employer.waitForLoadState("networkidle");
      await expect(employer.getByTestId("demo-panel")).toHaveCount(0);
      await keepLanguage(employer, lang);
    }

    test.beforeAll(async ({ browser, baseURL }) => {
      base = baseURL!;
      employerCtx = await openWindow(browser, baseURL!, lang, "desktop");
      await post(employerCtx, baseURL!, "/api/demo/reset");
      await post(employerCtx, baseURL!, "/api/locale", { locale: lang }); // Reset clears it
      adminCtx = await openWindow(browser, baseURL!, lang, "desktop");
      await post(adminCtx, baseURL!, "/api/demo/persona", { persona: "moderator" });
      await post(adminCtx, baseURL!, "/api/locale", { locale: lang });
      phoneCtx = await openWindow(browser, baseURL!, lang, "phone");
      employer = log.watch(await employerCtx.newPage(), "employer");
      admin = log.watch(await adminCtx.newPage(), "admin");
      phone = log.watch(await phoneCtx.newPage(), "phone");
    });

    test.afterAll(async () => {
      await Promise.all([employerCtx?.close(), adminCtx?.close(), phoneCtx?.close()]);
      // Recording (pnpm rehearse --record): a video file is final once its context is closed.
      if (RECORD_DIR) {
        for (const [name, page] of [
          ["employer", employer],
          ["admin", admin],
          ["phone", phone],
        ] as const) {
          await page?.video()?.saveAs(path.join(RECORD_DIR, `${lang}-${name}.webm`));
          await page?.video()?.delete();
        }
      }
    });

    test("1. Bruk registers with a phone number and code", async () => {
      await employer.goto("/");
      await employer.getByRole("link", { name: m.landing.hiring }).click();
      await employer.waitForURL(/\/login/);
      await signIn(employer, "0911000011");
      await employer.waitForURL(/\/employer\/onboarding\/venue/);
    });

    test("2. Bole Sunrise Café is set up", async () => {
      await employer.locator("#nameEn").waitFor();
      await employer.waitForLoadState("networkidle");
      await employer.fill("#ownerName", "Bruk Tilahun");
      await employer.fill("#nameEn", "Bole Sunrise Café");
      await employer.selectOption("#category", "CAFE");
      await employer.selectOption("#subCity", "bole");
      await employer.getByRole("button", { name: m.venue.save }).click();
      await employer.waitForURL(/\/employer\/onboarding\/license/);
    });

    test("3. The license upload leaves the venue pending, checklist 3 of 4", async () => {
      await employer.waitForLoadState("networkidle");
      await employer.setInputFiles("input[type=file]", SAMPLE_LICENSE);
      await employer.getByRole("link", { name: m.license.toDashboard }).click();
      await employer.waitForURL(/\/employer$/);
      await expect(employer.getByTestId("checklist-progress")).toContainText("3");
      await expect(employer.getByTestId("checklist-progress")).toContainText("4");
      await expect(employer.getByTestId("verification")).toContainText(
        m.dashboard.verification.PENDING,
      );
    });

    test("4. The admin approves; the employer sees Verified and the bell within 5 s", async () => {
      await admin.goto("/admin/queue");
      await admin.getByRole("link", { name: "Bole Sunrise Café" }).click();
      await admin.getByRole("button", { name: m.moderation.approve, exact: true }).click();
      await expect(employer.getByTestId("verification")).toContainText(
        m.dashboard.verification.VERIFIED,
        { timeout: FIVE_SECONDS },
      );
      await expect(employer.getByTestId("bell-count")).toBeVisible({ timeout: FIVE_SECONDS });
    });

    test("5. A Barista post from the template, previewed in Amharic", async () => {
      await employer.getByRole("link", { name: m.dashboard.postFirstJob }).click();
      await employer.locator('a[href*="template=barista"]').first().click();
      await employer.waitForURL(/compose\?template=barista/);
      await employer.waitForLoadState("networkidle");
      const cont = employer.getByRole("button", { name: m.jobs.composer.continue, exact: true });
      await cont.click();
      await cont.click();
      await employer.getByLabel(m.jobs.composer.salaryMin).fill("6000");
      await employer.getByLabel(m.jobs.composer.salaryMax).fill("9500");
      await cont.click();
      const preview = employer.getByTestId("job-preview");
      await preview.getByRole("button", { name: "አማ (አማርኛ)", exact: true }).click();
      await expect(preview.locator("article")).toHaveAttribute("lang", "am");
      await expect(preview.locator("article")).toContainText("ባሪስታ");
      await expect(employer.getByText(m.jobs.rules.noIssues)).toBeVisible();
    });

    test("6. The fee sentence is blocked; removed, the job goes to review", async () => {
      // English page: the English description; Amharic page: the Amharic one.
      const [tab, phrase] =
        lang === "en"
          ? [/^EN \(English\):/, " Registration fee ETB 200 on your first day."]
          : [/^አማ \(አማርኛ\):/, " የምዝገባ ክፍያ 200 ብር"];
      await employer.getByRole("button", { name: re(m.jobs.composer.steps.basics) }).click();
      await employer.getByRole("button", { name: tab }).nth(1).click();
      const description = employer.getByRole("textbox", { name: re(m.jobs.composer.description) });
      const original = await description.inputValue();
      await description.fill(original + phrase);

      const submit = employer.getByRole("button", { name: m.jobs.composer.submit.button });
      const cont = employer.getByRole("button", { name: m.jobs.composer.continue, exact: true });
      while (!(await submit.isVisible())) await cont.click();
      const block = employer.locator('[data-testid="rule-flags"] li[data-severity="block"]');
      await expect(block).toHaveCount(1);
      await expect(submit).toBeDisabled();

      await block.getByRole("button", { name: m.jobs.rules.fix }).click();
      await expect(description).toBeFocused();
      await description.fill(original);
      while (!(await submit.isVisible())) await cont.click();
      await expect(employer.getByText(m.jobs.rules.noIssues)).toBeVisible();
      await submit.click();
      await employer.waitForURL(/\/employer\/jobs\/[a-z0-9]+$/);
      cafeJobUrl = new URL(employer.url()).pathname;
      await expect(employer.getByTestId("job-status")).toHaveText(m.jobs.status.PENDING_REVIEW);
    });

    test("7. The admin approves the job; it is live and on the phone's feed", async () => {
      await admin.goto("/admin/queue");
      await admin.getByRole("tab", { name: re(m.moderation.jobs) }).click();
      await admin.getByRole("link").filter({ hasText: "Bole Sunrise Café" }).click();
      await admin.getByRole("button", { name: m.moderation.approve, exact: true }).click();
      await admin.waitForURL(/\/admin\/queue$/);
      await employer.goto(cafeJobUrl);
      await expect(employer.getByTestId("job-status")).toHaveAttribute("data-status", "LIVE");
      await phone.goto("/jobs");
      await expect(
        phone.getByTestId("feed").locator("li").filter({ hasText: "Bole Sunrise Café" }),
      ).toHaveCount(1);
    });

    test("8. Dawit applies in one tap; the employer's toast arrives within 5 s", async () => {
      await phone
        .getByTestId("feed")
        .locator("li")
        .filter({ hasText: "Bole Sunrise Café" })
        .click();
      await phone.getByRole("link", { name: m.apply.signIn }).click();
      await phone.waitForURL(/\/login/);
      await signIn(phone, "0922000001");
      await phone.waitForURL((u) => u.pathname === cafeJobUrl.replace("/employer", ""));
      await keepLanguage(phone, lang);
      // The employer's bell has taken its first poll (history) by now; the toast is news.
      await employer.waitForTimeout(4_500);
      await phone.getByRole("button", { name: m.apply.button, exact: true }).click();
      await expect(phone.getByRole("status").filter({ hasText: m.apply.applied })).toBeVisible();
      await expect(employer.getByTestId("live-toast")).toBeVisible({ timeout: FIVE_SECONDS });
    });

    test("9. View, reveal gated until shortlist, hire; the job closes and the phone updates", async () => {
      await employer.goto(`${cafeJobUrl}/applicants`);
      await employer.getByTestId("applicant").filter({ hasText: "Dawit" }).click();
      const drawer = employer.getByTestId("drawer");
      await drawer.getByRole("heading", { name: /Dawit Alemu/ }).waitFor();
      await expect(drawer.getByRole("button", { name: m.drawer.reveal })).toBeDisabled();
      await drawer.getByRole("button", { name: m.drawer.shortlist, exact: true }).click();
      await drawer.getByRole("button", { name: m.drawer.reveal }).click();
      await expect(drawer.getByTestId("phone")).toContainText("92 200 0001");
      await drawer.getByRole("button", { name: m.drawer.hire, exact: true }).click();
      await expect(drawer.getByTestId("job-filled")).toBeVisible();

      await phone.goto("/me/applications");
      await expect(phone.locator('[data-status="HIRED"]')).toBeVisible({ timeout: FIVE_SECONDS });
      await employer.goto(cafeJobUrl);
      await expect(employer.getByTestId("job-status")).toHaveAttribute("data-status", "CLOSED");
      await expect(employer.getByTestId("time-to-fill")).toBeVisible();
    });

    test("10. Selam's team: Yared is a Poster, Rahel a Screener; one permission toggled", async () => {
      await switchPersona("selam");
      await employer.goto("/employer/team");
      const team = employer.getByTestId("team");
      await expect(team.locator('li[data-member="Yared Alemu"]')).toContainText(m.roles.POSTER);
      await expect(team.locator('li[data-member="Rahel Mekonnen"]')).toContainText(
        m.roles.SCREENER,
      );
      await team.locator('li[data-member="Rahel Mekonnen"]').getByRole("button").first().click();
      await employer
        .getByTestId("matrix")
        .getByRole("switch", { name: m.permissions.keys.insights.view })
        .click();
      await employer.getByRole("button", { name: m.team.save, exact: true }).click();
      await expect(employer.getByText(m.team.saved)).toBeVisible();
      await expect(team.locator('li[data-member="Rahel Mekonnen"]')).toContainText(
        m.team.customised,
      );

      await employer.goto("/employer/jobs");
      const frontDesk = lang === "en" ? "Front Desk Agent" : "የፊት ጽ/ቤት ሠራተኛ";
      await employer.getByRole("link").filter({ hasText: frontDesk }).first().click();
      await employer.waitForURL(/\/employer\/jobs\/[a-z0-9]+$/);
      frontDeskUrl = new URL(employer.url()).pathname;
    });

    test("11. Yared: jobs yes, applicants and billing no (403 page)", async () => {
      await switchPersona("yared");
      await employer.goto("/employer/jobs");
      await expect(employer.getByRole("link", { name: m.jobs.list.post })).toBeVisible();
      const nav = employer.getByRole("navigation", { name: m.shell.mainNav }).first();
      await expect(nav.getByRole("link", { name: m.nav.plans })).toHaveCount(0);
      await employer.goto(`${frontDeskUrl}/applicants`);
      await expect(employer.getByTestId("forbidden")).toBeVisible();
      await employer.goto("/employer/plans");
      await expect(employer.getByTestId("forbidden")).toBeVisible();
    });

    test("12. Rahel: applicants yes, New job hidden", async () => {
      await switchPersona("rahel");
      await employer.goto("/employer/jobs");
      await expect(employer.getByRole("link", { name: m.jobs.list.post })).toHaveCount(0);
      await employer.goto(`${frontDeskUrl}/applicants`);
      await expect(employer.getByTestId("applicant").first()).toBeVisible();
      await expect(employer.getByTestId("forbidden")).toHaveCount(0);
    });

    test("13. Selam promotes a live job: card, four channels, Simulated tags", async () => {
      await switchPersona("selam");
      await employer.goto(frontDeskUrl);
      await employer.getByRole("link", { name: m.jobs.overview.promoteLink, exact: true }).click();
      await employer.waitForURL(/\/promote$/);
      await expect(employer.getByTestId("card-preview")).toBeVisible();
      await employer.getByRole("button", { name: m.promote.promote, exact: true }).click();
      const publishLog = employer.getByTestId("publish-log");
      await expect(
        publishLog.locator('li[data-channel="TIKTOK"][data-status="DRAFT_FOR_TEAM"]'),
      ).toBeVisible({ timeout: 20_000 });
      await expect(publishLog.locator("li")).toHaveCount(4);
      await expect(publishLog.locator("[data-simulated]")).toHaveCount(4);
    });

    test("14. A Standard owner upgrades to Pro, pays, gets a VAT receipt; Promote unlocks", async () => {
      await employerCtx.clearCookies();
      await post(employerCtx, base, "/api/locale", { locale: lang });
      await employer.goto("/login");
      await signIn(employer, "0911000005"); // Henock, Piassa Terrace (Standard)
      await employer.waitForURL(/\/employer$/);
      await keepLanguage(employer, lang);
      await employer.goto("/employer/plans");
      const plans = employer.getByTestId("plans");
      await expect(plans.locator('[data-plan="STANDARD"]')).toContainText(m.plans.current);
      await expect(plans.locator('[data-plan="STANDARD"] [data-locked="social"]')).toHaveCount(1);
      await plans.locator('[data-plan="PRO"]').getByRole("button").click();
      await employer.waitForURL(/\/sim\/chapa\//);
      await expect(employer.getByTestId("total")).toHaveText(money(4025, lang));
      await employer.getByRole("button", { name: fmt(m.checkout.pay, { total: "4,025" }) }).click();
      await employer.waitForURL(/\/employer\/payments\//);
      await expect(employer.getByTestId("receipt-no")).toHaveText(/^SVD-\d{4}-\d{6}$/);
      await expect(employer.getByTestId("vat")).toHaveText(money(525, lang));
      await expect(employer.getByTestId("receipt-total")).toHaveText(money(4025, lang));

      await employer.goto("/employer/jobs");
      await employer.getByTestId("jobs-list").getByRole("link").first().click();
      await employer.waitForURL(/\/employer\/jobs\/[a-z0-9]+$/);
      await employer.goto(`${new URL(employer.url()).pathname}/promote`);
      await expect(employer.getByTestId("promote-locked")).toHaveCount(0);
      await expect(
        employer.getByRole("button", { name: m.promote.promote, exact: true }),
      ).toBeVisible();
    });

    test("15. Insights: time-to-fill trend and funnel from the seeded history", async () => {
      await employerCtx.clearCookies();
      await post(employerCtx, base, "/api/demo/persona", {
        persona: "selam",
      });
      await post(employerCtx, base, "/api/locale", { locale: lang });
      await employer.goto("/employer/insights");
      await expect(employer.getByTestId("headline")).toBeVisible();
      await expect(employer.getByTestId("funnel")).toBeVisible();
    });

    test("no page errors or server errors anywhere in the run", () => {
      expect(log.errors).toEqual([]);
    });
  });
}
