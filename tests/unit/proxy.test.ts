import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { signSessionToken } from "@/server/session";

const BASE = "http://localhost:3000";
const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";
/** Internal path a page request was rewritten to, e.g. "/en/employer". */
const rewrittenTo = (res: Response) => {
  const target = res.headers.get("x-middleware-rewrite");
  return target ? new URL(target).pathname + new URL(target).search : null;
};

async function withSession(role: "EMPLOYER" | "JOBSEEKER" | "ADMIN") {
  return `sv_session=${await signSessionToken({ userId: "u1", role })}`;
}

describe("proxy", () => {
  afterEach(() => {
    process.env.DEMO_MODE = "1";
  });

  it("hides demo endpoints unless DEMO_MODE=1", async () => {
    process.env.DEMO_MODE = "0";
    const res = await proxy(new NextRequest(`${BASE}/api/demo/reset`, { method: "GET" }));
    expect(res.status).toBe(404);
    process.env.DEMO_MODE = "1";
    expect(passes(await proxy(new NextRequest(`${BASE}/api/demo/reset`)))).toBe(true);
  });

  it("blocks cross-origin or origin-less mutations on the API", async () => {
    const post = (headers: Record<string, string>) =>
      proxy(new NextRequest(`${BASE}/api/auth/otp/request`, { method: "POST", headers }));
    expect((await post({})).status).toBe(403);
    expect((await post({ origin: "https://evil.example" })).status).toBe(403);
    expect(passes(await post({ origin: BASE }))).toBe(true);
    expect(passes(await post({ referer: `${BASE}/login` }))).toBe(true);
    // Cloudflare tunnel: browser origin is the tunnel host, forwarded to localhost
    expect(
      passes(
        await post({
          origin: "https://abc.trycloudflare.com",
          "x-forwarded-host": "abc.trycloudflare.com",
        }),
      ),
    ).toBe(true);
  });

  it("lets safe API methods through without an origin", async () => {
    expect(passes(await proxy(new NextRequest(`${BASE}/api/health`)))).toBe(true);
  });

  it("sends signed-out visitors to /login with a return path", async () => {
    const res = await proxy(new NextRequest(`${BASE}/employer/jobs?tab=live`));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/employer/jobs?tab=live");
  });

  it("redirects a signed-in user out of another role's area", async () => {
    const cookie = await withSession("JOBSEEKER");
    const res = await proxy(new NextRequest(`${BASE}/admin/queue`, { headers: { cookie } }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/jobs");
  });

  it("lets the right role into its area", async () => {
    const cookie = await withSession("EMPLOYER");
    const res = await proxy(new NextRequest(`${BASE}/employer`, { headers: { cookie } }));
    expect(rewrittenTo(res)).toBe("/en/employer");
  });

  it("treats a forged cookie as signed out", async () => {
    const res = await proxy(
      new NextRequest(`${BASE}/me/applications`, { headers: { cookie: "sv_session=forged" } }),
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});

describe("proxy locale handling (App Flow §12)", () => {
  const page = (path: string, cookie?: string) =>
    proxy(new NextRequest(`${BASE}${path}`, { headers: cookie ? { cookie } : {} }));

  it("defaults public and jobseeker pages to Amharic", async () => {
    expect(rewrittenTo(await page("/"))).toBe("/am");
    expect(rewrittenTo(await page("/jobs?sub=bole"))).toBe("/am/jobs?sub=bole");
    expect(rewrittenTo(await page("/login"))).toBe("/am/login");
  });

  it("defaults employer and admin pages to English", async () => {
    const employer = await withSession("EMPLOYER");
    expect(rewrittenTo(await page("/employer/team", employer))).toBe("/en/employer/team");
    const admin = await withSession("ADMIN");
    expect(rewrittenTo(await page("/admin/queue", admin))).toBe("/en/admin/queue");
  });

  it("lets the saved choice win over the default", async () => {
    expect(rewrittenTo(await page("/jobs", "sv_locale=en"))).toBe("/en/jobs");
    const employer = await withSession("EMPLOYER");
    expect(rewrittenTo(await page("/employer", `${employer}; sv_locale=am`))).toBe("/am/employer");
  });

  it("ignores an invalid saved value", async () => {
    expect(rewrittenTo(await page("/jobs", "sv_locale=fr"))).toBe("/am/jobs");
  });

  it("turns a prefixed link into the clean URL and remembers the language", async () => {
    const res = await page("/en/jobs/abc?x=1");
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname + location.search).toBe("/jobs/abc?x=1");
    expect(res.headers.get("set-cookie")).toMatch(/sv_locale=en;.*Path=\//i);
    expect(new URL((await page("/am")).headers.get("location")!).pathname).toBe("/");
  });

  it("leaves API routes un-rewritten", async () => {
    const res = await page("/api/health");
    expect(passes(res)).toBe(true);
    expect(rewrittenTo(res)).toBeNull();
  });
});
