import { useSyncExternalStore } from "react";
import { PRESENTER_KEY } from "./presenter-script";

// Presenter mode (doc 04 §8): a per-browser setting, kept in localStorage and mirrored to
// <html data-presenter> so CSS can scale the whole UI. A browser-only setting keeps every page
// static (no cookie read on the server) and follows the presenter across persona switches.

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-presenter"] });
  return () => observer.disconnect();
}

const read = () => document.documentElement.hasAttribute("data-presenter");

/** Whether presenter mode is on in this browser; re-renders when it changes. */
export function usePresenter() {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function setPresenter(on: boolean) {
  try {
    if (on) localStorage.setItem(PRESENTER_KEY, "1");
    else localStorage.removeItem(PRESENTER_KEY);
  } catch {
    // Storage blocked (private mode): the setting still applies to this page.
  }
  document.documentElement.toggleAttribute("data-presenter", on);
}
