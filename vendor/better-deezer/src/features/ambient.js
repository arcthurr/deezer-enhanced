/*
 * Ambient header: on album / playlist / artist pages, tint the masthead with a
 * flat color sampled from the cover. The 18% mix into the ground happens in CSS
 * (--bd-ambient in 00-tokens.css) so it follows the light and dark themes. No gradient.
 *
 * Deezer's cover <img> has no crossorigin attribute, so drawing it would taint
 * the canvas. The CDN (cdn-images.dzcdn.net) answers CORS for www.deezer.com,
 * so we load our own anonymous copy of the same picture.
 */
BD.feature({
  id: "ambient",
  label: ["En-têtes teintés par la pochette", "Headers tinted by the cover"],

  setup() {
    this.lastSrc = null;
  },

  sample(src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (src !== this.lastSrc) return; // page changed meanwhile
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 8;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
        }
        const n = d.length / 4;
        const avg = (v) => Math.round(v / n);
        document.documentElement.style.setProperty("--bd-ambient-src", `rgb(${avg(r)}, ${avg(g)}, ${avg(b)})`);
      } catch {
        document.documentElement.style.removeProperty("--bd-ambient-src");
      }
    };
    img.onerror = () => document.documentElement.style.removeProperty("--bd-ambient-src");
    img.src = src;
  },

  update() {
    const page = BD.anchors.page();
    if (!page) return;
    const isDetail = /\/(album|playlist|artist|profile|show|episode|smarttracklist)\//.test(BD.path());
    const header = isDetail ? BD.anchors.masthead() || page.querySelector("header") : null;

    BD.unmarkAll("page-header", header);
    if (!header) {
      if (this.lastSrc) {
        this.lastSrc = null;
        document.documentElement.style.removeProperty("--bd-ambient-src");
      }
      return;
    }
    BD.mark(header, "page-header");

    const img = header.querySelector("img");
    const src = img?.currentSrc || img?.src;
    if (!src || src === this.lastSrc) return;
    this.lastSrc = src;
    this.sample(src);
  }
});
