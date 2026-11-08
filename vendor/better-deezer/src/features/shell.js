/* Tag the structural pieces so the CSS can style them. */
BD.feature({
  id: "shell",
  update() {
    // Deezer toggles the rail by setting --layout-sidebar-width inline on its layout
    // root: an attribute change the main (childList) observer does not see.
    const root = BD.anchors.layoutRoot();
    if (root && root !== this.observedRoot) {
      this.observedRoot = root;
      this.rootObserver?.disconnect();
      this.rootObserver = new MutationObserver(() => BD.schedule?.());
      this.rootObserver.observe(root, { attributes: true, attributeFilter: ["style", "class"] });
    }

    const rail = BD.anchors.rail();
    const dock = BD.anchors.dock();
    const topbar = BD.anchors.topbar();
    const page = BD.anchors.page();

    BD.unmarkAll("rail", rail);
    BD.unmarkAll("dock", dock);
    if (rail) {
      BD.mark(rail, "rail");
      BD.mark(rail, String(BD.anchors.railCollapsed()), "data-bd-collapsed");
      this.markActiveLinks(rail);
      this.markSticky(rail);
      const history = BD.anchors.railHistory();
      BD.unmarkAll("rail-history", history, "data-bd-role");
      BD.mark(history, "rail-history", "data-bd-role");
    }
    if (dock) BD.mark(dock, "dock");
    if (topbar) BD.mark(topbar, "topbar");
    if (page) BD.mark(page, "page");

    const group = BD.anchors.searchGroup();
    if (group) BD.mark(group, "search-field-group");

    const banner = BD.anchors.signupBanner();
    if (banner) BD.mark(banner, "signup-banner");
  },

  /**
   * Sticky headers inside the rail ("Library", "Playlists") need an opaque
   * background or the list scrolls visibly under them. Computed styles are
   * costly: scan at most once a second.
   */
  markSticky(rail) {
    const now = Date.now();
    if (this.stickyScan && now - this.stickyScan < 1000) return;
    this.stickyScan = now;
    rail.querySelectorAll("div, header, h2, p").forEach((el) => {
      if (getComputedStyle(el).position === "sticky") BD.mark(el, "rail-sticky", "data-bd-role");
    });
  },

  /** Deezer swaps icons for the active page but sets no aria-current: derive it from the URL. */
  markActiveLinks(rail) {
    const path = BD.path().replace(/\/$/, "");
    rail.querySelectorAll("a[href]").forEach((a) => {
      let href;
      try {
        href = BD.path(a.href).replace(/\/$/, "");
      } catch {
        return;
      }
      const isLogo = a.matches('[aria-label="Deezer logo"]') || !a.textContent.trim() && !a.querySelector("svg[data-testid$='Icon'], img");
      const active = !isLogo && (path === href || (href.split("/").length > 2 && path.startsWith(`${href}/`) && !/^\/[a-z]{2}$/.test(href)));
      BD.mark(a, String(active), "data-bd-active");
    });
  }
});

/*
 * Sidebar entries (Settings > Sidebar): show, hide and reorder the navigation
 * links of Deezer's rail. Nothing is hard-coded: entries are discovered in the
 * live rail, so a Deezer update that adds, renames or removes one shows up here
 * by itself.
 *
 *  - An entry is a rail link whose icon is a direct child: `a > svg[data-testid$=Icon]`
 *    (Deezer's NavLink). Pinned items and playlists use covers, so they never match.
 *  - Its key is its path without the language, first two segments ("", "channels/explore",
 *    "library/albums"): stable across tabs and query strings.
 *  - A group is the links' parent (e.g. Home + Explore, then the Library list).
 *    Order is applied with CSS `order` inside a group (never by moving React's
 *    nodes), and only when the group is a flex or grid box.
 *  - Library entries are hidden until the user shows them (rail:hidden unset).
 */
BD.railNav = {
  keyOf(a) {
    if (!a.querySelector(':scope > svg[data-testid$="Icon"]')) return null;
    try {
      const path = BD.path(a.href)
        .replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/i, "")
        .replace(/^\/|\/$/g, "");
      return path.split("/").slice(0, 2).join("/");
    } catch {
      return null;
    }
  },

  /** Entries as they are in the rail now: [{ key, label, icon, group, link }]. */
  entries() {
    const rail = BD.q('[data-bd="rail"]');
    if (!rail) return [];
    const seen = new Set();
    const groups = [];
    const out = [];
    rail.querySelectorAll("a[href]").forEach((a) => {
      const key = this.keyOf(a);
      if (key === null || seen.has(key)) return;
      seen.add(key);
      if (!groups.includes(a.parentElement)) groups.push(a.parentElement);
      const label = (a.querySelector("h2, h3, p, span")?.textContent || a.getAttribute("aria-label") || a.textContent || key).trim();
      out.push({ key, label, icon: a.querySelector(':scope > svg[data-testid$="Icon"]'), group: groups.indexOf(a.parentElement), list: a.parentElement, link: a });
    });
    return out;
  },

  /** Title of a group: the heading of its block ("Library"), if it has one. */
  groupTitle(list) {
    const block = list.parentElement;
    if (!block || BD.q('[data-bd="rail"]') === block) return null;
    const heading = [...block.children].find((el) => el !== list && !el.querySelector("a[href]") && el.textContent.trim());
    return heading ? heading.textContent.trim() : null;
  },

  canReorder(list) {
    return /flex|grid/.test(getComputedStyle(list).display);
  },

  hidden() {
    const stored = BD.settings.get("rail:hidden", null);
    if (stored) return new Set(stored.map((k) => this.legacy[k] ?? k));
    // Default: the Library links (Favourite tracks, playlists, albums, artists, podcasts...).
    return new Set(this.entries().filter((e) => e.key.startsWith("library/")).map((e) => e.key));
  },

  /** Keys used by version 1.0.0 of this setting. */
  legacy: { home: "", explore: "channels/explore", loved: "library/loved", playlists: "library/playlists", albums: "library/albums", artists: "library/artists", podcasts: "library/podcasts" },

  setVisible(key, visible) {
    const set = this.hidden();
    visible ? set.delete(key) : set.add(key);
    BD.settings.set("rail:hidden", [...set]);
    BD.schedule?.();
  },

  order() {
    return BD.settings.get("rail:order", []);
  },

  setOrder(keys) {
    BD.settings.set("rail:order", keys);
    BD.schedule?.();
  },

  reset() {
    BD.settings.set("rail:hidden", null);
    BD.settings.set("rail:order", []);
    BD.schedule?.();
  }
};

BD.feature({
  id: "rail-nav",
  live: true,

  update() {
    const entries = BD.railNav.entries();
    if (!entries.length) return;
    const hidden = BD.railNav.hidden();
    const order = BD.railNav.order();
    const lists = new Set();
    for (const e of entries) {
      BD.mark(e.link, e.key || "home", "data-bd-nav");
      BD.mark(e.link, String(hidden.has(e.key)), "data-bd-nav-hidden");
      lists.add(e.list);
      // Saved order first, entries the user never placed keep Deezer's order after them.
      const pos = order.indexOf(e.key);
      const value = pos === -1 ? "" : String(pos - 1000);
      if (BD.railNav.canReorder(e.list) && e.link.style.order !== value) e.link.style.order = value;
    }
    // A block whose links are all hidden goes too (e.g. the "Library" title and its shuffle button).
    lists.forEach((list) => {
      const links = entries.filter((e) => e.list === list);
      const empty = links.every((e) => hidden.has(e.key));
      const block = list.parentElement;
      const own = block && block.getAttribute("data-bd") !== "rail" && BD.qa("[data-bd-nav]", block).length === links.length;
      BD.mark(own ? block : list, String(empty), "data-bd-nav-hidden");
    });
  },

  teardown() {
    BD.qa("[data-bd-nav-hidden]").forEach((el) => el.removeAttribute("data-bd-nav-hidden"));
    BD.qa("[data-bd-nav]").forEach((el) => (el.style.order = ""));
  }
});
