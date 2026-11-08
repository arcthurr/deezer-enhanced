/*
 * Better Deezer page bridge (extension only, runs in the page's own world).
 * The extension's main script runs in an isolated world and cannot see Deezer's
 * player object. This bridge answers one question: which track is playing.
 * It reads nothing else and changes nothing. The userscript and the desktop app
 * run in the page world already and read window.dzPlayer directly.
 */
(() => {
  "use strict";
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== location.origin || e.data?.bd !== "song?") return;
    let song = null;
    try {
      const s = window.dzPlayer?.getCurrentSong?.();
      if (s?.SNG_ID) song = { id: String(s.SNG_ID), title: String(s.SNG_TITLE || ""), duration: Number(s.DURATION) || 0 };
    } catch {
      song = null;
    }
    window.postMessage({ bd: "song", id: e.data.id, song }, location.origin);
  });
})();
