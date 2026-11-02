"use client";

import { useEffect } from "react";

// Registers /sw.js in production builds only: in development a service worker would serve stale
// assets between edits. Failure is harmless (the app simply isn't installable offline).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
