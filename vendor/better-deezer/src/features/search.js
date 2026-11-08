/* Search: Ctrl/Cmd+K focuses the field, a key hint sits inside it,
 * and the results popover is tagged for styling. */
BD.feature({
  id: "search",
  setup() {
    document.addEventListener(
      "keydown",
      (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
        const field = BD.anchors.searchField();
        if (!field) return;
        e.preventDefault();
        field.focus();
        field.select?.();
      },
      true
    );
  },
  update() {
    const field = BD.anchors.searchField();
    const group = field?.closest('[data-group="true"], [role="group"]');
    if (group && !group.querySelector(".bd-kbd")) {
      const hint = document.createElement("span");
      hint.className = "bd-kbd";
      hint.setAttribute("aria-hidden", "true");
      hint.textContent = navigator.platform.startsWith("Mac") ? "⌘ K" : "Ctrl K";
      group.appendChild(hint);
    }

    const popover = BD.anchors.searchPopover();
    if (popover) BD.mark(popover, "search-popover");
  }
});
