// Smoke test: load dist/better-deezer.user.js into Chromium on test/fixture.html,
// served at https://www.deezer.com/fr/ so the payload's host guard passes.
//   npm run build && npm test
// Uses the Playwright found on the machine (not a project dependency: the build stays dependency-free).
// Screenshots go to test/.out/ (git-ignored).
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright not found. Install it globally (npm i -g playwright) to run the smoke test.");
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.env.BD_SHOTS || join(root, "test/.out");
mkdirSync(out, { recursive: true });
const fixture = readFileSync(join(root, "test/fixture.html"), "utf8");
const payload = readFileSync(join(root, "dist/better-deezer.user.js"), "utf8");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.route("https://www.deezer.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fixture })
);
// Same path as the desktop launcher: injected at document start, before the DOM exists.
await context.addInitScript({ content: payload });

let googleFontRequests = 0;
await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
  googleFontRequests++;
  route.abort();
});
// Community theme registry (raw.githubusercontent.com): serve the repository's own index.
const registry = readFileSync(join(root, "themes/index.json"), "utf8");
await context.route("https://raw.githubusercontent.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: registry, headers: { "access-control-allow-origin": "*" } })
);
// LRCLIB (lyrics): a fixed synced answer for the fixture's track.
await context.route("https://lrclib.net/**", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ trackName: "One More Time", artistName: "Daft Punk", duration: 320, instrumental: false, syncedLyrics: "[00:00.50] One more time\n[01:05.00] We're gonna celebrate\n[01:10.00] Oh yeah, all right\n[01:15.00] Don't stop the dancing\n[01:20.00] \n[02:00.00] One more time" })
  })
);
// Deezer's own lyrics (auth.deezer.com token + pipe.deezer.com GraphQL). `deezerLyrics`
// is null until the word-by-word test sets it, so the first runs fall back to LRCLIB.
let deezerLyrics = null;
const cors = { "access-control-allow-origin": "https://www.deezer.com", "access-control-allow-credentials": "true", "access-control-allow-headers": "authorization, content-type, accept", "access-control-allow-methods": "POST, OPTIONS" };
await context.route("https://auth.deezer.com/**", (route) =>
  route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: cors }) : route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ jwt: "test-jwt" }) })
);
await context.route("https://pipe.deezer.com/**", (route) => {
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const auth = route.request().headers().authorization;
  return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ data: { track: { id: "3135556", lyrics: auth === "Bearer test-jwt" ? deezerLyrics : null } } }) });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const open = async (setup) => {
  await page.goto("https://www.deezer.com/fr/");
  if (setup) {
    await page.evaluate(setup);
    await page.reload();
  }
  await page.waitForFunction(() => window.__betterDeezer && document.documentElement.dataset.bd === "on");
  await page.waitForTimeout(150);
};
const $eval = (fn, arg) => page.evaluate(fn, arg);
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });

// ---------- Boot ----------
await open(() => localStorage.clear());
await page.waitForSelector("#bd-welcome", { timeout: 4000 }).catch(() => {});
check("first run shows the welcome card", await $eval(() => !!document.getElementById("bd-welcome")));
await shot("welcome");
const primary = page.locator("#bd-welcome .bd-btn").last();
await primary.hover();
await page.waitForTimeout(200);
check("welcome primary button keeps a light background on hover", (await primary.evaluate((b) => getComputedStyle(b).backgroundColor)) !== "rgb(28, 26, 31)" && !(await $eval(() => document.getElementById("bd-welcome").hasAttribute("data-bd"))), await primary.evaluate((b) => getComputedStyle(b).backgroundColor));
await page.locator("#bd-welcome button", { hasText: "Plus tard" }).click();
await page.waitForTimeout(300);
check("welcome card is shown only once", await (async () => { await page.reload(); await page.waitForTimeout(2200); return $eval(() => !document.getElementById("bd-welcome")); })());
check("boots once (no double injection)", (await $eval(() => document.querySelectorAll("#bd-style").length)) === 1);
const health = await $eval(() => window.__betterDeezer.health());
const visibleAnchors = ["topbar", "page", "searchField", "searchContainer", "volumeButton", "rail", "dock", "playButton", "progressInput", "likeButton"];
const missing = visibleAnchors.filter((k) => !health[k]);
check("anchors resolve on the fixture", missing.length === 0, missing.join(", "));

// ---------- 1. Themes ----------
check("dark theme by default", (await $eval(() => document.documentElement.dataset.bdTheme)) === "dark");
const tempoBg = () => $eval(() => getComputedStyle(document.body).getPropertyValue("--tempo-colors-background-neutral-primary-default").trim());
const bodyBg = () => $eval(() => getComputedStyle(document.body).backgroundColor);
check("Tempo tokens bridged to --bd-* (dark)", (await bodyBg()) === "rgb(11, 10, 12)", await bodyBg());
await shot("1-dark");
await $eval(() => window.__betterDeezer.theme("light"));
check("light theme applies live", (await bodyBg()) === "rgb(245, 243, 240)", await bodyBg());
await shot("1-light");
await page.emulateMedia({ colorScheme: "dark" });
await $eval(() => window.__betterDeezer.theme("system"));
check("system follows prefers-color-scheme: dark", (await $eval(() => document.documentElement.dataset.bdTheme)) === "dark");
await page.emulateMedia({ colorScheme: "light" });
await page.waitForTimeout(50);
check("system follows prefers-color-scheme: light", (await $eval(() => document.documentElement.dataset.bdTheme)) === "light");
await $eval(() => window.__betterDeezer.theme("dark"));
void tempoBg;

// ---- more checks are appended per feature below ----
// ---------- 2. Volume ----------
const vol = () => $eval(() => ({ volume: __fake.volume, mutes: __fake.mutes, open: document.querySelector(".bd-volume")?.dataset.open }));
check("volume slider inserted before Deezer's button", await $eval(() => document.querySelector(".bd-volume")?.nextElementSibling?.dataset.testid?.startsWith("volume_button")));
await page.click('[data-testid^="volume_button"]');
let v = await vol();
check("click on icon opens the slider (no native mute)", v.open === "true" && v.mutes === 0, JSON.stringify(v));
check("accent ring on the icon", (await $eval(() => getComputedStyle(document.querySelector('[data-testid^="volume_button"]')).boxShadow)).includes("inset"));
await page.waitForTimeout(300);
await shot("2-volume-open");
const box = await page.locator('[data-testid^="volume_button"]').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.wheel(0, -100);
await page.waitForTimeout(400);
v = await vol();
check("wheel up on the icon raises Deezer's volume", Math.abs(v.volume - 0.55) < 0.011, JSON.stringify(v));
const sbox = await page.locator(".bd-volume input").boundingBox();
await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
await page.mouse.wheel(0, 100);
await page.mouse.wheel(0, 100);
await page.waitForTimeout(400);
v = await vol();
check("wheel down on the slider lowers it", Math.abs(v.volume - 0.45) < 0.011, JSON.stringify(v));
await page.mouse.click(sbox.x + sbox.width * 0.9, sbox.y + sbox.height / 2);
await page.waitForTimeout(400);
v = await vol();
check("dragging/clicking the slider sets the volume", v.volume > 0.8, JSON.stringify(v));
check("Deezer's hover popup is hidden", await $eval(() => { const m = document.querySelector('[data-testid="volume_menu"]'); return !m || getComputedStyle(m.closest('[data-bd="volume-native"]') || m).opacity === "0"; }));
check("bubble shows the percentage while adjusting", (await $eval(() => document.querySelector(".bd-volume-bubble").textContent)).endsWith("%"));
await page.click('[data-testid^="volume_button"]');
check("re-click while open = Deezer's mute", (await vol()).mutes === 1 && (await vol()).open === "true");
await page.click('[data-testid^="volume_button"]');
await page.keyboard.press("Escape");
check("Escape folds it back", (await vol()).open === "false");
await page.click('[data-testid^="volume_button"]', { modifiers: ["Alt"] });
check("Alt+click keeps Deezer's mute", (await vol()).mutes === 3);
await page.click('[data-testid^="volume_button"]', { modifiers: ["Alt"] });

// ---------- 3. Rail ----------
const railBox = () => $eval(() => {
  const r = document.querySelector('[data-bd="rail"]');
  const b = r.getBoundingClientRect();
  const links = [...r.querySelectorAll("a, button")].filter((a) => a.getBoundingClientRect().width).map((a) => { const x = a.getBoundingClientRect(); return x.left + x.width / 2; });
  return { collapsed: r.dataset.bdCollapsed, top: b.top, bottom: b.bottom, cx: b.left + b.width / 2, links, height: b.height };
});
await page.waitForTimeout(400);
let rb = await railBox();
const areaMid = (900 - 80 - 12) / 2;
check("collapsed rail is detected", rb.collapsed === "true");
check("collapsed rail is centered vertically", Math.abs((rb.top + rb.bottom) / 2 - areaMid) < 8 && rb.height < 600, `mid ${((rb.top + rb.bottom) / 2).toFixed(0)} vs ${areaMid}, h ${rb.height.toFixed(0)}`);
check("collapsed rail entries are centered horizontally", rb.links.every((x) => Math.abs(x - rb.cx) < 2), rb.links.map((x) => x.toFixed(0)).join(","));
check("active page marked in the rail", (await $eval(() => document.querySelector('[data-bd="rail"] [data-bd-active="true"]')?.getAttribute("href"))) === "/fr/");
// Desktop app: deezer.com/fr/ routed on the hash (#/fr/...), so every link shares the path /fr/.
await $eval(() => {
  history.replaceState(null, "", "/fr/#/fr/");
  document.querySelectorAll('[data-bd="rail"] a[href^="/fr"]').forEach((a) => a.setAttribute("href", "#" + a.getAttribute("href")));
  document.body.append(document.createElement("i")); // wake the observer
});
await page.waitForTimeout(300);
const hashActive = await $eval(() => [...document.querySelectorAll('[data-bd="rail"] [data-bd-active="true"]')].map((a) => a.getAttribute("href")));
check("hash routing (desktop app): only Home is active in the rail", hashActive.length === 1 && hashActive[0] === "#/fr/", JSON.stringify(hashActive));
await $eval(() => {
  document.querySelectorAll('[data-bd="rail"] a[href^="#/"]').forEach((a) => a.setAttribute("href", a.getAttribute("href").slice(1)));
  history.replaceState(null, "", "/fr/");
  document.body.append(document.createElement("i"));
});
await page.waitForTimeout(300);
// Deezer hides its carousels' scrollbars with `scrollbar-width: none` on a generated class: ours must not override it.
check("Deezer's hidden scrollbars stay hidden", await $eval(() => {
  const st = document.createElement("style");
  st.textContent = ".fake-carousel { scrollbar-width: none; overflow-x: scroll; }";
  const el = document.createElement("div");
  el.className = "fake-carousel";
  document.head.append(st);
  document.body.append(el);
  const ok = getComputedStyle(el).scrollbarWidth === "none";
  el.remove();
  st.remove();
  return ok;
}));
check("no css-xxxx class in our stylesheet", !(await $eval(() => /\.css-[a-z0-9]/i.test(document.getElementById("bd-style").textContent))));
const hoverLink = page.locator('[data-bd="rail"] a[href="/fr/channels/explore/explore-tab"]');
await hoverLink.hover();
await page.waitForTimeout(250);
check("rail hover paints surface-2", (await hoverLink.evaluate((a) => getComputedStyle(a).backgroundColor)) === "rgb(28, 26, 31)");
await shot("3-rail-collapsed");
await $eval(() => __expandSidebar(true));
await page.waitForTimeout(500);
rb = await railBox();
check("expanded rail is centered vertically like the collapsed one", rb.collapsed === "false" && Math.abs((rb.top + rb.bottom) / 2 - areaMid) < 8, `mid ${((rb.top + rb.bottom) / 2).toFixed(0)} vs ${areaMid}, top ${rb.top.toFixed(0)}, h ${rb.height.toFixed(0)}`);
// A scrollbar in the rail would push every entry off center.
check("no scrollbar takes room in the expanded rail", await $eval(() => [document.querySelector('[data-bd="rail"]'), ...document.querySelectorAll('[data-bd="rail"] *')]
  .filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowY))
  .every((e) => e.offsetWidth - e.clientWidth - (parseFloat(getComputedStyle(e).borderLeftWidth) || 0) - (parseFloat(getComputedStyle(e).borderRightWidth) || 0) <= 0)));
await shot("3-rail-expanded");
await $eval(() => __expandSidebar(false));
// Visible entries in visual order (CSS order may differ from the DOM order).
const navShown = () => $eval(() => [...document.querySelectorAll('[data-bd="rail"] [data-bd-nav]')].filter((a) => a.getBoundingClientRect().width).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((a) => a.dataset.bdNav).join(","));
check("rail shows only Home and Explore by default (Library entries hidden)", (await navShown()) === "home,channels/explore", await navShown());
check("the pinned Favourite tracks item is not a nav entry", await $eval(() => !document.getElementById("pinned-loved").hasAttribute("data-bd-nav") && document.getElementById("pinned-loved").getBoundingClientRect().width > 0));
check("an all-hidden Library block hides its title too", await $eval(() => document.querySelector(".css-lib").getAttribute("data-bd-nav-hidden") === "true"));

// ---------- 4. Player bar ----------
const css = (sel, prop) => $eval(([s, p]) => { const el = document.querySelector(s); return el ? getComputedStyle(el)[p] : null; }, [sel, prop]);
check("dock floats with rounded corners", (await css('[data-bd="dock"]', "borderRadius")) === "22px" && (await css('[data-bd="dock"]', "bottom")) === "12px");
check("play button is a round accent disc", (await css('[data-bd-role="play"]', "backgroundColor")) === "rgb(162, 56, 255)" && (await css('[data-bd-role="play"]', "borderRadius")) !== "0px", await css('[data-bd-role="play"]', "backgroundColor"));
await page.click('[data-bd-role="like"]');
await page.waitForTimeout(100);
check("liked heart is filled accent", (await css('[data-bd-role="like"] svg', "fill")) === "rgb(162, 56, 255)", await css('[data-bd-role="like"] svg', "fill"));
check("progress fill is accent", (await css('[data-bd-role="progress-fill"]', "backgroundColor")) === "rgb(162, 56, 255)");
const order = await $eval(() => ["time-elapsed", "progress", "time-remaining"].map((r) => document.querySelector(`[data-bd-slot="${r}"]`)?.getBoundingClientRect().left ?? -1));
check("times on each side of the bar", order[0] >= 0 && order[0] < order[1] && order[1] < order[2], order.join(" < "));
const pbox = await page.locator('[data-bd-slot="progress"]').boundingBox();
await page.mouse.move(pbox.x + pbox.width / 2, pbox.y + pbox.height / 2);
const seekBefore = await $eval(() => Number(document.querySelector('[data-testid="progress_bar"]').value));
await page.mouse.wheel(0, -100);
await page.waitForTimeout(100);
const seekAfter = await $eval(() => Number(document.querySelector('[data-testid="progress_bar"]').value));
check("wheel over the seek bar does not seek", seekAfter === seekBefore, `${seekBefore} -> ${seekAfter}`);
const cbox = await page.locator('[data-bd="dock"] [data-testid="item_cover"]').boundingBox();
await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
await page.mouse.wheel(0, -100);
await page.waitForTimeout(100);
const seekCover = await $eval(() => Number(document.querySelector('[data-testid="progress_bar"]').value));
check("wheel over the dock cover seeks +5 s", seekCover - seekAfter === 5, `${seekAfter} -> ${seekCover}`);
await shot("4-dock");
await $eval(() => window.__betterDeezer.theme("light"));
await shot("4-dock-light");
await $eval(() => window.__betterDeezer.theme("dark"));

// ---------- 5. Overlays ----------
await page.click('[data-testid="search_field"]');
check("search pill gets a 2px accent border on focus", /inset.*0px 0px 0px 2px|0px 0px 0px 2px.*inset/.test(await css('[data-bd="search-field-group"]', "boxShadow")));
await $eval(() => __openRecentSearches());
await page.waitForTimeout(200);
const rs = await $eval(() => {
  const pop = document.querySelector('[data-bd="search-popover"]').getBoundingClientRect();
  const box = document.querySelector('[data-bd="search-popover"] > *').getBoundingClientRect();
  const heart = document.querySelector('[data-bd="search-popover"] .fav').getBoundingClientRect();
  const clear = document.querySelector('[data-testid="recent_search_clear_button"]').getBoundingClientRect();
  const title = getComputedStyle(document.querySelector('[data-testid="artist_title"]')).paddingLeft;
  return { pop: Math.round(pop.width), box: Math.round(box.width), heartGap: Math.round(pop.right - heart.right), clearGap: Math.round(pop.right - clear.right), title };
});
check("recent searches fill the widened popover (no fixed 450px box)", rs.pop > 500 && rs.box >= rs.pop - 2, JSON.stringify(rs));
check("hearts and 'Clear all' sit on the right edge", rs.heartGap < 40 && rs.clearGap < 40, JSON.stringify(rs));
check("result titles get room for the first letter (no clipped B / T)", rs.title === "2px", rs.title);
await page.screenshot({ path: join(out, "search-recent.png"), clip: await page.locator('[data-bd="search-popover"]').boundingBox() });
await $eval(() => document.querySelector(".chakra-popover__popper")?.remove());
check("Ctrl K hint shown while the field is empty", (await css('[data-bd="search-field-group"] .bd-kbd', "display")) !== "none");
await page.fill('[data-testid="search_field"]', "daft");
check("Ctrl K hint hidden once something is typed (clear button's spot)", (await css('[data-bd="search-field-group"] .bd-kbd', "display")) === "none");
await page.fill('[data-testid="search_field"]', "");
// Tooltips: all off by default
const queueBox = await page.locator('[data-bd="dock"] [data-testid="queue_list_button"]').boundingBox();
await page.mouse.move(queueBox.x + queueBox.width / 2, queueBox.y + queueBox.height / 2);
await page.waitForTimeout(100);
await $eval(() => { const t = document.createElement("div"); t.setAttribute("role", "tooltip"); t.id = "native-tip"; t.textContent = "File d'attente"; document.body.append(t); });
await page.waitForTimeout(150);
check("tooltips are all off by default (ours and Deezer's)", await $eval(() => !document.querySelector(".bd-tooltip") && getComputedStyle(document.getElementById("native-tip")).display === "none"));
await $eval(() => document.getElementById("native-tip").remove());
// Previous / next keep their hover card by default (Deezer's track preview, opened through aria-describedby).
await $eval(() => { const t = document.createElement("div"); t.setAttribute("role", "tooltip"); t.id = "prev-preview"; t.textContent = "So Easy - Olivia Dean"; document.body.append(t); document.querySelector('[data-testid="previous_track_button"]').setAttribute("aria-describedby", "prev-preview"); });
await page.waitForTimeout(150);
check("previous / next track preview shown by default (the only tooltip kept)", (await $eval(() => document.getElementById("prev-preview").dataset.bd)) === "track-preview" && (await css("#prev-preview", "display")) !== "none");
await $eval(() => __betterDeezer.disable("track-previews"));
await page.waitForTimeout(150);
check("and can be turned off", (await css("#prev-preview", "display")) === "none");
await $eval(() => { __betterDeezer.enable("track-previews"); document.getElementById("prev-preview").remove(); document.querySelector('[data-testid="previous_track_button"]').removeAttribute("aria-describedby"); });
await page.mouse.move(700, 300);
await $eval(() => { __betterDeezer.enable("tooltips"); __betterDeezer.enable("native-tips"); });
await page.waitForTimeout(100);
// Tooltip: moving from a button onto its icon keeps the same tooltip (no flicker)
const prevBox = await page.locator('[data-bd="dock"] [data-testid="previous_track_button"]').boundingBox();
await page.mouse.move(prevBox.x + prevBox.width / 2, prevBox.y + prevBox.height / 2);
await page.waitForTimeout(100);
check("previous / next get no tooltip of ours (Deezer shows the track there)", await $eval(() => !document.querySelector(".bd-tooltip")));
const prev = page.locator('[data-bd="dock"] [data-testid="queue_list_button"]');
const pb = await prev.boundingBox();
await page.mouse.move(pb.x + pb.width / 2, pb.y + 3);
await page.waitForTimeout(100);
const tip1 = await $eval(() => { const t = document.querySelector(".bd-tooltip"); if (t) t.dataset.n = "1"; return !!t; });
await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForTimeout(100);
const tip2 = await $eval(() => [...document.querySelectorAll(".bd-tooltip")].map((t) => t.dataset.n || "new").join(","));
check("dock tooltip stays put when moving onto the icon", tip1 && tip2 === "1", `${tip1} ${tip2}`);
await $eval(() => { const t = document.createElement("div"); t.setAttribute("role", "tooltip"); t.id = "native-tip"; t.textContent = "File d'attente"; document.body.append(t); });
await page.waitForTimeout(150);
check("Deezer's own tooltip is hidden while ours is shown (no double tooltip)", (await css("#native-tip", "display")) === "none");
await page.mouse.move(700, 300);
await page.waitForTimeout(100);
check("dock tooltip hides when the pointer leaves", await $eval(() => !document.querySelector(".bd-tooltip")));
check("Deezer's tooltip shows normally otherwise, styled like ours", (await css("#native-tip", "display")) !== "none" && (await css("#native-tip", "borderRadius")) !== "0px");
await $eval(() => document.getElementById("native-tip").remove());
await $eval(() => { __betterDeezer.disable("tooltips"); __betterDeezer.disable("native-tips"); });
await page.click('[data-testid="topbar-profile"]');
await page.waitForTimeout(150);
check("profile menu tagged and rounded 22", (await css('[data-bd="account-menu"]', "borderRadius")) === "22px");
check("theme switch + settings entry injected in the profile menu", await $eval(() => !!document.querySelector('.bd-account .bd-seg[data-value="light"]') && !!document.querySelector(".bd-account-link")));
await page.click('.bd-account .bd-seg[data-value="light"]');
check("theme switch in the profile menu works", (await $eval(() => document.documentElement.dataset.bdTheme)) === "light");
await shot("5-account-light");
await page.click('.bd-account .bd-seg[data-value="dark"]');
await shot("5-account-dark");
await $eval(() => document.querySelector(".chakra-popover__popper")?.remove());
await $eval(() => __openModal());
await page.waitForTimeout(400);
check("modal: r=22 surface-1", (await css('[data-bd="modal"]', "borderRadius")) === "22px" && (await css('[data-bd="modal"]', "backgroundColor")) === "rgb(20, 19, 22)");
check("modal scrim: #050405 at 80%", (await css('[data-bd="scrim"]', "backgroundColor")) === "rgba(5, 4, 5, 0.8)");
check("modal primary button is solid text color", (await css('[data-bd="modal"] [data-bd-role="primary"]', "backgroundColor")) === "rgb(244, 242, 246)", JSON.stringify(await $eval(() => [...document.querySelectorAll("[data-bd=modal] button")].map((b) => b.dataset.testid + ":" + b.dataset.bdRole + ":" + getComputedStyle(b).backgroundColor))));
await shot("5-modal");
await $eval(() => document.querySelector(".chakra-portal")?.remove());
await $eval(() => __toast());
await page.waitForTimeout(150);
check("toast is a light pill", (await css('[data-bd="toast"] > *', "backgroundColor")) === "rgb(244, 242, 246)");
await $eval(() => __openNotifications());
await page.waitForTimeout(150);
check("notifications panel tagged", (await css('[data-bd="notifications"]', "borderRadius")) === "22px");
await page.click('.bd-notif-filters [data-value="social"]');
check("notification filter hides releases", (await css('[data-bd="notifications"] li[data-bd-kind="release"]', "display")) === "none");
await page.click('.bd-notif-filters [data-value="all"]');
const chip = page.locator('.bd-notif-filters [data-value="release"]');
await chip.hover();
await page.waitForTimeout(200);
check("notification chips keep readable text on hover", (await chip.evaluate((b) => getComputedStyle(b).color)) === "rgb(244, 242, 246)", await chip.evaluate((b) => getComputedStyle(b).color));
await page.locator('[data-bd="notifications"] li').first().hover();
await page.waitForTimeout(250);
const nplay = await $eval(() => { const b = document.querySelector('[data-bd="notifications"] .action-item-tempo-btn'); const r = b.getBoundingClientRect(); const f = b.closest("figure").getBoundingClientRect(); return { w: r.width, op: getComputedStyle(b).opacity, dx: Math.abs(r.left + r.width / 2 - (f.left + f.width / 2)), dy: Math.abs(r.top + r.height / 2 - (f.top + f.height / 2)) }; });
check("notification play button: 36px, centered on the cover, shown on hover", nplay.w === 36 && nplay.op === "1" && nplay.dx < 1 && nplay.dy < 1, JSON.stringify(nplay));
await shot("5-notifications");
await $eval(() => document.querySelectorAll(".chakra-popover__popper, #chakra-toast-manager-bottom li").forEach((e) => e.remove()));

// ---------- 6. Settings panel ----------
await page.keyboard.press("Control+Comma");
await page.waitForTimeout(300);
check("Ctrl+, opens the settings panel", await $eval(() => !!document.querySelector("#bd-settings [role=dialog]")));
await shot("6-settings-appearance");
const tabStyle = await $eval(() => { const s = getComputedStyle(document.querySelector('#bd-settings [aria-selected="true"]')); return s.backgroundColor + " | " + s.boxShadow; });
check("selected settings tab: soft accent, no side bar", tabStyle.startsWith("rgba(162, 56, 255, 0.16)") && tabStyle.endsWith("none"), tabStyle);
check("settings panel is not restyled as a Deezer modal", await $eval(() => !document.querySelector("#bd-settings [data-bd]")));
await page.click('#bd-settings .bd-seg[data-value="light"]');
check("theme from the settings panel", (await $eval(() => document.documentElement.dataset.bdTheme)) === "light");
await shot("6-settings-light");
await page.click('#bd-settings .bd-seg[data-value="dark"]');
await page.click('#bd-settings [data-tab="reco"]');
await page.fill("#bd-settings .bd-input", "Aérodynamic");
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
check("'Don't recommend' hides matching rows (accent-insensitive)", (await css('[data-bd-role="track-row"]:nth-of-type(2)', "display")) === "none");
await shot("6-settings-reco");
await page.click('#bd-settings .bd-taglist .bd-icon-btn');
await page.waitForTimeout(200);
check("removing the entry shows it again", (await css('[data-bd-role="track-row"]:nth-of-type(2)', "display")) !== "none");
await page.click('#bd-settings [data-tab="shortcuts"]');
await shot("6-settings-shortcuts");
await page.click('#bd-settings [data-tab="playback"]');
await page.click('#bd-settings [data-tab="about"]');
await shot("6-settings-about");
await page.click('#bd-settings [data-tab="sidebar"]');
await page.waitForTimeout(300);
const navRows = await $eval(() => [...document.querySelectorAll("#bd-settings .bd-nav-row")].map((r) => r.querySelector(".bd-nav-label").textContent + (r.querySelector(".bd-nav-icon svg") ? "+icon" : "")));
check("sidebar tab lists the rail's real entries with their icons, in two groups", navRows.length === 7 && navRows.every((r) => r.endsWith("+icon")) && (await $eval(() => document.querySelectorAll("#bd-settings .bd-nav-group").length)) === 2, navRows.join(" | "));
check("the Library group is titled from Deezer's own heading", (await $eval(() => document.querySelectorAll("#bd-settings .bd-nav-group h4")[1].textContent)) === "Bibliothèque");
await shot("6-settings-sidebar");
await page.locator("#bd-settings .bd-nav-row", { hasText: "Albums" }).locator("input").click();
await page.waitForTimeout(150);
check("sidebar switch shows the Albums entry live", (await navShown()) === "home,channels/explore,library/albums", await navShown());
check("the Library block shows again", await $eval(() => document.querySelector(".css-lib").getAttribute("data-bd-nav-hidden") === "false"));
await page.locator('#bd-settings .bd-nav-row[data-key="channels/explore"]').focus();
await page.keyboard.press("Alt+ArrowUp");
await page.waitForTimeout(150);
check("Alt+↑ moves Explore above Home, live in the rail", (await navShown()) === "channels/explore,home,library/albums", await navShown());
const hbox = await page.locator('#bd-settings .bd-nav-row[data-key=""] .bd-nav-handle').boundingBox();
const ebox = await page.locator('#bd-settings .bd-nav-row[data-key="channels/explore"]').boundingBox();
await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2);
await page.mouse.down();
await page.mouse.move(ebox.x + 40, ebox.y + 4, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(200);
check("dragging Home back on top restores the order", (await navShown()) === "home,channels/explore,library/albums", await navShown());
await page.locator("#bd-settings button", { hasText: "Rétablir par défaut" }).click();
await page.waitForTimeout(200);
check("reset: Library entries hidden again, Deezer's order", (await navShown()) === "home,channels/explore", await navShown());
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("Escape closes the panel", await $eval(() => !document.getElementById("bd-settings")));
await page.click('[data-testid="topbar-profile"]');
await page.waitForTimeout(100);
await page.click(".bd-account-link");
await page.waitForTimeout(300);
check("profile menu entry opens the panel", await $eval(() => !!document.getElementById("bd-settings")));
await page.keyboard.press("Escape");
await $eval(() => document.querySelector(".chakra-popover__popper")?.remove());

// ---------- 8. Fonts (vendored, no network) ----------
const fonts = await $eval(async () => {
  await document.fonts.ready;
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)));
  return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, ""));
});
check("Bricolage Grotesque + Instrument Sans loaded from the payload", fonts.includes("Bricolage Grotesque") && fonts.includes("Instrument Sans"), [...new Set(fonts)].join(", "));
check("no request to Google Fonts", !googleFontRequests, String(googleFontRequests));

// ---------- Top bar: search centered on the window, Home on its left ----------
for (const width of [1440, 1100]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(500);
  const t = await $eval(() => {
    const s = document.querySelector('[data-bd="search-slot"]').getBoundingClientRect();
    const h = document.querySelector(".bd-home").getBoundingClientRect();
    return { mid: s.left + s.width / 2, w: s.width, gap: s.left - h.right, homeTop: h.top + h.height / 2, searchTop: s.top + s.height / 2 };
  });
  check(`search centered on the window at ${width}px`, Math.abs(t.mid - width / 2) < 2, JSON.stringify(t));
  check(`Home button sits left of the search at ${width}px`, t.gap >= 4 && t.gap <= 12 && Math.abs(t.homeTop - t.searchTop) < 2);
}
await page.setViewportSize({ width: 1440, height: 900 });
await shot("topbar");

// ---------- Themes ----------
await page.keyboard.press("Control+Comma");
await page.waitForTimeout(300);
await page.click('#bd-settings [data-tab="themes"]');
await page.waitForTimeout(500);
check("themes tab lists the built-in themes", (await $eval(() => document.querySelectorAll("#bd-settings .bd-theme-card").length)) >= 8);
check("Marketplace loaded the registry online", (await $eval(() => document.querySelector("#bd-settings").textContent)).includes("à jour"));
await shot("themes-tab");
await page.locator("#bd-settings .bd-theme-card", { hasText: "Nocturne" }).first().locator("button", { hasText: "Appliquer" }).click();
await page.waitForTimeout(200);
check("applying Nocturne changes the ground", (await bodyBg()) === "rgb(10, 13, 20)", await bodyBg());
await page.locator("#bd-settings .bd-theme-card", { hasText: "Aurora" }).first().locator("button", { hasText: "Installer" }).click();
await page.waitForTimeout(200);
check("installing Aurora (dark only) applies it and forces dark", (await bodyBg()) === "rgb(7, 16, 18)" && (await $eval(() => document.documentElement.dataset.bdTheme)) === "dark");
await shot("themes-aurora");
const bad = await $eval(() => window.__betterDeezer.themes.install({ id: "evil", name: "Evil", css: "body{background:url(https://evil.example/t.gif)}" }));
check("a theme with url() in its CSS is rejected", bad.ok === false && bad.errors.join(" ").includes("url()"), bad.errors?.join(" "));
await page.locator("#bd-settings button", { hasText: "Créer un thème" }).click();
await page.waitForTimeout(300);
check("theme editor opens with 13 color pickers", (await $eval(() => document.querySelectorAll("#bd-settings .bd-color input[type=color]").length)) === 13);
await page.locator("#bd-settings .bd-color", { hasText: "Fond" }).locator("input").evaluate((el) => { el.value = "#202040"; el.dispatchEvent(new Event("input", { bubbles: true })); });
check("editor previews live", (await bodyBg()) === "rgb(32, 32, 64)", await bodyBg());
await shot("themes-editor");
await page.locator("#bd-settings button", { hasText: "Enregistrer et appliquer" }).click();
await page.waitForTimeout(200);
check("saved theme is active after reload", await (async () => { await page.reload(); await page.waitForFunction(() => window.__betterDeezer); return (await bodyBg()) === "rgb(32, 32, 64)"; })());
await $eval(() => localStorage.setItem("bd:themes:active", '"graphite"'));
await page.reload();
await page.waitForFunction(() => window.__betterDeezer);

// ---------- Now playing view + synced lyrics ----------
check("now playing button added to the player bar", await $eval(() => !!document.querySelector('[data-bd="dock"] .bd-np-btn')));
await page.keyboard.press("f");
await page.waitForTimeout(800);
check("F opens the now playing view", await $eval(() => !!document.getElementById("bd-np")));
const np = await $eval(() => ({ title: document.querySelector(".bd-np-title")?.textContent, lines: document.querySelectorAll(".bd-np-lines li").length, current: document.querySelector('.bd-np-lines li[data-state="current"]')?.textContent }));
check("synced lyrics loaded and the current line follows the seek bar (1:12)", np.lines === 6 && np.current === "Oh yeah, all right", JSON.stringify(np));
await shot("nowplaying");
const rhythm = await $eval(() => ({ p: Number(document.querySelector('.bd-np-lines li[data-state="current"]').style.getPropertyValue("--p")), dots: document.querySelectorAll('.bd-np-lines li[data-break="true"] .bd-np-dots i').length }));
check("current line fills with the rhythm (--p) and breaks show three dots", rhythm.p > 0 && rhythm.p <= 1 && rhythm.dots === 3, JSON.stringify(rhythm));
const nbar = await page.locator(".bd-np-bar").boundingBox();
await page.mouse.move(nbar.x + nbar.width * 0.25, nbar.y + nbar.height / 2);
await page.mouse.down();
await page.mouse.move(nbar.x + nbar.width * 0.5, nbar.y + nbar.height / 2, { steps: 4 });
const midDrag = await $eval(() => Number(document.querySelector('[data-testid="progress_bar"]').value));
await page.mouse.up();
await page.waitForTimeout(100);
const afterDrag = await $eval(() => Number(document.querySelector('[data-testid="progress_bar"]').value));
check("dragging the Now playing bar previews, then seeks Deezer on release", midDrag !== 160 && Math.abs(afterDrag - 160) <= 2, `${midDrag} -> ${afterDrag}`);
await page.locator(".bd-np-lines li", { hasText: "One more time" }).last().click();
await page.waitForTimeout(150);
check("clicking a lyric line seeks there", Math.abs((await $eval(() => Number(document.querySelector('[data-testid="progress_bar"]').value))) - 120) <= 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("Escape closes the view", await $eval(() => !document.getElementById("bd-np")));
// Deezer word-by-word lyrics: words light up on their own timing.
deezerLyrics = {
  id: "1",
  synchronizedWordByWordLines: [
    { start: 60000, end: 63000, words: [{ start: 60000, end: 60800, word: "One " }, { start: 60800, end: 61500, word: "more " }, { start: 61500, end: 63000, word: "time" }] },
    { start: 70000, end: 74000, words: [{ start: 70000, end: 71000, word: "We're" }, { start: 71000, end: 72500, word: "gonna" }, { start: 72500, end: 74000, word: "celebrate" }] },
    { start: 90000, end: 92000, words: [{ start: 90000, end: 92000, word: "Yeah" }] }
  ],
  synchronizedLines: []
};
// Switching the lyrics source in the settings clears the cached LRCLIB answer.
await page.keyboard.press("Control+Comma");
await page.waitForTimeout(300);
await page.click('#bd-settings [data-tab="playback"]');
await page.click('#bd-settings .bd-seg[data-value="lrclib"]');
await page.click('#bd-settings .bd-seg[data-value="deezer"]');
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.keyboard.press("f");
await page.waitForTimeout(800);
await $eval(() => { const i = document.querySelector('[data-testid="progress_bar"]'); i.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); i.value = "72"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new MouseEvent("mouseup", { bubbles: true })); });
await page.waitForTimeout(400);
const wbw = await $eval(() => {
  const cur = document.querySelector('.bd-np-lines li[data-state="current"]');
  return {
    source: document.querySelector(".bd-np-source").textContent,
    text: cur?.textContent,
    w: [...(cur?.querySelectorAll(".bd-np-w") || [])].map((w) => Number(w.style.getPropertyValue("--w")).toFixed(2)),
    breaks: document.querySelectorAll('.bd-np-lines li[data-break="true"]').length
  };
});
check("Deezer word-by-word lyrics: source shown, words keep their spaces", /Deezer, mot à mot/.test(wbw.source) && wbw.text === "We're gonna celebrate", JSON.stringify(wbw));
check("each word fills on its own timing (sung / singing / not yet)", wbw.w[0] === "1.00" && Number(wbw.w[1]) > 0.5 && Number(wbw.w[1]) < 1 && wbw.w[2] === "0.00", wbw.w.join(" "));
check("intro and long pauses between Deezer lines become breaks", wbw.breaks === 3, String(wbw.breaks));
await shot("nowplaying-words");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// ---------- Modules ----------
check("hide promos: upgrade banner hidden", (await css('[data-testid="conversionBanner"]', "display")) === "none");
await $eval(() => window.__betterDeezer.settings());
await page.waitForTimeout(300);
await page.locator("#bd-settings [data-tab=modules]").click();
check("Modules tab lists the modules", (await $eval(() => document.querySelectorAll("#bd-settings .bd-module").length)) >= 6);
await shot("modules");
await page.locator("#bd-settings .bd-chip-btn", { hasText: "15 min" }).click();
await page.waitForTimeout(1100);
const badge = await $eval(() => document.querySelector('[data-bd="dock"] .bd-sleep-badge')?.textContent || "");
check("sleep timer shows a countdown badge in the player bar", /^1[45]:\d\d$/.test(badge), badge);
const promoSwitch = page.locator("#bd-settings .bd-module", { hasText: "bannières" }).locator("input");
await promoSwitch.click();
await page.waitForTimeout(150);
check("turning hide promos off shows the banner again (live)", (await css('[data-testid="conversionBanner"]', "display")) !== "none");
await promoSwitch.click();
await page.waitForTimeout(150);
check("turning it back on hides it again", (await css('[data-testid="conversionBanner"]', "display")) === "none");
await page.locator("#bd-settings .bd-module", { hasText: "compact" }).locator("input").click();
await page.waitForTimeout(150);
check("compact mode applies live", (await $eval(() => document.documentElement.dataset.bdCompact)) === "true");
await page.locator("#bd-settings .bd-module", { hasText: "compact" }).locator("input").click();
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
await page.locator(".bd-sleep-badge").click();
check("clicking the badge cancels the sleep timer", await $eval(() => !document.querySelector(".bd-sleep-badge")));

// Home order: Discovery puts "Nouveautés" first, Deezer's order otherwise.
const homeOrder = () => $eval(() => [...document.querySelectorAll('[data-testid="section-renderer"]')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((el) => el.textContent));
check("home keeps Deezer's order by default", (await homeOrder())[0] === "Vos mix");
await $eval(() => localStorage.setItem("bd:home:order", '"discovery"'));
await page.reload();
await page.waitForFunction(() => window.__betterDeezer);
await page.waitForTimeout(300);
check("Discovery priority moves new releases first", (await homeOrder())[0] === "Nouveautés pour vous", (await homeOrder()).join(" / "));
await $eval(() => localStorage.removeItem("bd:home:order"));

//@@CHECKS@@

// Marketing pages on www.deezer.com (download, offers...): Better Deezer stays asleep, no warning.
const warnings = [];
page.on("console", (m) => m.type() === "warning" && /Better Deezer/.test(m.text()) && warnings.push(m.text()));
await page.goto("https://www.deezer.com/explore/fr/download/");
await page.waitForTimeout(600);
check("not started on /explore/ pages", await $eval(() => !window.__betterDeezer && !document.documentElement.hasAttribute("data-bd")));
await context.route("https://www.deezer.com/fr/marketing-test", (route) =>
  route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Deezer</title><h1>Offres</h1><p>Pas de lecteur ici.</p>" })
);
await page.goto("https://www.deezer.com/fr/marketing-test");
await page.waitForTimeout(4600);
check("asleep on a page without the player, and no 'anchors not found' warning", await $eval(() => !window.__betterDeezer && !document.documentElement.hasAttribute("data-bd")) && warnings.length === 0, warnings.join(" | "));
await page.evaluate(() => {
  const root = document.createElement("div");
  root.className = "naboo";
  root.innerHTML = '<main id="page_content"></main>';
  document.body.append(root);
});
await page.waitForTimeout(400);
check("wakes up when the player appears later (single-page navigation)", await $eval(() => !!window.__betterDeezer && document.documentElement.dataset.bd === "on"));

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${out}`);
process.exit(failed.length ? 1 : 0);
