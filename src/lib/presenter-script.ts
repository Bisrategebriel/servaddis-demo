// Presenter mode (doc 04 §8), the part the server needs: the storage key and the inline script.
// Kept apart from the client hook in ./presenter so the root layout imports no client code.

export const PRESENTER_KEY = "sv-presenter";

/**
 * Inlined at the top of <body> so the attribute is set before first paint (no flash of the
 * small UI), and kept in sync when another window of the same browser flips the toggle.
 */
export const presenterScript = `(function(){var k=${JSON.stringify(PRESENTER_KEY)},d=document.documentElement;function a(){try{localStorage.getItem(k)==="1"?d.setAttribute("data-presenter",""):d.removeAttribute("data-presenter")}catch(e){}}a();addEventListener("storage",function(e){if(e.key===k)a()})})();`;
