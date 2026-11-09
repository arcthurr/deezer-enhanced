/*
 * Player bar, in the user's own style: floating rounded dock, round accent play
 * button, filled accent heart when liked, elapsed / thin accent bar / remaining.
 * This file only tags the parts; the look is in styles/20-shell.css.

 * `seek()` is shared with the cover wheel (dock-gestures) and the Now playing view.
 */
BD.feature({
  id: "player",
  label: ["Barre de lecture Better Deezer", "Better Deezer player bar"],

  /**
   * Seek like a drag on Deezer's Slider: mousedown (isDragging = true), then the
   * new value (onChange keeps it as the drag position), then mouseup, which calls
   * props.onChange(e.target.value). Without the mousedown, React re-renders the
   * input with the old value before mouseup and the seek goes nowhere.
   */
  seek(input, value) {
    const max = Number(input.max || 0);
    const next = Math.max(0, Math.min(max - 1, value));
    const r = input.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    input.dispatchEvent(new MouseEvent("mousedown", init));
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new MouseEvent("mouseup", init));
  },

  /** Settings > Appearance > Player bar: "full" (default) or "compact" (narrow, centered). */
  applyWidth() {
    const compact = BD.settings.get("dock:width", "full") === "compact";
    BD.mark(document.documentElement, compact ? "compact" : "full", "data-bd-dock");
  },

  setup() {
    this.applyWidth();
    BD.on("settings", (key) => key === "dock:width" && this.applyWidth());
  },

  update() {
    const dock = BD.q('[data-bd="dock"]');
    if (!dock) return;

    const play = BD.anchors.playButton();
    if (play) BD.mark(play, "play", "data-bd-role");

    const like = BD.anchors.likeButton();
    if (like) {
      BD.mark(like, "like", "data-bd-role");
      BD.mark(like, String(like.getAttribute("data-testid").endsWith("_on")), "data-bd-liked");
    }

    // Seek row: elapsed | track | remaining, as direct children of their common row.
    const track = BD.anchors.progressTrack();
    const elapsed = BD.anchors.elapsedTime();
    const remaining = BD.anchors.remainingTime();
    if (track) {
      BD.mark(track, "progress-track", "data-bd-role");
      const fill = BD.anchors.progressFill();
      if (fill) BD.mark(fill, "progress-fill", "data-bd-role");
    }
    if (track && elapsed && remaining) {
      let row = track.parentElement;
      while (row && row !== dock && !(row.contains(elapsed) && row.contains(remaining))) row = row.parentElement;
      if (row && row !== dock) {
        BD.mark(row, "progress-row", "data-bd-role");
        const childOf = (el) => {
          while (el && el.parentElement !== row) el = el.parentElement;
          return el;
        };
        BD.mark(childOf(elapsed), "time-elapsed", "data-bd-slot");
        BD.mark(childOf(track), "progress", "data-bd-slot");
        BD.mark(childOf(remaining), "time-remaining", "data-bd-slot");
      }
    }
  }
});

/* Settings > Player bar: its own tab, so the width choice is easy to find. */
BD.settingsTab({
  id: "dock",
  order: 8,
  label: ["Barre de lecture", "Player bar"],
  render: (ui) => [
    ui.section(
      BD.t("Largeur", "Width"),
      ui.row(
        BD.t("Taille de la barre de lecture", "Player bar size"),
        BD.t("Pleine : sur toute la largeur de la fenêtre. Compacte : une pilule étroite, centrée en bas.", "Full: across the whole window. Compact: a narrow pill, centered at the bottom."),
        ui.segmented("dock:width", "full", [["full", "Pleine", "Full"], ["compact", "Compacte", "Compact"]])
      )
    )
  ]
});
