/*
 * Consistent tooltips for the dock's icon-only buttons, from their aria-label,
 * plus a short usage tip where Better Deezer adds a gesture (wheel, shortcuts).
 * Some Deezer labels are raw ids ("volume button", "open queuelist"): replaced.
 *
 * One tooltip at a time: while ours is shown, Deezer's own tooltip for the same
 * button (tagged data-bd="native-tip" by overlays.js) is hidden by the CSS
 * (html[data-bd-tip-open]). Previous / next get none: Deezer already shows a
 * card with the previous / next track there.
 */
// By default only previous / next keep their hover card (Deezer's track preview);
// every other tooltip is off (Settings > Appearance > Tooltips).
BD.defaultOff.add("tooltips");
BD.defaultOff.add("tips");
BD.defaultOff.add("native-tips");

BD.feature({
  id: "tooltips",
  live: true, // show() checks the switch, so turning it off takes effect at once
  label: ["Infobulles Better Deezer sur la barre de lecture", "Better Deezer tooltips on the player bar"],

  /** By data-testid prefix: [label fr, label en, tip fr, tip en]. */
  hints: {
    volume_button: ["Volume", "Volume", "Clic : régler · Molette : ±5 % · Alt+clic : muet", "Click: adjust · Wheel: ±5% · Alt+click: mute"],
    queue_list_button: ["File d'attente", "Queue"],
    lyrics_button: ["Paroles", "Lyrics"],
    audio_settings_button: ["Réglages audio", "Audio settings"]
  },

  describe(el) {
    const testid = el.getAttribute("data-testid") || "";
    const key = Object.keys(this.hints).find((k) => testid.startsWith(k));
    const h = key ? this.hints[key] : [];
    const label = BD.t(h[0], h[1]) || el.getAttribute("aria-label") || "";
    // Our own buttons carry their tip in data-bd-tip.
    const tip = BD.isEnabled("tips") ? el.getAttribute("data-bd-tip") || BD.t(h[2], h[3]) : null;
    return { label, tip };
  },

  setup() {
    let tip = null;
    let owner = null; // the element the visible tooltip belongs to
    const hide = () => {
      tip?.remove();
      tip = owner = null;
      document.documentElement.removeAttribute("data-bd-tip-open");
    };
    const show = (el) => {
      if (!BD.isEnabled("tooltips")) return hide();
      if (el === owner) return; // moving between the button and its icon: keep it, no flicker
      const { label, tip: hint } = this.describe(el);
      hide();
      if (!label && !hint) return;
      owner = el;
      document.documentElement.setAttribute("data-bd-tip-open", "");
      tip = BD.h("div", { class: "bd-tooltip", role: "tooltip" }, label ? BD.h("strong", {}, label) : null, hint ? BD.h("span", {}, hint) : null);
      document.body.appendChild(tip);
      const r = el.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2))}px`;
      tip.style.top = `${Math.max(8, r.top - t.height - 10)}px`;
    };
    const skip = '[data-testid="previous_track_button"], [data-testid="next_track_button"]';
    const target = (node) => {
      const el = node?.closest?.('[data-bd="dock"] button[aria-label]');
      return el && !el.matches(skip) ? el : null;
    };

    document.addEventListener("pointerover", (e) => {
      const el = target(e.target);
      if (!el) return;
      el.removeAttribute("title");
      show(el);
    });
    // Only hide when the pointer really leaves the element (not when it enters its icon).
    document.addEventListener("pointerout", (e) => {
      if (owner && target(e.target) === owner && target(e.relatedTarget) !== owner) hide();
    });
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", (e) => {
      const el = target(e.target);
      el && el.matches(":focus-visible") ? show(el) : hide();
    });
    document.addEventListener("focusout", (e) => target(e.target) === owner && hide());
    this.hide = hide;
    this.ownerGone = () => Boolean(owner && !owner.isConnected);
  },

  update() {
    // Runs after DOM changes. React may replace the button under the cursor (play -> pause),
    // and a removed element never sends pointerout: drop the orphaned tooltip.
    if (this.hide && this.ownerGone()) this.hide();
  }
});

BD.feature({ id: "tips", live: true, label: ["Astuces dans ces infobulles", "Tips in these tooltips"] });

/* Deezer's own tooltips and the previous / next track card: shown or hidden by the
   CSS from two attributes on <html> (the elements are tagged in overlays.js). */
BD.feature({ id: "native-tips", live: true, label: ["Infobulles de Deezer", "Deezer's tooltips"] });
BD.feature({ id: "track-previews", live: true, label: ["Aperçu du titre précédent / suivant", "Previous / next track preview"] });
