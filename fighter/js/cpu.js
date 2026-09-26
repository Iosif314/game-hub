import { CHARACTERS, IN, S, canSpecial } from "./sim.js";

// react: how many frames stale the CPU's view of the opponent is (human-like reaction time)
// hesitate: chance to stand around doing nothing when picking the next neutral action
const LEVELS = {
  easy: { react: 30, block: 0.1, antiAir: 0.1, combo: 0.05, aggro: 0.3, jump: 0.05, fireball: 0.2, hesitate: 0.35 },
  normal: { react: 14, block: 0.55, antiAir: 0.45, combo: 0.6, aggro: 0.5, jump: 0.06, fireball: 0.45, hesitate: 0.1 },
  hard: { react: 7, block: 0.85, antiAir: 0.8, combo: 0.95, aggro: 0.62, jump: 0.07, fireball: 0.6, hesitate: 0.02 },
};

const BUTTONS = IN.A | IN.B | IN.C;

export function createCpu(level, index, seed = Date.now()) {
  const cfg = LEVELS[level];
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const seen = [];
  let plan = null;
  let lastOut = 0;
  let threatKey = null;
  let threatBlock = false;
  let jumpOver = false;
  let aaRolled = false;
  let aaGo = false;
  let comboKey = null;
  let comboNext = null;

  function pickChain(me) {
    const mv = CHARACTERS[me.char].moves[me.move];
    const options = mv.chain.filter((m) => m !== "special" || canSpecial(stateRef, index));
    if (!options.length) return null;
    if (options.includes("heavy") && (options.length === 1 || rand() < 0.6)) return "heavy";
    return options.includes("special") ? "special" : options[0];
  }

  let stateRef = null;

  function decide(state, me, op, per) {
    if (state.phase !== "fight") {
      plan = null;
      return 0;
    }
    const ch = CHARACTERS[me.char];
    const fwd = me.facing === 1 ? IN.RIGHT : IN.LEFT;
    const back = me.facing === 1 ? IN.LEFT : IN.RIGHT;
    const dist = Math.abs(op.x - me.x) / S;
    const perDist = Math.abs(per.x - me.x) / S;

    if (me.action === "blockstun") return back | (me.blockCrouch ? IN.DOWN : 0);
    if (me.action !== "idle" && me.action !== "walk" && me.action !== "crouch" && me.action !== "attack" && me.action !== "jump") {
      plan = null;
      return 0;
    }

    if (me.action === "attack") {
      const key = `${me.move}@${state.frame - me.moveFrame}`;
      if (me.moveHit && comboKey !== key) {
        comboKey = key;
        comboNext = rand() < cfg.combo ? pickChain(me) : null;
      }
      if (comboKey === key && comboNext) {
        const b = comboNext === "heavy" ? IN.B : IN.C;
        comboNext = null;
        return b;
      }
      return 0;
    }

    if (me.action === "jump") {
      if (!me.airAttackUsed && perDist < 120 && me.vy < 0 && rand() < 0.3) return IN.B;
      return 0;
    }

    // react to a perceived incoming attack
    if (per.action === "attack" && per.move) {
      const omv = CHARACTERS[op.char].moves[per.move];
      const reach = omv.reach ? omv.reach[1] : 0;
      if (!omv.projectile && perDist <= reach + ch.width / 2 + 40 && per.moveFrame <= omv.startup + omv.active) {
        const key = `${per.move}@${per.startFrame}`;
        if (threatKey !== key) {
          threatKey = key;
          threatBlock = rand() < cfg.block;
        }
        if (threatBlock) {
          plan = null;
          return back | (omv.level === "low" ? IN.DOWN : 0);
        }
      }
    }

    // incoming projectile
    const proj = state.projectiles.find((pr) => pr.owner !== index && Math.sign(pr.vx) === Math.sign(me.x - pr.x));
    if (proj) {
      const pd = Math.abs(proj.x - me.x) / S;
      if (pd < 260) {
        const key = `p${proj.id}`;
        if (threatKey !== key) {
          threatKey = key;
          threatBlock = rand() < cfg.block;
          jumpOver = rand() < cfg.block * 0.5;
        }
        if (jumpOver && pd < 210 && pd > 110) {
          plan = null;
          return IN.UP | fwd;
        }
        if (threatBlock) return back;
      }
    }

    // anti-air: roll once per opponent jump
    if (per.grounded) {
      aaRolled = false;
    } else if (!aaRolled && perDist < 190) {
      aaRolled = true;
      aaGo = rand() < cfg.antiAir;
    }
    if (aaGo && !per.grounded && perDist < 150) {
      aaGo = false;
      plan = null;
      return me.char === "garon" ? IN.C : IN.B;
    }

    if (plan && plan.frames > 0) {
      plan.frames--;
      const out = plan.first ? plan.press | plan.hold : plan.hold;
      plan.first = false;
      return out;
    }

    const canFire = me.char === "leon" && canSpecial(state, index);
    const lightR = ch.moves.light.reach[1] + 20;
    const heavyR = ch.moves.heavy.reach[1] + 15;
    const r = rand();
    const mk = (press, hold, frames) => ({ press, hold, frames, first: true });

    if (rand() < cfg.hesitate) {
      plan = mk(0, 0, 20 + Math.floor(rand() * 20));
    } else if (dist > 330) {
      if (canFire && r < cfg.fireball * 0.5) plan = mk(IN.C, 0, 1);
      else if (r < cfg.jump * 3) plan = mk(0, IN.UP | fwd, 1);
      else plan = mk(0, fwd, 10 + Math.floor(rand() * 20));
    } else if (dist > heavyR) {
      if (r < cfg.aggro) plan = mk(0, fwd, 6 + Math.floor(rand() * 14));
      else if (r < cfg.aggro + 0.15) plan = mk(0, back, 8 + Math.floor(rand() * 12));
      else if (r < cfg.aggro + 0.15 + cfg.jump * 2) plan = mk(0, IN.UP | fwd, 1);
      else if (canFire && r < 0.9) plan = mk(IN.C, 0, 1);
      else plan = mk(0, 0, 10 + Math.floor(rand() * 15));
    } else if (dist > lightR) {
      if (r < 0.4 * cfg.aggro + 0.2) plan = mk(IN.B, 0, 1);
      else if (r < 0.6) plan = mk(0, fwd, 5);
      else if (r < 0.75) plan = mk(0, back, 8);
      else plan = mk(0, 0, 8);
    } else if (r < 0.35) plan = mk(IN.A, 0, 1);
    else if (r < 0.55) plan = mk(IN.A, IN.DOWN, 1);
    else if (r < 0.7) plan = mk(IN.B, 0, 1);
    else if (r < 0.85) plan = mk(0, back, 10);
    else plan = mk(0, IN.DOWN | back, 14);

    plan.frames--;
    plan.first = false;
    return plan.press | plan.hold;
  }

  return function think(state) {
    stateRef = state;
    const me = state.players[index];
    const op = state.players[1 - index];
    seen.push({
      action: op.action,
      move: op.move,
      moveFrame: op.moveFrame,
      startFrame: state.frame - op.moveFrame,
      x: op.x,
      grounded: op.grounded,
    });
    if (seen.length > 40) seen.shift();
    const per = seen[Math.max(0, seen.length - 1 - cfg.react)];
    let out = decide(state, me, op, per);
    // attacks trigger on press, so a button requested two frames in a row must be released first
    const repeated = out & lastOut & BUTTONS;
    out &= ~repeated;
    lastOut = out;
    return out;
  };
}
