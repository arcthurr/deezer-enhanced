/*
 * Desktop app only: the app's own buttons live in this top bar, so there is ONE bar
 * instead of the app's tool strip stacked above Deezer's.
 *   left   back / forward (the app keeps the navigation history), as a floating pill
 *   right  the app's Settings button, as a floating pill just before the profile picture
 * Settings opens this panel (features/app-settings.js adds the app's own tabs).
 * Silent on the website and in the extension.
 */
BD.feature({
  id: "desktop-bar",

  ICONS: {
    back: "M15 5l-7 7 7 7",
    forward: "M9 5l7 7-7 7",
    // icons8 "support" (the wrench the app always used)
    settings:
      "M20.869,7.795l-0.392-1.872L17.569,9H15V6.43l3.078-2.922l-1.877-0.386C15.809,3.041,15.404,3,15,3 c-3.309,0-6,2.717-6,6.056c0,0.42,0.051,0.845,0.153,1.285l-6.214,6.103c-1.252,1.269-1.252,3.332,0.001,4.601 C3.55,21.66,4.363,22,5.231,22c0.867,0,1.681-0.34,2.28-0.946l6.229-6.12C14.169,15,14.587,15,15,15c3.364,0,6-2.611,6-5.944 C21,8.634,20.956,8.209,20.869,7.795z"
  },

  setup() {
    if (!BD.app.available()) {
      this.asleep = true;
      return;
    }
    BD.mark(document.documentElement, "true", "data-bd-desktop");
    BD.app.load();
    BD.on("app", (key) => key === "ready" && BD.features.find((f) => f.id === "settings")?.refresh?.());
  },

  icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (name === "settings") svg.setAttribute("data-fill", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", this.ICONS[name]);
    svg.append(path);
    return svg;
  },

  button(name, label, onclick) {
    return BD.h("button", { type: "button", class: "bd-app-btn", "data-bd-app": name, "aria-label": label, title: label, onclick }, this.icon(name));
  },

  toggleSettings() {
    const settings = BD.features.find((f) => f.id === "settings");
    if (!settings) return;
    settings.isOpen() ? settings.close() : settings.open();
  },

  update() {
    if (this.asleep) return;
    const topbar = BD.q('[data-bd="topbar"]');
    if (!topbar) return;
    const api = window.view.appAPI;

    if (!BD.q(".bd-app-nav", topbar)) {
      topbar.append(
        BD.h(
          "div",
          { class: "bd-app-nav", role: "group", "aria-label": BD.t("Navigation", "Navigation") },
          this.button("back", BD.t("Précédent", "Back"), () => api.goBack()),
          this.button("forward", BD.t("Suivant", "Forward"), () => api.goForward())
        )
      );
    }

    let actions = BD.q(".bd-app-actions", topbar);
    if (!actions) {
      actions = BD.h("div", { class: "bd-app-actions", role: "group" }, this.button("settings", BD.t("Réglages", "Settings"), () => this.toggleSettings()));
      topbar.append(actions);
    }
    // Just before the profile picture: Deezer's last own child in the bar.
    const own = [...topbar.children].filter((c) => !c.classList.contains("bd-app-nav") && !c.classList.contains("bd-app-actions") && !c.classList.contains("bd-home"));
    const profile = own[own.length - 1];
    if (profile && profile !== BD.q('[data-bd="search-slot"]', topbar) && actions.nextElementSibling !== profile) topbar.insertBefore(actions, profile);
  },

  teardown() {
    document.documentElement.removeAttribute("data-bd-desktop");
  }
});
