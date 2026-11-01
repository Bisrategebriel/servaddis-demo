import type { PlatformRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, defaultLocaleFor, isLocale, localeCookie } from "./i18n/locales";
import { AppError } from "./server/http/errors";
import { SESSION_COOKIE, isSecureRequest, verifySessionToken } from "./server/session";

// Next 16 "proxy" (formerly middleware). Optimistic checks only: it reads cookies, never the
// database (Next authentication guide). Every route handler still enforces auth itself.
//   API:   /api/demo/* is 404 unless DEMO_MODE=1 · mutating requests must be same-origin
//   Pages: role areas redirect when signed out / in the wrong area, then the URL is rewritten
//          to /{locale}/… so app/[locale] renders it. URLs stay unprefixed (doc 03 routes).

const AREAS: { prefix: string; role: PlatformRole }[] = [
  { prefix: "/employer", role: "EMPLOYER" },
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/me", role: "JOBSEEKER" },
];

// Without a DB lookup, employers go to /employer; that page sends venue-less users to onboarding.
const HOME: Record<PlatformRole, string> = {
  ADMIN: "/admin/queue",
  EMPLOYER: "/employer",
  JOBSEEKER: "/jobs",
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function errorJson(err: AppError) {
  return NextResponse.json(err.toBody(), { status: err.status });
}

/** Hosts this request may legitimately come from: Host, X-Forwarded-Host, PUBLIC_BASE_URL. */
function allowedHosts(req: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const add = (h?: string | null) => h && hosts.add(h.split(",")[0].trim().toLowerCase());
  add(req.headers.get("host"));
  add(req.headers.get("x-forwarded-host"));
  try {
    if (process.env.PUBLIC_BASE_URL) add(new URL(process.env.PUBLIC_BASE_URL).host);
  } catch {
    // ignore a malformed PUBLIC_BASE_URL
  }
  return hosts;
}

function isSameOrigin(req: NextRequest): boolean {
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!source || source === "null") return false;
  try {
    return allowedHosts(req).has(new URL(source).host.toLowerCase());
  } catch {
    return false;
  }
}

function handleApi(req: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/demo") && process.env.DEMO_MODE !== "1") {
    return errorJson(new AppError("NOT_FOUND"));
  }
  if (!SAFE_METHODS.has(req.method) && !isSameOrigin(req)) {
    return errorJson(
      new AppError("FORBIDDEN", {
        message: "This request must come from the Servaddis app.",
        messageAm: "ይህ ጥያቄ ከServaddis መተግበሪያ መምጣት አለበት።",
        details: { reason: "CROSS_ORIGIN" },
      }),
    );
  }
  return NextResponse.next();
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) return handleApi(req, pathname);

  // /am/jobs or /en/jobs: remember the language and continue on the unprefixed URL.
  const prefixed = /^\/(am|en)(\/.*)?$/.exec(pathname);
  if (prefixed) {
    const res = NextResponse.redirect(new URL((prefixed[2] ?? "/") + search, req.url));
    res.cookies.set(localeCookie(prefixed[1] as "am" | "en", isSecureRequest(req)));
    return res;
  }

  const area = AREAS.find((a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`));
  if (area) {
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const login = new URL("/login", req.url);
      login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
    if (session.role !== area.role) {
      return NextResponse.redirect(new URL(HOME[session.role], req.url));
    }
  }

  const saved = req.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : defaultLocaleFor(pathname);
  return NextResponse.rewrite(
    new URL(`/${locale}${pathname === "/" ? "" : pathname}${search}`, req.url),
  );
}

export const config = {
  // Everything except Next internals and files with an extension (icons, avatars, fonts).
  matcher: ["/((?!_next/|.*\\.[^/]+$).*)"],
};
