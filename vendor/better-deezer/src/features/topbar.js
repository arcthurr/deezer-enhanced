/*
 * Top bar: the search field is always centered on the window, with a round
 * Home button on its left (like Spotify's top bar). The right-hand actions
 * (notifications, profile) stay where Deezer puts them.
 *
 * Deezer's top bar is `position: fixed` and starts after the rail; the search
 * lives in a wrapper that is a direct child of it. We position that wrapper
 * (never move it) with CSS variables computed here:
 *   --bd-search-center  x of the window's center, relative to the top bar
 *   --bd-search-width   as wide as possible without touching the Home button
 *                       or the right-hand actions (320–600 px)
 */
BD.feature({
  id: "topbar",
  label: ["Recherche centrée + bouton Accueil", "Centered search + Home button"],

  HOME_W: 48,
  GAP: 8,
  EDGE: 16,

  setup() {
    addEventListener("resize", () => this.layout());
  },

  homeHref() {
    const lang = BD.path().split("/")[1];
    return BD.routePrefix() + (/^[a-z]{2}(-[a-z]{2})?$/i.test(lang) ? `/${lang}/` : "/");
  },

  isHome() {
    return /^\/([a-z]{2}(-[a-z]{2})?)?\/?$/i.test(BD.path());
  },

  /** Navigate inside Deezer's single-page app: click its own Home link when we can. */
  goHome(e) {
    const own = BD.qa('[data-bd="rail"] a[href]').find((a) => /^\/([a-z]{2}(-[a-z]{2})?)?\/?$/i.test(BD.path(a.href)));
    if (!own) return; // plain link navigation
    e.preventDefault();
    own.click();
  },

  homeButton(topbar) {
    let btn = BD.q(".bd-home", topbar);
    if (btn) return btn;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z");
    svg.append(path);
    btn = BD.h("a", { class: "bd-home", href: this.homeHref(), "aria-label": BD.t("Accueil", "Home"), onclick: (e) => this.goHome(e) }, svg);
    topbar.append(btn);
    return btn;
  },

  layout() {
    const topbar = BD.q('[data-bd="topbar"]');
    const slot = BD.q('[data-bd="search-slot"]');
    if (!topbar || !slot) return;
    const tb = topbar.getBoundingClientRect();
    if (!tb.width) return;

    // Right-hand actions: everything in the top bar except the search and our button.
    let rightLimit = tb.width - this.EDGE;
    for (const child of topbar.children) {
      if (child === slot || child.classList.contains("bd-home")) continue;
      const r = child.getBoundingClientRect();
      if (r.width && r.left - tb.left > tb.width / 2) rightLimit = Math.min(rightLimit, r.left - tb.left - this.EDGE);
    }
    const leftLimit = this.EDGE + this.HOME_W + this.GAP;

    let center = innerWidth / 2 - tb.left;
    const desired = Math.min(600, Math.max(320, innerWidth * 0.4));
    const half = Math.min(desired / 2, center - leftLimit, rightLimit - center);
    let width = Math.floor(half * 2);
    if (width < 280) {
      // Narrow window: keep the cluster readable, shift it off center.
      width = Math.max(240, Math.min(desired, rightLimit - leftLimit));
      center = leftLimit + width / 2;
    }
    const set = (k, v) => topbar.style.getPropertyValue(k) !== v && topbar.style.setProperty(k, v);
    set("--bd-search-center", `${Math.round(center)}px`);
    set("--bd-search-width", `${width}px`);
    // The results popover takes the same width (40-overlays.css).
    if (document.documentElement.style.getPropertyValue("--bd-search-w") !== `${width}px`) {
      document.documentElement.style.setProperty("--bd-search-w", `${width}px`);
    }
  },

  update() {
    const topbar = BD.q('[data-bd="topbar"]');
    const container = BD.anchors.searchContainer();
    if (!topbar || !container) return;
    let slot = container;
    while (slot.parentElement && slot.parentElement !== topbar) slot = slot.parentElement;
    if (slot.parentElement !== topbar) return;
    BD.unmarkAll("search-slot", slot);
    BD.mark(slot, "search-slot");
    BD.mark(document.documentElement, "true", "data-bd-centered-search");

    const home = this.homeButton(topbar);
    const href = this.homeHref();
    if (home.getAttribute("href") !== href) home.setAttribute("href", href);
    BD.mark(home, String(this.isHome()), "aria-current");
    this.layout();
  }
});
