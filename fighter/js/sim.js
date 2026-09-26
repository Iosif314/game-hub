// Deterministic fight simulation. Integer math only: online play re-simulates
// frames on both machines and they must produce bit-identical states.

export const FPS = 60;
export const S = 100; // sim units per pixel
export const STAGE_W = 960 * S;
export const WALL = 45 * S;
export const GRAVITY = 95;
export const ROUND_TIME = 60 * FPS;
export const WINS_TO_WIN = 2;
export const INTRO_FRAMES = 110;
export const END_FRAMES = 170;
const DOWN_FRAMES = 34;
const GETUP_FRAMES = 18;

export const IN = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, C: 64 };

// reach/y are in pixels relative to the fighter's feet (facing right); speeds are sim units/frame.
export const CHARACTERS = {
  leon: {
    name: "레온",
    title: "검객",
    desc: "균형형. 검기(파동검)를 날려 거리를 지배한다.",
    specialName: "파동검",
    maxHp: 1000,
    walkF: 460,
    walkB: 340,
    jumpVy: 1900,
    jumpVx: 480,
    width: 58,
    height: 180,
    crouchHeight: 115,
    moves: {
      light: { startup: 4, active: 3, recovery: 9, damage: 45, hitstun: 17, blockstun: 11, push: 520, reach: [18, 88], y: [95, 152], level: "mid", chain: ["heavy", "special"] },
      crouchLight: { startup: 5, active: 3, recovery: 11, damage: 38, hitstun: 16, blockstun: 10, push: 460, reach: [15, 98], y: [4, 40], level: "low", chain: ["heavy", "special"], crouch: true },
      heavy: { startup: 9, active: 4, recovery: 19, damage: 95, hitstun: 23, blockstun: 16, push: 820, reach: [25, 128], y: [60, 165], level: "mid", chain: ["special"], lunge: 240 },
      air: { startup: 5, active: 9, recovery: 5, damage: 70, hitstun: 19, blockstun: 13, push: 420, reach: [8, 86], y: [20, 95], level: "high", chain: [] },
      special: { startup: 13, active: 1, recovery: 27, damage: 72, hitstun: 22, blockstun: 16, push: 560, level: "mid", chain: [], projectile: { speed: 780, w: 56, h: 44, y: 112 } },
    },
  },
  garon: {
    name: "가론",
    title: "권투가",
    desc: "파워형. 무적 승룡권으로 점프를 격추한다.",
    specialName: "승룡권",
    maxHp: 1100,
    walkF: 370,
    walkB: 290,
    jumpVy: 1850,
    jumpVx: 430,
    width: 70,
    height: 186,
    crouchHeight: 120,
    moves: {
      light: { startup: 4, active: 3, recovery: 10, damage: 52, hitstun: 17, blockstun: 11, push: 520, reach: [18, 78], y: [100, 158], level: "mid", chain: ["heavy", "special"] },
      crouchLight: { startup: 5, active: 3, recovery: 12, damage: 44, hitstun: 16, blockstun: 10, push: 460, reach: [15, 90], y: [4, 40], level: "low", chain: ["heavy", "special"], crouch: true },
      heavy: { startup: 11, active: 4, recovery: 21, damage: 125, hitstun: 25, blockstun: 17, push: 900, reach: [25, 115], y: [70, 165], level: "mid", chain: ["special"], lunge: 300 },
      air: { startup: 6, active: 9, recovery: 6, damage: 82, hitstun: 20, blockstun: 14, push: 440, reach: [5, 80], y: [15, 90], level: "high", chain: [] },
      special: { startup: 3, active: 12, recovery: 32, damage: 118, hitstun: 0, blockstun: 18, push: 300, reach: [8, 82], y: [50, 240], level: "mid", chain: [], knockdown: true, launch: 1750, invuln: [1, 10], rise: 1650, forward: 260 },
    },
  },
};

function makePlayer(char, idx) {
  const ch = CHARACTERS[char];
  return {
    char,
    x: (idx === 0 ? 300 : 660) * S,
    y: 0,
    vx: 0,
    vy: 0,
    facing: idx === 0 ? 1 : -1,
    grounded: true,
    hp: ch.maxHp,
    action: "idle",
    move: null,
    moveFrame: 0,
    moveHit: false,
    stun: 0,
    prevInput: 0,
    holdingBack: false,
    holdingDown: false,
    blockCrouch: false,
    airAttackUsed: false,
    comboHits: 0,
    comboShown: 0,
    comboTimer: 0,
  };
}

export function createMatch(p1Char, p2Char) {
  return {
    frame: 0,
    phase: "intro",
    phaseTimer: 0,
    round: 1,
    timer: ROUND_TIME,
    wins: [0, 0],
    roundWinner: null,
    winner: null,
    hitstop: 0,
    hitBig: false,
    nextId: 1,
    projectiles: [],
    effects: [],
    players: [makePlayer(p1Char, 0), makePlayer(p2Char, 1)],
  };
}

function resetRound(state) {
  state.players = [makePlayer(state.players[0].char, 0), makePlayer(state.players[1].char, 1)];
  state.projectiles = [];
  state.effects = [];
  state.timer = ROUND_TIME;
  state.phase = "intro";
  state.phaseTimer = 0;
  state.roundWinner = null;
  state.hitstop = 0;
}

export function moveOf(p) {
  return p.move ? CHARACTERS[p.char].moves[p.move] : null;
}

export function hurtbox(p) {
  const ch = CHARACTERS[p.char];
  let h = ch.height;
  const mv = moveOf(p);
  if (p.action === "crouch" || (p.action === "blockstun" && p.blockCrouch) || (p.action === "attack" && mv && mv.crouch)) {
    h = ch.crouchHeight;
  }
  if (!p.grounded) h = Math.trunc((ch.height * 85) / 100);
  const hw = (ch.width * S) / 2;
  return { x1: p.x - hw, x2: p.x + hw, y1: p.y, y2: p.y + h * S };
}

export function hitbox(p, mv) {
  const [r0, r1] = mv.reach;
  return {
    x1: p.facing === 1 ? p.x + r0 * S : p.x - r1 * S,
    x2: p.facing === 1 ? p.x + r1 * S : p.x - r0 * S,
    y1: p.y + mv.y[0] * S,
    y2: p.y + mv.y[1] * S,
  };
}

function projBox(pr) {
  return { x1: pr.x - (pr.w * S) / 2, x2: pr.x + (pr.w * S) / 2, y1: pr.y - (pr.h * S) / 2, y2: pr.y + (pr.h * S) / 2 };
}

function overlaps(a, b) {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

function invulnerable(p) {
  if (p.action === "knockdown" || p.action === "down" || p.action === "getup" || p.action === "ko") return true;
  const mv = moveOf(p);
  return p.action === "attack" && mv && mv.invuln && p.moveFrame >= mv.invuln[0] && p.moveFrame <= mv.invuln[1];
}

export function canSpecial(state, i) {
  const p = state.players[i];
  if (!CHARACTERS[p.char].moves.special.projectile) return true;
  return !state.projectiles.some((pr) => pr.owner === i);
}

function startMove(state, i, id) {
  const p = state.players[i];
  const mv = CHARACTERS[p.char].moves[id];
  p.action = "attack";
  p.move = id;
  p.moveFrame = 0;
  p.moveHit = false;
  if (p.grounded) p.vx = mv.lunge ? p.facing * mv.lunge : 0;
}

function onActiveStart(state, i, mv) {
  const p = state.players[i];
  if (mv.projectile) {
    state.projectiles.push({
      id: state.nextId++,
      owner: i,
      char: p.char,
      x: p.x + p.facing * 60 * S,
      y: mv.projectile.y * S,
      vx: p.facing * mv.projectile.speed,
      w: mv.projectile.w,
      h: mv.projectile.h,
      life: 0,
    });
  }
  if (mv.rise) {
    p.grounded = false;
    p.vy = mv.rise;
    p.vx = p.facing * mv.forward;
  }
}

function updatePlayer(state, i, input) {
  const p = state.players[i];
  const ch = CHARACTERS[p.char];
  const pressed = input & ~p.prevInput;
  p.prevInput = input;
  const fwd = p.facing === 1 ? IN.RIGHT : IN.LEFT;
  const back = p.facing === 1 ? IN.LEFT : IN.RIGHT;
  p.holdingBack = (input & back) !== 0 && (input & fwd) === 0;
  p.holdingDown = (input & IN.DOWN) !== 0;
  if (p.comboTimer > 0) p.comboTimer--;

  switch (p.action) {
    case "hitstun":
    case "blockstun":
      p.stun--;
      p.vx = Math.trunc((p.vx * 4) / 5);
      if (p.stun <= 0) {
        p.action = p.grounded ? "idle" : "jump";
        p.comboHits = 0;
      }
      return;
    case "land":
      p.stun--;
      p.vx = 0;
      if (p.stun <= 0) p.action = "idle";
      return;
    case "knockdown":
      return;
    case "down":
      p.stun--;
      if (p.stun <= 0) {
        if (p.hp <= 0) {
          p.action = "ko";
        } else {
          p.action = "getup";
          p.stun = GETUP_FRAMES;
        }
      }
      return;
    case "getup":
      p.stun--;
      if (p.stun <= 0) {
        p.action = "idle";
        p.comboHits = 0;
      }
      return;
    case "ko":
    case "win":
      p.vx = 0;
      return;
    case "attack": {
      const mv = CHARACTERS[p.char].moves[p.move];
      p.moveFrame++;
      if (p.moveHit && p.grounded && mv.chain.length && p.moveFrame <= mv.startup + mv.active + 10) {
        const want = pressed & IN.C ? "special" : pressed & IN.B ? "heavy" : null;
        if (want && mv.chain.includes(want) && (want !== "special" || canSpecial(state, i))) {
          startMove(state, i, want);
          return;
        }
      }
      if (p.moveFrame === mv.startup + 1) onActiveStart(state, i, mv);
      if (p.grounded && p.moveFrame > mv.startup) p.vx = Math.trunc((p.vx * 3) / 4);
      if (p.moveFrame >= mv.startup + mv.active + mv.recovery) {
        p.move = null;
        p.action = p.grounded ? (p.holdingDown ? "crouch" : "idle") : "jump";
        if (!p.grounded) p.airAttackUsed = true;
      }
      return;
    }
    case "jump":
      if (pressed & (IN.A | IN.B) && !p.airAttackUsed) {
        p.airAttackUsed = true;
        startMove(state, i, "air");
      }
      return;
    default:
      break;
  }

  // idle / walk / crouch: grounded and free to act
  if (pressed & IN.C && canSpecial(state, i)) return startMove(state, i, "special");
  if (pressed & IN.B) return startMove(state, i, "heavy");
  if (pressed & IN.A) return startMove(state, i, p.holdingDown ? "crouchLight" : "light");
  if (p.holdingDown) {
    p.action = "crouch";
    p.vx = 0;
    return;
  }
  if (input & IN.UP) {
    p.action = "jump";
    p.grounded = false;
    p.vy = ch.jumpVy;
    const dir = input & fwd && !(input & back) ? 1 : p.holdingBack ? -1 : 0;
    p.vx = dir * p.facing * ch.jumpVx;
    p.airAttackUsed = false;
    return;
  }
  if (input & fwd && !(input & back)) {
    p.action = "walk";
    p.vx = p.facing * ch.walkF;
  } else if (p.holdingBack) {
    p.action = "walk";
    p.vx = -p.facing * ch.walkB;
  } else {
    p.action = "idle";
    p.vx = 0;
  }
}

function land(p) {
  if (p.action === "jump") {
    p.action = "idle";
    p.vx = 0;
  } else if (p.action === "attack") {
    const lag = p.move === "air" ? 3 : 14;
    p.move = null;
    p.action = "land";
    p.stun = lag;
    p.vx = 0;
  } else if (p.action === "knockdown") {
    p.action = "down";
    p.stun = p.hp <= 0 ? 999999 : DOWN_FRAMES;
    p.vx = 0;
  } else if (p.action === "hitstun" || p.action === "blockstun") {
    // stays in stun, just grounded now
  } else {
    p.action = "idle";
    p.vx = 0;
  }
}

function physics(p) {
  p.x += p.vx;
  if (!p.grounded) {
    p.y += p.vy;
    p.vy -= GRAVITY;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
      land(p);
    }
  }
  if (p.x < WALL) p.x = WALL;
  if (p.x > STAGE_W - WALL) p.x = STAGE_W - WALL;
}

function separate(state) {
  const [a, b] = state.players;
  const skip = (p) => p.action === "down" || p.action === "ko" || p.action === "knockdown";
  if (skip(a) || skip(b)) return;
  if (Math.abs(a.y - b.y) >= 120 * S) return;
  const minD = ((CHARACTERS[a.char].width + CHARACTERS[b.char].width) * S) / 2;
  const dx = b.x - a.x;
  const dist = Math.abs(dx);
  if (dist >= minD) return;
  const dir = dx !== 0 ? Math.sign(dx) : a.facing;
  const overlap = minD - dist;
  const pa = Math.trunc(overlap / 2);
  const pb = overlap - pa;
  a.x -= dir * pa;
  b.x += dir * pb;
  const lo = WALL;
  const hi = STAGE_W - WALL;
  for (const [p, q] of [
    [a, b],
    [b, a],
  ]) {
    if (p.x < lo) {
      q.x += lo - p.x;
      p.x = lo;
    } else if (p.x > hi) {
      q.x -= p.x - hi;
      p.x = hi;
    }
  }
  a.x = Math.min(hi, Math.max(lo, a.x));
  b.x = Math.min(hi, Math.max(lo, b.x));
}

function updateFacing(state, i) {
  const p = state.players[i];
  if (p.action !== "idle" && p.action !== "walk" && p.action !== "crouch" && p.action !== "land") return;
  const dx = state.players[1 - i].x - p.x;
  if (dx > 0) p.facing = 1;
  else if (dx < 0) p.facing = -1;
}

function updateProjectiles(state) {
  for (const pr of state.projectiles) {
    pr.x += pr.vx;
    pr.life++;
  }
  const dead = new Set();
  for (let a = 0; a < state.projectiles.length; a++) {
    for (let b = a + 1; b < state.projectiles.length; b++) {
      const pa = state.projectiles[a];
      const pb = state.projectiles[b];
      if (pa.owner !== pb.owner && overlaps(projBox(pa), projBox(pb))) {
        dead.add(pa.id);
        dead.add(pb.id);
        state.effects.push({ id: state.nextId++, type: "clash", x: Math.trunc((pa.x + pb.x) / 2), y: pa.y, t: 0 });
      }
    }
  }
  state.projectiles = state.projectiles.filter((pr) => !dead.has(pr.id) && pr.x > -100 * S && pr.x < STAGE_W + 100 * S);
}

function canBlock(t, level) {
  if (!t.grounded) return false;
  if (t.action !== "idle" && t.action !== "walk" && t.action !== "crouch" && t.action !== "blockstun") return false;
  if (!t.holdingBack) return false;
  if (level === "low" && !t.holdingDown) return false;
  if (level === "high" && t.holdingDown) return false;
  return true;
}

function applyHit(state, h) {
  const a = state.players[h.attacker];
  const t = state.players[1 - h.attacker];
  const hurt = hurtbox(t);
  const cx = Math.trunc((Math.max(h.box.x1, hurt.x1) + Math.min(h.box.x2, hurt.x2)) / 2);
  const cy = Math.trunc((Math.max(h.box.y1, hurt.y1) + Math.min(h.box.y2, hurt.y2)) / 2);
  const dir = h.projectile ? Math.sign(h.projectile.vx) : a.facing;
  if (!h.projectile) a.moveHit = true;

  if (canBlock(t, h.mv.level)) {
    t.action = "blockstun";
    t.stun = h.mv.blockstun;
    t.blockCrouch = t.holdingDown;
    t.move = null;
    t.vx = dir * h.mv.push;
    state.effects.push({ id: state.nextId++, type: "block", x: cx, y: cy, t: 0 });
    state.hitstop = 6;
    state.hitBig = false;
    return;
  }

  const combo = t.action === "hitstun" || t.action === "knockdown" ? t.comboHits + 1 : 1;
  const scale = Math.max(40, 100 - 15 * (combo - 1));
  const dmg = Math.max(1, Math.trunc((h.mv.damage * scale) / 100));
  t.hp = Math.max(0, t.hp - dmg);
  t.comboHits = combo;
  t.move = null;
  a.comboShown = combo;
  a.comboTimer = 70;

  if (h.mv.knockdown || !t.grounded || t.hp <= 0) {
    t.action = "knockdown";
    t.grounded = false;
    t.vy = h.mv.launch || 1150;
    t.vx = dir * 650;
  } else {
    t.action = "hitstun";
    t.stun = h.mv.hitstun;
    t.vx = dir * h.mv.push;
  }
  const big = dmg >= 90 || t.hp <= 0;
  state.effects.push({ id: state.nextId++, type: big ? "hitBig" : "hit", x: cx, y: cy, t: 0 });
  state.hitstop = big ? 12 : 8;
  state.hitBig = big;
}

function resolveHits(state) {
  const hits = [];
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    const o = state.players[1 - i];
    const mv = moveOf(p);
    if (p.action !== "attack" || p.moveHit || !mv || mv.projectile) continue;
    if (p.moveFrame <= mv.startup || p.moveFrame > mv.startup + mv.active) continue;
    const box = hitbox(p, mv);
    if (!invulnerable(o) && overlaps(box, hurtbox(o))) hits.push({ attacker: i, mv, box });
  }
  const spent = new Set();
  for (const pr of state.projectiles) {
    const o = state.players[1 - pr.owner];
    const box = projBox(pr);
    if (!invulnerable(o) && overlaps(box, hurtbox(o))) {
      hits.push({ attacker: pr.owner, mv: CHARACTERS[pr.char].moves.special, box, projectile: pr });
      spent.add(pr.id);
    }
  }
  for (const h of hits) applyHit(state, h);
  if (spent.size) state.projectiles = state.projectiles.filter((pr) => !spent.has(pr.id));
}

function endRound(state, winner, kind) {
  state.phase = kind;
  state.phaseTimer = 0;
  state.roundWinner = winner;
  if (winner === -1) {
    state.wins[0]++;
    state.wins[1]++;
  } else {
    state.wins[winner]++;
  }
}

function updatePhase(state) {
  state.phaseTimer++;
  const [a, b] = state.players;
  switch (state.phase) {
    case "intro":
      if (state.phaseTimer >= INTRO_FRAMES) {
        state.phase = "fight";
        state.phaseTimer = 0;
      }
      break;
    case "fight":
      if (a.hp <= 0 || b.hp <= 0) {
        endRound(state, a.hp <= 0 && b.hp <= 0 ? -1 : a.hp <= 0 ? 1 : 0, "ko");
      } else {
        state.timer--;
        if (state.timer <= 0) {
          state.timer = 0;
          const ra = a.hp * CHARACTERS[b.char].maxHp;
          const rb = b.hp * CHARACTERS[a.char].maxHp;
          endRound(state, ra === rb ? -1 : ra > rb ? 0 : 1, "timeup");
        }
      }
      break;
    case "ko":
    case "timeup": {
      if (state.roundWinner >= 0 && state.phaseTimer > 45) {
        const w = state.players[state.roundWinner];
        if (w.grounded && (w.action === "idle" || w.action === "walk" || w.action === "crouch")) w.action = "win";
      }
      if (state.phaseTimer >= END_FRAMES) {
        const [wa, wb] = state.wins;
        if (wa >= WINS_TO_WIN || wb >= WINS_TO_WIN) {
          state.phase = "matchOver";
          state.phaseTimer = 0;
          state.winner = wa >= WINS_TO_WIN && wb >= WINS_TO_WIN ? -1 : wa >= WINS_TO_WIN ? 0 : 1;
        } else {
          state.round++;
          resetRound(state);
        }
      }
      break;
    }
    default:
      break;
  }
}

export function step(state, inputs) {
  state.frame++;
  if (state.hitstop > 0) {
    state.hitstop--;
    return;
  }
  const fighting = state.phase === "fight";
  for (let i = 0; i < 2; i++) updatePlayer(state, i, fighting ? inputs[i] : 0);
  for (const p of state.players) physics(p);
  separate(state);
  for (let i = 0; i < 2; i++) updateFacing(state, i);
  updateProjectiles(state);
  if (fighting) resolveHits(state);
  for (const e of state.effects) e.t++;
  state.effects = state.effects.filter((e) => e.t < 24);
  updatePhase(state);
}
