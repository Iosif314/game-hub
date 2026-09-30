// 2D close-up screens for maintenance, drawn in the game's four greys at 384×216.
// Each game gets the mouse (with the mercury tremor already applied to the hand) and reports a result
// object when it ends; the player then clicks to leave. ESC always leaves with { cancelled: true }.

const G0 = "#161517";
const G1 = "#4a4843";
const G2 = "#8a867c";
const G3 = "#c4bfb1";
const GLOW = "#fff3d0";
const W = 384;
const H = 216;

export function createCloseup(canvas, help) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;

  let mouse = { x: W / 2, y: 40 };
  let down = false;
  let clicked = false;
  let keyQueue = [];
  let cur = null; // { game, s, t, result, ctx, onDone }

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  });
  canvas.addEventListener("mousedown", () => {
    down = true;
    clicked = true;
  });
  window.addEventListener("mouseup", () => {
    down = false;
  });

  // --- drawing helpers ---
  const rect = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const dots = (x, y, w, h, density, c) => {
    g.fillStyle = c;
    for (let yy = Math.round(y); yy < y + h; yy++) {
      for (let xx = Math.round(x); xx < x + w; xx++) {
        const t = ((xx & 1) * 2 + (yy & 1) * 3 + ((xx >> 1) & 1)) / 6;
        if (density > t) g.fillRect(xx, yy, 1, 1);
      }
    }
  };
  const line = (x1, y1, x2, y2, c, w = 2) => {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(Math.round(x1), Math.round(y1));
    g.lineTo(Math.round(x2), Math.round(y2));
    g.stroke();
  };
  const circle = (x, y, r, c, fill = true, w = 2) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      g.fillStyle = c;
      g.fill();
    } else {
      g.strokeStyle = c;
      g.lineWidth = w;
      g.stroke();
    }
  };
  const bar = (x, y, w, h, v, lo = null, hi = null) => {
    rect(x, y, w, h, G1);
    if (lo !== null) rect(x + (w * lo) / 100, y, (w * (hi - lo)) / 100, h, G2);
    rect(x, y, (w * Math.max(0, Math.min(100, v))) / 100, h, G3);
    rect(x + (w * Math.max(0, Math.min(100, v))) / 100 - 1, y - 2, 2, h + 4, GLOW);
  };

  function tremor(t, mercury) {
    const a = (mercury / 100) * 7;
    return {
      x: a * (Math.sin(t * 13.1) * 0.55 + Math.sin(t * 7.7 + 1.3) * 0.35 + (Math.random() - 0.5) * 0.3),
      y: a * 0.6 * (Math.sin(t * 11.3 + 0.7) * 0.6 + (Math.random() - 0.5) * 0.3),
    };
  }

  // --- the games ---
  const GAMES = {
    // fit a fragile mantle over the burner nozzle
    mantle: {
      init: (ctx) => ({ phase: "carry", spares: ctx.mantles, start: ctx.mantles, threaded: false, armed: false, lastBottom: mouse.y }),
      // mantles broken before giving up are still gone
      onCancel: (s) => ({ used: s.start - s.spares }),
      update(s, dt, io) {
        const NX = 192;
        const TOP = 138;
        const SEAT = 150;
        rect(0, 0, W, H, G0);
        dots(0, 150, W, H - 150, 0.18, G2);
        for (let i = 0; i < 9; i++) {
          dots(0, 10 + i * 18, 70 - i * 2, 9, 0.55, G3);
          dots(W - 70 + i * 2, 10 + i * 18, 70, 9, 0.55, G3);
        }
        rect(NX - 9, SEAT, 18, H - SEAT, G2);
        rect(NX - 9, SEAT, 2, H - SEAT, G3);
        rect(NX - 14, 146, 28, 4, G3);
        rect(NX - 3, TOP, 6, 8, G3);
        const drawMantle = (x, y, broken) => {
          if (broken) {
            for (let i = 0; i < 14; i++) rect(x - 8 + ((i * 7) % 17), y + 10 + ((i * 5) % 14), 2, 1, G3);
            return;
          }
          rect(x - 9, y, 18, 26, G3);
          for (let yy = 2; yy < 26; yy += 3) rect(x - 8, y + yy, 16, 1, G2);
          rect(x - 9, y, 18, 2, G0);
          rect(x - 3, y + 24, 6, 2, G0);
          rect(x - 1, y - 6, 2, 6, G3);
        };
        if (s.phase === "carry") {
          const x = io.hand.x;
          const bottom = Math.min(io.hand.y, SEAT + 4);
          const vy = (bottom - s.lastBottom) / Math.max(dt, 1 / 240);
          s.lastBottom = bottom;
          // lift it clear first, so a cursor that starts low can't break it instantly
          if (bottom < TOP - 20) s.armed = true;
          if (s.armed && !s.threaded && bottom >= TOP) {
            if (Math.abs(x - NX) > 3 || vy > 110) {
              s.phase = "broken";
              s.brokenAt = { x, y: bottom - 26 };
              s.spares--;
              s.timer = 0;
              s.reason = Math.abs(x - NX) > 3 ? "노즐에 걸려 부서졌다" : "너무 세게 내려서 부서졌다";
            } else s.threaded = true;
          }
          if (s.threaded && bottom < TOP - 2) s.threaded = false;
          if (s.threaded && bottom >= SEAT) return { help: "맨틀을 끼웠다", result: { ok: true, used: s.start - s.spares + 1 } };
          if (s.phase === "carry") drawMantle(s.threaded ? NX + (x - NX) * 0.2 : x, bottom - 26, false);
        }
        if (s.phase === "broken") {
          s.timer += dt;
          drawMantle(s.brokenAt.x, s.brokenAt.y, true);
          if (s.timer > 1.2) {
            if (s.spares <= 0) return { help: "여분 맨틀이 없다", result: { ok: false, used: s.start } };
            Object.assign(s, { phase: "carry", threaded: false, armed: false, lastBottom: io.hand.y });
          }
          return { help: `${s.reason}\n여분 ${s.spares}개` };
        }
        return {
          help: s.armed
            ? `맨틀 교체 · 여분 ${s.spares}개\n마우스로 천천히 내려 노즐에 끼우기`
            : `맨틀 교체 · 여분 ${s.spares}개\n먼저 맨틀을 위로 들어 올리기`,
        };
      },
      done(s) {
        rect(186, 124, 18, 26, G3);
        rect(188, 134, 8, 8, GLOW);
      },
    },

    // pour the dirty mercury through a chamois into the flask without spilling it
    filter: {
      init: () => ({ drops: [], beads: [], collected: 0, spilled: 0, carry: 0 }),
      update(s, dt, io) {
        rect(0, 0, W, H, G0);
        rect(0, 205, W, 11, G1);
        // funnel with chamois, flask
        g.fillStyle = G2;
        g.beginPath();
        g.moveTo(166, 128);
        g.lineTo(218, 128);
        g.lineTo(198, 158);
        g.lineTo(186, 158);
        g.closePath();
        g.fill();
        dots(170, 129, 44, 6, 0.6, G3);
        rect(188, 158, 8, 8, G2);
        rect(172, 166, 40, 39, G1);
        const level = Math.min(1, s.collected / 120);
        rect(174, 203 - 35 * level, 36, 35 * level, G3);
        // ladle follows the hand and pours while the button is held
        const lx = io.hand.x;
        const ly = 58 + io.hand.y * 0.05;
        const tilt = io.down ? 0.5 : 0;
        g.save();
        g.translate(lx, ly);
        g.rotate(tilt);
        rect(-22, -6, 30, 12, G2);
        rect(-20, -4, 26, 6, G3);
        rect(-60, -3, 38, 3, G2);
        g.restore();
        if (io.down) {
          s.carry += dt * 40;
          while (s.carry >= 1) {
            s.carry -= 1;
            s.drops.push({ x: lx + 10 + (Math.random() - 0.5) * 2, y: ly + 8, vy: 20 });
          }
        }
        for (const d of s.drops) {
          d.vy += 420 * dt;
          d.y += d.vy * dt;
          rect(d.x, d.y, 2, 3, G3);
        }
        s.drops = s.drops.filter((d) => {
          if (d.y >= 128 && d.y < 136 && d.x > 168 && d.x < 216) {
            s.collected++;
            return false;
          }
          if (d.y >= 204) {
            s.spilled++;
            s.beads.push({ x: d.x, y: 203 + Math.random() * 3 });
            return false;
          }
          return true;
        });
        for (const b of s.beads) rect(b.x, b.y, 2, 2, GLOW);
        if (s.collected >= 120) return { help: `다 걸렀다${s.spilled ? ` · 흘린 방울 ${s.spilled}개` : ""}`, result: { spilled: s.spilled } };
        return { help: `수은 욕조 거르기 · ${Math.round(level * 100)}%\n누르고 있으면 국자를 기울여 붓는다 · 깔때기 밖으로 흘리지 않기` };
      },
    },

    // wipe soot off the lens prisms
    lens: {
      init: (ctx) => {
        const cells = [];
        for (let i = 0; i < 16 * 8; i++) cells.push(Math.min(1, (1 - ctx.eq.lens / 100) * (0.7 + Math.random() * 0.6)));
        return { cells };
      },
      update(s, dt, io) {
        rect(0, 0, W, H, G0);
        const x0 = 72;
        const y0 = 30;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 16; c++) {
            const x = x0 + c * 15;
            const y = y0 + r * 15;
            rect(x, y, 15, 15, r % 2 ? G2 : G3);
            rect(x, y + 13, 15, 2, G1);
            const i = r * 16 + c;
            if (io.down && Math.hypot(x + 7 - io.hand.x, y + 7 - io.hand.y) < 16) s.cells[i] = Math.max(0, s.cells[i] - dt * 1.6);
            dots(x, y, 15, 15, s.cells[i] * 0.95, G0);
          }
        }
        circle(io.hand.x, io.hand.y, 9, io.down ? G3 : G2, false, 2);
        const avg = s.cells.reduce((a, b) => a + b, 0) / s.cells.length;
        if (avg < 0.06) return { help: "렌즈가 깨끗해졌다", result: { clarity: 100 - avg * 100 } };
        return { help: `렌즈 닦기 · 그을음 ${Math.round(avg * 100)}%\n누른 채 문질러 닦기 · E로 그만두기`, stop: { clarity: 100 - avg * 100 } };
      },
    },

    // crank the clockwork weight back up: steady circles, too fast and the ratchet slips
    wind: {
      init: () => ({ turns: 0, prev: null, slip: 0 }),
      update(s, dt, io) {
        const cx = 192;
        const cy = 108;
        rect(0, 0, W, H, G0);
        circle(cx, cy, 56, G1);
        circle(cx, cy, 44, G0);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + s.turns * Math.PI * 2;
          rect(cx + Math.cos(a) * 52 - 2, cy + Math.sin(a) * 52 - 2, 4, 4, G2);
        }
        const ang = Math.atan2(io.hand.y - cy, io.hand.x - cx);
        if (io.down) {
          if (s.prev !== null) {
            let d = ang - s.prev;
            if (d > Math.PI) d -= Math.PI * 2;
            if (d < -Math.PI) d += Math.PI * 2;
            if (Math.abs(d) / Math.max(dt, 1 / 240) > 14) {
              s.turns = Math.max(0, s.turns - 0.15);
              s.slip = 0.6;
            } else if (d > 0) s.turns += d / (Math.PI * 2);
          }
          s.prev = ang;
        } else s.prev = null;
        const hx = cx + Math.cos(ang) * 40;
        const hy = cy + Math.sin(ang) * 40;
        line(cx, cy, hx, hy, G3, 4);
        circle(hx, hy, 6, io.down ? GLOW : G3);
        circle(cx, cy, 7, G2);
        bar(92, 190, 200, 8, (s.turns / 6) * 100);
        if (s.slip > 0) s.slip -= dt;
        if (s.turns >= 6) return { help: "태엽을 끝까지 감았다", result: { ok: true } };
        return { help: s.slip > 0 ? "톱니가 미끄러졌다 · 천천히" : "태엽 감기\n누른 채 손잡이를 시계 방향으로 돌리기" };
      },
    },

    // pump the fuel tank up to working pressure; overshoot and the safety valve blows it down
    pump: {
      init: (ctx) => ({ p: ctx.eq.pressure, up: true, hiss: 0 }),
      update(s, dt, io) {
        rect(0, 0, W, H, G0);
        const hy = Math.max(60, Math.min(160, io.hand.y));
        rect(110, 70, 30, 120, G1);
        rect(120, hy - 40, 10, 40, G2);
        rect(100, hy - 48, 50, 8, G3);
        if (s.up && hy > 150) {
          s.up = false;
          s.p += 7;
        }
        if (!s.up && hy < 75) s.up = true;
        if (s.p > 95) {
          s.p = 60;
          s.hiss = 1.2;
        }
        // gauge
        circle(270, 110, 50, G1);
        circle(270, 110, 44, G0);
        for (let i = 0; i <= 10; i++) {
          const a = Math.PI * (1 - i / 10);
          const inZone = i * 10 >= 70 && i * 10 <= 85;
          rect(270 + Math.cos(a) * 38 - 1, 110 - Math.sin(a) * 38 - 1, 3, 3, inZone ? GLOW : G2);
        }
        const na = Math.PI * (1 - Math.min(100, s.p) / 100);
        line(270, 110, 270 + Math.cos(na) * 34, 110 - Math.sin(na) * 34, G3, 2);
        if (s.hiss > 0) {
          s.hiss -= dt;
          dots(300, 40, 40, 30, 0.5, G2);
        }
        const inZone = s.p >= 70 && s.p <= 85;
        return {
          help: s.hiss > 0 ? "안전밸브가 터져 압력이 빠졌다" : `압력 펌프질 · 손잡이를 위아래로\n${inZone ? "적정 압력 · E로 마치기" : "눈금의 밝은 구간까지 · E로 마치기"}`,
          stop: { pressure: s.p },
        };
      },
    },

    // hold to pour from the drum into the burner tank; overfill and it's wasted
    refuel: {
      init: (ctx) => ({ tank: ctx.eq.tank, start: ctx.eq.tank, used: 0, wasted: 0, drum: ctx.drum }),
      update(s, dt, io) {
        rect(0, 0, W, H, G0);
        rect(60, 60, 70, 110, G1);
        rect(60, 60, 70, 6, G2);
        rect(130, 70, 60, 6, G2);
        rect(230, 70, 90, 120, G1);
        rect(232, 190 - 1.18 * s.tank, 86, 1.18 * s.tank, G2);
        rect(228, 72, 94, 2, GLOW);
        if (io.down && s.drum - s.used > 0) {
          const a = dt * 30;
          s.used += a;
          if (s.tank >= 100) s.wasted += a;
          s.tank = Math.min(100, s.tank + a);
          for (let i = 0; i < 3; i++) rect(190 + Math.random() * 6, 76 + Math.random() * (110 - 1.18 * s.tank), 2, 3, G3);
        }
        if (s.wasted > 0) dots(210, 196, 120, 8, 0.4, G2);
        return {
          help: `석유 보충 · 탱크 ${Math.round(s.tank)}%${s.wasted > 0 ? " · 넘쳤다" : ""}\n누르고 있으면 붓는다 · E로 마치기`,
          stop: { added: s.tank - s.start, used: s.used },
        };
      },
    },

    // warm the vaporiser with the spirit cup, then open the valve at the right heat
    ignite: {
      init: () => ({ heat: 0, msg: "", msgT: 0, tries: 0 }),
      update(s, dt, io) {
        rect(0, 0, W, H, G0);
        rect(186, 60, 12, 110, G2);
        rect(170, 170, 44, 10, G1);
        if (io.down) {
          s.heat = Math.min(100, s.heat + dt * 22);
          for (let i = 0; i < 6; i++) rect(180 + Math.random() * 24, 150 + Math.random() * 18, 2, 3, i % 2 ? GLOW : G3);
        } else s.heat = Math.max(0, s.heat - dt * 8);
        bar(92, 196, 200, 8, s.heat, 55, 90);
        if (s.msgT > 0) s.msgT -= dt;
        if (io.keys.includes("KeyE")) {
          s.tries++;
          if (s.heat < 55) {
            s.msg = "기화가 덜 됐다 · 불꽃이 꺼졌다";
            s.msgT = 1.5;
            s.heat *= 0.6;
          } else if (s.heat > 90) {
            s.msg = "불꽃이 솟구쳤다 · 식혀서 다시";
            s.msgT = 1.5;
            s.heat = 40;
          } else return { help: "불이 붙었다", result: { lit: true, tries: s.tries } };
        }
        return { help: s.msgT > 0 ? s.msg : "예열과 점화\n누르고 있으면 기화관을 달군다 · 눈금 구간에서 E로 밸브 열기" };
      },
      done() {
        for (let i = 0; i < 18; i++) rect(182 + Math.random() * 20, 40 + Math.random() * 24, 2, 3, GLOW);
      },
    },
  };

  function finish(result) {
    const onDone = cur.onDone;
    cur = null;
    canvas.classList.add("hidden");
    help.classList.add("hidden");
    onDone(result);
  }

  return {
    get active() {
      return cur !== null;
    },
    open(kind, ctx, onDone) {
      const game = GAMES[kind];
      cur = { game, kind, s: game.init(ctx), t: 0, ctx, onDone, result: null, doneHelp: "" };
      down = false;
      clicked = false;
      keyQueue = [];
      canvas.classList.remove("hidden");
      help.classList.remove("hidden");
    },
    key(code) {
      keyQueue.push(code);
    },
    cancel() {
      if (cur) finish({ cancelled: true, ...(cur.game.onCancel ? cur.game.onCancel(cur.s) : {}) });
    },
    update(dt) {
      if (!cur) return;
      cur.t += dt;
      const keys = keyQueue;
      keyQueue = [];
      if (cur.result) {
        if (cur.game.done) cur.game.done(cur.s);
        help.textContent = `${cur.doneHelp}\n클릭해서 나가기`;
        if (clicked) finish(cur.result);
        clicked = false;
        return;
      }
      const shake = tremor(cur.t, cur.ctx.mercury());
      const io = { hand: { x: mouse.x + shake.x, y: mouse.y + shake.y }, down, keys };
      const out = cur.game.update(cur.s, dt, io);
      help.textContent = out.help;
      // games without a natural end can be stopped with E and keep what was done
      if (!out.result && out.stop && keys.includes("KeyE")) {
        out.result = out.stop;
        out.help = "작업을 마쳤다";
      }
      if (out.result) {
        cur.result = out.result;
        cur.doneHelp = out.help;
      }
      clicked = false;
    },
  };
}
