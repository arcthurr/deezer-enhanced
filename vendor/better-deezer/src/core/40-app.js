/*
 * Desktop app bridge. The Deezer Enhanced app exposes window.view.appAPI to the page
 * (its preload); on the website or in the extension it does not exist and every
 * app-only feature stays asleep. Settings of the app itself (tray, Discord, volume
 * curve...) live in the app's preferences file, not in localStorage: they are read
 * and written through this bridge and cached here.
 */
BD.app = {
  cache: null,
  windowState: { transparent: false },

  api() {
    return BD.target === "desktop" && typeof window.view !== "undefined" && window.view && window.view.appAPI ? window.view.appAPI : null;
  },

  available() {
    return Boolean(this.api());
  },

  /** Read the app's settings once, then keep the cache in sync with changes from anywhere. */
  async load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const api = this.api();
      if (!api) return;
      try {
        this.cache = await window.view.settingsAPI.getSettings();
        this.windowState = (await api.getWindowState()) || this.windowState;
        window.view.settingsAPI.onSetProperty((key, value) => {
          this.cache = { ...this.cache, [key]: value };
          BD.emit("app", key, value);
        });
      } catch (err) {
        BD.warn("could not read the app settings:", err);
      }
      this.applyWindow();
      BD.emit("app", "ready");
    })();
    return this.loading;
  },

  get(key, fallback) {
    return this.cache && key in this.cache ? this.cache[key] : fallback;
  },

  set(key, value) {
    this.api()?.setSetting(key, value);
    this.cache = { ...(this.cache || {}), [key]: value };
    BD.emit("app", key, value);
  },

  reset() {
    this.api()?.resetSettings();
  },

  relaunch() {
    this.api()?.relaunch();
  },

  /** The window itself is see-through (decided at launch): CSS can then drop its own ground. */
  applyWindow() {
    BD.mark(document.documentElement, String(Boolean(this.windowState.transparent)), "data-bd-seethrough");
  }
};
