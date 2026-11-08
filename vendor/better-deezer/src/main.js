/*
 * Boot: inject CSS (desktop build only, the extension declares it in the manifest),
 * apply the theme, run every feature's setup once, then update on DOM changes,
 * one frame at most. A feature that throws is disabled for the session, never the whole app.
 */
(function boot() {
  // Only the top-level Deezer page. The desktop launcher injects into every new
  // document (iframes, login pages...), so this guard matters there.
  if (window.top !== window || !/(^|\.)deezer\.com$/.test(location.hostname)) return;
  if (window.__betterDeezer) return; // already injected (desktop reloads, double inject)

  // Injected at document start by the desktop launcher: wait for the DOM.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
    return;
  }

  // Only the web player. www.deezer.com also serves marketing pages (/explore/...,
  // download, offers) with none of the player's elements: there Better Deezer stays
  // asleep instead of warning about "missing" anchors. The player renders late, so
  // wait for it (layout root, content or player bar) for up to 30 s.
  const isPlayer = () => Boolean(document.querySelector('.naboo, #page_content, [data-testid="miniplayer_container"]'));
  if (/^\/explore(\/|$)/.test(BD.path())) return;
  if (!isPlayer()) {
    if (boot.waiting) return;
    boot.waiting = new MutationObserver(() => {
      if (!isPlayer()) return;
      boot.waiting.disconnect();
      clearTimeout(boot.giveUp);
      boot.waiting = null;
      boot();
    });
    boot.waiting.observe(document.documentElement, { childList: true, subtree: true });
    boot.giveUp = setTimeout(() => boot.waiting?.disconnect(), 30000);
    return;
  }

  const html = document.documentElement;
  if (BD.settings.get("enabled", true) === false) {
    html.setAttribute("data-bd", "off");
    window.__betterDeezer = {
      version: BD.version,
      enable: () => (BD.settings.set("enabled", true), location.reload())
    };
    // Way back without the console: Ctrl/Cmd + , offers to turn it on again.
    document.addEventListener("keydown", (e) => {
      if (!((e.ctrlKey || e.metaKey) && e.key === ",")) return;
      e.preventDefault();
      if (confirm(BD.t("Réactiver Better Deezer ?", "Turn Better Deezer back on?"))) window.__betterDeezer.enable();
    });
    return;
  }

  if (typeof __BD_CSS__ === "string" && !document.getElementById("bd-style")) {
    const style = document.createElement("style");
    style.id = "bd-style";
    style.textContent = __BD_CSS__;
    (document.head || html).appendChild(style);
  }

  BD.theme.init();
  BD.skins.apply();
  html.setAttribute("data-bd", "on");
  html.setAttribute("data-bd-version", BD.version);

  // Features run while enabled. Toggling one in the settings takes effect live:
  // setup() runs when it is switched on, teardown() (optional) when it goes off.
  // Without a teardown, setup() runs only once per page load.
  const failed = new Set();
  const started = new Set();
  BD.failed = failed;

  const safe = (f, method) => {
    if (failed.has(f.id) || typeof f[method] !== "function") return;
    try {
      f[method]();
    } catch (err) {
      failed.add(f.id);
      BD.warn(`feature "${f.id}" disabled after error in ${method}:`, err);
    }
  };
  const start = (f) => {
    if (started.has(f.id)) return;
    started.add(f.id);
    safe(f, "setup");
  };

  BD.features.filter((f) => BD.isEnabled(f.id)).forEach(start);

  let frame = 0;
  const run = () => {
    frame = 0;
    BD.features.forEach((f) => {
      if (started.has(f.id) && BD.isEnabled(f.id)) safe(f, "update");
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(run);
  };
  BD.schedule = schedule;

  BD.on("settings", (key, value) => {
    const id = key.startsWith("feature:") ? key.slice(8) : null;
    const f = id && BD.features.find((x) => x.id === id);
    if (f) {
      if (value === false) {
        safe(f, "teardown");
        // A feature that cleans up after itself sets up again when switched back on.
        if (typeof f.teardown === "function") started.delete(f.id);
      } else start(f);
    }
    schedule();
  });

  // Deezer sometimes only swaps an attribute (like on/off = data-testid): watch those too.
  // Our own marks are data-bd* attributes, not in this list, so they never re-trigger.
  new MutationObserver(schedule).observe(html, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-testid", "aria-label", "aria-pressed"] });
  addEventListener("resize", schedule);
  addEventListener("popstate", schedule);
  run();

  // Health report a few seconds after boot: which anchors resolved.
  setTimeout(() => {
    const health = BD.checkHealth();
    const missing = Object.keys(health).filter((k) => !health[k]);
    if (missing.length) BD.warn("anchors not found (Deezer may have changed, or the element is not on screen):", missing.join(", "));
    else BD.log("all anchors resolved");
  }, 4000);

  if (BD.settings.get("badge", true) && !BD.welcomeShown && document.body) {
    const badge = document.createElement("div");
    badge.className = "bd-badge";
    badge.textContent = `Better Deezer ${BD.version}`;
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 3000);
  }

  // Small console API for debugging and for the next maintainer.
  window.__betterDeezer = {
    version: BD.version,
    target: BD.target,
    health: () => BD.checkHealth(),
    features: () => BD.features.map((f) => ({ id: f.id, on: BD.isEnabled(f.id), failed: failed.has(f.id) })),
    theme: (pref) => (pref ? BD.theme.set(pref) : BD.theme.get()),
    settings: () => BD.openSettings?.(),
    // Theme development from the console (docs/themes.md):
    themes: {
      list: () => BD.skins.all().map((t) => t.id),
      validate: (json) => BD.themeSchema.validate(json),
      install: (json) => BD.skins.install(json),
      activate: (id) => BD.skins.activate(id),
      preview: (json) => {
        const r = BD.themeSchema.validate(json);
        if (r.ok) BD.skins.apply(r.theme, { preview: true });
        return r;
      }
    },
    disable: (id) => BD.settings.set(id ? `feature:${id}` : "enabled", false),
    enable: (id) => BD.settings.set(id ? `feature:${id}` : "enabled", true),
    debug: (on = true) => localStorage.setItem("bd:debug", on ? "1" : "0")
  };

  BD.log(`v${BD.version} (${BD.target}) running on`, location.href);
})();
