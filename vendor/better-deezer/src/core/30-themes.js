/*
 * Themes ("skins"), Spicetify style but declarative and safe.
 *
 * A theme is a JSON file (format: docs/themes.md, examples: themes/):
 *   {
 *     "schema": 1, "id": "nocturne", "name": "Nocturne", "author": "…",
 *     "description": "…", "version": "1.0.0",
 *     "modes": ["dark", "light"],               // palettes it provides
 *     "colors": { "dark": { "bg": "#…", … }, "light": { … } },
 *     "radius": { "card": 14, "dock": 22 },      // optional, px
 *     "fonts": { "display": "…", "ui": "…" },    // optional, installed fonts only
 *     "css": "…"                                 // optional, no url() / @import
 *   }
 * Missing colors fall back to the Graphite defaults (00-tokens.css), so a theme
 * can be as small as an accent color.
 *
 * Safety: no JavaScript, no remote resources. CSS containing url(), @import,
 * expression(), javascript: or behaviors is rejected, so a theme cannot load
 * anything or track you. The same validator runs in scripts/build.mjs for the
 * themes shipped in the repository.
 *
 * Not to confuse with BD.theme (core/20-theme.js): the light / dark / auto mode.
 */
BD.themeSchema = {
  VERSION: 1,
  COLOR_KEYS: [
    "bg",
    "surface-1",
    "surface-2",
    "surface-3",
    "surface-4",
    "line",
    "line-strong",
    "text",
    "text-2",
    "text-3",
    "accent",
    "accent-text",
    "on-accent"
  ],
  /** Colors the editor shows first (the rest are optional). */
  MAIN_KEYS: ["bg", "surface-1", "surface-2", "text", "text-2", "accent"],
  RADIUS_KEYS: { chip: [0, 16], cover: [0, 24], card: [0, 32], menu: [0, 32], dock: [0, 40] },
  MAX_CSS: 20000,
  COLOR_RE: /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i,
  FONT_RE: /^[\w\s,"'-]{1,120}$/,
  ID_RE: /^[a-z0-9][a-z0-9-]{1,40}$/,
  FORBIDDEN_CSS: [/url\s*\(/i, /@import/i, /expression\s*\(/i, /javascript:/i, /behavior\s*:/i, /-moz-binding/i, /<\/?\s*style/i, /\\[0-9a-f]/i],

  /** Returns { ok, theme, errors } with a cleaned copy of the theme. */
  validate(input) {
    const errors = [];
    const t = input && typeof input === "object" ? input : null;
    if (!t) return { ok: false, errors: ["not a JSON object"] };
    const out = { schema: this.VERSION };

    if (t.schema !== undefined && t.schema !== this.VERSION) errors.push(`unsupported schema ${t.schema} (expected ${this.VERSION})`);
    if (!this.ID_RE.test(String(t.id || ""))) errors.push('"id": 2-41 lowercase letters, digits or dashes');
    else out.id = t.id;
    for (const k of ["name", "author", "description", "version"]) {
      const v = t[k];
      if (v === undefined) continue;
      if (typeof v !== "string" || v.length > (k === "description" ? 240 : 60)) errors.push(`"${k}" must be a short string`);
      else out[k] = v.trim();
    }
    if (!out.name) errors.push('"name" is required');

    out.colors = {};
    const colors = t.colors && typeof t.colors === "object" ? t.colors : {};
    for (const mode of ["dark", "light"]) {
      if (!colors[mode]) continue;
      out.colors[mode] = {};
      for (const [k, v] of Object.entries(colors[mode])) {
        if (!this.COLOR_KEYS.includes(k)) errors.push(`colors.${mode}: unknown key "${k}"`);
        else if (typeof v !== "string" || !this.COLOR_RE.test(v.trim())) errors.push(`colors.${mode}.${k}: "${v}" is not a color`);
        else out.colors[mode][k] = v.trim();
      }
    }
    const modes = Array.isArray(t.modes) ? t.modes.filter((m) => m === "dark" || m === "light") : Object.keys(out.colors);
    out.modes = modes.length ? [...new Set(modes)] : ["dark", "light"];

    if (t.radius && typeof t.radius === "object") {
      out.radius = {};
      for (const [k, v] of Object.entries(t.radius)) {
        const range = this.RADIUS_KEYS[k];
        if (!range) errors.push(`radius: unknown key "${k}"`);
        else if (typeof v !== "number" || v < range[0] || v > range[1]) errors.push(`radius.${k}: ${range[0]}-${range[1]}`);
        else out.radius[k] = Math.round(v);
      }
    }

    if (t.fonts && typeof t.fonts === "object") {
      out.fonts = {};
      for (const k of ["display", "ui"]) {
        const v = t.fonts[k];
        if (v === undefined) continue;
        if (typeof v !== "string" || !this.FONT_RE.test(v)) errors.push(`fonts.${k}: letters, spaces, commas and quotes only`);
        else out.fonts[k] = v;
      }
    }

    if (t.css !== undefined) {
      if (typeof t.css !== "string" || t.css.length > this.MAX_CSS) errors.push(`"css" must be a string under ${this.MAX_CSS} characters`);
      else if (this.FORBIDDEN_CSS.some((re) => re.test(t.css))) errors.push('"css" may not use url(), @import, expression(), javascript:, behaviors or escapes');
      else out.css = t.css;
    }

    return { ok: errors.length === 0, theme: out, errors };
  },

  /** WCAG contrast ratio between two #rrggbb colors (null if not hex). */
  contrast(a, b) {
    const lum = (hex) => {
      const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
      if (!m) return null;
      const c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const x = lum(a);
    const y = lum(b);
    if (x === null || y === null) return null;
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  },

  /** Readability warnings for a palette (used by the editor and the build). */
  checkContrast(palette) {
    const rules = [
      ["text", "bg", 7],
      ["text-2", "bg", 4.5],
      ["text-3", "bg", 4.5],
      ["text", "surface-2", 4.5],
      ["accent-text", "bg", 4.5],
      ["on-accent", "accent", 3]
    ];
    const warnings = [];
    for (const [fg, bg, min] of rules) {
      const r = this.contrast(palette[fg], palette[bg]);
      if (r !== null && r < min) warnings.push(`${fg} on ${bg}: ${r.toFixed(2)} (min ${min})`);
    }
    return warnings;
  }
};

/** Runtime: built-in themes (bundled), installed ones (localStorage), the active one. */
BD.skins = {
  /** Filled by scripts/build.mjs from themes/builtin and themes/community. */
  builtin: typeof __BD_THEMES__ !== "undefined" ? __BD_THEMES__.builtin : [],
  catalog: typeof __BD_THEMES__ !== "undefined" ? __BD_THEMES__.community : [],
  /** Graphite palettes from 00-tokens.css: what a theme's missing colors fall back to. */
  defaults: typeof __BD_THEMES__ !== "undefined" ? __BD_THEMES__.defaults : { dark: {}, light: {} },

  /** Full palette of a theme for a mode (its colors over the defaults). */
  palette(theme, mode) {
    const merged = { ...this.defaults[mode], ...(theme?.colors?.[mode] || {}) };
    return Object.fromEntries(BD.themeSchema.COLOR_KEYS.filter((k) => merged[k]).map((k) => [k, merged[k]]));
  },
  REGISTRY_URL: "https://raw.githubusercontent.com/Gabizoc/Better-Deezer/HEAD/themes/index.json",

  installed() {
    return BD.settings.get("themes:installed", []).filter((t) => BD.themeSchema.validate(t).ok);
  },

  all() {
    const seen = new Set();
    return [...this.builtin, ...this.installed()].filter((t) => !seen.has(t.id) && seen.add(t.id));
  },

  get(id) {
    return this.all().find((t) => t.id === id) || null;
  },

  activeId() {
    const id = BD.settings.get("themes:active", "graphite");
    return this.get(id) ? id : "graphite";
  },

  isBuiltin(id) {
    return this.builtin.some((t) => t.id === id);
  },

  /** CSS for a theme: palettes per mode, then radii and fonts, then its own CSS. */
  css(theme) {
    if (!theme) return "";
    const sel = `html[data-bd-skin="${theme.id}"]`;
    const decl = (vars) =>
      Object.entries(vars)
        .map(([k, v]) => `  --bd-${k}: ${v};`)
        .join("\n");
    let out = "";
    for (const mode of ["dark", "light"]) {
      const p = theme.colors?.[mode];
      if (!p || !Object.keys(p).length) continue;
      const vars = { ...p };
      // Derived tokens, unless the theme sets them.
      if (p.accent) {
        const mixWith = mode === "dark" ? "white" : "black";
        vars["accent-hover"] = `color-mix(in srgb, ${p.accent} 88%, ${mixWith})`;
        vars["accent-pressed"] = `color-mix(in srgb, ${p.accent} 82%, black)`;
        vars["accent-soft"] = `color-mix(in srgb, ${p.accent} ${mode === "dark" ? 16 : 12}%, transparent)`;
      }
      if (p.text && p.bg) vars["text-disabled"] = `color-mix(in srgb, ${p.text} 38%, ${p.bg})`;
      out += `${sel}[data-bd-theme="${mode}"] {\n${decl(vars)}\n}\n`;
    }
    const extra = {};
    for (const [k, v] of Object.entries(theme.radius || {})) extra[`r-${k}`] = `${v}px`;
    if (theme.fonts?.display) extra["font-display"] = theme.fonts.display;
    if (theme.fonts?.ui) extra["font-ui"] = theme.fonts.ui;
    if (Object.keys(extra).length) out += `${sel} {\n${decl(extra)}\n}\n`;
    if (theme.css) out += `/* ${theme.id}: theme CSS */\n${theme.css}\n`;
    return out;
  },

  /** Apply a theme now (preview = do not save it as the active one). */
  apply(theme = this.get(this.activeId()), { preview = false } = {}) {
    const html = document.documentElement;
    let style = document.getElementById("bd-skin");
    if (!style) {
      style = document.createElement("style");
      style.id = "bd-skin";
      (document.head || html).appendChild(style);
    }
    style.textContent = this.css(theme);
    html.setAttribute("data-bd-skin", theme?.id || "graphite");
    // A dark-only theme forces dark, a light-only one forces light.
    const modes = theme?.modes || ["dark", "light"];
    html.setAttribute("data-bd-skin-modes", modes.join(" "));
    BD.theme.forced = modes.length === 1 ? modes[0] : null;
    BD.theme.apply();
    if (!preview) BD.emit("skin", theme);
  },

  activate(id) {
    if (!this.get(id)) return false;
    BD.settings.set("themes:active", id);
    this.apply();
    return true;
  },

  /** Install (or update) a theme object. Returns the validation result. */
  install(raw) {
    const result = BD.themeSchema.validate(raw);
    if (!result.ok) return result;
    if (this.isBuiltin(result.theme.id)) return { ok: false, errors: [`"${result.theme.id}" is a built-in theme id, pick another one`] };
    const list = BD.settings.get("themes:installed", []).filter((t) => t.id !== result.theme.id);
    list.push(result.theme);
    BD.settings.set("themes:installed", list);
    return result;
  },

  remove(id) {
    BD.settings.set(
      "themes:installed",
      BD.settings.get("themes:installed", []).filter((t) => t.id !== id)
    );
    if (BD.settings.get("themes:active") === id) BD.settings.set("themes:active", "graphite");
    this.apply();
  },

  /** Fetch a theme JSON from a URL (GitHub raw, Gist raw…) and install it. */
  async installFromUrl(url) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return { ok: false, errors: ["invalid link"] };
    }
    if (u.protocol !== "https:") return { ok: false, errors: ["the link must start with https://"] };
    try {
      const res = await fetch(u.href, { credentials: "omit", cache: "no-cache" });
      if (!res.ok) return { ok: false, errors: [`download failed (HTTP ${res.status})`] };
      const text = await res.text();
      if (text.length > 100000) return { ok: false, errors: ["file too large"] };
      return this.install(JSON.parse(text));
    } catch (err) {
      return { ok: false, errors: [`download failed: ${err.message}`] };
    }
  },

  /** Community registry: online version if reachable, else the copy bundled at build time. */
  registry() {
    // One request per session: the result is kept (online list, or the bundled copy).
    this.registryPromise ||= this.fetchRegistry();
    return this.registryPromise;
  },

  async fetchRegistry() {
    try {
      const res = await fetch(this.REGISTRY_URL, { credentials: "omit", cache: "no-cache" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.themes)) {
          const themes = data.themes.map((t) => BD.themeSchema.validate(t)).filter((r) => r.ok).map((r) => r.theme);
          return { online: true, themes };
        }
      }
    } catch {}
    return { online: false, themes: this.catalog };
  },

  /** Theme as pretty JSON, ready to share. */
  toJSON(theme) {
    const { schema, id, name, author, description, version, modes, colors, radius, fonts, css } = theme;
    return JSON.stringify({ schema, id, name, author, description, version, modes, colors, radius, fonts, css }, null, 2) + "\n";
  },

  /** The palette currently on screen (for "start from current"). */
  currentPalette() {
    const cs = getComputedStyle(document.documentElement);
    const toHex = (v) => {
      v = v.trim();
      if (/^#/.test(v)) return v.toLowerCase();
      const m = v.match(/\d+(\.\d+)?/g);
      return m && m.length >= 3 ? "#" + m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("") : v;
    };
    return Object.fromEntries(BD.themeSchema.COLOR_KEYS.map((k) => [k, toHex(cs.getPropertyValue(`--bd-${k}`))]));
  }
};
