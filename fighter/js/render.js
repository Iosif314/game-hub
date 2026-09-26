import { CHARACTERS, S, INTRO_FRAMES, moveOf } from "./sim.js";

export const W = 960;
export const H = 540;
const GROUND_Y = 470;
const FONT = "'Black Han Sans', 'Segoe UI', sans-serif";

// Limb angles in degrees: 0 = straight down, +90 = pointing toward facing, 180 = straight up.
// Second value of each pair is the lower limb's angle relative to the upper limb.
const P = (lean, hip, fa, ba, fl, bl) => ({ lean, hip, fa, ba, fl, bl });

const BASE = {
  idle: P(4, 92, [55, 95], [35, 110], [12, -8], [-14, 4]),
  walkA: P(6, 91, [50, 95], [30, 110], [28, -18], [-26, -6]),
  walkB: P(6, 91, [58, 95], [40, 110], [-12, -4], [22, -22]),
  crouch: P(12, 58, [60, 100], [40, 115], [78, -125], [22, -100]),
  jump: P(0, 92, [80, 90], [60, 100], [55, -115], [25, -95]),
  block: P(-4, 92, [105, 140], [85, 145], [12, -8], [-14, 4]),
  cblock: P(6, 58, [105, 140], [85, 145], [78, -125], [22, -100]),
  hit: P(-22, 90, [-20, 40], [-40, 30], [20, -10], [-25, 10]),
  win: P(0, 94, [175, 10], [30, 110], [8, -4], [-8, 4]),
  lying: P(0, 16, [150, 20], [120, 40], [0, -10], [10, -20]),
};

const ATTACKS = {
  leon: {
    light: { ex: P(10, 92, [88, 2], [30, 110], [18, -8], [-22, 4]) },
    crouchLight: { ex: P(14, 56, [70, 60], [40, 115], [88, 0], [22, -100]) },
    heavy: { wind: P(-6, 92, [160, 20], [60, 110], [10, -8], [-18, 4]), ex: P(20, 88, [80, -10], [20, 100], [34, -10], [-36, 6]) },
    air: { ex: P(8, 92, [70, 60], [50, 100], [70, 0], [25, -95]) },
    special: { wind: P(-4, 92, [30, 40], [40, 110], [12, -8], [-14, 4]), ex: P(16, 90, [92, -4], [60, 80], [28, -10], [-30, 6]) },
  },
  garon: {
    light: { ex: P(12, 92, [90, 0], [40, 120], [18, -8], [-22, 4]) },
    crouchLight: { ex: P(18, 56, [80, 20], [40, 120], [78, -125], [22, -100]) },
    heavy: { wind: P(-8, 92, [40, 120], [30, 110], [10, -8], [-18, 4]), ex: P(24, 88, [92, 0], [10, 110], [36, -12], [-40, 8]) },
    air: { ex: P(25, 92, [40, 20], [60, 100], [60, -100], [30, -90]) },
    special: { wind: BASE.crouch, ex: P(-8, 96, [172, 4], [40, 110], [20, -40], [-10, 10]) },
  },
};

const LOOK = {
  leon: { skin: "#e8bb90", top: "#3a67c9", bottom: "#22305e", hair: "#1c1c28", accent: "#e3c052", torsoW: 24, limbW: 11, head: 16, bodyLen: 60 },
  garon: { skin: "#c98a5c", top: "#c98a5c", bottom: "#b8322f", hair: "#2a1a12", accent: "#d93b2b", torsoW: 32, limbW: 14, head: 17, bodyLen: 62 },
};

const ARM = [32, 30];
const LEG = [46, 46];

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpPair(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}
function lerpPose(a, b, t) {
  return {
    lean: lerp(a.lean, b.lean, t),
    hip: lerp(a.hip, b.hip, t),
    fa: lerpPair(a.fa, b.fa, t),
    ba: lerpPair(a.ba, b.ba, t),
    fl: lerpPair(a.fl, b.fl, t),
    bl: lerpPair(a.bl, b.bl, t),
  };
}
const ease = (t) => 1 - (1 - t) * (1 - t);

function computePose(p, frame) {
  const mv = moveOf(p);
  switch (p.action) {
    case "walk": {
      const t = (Math.sin(frame * 0.28) + 1) / 2;
      return { pose: lerpPose(BASE.walkA, BASE.walkB, t), rot: 0 };
    }
    case "crouch":
      return { pose: BASE.crouch, rot: 0 };
    case "jump":
    case "land":
      return { pose: p.grounded ? BASE.crouch : BASE.jump, rot: 0 };
    case "blockstun":
      return { pose: p.blockCrouch ? BASE.cblock : BASE.block, rot: 0 };
    case "hitstun":
      return { pose: BASE.hit, rot: 0 };
    case "knockdown":
      return { pose: BASE.jump, rot: -70 };
    case "down":
    case "ko":
      return { pose: BASE.lying, rot: -90 };
    case "getup": {
      const t = 1 - p.stun / 18;
      return { pose: lerpPose(BASE.lying, BASE.crouch, ease(t)), rot: lerp(-90, 0, ease(t)) };
    }
    case "win":
      return { pose: BASE.win, rot: 0 };
    case "attack": {
      const def = ATTACKS[p.char][p.move];
      const base = p.move === "crouchLight" ? BASE.crouch : p.move === "air" ? BASE.jump : BASE.idle;
      const wind = def.wind || base;
      const f = p.moveFrame;
      if (f <= mv.startup) return { pose: lerpPose(base, wind === base ? def.ex : wind, ease(f / Math.max(1, mv.startup)) * (wind === base ? 0.6 : 1)), rot: 0 };
      if (f <= mv.startup + mv.active) return { pose: def.ex, rot: 0 };
      const t = (f - mv.startup - mv.active) / Math.max(1, mv.recovery);
      return { pose: lerpPose(def.ex, base, ease(Math.min(1, t))), rot: 0 };
    }
    default: {
      const pose = { ...BASE.idle, hip: BASE.idle.hip + Math.sin(frame * 0.08) * 1.5 };
      return { pose, rot: 0 };
    }
  }
}

function dir(deg) {
  const r = (deg * Math.PI) / 180;
  return [Math.sin(r), -Math.cos(r)];
}

export function drawFighter(ctx, p, frame, opts = {}) {
  const look = LOOK[p.char];
  const { pose, rot } = computePose(p, frame);
  const sx = opts.x ?? p.x / S;
  const sy = opts.y ?? GROUND_Y - p.y / S;
  const scale = opts.scale ?? 1;
  const facing = p.facing;
  const rr = (rot * Math.PI) / 180;
  const cosR = Math.cos(rr);
  const sinR = Math.sin(rr);
  const hipY = pose.hip;

  // local (x forward, y up, origin at feet) -> screen
  const T = (lx, ly) => {
    const dx = lx;
    const dy = ly - hipY;
    const rx = dx * cosR + dy * sinR;
    const ry = -dx * sinR + dy * cosR + hipY;
    return [sx + rx * facing * scale, sy - ry * scale];
  };

  // all local vectors are y-up; dir() returns y-up unit vectors
  const along = (from, v, len) => [from[0] + v[0] * len, from[1] + v[1] * len];
  const hip = [0, hipY];
  const leanV = dir(180 - pose.lean);
  const neck = along(hip, leanV, look.bodyLen);
  const headC = along(neck, leanV, look.head + 4);
  const shoulder = along(neck, leanV, -6);

  const chain = (origin, angles, lens) => {
    const j = along(origin, dir(angles[0]), lens[0]);
    const e = along(j, dir(angles[0] + angles[1]), lens[1]);
    return { j, e, endAngle: angles[0] + angles[1] };
  };

  const fArm = chain(shoulder, pose.fa, ARM);
  const bArm = chain(shoulder, pose.ba, ARM);
  const fLeg = chain(hip, pose.fl, LEG);
  const bLeg = chain(hip, pose.bl, LEG);

  const line = (pts, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const [x0, y0] = T(...pts[0]);
    ctx.moveTo(x0, y0);
    for (let k = 1; k < pts.length; k++) {
      const [x, y] = T(...pts[k]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  const dot = (pt, r, color) => {
    const [x, y] = T(...pt);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * scale, 0, Math.PI * 2);
    ctx.fill();
  };

  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * amt)));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  };

  // back limbs (darker)
  line([shoulder, bArm.j, bArm.e], look.limbW, shade(p.char === "leon" ? look.top : look.skin, 0.7));
  if (p.char === "garon") dot(bArm.e, 9, shade(look.accent, 0.7));
  line([hip, bLeg.j, bLeg.e], look.limbW + 2, shade(look.bottom, 0.7));

  // torso
  line([hip, neck], look.torsoW, look.top);
  if (p.char === "leon") {
    line([[hip[0] - 1, hip[1] + 4], [hip[0] + 1, hip[1] + 6]], look.torsoW + 2, look.accent);
  } else {
    line([hip, along(hip, leanV, 14)], look.torsoW + 2, look.bottom);
  }

  // head
  dot(headC, look.head, look.skin);
  dot(along(headC, leanV, 5), look.head - 3, look.hair);
  if (p.char === "leon") {
    const band = along(headC, leanV, 2);
    line([[band[0] - 12, band[1]], [band[0] + 12, band[1]]], 4, "#d24a4a");
  }

  // front leg
  line([hip, fLeg.j, fLeg.e], look.limbW + 2, look.bottom);

  // front arm + weapon
  line([shoulder, fArm.j, fArm.e], look.limbW, p.char === "leon" ? look.top : look.skin);
  if (p.char === "leon") {
    const sd = dir(fArm.endAngle + 8);
    line([fArm.e, along(fArm.e, sd, 64)], 4, "#d8e2f0");
    line([fArm.e, along(fArm.e, sd, -8)], 6, "#5a4630");
    dot(fArm.e, 6, look.skin);
  } else {
    dot(fArm.e, 10, look.accent);
  }
}

function drawStage(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#1a1530");
  sky.addColorStop(0.55, "#4a2a4a");
  sky.addColorStop(1, "#c0603f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  ctx.fillStyle = "rgba(255, 210, 140, 0.9)";
  ctx.beginPath();
  ctx.arc(700, 330, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2a1a2e";
  ctx.beginPath();
  ctx.moveTo(0, 380);
  const peaks = [[80, 320], [170, 360], [260, 300], [360, 350], [460, 310], [560, 355], [650, 320], [760, 360], [860, 305], [960, 345]];
  for (const [x, y] of peaks) ctx.lineTo(x, y);
  ctx.lineTo(W, GROUND_Y);
  ctx.lineTo(0, GROUND_Y);
  ctx.fill();

  ctx.fillStyle = "#1b1220";
  for (let x = 20; x < W; x += 120) {
    ctx.fillRect(x, 400, 14, 70);
    ctx.fillRect(x - 10, 396, 34, 8);
  }

  const floor = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  floor.addColorStop(0, "#5a3a2a");
  floor.addColorStop(1, "#2a1a14");
  ctx.fillStyle = floor;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.strokeStyle = "rgba(255, 200, 150, 0.12)";
  ctx.lineWidth = 1;
  for (let k = -8; k <= 8; k++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + k * 60, GROUND_Y);
    ctx.lineTo(W / 2 + k * 160, H);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 220, 170, 0.35)";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();
}

function drawShadow(ctx, p) {
  const x = p.x / S;
  const h = p.y / S;
  const w = Math.max(18, 42 - h * 0.12);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 2, w, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawProjectile(ctx, pr, frame) {
  const x = pr.x / S;
  const y = GROUND_Y - pr.y / S;
  const d = Math.sign(pr.vx);
  for (let k = 4; k >= 0; k--) {
    ctx.fillStyle = `rgba(120, 220, 255, ${0.12 + (4 - k) * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(x - d * k * 12, y, 30 - k * 3, 20 - k * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x, y, 2, x, y, 24);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.5, "#8fe4ff");
  g.addColorStop(1, "rgba(60,160,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, 26 + Math.sin(frame * 0.6) * 2, 18, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawEffect(ctx, e) {
  const x = e.x / S;
  const y = GROUND_Y - e.y / S;
  const t = e.t / 24;
  if (e.type === "block") {
    ctx.strokeStyle = `rgba(140, 200, 255, ${1 - t})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 10 + t * 34, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const big = e.type === "hitBig" || e.type === "clash";
  const color = e.type === "clash" ? "180, 230, 255" : "255, 220, 120";
  ctx.strokeStyle = `rgba(${color}, ${1 - t})`;
  ctx.lineWidth = big ? 5 : 3;
  const rays = big ? 12 : 8;
  const r0 = 6 + t * 18;
  const r1 = (big ? 40 : 26) + t * 26;
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2 + e.id;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * (1 - t)})`;
  ctx.beginPath();
  ctx.arc(x, y, (big ? 16 : 10) * (1 - t), 0, Math.PI * 2);
  ctx.fill();
}

function drawBar(ctx, x, y, w, h, ratio, trailRatio, flip) {
  ctx.fillStyle = "#1a1a24";
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = "#3a1414";
  ctx.fillRect(x, y, w, h);
  const tw = w * trailRatio;
  const fw = w * ratio;
  ctx.fillStyle = "#e0463a";
  ctx.fillRect(flip ? x + w - tw : x, y, tw, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#ffe27a");
  g.addColorStop(1, "#f2a93b");
  ctx.fillStyle = g;
  ctx.fillRect(flip ? x + w - fw : x, y, fw, h);
}

function outlinedText(ctx, text, x, y, size, fill, align = "center") {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(3, size / 8);
  ctx.strokeStyle = "rgba(10, 8, 20, 0.9)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const trail = [1, 1];

  function drawHud(state, hud) {
    const barW = 380;
    for (let i = 0; i < 2; i++) {
      const p = state.players[i];
      const ch = CHARACTERS[p.char];
      const ratio = p.hp / ch.maxHp;
      if (ratio > trail[i]) trail[i] = ratio;
      else trail[i] = Math.max(ratio, trail[i] - 0.006);
      const x = i === 0 ? 40 : W - 40 - barW;
      drawBar(ctx, x, 26, barW, 22, ratio, trail[i], i === 1);
      const label = `${ch.name}${hud.labels?.[i] ? ` · ${hud.labels[i]}` : ""}`;
      outlinedText(ctx, label, i === 0 ? x : x + barW, 66, 20, "#f4efe6", i === 0 ? "left" : "right");
      for (let k = 0; k < 2; k++) {
        const px = i === 0 ? x + barW - 12 - k * 22 : x + 12 + k * 22;
        ctx.fillStyle = state.wins[i] > k ? "#f2c14e" : "rgba(255,255,255,0.15)";
        ctx.strokeStyle = "#1a1a24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, 66, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (p.comboTimer > 0 && p.comboShown >= 2) {
        const a = Math.min(1, p.comboTimer / 20);
        ctx.globalAlpha = a;
        outlinedText(ctx, `${p.comboShown} HITS`, i === 0 ? 60 : W - 60, 150, 34, "#ffd84a", i === 0 ? "left" : "right");
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = "#1a1a24";
    ctx.fillRect(W / 2 - 34, 14, 68, 50);
    outlinedText(ctx, String(Math.ceil(state.timer / 60)), W / 2, 40, 34, "#ffffff");
    if (hud.ping != null) outlinedText(ctx, `${hud.ping}ms`, W / 2, 80, 14, "rgba(255,255,255,0.7)");
    if (hud.waiting) outlinedText(ctx, "상대 응답 대기 중...", W / 2, 120, 22, "#9fd3ff");
  }

  function drawAnnouncement(state) {
    const names = state.players.map((p) => CHARACTERS[p.char].name);
    if (state.phase === "intro") {
      if (state.phaseTimer < 70) outlinedText(ctx, `ROUND ${state.round}`, W / 2, 230, 72, "#f4efe6");
      else if (state.phaseTimer < INTRO_FRAMES) outlinedText(ctx, "FIGHT!", W / 2, 230, 96, "#ffd84a");
    } else if (state.phase === "ko" || state.phase === "timeup") {
      if (state.phaseTimer < 80) outlinedText(ctx, state.phase === "ko" ? "K.O." : "TIME UP", W / 2, 230, 104, "#ff5a4a");
      else outlinedText(ctx, state.roundWinner === -1 ? "무승부" : `${names[state.roundWinner]} 승리`, W / 2, 230, 64, "#f4efe6");
    }
  }

  function render(state, hud = {}) {
    ctx.save();
    if (state && state.hitstop > 0 && state.hitBig) {
      ctx.translate(((state.frame * 7) % 5) - 2, ((state.frame * 3) % 5) - 2);
    }
    drawStage(ctx);
    if (!state) {
      ctx.restore();
      return;
    }
    for (const p of state.players) drawShadow(ctx, p);
    const order = state.players[0].action === "attack" ? [1, 0] : [0, 1];
    for (const i of order) drawFighter(ctx, state.players[i], state.frame);
    for (const pr of state.projectiles) drawProjectile(ctx, pr, state.frame);
    for (const e of state.effects) drawEffect(ctx, e);
    ctx.restore();
    drawHud(state, hud);
    drawAnnouncement(state);
    if (state.phase === "matchOver") {
      ctx.fillStyle = "rgba(8, 6, 16, 0.45)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  return { render };
}

export function drawPortrait(canvas, char) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const p = { char, x: 0, y: 0, facing: 1, action: "idle", grounded: true };
  drawFighter(ctx, p, 0, { x: canvas.width / 2, y: canvas.height - 8, scale: (canvas.height - 16) / 210 });
}
