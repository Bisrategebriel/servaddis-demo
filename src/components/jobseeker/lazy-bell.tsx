"use client";

import dynamic from "next/dynamic";

// The bell (Radix popover, SWR, class merger) loads after the page for signed-in jobseekers, so
// it never counts against the jobseeker first-load budget (TRD §8).
const NotificationBell = dynamic(
  () => import("../shell/notification-bell").then((m) => m.NotificationBell),
  { ssr: false },
);

export function LazyBell({ initialCount }: { initialCount: number }) {
  return <NotificationBell initialCount={initialCount} surface="navy" />;
}
