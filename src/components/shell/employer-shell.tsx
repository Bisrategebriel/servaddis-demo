import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LangToggle } from "@/components/lang-toggle";
import type { VenuePermission } from "@/lib/permissions";
import { getEmployerContext } from "@/server/current-user";
import { MobileNav } from "./mobile-nav";
import { SidebarLinks, type NavIcon, type NavItem } from "./nav-links";
import { NotificationBell } from "./notification-bell";
import { SignOutButton } from "./sign-out-button";
import { SkipLink } from "./skip-link";

// Employer shell (doc 04 §4): navy sidebar (248 px ≥ 1024, icon rail 768–1023, sheet < 768),
// white top bar with language toggle, bell and account. Nav items follow the member's
// permissions; hiding is cosmetic, the API enforces (T0.5).

const ITEMS: { href: string; key: string; icon: NavIcon; perm?: VenuePermission }[] = [
  { href: "/employer", key: "dashboard", icon: "home" },
  { href: "/employer/jobs", key: "jobs", icon: "briefcase", perm: "job.view" },
  { href: "/employer/team", key: "team", icon: "users", perm: "team.manage" },
  { href: "/employer/insights", key: "insights", icon: "chart", perm: "insights.view" },
  { href: "/employer/plans", key: "plans", icon: "card", perm: "billing.manage" },
  { href: "/employer/venue", key: "venue", icon: "store", perm: "venue.edit" },
];

async function EmployerNav({ rail }: { rail: boolean }) {
  const [ctx, t, s] = await Promise.all([
    getEmployerContext(),
    getTranslations("nav"),
    getTranslations("shell"),
  ]);
  // No venue yet (onboarding): nothing to navigate to.
  if (!ctx?.membership) return null;
  const perms = ctx.membership.permissions;
  const items: NavItem[] = ITEMS.filter((i) => !i.perm || perms.has(i.perm)).map((i) => ({
    href: i.href,
    label: t(i.key as "dashboard"),
    icon: i.icon,
  }));
  return (
    <nav aria-label={s("mainNav")}>
      <SidebarLinks items={items} rail={rail} />
    </nav>
  );
}

async function VenueBadge() {
  const [ctx, t, locale] = await Promise.all([
    getEmployerContext(),
    getTranslations("roles"),
    getLocale(),
  ]);
  if (!ctx?.membership) return null;
  const m = ctx.membership;
  const name = locale === "am" && m.venueNameAm ? m.venueNameAm : m.venueNameEn;
  return (
    <div className="mt-auto hidden border-t border-sidebar-border pt-3 lg:block">
      <p className="truncate text-small font-semibold text-white">{name}</p>
      <p className="text-caption text-navy-300">{t(m.role as "OWNER")}</p>
    </div>
  );
}

async function Account() {
  const [ctx, t] = await Promise.all([getEmployerContext(), getTranslations("common")]);
  if (!ctx) return null;
  return (
    <>
      <NotificationBell count={ctx.unreadCount} />
      <span className="hidden max-w-40 truncate px-2 text-small font-medium sm:inline">
        {ctx.user.name}
      </span>
      <SignOutButton label={t("signOut")} />
    </>
  );
}

const NavSkeleton = () => (
  <div className="flex flex-col gap-2" aria-hidden>
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="h-10 animate-pulse rounded-lg bg-sidebar-accent/50" />
    ))}
  </div>
);

export async function EmployerShell({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="flex min-h-full flex-1">
      <SkipLink />
      <aside className="surface-navy sticky top-0 hidden h-screen shrink-0 flex-col gap-6 bg-sidebar p-3 md:flex md:w-16 lg:w-62 lg:p-4">
        <Link href="/employer" aria-label={t("common.appName")} className="md:mx-auto lg:mx-0">
          <Wordmark labelClassName="md:sr-only lg:not-sr-only" />
        </Link>
        <Suspense fallback={<NavSkeleton />}>
          <EmployerNav rail />
        </Suspense>
        <Suspense fallback={null}>
          <VenueBadge />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card px-2 sm:px-4">
          <MobileNav
            openLabel={t("shell.openMenu")}
            closeLabel={t("shell.closeMenu")}
            title={t("shell.mainNav")}
          >
            <Suspense fallback={<NavSkeleton />}>
              <EmployerNav rail={false} />
            </Suspense>
          </MobileNav>
          <Link href="/employer" className="md:hidden" aria-label={t("common.appName")}>
            <Image src="/icons/servaddis-icon.svg" alt="" width={32} height={32} />
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LangToggle />
            <Suspense fallback={<span className="size-10" />}>
              <Account />
            </Suspense>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
