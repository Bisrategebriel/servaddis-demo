import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LazyBell } from "@/components/jobseeker/lazy-bell";
import { OfflineBanner } from "@/components/jobseeker/offline-banner";
import { LangToggle } from "@/components/lang-toggle";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/current-user";
import { db } from "@/server/db";
import { BottomNavLinks } from "./nav-links";
import { SkipLink } from "./skip-link";

// Jobseeker / public shell (doc 04 §4): navy top bar with the reversed wordmark and language
// toggle, a single column designed at 360 px (640 px max), optional bottom navigation.
/** Signed-in jobseekers see their notifications (shortlisted, hired…, doc 03 §10). */
async function JobseekerBell() {
  const user = await getCurrentUser();
  if (user?.platformRole !== "JOBSEEKER") return null;
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return <LazyBell initialCount={unread} />;
}

export async function JobseekerShell({
  children,
  bottomNav = false,
}: {
  children: ReactNode;
  bottomNav?: boolean;
}) {
  const t = await getTranslations();
  return (
    <>
      <SkipLink />
      <header className="surface-navy sticky top-0 z-30 bg-navy-900">
        <div className="mx-auto flex h-14 max-w-[640px] items-center justify-between px-4">
          <Link href="/" aria-label={t("common.appName")}>
            <Wordmark />
          </Link>
          <div className="flex items-center gap-1">
            <Suspense fallback={null}>
              <JobseekerBell />
            </Suspense>
            <LangToggle surface="navy" />
          </div>
        </div>
        <OfflineBanner />
      </header>
      <main
        id="main"
        className={cn("mx-auto w-full max-w-[640px] flex-1 px-4 py-6", bottomNav && "pb-24")}
      >
        {children}
      </main>
      {bottomNav && (
        <BottomNavLinks
          label={t("shell.mainNav")}
          items={[
            { href: "/jobs", label: t("nav.findJobs"), icon: "briefcase" },
            { href: "/me/applications", label: t("nav.myApplications"), icon: "send" },
            { href: "/me/profile", label: t("nav.profile"), icon: "user" },
          ]}
        />
      )}
    </>
  );
}
