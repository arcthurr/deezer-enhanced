/*
 * Anchors: the ONLY place that knows how to find Deezer's elements.
 *
 * Rules (see HANDOFF.md):
 *  - Prefer data-testid, ids, ARIA roles/labels. Never generated `css-xxxx` classes.
 *    Hand-written class names that are part of Deezer's source (".naboo",
 *    ".slider-track", ".chakra-*") are allowed as LAST fallbacks only.
 *  - Each anchor lists fallbacks from most to least stable.
 *  - When Deezer ships an update and something breaks, fix it HERE, nowhere else.
 *  - `BD.health` records which anchors resolved, readable via __betterDeezer.health().
 *
 * Source of truth: Deezer web player bundle app-web.f39f92e1 (2026-11-06), see HANDOFF.md §5.
 */
BD.q = (sel, root = document) => root.querySelector(sel);
BD.qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Anchors that only exist while something is open: not reported as broken by health(). */
BD.optionalAnchors = new Set([
  "volumeInput",
  "volumeMenu",
  "searchPopover",
  "profileButton", // logged-out pages have none
  "notificationButton",
  "accountPopover",
  "accountMenuList",
  "contextMenus",
  "nativeTooltips",
  "railHistory", // desktop app only
  "menus",
  "modals",
  "popovers",
  "toasts",
  "masthead",
  "pageToolbar",
  "trackGrid",
  "homeSections",
  "switchTracks",
  "signupBanner" // logged-out visitors only
]);

/** False for Better Deezer's own UI (#bd-settings, #bd-welcome, #bd-np...): never restyle it as Deezer's. */
BD.isDeezers = (el) => !el.closest('[id^="bd-"], [class^="bd-"]');

BD.anchors = {
  /** Layout root that carries --layout-sidebar-width (80px collapsed, 243px expanded). */
  layoutRoot: () => BD.q(".naboo") || BD.q("#page_content")?.parentElement || null,

  topbar: () => BD.q("#page_topbar") || BD.q('header[role="banner"]'),

  page: () => BD.q("#page_content") || BD.q("main") || BD.q('[role="main"]'),

  searchContainer: () => BD.q('[data-testid="search_container"]'),
  searchField: () => BD.q('[data-testid="search_field"]') || BD.q("#topbar-search"),
  /** The rounded box around the search input. */
  searchGroup: () => {
    const field = BD.anchors.searchField();
    return field?.closest('[data-group="true"], [role="group"]') || field?.parentElement || null;
  },

  searchPopover: () => {
    const byTestId = BD.q('[data-testid="search_popper"]');
    if (byTestId) return byTestId;
    const id = BD.anchors.searchContainer()?.getAttribute("aria-controls");
    return (id && document.getElementById(id)) || BD.q(".popper-search");
  },

  profileButton: () => BD.q('[data-testid="topbar-profile"]') || BD.q('[data-testid="sidebar-profile"]'),
  /** Bell in the top bar (Tempo icon BellOutlinedIcon; data-testid btn-notification in the bundle). */
  notificationButton: () =>
    BD.q('[data-testid="btn-notification"]') || BD.q('[data-testid="BellOutlinedIcon"]')?.closest("button") || null,
  accountPopover: () => BD.q('[data-testid="account-popover-content"]'),
  /** The list inside the account popover where Deezer renders its entries. */
  accountMenuList: () => {
    const pop = BD.anchors.accountPopover();
    return pop ? BD.q('ul[role="navigation"]', pop) || BD.q("ul", pop) : null;
  },

  /**
   * The rail: walk up from known sidebar content to the fixed left column.
   * Deezer's sidebar is `position: fixed; top: 0; bottom: 0; inset-inline-start: 0;
   * width: var(--layout-sidebar-width)`.
   */
  rail: () => {
    const seeds = [
      // Tempo icons carry their name as data-testid (seen on the live site).
      BD.q('[data-testid="PanelLeftIcon"], [data-testid="PanelRightIcon"]'),
      BD.q('[data-testid="HouseOutlinedIcon"], [data-testid="HouseFilledIcon"]'),
      BD.q('[data-testid="sidebar-profile"]'),
      BD.q('[aria-label="Deezer logo"]'),
      BD.q('nav a[href$="/library"], nav a[href*="/library/"]'),
      BD.q('a[href*="/channels/explore"]')
    ].filter(Boolean);

    for (const seed of seeds) {
      if (seed.closest("#page_topbar, #page_player, #page_content")) continue;
      let best = null;
      for (let el = seed; el && el !== document.body; el = el.parentElement) {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width > 360) break;
        if ((s.position === "fixed" || s.position === "sticky") && r.width >= 56 && r.height >= 120) best = el;
      }
      if (best) return best;
    }
    return null;
  },

  /** The rail's toggle (aria-label "Masquer/Afficher la barre latérale"). */
  railToggle: () => {
    const icon = BD.q('[data-testid="PanelLeftIcon"], [data-testid="PanelRightIcon"]');
    return icon?.closest("button") || null;
  },

  /**
   * Desktop app only: Back / Forward chevrons at the top of the rail (a Chakra button
   * group holding ChevronLeftIcon + ChevronRightIcon). Returns the box that holds the
   * group alone, so hiding it leaves no empty row; null on the website.
   */
  railHistory: () => {
    const rail = BD.anchors.rail();
    const left = rail && BD.q('[role="group"] > button > svg[data-testid="ChevronLeftIcon"]', rail);
    const group = left?.closest('[role="group"]');
    if (!group || !group.querySelector('svg[data-testid="ChevronRightIcon"]')) return null;
    const box = group.parentElement;
    return box && box !== rail && box.children.length === 1 ? box : group;
  },

  /** Is the rail collapsed? Deezer sets --layout-sidebar-width to 80px when it is. */
  railCollapsed: () => {
    const root = BD.anchors.layoutRoot();
    const w = root ? parseFloat(getComputedStyle(root).getPropertyValue("--layout-sidebar-width")) : NaN;
    if (!Number.isNaN(w)) return w <= 120;
    const rail = BD.anchors.rail();
    return rail ? rail.getBoundingClientRect().width <= 120 : false;
  },

  /** play_button_play | play_button_pause | play_button_stop. */
  playButton: () =>
    BD.q('#page_player [data-testid^="play_button_"]') ||
    BD.q('[data-testid="play_button_play"], [data-testid="play_button_pause"], [data-testid="play_button_stop"]'),

  /** The player root (full width, Deezer's own wrapper). */
  playerRoot: () => BD.q("#page_player") || BD.q('[data-testid="miniplayer_container"]') || BD.q(".page-player"),

  /** Logged-out "Sign up for free" bar: a direct child of the layout root with a link to the signup page. */
  signupBanner: () => {
    const root = BD.anchors.layoutRoot();
    return root ? [...root.children].find((el) => !el.id && el.querySelector('a[href*="/signup"]')) || null : null;
  },

  /** The visible player bar: the fixed box inside the player root that holds the play button. */
  dock: () => {
    const play = BD.anchors.playButton();
    if (!play) return null;
    const root = BD.anchors.playerRoot();
    for (let el = play.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.getAttribute("data-bd") === "dock" || getComputedStyle(el).position === "fixed") return el;
      if (el === root) break;
    }
    // Fallback: smallest bottom-anchored wide box containing the play button.
    for (let el = play.parentElement; el && el !== document.body; el = el.parentElement) {
      const r = el.getBoundingClientRect();
      if (r.width >= innerWidth * 0.5 && r.height >= 48 && r.height <= 160 && r.bottom >= innerHeight - 24) return el;
    }
    return root;
  },

  /** Range input of the seek bar (Deezer's Slider component: input.slider-track-input). */
  progressInput: () => BD.q('[data-testid="progress_bar"]'),
  /** Visual track of the seek bar: Deezer draws it with sibling divs, the input is invisible. */
  progressTrack: () => {
    const input = BD.anchors.progressInput();
    return input?.closest(".slider-track") || input?.parentElement || null;
  },
  /** The filled part: ".slider-track-active", else the second drawn div of the track. */
  progressFill: () => {
    const track = BD.anchors.progressTrack();
    if (!track) return null;
    return BD.q(".slider-track-active", track) || Array.from(track.children).filter((c) => c.tagName === "DIV" && !c.querySelector("input"))[1] || null;
  },
  elapsedTime: () => BD.q('#page_player [data-testid="elapsed_time"]') || BD.q('[data-testid="elapsed_time"]'),
  remainingTime: () => BD.q('#page_player [data-testid="remaining_time"]') || BD.q('[data-testid="remaining_time"]'),

  /** Like (heart) in the player: add_to_favorite_button_on | _off. */
  likeButton: () => {
    const dock = BD.q('[data-bd="dock"]') || BD.anchors.playerRoot();
    return dock ? BD.q('[data-testid^="add_to_favorite_button_"]', dock) : null;
  },

  /** volume_button_default | volume_button_mute. Clicking it natively toggles mute. */
  volumeButton: () => BD.q('[data-testid^="volume_button"]'),
  /** Deezer's popover with the range input; only mounted while hovered (isLazy). */
  volumeMenu: () => BD.q('[data-testid="volume_menu"]'),
  volumeInput: () => BD.q('[data-testid="volume_menu_bar"]'),

  // ---- Pages ----
  /** Album / playlist / artist header: cover + title + subtitle (data-testid="masthead"). */
  masthead: () =>
    BD.q('#page_content [data-testid="masthead"]') ||
    BD.q('#page_content [data-testid="page-masthead"]') ||
    // Profile pages have no masthead test id: the block holding the user cover and the h1/h2.
    BD.q('#page_content [data-testid="user-cover"]')?.parentElement?.parentElement ||
    null,
  /** Action row under the masthead (play, like, share, more). */
  pageToolbar: () => BD.q('#page_content [data-testid="toolbar"]'),
  /** Track list grid of album / playlist pages. */
  trackGrid: () => BD.q('#page_content [role="grid"]'),
  /** One section of Deezer's home / dynamic pages. */
  homeSections: () => BD.qa('#page_content [data-testid="section-renderer"]'),

  /** Chakra switches (Deezer's toggles): the track, last-resort library class. */
  switchTracks: () => BD.qa('[role="switch"] + *, .chakra-switch__track').filter((el) => el.matches(".chakra-switch__track, [data-checked], span")),

  // ---- Overlays (Chakra UI renders them in portals at the end of <body>) ----
  modals: () => BD.qa('[role="dialog"][aria-modal="true"], [role="alertdialog"]').filter(BD.isDeezers),
  popovers: () => BD.qa('[role="dialog"]:not([aria-modal="true"])').filter(BD.isDeezers),
  menus: () => BD.qa('[role="menu"]').filter(BD.isDeezers),
  /** Deezer's own hover tooltips (Chakra Tooltip, role=tooltip), not its volume popover. */
  nativeTooltips: () =>
    BD.qa('[role="tooltip"]').filter(
      (el) => BD.isDeezers(el) && !el.closest('[data-testid="volume_menu"], [data-bd="volume-native"]') && !el.querySelector('[data-testid^="volume_menu"]')
    ),
  contextMenus: () => BD.qa('[data-testid="context-menu-content"]'),
  /** Toast cards: Chakra's toast manager lists (ids chakra-toast-manager-<position>). */
  toasts: () => BD.qa('[id^="chakra-toast-manager"] > li > *, [role="status"].chakra-toast__inner')
};

/** Resolve every anchor once and record which ones work. */
BD.checkHealth = () => {
  for (const [name, find] of Object.entries(BD.anchors)) {
    if (name === "railCollapsed") continue;
    let ok = false;
    try {
      const v = find();
      ok = Array.isArray(v) ? v.length > 0 : Boolean(v);
    } catch {}
    BD.health[name] = BD.optionalAnchors.has(name) && !ok ? "not open" : ok;
  }
  return BD.health;
};
