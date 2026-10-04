// The picture: a 320×180 grey scene dithered down to five faded sepia tones, with a second layer on
// top for the only things that keep their colour — the emotions and the blood.

export const W = 320;
export const H = 180;

const PAL = [
  [20, 15, 12],
  [54, 42, 32],
  [98, 79, 59],
  [152, 127, 96],
  [214, 196, 162],
];

export function createScreen(canvas) {
  canvas.width = W;
  canvas.height = H;
  const out = canvas.getContext("2d");
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = W;
  baseCanvas.height = H;
  const base = baseCanvas.getContext("2d", { willReadFrequently: true });
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = W;
  colorCanvas.height = H;
  const color = colorCanvas.getContext("2d");
  for (const c of [out, base, color]) c.imageSmoothingEnabled = false;

  // interleaved gradient noise: an even threshold with no cross-hatch
  const thr = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1);
      thr[y * W + x] = 0.5 + ((v % 1) - 0.5) * 0.75;
    }
  }
  const img = out.createImageData(W, H);

  return {
    base,
    color,
    // a uniform darkening over the grey scene before it is dithered (night, fading)
    dim: 1,
    clear() {
      base.globalAlpha = 1;
      base.fillStyle = "#000";
      base.fillRect(0, 0, W, H);
      color.clearRect(0, 0, W, H);
    },
    present() {
      const src = base.getImageData(0, 0, W, H).data;
      const d = img.data;
      const dim = this.dim;
      for (let i = 0, p = 0; i < W * H; i++, p += 4) {
        const l = ((src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) / 255) * dim;
        const s = l * 4;
        let k = Math.floor(s);
        if (s - k > thr[i]) k++;
        if (k > 4) k = 4;
        const c = PAL[k];
        d[p] = c[0];
        d[p + 1] = c[1];
        d[p + 2] = c[2];
        d[p + 3] = 255;
      }
      out.putImageData(img, 0, 0);
      out.drawImage(color.canvas, 0, 0);
    },
  };
}

// grey fill in the scene layer: v is 0..255
export function rect(ctx, x, y, w, h, v) {
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// coloured fill in the colour layer
export function crect(ctx, x, y, w, h, [r, g, b], a = 1) {
  ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// a filled ellipse in grey, pixel by pixel so the edge stays hard
export function ellipse(ctx, cx, cy, rx, ry, v) {
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

// a 1px line in grey
export function line(ctx, x0, y0, x1, y1, v) {
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}

// small seeded random for things that must look the same every frame
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
