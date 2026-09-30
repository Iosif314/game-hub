import * as THREE from "three";

// All art is drawn procedurally at tiny sizes; the dither pass turns grey levels into 1-bit patterns.

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  draw((x, y, rw, rh, v, a = 1) => {
    g.fillStyle = `rgba(${v},${v},${v},${a})`;
    g.fillRect(x, y, rw, rh);
  }, g);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Fresnel lens on its cast-iron pedestal; the mercury trough is the flat dish under the lens
function lens() {
  return canvasTex(40, 56, (px, g) => {
    px(13, 44, 14, 12, 55);
    px(11, 53, 18, 3, 40);
    px(5, 40, 30, 4, 150);
    px(5, 40, 30, 1, 225);
    for (let y = 6; y < 40; y++) {
      const w = Math.round(11 + 4 * Math.sin((Math.PI * (y - 6)) / 34));
      const band = Math.floor((y - 6) / 3) % 2 === 0 ? 175 : 105;
      px(20 - w, y, w * 2, 1, band);
    }
    // the flame: saturated warm colour so the post pass can keep it as the only coloured light
    g.fillStyle = "rgb(255,150,20)";
    for (let y = 19; y < 27; y++) g.fillRect(17, y, 6, 1);
    g.fillRect(19, 17, 2, 12);
    px(19, 6, 2, 34, 70);
    px(12, 6, 1, 34, 80);
    px(27, 6, 1, 34, 80);
    px(12, 2, 16, 4, 60);
    px(18, 0, 4, 2, 60);
  });
}

function bucket() {
  return canvasTex(20, 22, (px) => {
    px(3, 6, 14, 16, 120);
    px(3, 6, 14, 2, 175);
    px(5, 20, 10, 2, 90);
    px(2, 4, 16, 2, 150);
    px(4, 0, 1, 5, 70);
    px(15, 0, 1, 5, 70);
    px(4, 0, 12, 1, 70);
    px(9, 7, 7, 5, 205);
  });
}

function drum() {
  return canvasTex(18, 26, (px) => {
    px(1, 2, 16, 24, 95);
    px(1, 2, 16, 2, 150);
    px(1, 9, 16, 1, 60);
    px(1, 18, 16, 1, 60);
    px(4, 4, 3, 20, 125);
    px(12, 0, 3, 2, 70);
  });
}

function survivor() {
  return canvasTex(16, 38, (px) => {
    px(5, 1, 6, 2, 45);
    px(5, 3, 6, 6, 165);
    px(5, 3, 6, 2, 45);
    px(6, 6, 1, 1, 40);
    px(9, 6, 1, 1, 40);
    px(3, 9, 10, 15, 50);
    px(2, 10, 2, 12, 45);
    px(12, 10, 2, 12, 45);
    px(2, 22, 2, 2, 160);
    px(12, 22, 2, 2, 160);
    px(4, 24, 3, 12, 35);
    px(9, 24, 3, 12, 35);
    px(3, 36, 4, 2, 25);
    px(9, 36, 4, 2, 25);
    px(7, 10, 2, 8, 90);
  });
}

function telescope() {
  return canvasTex(24, 34, (px) => {
    px(2, 6, 20, 4, 140);
    px(2, 6, 20, 1, 200);
    px(0, 5, 3, 6, 70);
    px(20, 7, 4, 2, 70);
    px(11, 10, 2, 4, 60);
    for (let i = 0; i < 20; i++) {
      px(11 - Math.round(i * 0.45), 14 + i, 1, 1, 60);
      px(12 + Math.round(i * 0.45), 14 + i, 1, 1, 60);
      px(12, 14 + i, 1, 1, 60);
    }
  });
}

function logbook() {
  return canvasTex(18, 12, (px) => {
    px(0, 2, 18, 10, 60);
    px(1, 3, 8, 8, 200);
    px(9, 3, 8, 8, 185);
    for (let y = 4; y < 10; y += 2) {
      px(2, y, 6, 1, 110);
      px(10, y, 6, 1, 110);
    }
  });
}

function radio() {
  return canvasTex(32, 26, (px) => {
    px(0, 0, 32, 26, 70);
    px(1, 1, 30, 24, 100);
    px(3, 3, 14, 10, 55);
    for (let y = 4; y < 12; y += 2) px(4, y, 12, 1, 130);
    px(20, 4, 4, 4, 180);
    px(26, 4, 4, 4, 180);
    px(20, 10, 10, 2, 150);
    px(3, 16, 26, 6, 60);
    px(5, 18, 18, 2, 200);
    px(25, 17, 3, 4, 140);
  });
}

function windowPane() {
  return canvasTex(12, 18, (px) => {
    px(0, 0, 12, 18, 45);
    px(1, 1, 10, 16, 232);
    px(5, 1, 2, 16, 45);
    px(1, 8, 10, 2, 45);
  });
}

function ship() {
  return canvasTex(48, 30, (px) => {
    px(4, 22, 40, 5, 40);
    px(8, 27, 32, 2, 35);
    px(15, 2, 1, 20, 50);
    px(31, 5, 1, 17, 50);
    px(9, 4, 12, 16, 200);
    px(26, 7, 10, 13, 190);
    px(40, 18, 1, 4, 50);
    px(22, 18, 4, 4, 255);
  });
}

// --- high-resolution surface textures (the mosaic pass averages them, so detail shows up as texture, not noise) ---

function hash(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  return valueNoise(x, y) * 0.5 + valueNoise(x * 2.1, y * 2.1) * 0.3 + valueNoise(x * 4.3, y * 4.3) * 0.2;
}

function surfaceTex(size, shade) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(255, shade(x, y)));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function planks() {
  const size = 256;
  const board = 32;
  return surfaceTex(size, (x, y) => {
    const row = Math.floor(y / board);
    const shift = hash(row, 7) * size;
    const seam = (x + shift) % 128;
    const tone = 95 + hash(row, 3) * 45;
    const grain = Math.sin((x + shift) * 0.05 + fbm(x * 0.02, y * 0.25) * 6) * 10;
    let v = tone + grain + (fbm(x * 0.06, y * 0.06) - 0.5) * 30;
    if (y % board < 2) v -= 55;
    if (seam < 2) v -= 45;
    return v;
  });
}

function stone() {
  const size = 256;
  const rowH = 32;
  const blockW = 64;
  return surfaceTex(size, (x, y) => {
    const row = Math.floor(y / rowH);
    const off = (row % 2) * (blockW / 2);
    const col = Math.floor((x + off) / blockW);
    const bx = (x + off) % blockW;
    const by = y % rowH;
    const tone = 92 + (hash(col, row) - 0.5) * 36;
    let v = tone + (fbm(x * 0.05, y * 0.05) - 0.5) * 50 + (valueNoise(x * 0.4, y * 0.4) - 0.5) * 14;
    const edge = Math.min(bx, blockW - bx, by, rowH - by);
    if (edge < 2) v = 50 + valueNoise(x, y) * 16;
    else if (edge < 4) v -= 18;
    return v;
  });
}

export function makeSprites() {
  return {
    lens: lens(),
    bucket: bucket(),
    drum: drum(),
    survivor: survivor(),
    telescope: telescope(),
    logbook: logbook(),
    radio: radio(),
    window: windowPane(),
    ship: ship(),
    planks: planks(),
    stone: stone(),
  };
}
