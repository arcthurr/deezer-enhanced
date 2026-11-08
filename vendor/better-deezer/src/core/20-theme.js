/*
 * Theme: "dark" (default), "light" or "system" (follows prefers-color-scheme).
 * Only sets html[data-bd-theme]; the colors live in styles/00-tokens.css.
 * Applied by main.js before any feature runs, so there is no flash.
 */
BD.themes = ["dark", "light", "system"];

BD.theme = {
  media: typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null,

  /** The stored preference. */
  get() {
    const t = BD.settings.get("theme", "dark");
    return BD.themes.includes(t) ? t : "dark";
  },

  /** What is actually shown: "dark" or "light". */
  resolve(pref = this.get()) {
    // A color theme that only has one palette (BD.skins) forces that mode.
    if (this.forced) return this.forced;
    if (pref === "system") return this.media?.matches ? "light" : "dark";
    return pref;
  },

  apply() {
    const html = document.documentElement;
    const resolved = this.resolve();
    if (html.getAttribute("data-bd-theme") !== resolved) {
      html.setAttribute("data-bd-theme", resolved);
      BD.emit("theme", resolved);
    }
    html.setAttribute("data-bd-theme-pref", this.get());
  },

  set(pref) {
    if (!BD.themes.includes(pref)) return;
    BD.settings.set("theme", pref);
    this.apply();
  },

  init() {
    this.apply();
    this.media?.addEventListener?.("change", () => this.get() === "system" && this.apply());
    // Another tab changed the setting.
    addEventListener("storage", (e) => e.key === "bd:theme" && this.apply());
  }
};
