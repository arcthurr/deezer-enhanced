/*
 * Recommendations, client side only (localStorage, nothing sent to Deezer).
 * For now: "Don't recommend" — cards and track rows whose text matches an
 * entry of bd:reco:blocklist (artist, genre or mood) are hidden everywhere.
 * The other ideas of the Settings artboard are listed as "Soon" (HANDOFF §8).
 */
BD.feature({
  id: "reco",
  label: ["Liste « Ne plus me recommander »", "“Don't recommend” list"],

  norm: (s) => s.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),

  update() {
    const list = BD.settings.get("reco:blocklist", []).map(this.norm).filter(Boolean);
    const page = BD.anchors.page();
    if (!page) return;
    const items = BD.qa('[data-bd-role="card"], [data-bd-role="track-row"]', page);
    for (const el of items) {
      const text = this.norm(el.textContent || "");
      const blocked = list.length > 0 && list.some((term) => text.includes(term));
      if (blocked) BD.mark(el, "true", "data-bd-blocked");
      else if (el.hasAttribute("data-bd-blocked")) el.removeAttribute("data-bd-blocked");
    }
  }
});
