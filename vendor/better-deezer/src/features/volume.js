/*
 * Volume, as in the user's captures:
 *  - hover: a surface-3 dot under the icon; the wheel already works;
 *  - click the volume icon: a 140px slider unfolds to the LEFT inside a 48px
 *    surface-2 pill, the icon stays on the right with a 2px accent ring and the
 *    neighbouring icons slide over 320ms;
 *  - while adjusting (wheel, drag, arrows) the track turns 6px accent and a
 *    "70 %" bubble shows above;
 *  - wheel over the icon or the slider: 5% steps, 1% with Shift; arrows on the slider;
 *  - click the icon again (while open), Alt+click or middle click: Deezer's native mute;
 *  - Escape or a click elsewhere: it folds back.
 * Design: canvas artboard "Overlays".
 *
 * Deezer's own control is a hover popover (Chakra, isLazy) holding
 * input[data-testid="volume_menu_bar"]: we open it invisibly, write the value
 * through the native setter and let React pick up the "input" event, so the app
 * keeps its own state (Ac.control.setVolume).
 *
 * We never move Deezer's button (React owns it). Our slider is a sibling
 * inserted just before it, which React tolerates.
 */
BD.feature({
  id: "volume",
  label: ["Volume dépliable + molette", "Unfolding volume + mouse wheel"],
  step: 5,
  open: false,

  slider() {
    return document.querySelector(".bd-volume");
  },

  /** Deezer only mounts its range input while the hover popover is open. */
  hoverNative(button, enter) {
    if (!button) return;
    const r = button.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      relatedTarget: enter ? null : document.body
    };
    const types = enter ? ["pointerover", "pointerenter", "mouseover", "mouseenter"] : ["pointerout", "pointerleave", "mouseout", "mouseleave"];
    for (const type of types) {
      const Ctor = type.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
      button.dispatchEvent(new Ctor(type, { ...init, pointerType: "mouse" }));
    }
  },

  writeNative(input, ratio) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, String(Math.round(min + (max - min) * ratio)));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  },

  readRatio() {
    const input = BD.anchors.volumeInput();
    if (input) {
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      if (max > min) return (Number(input.value) - min) / (max - min);
    }
    return BD.settings.get("volume", 0.5);
  },

  setRatio(ratio) {
    const next = Math.max(0, Math.min(1, ratio));
    BD.settings.set("volume", next);
    this.paint(next);
    clearTimeout(this.applyTimer);
    const button = BD.anchors.volumeButton();
    const started = Date.now();
    let opened = false;
    const apply = () => {
      const input = BD.anchors.volumeInput();
      if (input) {
        this.writeNative(input, next);
        if (opened) this.closeTimer = setTimeout(() => this.hoverNative(BD.anchors.volumeButton(), false), 400);
        return;
      }
      if (Date.now() - started > 1200) return BD.log("volume input never mounted");
      if (!opened) {
        clearTimeout(this.closeTimer);
        this.hoverNative(button, true);
        opened = true;
      }
      this.applyTimer = setTimeout(apply, 60);
    };
    apply();
  },

  paint(ratio) {
    const wrap = this.slider();
    if (!wrap) return;
    const range = wrap.querySelector("input");
    const pct = Math.round(ratio * 100);
    range.value = String(pct);
    range.setAttribute("aria-valuetext", `${pct}%`);
    wrap.style.setProperty("--bd-volume", `${pct}%`);
    wrap.style.setProperty("--bd-volume-n", String(pct / 100));
    wrap.querySelector(".bd-volume-bubble").textContent = `${pct} %`;
  },

  /** Show the active track + bubble for a moment. */
  pulse() {
    const wrap = this.slider();
    if (!wrap) return;
    wrap.setAttribute("data-active", "true");
    clearTimeout(this.pulseTimer);
    this.pulseTimer = setTimeout(() => wrap.removeAttribute("data-active"), 900);
  },

  setOpen(open) {
    this.open = open;
    const wrap = this.slider();
    const button = BD.anchors.volumeButton();
    if (wrap) {
      wrap.setAttribute("data-open", String(open));
      wrap.querySelector("input").tabIndex = open ? 0 : -1;
    }
    if (button) {
      BD.mark(button, String(open), "data-bd-volume-open");
      button.setAttribute("aria-expanded", String(open));
    }
    if (open) {
      this.paint(this.readRatio());
      this.measure();
    }
  },

  /** The pill drawn by our slider extends under Deezer's button: measure how far. */
  measure() {
    const wrap = this.slider();
    const button = BD.anchors.volumeButton();
    if (!wrap || !button) return;
    const overlap = Math.max(0, button.getBoundingClientRect().right - wrap.getBoundingClientRect().right);
    wrap.style.setProperty("--bd-volume-overlap", `${Math.round(overlap)}px`);
  },

  wheel(e) {
    e.preventDefault();
    e.stopPropagation();
    const step = (e.shiftKey ? 1 : Number(BD.settings.get("volume:step", this.step)) || this.step) / 100;
    const dir = (e.deltaY || e.deltaX) < 0 ? 1 : -1;
    this.setRatio(this.readSlider() + dir * step);
    this.pulse();
  },

  readSlider() {
    const range = this.slider()?.querySelector("input");
    return range ? Number(range.value) / 100 : this.readRatio();
  },

  setup() {
    BD.volume = this; // used by the sleep timer (features/modules.js) to fade out
    document.documentElement.setAttribute("data-bd-volume", "inline");

    // Capture phase on document: runs before React's root listener, so the
    // native mute toggle never fires on a plain click.
    document.addEventListener(
      "click",
      (e) => {
        const button = e.target.closest?.('[data-testid^="volume_button"]');
        if (!button) {
          if (this.open && !e.target.closest?.(".bd-volume")) this.setOpen(false);
          return;
        }
        if (e.altKey || this.open) return; // re-click while open or Alt+click: Deezer's mute
        e.preventDefault();
        e.stopImmediatePropagation();
        this.setOpen(!this.open);
      },
      true
    );

    // Middle click on the icon: mute, like most players.
    document.addEventListener(
      "auxclick",
      (e) => {
        const button = e.button === 1 && e.target.closest?.('[data-testid^="volume_button"]');
        if (!button) return;
        e.preventDefault();
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, altKey: true }));
      },
      true
    );

    document.addEventListener(
      "wheel",
      (e) => {
        if (e.target.closest?.('[data-testid^="volume_button"], .bd-volume')) this.wheel(e);
      },
      { capture: true, passive: false }
    );

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape" || !this.open) return;
        this.setOpen(false);
        BD.anchors.volumeButton()?.focus();
      },
      true
    );

    addEventListener("resize", () => this.open && this.measure());
  },

  update() {
    const button = BD.anchors.volumeButton();
    if (!button) return;
    BD.mark(button, "volume-button", "data-bd-role");
    if (button.getAttribute("data-bd-volume-open") !== String(this.open)) {
      BD.mark(button, String(this.open), "data-bd-volume-open");
    }

    // Hide Deezer's hover popover: our slider drives it.
    const menu = BD.anchors.volumeMenu();
    if (menu) {
      const popper = menu.closest(".chakra-popover__popper, [data-popper-placement]") || menu;
      BD.mark(popper, "volume-native");
      const input = BD.anchors.volumeInput();
      if (input && !this.slider()?.matches(":active")) this.paint(this.readRatio());
    }

    let wrap = this.slider();
    if (wrap && wrap.nextElementSibling === button) return;
    wrap?.remove();

    const range = BD.h("input", {
      type: "range",
      min: "0",
      max: "100",
      step: "1",
      tabindex: "-1",
      "aria-label": "Volume"
    });
    range.addEventListener("input", (e) => {
      e.stopPropagation();
      this.setRatio(Number(range.value) / 100);
      this.pulse();
    });
    range.addEventListener("keydown", (e) => e.stopPropagation()); // don't trigger Deezer's hotkeys

    wrap = BD.h(
      "span",
      { class: "bd-volume", "data-open": String(this.open) },
      BD.h("span", { class: "bd-volume-track" }, range),
      BD.h("span", { class: "bd-volume-bubble", "aria-hidden": "true" })
    );
    button.parentNode.insertBefore(wrap, button);
    this.paint(this.readRatio());
    if (this.open) this.measure();
  }
});
