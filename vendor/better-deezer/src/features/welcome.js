/*
 * First run: a small card that says Better Deezer is on and where things are.
 * Shown once per browser (bd:welcome = true afterwards); the startup badge
 * takes over on the following loads.
 */
BD.feature({
  id: "welcome",

  setup() {
    if (BD.settings.get("welcome", false)) return;
    BD.welcomeShown = true; // main.js skips the startup badge this time
    setTimeout(() => this.show(), 1500);
  },

  dismiss(card) {
    BD.settings.set("welcome", true);
    card.setAttribute("data-closing", "true");
    setTimeout(() => card.remove(), 180);
  },

  show() {
    if (document.getElementById("bd-welcome")) return;
    const mac = navigator.platform.startsWith("Mac");
    const kbd = (k) => BD.h("kbd", {}, k);
    const tip = (keys, fr, en) => BD.h("li", {}, BD.h("span", { class: "bd-keys" }, keys.map(kbd)), BD.h("span", {}, BD.t(fr, en)));
    const card = BD.h(
      "aside",
      { id: "bd-welcome", class: "bd-welcome", role: "dialog", "aria-labelledby": "bd-welcome-title" },
      BD.h("p", { class: "bd-welcome-kicker" }, `Better Deezer ${BD.version}`),
      BD.h("h2", { id: "bd-welcome-title" }, BD.t("C'est installé, bonne écoute !", "You're all set, enjoy!")),
      BD.h(
        "ul",
        { class: "bd-shortcuts" },
        tip([mac ? "⌘" : "Ctrl", ","], "Réglages, thèmes et modules", "Settings, themes and modules"),
        tip(["F"], "Paroles synchronisées et grande pochette", "Synced lyrics and big cover"),
        tip([BD.t("Molette", "Wheel")], "Sur le volume ou la pochette du lecteur", "Over the volume or the player's cover")
      ),
      BD.h(
        "div",
        { class: "bd-welcome-actions" },
        BD.h("button", { type: "button", class: "bd-btn bd-btn-ghost", onclick: () => this.dismiss(card) }, BD.t("Plus tard", "Later")),
        BD.h(
          "button",
          {
            type: "button",
            class: "bd-btn",
            onclick: () => {
              this.dismiss(card);
              BD.openSettings?.("themes");
            }
          },
          BD.t("Choisir un thème", "Pick a theme")
        )
      )
    );
    document.body.appendChild(card);
  }
});
