// The table seen from the dealer's side: the back wall, three customers across the felt, the shoe
// on the right, my cards in the middle, and the camera dome in the ceiling corner. 480×270 pixels.

export const W = 480;
export const H = 270;
export const SEAT_X = [120, 240, 360];
export const SHOE = { x: 396, y: 150, w: 40, h: 46 };
export const DEALER_CARDS = { x: 240, y: 182 };
export const CARD_W = 22;
export const CARD_H = 30;

// the far edge of the table, an arc; customers sit just behind it
const RY = 178;
export const arcY = (x) => Math.round(270 - RY * Math.sqrt(Math.max(0, 1 - ((x - 240) / 252) ** 2)));
export const seatCardPos = (i) => ({ x: SEAT_X[i], y: arcY(SEAT_X[i]) + 30 });
export const seatBetPos = (i) => ({ x: SEAT_X[i] + 34, y: arcY(SEAT_X[i]) + 22 });

const rect = (c, x, y, w, h, col) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function ellipse(c, cx, cy, rx, ry, col) {
  c.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

// --- a 3×5 pixel font for ranks and totals ---
const GLYPH = {
  A: ["010", "101", "111", "101", "101"],
  J: ["001", "001", "001", "101", "010"],
  Q: ["010", "101", "101", "110", "011"],
  K: ["101", "110", "100", "110", "101"],
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["110", "001", "010", "100", "111"],
  3: ["110", "001", "010", "001", "110"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "110", "001", "110"],
  6: ["011", "100", "110", "101", "010"],
  7: ["111", "001", "010", "010", "010"],
  8: ["010", "101", "010", "101", "010"],
  9: ["010", "101", "011", "001", "110"],
  "/": ["001", "001", "010", "100", "100"],
  "+": ["000", "010", "111", "010", "000"],
  "-": ["000", "000", "111", "000", "000"],
};

export function text(c, str, x, y, col, s = 1) {
  c.fillStyle = col;
  let cx = Math.round(x);
  for (const ch of String(str)) {
    const g = GLYPH[ch];
    if (g) for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === "1") c.fillRect(cx + k * s, Math.round(y) + r * s, s, s);
    cx += 4 * s;
  }
}
export const textWidth = (str, s = 1) => String(str).length * 4 * s - s;

const SUIT = {
  s: ["00100", "01110", "11111", "11111", "00100"],
  h: ["01010", "11111", "11111", "01110", "00100"],
  d: ["00100", "01110", "11111", "01110", "00100"],
  c: ["01110", "01110", "11111", "11111", "00100"],
};
const RED = "#b3262c";
const INK = "#1c1a1a";

function suit(c, s, x, y, k) {
  c.fillStyle = s === "h" || s === "d" ? RED : INK;
  const g = SUIT[s];
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if (g[r][q] === "1") c.fillRect(x + q * k, y + r * k, k, k);
}

export function drawCard(c, card, x, y, faceUp, glow = null) {
  x = Math.round(x - CARD_W / 2);
  y = Math.round(y - CARD_H / 2);
  rect(c, x + 1, y + 2, CARD_W, CARD_H, "rgba(0,0,0,0.35)");
  if (glow) rect(c, x - 2, y - 2, CARD_W + 4, CARD_H + 4, glow);
  rect(c, x, y, CARD_W, CARD_H, "#2a2422");
  if (!faceUp) {
    rect(c, x + 1, y + 1, CARD_W - 2, CARD_H - 2, "#7a1e24");
    for (let i = 3; i < CARD_W - 3; i += 4) for (let j = 3; j < CARD_H - 3; j += 4) rect(c, x + i, y + j, 2, 2, "#5a1418");
    return;
  }
  rect(c, x + 1, y + 1, CARD_W - 2, CARD_H - 2, "#efe6d2");
  const col = card.s === "h" || card.s === "d" ? RED : INK;
  text(c, card.r === "10" ? "10" : card.r, x + 3, y + 3, col, card.r === "10" ? 1 : 2);
  suit(c, card.s, x + 6, y + 14, 2);
}

// --- chips: a small stack whose colours show roughly how much is there ---
export function drawChips(c, x, y, amount) {
  if (amount <= 0) return;
  const cols = amount >= 100 ? ["#1d1d24", "#e8c25a"] : amount >= 50 ? ["#2d4f9e", "#e9e4d8"] : ["#a3262c", "#e9e4d8"];
  const n = Math.min(10, Math.max(1, Math.round(amount / (amount >= 100 ? 50 : 10))));
  for (let i = 0; i < n; i++) {
    const yy = y - i * 2;
    ellipse(c, x, yy, 6, 2, "#0d0d0d");
    ellipse(c, x, yy - 1, 6, 2, cols[0]);
    rect(c, x - 1, yy - 2, 3, 1, cols[1]);
  }
}

// --- the room ---
export function drawRoom(c, t, cameraOn) {
  rect(c, 0, 0, W, H, "#0c0a09");
  // the back wall, panelled, with a lamp over the table
  rect(c, 0, 0, W, 104, "#1b1512");
  for (let x = 8; x < W; x += 40) {
    rect(c, x, 8, 28, 70, "#211a16");
    rect(c, x, 8, 28, 1, "#2c231d");
  }
  rect(c, 0, 82, W, 3, "#3a2a1e");
  const g = c.createRadialGradient(240, 40, 6, 240, 130, 260);
  g.addColorStop(0, "rgba(255,214,150,0.22)");
  g.addColorStop(1, "rgba(255,214,150,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // the camera dome in the corner: its light is red while it watches this table
  ellipse(c, 452, 10, 12, 7, "#2b2b30");
  ellipse(c, 452, 12, 8, 5, "#101014");
  if (cameraOn && Math.floor(t * 3) % 2 === 0) ellipse(c, 452, 12, 2, 2, "#ff3030");
}

export function drawTable(c, t, cameraOn) {
  // the felt, its wooden rail along the far edge, and a printed arc
  const half = (y) => Math.round(252 * Math.sqrt(Math.max(0, 1 - ((270 - y) / RY) ** 2)));
  // the rail first, then the felt inside it, a few pixels in
  for (let y = 270 - RY - 6; y < H; y++) {
    const h = half(y + 6);
    if (h > 0) rect(c, 240 - h - 8, y, h * 2 + 16, 1, y < 270 - RY ? "#5b3620" : "#4b2b17");
  }
  for (let y = 270 - RY; y < H; y++) {
    const h = half(y);
    if (h > 0) rect(c, 240 - h, y, h * 2, 1, y < 270 - RY + 3 ? "#174a30" : "#1f5b3b");
  }
  rect(c, 0, 262, W, 8, "#3a2213");
  for (let x = 0; x < W; x++) {
    const y = arcY(x);
    if (y < 266) rect(c, x, y + 30 + 34, 1, 1, "rgba(233,220,180,0.25)");
  }
  // the shoe and the discard tray
  const s = SHOE;
  rect(c, s.x - 2, s.y - 2, s.w + 4, s.h + 4, "#120d0a");
  rect(c, s.x, s.y, s.w, s.h, "#5a3a22");
  rect(c, s.x + 4, s.y + 4, s.w - 8, 10, "#7a1e24");
  rect(c, s.x + 4, s.y + 4, s.w - 8, 1, "#a8343b");
  rect(c, 30, 156, 40, 30, "#3a2618");
  rect(c, 32, 158, 36, 26, "#24180f");
  // the chip rack in front of me
  rect(c, 180, 238, 120, 20, "#24180f");
  const rack = ["#a3262c", "#2d4f9e", "#1d1d24", "#2f7a46", "#e8c25a", "#a3262c"];
  rack.forEach((col, i) => {
    rect(c, 184 + i * 19, 241, 16, 14, "#0d0d0d");
    rect(c, 185 + i * 19, 241, 14, 13, col);
    for (let k = 0; k < 13; k += 3) rect(c, 185 + i * 19, 241 + k, 14, 1, "rgba(0,0,0,0.25)");
  });
  if (cameraOn) {
    c.fillStyle = "rgba(255,40,40,0.06)";
    c.fillRect(0, 60, W, H - 60);
  }
}

// --- a customer, from the chest up, behind the far rail ---
// gaze: "hands" | "cards" | "away"; side: -1 or 1, which way "away" looks
export function drawCustomer(c, cu, x, t) {
  const L = cu.look;
  const base = arcY(x) + 2;
  const bob = Math.round(Math.sin(t * 1.3 + x) * 0.6);
  const big = L.big ? 1.15 : 1;
  const hy = base - 46 * big + bob; // head centre
  // shoulders and coat
  const sw = Math.round(30 * big);
  rect(c, x - sw, base - 22 * big + bob, sw * 2, 26 * big, L.coat);
  rect(c, x - sw + 2, base - 24 * big + bob, sw * 2 - 4, 2, L.coat);
  if (L.pattern) for (let i = 0; i < 12; i++) rect(c, x - sw + 3 + ((i * 11) % (sw * 2 - 6)), base - 20 * big + bob + ((i * 7) % 18), 2, 2, L.pattern);
  rect(c, x - 4, base - 24 * big + bob, 8, 10, L.shirt || "#d8d2c4");
  if (L.tie) rect(c, x - 1, base - 22 * big + bob, 3, 9, L.tie);
  if (L.chain) for (let i = -6; i <= 6; i++) rect(c, x + i, base - 16 * big + bob + Math.abs(i) * 0.3, 1, 1, "#e8c25a");
  // neck and head
  rect(c, x - 4, hy + 10, 8, 6, L.skin);
  ellipse(c, x, hy, Math.round(11 * big), Math.round(13 * big), L.skin);
  // hair or hat
  if (L.hat === "fedora") {
    rect(c, x - 16, hy - 9, 32, 3, "#1e1b1a");
    rect(c, x - 10, hy - 17, 20, 9, "#2a2624");
    rect(c, x - 10, hy - 11, 20, 2, "#6b1c1c");
  } else {
    for (let r = 0; r < 6; r++) rect(c, x - 11 + r * 0.4, hy - 13 + r, 22 - r * 0.8, 1, L.hair);
  }
  if (L.shades) {
    rect(c, x - 8, hy - 11, 7, 3, "#151515");
    rect(c, x + 1, hy - 11, 7, 3, "#151515");
  }
  // eyes: where they look is the whole game
  const g = cu.gaze;
  const px = g === "away" ? cu.side * 2 : 0;
  const py = g === "hands" ? 1 : g === "cards" ? 1 : 0;
  for (const ex of [x - 5, x + 3]) {
    rect(c, ex, hy - 2, 3, 2, "#f2eee6");
    rect(c, ex + 1 + Math.max(-1, Math.min(1, px)), hy - 2 + py, 1, 1, "#1a1a1a");
  }
  if (L.glasses) {
    rect(c, x - 7, hy - 3, 6, 1, "#c9c9c9");
    rect(c, x + 2, hy - 3, 6, 1, "#c9c9c9");
    rect(c, x - 1, hy - 3, 3, 1, "#c9c9c9");
  }
  if (L.mustache) rect(c, x - 4, hy + 4, 8, 2, L.hair === "#d8d2c4" ? "#9a958c" : L.hair);
  rect(c, x - 2, hy + 7, 5, 1, "#7a4a3a");
  if (L.cigar) {
    rect(c, x + 3, hy + 7, 8, 2, "#6a4022");
    rect(c, x + 11, hy + 7, 1, 2, Math.floor(t * 4) % 2 ? "#ff7a2a" : "#ffb04a");
  }
  return hy;
}

// above the head: an eye that shows what the customer is watching, and a bar of how suspicious they are
export function drawWatch(c, cu, x, hy, t) {
  const y = hy - 26;
  const g = cu.gaze;
  if (g === "away") {
    rect(c, x - 4, y + 2, 9, 1, "#6c645c");
  } else {
    const col = g === "hands" ? "#ff4a4a" : "#e8e2d4";
    ellipse(c, x, y + 2, 5, 2, col);
    ellipse(c, x, y + 2, 1, 1, "#141414");
  }
  // suspicion: a thin bar to the left of the head, filling upward
  const h = 22;
  rect(c, x - 22, hy - 12, 3, h, "#2a2220");
  const f = Math.round((cu.susp / 100) * h);
  rect(c, x - 22, hy - 12 + h - f, 3, f, cu.susp > 70 ? "#ff4040" : "#d88a3a");
  // the whale's mood, to the right
  if (cu.type === "whale") {
    rect(c, x + 20, hy - 12, 3, h, "#2a2220");
    const m = Math.round((cu.mood / 100) * h);
    rect(c, x + 20, hy - 12 + h - m, 3, m, "#e8c25a");
  }
}

// the floor manager, a tall dark figure walking the back of the room
export function drawManager(c, x, t, close) {
  const y = close ? 30 : 38;
  const s = close ? 1.1 : 0.85;
  rect(c, x - 9 * s, y + 10 * s, 18 * s, 40 * s, "#0f0d0c");
  rect(c, x - 1, y + 12 * s, 3, 14 * s, "#5a1418");
  ellipse(c, x, y, Math.round(7 * s), Math.round(8 * s), "#3a2f29");
  rect(c, x - 4, y - 1, 3, 1, close ? "#ff5050" : "#9a8f84");
  rect(c, x + 2, y - 1, 3, 1, close ? "#ff5050" : "#9a8f84");
}

// a short bar for the hand tricks; zone = [from, to] in 0..1, mark = 0..1
export function drawTrickBar(c, label, zone, mark, state) {
  const x = 160;
  const y = 214;
  const w = 160;
  rect(c, x - 4, y - 4, w + 8, 18, "rgba(10,8,7,0.85)");
  rect(c, x, y, w, 10, "#2a2220");
  rect(c, x + zone[0] * w, y, (zone[1] - zone[0]) * w, 10, state === "bad" ? "#8a2a2a" : "#3f8a52");
  rect(c, x + Math.min(1, mark) * w - 1, y - 2, 3, 14, state === "good" ? "#e8e2d4" : "#f0c060");
}

export function drawBeats(c, beats, now, hits) {
  const x = 176;
  const y = 214;
  rect(c, x - 8, y - 4, 144, 18, "rgba(10,8,7,0.85)");
  beats.forEach((b, i) => {
    const near = Math.abs(now - b) < 0.12;
    const col = hits[i] === true ? "#3f8a52" : hits[i] === false ? "#8a2a2a" : near ? "#f0c060" : "#4a403a";
    ellipse(c, x + 8 + i * 36, y + 5, 6, 5, col);
  });
}
