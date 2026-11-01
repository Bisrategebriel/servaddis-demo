import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LangToggle } from "@/components/lang-toggle";
import { getCurrentUser } from "@/server/current-user";
import { MobileNav } from "./mobile-nav";
import { SidebarLinks, type NavItem } from "./nav-links";
import { SignOutButton } from "./sign-out-button";
import { SkipLink } from "./skip-link";

// Admin shell (doc 04 §4): navy-950 sidebar with an amber "Admin" tag, dense content.
// Desktop-first (≥ 1024 px); below md the nav moves into the sheet like the employer shell.

async function AdminAccount() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("common")]);
  if (!user) return null;
  return (
    <>
      <span className="hidden px-2 text-small font-medium sm:inline">{user.name}</span>
      <SignOutButton label={t("signOut")} />
    </>
  );
}

export async function AdminShell({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  const items: NavItem[] = [
    { href: "/admin/queue", label: t("nav.queue"), icon: "queue" },
    { href: "/admin/audit", label: t("nav.audit"), icon: "audit" },
  ];
  const nav = (
    <nav aria-label={t("shell.mainNav")}>
      <SidebarLinks items={items} rail={false} />
    </nav>
  );
  const brand = (
    <div className="flex items-center gap-2">
      <Wordmark />
      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-caption font-semibold text-navy-900">
        {t("shell.adminTag")}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-full flex-1">
      <SkipLink />
      <aside className="surface-navy sticky top-0 hidden h-screen w-62 shrink-0 flex-col gap-6 bg-navy-950 p-4 md:flex">
        <Link href="/admin/queue" aria-label={t("common.appName")}>
          {brand}
        </Link>
        {nav}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card px-2 sm:px-4">
          <MobileNav
            openLabel={t("shell.openMenu")}
            closeLabel={t("shell.closeMenu")}
            title={t("shell.mainNav")}
          >
            {nav}
          </MobileNav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LangToggle />
            <Suspense fallback={<span className="size-10" />}>
              <AdminAccount />
            </Suspense>
          </div>
        </header>
        <main id="main" className="w-full flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
