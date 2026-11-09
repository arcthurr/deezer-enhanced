/*
 * Deezer Enhanced settings, inside the Better Deezer panel (desktop app only).
 * One place for everything: the app's own settings (tray, notifications, Discord,
 * volume curve, window) appear under "Deezer Enhanced" in the left
 * column, above Better Deezer's tabs. They are stored by the app (preferences.json)
 * and read / written through the bridge in core/40-app.js.
 */
BD.appSettingsUI = {
  /** Switch bound to an app setting. */
  toggle(key, fallback, onChange, disabled) {
    const input = BD.h("input", {
      type: "checkbox",
      role: "switch",
      class: "bd-switch",
      disabled,
      onchange: () => {
        BD.app.set(key, input.checked);
        onChange?.(input.checked);
      }
    });
    input.checked = BD.app.get(key, fallback) === true;
    return input;
  },

  /** "Restart the app" banner, shown once a setting that needs it was changed. */
  restartBar() {
    return BD.h(
      "div",
      { class: "bd-reload" },
      BD.h("span", {}, BD.t("Redémarrez l'application pour appliquer.", "Restart the app to apply.")),
      BD.h("button", { type: "button", class: "bd-btn", onclick: () => BD.app.relaunch() }, BD.t("Redémarrer", "Restart"))
    );
  },

  slider(key, fallback, min, max, step = 1) {
    const value = BD.h("span", { class: "bd-range-value" }, String(BD.app.get(key, fallback)));
    const input = BD.h("input", { type: "range", class: "bd-range", min: String(min), max: String(max), step: String(step), "aria-label": key });
    input.value = String(BD.app.get(key, fallback));
    input.addEventListener("input", () => (value.textContent = input.value));
    input.addEventListener("change", () => BD.app.set(key, Number(input.value)));
    return BD.h("div", { class: "bd-range-wrap" }, input, value);
  },

  /** Tab: window behaviour, tray and notifications. */
  application(ui) {
    const refresh = () => ui.refresh();
    const tray = BD.app.get("enableTray", false) === true;
    return [
      ui.section(
        BD.t("Zone de notification", "System tray"),
        ui.row(BD.t("Icône dans la zone de notification", "Tray icon"), BD.t("Affiche une icône avec les commandes de lecture.", "Shows an icon with playback controls."), this.toggle("enableTray", false, refresh)),
        ui.row(BD.t("Fermer vers la zone de notification", "Close to tray"), BD.t("La croix de la fenêtre réduit l'application au lieu de la quitter.", "The window's close button hides the app instead of quitting."), this.toggle("closeToTray", false, null, !tray)),
        ui.row(BD.t("Démarrer réduit", "Start in tray"), BD.t("Lance l'application sans afficher la fenêtre.", "Starts the app without showing the window."), this.toggle("startInTray", false, null, !tray))
      ),
      ui.section(
        BD.t("Notifications", "Notifications"),
        ui.row(BD.t("Notification à chaque titre", "Notification on song change"), BD.t("Une notification du bureau quand le titre change.", "A desktop notification when the song changes."), this.toggle("enableNotifications", false))
      ),
      ui.section(
        BD.t("Fenêtre", "Window"),
        ui.row(
          BD.t("Fenêtre transparente", "See-through window"),
          BD.t("Réglé dans Thèmes › Transparence, avec le mode translucide.", "Set in Themes › Translucency, together with translucent mode."),
          BD.h("button", { type: "button", class: "bd-btn bd-btn-ghost", onclick: () => ui.select("themes") }, BD.t("Ouvrir Thèmes", "Open Themes"))
        )
      )
    ];
  },

  /** Tab: volume curve and Discord. */
  integrations(ui) {
    return [
      ui.section(
        BD.t("Volume", "Volume"),
        ui.row(
          BD.t("Courbe de volume non linéaire", "Non-linear volume curve"),
          BD.t("0 = volume linéaire de Deezer. Plus la valeur est haute, plus le réglage est fin aux faibles volumes.", "0 = Deezer's normal linear volume. The higher, the finer the control at low volumes."),
          this.slider("volumePower", 4, 0, 10)
        )
      ),
      ui.section(
        BD.t("Discord", "Discord"),
        ui.row(BD.t("Présence Discord (Rich Presence)", "Discord Rich Presence"), BD.t("Affiche le titre en cours sur votre profil Discord.", "Shows the playing song on your Discord profile."), this.toggle("discordRPC", false))
      )
    ];
  },

  /** Tab: Better Deezer on / off and reset. */
  advanced(ui) {
    return [
      ui.section(
        BD.t("Better Deezer", "Better Deezer"),
        ui.row(
          BD.t("Activer Better Deezer", "Enable Better Deezer"),
          BD.t(
            "Recharge Deezer. Désactivé, l'application revient à sa disposition d'origine : une bande d'outils au-dessus de Deezer et l'ancienne page de réglages.",
            "Reloads Deezer. When off, the app goes back to its original layout: a tool strip above Deezer and the old settings page."
          ),
          this.toggle("betterDeezer", true, null)
        ),
        BD.h("p", { class: "bd-set-hint" }, BD.t(`Better Deezer v${BD.version}`, `Better Deezer v${BD.version}`))
      ),
      ui.section(
        BD.t("Réinitialisation", "Reset"),
        ui.row(
          BD.t("Réinitialiser les réglages de l'application", "Reset the app settings"),
          BD.t("Zone de notification, notifications, Discord, volume, fenêtre transparente. Vos thèmes et réglages Better Deezer ne changent pas.", "Tray, notifications, Discord, volume, see-through window. Your themes and Better Deezer settings are not touched."),
          BD.h(
            "button",
            {
              type: "button",
              class: "bd-btn bd-btn-danger",
              onclick: () => {
                if (!confirm(BD.t("Réinitialiser les réglages de l'application ?", "Reset the app settings?"))) return;
                BD.app.reset();
                setTimeout(() => ui.refresh(), 150);
              }
            },
            BD.t("Réinitialiser", "Reset")
          )
        )
      )
    ];
  }
};

const appTab = (id, order, label, render) =>
  BD.settingsTab({ id, order, label, group: "app", when: () => BD.app.available(), render: (ui) => BD.appSettingsUI[render](ui) });

appTab("app-general", 1, ["Application", "Application"], "application");
appTab("app-audio", 2, ["Audio et intégrations", "Audio & integrations"], "integrations");
appTab("app-advanced", 3, ["Avancé", "Advanced"], "advanced");
