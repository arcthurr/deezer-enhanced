/*
 * Modules: optional extras, listed in Settings > Modules (like Spicetify's
 * extensions). Every module is a regular feature with `module: true`; they all
 * switch on and off live, without reloading.
 *
 *   transitions   soft page and cover transitions (respects "reduce motion")
 *   hide-promos   hides upgrade banners and ad slots (cosmetic only)
 *   sleep-timer   pauses after N minutes or at the end of the track, with a fade
 *   accent-cover  the accent color follows the playing cover (off by default)
 *   compact       denser lists and cards (off by default)
 *
 * The "now playing" view with lyrics lives in features/nowplaying.js.
 */

/** Shared helpers for color work (accent-cover). */
BD.color = {
  parse(str) {
    const m = String(str).match(/\d+(\.\d+)?/g);
    return m ? m.slice(0, 3).map(Number) : null;
  },
  toHex([r, g, b]) {
    return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  },
  toHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  },
  fromHsl([h, s, l]) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  },
  luminance(rgb) {
    const [r, g, b] = rgb.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  },
  contrast(a, b) {
    const [x, y] = [this.luminance(a), this.luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  }
};

/* ---------- Smooth transitions ---------- */
BD.feature({
  id: "transitions",
  module: true,
  live: true,
  glyph: "M4 12h4l3-7 4 14 3-7h2",
  label: ["Transitions fluides", "Smooth transitions"],
  description: [
    "Fondu à chaque changement de page et de pochette, cartes qui s'animent au survol. Désactivé automatiquement si votre système demande moins d'animations.",
    "Fade on every page and cover change, cards that lift on hover. Turned off automatically when your system asks for reduced motion."
  ],

  setup() {
    BD.mark(document.documentElement, "true", "data-bd-transitions");
    this.path = BD.path();
  },

  teardown() {
    document.documentElement.removeAttribute("data-bd-transitions");
  },

  replay(el, attr) {
    if (!el) return;
    el.removeAttribute(attr);
    void el.offsetWidth; // restart the CSS animation
    el.setAttribute(attr, "true");
  },

  update() {
    if (BD.path() !== this.path) {
      this.path = BD.path();
      this.replay(BD.anchors.page(), "data-bd-enter");
    }
    const img = BD.q('[data-bd="dock"] [data-testid="item_cover"] img');
    const src = img?.getAttribute("src");
    if (img && src !== this.cover) {
      if (this.cover) this.replay(img, "data-bd-enter");
      this.cover = src;
    }
  }
});

/* ---------- Hide promos ---------- */
BD.feature({
  id: "hide-promos",
  module: true,
  live: true,
  glyph: "M4 4l16 16M9 5h10a1 1 0 0 1 1 1v10M15 19H5a1 1 0 0 1-1-1V8",
  label: ["Masquer les bannières promotionnelles", "Hide promotional banners"],
  description: [
    "Cache les bandeaux « Passez à Premium » et « Inscription », les encarts publicitaires et les playlists sponsorisées. Purement visuel : rien n'est bloqué sur le réseau.",
    "Hides “Go Premium” and “Sign up” banners, ad slots and sponsored playlists. Visual only: nothing is blocked on the network."
  ],

  /** data-testid values found in Deezer's bundle (HANDOFF §5). */
  SELECTORS: [
    '[data-testid="conversionBanner"]',
    '[data-testid="conversionBannerCTA"]',
    '[data-testid="conversionBoxCTA"]',
    '[data-testid="minibanner-root"]',
    '[data-testid="subscriptionBanner"]',
    '[data-testid^="adslot"]',
    '[data-testid="sponsored_playlist"]'
  ],

  setup() {
    BD.mark(document.documentElement, "true", "data-bd-hide-promos");
  },

  teardown() {
    document.documentElement.removeAttribute("data-bd-hide-promos");
    BD.unmarkAll("true", null, "data-bd-promo");
  },

  update() {
    // Hide the whole card or section around it, so no empty frame is left behind.
    for (const el of BD.qa(this.SELECTORS.join(","))) {
      const box = el.closest('[data-testid="section-renderer"], li, [role="group"]') || el;
      BD.mark(box, "true", "data-bd-promo");
    }
  }
});

/* ---------- Sleep timer ---------- */
BD.feature({
  id: "sleep-timer",
  module: true,
  live: true,
  glyph: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  label: ["Minuteur de sommeil", "Sleep timer"],
  description: [
    "Met la musique en pause après une durée ou à la fin du titre, avec un fondu du volume sur la dernière minute. Réglage ici ou en cliquant sur le badge de la barre de lecture.",
    "Pauses the music after a while or at the end of the track, fading the volume over the last minute. Set it here or click the badge in the player bar."
  ],

  FADE_MS: 60000,
  timer: null, // { end: ms | null, endOfTrack: bool, key, startVolume }

  setup() {
    BD.sleep = this;
    this.tick = setInterval(() => this.step(), 1000);
  },

  teardown() {
    this.stop();
    clearInterval(this.tick);
    BD.q(".bd-sleep-badge")?.remove();
  },

  trackKey() {
    const dock = BD.q('[data-bd="dock"]');
    return dock ? BD.q('[data-testid="item_title"]', dock)?.textContent.trim() || "" : "";
  },

  isPlaying() {
    return Boolean(BD.q('[data-bd="dock"] [data-testid="play_button_pause"]'));
  },

  /** minutes: number, or "track" for the end of the current track. */
  start(minutes) {
    this.stop();
    const endOfTrack = minutes === "track";
    this.timer = {
      end: endOfTrack ? null : Date.now() + minutes * 60000,
      endOfTrack,
      key: this.trackKey(),
      startVolume: null
    };
    this.render();
    BD.emit("sleep");
  },

  stop() {
    if (this.timer?.startVolume != null) BD.volume?.setRatio(this.timer.startVolume);
    this.timer = null;
    this.render();
    BD.emit("sleep");
  },

  remaining() {
    const t = this.timer;
    if (!t) return null;
    if (t.endOfTrack) {
      const input = BD.anchors.progressInput();
      return input ? Math.max(0, (Number(input.max) - Number(input.value)) * 1000) : null;
    }
    return Math.max(0, t.end - Date.now());
  },

  step() {
    const t = this.timer;
    if (!t) return;
    // End of track: Deezer moved on to the next one.
    const done = t.endOfTrack ? this.trackKey() !== t.key : this.remaining() <= 0;
    if (done) {
      if (this.isPlaying()) BD.q('[data-bd="dock"] [data-testid="play_button_pause"]')?.click();
      const restore = t.startVolume;
      this.timer = null;
      // Put the volume back once paused, so the next play is not silent.
      if (restore != null) setTimeout(() => BD.volume?.setRatio(restore), 600);
      this.render();
      BD.emit("sleep");
      return;
    }
    const left = this.remaining();
    if (left != null && left < this.FADE_MS && BD.volume && this.isPlaying()) {
      if (t.startVolume == null) t.startVolume = BD.volume.readRatio();
      // A step every 5 s keeps Deezer's volume popover quiet.
      if (!t.lastFade || Date.now() - t.lastFade >= 5000) {
        t.lastFade = Date.now();
        BD.volume.setRatio(t.startVolume * Math.max(0.05, left / this.FADE_MS));
      }
    }
    this.render();
  },

  countdown() {
    const left = this.remaining();
    if (this.timer?.endOfTrack) return BD.t("Fin du titre", "End of track");
    if (left == null) return "";
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return `${m}:${String(s).padStart(2, "0")}`;
  },

  /** Badge in the player bar while a timer runs; click it to cancel. */
  render() {
    let badge = BD.q(".bd-sleep-badge");
    if (!this.timer) {
      badge?.remove();
      return;
    }
    const anchor = BD.q(".bd-np-btn") || BD.q('[data-bd="dock"] [data-testid="queue_list_button"]');
    if (!anchor) return;
    if (!badge) {
      badge = BD.h(
        "button",
        {
          type: "button",
          class: "bd-sleep-badge",
          onclick: () => this.stop(),
          "data-bd-tip": BD.t("Clic : annuler", "Click: cancel")
        },
        BD.h("span", { class: "bd-sleep-moon", "aria-hidden": "true" }),
        BD.h("span", { class: "bd-sleep-text" })
      );
      badge.setAttribute("aria-label", BD.t("Minuteur de sommeil", "Sleep timer"));
    }
    if (badge.nextElementSibling !== anchor) anchor.before(badge);
    const text = BD.q(".bd-sleep-text", badge);
    const label = this.countdown();
    if (text.textContent !== label) text.textContent = label;
  },

  update() {
    if (this.timer && !BD.q(".bd-sleep-badge")) this.render();
  }
});

/* ---------- Accent from the cover ---------- */
BD.defaultOff.add("accent-cover");
BD.feature({
  id: "accent-cover",
  module: true,
  live: true,
  glyph: "M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-.9-.6-1.2-.6-2 0-.8.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
  label: ["Couleur d'accent selon la pochette", "Accent color from the cover"],
  description: [
    "Les boutons et la barre de progression prennent la couleur dominante de la pochette en cours, ajustée pour rester lisible. Remplace l'accent du thème tant que le module est actif.",
    "Buttons and the seek bar take the main color of the playing cover, adjusted to stay readable. Overrides the theme's accent while on."
  ],

  PROPS: ["--bd-accent", "--bd-accent-hover", "--bd-accent-pressed", "--bd-accent-soft", "--bd-accent-text", "--bd-on-accent"],

  setup() {
    this.key = null;
  },

  teardown() {
    this.key = null;
    this.clear();
  },

  clear() {
    const style = document.documentElement.style;
    this.PROPS.forEach((p) => style.removeProperty(p));
  },

  /** Most saturated well-represented color of a 16×16 thumbnail. */
  pick(img) {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 16, 16);
    const d = ctx.getImageData(0, 0, 16, 16).data;
    const buckets = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const rgb = [d[i], d[i + 1], d[i + 2]];
      const [h, s, l] = BD.color.toHsl(rgb);
      if (l < 0.12 || l > 0.92) continue;
      const key = Math.round(h / 24);
      const b = buckets.get(key) || { n: 0, score: 0, rgb: [0, 0, 0] };
      b.n++;
      b.score += s;
      b.rgb = b.rgb.map((v, k) => v + rgb[k]);
      buckets.set(key, b);
    }
    let best = null;
    for (const b of buckets.values()) {
      const weight = b.score * Math.sqrt(b.n);
      if (!best || weight > best.weight) best = { weight, rgb: b.rgb.map((v) => v / b.n) };
    }
    return best?.rgb || null;
  },

  /** Lighten (dark theme) or darken (light theme) until it reads well on the ground. */
  fit(rgb) {
    const bgRgb = BD.color.parse(getComputedStyle(document.body).backgroundColor) || [18, 18, 20];
    const dark = BD.color.luminance(bgRgb) < 0.2;
    let [h, s, l] = BD.color.toHsl(rgb);
    s = Math.max(s, 0.45);
    let out = BD.color.fromHsl([h, s, l]);
    for (let i = 0; i < 40 && BD.color.contrast(out, bgRgb) < 4.5; i++) {
      l = dark ? Math.min(0.95, l + 0.02) : Math.max(0.05, l - 0.02);
      out = BD.color.fromHsl([h, s, l]);
    }
    const hover = BD.color.fromHsl([h, s, dark ? Math.min(0.97, l + 0.06) : Math.max(0.03, l - 0.06)]);
    const pressed = BD.color.fromHsl([h, s, dark ? Math.max(0.05, l - 0.06) : Math.min(0.97, l + 0.06)]);
    const on = BD.color.contrast(out, [255, 255, 255]) >= BD.color.contrast(out, [10, 10, 12]) ? "#fcfbf9" : "#0a0a0c";
    return { accent: BD.color.toHex(out), hover: BD.color.toHex(hover), pressed: BD.color.toHex(pressed), on };
  },

  apply(rgb) {
    const c = this.fit(rgb);
    const style = document.documentElement.style;
    style.setProperty("--bd-accent", c.accent);
    style.setProperty("--bd-accent-hover", c.hover);
    style.setProperty("--bd-accent-pressed", c.pressed);
    style.setProperty("--bd-accent-soft", `color-mix(in srgb, ${c.accent} 16%, transparent)`);
    style.setProperty("--bd-accent-text", c.accent);
    style.setProperty("--bd-on-accent", c.on);
  },

  update() {
    const img = BD.q('[data-bd="dock"] [data-testid="item_cover"] img');
    const src = img?.currentSrc || img?.src;
    const html = document.documentElement;
    // Recompute on a new cover, and when the theme or light/dark mode changes the ground.
    const key = `${src}|${html.getAttribute("data-bd-skin")}|${html.getAttribute("data-bd-theme")}`;
    if (!src || key === this.key) return;
    this.key = key;
    const copy = new Image();
    copy.crossOrigin = "anonymous";
    copy.onload = () => {
      if (key !== this.key) return;
      try {
        const rgb = this.pick(copy);
        rgb ? this.apply(rgb) : this.clear();
      } catch {
        this.clear(); // the CDN refused CORS: keep the theme's accent
      }
    };
    copy.onerror = () => this.clear();
    copy.src = src.replace(/\/\d+x\d+-/, "/64x64-");
  }
});

/* ---------- Compact mode ---------- */
BD.defaultOff.add("compact");
BD.feature({
  id: "compact",
  module: true,
  live: true,
  glyph: "M4 6h16M4 10h16M4 14h16M4 18h16",
  label: ["Mode compact", "Compact mode"],
  description: [
    "Lignes de titres et cartes plus serrées pour voir plus de choses à l'écran.",
    "Tighter track rows and cards to fit more on screen."
  ],
  setup() {
    BD.mark(document.documentElement, "true", "data-bd-compact");
  },
  teardown() {
    document.documentElement.removeAttribute("data-bd-compact");
  }
});

/* ---------- Settings > Modules ---------- */
BD.modulesUI = {
  render(ui) {
    // The "now playing" view first: it is the one most people come for.
    const modules = BD.features.filter((f) => f.module).sort((a, b) => (b.id === "nowplaying") - (a.id === "nowplaying"));
    return [
      ui.section(
        null,
        BD.h(
          "p",
          { class: "bd-set-hint" },
          BD.t(
            "Des extras à activer selon vos envies. Chaque module s'applique tout de suite, sans recharger la page.",
            "Extras to turn on as you like. Each module applies at once, without reloading."
          )
        ),
        BD.h("div", { class: "bd-modules" }, modules.map((f) => this.card(ui, f)))
      )
    ];
  },

  card(ui, f) {
    const on = BD.isEnabled(f.id);
    const extra = f.id === "sleep-timer" ? this.sleepControls(ui) : null;
    const card = BD.h(
      "article",
      { class: "bd-module", "data-on": String(on) },
      BD.h("div", { class: "bd-module-icon" }, ui.icon(f.glyph || "M12 4v16M4 12h16")),
      BD.h(
        "div",
        { class: "bd-module-text" },
        BD.h("h4", {}, BD.t(...f.label)),
        f.description ? BD.h("p", {}, BD.t(...f.description)) : null,
        on ? extra : null
      ),
      ui.toggle(`feature:${f.id}`, !BD.defaultOff.has(f.id), () => setTimeout(() => ui.refresh(), 0))
    );
    return card;
  },

  sleepControls(ui) {
    const s = BD.sleep;
    if (!s) return null;
    const wrap = BD.h("div", { class: "bd-sleep-controls" });
    const paint = () => {
      const opts = [
        [15, "15 min"],
        [30, "30 min"],
        [45, "45 min"],
        [60, "1 h"],
        ["track", BD.t("Fin du titre", "End of track")]
      ];
      const buttons = [
        ...opts.map(([v, text]) => BD.h("button", { type: "button", class: "bd-chip-btn", onclick: () => (s.start(v), paint()) }, text)),
        s.timer
          ? BD.h(
              "button",
              { type: "button", class: "bd-chip-btn", "data-variant": "stop", onclick: () => (s.stop(), paint()) },
              BD.t(`Annuler (${s.countdown()})`, `Cancel (${s.countdown()})`)
            )
          : null
      ];
      wrap.replaceChildren(...buttons.filter(Boolean));
    };
    paint();
    return wrap;
  }
};

BD.settingsTab({ id: "modules", order: 7, label: ["Modules", "Modules"], render: (ui) => BD.modulesUI.render(ui) });
