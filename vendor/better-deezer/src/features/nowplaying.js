/*
 * "Now playing" view (module): full-window, big cover on the left, synced
 * lyrics scrolling on the right, blurred cover in the background.
 * Open with F or the button added to the player bar; Escape closes.
 * Click a lyric line to jump there.
 *
 * Lyrics come from LRCLIB (https://lrclib.net), a free and open lyrics
 * database: when the view is open, the title, artist and duration of the
 * current track are sent there, nothing else. Results are cached per session.
 *
 * Time: Deezer's seek input (data-testid="progress_bar") holds the position in
 * seconds and moves once a second; between ticks we interpolate while playing.
 *
 * Sources, in order (Settings > Playback & volume > Lyrics):
 *  1. Deezer's own lyrics, word by word when Deezer has them, else line by line
 *     with each line's real duration. Same request as Deezer's lyrics button:
 *     your Deezer session asks Deezer's servers (auth.deezer.com, pipe.deezer.com)
 *     for the playing track's lyrics. Nothing goes anywhere else.
 *  2. LRCLIB (https://lrclib.net), when Deezer has none: title, artist and
 *     duration are sent there. Line timings only.
 *
 * Rhythm: with word timings each word lights up exactly when it is sung (and
 * fills over its own duration). With line timings only, the line fills at an
 * estimated singing pace. Instrumental breaks and long intros show three dots
 * that light up one by one until the voice comes back.
 */
BD.feature({
  id: "nowplaying",
  module: true,
  live: true,
  glyph: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  label: ["Vue « En écoute » + paroles synchronisées", "“Now playing” view + synced lyrics"],
  description: [
    "Grande pochette et paroles qui défilent avec la musique. Touche F ou bouton dans la barre de lecture. Paroles : LRCLIB (titre et artiste envoyés à lrclib.net).",
    "Big cover and lyrics that scroll with the music. F key or the button in the player bar. Lyrics: LRCLIB (title and artist sent to lrclib.net)."
  ],

  cache: new Map(),
  state: null,

  setup() {
    this.onKey = (e) => {
      if (e.key === "Escape" && this.state) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }
      const t = e.target;
      const typing = t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
      if (typing || e.ctrlKey || e.metaKey || e.altKey || (e.key !== "f" && e.key !== "F")) return;
      if (document.getElementById("bd-settings")) return;
      e.preventDefault();
      this.state ? this.close() : this.open();
    };
    document.addEventListener("keydown", this.onKey, true);
  },

  teardown() {
    this.close();
    document.removeEventListener("keydown", this.onKey, true);
    BD.q(".bd-np-btn")?.remove();
  },

  update() {
    this.injectButton();
    if (this.state) {
      const track = this.track();
      if (track && track.key !== this.state.track?.key) this.load(track);
      this.syncTransport();
    }
  },

  // ---------- current track, from the player bar ----------
  track() {
    const dock = BD.q('[data-bd="dock"]') || BD.anchors.playerRoot();
    if (!dock) return null;
    const title = BD.q('[data-testid="item_title"]', dock)?.textContent.trim();
    if (!title) return null;
    const artist = BD.q('[data-testid="item_subtitle"]', dock)?.textContent.replace(/\s+/g, " ").trim() || "";
    const img = BD.q('[data-testid="item_cover"] img', dock);
    const cover = img?.currentSrc || img?.src || "";
    const input = BD.anchors.progressInput();
    const duration = Number(input?.max) || 0;
    return { title, artist, cover: cover.replace(/\/\d+x\d+-/, "/1000x1000-"), duration, key: `${title}|${artist}` };
  },

  isPlaying() {
    return Boolean(BD.q('[data-bd="dock"] [data-testid="play_button_pause"], #page_player [data-testid="play_button_pause"]'));
  },

  /** Position in seconds, smoothed between Deezer's once-a-second updates. */
  position() {
    const input = BD.anchors.progressInput();
    const value = Number(input?.value) || 0;
    const now = performance.now();
    const s = this.state;
    if (value !== s.lastValue) {
      s.lastValue = value;
      s.lastAt = now;
    }
    if (!this.isPlaying()) return value;
    return value + Math.min(1.25, (now - s.lastAt) / 1000);
  },

  // ---------- lyrics ----------
  firstArtist: (artist) => artist.split(/,|&| feat\.? | x /i)[0].trim(),
  cleanTitle: (title) =>
    title
      .replace(/\s*[([](feat|ft|with)\.?[^)\]]*[)\]]/gi, "")
      .replace(/\s+-\s+(.*remaster.*|radio edit|live.*|single version)$/i, "")
      .trim(),

  async fetchJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { credentials: "omit", signal: ctrl.signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  },

  async lyrics(track) {
    if (this.cache.has(track.key)) return this.cache.get(track.key);
    if (BD.settings.get("lyrics:source", "deezer") === "deezer") {
      const fromDeezer = await this.deezerLyrics(track).catch((err) => {
        BD.log?.("Deezer lyrics unavailable, using LRCLIB:", err.message);
        return null;
      });
      if (fromDeezer) {
        this.cache.set(track.key, fromDeezer);
        return fromDeezer;
      }
    }
    const result = await this.lrclib(track);
    this.cache.set(track.key, result);
    return result;
  },

  // ---------- Deezer's own lyrics ----------
  /**
   * The playing track's Deezer id, from Deezer's player object. In the page world
   * (userscript, desktop app) it is read directly; the extension's isolated world
   * asks extension/page-bridge.js.
   */
  currentSong() {
    try {
      const s = window.dzPlayer?.getCurrentSong?.();
      if (s?.SNG_ID) return Promise.resolve({ id: String(s.SNG_ID), title: String(s.SNG_TITLE || ""), duration: Number(s.DURATION) || 0 });
    } catch {
      /* fall through to the bridge */
    }
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      const done = (song) => {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(song);
      };
      const onMessage = (e) => e.source === window && e.data?.bd === "song" && e.data.id === id && done(e.data.song);
      const timer = setTimeout(() => done(null), 600);
      window.addEventListener("message", onMessage);
      window.postMessage({ bd: "song?", id }, location.origin);
    });
  },

  /**
   * A short-lived token for Deezer's API, obtained like Deezer's own page does
   * (auth.deezer.com/login/renew with the session cookie). Logged out: an
   * anonymous token. Kept in memory for 4 minutes, never stored.
   */
  async deezerToken() {
    if (this.token && Date.now() - this.token.at < 240000) return this.token.jwt;
    const get = async (path, credentials) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(`https://auth.deezer.com/${path}`, {
          method: "POST",
          credentials,
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          signal: ctrl.signal
        });
        return res.ok ? (await res.json()).jwt || null : null;
      } finally {
        clearTimeout(timer);
      }
    };
    const jwt = (await get("login/renew?jo=p&rto=c&i=c", "include").catch(() => null)) || (await get("login/anonymous?jo=p&rto=c", "omit"));
    if (!jwt) throw new Error("no Deezer token");
    this.token = { jwt, at: Date.now() };
    return jwt;
  },

  /** Deezer's GetLyrics query, word-by-word and line timings only. */
  async deezerLyrics(track) {
    const song = await this.currentSong();
    if (!song?.id) throw new Error("track id unknown");
    // The dock can lag a frame behind the player on track change: same title, or give up.
    if (song.title && song.title.toLowerCase() !== track.title.toLowerCase()) throw new Error("track changed");
    const query = `query BetterDeezerLyrics($trackId: String!) {
  track(trackId: $trackId) {
    id
    lyrics {
      id
      synchronizedWordByWordLines { start end words { start end word } }
      synchronizedLines { line milliseconds duration }
    }
  }
}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let data;
    try {
      const res = await fetch("https://pipe.deezer.com/api", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await this.deezerToken()}` },
        body: JSON.stringify({ operationName: "BetterDeezerLyrics", query, variables: { trackId: song.id } }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } finally {
      clearTimeout(timer);
    }
    return this.fromDeezer(data?.data?.track?.lyrics, song.duration || track.duration);
  },

  /** Deezer's lyrics object -> our { kind, source, lines }. Times are in ms. */
  fromDeezer(lyrics, duration) {
    const ms = (v) => Number(v) / 1000;
    const wbw = lyrics?.synchronizedWordByWordLines;
    if (Array.isArray(wbw) && wbw.length) {
      const lines = wbw
        .map((l) => {
          // Words may or may not carry their own spaces: normalise to "word" + separate spaces.
          const raw = (l.words || []).filter((w) => String(w.word ?? "").trim());
          const spaced = raw.some((w) => /\s$/.test(w.word) || /^\s/.test(w.word));
          const words = raw.map((w, k) => ({
            start: ms(w.start),
            end: ms(w.end),
            word: String(w.word).trim(),
            space: spaced ? /\s$/.test(w.word) || /^\s/.test(raw[k + 1]?.word || "") : k < raw.length - 1
          }));
          return { time: ms(l.start), end: ms(l.end), text: words.map((w) => w.word + (w.space ? " " : "")).join("").trim(), words };
        })
        .filter((l) => l.text && Number.isFinite(l.time));
      if (lines.length) return { kind: "synced", source: "deezer-words", lines: this.withBreaks(lines, duration) };
    }
    const sync = lyrics?.synchronizedLines;
    if (Array.isArray(sync) && sync.length) {
      const lines = sync
        .map((l) => ({ time: ms(l.milliseconds), end: ms(Number(l.milliseconds) + Number(l.duration || 0)), text: String(l.line || "").trim() }))
        .filter((l) => Number.isFinite(l.time));
      if (lines.length) return { kind: "synced", source: "deezer-lines", lines: this.withBreaks(lines, duration) };
    }
    return null; // nothing usable: LRCLIB takes over
  },

  /** Insert an empty "break" line where the voice pauses for more than 5 s (or a long intro). */
  withBreaks(lines, duration) {
    const out = [];
    if (lines[0].time > 4) out.push({ time: 0, end: lines[0].time, text: "" });
    lines.forEach((line, i) => {
      out.push(line);
      const next = lines[i + 1];
      if (line.text && line.end && next && next.time - line.end > 5) out.push({ time: line.end, end: next.time, text: "" });
    });
    return out;
  },

  // ---------- LRCLIB ----------
  async lrclib(track) {
    const api = "https://lrclib.net/api";
    const artist = this.firstArtist(track.artist);
    const params = (o) => new URLSearchParams(o).toString();
    let hit = await this.fetchJSON(`${api}/get?${params({ track_name: track.title, artist_name: artist, ...(track.duration ? { duration: Math.round(track.duration) } : {}) })}`);
    if (!hit || (!hit.syncedLyrics && !hit.plainLyrics && !hit.instrumental)) {
      const list = (await this.fetchJSON(`${api}/search?${params({ track_name: this.cleanTitle(track.title), artist_name: artist })}`)) || [];
      const score = (r) => (r.syncedLyrics ? 0 : 100) + (track.duration ? Math.abs((r.duration || 0) - track.duration) : 0);
      hit = list.filter((r) => !track.duration || Math.abs((r.duration || 0) - track.duration) < 8).sort((a, b) => score(a) - score(b))[0] || hit;
    }
    const result = !hit
      ? { kind: "none" }
      : hit.instrumental
        ? { kind: "instrumental" }
        : hit.syncedLyrics
          ? { kind: "synced", lines: this.parseLRC(hit.syncedLyrics) }
          : hit.plainLyrics
            ? { kind: "plain", lines: hit.plainLyrics.split("\n").map((text) => ({ time: null, text })) }
            : { kind: "none" };
    if (result.kind === "synced") {
      result.source = "lrclib";
      // A long intro gets the same "waiting" dots as an instrumental break.
      if (result.lines[0]?.time > 4) result.lines.unshift({ time: 0, text: "" });
    }
    return result;
  },

  /** "[01:02.34] text" -> [{ time: 62.34, text }] (several stamps per line allowed). */
  parseLRC(lrc) {
    const lines = [];
    for (const raw of lrc.split(/\r?\n/)) {
      const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
      if (!stamps.length) continue;
      const text = raw.replace(/\[[^\]]*\]/g, "").trim();
      for (const m of stamps) lines.push({ time: Number(m[1]) * 60 + Number(m[2].replace(":", ".")), text });
    }
    return lines.sort((a, b) => a.time - b.time);
  },

  // ---------- view ----------
  /** Filled 24x24 glyphs with rounded corners (Graphite icon style). */
  glyphs: {
    play: "M8 6.2v11.6c0 1 1.1 1.6 1.9 1.1l9.2-5.8c.8-.5.8-1.7 0-2.2L9.9 5.1C9.1 4.6 8 5.2 8 6.2z",
    pause: "M7.5 5h2c.8 0 1.5.7 1.5 1.5v11c0 .8-.7 1.5-1.5 1.5h-2C6.7 19 6 18.3 6 17.5v-11C6 5.7 6.7 5 7.5 5zm7 0h2c.8 0 1.5.7 1.5 1.5v11c0 .8-.7 1.5-1.5 1.5h-2c-.8 0-1.5-.7-1.5-1.5v-11c0-.8.7-1.5 1.5-1.5z",
    previous: "M6 5.5c.6 0 1 .4 1 1v11c0 .6-.4 1-1 1s-1-.4-1-1v-11c0-.6.4-1 1-1zm12.5 1.3v10.4c0 .9-1 1.4-1.7.9l-7.6-5.2c-.6-.4-.6-1.4 0-1.8l7.6-5.2c.7-.5 1.7 0 1.7.9z",
    next: "M18 5.5c.6 0 1 .4 1 1v11c0 .6-.4 1-1 1s-1-.4-1-1v-11c0-.6.4-1 1-1zM5.5 6.8v10.4c0 .9 1 1.4 1.7.9l7.6-5.2c.6-.4.6-1.4 0-1.8L7.2 5.9c-.7-.5-1.7 0-1.7.9z"
  },

  /**
   * The seek bar: click or drag (the position previews while dragging and is
   * sent to Deezer on release), arrows ±5 s, Home / End.
   */
  bindBar(bar) {
    const duration = () => this.state?.track?.duration || Number(BD.anchors.progressInput()?.max) || 0;
    const at = (e) => {
      const r = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration();
    };
    bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !this.state || !duration()) return;
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      bar.focus({ preventScroll: true });
      this.state.drag = at(e);
      bar.dataset.dragging = "true";
    });
    bar.addEventListener("pointermove", (e) => {
      if (this.state?.drag != null) this.state.drag = at(e);
    });
    const release = (e, commit) => {
      const s = this.state;
      if (!s || s.drag == null) return;
      const time = commit ? at(e) : null;
      s.drag = null;
      delete bar.dataset.dragging;
      if (time != null) this.seekTo(time, true);
    };
    bar.addEventListener("pointerup", (e) => release(e, true));
    bar.addEventListener("pointercancel", (e) => release(e, false));
    bar.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
      if (step) this.seekTo(this.position() + step, true);
      else if (e.key === "Home") this.seekTo(0, true);
      else if (e.key === "End") this.seekTo(duration() - 2, true);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
  },

  icon(d, fill = false) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (fill) svg.setAttribute("data-fill", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
    return svg;
  },

  injectButton() {
    const anchor = BD.q('[data-bd="dock"] [data-testid="queue_list_button"]') || BD.q('[data-bd="dock"] [data-testid="lyrics_button"]');
    if (!anchor || BD.q(".bd-np-btn")) return;
    const btn = BD.h(
      "button",
      { type: "button", class: "bd-np-btn", "aria-label": BD.t("En écoute", "Now playing"), "data-bd-tip": BD.t("Paroles et grande pochette · touche F", "Lyrics and big cover · F key"), onclick: () => (this.state ? this.close() : this.open()) },
      this.icon("M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5")
    );
    anchor.parentNode.insertBefore(btn, anchor);
  },

  open() {
    if (this.state) return;
    const track = this.track();
    const root = BD.h("div", { id: "bd-np", role: "dialog", "aria-modal": "true", "aria-label": BD.t("En écoute", "Now playing") });
    const bg = BD.h("div", { class: "bd-np-bg", "aria-hidden": "true" }, BD.h("img", { alt: "" }));
    const cover = BD.h("img", { class: "bd-np-cover", alt: "" });
    const title = BD.h("h2", { class: "bd-np-title" });
    const artist = BD.h("p", { class: "bd-np-artist" });
    const elapsed = BD.h("span", { class: "bd-np-time" }, "0:00");
    const total = BD.h("span", { class: "bd-np-time" }, "0:00");
    const bar = BD.h(
      "div",
      { class: "bd-np-bar", role: "slider", tabindex: "0", "aria-label": BD.t("Position", "Position"), "aria-valuemin": "0" },
      BD.h("span", { class: "bd-np-fill" }),
      BD.h("span", { class: "bd-np-thumb" })
    );
    this.bindBar(bar);
    const proxy = (testid, d, label) =>
      BD.h(
        "button",
        {
          type: "button",
          class: "bd-np-ctl",
          "data-proxy": testid,
          "aria-label": label,
          onclick: () => BD.q(`[data-bd="dock"] [data-testid^="${testid}"]`)?.click()
        },
        this.icon(d, true)
      );
    const playBtn = proxy("play_button_", this.glyphs.play, BD.t("Lecture / pause", "Play / pause"));
    playBtn.classList.add("bd-np-play");
    const lyricsBox = BD.h("div", { class: "bd-np-lyrics", "aria-live": "off" });
    const lyricsList = BD.h("ol", { class: "bd-np-lines" });
    lyricsBox.append(lyricsList);

    root.append(
      bg,
      BD.h(
        "button",
        { type: "button", class: "bd-np-close", "aria-label": BD.t("Fermer (Échap)", "Close (Esc)"), onclick: () => this.close() },
        this.icon("M6 6l12 12M18 6L6 18")
      ),
      BD.h(
        "div",
        { class: "bd-np-grid" },
        BD.h(
          "section",
          { class: "bd-np-left" },
          cover,
          BD.h("div", { class: "bd-np-meta" }, title, artist),
          BD.h("div", { class: "bd-np-progress" }, elapsed, bar, total),
          BD.h(
            "div",
            { class: "bd-np-controls" },
            proxy("previous_track_button", this.glyphs.previous, BD.t("Précédent", "Previous")),
            playBtn,
            proxy("next_track_button", this.glyphs.next, BD.t("Suivant", "Next"))
          )
        ),
        BD.h("section", { class: "bd-np-right" }, lyricsBox, BD.h("p", { class: "bd-np-source" }))
      )
    );
    document.body.append(root);
    document.documentElement.setAttribute("data-bd-np", "open");
    this.state = { root, bg, cover, title, artist, elapsed, total, bar, lyricsBox, lyricsList, playBtn, lines: [], current: -1, lastValue: -1, lastAt: 0, track: null };
    if (track) this.load(track);
    else title.textContent = BD.t("Rien en lecture", "Nothing playing");
    this.syncTransport();
    this.loop();
    BD.q(".bd-np-close", root).focus();
  },

  close() {
    const s = this.state;
    if (!s) return;
    cancelAnimationFrame(s.frame);
    s.root.setAttribute("data-closing", "true");
    document.documentElement.removeAttribute("data-bd-np");
    setTimeout(() => s.root.remove(), 220);
    this.state = null;
  },

  fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  },

  syncTransport() {
    const s = this.state;
    if (!s) return;
    const playing = this.isPlaying();
    if (s.playBtn.dataset.playing !== String(playing)) {
      s.playBtn.dataset.playing = String(playing);
      s.playBtn.replaceChildren(this.icon(playing ? this.glyphs.pause : this.glyphs.play, true));
    }
    s.playBtn.setAttribute("aria-label", playing ? BD.t("Pause", "Pause") : BD.t("Lecture", "Play"));
  },

  async load(track) {
    const s = this.state;
    s.track = track;
    // French spacing: keep "?", "!", ":" and ";" on the same line as the word before.
    s.title.textContent = track.title.replace(/ ([?!:;»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
    s.artist.textContent = track.artist;
    if (track.cover) {
      s.cover.src = track.cover;
      s.bg.firstChild.src = track.cover;
    }
    s.total.textContent = this.fmt(track.duration);
    s.lines = [];
    s.current = -1;
    s.lyricsBox.dataset.kind = "loading";
    s.lyricsList.replaceChildren(BD.h("li", { class: "bd-np-note" }, BD.t("Recherche des paroles…", "Looking for lyrics…")));
    let result;
    try {
      result = await this.lyrics(track);
    } catch (err) {
      result = { kind: "error", message: err.message };
    }
    if (this.state !== s || s.track !== track) return; // closed or track changed meanwhile
    s.lyricsBox.dataset.kind = result.kind;
    const sources = {
      "deezer-words": ["Paroles : Deezer, mot à mot", "Lyrics: Deezer, word by word"],
      "deezer-lines": ["Paroles : Deezer", "Lyrics: Deezer"],
      lrclib: ["Paroles : LRCLIB", "Lyrics: LRCLIB"]
    };
    BD.q(".bd-np-source", s.root).textContent = BD.t(...(sources[result.source] || sources.lrclib));
    const note = (fr, en) => s.lyricsList.replaceChildren(BD.h("li", { class: "bd-np-note" }, BD.t(fr, en)));
    if (result.kind === "none") return note("Pas de paroles trouvées pour ce titre.", "No lyrics found for this track.");
    if (result.kind === "instrumental") return note("Instrumental ♪", "Instrumental ♪");
    if (result.kind === "error") return note("Paroles indisponibles (connexion à lrclib.net impossible).", "Lyrics unavailable (cannot reach lrclib.net).");
    const lines = result.lines;
    s.lines = lines;
    s.lyricsList.replaceChildren(
      ...lines.map((line, i) => {
        const synced = line.time !== null;
        const content =
          synced && !line.text
            ? BD.h("span", { class: "bd-np-dots", "aria-label": "♪" }, BD.h("i"), BD.h("i"), BD.h("i"))
            : line.words
              ? BD.h("span", { class: "bd-np-text", "data-words": "true" }, line.words.map((w) => BD.h("span", { class: "bd-np-w" }, w.word + (w.space ? " " : ""))))
              : BD.h("span", { class: "bd-np-text" }, line.text || "♪");
        const li = BD.h("li", { "data-i": String(i), "data-break": String(synced && !line.text) }, content);
        if (synced) {
          li.tabIndex = 0;
          li.addEventListener("click", () => this.seekTo(line.time));
          li.addEventListener("keydown", (e) => e.key === "Enter" && this.seekTo(line.time));
        }
        return li;
      })
    );
    s.lyricsList.style.transform = "";
  },

  /** Seek Deezer's player. Lines start a hair early so the first word isn't cut. */
  seekTo(time, exact = false) {
    const input = BD.anchors.progressInput();
    const player = BD.features.find((f) => f.id === "player");
    if (!input || !player?.seek) return;
    player.seek(input, Math.max(0, exact ? time : time - 0.2));
    if (this.state) {
      // Show the new position at once instead of waiting for Deezer's next tick.
      this.state.lastValue = Number(input.value);
      this.state.lastAt = performance.now();
    }
  },

  /**
   * 0..1 progress of line i at time t. Real end when known (Deezer); otherwise
   * an estimated singing pace for words, the whole gap for a break.
   */
  lineProgress(i, t) {
    const s = this.state;
    const line = s.lines[i];
    if (!line) return 0;
    const next = s.lines[i + 1]?.time ?? (s.track?.duration || line.time + 4);
    const gap = Math.max(0.3, next - line.time);
    const span = line.end > line.time ? line.end - line.time : line.text ? Math.min(gap, Math.max(1.2, line.text.length * 0.075 + 0.4)) : gap;
    return Math.max(0, Math.min(1, (t - line.time) / span));
  },

  /** Word timings: each word's --w goes 0 -> 1 over its own duration. */
  paintWords(li, line, t) {
    const spans = li.firstChild?.children;
    if (!spans) return;
    for (let k = 0; k < line.words.length; k++) {
      const w = line.words[k];
      const v = t >= w.end ? 1 : t <= w.start ? 0 : (t - w.start) / Math.max(0.05, w.end - w.start);
      const str = v.toFixed(3);
      if (spans[k].style.getPropertyValue("--w") !== str) spans[k].style.setProperty("--w", str);
    }
  },

  loop() {
    const s = this.state;
    if (!s) return;
    const playing = this.position();
    const t = s.drag ?? playing;
    const duration = s.track?.duration || Number(BD.anchors.progressInput()?.max) || 0;
    s.elapsed.textContent = this.fmt(t);
    const pct = duration ? Math.min(100, (t / duration) * 100) : 0;
    s.bar.style.setProperty("--pos", `${pct}%`);
    s.bar.setAttribute("aria-valuemax", String(Math.round(duration)));
    s.bar.setAttribute("aria-valuenow", String(Math.round(t)));
    s.bar.setAttribute("aria-valuetext", `${this.fmt(t)} / ${this.fmt(duration)}`);
    if (s.lyricsBox.dataset.kind === "synced" && s.lines.length) {
      let i = -1;
      for (let k = 0; k < s.lines.length; k++) {
        if (s.lines[k].time <= t + 0.15) i = k;
        else break;
      }
      if (i !== s.current) {
        s.current = i;
        const items = s.lyricsList.children;
        for (let k = 0; k < items.length; k++) items[k].dataset.state = k < i ? "past" : k === i ? "current" : "next";
        const el = items[Math.max(0, i)];
        if (el) {
          const offset = el.offsetTop + el.offsetHeight / 2 - s.lyricsBox.clientHeight * 0.4;
          s.lyricsList.style.transform = `translateY(${-Math.max(0, offset)}px)`;
        }
      }
      const current = s.lyricsList.children[i];
      if (current) {
        if (s.lines[i].words) this.paintWords(current, s.lines[i], playing);
        else current.style.setProperty("--p", this.lineProgress(i, playing).toFixed(3));
      }
    }
    s.frame = requestAnimationFrame(() => this.loop());
  }
});
