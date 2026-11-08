/*
 * Overlays: modals, popovers, menus, notifications, profile menu, search popover, toasts.
 * Deezer renders them with Chakra UI in portals (#popper-wrapper-portal, .chakra-portal,
 * #chakra-toast-manager-*). We only tag them; the look is in styles/40-overlays.css.
 *
 * Also injects, without moving any React node:
 *  - in the profile menu: a Light / Dark / Auto theme switch and "Better Deezer settings (Ctrl ,)";
 *  - in the search popover: "Clear all" on Deezer's trash button and a keyboard shortcuts footer.
 * Design: canvas artboard "Overlays".
 */
BD.feature({
  id: "overlays",
  label: ["Modales, menus et notifications redessinés", "Restyled modals, menus and notifications"],

  update() {
    // Modals + their scrim
    BD.anchors.modals().forEach((dialog) => {
      // Deezer nests role=dialog inside the Chakra modal content: style the outer one only.
      if (dialog.parentElement?.closest('[data-bd="modal"]')) return;
      BD.mark(dialog, "modal");
      const portal = dialog.closest(".chakra-portal") || dialog.parentElement?.parentElement?.parentElement;
      const scrim = portal && (BD.q(".chakra-modal__overlay", portal) || portal.firstElementChild);
      if (scrim && scrim !== dialog && !scrim.contains(dialog)) BD.mark(scrim, "scrim");
      this.markPrimary(dialog);
    });

    // Popovers (non-modal dialogs) by purpose
    const notifId = BD.anchors.notificationButton()?.getAttribute("aria-controls");
    // The card Deezer shows when hovering previous / next (Chakra popover of that button).
    const previewIds = new Set(
      BD.qa('[data-bd="dock"] :is([data-testid="previous_track_button"], [data-testid="next_track_button"])')
        .flatMap((b) => [b, b.parentElement, b.parentElement?.parentElement])
        .flatMap((el) => [el?.getAttribute?.("aria-controls"), el?.getAttribute?.("aria-describedby")])
        .filter(Boolean)
    );
    const html = document.documentElement;
    BD.mark(html, BD.isEnabled("native-tips") ? "on" : "off", "data-bd-native-tips");
    BD.mark(html, BD.isEnabled("track-previews") ? "on" : "off", "data-bd-track-previews");
    BD.anchors.popovers().forEach((pop) => {
      if (pop.closest('[data-bd="modal"]') || pop.getAttribute("data-bd") === "volume-native") return;
      const testid = pop.getAttribute("data-testid");
      let kind = "popover";
      if (previewIds.has(pop.id)) kind = "track-preview";
      else if (testid === "search_popper") kind = "search-popover";
      else if (testid === "account-popover-content") kind = "account-menu";
      else if (testid === "context-menu-content") kind = "context-menu";
      else if ((notifId && pop.id === notifId) || BD.q('h2', pop)?.textContent.trim().match(/^notifications?$/i)) kind = "notifications";
      // Deezer's volume popover is a role=tooltip, not here; the search popper nests a second testid div.
      if (pop.parentElement?.closest(`[data-bd="${kind}"]`)) return;
      BD.mark(pop, kind);
    });

    BD.anchors.menus().forEach((menu) => BD.mark(menu, "menu"));
    // A tooltip opened by previous / next (aria-describedby) is the track preview, not a plain tip.
    BD.anchors.nativeTooltips().forEach((tip) => BD.mark(tip, previewIds.has(tip.id) || previewIds.has(tip.parentElement?.id) ? "track-preview" : "native-tip"));
    BD.anchors.switchTracks().forEach((track) => BD.mark(track, "switch-track", "data-bd-role"));
    BD.anchors.toasts().forEach((toast) => BD.mark(toast, "toast"));

    const counter = BD.q('[aria-label="topbar-notification-counter"]');
    if (counter) BD.mark(counter, "unread-badge", "data-bd-role");

    this.injectAccountMenu();
    this.notificationFilters();
    this.decorateSearch();
  },

  /** In a modal, the accent-filled button is the primary action. */
  markPrimary(dialog) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--bd-accent").trim();
    BD.qa("footer button, [data-testid='btn-modal-confirm'], button.chakra-button", dialog).forEach((b) => {
      if (b.getAttribute("data-bd-role")) return;
      const bg = getComputedStyle(b).backgroundColor;
      if (b.matches("[data-testid='btn-modal-confirm']") || this.sameColor(bg, accent)) BD.mark(b, "primary", "data-bd-role");
    });
    // Its text-only siblings ("Annuler") become secondary.
    BD.qa('[data-bd-role="primary"]', dialog).forEach((primary) => {
      Array.from(primary.parentElement?.children || []).forEach((b) => {
        if (b !== primary && b.tagName === "BUTTON" && !b.getAttribute("data-bd-role")) BD.mark(b, "secondary", "data-bd-role");
      });
    });
  },

  sameColor(rgb, hex) {
    const m = rgb.match(/\d+/g);
    if (!m || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
    const h = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return h.every((v, i) => Math.abs(v - Number(m[i])) < 3);
  },

  injectAccountMenu() {
    const list = BD.anchors.accountMenuList();
    if (!list || BD.q(".bd-account", list)) return;

    const themeButton = (value, fr, en) =>
      BD.h(
        "button",
        {
          type: "button",
          role: "radio",
          class: "bd-seg",
          "data-value": value,
          "aria-checked": String(BD.theme.get() === value),
          onclick: (e) => {
            e.stopPropagation();
            BD.theme.set(value);
            BD.qa(".bd-account .bd-seg").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === value)));
          }
        },
        BD.t(fr, en)
      );

    const item = BD.h(
      "li",
      { class: "bd-account" },
      BD.h(
        "div",
        { class: "bd-account-theme" },
        BD.h("span", { class: "bd-account-label" }, BD.t("Thème", "Theme")),
        BD.h(
          "div",
          { class: "bd-segmented", role: "radiogroup", "aria-label": BD.t("Thème", "Theme") },
          themeButton("light", "Clair", "Light"),
          themeButton("dark", "Sombre", "Dark"),
          themeButton("system", "Auto", "Auto")
        )
      ),
      BD.h(
        "button",
        {
          type: "button",
          class: "bd-account-link",
          onclick: (e) => {
            e.stopPropagation();
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            BD.openSettings?.();
          }
        },
        BD.h("span", {}, BD.t("Réglages Better Deezer", "Better Deezer settings")),
        BD.h("kbd", { class: "bd-kbd-inline" }, navigator.platform.startsWith("Mac") ? "⌘ ," : "Ctrl ,")
      )
    );
    const before = BD.q('[data-testid="display"]', list) || BD.q("li.is-divider", list);
    list.insertBefore(item, before || null);
  },

  /**
   * Client-side filters for the notification panel: All / Releases / Social.
   * Deezer's items carry a caption like "IL Y A 11 HEURES - NOUVEAU SINGLE".
   */
  notificationFilters() {
    const panel = BD.q('[data-bd="notifications"]');
    if (!panel) return;
    const items = BD.qa("li", panel).filter((li) => !li.closest(".bd-notif-filters"));
    const isRelease = (li) => /nouveau|nouvel|new (single|album|ep|release)|sortie|release/i.test(li.textContent);
    items.forEach((li) => BD.mark(li, isRelease(li) ? "release" : "social", "data-bd-kind"));
    if (BD.q(".bd-notif-filters", panel)) return;
    const title = BD.qa("h2", panel).find((h) => /^notifications?$/i.test(h.textContent.trim()));
    if (!title) return;
    const chip = (value, fr, en) =>
      BD.h(
        "button",
        {
          type: "button",
          class: "bd-chip",
          "data-value": value,
          "aria-pressed": String(value === "all"),
          onclick: (e) => {
            e.stopPropagation();
            panel.setAttribute("data-bd-filter", value);
            BD.qa(".bd-notif-filters .bd-chip", panel).forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.value === value)));
          }
        },
        BD.t(fr, en)
      );
    title.after(
      BD.h(
        "div",
        { class: "bd-notif-filters", role: "toolbar", "aria-label": BD.t("Filtrer", "Filter") },
        chip("all", "Tout", "All"),
        chip("release", "Sorties", "Releases"),
        chip("social", "Social", "Social")
      )
    );
  },

  decorateSearch() {
    const pop = BD.anchors.searchPopover();
    if (!pop) return;
    const clear = BD.q('[data-testid="recent_search_clear_button"]', pop);
    if (clear && !BD.q(".bd-clear-label", clear)) {
      clear.append(BD.h("span", { class: "bd-clear-label" }, BD.t("Tout effacer", "Clear all")));
      BD.mark(clear, "clear-all", "data-bd-role");
    }
    if (!BD.isEnabled("tips") || BD.q(".bd-search-footer", pop)) return;
    const host = pop;
    const k = (t) => BD.h("kbd", {}, t);
    host.append(
      BD.h(
        "div",
        { class: "bd-search-footer", "aria-hidden": "true" },
        BD.h("span", {}, k("↑"), k("↓"), BD.t(" naviguer", " navigate")),
        BD.h("span", {}, k(BD.t("Entrée", "Enter")), BD.t(" ouvrir", " open")),
        BD.h("span", {}, k(BD.t("Échap", "Esc")), BD.t(" fermer", " close")),
        BD.h("span", {}, k(navigator.platform.startsWith("Mac") ? "⌘ K" : "Ctrl K"), BD.t(" rechercher", " search"))
      )
    );
  }
});
