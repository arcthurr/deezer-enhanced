/*
 * Settings > Themes: light / dark / auto mode, your themes, the community
 * Marketplace, install from a link or a file, and a theme editor with live
 * preview, contrast warnings and export (JSON to share or to send as a pull
 * request to themes/community, see docs/themes.md).
 * The engine lives in core/30-themes.js (BD.skins, BD.themeSchema).
 */
BD.feature({
  id: "themes",
  setup() {
    // Re-apply when another tab installs or switches a theme.
    addEventListener("storage", (e) => {
      if (e.key === "bd:themes:active" || e.key === "bd:themes:installed") BD.skins.apply();
    });
  }
});

BD.themesUI = {
  COLOR_LABELS: {
    bg: ["Fond", "Background"],
    "surface-1": ["Surface 1 (rail, lecteur)", "Surface 1 (rail, player)"],
    "surface-2": ["Surface 2 (champs, survols)", "Surface 2 (fields, hovers)"],
    "surface-3": ["Surface 3 (actif)", "Surface 3 (active)"],
    "surface-4": ["Surface 4", "Surface 4"],
    line: ["Bordures", "Borders"],
    "line-strong": ["Bordures marquées", "Strong borders"],
    text: ["Texte", "Text"],
    "text-2": ["Texte secondaire", "Secondary text"],
    "text-3": ["Texte discret", "Muted text"],
    accent: ["Accent", "Accent"],
    "accent-text": ["Texte d'accent", "Accent text"],
    "on-accent": ["Sur l'accent", "On accent"]
  },

  mode() {
    return document.documentElement.getAttribute("data-bd-theme") || "dark";
  },

  /** Small visual preview of a theme: ground, surfaces, text lines and accent. */
  preview(theme, mode = this.mode()) {
    const modes = theme.modes || ["dark", "light"];
    const m = modes.includes(mode) ? mode : modes[0];
    const p = BD.skins.palette(theme, m);
    const box = BD.h("div", { class: "bd-theme-preview", "aria-hidden": "true" });
    box.style.cssText = `--p-bg:${p.bg};--p-s1:${p["surface-1"]};--p-s2:${p["surface-2"]};--p-text:${p.text};--p-text2:${p["text-2"]};--p-accent:${p.accent};--p-line:${p.line}`;
    box.append(
      BD.h("span", { class: "p-rail" }),
      BD.h("span", { class: "p-title" }),
      BD.h("span", { class: "p-line1" }),
      BD.h("span", { class: "p-card" }),
      BD.h("span", { class: "p-card p-card2" }),
      BD.h("span", { class: "p-dock" }, BD.h("span", { class: "p-play" }))
    );
    return box;
  },

  card(theme, actions, ui) {
    const active = BD.skins.activeId() === theme.id;
    const modes = theme.modes || ["dark", "light"];
    const badge = modes.length === 1 ? (modes[0] === "dark" ? BD.t("Sombre uniquement", "Dark only") : BD.t("Clair uniquement", "Light only")) : null;
    return BD.h(
      "article",
      { class: "bd-theme-card", "data-active": String(active), "aria-label": theme.name },
      this.preview(theme),
      BD.h(
        "div",
        { class: "bd-theme-meta" },
        BD.h("strong", {}, theme.name, active ? BD.h("em", { class: "bd-badge-on" }, BD.t("Actif", "Active")) : null),
        BD.h("span", {}, [theme.author, badge].filter(Boolean).join(" · ")),
        theme.description ? BD.h("p", {}, theme.description) : null
      ),
      BD.h("div", { class: "bd-theme-actions" }, ...actions.filter(Boolean))
    );
  },

  button(label, onclick, kind = "") {
    return BD.h("button", { type: "button", class: `bd-btn ${kind}`.trim(), onclick }, label);
  },

  download(theme) {
    const blob = new Blob([BD.skins.toJSON(theme)], { type: "application/json" });
    const a = BD.h("a", { href: URL.createObjectURL(blob), download: `${theme.id}.json` });
    document.body.append(a);
    a.click();
    setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
  },

  message(ui, text, kind = "info") {
    const box = BD.q("#bd-settings .bd-theme-message");
    if (!box) return;
    box.textContent = text;
    box.dataset.kind = kind;
    box.hidden = !text;
  },

  report(ui, result, okText) {
    if (result.ok) {
      this.message(ui, okText, "ok");
      ui.refresh();
      setTimeout(() => this.message(ui, okText, "ok"), 0);
    } else {
      this.message(ui, `${BD.t("Thème refusé", "Theme rejected")} : ${result.errors.join(" · ")}`, "error");
    }
  },

  render(ui) {
    const installedIds = new Set(BD.skins.installed().map((t) => t.id));
    const forced = BD.theme.forced;

    const mine = BD.skins.all().map((theme) =>
      this.card(
        theme,
        [
          BD.skins.activeId() === theme.id
            ? null
            : this.button(BD.t("Appliquer", "Apply"), () => (BD.skins.activate(theme.id), ui.refresh())),
          this.button(BD.t("Personnaliser", "Customize"), () => this.editor(ui, theme), "bd-btn-ghost"),
          installedIds.has(theme.id) ? this.button(BD.t("Exporter", "Export"), () => this.download(theme), "bd-btn-ghost") : null,
          installedIds.has(theme.id)
            ? this.button(
                BD.t("Supprimer", "Delete"),
                () => {
                  if (confirm(BD.t(`Supprimer le thème « ${theme.name} » ?`, `Delete the theme "${theme.name}"?`))) {
                    BD.skins.remove(theme.id);
                    ui.refresh();
                  }
                },
                "bd-btn-danger"
              )
            : null
        ],
        ui
      )
    );

    const market = BD.h("div", { class: "bd-theme-grid", "aria-busy": "true" }, BD.h("p", { class: "bd-set-hint" }, BD.t("Chargement du Marketplace…", "Loading the Marketplace…")));
    const marketStatus = BD.h("p", { class: "bd-set-hint" });
    BD.skins.registry().then(({ online, themes }) => {
      market.removeAttribute("aria-busy");
      marketStatus.textContent = online
        ? BD.t(`${themes.length} thèmes de la communauté, à jour.`, `${themes.length} community themes, up to date.`)
        : BD.t("Hors ligne : thèmes de la communauté inclus dans cette version.", "Offline: community themes shipped with this version.");
      const installed = new Map(BD.skins.installed().map((t) => [t.id, t]));
      market.replaceChildren(
        ...themes.map((theme) => {
          const have = installed.get(theme.id);
          const label = !have ? BD.t("Installer", "Install") : have.version !== theme.version ? BD.t("Mettre à jour", "Update") : null;
          return this.card(
            theme,
            [
              label
                ? this.button(label, () => {
                    const r = BD.skins.install(theme);
                    if (r.ok) BD.skins.activate(theme.id);
                    this.report(ui, r, BD.t(`« ${theme.name} » installé et appliqué.`, `"${theme.name}" installed and applied.`));
                  })
                : BD.h("span", { class: "bd-set-hint" }, BD.t("Installé", "Installed"))
            ],
            ui
          );
        })
      );
    });

    const urlInput = BD.h("input", { type: "url", class: "bd-input", placeholder: "https://raw.githubusercontent.com/…/mon-theme.json", "aria-label": BD.t("Lien du thème", "Theme link") });
    const fileInput = BD.h("input", { type: "file", accept: ".json,application/json", class: "bd-visually-hidden", "aria-hidden": "true", tabindex: "-1" });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const r = BD.skins.install(JSON.parse(await file.text()));
        if (r.ok) BD.skins.activate(r.theme.id);
        this.report(ui, r, BD.t(`« ${r.theme?.name} » installé et appliqué.`, `"${r.theme?.name}" installed and applied.`));
      } catch (err) {
        this.message(ui, `${BD.t("Fichier illisible", "Unreadable file")} : ${err.message}`, "error");
      }
    });

    return [
      this.messageBox(),
      ui.section(
        BD.t("Mode", "Mode"),
        ui.row(
          BD.t("Clair, sombre ou automatique", "Light, dark or automatic"),
          forced
            ? BD.t(`Le thème actif n'existe qu'en ${forced === "dark" ? "sombre" : "clair"}.`, `The active theme only exists in ${forced}.`)
            : BD.t("Auto suit le réglage de Windows / du navigateur.", "Auto follows your system setting."),
          ui.segmented("theme", BD.theme.get(), [["light", "Clair", "Light"], ["dark", "Sombre", "Dark"], ["system", "Auto", "Auto"]], (v) => (BD.theme.set(v), ui.refresh()), Boolean(forced))
        )
      ),
      ui.section(
        BD.t("Vos thèmes", "Your themes"),
        BD.h("div", { class: "bd-theme-grid" }, ...mine),
        BD.h("div", { class: "bd-actions" }, this.button(BD.t("Créer un thème", "Create a theme"), () => this.editor(ui, BD.skins.get(BD.skins.activeId()), true)))
      ),
      ui.section(BD.t("Marketplace", "Marketplace"), marketStatus, market),
      ui.section(
        BD.t("Installer un thème", "Install a theme"),
        BD.h(
          "p",
          { class: "bd-set-hint" },
          BD.t(
            "Un thème est un fichier .json (couleurs et CSS, jamais de code). Collez un lien direct vers le fichier ou choisissez-le sur votre ordinateur.",
            "A theme is a .json file (colors and CSS, never code). Paste a direct link to the file or pick it on your computer."
          )
        ),
        BD.h(
          "div",
          { class: "bd-inline-form" },
          urlInput,
          this.button(BD.t("Installer", "Install"), async () => {
            this.message(ui, BD.t("Téléchargement…", "Downloading…"));
            const r = await BD.skins.installFromUrl(urlInput.value.trim());
            if (r.ok) BD.skins.activate(r.theme.id);
            this.report(ui, r, BD.t(`« ${r.theme?.name} » installé et appliqué.`, `"${r.theme?.name}" installed and applied.`));
          })
        ),
        BD.h("div", { class: "bd-actions" }, fileInput, this.button(BD.t("Choisir un fichier…", "Choose a file…"), () => fileInput.click(), "bd-btn-ghost"))
      )
    ];
  },

  messageBox() {
    return BD.h("p", { class: "bd-theme-message", role: "status", hidden: true });
  },

  /** Theme editor: edits a copy of `base`, previews live, saves as an installed theme. */
  editor(ui, base, fresh = false) {
    const body = BD.q("#bd-settings .bd-settings-body");
    if (!body) return;
    const own = BD.skins.installed().some((t) => t.id === base?.id) && !fresh;
    const draft = {
      schema: 1,
      id: own ? base.id : "",
      name: own ? base.name : fresh ? BD.t("Mon thème", "My theme") : `${base?.name || "Graphite"} ${BD.t("perso", "custom")}`,
      author: own ? base.author || "" : "",
      description: own ? base.description || "" : "",
      version: own ? base.version || "1.0.0" : "1.0.0",
      modes: ["dark", "light"],
      colors: { dark: BD.skins.palette(base, "dark"), light: BD.skins.palette(base, "light") },
      radius: { ...(base?.radius || {}) },
      css: base?.css || ""
    };
    let mode = this.mode();
    const modeBefore = BD.theme.get();
    const slug = (s) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 36) || "theme";

    const sourceId = base?.id;
    const preview = () => {
      if (!draft.id) draft.id = `${slug(draft.name)}-${Date.now().toString(36).slice(-4)}`;
      // CSS copied from another theme targets its id: point it at this one.
      if (sourceId && sourceId !== draft.id) draft.css = draft.css.split(`data-bd-skin="${sourceId}"`).join(`data-bd-skin="${draft.id}"`);
      BD.skins.apply({ ...draft }, { preview: true });
      const warnings = BD.themeSchema.checkContrast(draft.colors[mode]);
      warn.textContent = warnings.length ? `${BD.t("Lisibilité", "Readability")} : ${warnings.join(" · ")}` : BD.t("Contrastes OK.", "Contrast OK.");
      warn.dataset.kind = warnings.length ? "warn" : "ok";
    };

    const warn = BD.h("p", { class: "bd-theme-message", role: "status" });
    const colorsBox = BD.h("div", { class: "bd-color-grid" });
    const drawColors = () => {
      colorsBox.replaceChildren(
        ...BD.themeSchema.COLOR_KEYS.map((key) => {
          const input = BD.h("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(draft.colors[mode][key]) ? draft.colors[mode][key] : "#000000", "aria-label": BD.t(...this.COLOR_LABELS[key]) });
          const code = BD.h("code", {}, draft.colors[mode][key]);
          input.addEventListener("input", () => {
            draft.colors[mode][key] = input.value;
            code.textContent = input.value;
            preview();
          });
          return BD.h("label", { class: "bd-color" }, input, BD.h("span", {}, BD.t(...this.COLOR_LABELS[key]), code));
        })
      );
    };
    const field = (label, key, attrs = {}) => {
      const input = BD.h("input", { type: "text", class: "bd-input", value: draft[key], "aria-label": label, ...attrs });
      input.addEventListener("input", () => {
        draft[key] = input.value;
        if (key === "name") preview();
      });
      return BD.h("label", { class: "bd-field" }, BD.h("span", {}, label), input);
    };
    const cssInput = BD.h("textarea", { class: "bd-input bd-code", rows: "6", spellcheck: "false", placeholder: "/* CSS optionnel : ciblez [data-bd=\"dock\"], [data-bd=\"rail\"]… */" });
    cssInput.addEventListener("input", () => {
      draft.css = cssInput.value;
      preview();
    });

    const finish = (save) => {
      if (save) {
        const r = BD.skins.install({ ...draft, css: draft.css.trim() || undefined, radius: Object.keys(draft.radius).length ? draft.radius : undefined });
        if (!r.ok) {
          warn.textContent = `${BD.t("Impossible d'enregistrer", "Cannot save")} : ${r.errors.join(" · ")}`;
          warn.dataset.kind = "error";
          return;
        }
        BD.skins.activate(r.theme.id);
      } else {
        BD.skins.apply();
      }
      BD.theme.set(modeBefore);
      ui.select("themes");
    };

    body.replaceChildren(
      ui.section(
        own ? BD.t("Modifier le thème", "Edit theme") : BD.t("Nouveau thème", "New theme"),
        BD.h(
          "p",
          { class: "bd-set-hint" },
          BD.t("L'aperçu est appliqué en direct sur Deezer. Rien n'est enregistré avant « Enregistrer ».", "The preview is applied live to Deezer. Nothing is saved until “Save”.")
        ),
        BD.h("div", { class: "bd-field-grid" }, field(BD.t("Nom", "Name"), "name", { maxlength: "60" }), field(BD.t("Auteur", "Author"), "author", { maxlength: "60" })),
        field(BD.t("Description", "Description"), "description", { maxlength: "240" })
      ),
      ui.section(
        BD.t("Couleurs", "Colors"),
        ui.segmented("themes:editor-mode", mode, [["dark", "Palette sombre", "Dark palette"], ["light", "Palette claire", "Light palette"]], (v) => {
          mode = v;
          BD.theme.set(v);
          drawColors();
          preview();
        }),
        colorsBox,
        warn
      ),
      ui.section(BD.t("CSS avancé (optionnel)", "Advanced CSS (optional)"), BD.h("p", { class: "bd-set-hint" }, BD.t("Pas de url() ni @import : un thème ne peut rien charger. Voir docs/themes.md.", "No url() or @import: a theme cannot load anything. See docs/themes.md.")), cssInput),
      BD.h(
        "div",
        { class: "bd-actions bd-sticky-actions" },
        this.button(BD.t("Enregistrer et appliquer", "Save and apply"), () => finish(true)),
        this.button(BD.t("Exporter .json", "Export .json"), () => this.download({ ...draft, id: draft.id || slug(draft.name) }), "bd-btn-ghost"),
        this.button(BD.t("Annuler", "Cancel"), () => finish(false), "bd-btn-ghost")
      )
    );
    drawColors();
    preview();
    cssInput.value = draft.css;
  }
};

BD.settingsTab({ id: "themes", order: 5, label: ["Thèmes", "Themes"], render: (ui) => BD.themesUI.render(ui) });
