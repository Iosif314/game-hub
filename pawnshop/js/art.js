// Everything drawn: the counter, the people at the grille, the back room with the chair, the jars.
// Scene shapes go in grey on the base layer; colour (gas, blood) goes on the colour layer.
import { W, H, rect, crect, ellipse, line, rng } from "./screen.js?v=20261006c";
import { EMOTIONS } from "./data.js?v=20261006c";

// --- the counter: the grille, the counter top, the ledger, the scale, the three balls ---
export function drawCounter(b, t) {
  rect(b, 0, 0, W, 112, 46);
  for (let x = 4; x < W; x += 9) rect(b, x, 0, 1, 112, 38);
  // the pawnbroker's sign: three balls on a bracket
  rect(b, 14, 10, 30, 2, 70);
  for (const [x, y] of [
    [20, 22],
    [34, 22],
    [27, 33],
  ]) {
    line(b, x, 12, x, y - 5, 60);
    ellipse(b, x, y, 5, 5, 120);
    rect(b, x - 2, y - 3, 2, 2, 190);
  }
  // window frame and the dim street side behind the grille
  rect(b, 92, 8, 136, 106, 92);
  rect(b, 98, 14, 124, 98, 24);
  drawRulesPaper(b);
}

// a soft warm glow hugging the outline of something the mouse can use. `paint` draws the object's
// silhouette into a hidden mask; the pixels just outside it light up (on the colour layer, so the
// glow is not dithered away).
const mask = document.createElement("canvas");
mask.width = W;
mask.height = H;
const mctx = mask.getContext("2d", { willReadFrequently: true });
const ring = new Uint8Array(W * H);

export function drawGlow(c, paint, t) {
  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = "#fff";
  paint(mctx);
  const d = mctx.getImageData(0, 0, W, H).data;
  const inside = (i) => d[i * 4 + 3] > 0;
  ring.fill(0);
  // first ring: empty pixels touching the shape; second ring: empty pixels touching the first
  for (let pass = 1; pass <= 2; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (inside(i) || ring[i]) continue;
        const near = (j) => (pass === 1 ? inside(j) : ring[j] === 1);
        if ((x > 0 && near(i - 1)) || (x < W - 1 && near(i + 1)) || (y > 0 && near(i - W)) || (y < H - 1 && near(i + W))) ring[i] = pass;
      }
    }
  }
  const p = 0.6 + Math.sin(t * 5) * 0.25;
  const warm = [255, 226, 160];
  for (let i = 0; i < W * H; i++) {
    if (ring[i]) crect(c, i % W, Math.floor(i / W), 1, 1, warm, ring[i] === 1 ? p : p * 0.3);
  }
}

// the solid outline of a jar: lid and body
export function jarSilhouette(m, x, y, w, h) {
  m.fillRect(x - 1, y - 5, w + 2, 5);
  m.fillRect(x, y, w, h);
}

// the solid outline of the rules paper: the sheet and its pin
export function rulesSilhouette(m) {
  const { x, y, w, h } = RULES_PAPER;
  m.fillRect(x, y, w, h);
  m.fillRect(x + Math.floor(w / 2) - 1, y - 1, 3, 3);
}

// the guild's rules, pinned to the wall beside the grille
export const RULES_PAPER = { x: 240, y: 18, w: 42, h: 58 };

function drawRulesPaper(b) {
  const { x, y, w, h } = RULES_PAPER;
  rect(b, x + 2, y + 2, w, h, 28);
  rect(b, x, y, w, h, 186);
  rect(b, x, y + h - 3, w, 3, 160);
  rect(b, x + w - 3, y, 3, h, 166);
  // a heading, three numbered rules, the guild's seal
  rect(b, x + 7, y + 6, w - 14, 2, 70);
  for (let i = 0; i < 3; i++) {
    const ly = y + 15 + i * 10;
    rect(b, x + 5, ly, 2, 2, 60);
    rect(b, x + 9, ly, w - 16, 1, 104);
    rect(b, x + 9, ly + 3, w - 22 - i * 3, 1, 104);
  }
  ellipse(b, x + w - 11, y + h - 11, 5, 5, 120);
  ellipse(b, x + w - 11, y + h - 11, 3, 3, 150);
  rect(b, x + w / 2 - 1, y - 1, 3, 3, 90);
}

export function drawGrille(b) {
  for (let x = 102; x < 222; x += 12) rect(b, x, 14, 2, 98, 14);
  rect(b, 98, 56, 124, 2, 14);
}

export function drawCounterTop(b, t, lampOn = true, bellSince = -10) {
  rect(b, 0, 112, W, 68, 66);
  rect(b, 0, 112, W, 10, 112);
  rect(b, 0, 112, W, 1, 160);
  for (let x = 0; x < W; x += 40) rect(b, x, 124, 1, 56, 52);
  // ledger
  rect(b, 16, 124, 70, 34, 60);
  rect(b, 18, 125, 32, 31, 200);
  rect(b, 52, 125, 32, 31, 196);
  rect(b, 50, 125, 2, 31, 110);
  for (let y = 129; y < 154; y += 4) {
    rect(b, 21, y, 26, 1, 150);
    rect(b, 55, y, 26, 1, 150);
  }
  // pawn tickets
  rect(b, 96, 132, 14, 9, 186);
  rect(b, 100, 136, 14, 9, 204);
  // scale
  rect(b, 262, 150, 36, 4, 120);
  rect(b, 278, 116, 4, 34, 132);
  rect(b, 256, 116, 48, 2, 150);
  line(b, 260, 118, 256, 132, 120);
  line(b, 260, 118, 266, 132, 120);
  rect(b, 254, 132, 14, 2, 160);
  line(b, 300, 118, 296, 130, 120);
  line(b, 300, 118, 306, 130, 120);
  rect(b, 294, 130, 14, 2, 160);
  drawBell(b, bellSince);
  // oil lamp and its pool of light
  rect(b, 214, 136, 12, 6, 120);
  rect(b, 217, 120, 6, 16, 170);
  if (lampOn) {
    const flick = 1 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.03;
    const g = b.createRadialGradient(220, 124, 2, 220, 124, 120 * flick);
    g.addColorStop(0, "rgba(255,255,255,0.32)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    b.globalCompositeOperation = "lighter";
    b.fillStyle = g;
    b.fillRect(0, 0, W, H);
    b.globalCompositeOperation = "source-over";
    rect(b, 219, 124, 2, 4, 255);
  }
}

// the desk bell on the counter; `since` is the time since it was last struck
export function drawBell(b, since) {
  const ringing = since >= 0 && since < 0.5;
  const sx = ringing ? Math.round(Math.sin(since * 60) * (1 - since / 0.5) * 1.5) : 0;
  const x = 182 + sx;
  const y = 122;
  rect(b, x - 7, y + 4, 14, 2, 70);
  ellipse(b, x, y + 3, 6, 4, 150);
  rect(b, x - 7, y + 4, 14, 2, 96);
  rect(b, x - 2, y - 2, 4, 2, 120);
  rect(b, x - 3, y + 1, 2, 1, 210);
  if (ringing) {
    // the ring of it, in short strokes around the dome
    const k = Math.floor(since * 10) % 2;
    rect(b, x - 11 - k, y - 1, 2, 1, 220);
    rect(b, x + 10 + k, y - 1, 2, 1, 220);
    rect(b, x - 9, y - 5 - k, 1, 2, 220);
    rect(b, x + 9, y - 5 - k, 1, 2, 220);
  }
}

// --- a person at the grille, from the chest up ---
export function drawBust(b, look, { x = 160, y = 112, t = 0, expr = "neutral" } = {}) {
  const s = look.child ? 0.8 : look.big ? 1.1 : 1;
  const bob = Math.sin(t * 1.4) * 0.6;
  const base = y + (look.child ? 8 : 0);
  const hy = base - 58 * s + bob;
  // coat and shoulders
  ellipse(b, x, base - 6 * s, 34 * s, 28 * s, look.coat);
  if (look.hat === "shawl") ellipse(b, x, base - 18 * s, 26 * s, 20 * s, look.coat + 20);
  rect(b, x - 4 * s, hy + 10 * s, 8 * s, 10 * s, look.skin - 30);
  // head
  ellipse(b, x, hy, 11 * s, 13 * s, look.skin);
  if (look.bruised) ellipse(b, x - 5 * s, hy - 1 * s, 3 * s, 3 * s, look.skin - 70);
  // hair
  if (look.hair !== undefined && look.hat !== "bonnet" && look.hat !== "shawl") {
    for (let r = 0; r < 6 * s; r++) rect(b, x - (11 - r * 0.4) * s, hy - 13 * s + r, (22 - r * 0.8) * s, 1, look.hair);
    rect(b, x - 11 * s, hy - 8 * s, 2 * s, 8 * s, look.hair);
    rect(b, x + 9 * s, hy - 8 * s, 2 * s, 8 * s, look.hair);
  }
  if (look.beard) ellipse(b, x, hy + 8 * s, 9 * s, 6 * s, look.hair !== undefined ? look.hair : 50);
  if (look.old) {
    rect(b, x - 7 * s, hy - 6 * s, 5 * s, 1, look.skin - 40);
    rect(b, x + 2 * s, hy - 6 * s, 5 * s, 1, look.skin - 40);
    rect(b, x - 8 * s, hy + 3 * s, 1, 4 * s, look.skin - 40);
    rect(b, x + 7 * s, hy + 3 * s, 1, 4 * s, look.skin - 40);
  }
  // eyes and brows
  const blink = Math.sin(t * 0.7 + x) > 0.985;
  for (const dx of [-5, 5]) {
    rect(b, x + dx * s - 1, hy - 1 * s, 2, blink ? 1 : 2, 18);
    rect(b, x + dx * s - 2, hy - 4 * s, 4, 1, look.hair !== undefined ? Math.min(look.hair, 120) : 40);
    if (look.spectacles) {
      rect(b, x + dx * s - 3, hy - 3 * s, 6, 1, 70);
      rect(b, x + dx * s - 3, hy + 2 * s, 6, 1, 70);
    }
  }
  if (look.mustache) rect(b, x - 4 * s, hy + 5 * s, 8 * s, 1.5, 34);
  // mouth
  const my = Math.round(hy + 8 * s);
  if (expr === "smile") {
    rect(b, x - 3 * s, my, 6 * s, 1, 60);
    rect(b, x - 4 * s, my - 1, 1, 1, 60);
    rect(b, x + 3 * s, my - 1, 1, 1, 60);
  } else if (expr === "sad") {
    rect(b, x - 3 * s, my, 6 * s, 1, 60);
    rect(b, x - 4 * s, my + 1, 1, 1, 60);
    rect(b, x + 3 * s, my + 1, 1, 1, 60);
  } else if (expr === "blank") rect(b, x - 4 * s, my, 8 * s, 1, look.skin - 50);
  else rect(b, x - 2 * s, my, 5 * s, 1, 70);
  // hats
  if (look.hat === "cap") {
    ellipse(b, x, hy - 11 * s, 13 * s, 4 * s, 40);
    rect(b, x - 16 * s, hy - 9 * s, 14 * s, 2, 34);
  } else if (look.hat === "top") {
    rect(b, x - 9 * s, hy - 32 * s, 18 * s, 20 * s, 20);
    rect(b, x - 15 * s, hy - 13 * s, 30 * s, 2, 20);
    rect(b, x - 9 * s, hy - 16 * s, 18 * s, 2, 60);
  } else if (look.hat === "bowler") {
    ellipse(b, x, hy - 14 * s, 11 * s, 8 * s, 24);
    rect(b, x - 15 * s, hy - 10 * s, 30 * s, 2, 24);
  } else if (look.hat === "bonnet") {
    for (let r = -14; r <= 14; r++) {
      const w = Math.round(16 * Math.sqrt(1 - (r * r) / 225));
      rect(b, x - w * s, hy + r * s - 2 * s, 4 * s, 1, 22);
      rect(b, x + (w - 4) * s, hy + r * s - 2 * s, 4 * s, 1, 22);
    }
    ellipse(b, x, hy - 14 * s, 15 * s, 4 * s, 22);
  } else if (look.hat === "shawl") {
    for (let r = -14; r <= 12; r++) {
      const w = Math.round(14 * Math.sqrt(Math.max(0, 1 - (r * r) / 225)));
      rect(b, x - w * s - 2, hy + r * s, 4 * s, 1, look.coat + 20);
      rect(b, x + (w - 2) * s, hy + r * s, 4 * s, 1, look.coat + 20);
    }
    ellipse(b, x, hy - 12 * s, 13 * s, 4 * s, look.coat + 20);
  } else if (look.hat === "feather") {
    ellipse(b, x + 2 * s, hy - 13 * s, 10 * s, 4 * s, 40);
    line(b, x + 8 * s, hy - 15 * s, x + 18 * s, hy - 28 * s, 200);
    line(b, x + 9 * s, hy - 15 * s, x + 19 * s, hy - 27 * s, 170);
  } else if (look.hat === "shako") {
    rect(b, x - 9 * s, hy - 28 * s, 18 * s, 16 * s, 30);
    rect(b, x - 13 * s, hy - 13 * s, 12 * s, 2, 30);
    rect(b, x - 2 * s, hy - 34 * s, 4 * s, 6 * s, 180);
    rect(b, x - 6 * s, hy - 22 * s, 12 * s, 2, 140);
  }
}

// --- the back room: wall, floor, generator, workbench, the ceiling tube ---
export const ROOM = {
  floor: 130,
  chairX: 120,
  head: { x: 138, y: 62 },
  jar: { x: 252, y: 74, w: 32, h: 44 },
  tube: [
    [141, 52],
    [141, 22],
    [268, 22],
    [268, 72],
  ],
  apron: { x: 4, y: 70, w: 22, h: 60 },
};

export function drawRoom(b, t) {
  rect(b, 0, 0, W, ROOM.floor, 30);
  for (let x = 6; x < W; x += 11) rect(b, x, 0, 1, 100, 25);
  rect(b, 0, 100, W, 30, 40);
  for (let x = 0; x < W; x += 16) rect(b, x, 100, 1, 30, 32);
  rect(b, 0, 100, W, 2, 72);
  rect(b, 0, ROOM.floor, W, H - ROOM.floor, 28);
  for (let y = ROOM.floor + 6; y < H; y += 9) rect(b, 0, y, W, 1, 22);
  // a high window, barred
  rect(b, 186, 30, 26, 32, 70);
  rect(b, 189, 33, 20, 26, 104);
  for (let x = 193; x < 209; x += 6) rect(b, x, 33, 1, 26, 60);
  // workbench
  rect(b, 228, 118, 84, 5, 92);
  rect(b, 232, 123, 4, 7, 70);
  rect(b, 304, 123, 4, 7, 70);
  rect(b, 296, 104, 10, 14, 120);
  // the tube: copper from the head, glass along the ceiling
  const p = ROOM.tube;
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[i + 1];
    const v = i === 0 ? 112 : 150;
    if (x0 === x1) {
      rect(b, x0 - 1, Math.min(y0, y1), 3, Math.abs(y1 - y0), v - 40);
      rect(b, x0, Math.min(y0, y1), 1, Math.abs(y1 - y0), v);
    } else {
      rect(b, Math.min(x0, x1), y0 - 1, Math.abs(x1 - x0) + 2, 3, v - 40);
      rect(b, Math.min(x0, x1), y0 - 1, Math.abs(x1 - x0) + 2, 1, v);
    }
  }
  for (const [x, y] of [
    [141, 22],
    [268, 22],
  ])
    rect(b, x - 2, y - 2, 5, 5, 96);
}

// the one lamp hanging over the chair; drawn last so it lights whatever is under it
export function drawRoomLight(b, t, power = 1) {
  rect(b, 149, 0, 1, 10, 60);
  rect(b, 145, 10, 9, 4, 80);
  rect(b, 147, 14, 5, 3, 250);
  const f = power * (1 + Math.sin(t * 11) * 0.03 + (Math.random() < 0.02 ? -0.25 : 0));
  const g = b.createRadialGradient(150, 22, 4, 150, 70, 150);
  g.addColorStop(0, `rgba(255,255,255,${0.36 * f})`);
  g.addColorStop(0.5, `rgba(255,255,255,${0.14 * f})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  b.globalCompositeOperation = "lighter";
  b.fillStyle = g;
  b.fillRect(0, 0, W, H);
  b.globalCompositeOperation = "source-over";
}

// the generator, worked by my hands at the left edge
export function drawGenerator(b, angle) {
  rect(b, 34, 104, 44, 26, 70);
  rect(b, 34, 104, 44, 2, 100);
  rect(b, 38, 108, 36, 2, 52);
  for (let i = 0; i < 3; i++) rect(b, 40 + i * 12, 113, 8, 10, 86);
  // flywheel
  const cx = 56;
  const cy = 92;
  for (let a = 0; a < Math.PI * 2; a += 0.08) rect(b, cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 2, 2, 120);
  for (let k = 0; k < 4; k++) {
    const a = angle + (k * Math.PI) / 2;
    line(b, cx, cy, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, 104);
  }
  rect(b, cx - 2, cy - 2, 4, 4, 140);
  // crank handle and my arm
  const hx = cx + Math.cos(angle) * 13;
  const hy = cy + Math.sin(angle) * 13;
  rect(b, hx - 1, hy - 3, 3, 6, 170);
  const ax = ROOM.apron.x + 18;
  const ay = 84;
  for (let i = 0; i <= 10; i++) {
    const x = ax + ((hx - ax) * i) / 10;
    const y = ay + ((hy - ay) * i) / 10;
    rect(b, x - 2, y - 2, 4, 4, 64);
  }
  rect(b, hx - 2, hy - 2, 5, 4, 150);
  // me: a dark sleeve and the apron, cut off by the edge of the picture
  rect(b, 0, 60, 26, 70, 52);
  rect(b, ROOM.apron.x, ROOM.apron.y, ROOM.apron.w, ROOM.apron.h, 168);
  rect(b, ROOM.apron.x, ROOM.apron.y, ROOM.apron.w, 2, 140);
}

// the chair, seen from the side; the sitter faces left, toward the generator
export function drawChair(b) {
  const x = ROOM.chairX;
  const f = ROOM.floor;
  rect(b, x + 4, f - 22, 34, 4, 74);
  rect(b, x + 6, f - 18, 3, 18, 60);
  rect(b, x + 33, f - 18, 3, 18, 60);
  rect(b, x + 32, 40, 5, f - 62, 66);
  rect(b, x + 31, 38, 7, 3, 90);
  rect(b, x + 6, 90, 28, 3, 78);
  rect(b, x + 7, 93, 3, 15, 64);
  // headrest, electrodes, buckles
  rect(b, x + 26, 48, 6, 20, 58);
}

// the person in the chair. pose: shake (0..1), scream (0..1), back (head thrown back 0..1),
// face: "calm" | "smile" | "scream" | "wail" | "laugh" | "cower" | "embrace" | "blank"
export function drawSitter(b, look, pose, t) {
  const r = Math.random;
  const sx = pose.shake ? (r() - 0.5) * 4 * pose.shake : 0;
  const sy = (pose.shake ? (r() - 0.5) * 3 * pose.shake : 0) + (pose.dy || 0);
  const x = ROOM.chairX;
  const f = ROOM.floor;
  const cower = pose.face === "cower" ? 1 : 0;
  const s = look.child ? 0.85 : 1;
  // legs
  const kneeX = x + 4 + cower * 8;
  const kneeY = f - 24 - cower * 8;
  rect(b, kneeX, kneeY, 26, 7, look.coat - 6);
  rect(b, kneeX, kneeY, 6, f - kneeY - 2, look.coat - 14);
  rect(b, kneeX - 4, f - 3, 10, 3, 24);
  // straps at ankle and wrist
  rect(b, kneeX - 1, f - 14, 8, 3, 110);
  // torso
  const tx = x + 22 + sx;
  const ty = 70 + (look.child ? 8 : 0) + sy + cower * 6;
  const lean = pose.back * 3 - cower * 6 + (pose.face === "laugh" ? Math.sin(t * 18) * 2 : 0);
  for (let i = 0; i < 38; i++) rect(b, tx - 7 + lean * (1 - i / 38), ty + i, 15, 1, look.coat);
  // arm along the armrest, hand clawing at its end
  const claw = pose.scream > 0.3 ? Math.round(r()) : 0;
  const armX = pose.face === "embrace" ? tx - 16 : x + 8;
  rect(b, armX, 86 + sy, tx - armX, 5, look.coat - 10);
  rect(b, armX - 3, 85 + sy + claw, 5, 5, look.skin);
  rect(b, x + 9, 89, 7, 3, 110);
  // head
  const hx = ROOM.head.x - 6 * cower + sx + pose.back * 4 + lean;
  const hy = ROOM.head.y + (look.child ? 8 : 0) + sy - pose.back * 3 + cower * 10 + (pose.face === "laugh" ? Math.abs(Math.sin(t * 9)) * -3 : 0);
  ellipse(b, hx, hy, 10 * s, 11 * s, 22);
  ellipse(b, hx, hy, 9 * s, 10 * s, look.skin);
  rect(b, hx - 1, hy + 9 * s, 5, 6, look.skin - 30);
  if (look.hair !== undefined) {
    ellipse(b, hx + 3, hy - 4, 7 * s, 6 * s, look.hair);
    rect(b, hx + 1, hy - 10 * s, 8, 4, look.hair);
  } else rect(b, hx - 4, hy - 10 * s, 13, 5, 30);
  if (look.beard) ellipse(b, hx - 3, hy + 6, 6, 4, look.hair !== undefined ? look.hair : 50);
  // nose
  rect(b, hx - 10 * s, hy + 1, 2, 2, look.skin - 20);
  // eye
  const eyeOpen = pose.face === "scream" || pose.face === "cower" ? 2 : pose.face === "blank" ? 1 : 1;
  rect(b, hx - 6 * s, hy - 3, 2, eyeOpen, 16);
  // mouth: how far it gapes is the scream
  const gape = Math.round(
    (pose.scream || 0) * 6 + (pose.face === "wail" ? 4 + Math.sin(t * 6) * 2 : 0) + (pose.face === "laugh" ? 3 + Math.abs(Math.sin(t * 16)) * 4 : 0),
  );
  if (gape > 0) {
    // a wail or a laugh stretches the jaw far past where it should stop
    const wide = pose.face === "laugh" || pose.face === "wail" ? 7 : 4;
    rect(b, hx - 9 * s - (wide - 4), hy + 4, wide, gape, 10);
    if (pose.face === "laugh") rect(b, hx - 9 * s - 3, hy + 4, wide - 1, 1, 230);
  }
  else if (pose.face === "smile") {
    rect(b, hx - 9 * s, hy + 5, 4, 1, 50);
    rect(b, hx - 5 * s, hy + 4, 1, 1, 50);
  } else rect(b, hx - 9 * s, hy + 5, 3, 1, 70);
  // forehead strap and the electrode at the temple
  rect(b, hx - 8, hy - 7, 17, 1, 66);
  rect(b, hx + 3, hy - 3, 3, 3, 132);
  return { hx, hy };
}

// --- jars ---
export function drawJar(b, x, y, w, h, { marks = true, target = null } = {}) {
  rect(b, x - 1, y - 5, w + 2, 5, 84);
  rect(b, x - 1, y - 5, w + 2, 1, 130);
  for (let i = 1; i < 4; i++) rect(b, x + (i * w) / 4, y - 4, 1, 3, 60);
  rect(b, x, y, 1, h, 150);
  rect(b, x + w - 1, y, 1, h, 150);
  rect(b, x, y + h - 1, w, 1, 150);
  rect(b, x + 2, y + 3, 1, h - 8, 196);
  if (marks) {
    for (let i = 1; i < 10; i++) rect(b, x + w - 4, y + h - (h * i) / 10, i % 5 === 0 ? 4 : 2, 1, 176);
  }
  if (target !== null) {
    const ty = y + h - (h * target) / 10;
    rect(b, x + w, ty - 2, 3, 5, 230);
    rect(b, x + w + 3, ty - 1, 2, 3, 230);
  }
}

// the gas in a jar: a field of colour that moves the way that emotion moves
export function drawGas(c, x, y, w, h, level, emotion, t, seed = 1) {
  const e = EMOTIONS[emotion];
  if (!e || level <= 0) return;
  const top = y + h - h * level;
  const [R, G, B] = e.color;
  for (let py = Math.floor(top); py < y + h - 1; py++) {
    for (let px = x + 1; px < x + w - 1; px++) {
      const u = (px - x) / w;
      const v = (py - top) / Math.max(1, y + h - top);
      let d;
      switch (e.motion) {
        case "sink":
          d = 0.25 + v * 0.65 + Math.sin(px * 0.6 + t * 0.6 + seed) * 0.08 + Math.sin(py * 0.4 - t * 0.4) * 0.08;
          break;
        case "tremble":
          d = 0.45 + Math.abs(u - 0.5) * 0.7 + (Math.random() - 0.5) * 0.35;
          break;
        case "swirl": {
          const a = Math.atan2(py - (y + h * 0.6), px - (x + w / 2));
          d = 0.5 + Math.sin(a * 3 + t * 4 + seed) * 0.35 + Math.sin(py * 0.3 + t * 3) * 0.1;
          break;
        }
        case "glow": {
          const r2 = Math.hypot(u - 0.5, v - 0.5);
          d = 0.95 - r2 * 1.3 + Math.sin(t * 2 + seed) * 0.08;
          break;
        }
        case "rise":
          d = 0.85 - v * 0.6 + Math.sin(px * 0.8 + py * 0.5 - t * 3) * 0.12;
          break;
        case "coil":
          d = 0.45 + Math.sin(py * 0.7 + Math.sin(px * 0.5 + t) * 2 + t * 0.8) * 0.35;
          break;
        default:
          d = 0.4 + Math.sin(px * 0.3 + seed) * 0.05;
      }
      // a fixed per-pixel threshold keeps the gas grainy instead of smooth
      const th = ((px * 7 + py * 13 + seed * 5) % 17) / 17;
      if (d > th) {
        const k = d > 0.8 ? 1.25 : d > 0.55 ? 1 : 0.75;
        crect(c, px, py, 1, 1, [Math.min(255, R * k), Math.min(255, G * k), Math.min(255, B * k)], 0.9);
      }
    }
  }
}

// a paper label stuck on a jar: paper for mine, browner for the old master's
export function drawLabelPatch(c, x, y, w, h, old) {
  crect(c, x, y, w, h, old ? [152, 127, 96] : [214, 196, 162]);
  for (let ly = y + 2; ly < y + h - 1; ly += 2) crect(c, x + 2, ly, Math.max(1, w - 4 - ((ly * 3) % 4)), 1, [98, 79, 59]);
}

// --- the storeroom: shelves of jars ---
export const SHELF = { cols: 6, rows: 3, x0: 34, dx: 46, y: [26, 78, 130], w: 18, h: 24 };

export function shelfSlot(i) {
  const col = i % SHELF.cols;
  const row = Math.floor(i / SHELF.cols);
  return { x: SHELF.x0 + col * SHELF.dx, y: SHELF.y[row], w: SHELF.w, h: SHELF.h };
}

export function drawCellar(b) {
  rect(b, 0, 0, W, H, 34);
  const R = rng(7);
  for (let y = 0; y < H; y += 10) {
    const off = (y / 10) % 2 ? 0 : 12;
    for (let x = -off; x < W; x += 24) {
      rect(b, x + 1, y + 1, 22, 8, 40 + Math.floor(R() * 10));
    }
  }
  for (const y of SHELF.y) {
    rect(b, 16, y + SHELF.h, W - 32, 5, 86);
    rect(b, 16, y + SHELF.h, W - 32, 1, 120);
    rect(b, 22, y + SHELF.h + 5, 3, 6, 60);
    rect(b, W - 25, y + SHELF.h + 5, 3, 6, 60);
  }
}

export function drawShelfJar(b, c, jar, i, t, hover) {
  const s = shelfSlot(i);
  drawJar(b, s.x, s.y, s.w, s.h, { marks: false });
  drawGas(c, s.x, s.y, s.w, s.h, Math.min(1, jar.amount / 10), jar.emotion, t, i + 3);
  // the label sits in front of the gas, so it goes on the colour layer in the paper's sepia
  drawLabelPatch(c, s.x + 3, s.y + 9, s.w - 6, 7, jar.label.hand === "old");
  if (hover) drawGlow(c, (m) => jarSilhouette(m, s.x, s.y, s.w, s.h), t);
}
