import { useSyncExternalStore } from "react";
import { DISPLAY_PREFS, type DisplayPref } from "./display-prefs";

// Client side of the toolkit display settings (see ./display-prefs).

const ATTRS = Object.values(DISPLAY_PREFS).map((p) => p.attr);

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ATTRS });
  return () => observer.disconnect();
}

/** Whether a display setting is on in this browser; re-renders when it changes. */
export function useDisplayPref(name: DisplayPref) {
  const { attr } = DISPLAY_PREFS[name];
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.hasAttribute(attr),
    () => false,
  );
}

export const usePresenter = () => useDisplayPref("presenter");

export function setDisplayPref(name: DisplayPref, on: boolean) {
  const { key, attr } = DISPLAY_PREFS[name];
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // Storage blocked (private mode): the setting still applies to this page.
  }
  document.documentElement.toggleAttribute(attr, on);
}
