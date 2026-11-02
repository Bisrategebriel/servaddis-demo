"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

// doc 04 §6.1: a slim "You're offline" banner on jobseeker routes.

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

export function OfflineBanner() {
  const t = useTranslations("feed");
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 bg-gray-700 px-4 py-1.5 text-small text-white"
    >
      <WifiOff className="size-4" aria-hidden />
      {t("offline")}
    </p>
  );
}
