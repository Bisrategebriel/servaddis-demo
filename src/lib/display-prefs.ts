// Per-browser display settings from the Demo Toolkit (doc 04 §8, TRD §5.10), the part the server
// needs: the storage keys and the inline script. Each is kept in localStorage and mirrored to an
// attribute on <html> so CSS can act on it. Browser-only settings keep every page static (no
// cookie read on the server) and follow the presenter across persona switches and Reset.
// The client hook lives in ./display-prefs-client, so the root layout imports no client code.

export const DISPLAY_PREFS = {
  /** Larger text, stronger contrast, quieter toolkit. */
  presenter: { key: "sv-presenter", attr: "data-presenter" },
  /** Hides the gray "Simulated" tags (App Flow §8, PRD X-03). */
  hideSimulated: { key: "sv-hide-simulated", attr: "data-hide-simulated" },
} as const;

export type DisplayPref = keyof typeof DISPLAY_PREFS;

/**
 * Inlined at the top of <body> so the attributes are set before first paint (no flash), and kept
 * in sync when another window of the same browser flips a toggle.
 */
export const displayPrefsScript = `(function(){var p=${JSON.stringify(Object.values(DISPLAY_PREFS))},d=document.documentElement;function a(){p.forEach(function(x){try{localStorage.getItem(x.key)==="1"?d.setAttribute(x.attr,""):d.removeAttribute(x.attr)}catch(e){}})}a();addEventListener("storage",function(e){if(p.some(function(x){return x.key===e.key}))a()})})();`;
