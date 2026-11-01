"use client";

import {
  BarChart3,
  Briefcase,
  CreditCard,
  Home,
  ListChecks,
  ScrollText,
  Send,
  Store,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Icons are looked up here because components can't be passed from Server to Client Components.
const ICONS = {
  home: Home,
  briefcase: Briefcase,
  users: Users,
  chart: BarChart3,
  card: CreditCard,
  store: Store,
  send: Send,
  user: User,
  queue: ListChecks,
  audit: ScrollText,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: NavIcon };

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

// usePathname is request data on routes with a dynamic id, so it must sit inside <Suspense>.
// The links themselves render in the static shell; only the active highlight waits for the URL.
function WithPathname({ render }: { render: (pathname: string) => ReactNode }) {
  return render(usePathname());
}

/** Sidebar links (employer/admin). `rail` = icon-only at 768–1023 px (doc 04 §4). */
export function SidebarLinks({ items, rail = true }: { items: NavItem[]; rail?: boolean }) {
  const list = (pathname: string) => <SidebarList items={items} rail={rail} pathname={pathname} />;
  return (
    <Suspense fallback={list("")}>
      <WithPathname render={list} />
    </Suspense>
  );
}

function SidebarList({
  items,
  rail,
  pathname,
}: {
  items: NavItem[];
  rail: boolean;
  pathname: string;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, i) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href, i === 0);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-lg px-3 text-small font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
                rail && "md:justify-center lg:justify-start",
              )}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className={cn(rail && "md:sr-only lg:not-sr-only")}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Jobseeker bottom navigation: 3 items, 24 px icons, ≥ 44 px targets (doc 04 §4). */
export function BottomNavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const nav = (pathname: string) => <BottomNav items={items} label={label} pathname={pathname} />;
  return (
    <Suspense fallback={nav("")}>
      <WithPathname render={nav} />
    </Suspense>
  );
}

function BottomNav({
  items,
  label,
  pathname,
}: {
  items: NavItem[];
  label: string;
  pathname: string;
}) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-[640px] grid-cols-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href, false);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-caption",
                  active ? "text-primary" : "text-text-secondary",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
