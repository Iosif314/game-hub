import { createScreen, W, H, rect, crect, rng } from "./screen.js";
import * as A from "./art.js";
import { ROOM } from "./art.js";
import { startAudio, createGenerator, createVoice, sfx } from "./audio.js";
import { EMOTIONS, DATES, DUE_DAYS, GUILD_DUE, START_JARS, PEOPLE, RESERVES, DAYS, PAPERS } from "./data.js";

const $ = (id) => document.getElementById(id);
const view = $("view");
const screen = createScreen(view);
const hudEl = $("hud");
const tipEl = $("tip");
const dlg = $("dialog");
const dName = dlg.querySelector(".name");
const dText = dlg.querySelector(".text");
const dChoices = dlg.querySelector(".choices");
const pnl = $("panel");
const labelTip = $("label-tip");
const overlay = $("overlay");

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const round1 = (v) => Math.round(v * 10) / 10;
let uid = 0;

// ---------------------------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------------------------
const S = {
  day: 1,
  cash: 25,
  ticket: 302,
  jars: START_JARS.map((j) => ({ ...j, id: ++uid, label: { ...j.label } })),
  perm: [], // bloodstains that did not vanish: { x, y, r, seed, a, drip }
  reserve: JSON.parse(JSON.stringify(RESERVES)),
  screams: 0,
  screamsToday: 0,
  violations: 0,
  extractions: 0,
  flags: {},
  queue: [],
  log: [],
};

function hud() {
  hudEl.textContent = `${DATES[S.day - 1]} · ${S.day}일차    ${S.cash}실링`;
}
function tip(t) {
  tipEl.textContent = t || "";
}
function note(text) {
  S.log.push(text);
}

// ---------------------------------------------------------------------------------------------
// dialogue box and panels
// ---------------------------------------------------------------------------------------------
let talk = null; // lines waiting to be shown: { lines, i, done }

function say(name, lines, done) {
  dlg.classList.remove("hidden");
  dName.textContent = name || "";
  dChoices.innerHTML = "";
  talk = { lines: [].concat(lines), i: 0, done };
  dText.textContent = talk.lines[0];
  dText.classList.add("more");
}

function advance() {
  if (!talk) return;
  talk.i++;
  if (talk.i < talk.lines.length) {
    dText.textContent = talk.lines[talk.i];
    return;
  }
  const done = talk.done;
  talk = null;
  dText.classList.remove("more");
  if (done) done();
}

function choose(prompt, options, name) {
  dlg.classList.remove("hidden");
  if (name !== undefined) dName.textContent = name;
  if (prompt !== null) dText.textContent = prompt;
  dText.classList.remove("more");
  talk = null;
  dChoices.innerHTML = "";
  for (const o of options) {
    const btn = document.createElement("button");
    btn.textContent = o.label + (o.note ? `  (${o.note})` : "");
    btn.disabled = !!o.disabled;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      sfx.click();
      dChoices.innerHTML = "";
      o.fn();
    });
    dChoices.appendChild(btn);
  }
}

function hideDialog() {
  dlg.classList.add("hidden");
  talk = null;
}

dlg.addEventListener("click", () => {
  if (talk) advance();
});

function panel(html, buttons = [], cls = "") {
  pnl.className = cls;
  pnl.innerHTML = `${html}<div class="btns"></div>`;
  const box = pnl.querySelector(".btns");
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.textContent = b.label;
    btn.disabled = !!b.disabled;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      sfx.click();
      b.fn();
    });
    box.appendChild(btn);
  }
  pnl.classList.remove("hidden");
}
function closePanel() {
  pnl.classList.add("hidden");
  pnl.innerHTML = "";
}

// ---------------------------------------------------------------------------------------------
// scenes
// ---------------------------------------------------------------------------------------------
let scene = null;
function go(s) {
  if (scene && scene.leave) scene.leave();
  scene = s;
  labelTip.classList.add("hidden");
  if (s.enter) s.enter();
}

// --- the counter ---
let fakeStain = null; // a splash on the counter that is not there
const counter = {
  cust: null,
  expr: "neutral",
  draw(t, dt) {
    const b = screen.base;
    A.drawCounter(b, t);
    if (this.cust) A.drawBust(b, this.cust.look, { t, expr: this.expr });
    A.drawGrille(b);
    A.drawCounterTop(b, t);
    // after enough screams, the counter sometimes shows blood for a few frames
    if (S.extractions >= 2) {
      if (!fakeStain && Math.random() < dt / 25) fakeStain = { left: 0.12 + Math.random() * 0.1, x: 30 + Math.random() * 260, y: 116 + Math.random() * 40, seed: Math.floor(Math.random() * 1e6) };
      if (fakeStain) {
        drawSplat(screen.color, { x: fakeStain.x, y: fakeStain.y, r: 4, seed: fakeStain.seed, a: 1 });
        fakeStain.left -= dt;
        if (fakeStain.left <= 0) fakeStain = null;
      }
    }
  },
};

function toCounter() {
  counter.cust = null;
  go(counter);
  nextVisit();
}

function nextVisit() {
  hud();
  tip("");
  const v = S.queue.shift();
  if (!v) {
    counter.cust = null;
    hideDialog();
    go(evening);
    return;
  }
  if (v.needs && !jarOf(v.needs)) return nextVisit();
  counter.cust = PEOPLE[v.who];
  counter.expr = v.kind === "last" ? "sad" : "neutral";
  sfx.bell();
  const run = { pawn: pawnFlow, last: pawnFlow, buy: buyFlow, redeem: redeemFlow, sell: sellFlow, blackmail: blackmailFlow }[v.kind];
  run(v);
}

const jarOf = (who) => S.jars.find((j) => j.owner === who);
const remaining = (who, emo) => (S.reserve[who] && S.reserve[who][emo]) || 0;

// a question menu shared by every visit: each question can be asked once
function withAsks(v, name, rest) {
  v.asked = v.asked || new Set();
  return (v.ask || [])
    .filter(([q]) => !v.asked.has(q))
    .map(([q, a]) => ({
      label: q,
      fn: () => {
        v.asked.add(q);
        say(name, [a], rest);
      },
    }));
}

function pawnFlow(v) {
  const p = PEOPLE[v.who];
  say(p.name, v.intro, () => pawnMenu(v));
}

function pawnMenu(v) {
  const p = PEOPLE[v.who];
  const o = v.offer;
  const amount = v.kind === "last" ? remaining(v.who, o.emotion) : o.amount;
  const emo = EMOTIONS[o.emotion].name;
  choose(
    `${emo} ${amount}할을 맡기고 ${o.loan}실링을 빌리려 한다.`,
    [
      ...withAsks(v, p.name, () => pawnMenu(v)),
      { label: "맡는다", disabled: S.cash < o.loan, note: S.cash < o.loan ? "돈이 모자라다" : "", fn: () => interestMenu(v, amount) },
      { label: "돌려보낸다", fn: () => refuse(v) },
    ],
    p.name,
  );
}

function interestMenu(v, amount) {
  const o = v.offer;
  choose(
    "이자는?",
    [10, 20, 30].map((r) => ({
      label: `${r}%`,
      fn: () => {
        S.cash -= o.loan;
        sfx.coins(4);
        hud();
        note(`${PEOPLE[v.who].name}에게 ${o.loan}실링을 빌려주었다 (이자 ${r}%)`);
        hideDialog();
        go(
          chairScene({
            mode: "extract",
            who: v.who,
            emotion: o.emotion,
            target: amount,
            violation: !!v.child,
            done: (res) =>
              afterChair(v, res, () =>
                go(labelScene({ v, res, owned: false, owner: v.who, pawn: { loan: o.loan, rate: r, dueDay: S.day + DUE_DAYS } })),
              ),
          }),
        );
      },
    })),
  );
}

function refuse(v) {
  const p = PEOPLE[v.who];
  counter.expr = "sad";
  note(`${p.name}을(를) 돌려보냈다`);
  say(p.name, [v.refuse || "……"], () => {
    counter.cust = null;
    setTimeout(nextVisit, 500);
  });
}

// the sitter gets up, says thanks, and the next step follows
function afterChair(v, res, next) {
  const p = PEOPLE[v.sitter || v.who];
  say(p.name, [v.after], () => {
    hideDialog();
    next();
  });
}

function buyFlow(v) {
  const p = PEOPLE[v.who];
  say(p.name, v.intro, () => buyMenu(v));
}

function buyMenu(v) {
  const p = PEOPLE[v.who];
  choose(
    `${EMOTIONS[v.wants].name}을(를) 원한다. 1할에 ${v.price}실링.`,
    [
      ...withAsks(v, p.name, () => buyMenu(v)),
      {
        label: "저장고에서 병을 고른다",
        fn: () => {
          hideDialog();
          go(
            cellarScene({
              title: `${p.name}에게 팔 병을 고른다`,
              pick: (jar) => offerJar(v, jar),
              back: () => {
                go(counter);
                buyMenu(v);
              },
            }),
          );
        },
      },
      { label: "돌려보낸다", fn: () => refuse(v) },
    ],
    p.name,
  );
}

function offerJar(v, jar) {
  const p = PEOPLE[v.who];
  go(counter);
  if (jar.mine) return say("", ["이건 팔 수 없다. 내 것이다."], () => buyMenu(v));
  if (!jar.owned) return say("", ["아직 기한이 남은 맡은 물건이다. 팔 수 없다."], () => buyMenu(v));
  if (jar.emotion !== v.wants) return say(p.name, [`이건 ${EMOTIONS[v.wants].name}이 아니잖소.`], () => buyMenu(v));
  const price = Math.round(v.price * jar.amount);
  choose(
    `${jar.amount}할이면 ${price}실링.`,
    [
      {
        label: "판다",
        fn: () => {
          S.cash += price;
          sfx.coins(5);
          hud();
          removeJar(jar);
          note(`${p.name}에게 ${EMOTIONS[jar.emotion].name} ${jar.amount}할을 ${price}실링에 팔았다`);
          if (v.inject) {
            hideDialog();
            go(chairScene({ mode: "inject", who: v.who, emotion: jar.emotion, amount: jar.amount, done: (res) => afterChair(v, res, toCounterNext) }));
          } else {
            say(p.name, [v.after], () => {
              counter.cust = null;
              setTimeout(nextVisit, 500);
            });
          }
        },
      },
      { label: "다른 병을 고른다", fn: () => buyMenu(v) },
    ],
    p.name,
  );
}

function toCounterNext() {
  counter.cust = null;
  go(counter);
  setTimeout(nextVisit, 500);
}

function removeJar(jar) {
  const i = S.jars.indexOf(jar);
  if (i >= 0) S.jars.splice(i, 1);
}

function redeemFlow(v) {
  const p = PEOPLE[v.who];
  const own = jarOf(v.who);
  const pay = own ? Math.round(own.pawn.loan * (1 + own.pawn.rate / 100)) : 0;
  if (!own) {
    say(p.name, ["……맡긴 게 없다고? 그럴 리가."], () => {
      counter.cust = null;
      setTimeout(nextVisit, 500);
    });
    return;
  }
  say(p.name, v.intro.concat([`(${pay}실링을 내민다)`]), () =>
    choose(
      null,
      [
        {
          label: "병을 가져온다",
          fn: () => {
            hideDialog();
            go(
              cellarScene({
                title: `${p.name}의 병을 고른다`,
                pick: (jar) => {
                  if (jar.mine) {
                    go(counter);
                    return say("", ["이건 내 것이다."], () => redeemFlow(v));
                  }
                  S.cash += pay;
                  sfx.coins(4);
                  hud();
                  removeJar(jar);
                  const right = jar.owner === v.who;
                  S.flags.tom = right ? "right" : "wrong";
                  note(`${p.name}이(가) ${pay}실링을 갚고 병을 찾아갔다${right ? "" : " (다른 사람의 병)"}`);
                  const after = right ? v.after : v.wrong[jar.emotion] || v.wrong.default;
                  go(chairScene({ mode: "inject", who: v.who, emotion: jar.emotion, amount: jar.amount, done: (res) => afterChair({ ...v, after }, res, toCounterNext) }));
                },
                back: () => {
                  go(counter);
                  redeemFlow(v);
                },
              }),
            );
          },
        },
      ],
      p.name,
    ),
  );
}

function sellFlow(v) {
  const p = PEOPLE[v.who];
  say(p.name, v.intro, () => sellMenu(v));
}

function sellMenu(v) {
  const p = PEOPLE[v.who];
  const o = v.offer;
  choose(
    `${PEOPLE[v.sitter].name}의 ${EMOTIONS[o.emotion].name} ${o.amount}할을 ${o.price}실링에 사 달라고 한다.`,
    [
      ...withAsks(v, p.name, () => sellMenu(v)),
      {
        label: "산다",
        disabled: S.cash < o.price,
        note: S.cash < o.price ? "돈이 모자라다" : "",
        fn: () => {
          S.cash -= o.price;
          sfx.coins(3);
          hud();
          note(`${p.name}에게 ${o.price}실링을 주고 ${PEOPLE[v.sitter].name}의 ${EMOTIONS[o.emotion].name}을(를) 샀다`);
          hideDialog();
          go(
            chairScene({
              mode: "extract",
              who: v.sitter,
              emotion: o.emotion,
              target: o.amount,
              violation: true,
              done: (res) => afterChair(v, res, () => go(labelScene({ v, res, owned: true, owner: v.sitter }))),
            }),
          );
        },
      },
      { label: "거절한다", fn: () => refuse(v) },
    ],
    p.name,
  );
}

function blackmailFlow(v) {
  const p = PEOPLE[v.who];
  say(p.name, v.intro, () =>
    choose(
      null,
      [
        {
          label: "병을 넘긴다",
          fn: () => {
            removeJar(jarOf(v.needs));
            note(`넬리의 병을 아버지에게 넘겼다`);
            say(p.name, [v.give], () => {
              counter.cust = null;
              setTimeout(nextVisit, 500);
            });
          },
        },
        {
          label: "거절한다",
          fn: () => {
            S.flags.reported = true;
            note(`넬리의 아버지를 돌려보냈다`);
            say(p.name, [v.refuse], () => {
              counter.cust = null;
              setTimeout(nextVisit, 500);
            });
          },
        },
      ],
      p.name,
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// the chair
// ---------------------------------------------------------------------------------------------
const generator = { node: null };
const voice = { node: null };

// tube geometry for the gas, as a polyline with lengths
const TUBE = (() => {
  const p = ROOM.tube;
  const seg = [];
  let total = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    seg.push({ a: p[i], b: p[i + 1], l, start: total });
    total += l;
  }
  return { seg, total };
})();
function tubeAt(s) {
  for (const g of TUBE.seg) {
    if (s <= g.start + g.l) {
      const k = (s - g.start) / g.l;
      return [g.a[0] + (g.b[0] - g.a[0]) * k, g.a[1] + (g.b[1] - g.a[1]) * k];
    }
  }
  return TUBE.seg[TUBE.seg.length - 1].b;
}

function drawSplat(c, s) {
  const R = rng(s.seed);
  const a = s.a === undefined ? 1 : s.a;
  const dark = [96, 8, 10];
  const mid = [158, 16, 18];
  const bright = [204, 34, 30];
  const n = 6 + Math.floor(s.r * 4);
  for (let i = 0; i < n; i++) {
    const ang = R() * Math.PI * 2;
    const d = R() * s.r;
    const x = s.x + Math.cos(ang) * d * (s.flat ? 1.8 : 1);
    const y = s.y + Math.sin(ang) * d * (s.flat ? 0.5 : 1);
    const sz = 1 + Math.floor(R() * 2);
    crect(c, x, y, sz, sz, R() < 0.5 ? dark : mid, a);
  }
  crect(c, s.x, s.y, 1, 1, bright, a);
  if (s.drip) crect(c, s.x, s.y, 1, s.drip, dark, a);
}

function drawPerm(c) {
  for (const s of S.perm) drawSplat(c, s);
}

// mode "extract": hold to crank, the emotion leaves through the tube and the blood stays where it lands
// until the cranking stops. mode "inject": hold to push a jar back in; no blood, the emotion swells.
function chairScene(o) {
  const look = PEOPLE[o.who].look;
  const injecting = o.mode === "inject";
  const reserve = injecting ? Infinity : remaining(o.who, o.emotion);
  const st = {
    phase: "strap",
    timer: 0.9,
    level: injecting ? o.amount : 0,
    taken: 0,
    held: 0,
    speed: 0,
    angle: 0,
    tick: 0,
    intensity: 0,
    gas: [],
    drops: [],
    splats: [],
    tears: [],
    faceBlood: 0,
    crack: { f: 400, left: 0 },
    burst: 0,
  };
  const emo = EMOTIONS[o.emotion];

  function finish() {
    // one frame: every drop of blood is gone, the room is clean and silent
    generator.node.cut();
    voice.node.cut();
    const all = !injecting && st.taken >= reserve - 0.01;
    const violated = !injecting && (o.violation || all);
    if (violated) {
      S.violations++;
      const pool = st.splats.slice().sort(() => Math.random() - 0.5);
      const keep = pool.slice(0, Math.min(4, pool.length));
      if (!keep.length) keep.push({ x: ROOM.chairX + 18, y: ROOM.floor + 6, r: 3, seed: 99, flat: true });
      for (const k of keep) S.perm.push({ ...k, a: 1 });
    }
    st.splats = [];
    st.drops = [];
    st.tears = [];
    st.pool = 0;
    st.gas = [];
    st.faceBlood = 0;
    st.intensity = 0;
    st.phase = "after";
    st.timer = 1.4;
    if (!injecting) {
      S.reserve[o.who][o.emotion] = round1(reserve - st.taken);
      S.extractions++;
    }
  }

  const sc = {
    enter() {
      hud();
      tip("");
      if (!generator.node) generator.node = createGenerator();
      if (!voice.node) voice.node = createVoice();
      sfx.strap();
    },
    leave() {
      generator.node.cut();
      voice.node.cut();
      holding = false;
    },
    update(dt, t) {
      if (st.phase === "strap") {
        st.timer -= dt;
        if (st.timer <= 0) {
          st.phase = "ready";
          tip(injecting ? "Space 또는 마우스를 누르고 있으면 발전기가 거꾸로 돈다" : "Space 또는 마우스를 누르고 있으면 발전기가 돈다 · 손을 떼면 멈춘다");
        }
        return;
      }
      if (st.phase === "after") {
        st.timer -= dt;
        if (st.timer <= 0) {
          st.phase = "done";
          sfx.strap();
          tip("");
          o.done({ amount: round1(st.taken) });
        }
        return;
      }
      if (st.phase === "done") return;

      const on = holding;
      st.speed += ((on ? 1 : 0) - st.speed) * Math.min(1, dt * (on ? 4 : 10));
      st.angle += st.speed * dt * 9;
      st.tick += st.speed * dt * 9;
      if (st.tick > Math.PI / 2) {
        st.tick = 0;
        sfx.crankTick();
      }
      generator.node.set(st.speed);
      if (on && st.phase === "ready") {
        st.phase = "running";
        tip("");
        if (!injecting) {
          S.screams++;
          S.screamsToday++;
        }
      }
      if (st.phase !== "running") return;
      if (on) st.held += dt;
      st.intensity += ((on ? 1 : 0) - st.intensity) * Math.min(1, dt * (on ? 2.5 : 6));

      if (injecting) {
        if (on) st.level = Math.max(0, st.level - dt * 1.1);
        if (on && Math.random() < dt * 40) st.gas.push({ s: TUBE.total, v: -110 });
        injectVoice(t);
        if (o.emotion === "grief" && on) {
          for (let k = 0; k < 3; k++) if (Math.random() < dt * 30 * st.intensity) st.tears.push({ from: true, vx: -10 - Math.random() * 50, vy: -20 + Math.random() * 30 });
        }
        if (st.level <= 0) finish();
      } else {
        if (on && st.taken < reserve) st.taken = Math.min(reserve, st.taken + dt * 0.95 * st.speed);
        st.level = st.taken;
        const left = (reserve - st.taken) / reserve;
        const flow = st.taken >= reserve ? 0 : left < 0.3 ? left / 0.3 : 1;
        if (on && Math.random() < dt * 60 * flow) st.gas.push({ s: 0, v: 100 + Math.random() * 30, thin: flow < 0.6 });
        if (on) st.faceBlood = Math.min(1, st.faceBlood + dt * 0.35);
        // blood from the nose, the eyes and the ears, flying and staying where it lands
        if (on && Math.random() < dt * 16 * st.intensity) {
          const src = [
            [-10, 2],
            [-6, -2],
            [2, 0],
          ][Math.floor(Math.random() * 3)];
          st.drops.push({
            x: ROOM.head.x + src[0],
            y: ROOM.head.y + src[1] + (look.child ? 8 : 0),
            vx: Math.random() < 0.8 ? -20 - Math.random() * 160 : Math.random() * 90,
            vy: -30 - Math.random() * 100,
            life: 0.3 + Math.random() * 0.8,
          });
        }
        extractVoice(t, left, st.taken >= reserve);
        // letting go ends it, once something has come out
        if (!on && st.taken >= 0.3) finish();
      }

      for (const g of st.gas) g.s += g.v * dt;
      st.gas = st.gas.filter((g) => g.s >= 0 && g.s <= TUBE.total);
      for (const d of st.drops) {
        d.vy += 260 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= dt;
        const floor = d.y >= ROOM.floor + 4;
        if (d.life <= 0 || floor) {
          const R = Math.random;
          st.splats.push({ x: d.x, y: floor ? ROOM.floor + 3 + R() * 40 : d.y, r: 0.6 + R() * 1.8, seed: Math.floor(R() * 1e6), flat: floor, drip: !floor && R() < 0.5 ? 2 + Math.floor(R() * 7) : 0 });
          d.dead = true;
        }
      }
      st.drops = st.drops.filter((d) => !d.dead && d.x > -5 && d.x < W + 5);
      if (st.splats.length > 700) st.splats.splice(0, st.splats.length - 700);
    },
    draw(t) {
      const b = screen.base;
      const c = screen.color;
      A.drawRoom(b, t);
      A.drawGenerator(b, st.angle);
      A.drawChair(b);
      const running = st.phase === "running";
      const pose = { shake: 0, scream: 0, back: 0, face: "calm" };
      if (running && !injecting) {
        pose.shake = st.intensity * (st.taken >= reserve ? 0.5 : 1);
        pose.scream = st.intensity;
        pose.back = st.intensity * (0.5 + Math.sin(t * 7) * 0.5);
        pose.face = "scream";
      } else if (running && injecting) {
        const f = { grief: "wail", joy: "laugh", fear: "cower", love: "embrace", anger: "scream", guilt: "wail", resign: "blank" }[o.emotion];
        pose.face = f;
        pose.shake = { cower: 0.9, scream: 1, wail: 0.35, laugh: 0.5, embrace: 0.15 }[f] * st.intensity || 0;
        pose.scream = f === "scream" ? st.intensity : 0;
        // sobs heave the whole body; laughter throws the head back again and again
        if (f === "wail") pose.dy = (Math.sin(t * Math.PI * 2 * 1.6) > 0 ? -3 : 1) * st.intensity;
        if (f === "laugh") {
          pose.back = Math.abs(Math.sin(t * 8)) * st.intensity;
          pose.dy = -Math.abs(Math.sin(t * 16)) * 3 * st.intensity;
        }
        if (f === "cower") pose.dy = 2 * st.intensity;
      } else if (st.phase === "after" || st.phase === "done") pose.face = st.timer < 0.9 ? "smile" : "calm";
      const head = A.drawSitter(b, look, pose, t);
      const j = ROOM.jar;
      A.drawJar(b, j.x, j.y, j.w, j.h, { target: injecting ? null : o.target });
      A.drawRoomLight(b, t, running ? 0.8 + Math.random() * 0.4 * st.speed : 1);
      A.drawGas(c, j.x, j.y, j.w, j.h, Math.min(1, st.level / 10), o.emotion, t, 5);
      for (const g of st.gas) {
        const [x, y] = tubeAt(g.s);
        crect(c, x - (g.thin ? 0 : 1), y - (g.thin ? 0 : 1), g.thin ? 1 : 2, g.thin ? 1 : 2, emo.color, g.thin ? 0.6 : 0.95);
      }
      drawPerm(c);
      for (const s of st.splats) drawSplat(c, s);
      for (const d of st.drops) crect(c, d.x, d.y, 1, 2, [170, 18, 18]);
      if (!injecting && st.faceBlood > 0) {
        // streams running down from the nose and the eye
        const len = Math.floor(st.faceBlood * 22);
        crect(c, head.hx - 10, head.hy + 3, 1, len, [140, 12, 14]);
        crect(c, head.hx - 6, head.hy - 1, 1, Math.floor(len * 0.6), [150, 14, 16]);
        crect(c, head.hx + 2, head.hy + 1, 1, Math.floor(len * 0.4), [130, 10, 12]);
      }
      if (running && injecting) drawSwell(c, head, t);
    },
  };

  // the emotion flooding back in: its colour spreads over the face, and grief pours out as tears
  function drawSwell(c, head, t) {
    const k = st.intensity * (0.6 + Math.sin(t * 5) * 0.2);
    for (let y = -10; y <= 10; y++) {
      for (let x = -9; x <= 9; x++) {
        if (x * x * 100 + y * y * 81 > 8100) continue;
        if (((x + y + Math.floor(t * 20)) & 3) === 0 || Math.random() < k * 0.3) crect(c, head.hx + x, head.hy + y, 1, 1, emo.color, Math.min(0.85, k));
      }
    }
    crect(c, head.hx - 7, head.hy - 3, 2, 2, emo.color.map((v) => Math.min(255, v * 1.6)), 1);
    if (o.emotion === "grief") {
      // tears gush from the eye in streams and pool across the floor
      for (const tr of st.tears) {
        if (tr.from) {
          tr.from = false;
          tr.x = head.hx - 6;
          tr.y = head.hy - 1;
        }
        tr.vy += 260 / 60;
        tr.x += tr.vx / 60;
        tr.y += tr.vy / 60;
        if (tr.y >= ROOM.floor + 3) {
          tr.dead = true;
          st.pool = Math.min(70, (st.pool || 0) + 0.25);
        } else crect(c, tr.x, tr.y, 2, 2, emo.color, 0.95);
      }
      st.tears = st.tears.filter((tr) => !tr.dead);
      crect(c, head.hx - 7, head.hy - 1, 2, head.hy + 14 - head.hy, emo.color, 0.9);
      const pool = Math.floor(st.pool || 0);
      for (let i = -pool; i <= pool; i++) {
        const depth = Math.max(1, Math.round(3 * Math.sqrt(1 - (i * i) / ((pool + 1) * (pool + 1)))));
        crect(c, ROOM.chairX + 10 + i, ROOM.floor + 4, 1, depth, emo.color, 0.8);
      }
    }
  }

  function extractVoice(t, left, empty) {
    const I = st.intensity;
    if (empty) {
      // nothing left to take: a hoarse, cracking laugh
      const gate = Math.sin(t * Math.PI * 2 * 6.5) > 0 ? 1 : 0.12;
      voice.node.set({ f0: 200 + Math.random() * 60, loud: I * 0.8 * gate, vowel: 0.9, rough: 1, wobble: 0 });
      return;
    }
    if (left < 0.25) {
      // near the bottom the scream breaks and laughter slips in
      st.crack.left -= 1 / 60;
      if (st.crack.left <= 0) {
        st.crack.f = 260 + Math.random() * 640;
        st.crack.left = 0.05 + Math.random() * 0.08;
      }
      const gate = Math.sin(t * Math.PI * 2 * 7) > -0.2 ? 1 : 0.25;
      voice.node.set({ f0: st.crack.f, loud: I * gate, vowel: 1, rough: 0.8, wobble: 20 });
      return;
    }
    voice.node.set({ f0: 330 + I * 280 + Math.sin(t * 5) * 30 + (Math.random() - 0.5) * 40, loud: I, vowel: 1, rough: 0.35 + I * 0.4, wobble: 12 });
  }

  function injectVoice(t) {
    const I = st.intensity;
    const gate = (hz, low) => (Math.sin(t * Math.PI * 2 * hz) > 0 ? 1 : low);
    const v = {
      grief: { f0: 250 + Math.sin(t * 1.3) * 45, loud: I * (0.55 + 0.45 * gate(1.6, 0.2)), vowel: 0.25, rough: 0.35, wobble: 9 },
      joy: { f0: 360 + (Math.floor(t * 7) % 4) * 45, loud: I * gate(7, 0.08), vowel: 1, rough: 0.45, wobble: 0 },
      fear: { f0: 520 + Math.random() * 70, loud: I * 0.6 * gate(13, 0.25), vowel: 0.45, rough: 0.75, wobble: 25 },
      love: { f0: 210 + Math.sin(t * 0.8) * 25, loud: I * 0.55, vowel: 0.05, rough: 0.15, wobble: 4 },
      anger: { f0: 120 + Math.random() * 25, loud: I, vowel: 0.6, rough: 1, wobble: 0 },
      guilt: { f0: 170, loud: I * 0.45 * gate(0.9, 0.4), vowel: 0.1, rough: 0.9, wobble: 3 },
      resign: { f0: 100, loud: I * 0.2, vowel: 0, rough: 0.5, wobble: 0 },
    }[o.emotion];
    voice.node.set(v);
  }

  return sc;
}

// ---------------------------------------------------------------------------------------------
// the label: written out from the deal, then the jar goes on the shelf
// ---------------------------------------------------------------------------------------------
const dateOf = (day) => `1851. 10. ${13 + day}`;

function labelScene({ v, res, owned, owner, pawn }) {
  const o = v.offer || {};
  const emotion = o.emotion;
  const no = String(S.ticket++).padStart(4, "0");
  const label = {
    no,
    name: PEOPLE[owner].name,
    emotion: EMOTIONS[emotion].name,
    object: o.object || "",
    amount: `${Math.max(1, Math.round(res.amount))}할`,
    date: dateOf(S.day),
    due: pawn ? dateOf(pawn.dueDay) : "",
    loan: pawn ? String(pawn.loan) : String(o.price || ""),
    rate: pawn ? `${pawn.rate}%` : "",
    memo: pawn ? "" : `${PEOPLE[v.who].name}에게서 삼`,
    hand: "mine",
  };
  return {
    enter() {
      tip("");
      sfx.glass();
      panel(`<div class="label-card">${labelText(label)}</div>`, [
        {
          label: "선반에 올린다",
          fn: () => {
            S.jars.push({ id: ++uid, emotion, amount: res.amount, owned, owner, pawn, moment: v.moment, label });
            sfx.glass();
            closePanel();
            toCounterNext();
          },
        },
      ], "side");
    },
    leave() {
      closePanel();
    },
    draw(t) {
      const b = screen.base;
      rect(b, 0, 0, W, H, 44);
      rect(b, 0, 128, W, 52, 92);
      rect(b, 0, 128, W, 1, 140);
      const x = 52;
      const y = 40;
      A.drawJar(b, x, y, 64, 88, { marks: true });
      A.drawGas(screen.color, x, y, 64, 88, Math.min(1, res.amount / 10), emotion, t, 11);
      A.drawLabelPatch(screen.color, x + 12, y + 30, 40, 22, false);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// the storeroom
// ---------------------------------------------------------------------------------------------
function labelText(l) {
  const d = (v) => (v ? esc(v) : "—");
  return `<div class="ticket">No. ${d(l.no)}</div>
    <div>이름: ${d(l.name)}</div>
    <div>감정: ${d(l.emotion)} · 대상: ${d(l.object)}</div>
    <div>양: ${d(l.amount)}</div>
    <div>추출일: ${d(l.date)} · 기한: ${d(l.due)}</div>
    <div>대출금: ${d(l.loan)}${l.loan ? "실링" : ""} · 이자: ${d(l.rate)}</div>
    <div>메모: ${d(l.memo)}</div>`;
}

function cellarScene({ title, pick, back }) {
  let hover = -1;
  let open = null;
  const sc = {
    enter() {
      tip(title || "저장고");
      hideDialog();
      showButtons();
    },
    leave() {
      closePanel();
      labelTip.classList.add("hidden");
    },
    move(x, y, ev) {
      if (open) return;
      hover = -1;
      S.jars.forEach((j, i) => {
        const s = A.shelfSlot(i);
        if (x >= s.x - 3 && x <= s.x + s.w + 3 && y >= s.y - 6 && y <= s.y + s.h + 2) hover = i;
      });
      if (hover >= 0) {
        labelTip.innerHTML = labelText(S.jars[hover].label);
        labelTip.className = S.jars[hover].label.hand === "old" ? "old" : "";
        const r = view.getBoundingClientRect();
        labelTip.style.left = `${Math.min(ev.clientX - r.left + 14, r.width - 260)}px`;
        labelTip.style.top = `${Math.min(ev.clientY - r.top + 14, r.height - 170)}px`;
      } else labelTip.classList.add("hidden");
    },
    down() {
      if (open || hover < 0) return;
      sfx.glass();
      openJar(S.jars[hover]);
    },
    draw(t) {
      A.drawCellar(screen.base);
      S.jars.forEach((j, i) => A.drawShelfJar(screen.base, screen.color, j, i, t, i === hover));
    },
  };
  function showButtons() {
    panel("", back ? [{ label: "돌아간다", fn: back }] : [], "corner");
    if (!back) closePanel();
  }
  function openJar(jar) {
    open = jar;
    labelTip.classList.add("hidden");
    const buttons = [{ label: "확대경으로 들여다본다", fn: () => magnify(jar) }];
    if (pick) buttons.push({ label: "이 병을 고른다", fn: () => pick(jar) });
    buttons.push({
      label: "선반에 둔다",
      fn: () => {
        open = null;
        showButtons();
      },
    });
    panel(`<div class="label-card ${jar.label.hand === "old" ? "old" : ""}">${labelText(jar.label)}</div><div class="moment"></div>`, buttons, "center");
  }
  function magnify(jar) {
    const m = pnl.querySelector(".moment");
    m.textContent = jar.moment || "……";
    m.classList.remove("show");
    void m.offsetWidth;
    m.classList.add("show");
  }
  return sc;
}

// ---------------------------------------------------------------------------------------------
// morning, the inspection, evening, night
// ---------------------------------------------------------------------------------------------
function morning() {
  S.screamsToday = 0;
  S.log = [];
  S.queue = DAYS[S.day - 1].map((v) => ({ ...v }));
  hud();
  // jars whose time ran out become the shop's
  for (const j of S.jars) if (j.pawn && !j.owned && S.day > j.pawn.dueDay) j.owned = true;
  const p = PAPERS[S.day - 1];
  let head = p.head;
  if (S.day === 3) head = S.flags.tom === "right" ? "부두 노동자 무단결근으로 해고 — \"높은 데는 못 올라가겠다\"" : "부두 크레인에서 노동자 추락 — 동료들 \"겁이라고는 없는 사람이었다\"";
  const prices = Object.entries(p.prices)
    .map(([k, v]) => `<span>${EMOTIONS[k].name} ${v}</span>`)
    .join("");
  go({
    draw(t) {
      A.drawCounter(screen.base, t);
      A.drawGrille(screen.base);
      A.drawCounterTop(screen.base, t);
    },
  });
  sfx.paper();
  panel(
    `<div class="paper">
       <div class="masthead">공장 도시 신보 · ${DATES[S.day - 1]}</div>
       <div class="headline">${esc(head)}</div>
       <div class="prices"><b>오늘의 감정 시세 (1할당 실링)</b>${prices}</div>
       ${p.news.map((n) => `<div class="news">· ${esc(n)}</div>`).join("")}
       <div class="notice">${p.notice.map((n) => `<div>${esc(n)}</div>`).join("")}</div>
     </div>`,
    [
      { label: "저장고를 둘러본다", fn: () => go(cellarScene({ title: "저장고 · 병에 마우스를 올리면 라벨이 보인다", back: () => morning() })) },
      {
        label: "가게 문을 연다",
        fn: () => {
          closePanel();
          if (S.day === 3) inspection();
          else toCounter();
        },
      },
    ],
    "paper-panel",
  );
}

// day 3: the guild inspector is coming; stains that did not vanish must be scrubbed off before he arrives
function inspection() {
  const left = () => S.perm.filter((s) => s.a > 0.05).length;
  if (!left()) return inspectorArrives();
  let timer = 25;
  let scrubAt = null;
  let sound = 0;
  go({
    enter() {
      tip("");
      say("", ["(창밖으로 조합 감독관의 마차가 보인다.)", "의자 밑에 어제의 자국이 그대로 있다."], () => {
        hideDialog();
        tip("자국 위에서 마우스를 누르고 있으면 문질러 지운다");
      });
    },
    down(x, y) {
      scrubAt = [x, y];
    },
    move(x, y) {
      if (scrubAt) scrubAt = [x, y];
    },
    up() {
      scrubAt = null;
    },
    update(dt) {
      if (talk) return;
      timer -= dt;
      if (scrubAt) {
        for (const s of S.perm) if (Math.hypot(s.x - scrubAt[0], s.y - scrubAt[1]) < 8) s.a = Math.max(0, s.a - dt * 0.4);
        sound -= dt;
        if (sound <= 0) {
          sfx.scrub();
          sound = 0.1;
        }
      }
      tip(`감독관이 오기까지 ${Math.max(0, Math.ceil(timer))}초 · 남은 자국 ${left()}개`);
      if (timer <= 0 || !left()) {
        S.perm = S.perm.filter((s) => s.a > 0.05);
        inspectorArrives();
      }
    },
    draw(t) {
      A.drawRoom(screen.base, t);
      A.drawGenerator(screen.base, 0);
      A.drawChair(screen.base);
      A.drawRoomLight(screen.base, t);
      drawPerm(screen.color);
      if (scrubAt) rect(screen.base, scrubAt[0] - 3, scrubAt[1] - 2, 6, 4, 200);
    },
  });
}

function inspectorArrives() {
  tip("");
  counter.cust = PEOPLE.inspector;
  counter.expr = "neutral";
  go(counter);
  sfx.knock();
  const stained = S.perm.length > 0;
  const lines = ["조합 감독관이오. 정기 점검이오.", "(안쪽 방으로 들어가 의자 주위를 천천히 돈다.)"];
  if (stained) {
    lines.push("(의자 밑의 자국을 오래 내려다본다.)", "이 자국은 뭐요?", "벌금 10실링이오. 다음엔 면허를 걷어 가겠소.");
    S.cash -= 10;
    S.flags.fined = true;
    note("조합 감독관에게 벌금 10실링을 냈다");
  } else lines.push("(깨끗한 바닥을 구둣발로 두드린다.)", "이상 없군. 수고하시오.");
  if (S.flags.reported === true) {
    // he does not know yet; the report reaches him later
  }
  say(PEOPLE.inspector.name, lines, () => {
    hud();
    counter.cust = null;
    hideDialog();
    setTimeout(nextVisit, 500);
  });
}

const evening = {
  enter() {
    hud();
    tip("");
    // what lapses at the end of today
    const lapsing = S.jars.filter((j) => j.pawn && !j.owned && j.pawn.dueDay <= S.day);
    let guild = "";
    const buttons = [];
    if (S.day === 3) {
      guild = `<div class="due">조합 이자 ${GUILD_DUE}실링을 낼 날이다.</div>`;
      buttons.push({
        label: S.cash >= GUILD_DUE ? `이자 ${GUILD_DUE}실링을 낸다` : "낼 돈이 없다",
        fn: () => {
          if (S.cash >= GUILD_DUE) {
            S.cash -= GUILD_DUE;
            S.flags.guild = "paid";
            sfx.coins(6);
          } else S.flags.guild = "unpaid";
          closePanel();
          go(night());
        },
      });
    } else buttons.push({ label: "가게 문을 닫는다", fn: () => (closePanel(), go(night())) });
    panel(
      `<div class="ledger">
         <div class="head">장부 · ${DATES[S.day - 1]}</div>
         ${S.log.map((l) => `<div class="row">${esc(l)}</div>`).join("") || '<div class="row">거래 없음</div>'}
         <div class="sum">남은 돈 ${S.cash}실링 · 선반의 병 ${S.jars.length}개</div>
         ${lapsing.length ? `<div class="sum">내일 아침 기한이 지나는 병: ${lapsing.map((j) => esc(j.label.no)).join(", ")}</div>` : ""}
         ${guild}
       </div>`,
      buttons,
      "paper-panel",
    );
  },
  draw(t) {
    A.drawCounter(screen.base, t);
    A.drawGrille(screen.base);
    A.drawCounterTop(screen.base, t);
  },
};

// night: the shop dark, and what only I remember
function night() {
  let ghost = 0;
  let stains = [];
  return {
    enter() {
      tip("");
      screen.dim = 0.45;
      panel(
        `<div class="night-text">가게 문을 닫았다.<br>오늘 들은 비명 ${S.screamsToday}번.<br>기억하는 사람은 나 하나다.</div>`,
        [
          {
            label: S.day < 3 ? "잠자리에 든다" : "……",
            fn: () => {
              closePanel();
              screen.dim = 1;
              if (S.day < 3) {
                S.day++;
                morning();
              } else ending();
            },
          },
        ],
        "night-panel",
      );
    },
    leave() {
      screen.dim = 1;
      if (voice.node) voice.node.cut();
    },
    update(dt, t) {
      // blood that is not there, and a scream from the back room that nobody made
      if (S.screams && Math.random() < dt * 0.8) stains.push({ x: 20 + Math.random() * 280, y: 30 + Math.random() * 140, r: 2 + Math.random() * 3, seed: Math.floor(Math.random() * 1e6), left: 0.15 + Math.random() * 0.25 });
      for (const s of stains) s.left -= dt;
      stains = stains.filter((s) => s.left > 0);
      ghost -= dt;
      if (S.screams && ghost <= 0 && Math.random() < dt * 0.15) {
        ghost = 0.5;
        if (!voice.node) voice.node = createVoice();
        voice.node.set({ f0: 420 + Math.random() * 200, loud: 0.12, vowel: 1, rough: 0.6, wobble: 15 });
        setTimeout(() => voice.node && voice.node.cut(), 260 + Math.random() * 200);
      }
    },
    draw(t) {
      A.drawCounter(screen.base, t);
      A.drawGrille(screen.base);
      A.drawCounterTop(screen.base, t, false);
      for (const s of stains) drawSplat(screen.color, s);
    },
  };
}

function ending() {
  const f = S.flags;
  const lines = [];
  lines.push(f.guild === "paid" ? "조합 이자를 냈다. 다음 주에도 낼 수 있을까." : "조합 이자를 내지 못했다. 다음 주에는 가게를 걷어 갈 것이다.");
  if (f.tom === "right") lines.push("톰은 두려움을 찾아갔고, 일자리를 잃었다.");
  else if (f.tom === "wrong") lines.push("톰은 다른 사람의 감정을 안고 크레인에 올랐다.");
  else lines.push("톰은 두려움을 찾지 못한 채 크레인에 올랐다.");
  if (f.reported) lines.push("넬리의 아버지가 조합에 고발장을 냈다.");
  if (f.fined) lines.push("감독관에게 벌금을 냈다.");
  lines.push(`사흘 동안 들은 비명 ${S.screams}번. 지워지지 않은 자국 ${S.violations}번.`);
  lines.push("서랍 속 전당표의 기한까지 사흘이 남았다.");
  go({
    draw(t) {
      A.drawCellar(screen.base);
      S.jars.forEach((j, i) => A.drawShelfJar(screen.base, screen.color, j, i, t, false));
    },
  });
  panel(
    `<div class="night-text"><div class="head">시험판은 여기까지예요</div>${lines.map((l) => `<div>${esc(l)}</div>`).join("")}</div>`,
    [{ label: "처음부터", fn: () => location.reload() }],
    "night-panel",
  );
}

// ---------------------------------------------------------------------------------------------
// input and the loop
// ---------------------------------------------------------------------------------------------
let holding = false;

function toCanvas(ev) {
  const r = view.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H];
}
view.addEventListener("mousedown", (ev) => {
  const [x, y] = toCanvas(ev);
  holding = true;
  if (scene && scene.down) scene.down(x, y, ev);
});
window.addEventListener("mouseup", () => {
  holding = false;
  if (scene && scene.up) scene.up();
});
view.addEventListener("mousemove", (ev) => {
  const [x, y] = toCanvas(ev);
  if (scene && scene.move) scene.move(x, y, ev);
});
window.addEventListener("keydown", (ev) => {
  if (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT") return;
  if (ev.code === "Space") {
    ev.preventDefault();
    if (talk) {
      if (!ev.repeat) advance();
      return;
    }
    holding = true;
  }
  if (ev.code === "Enter" && talk) advance();
});
window.addEventListener("keyup", (ev) => {
  if (ev.code === "Space") holding = false;
});

overlay.addEventListener("click", () => {
  startAudio();
  overlay.classList.add("hidden");
  morning();
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  step(dt, t);
  requestAnimationFrame(frame);
}

function step(dt, t) {
  screen.clear();
  if (scene) {
    if (scene.update) scene.update(dt, t);
    scene.draw(t, dt);
  } else {
    A.drawCounter(screen.base, t);
    A.drawGrille(screen.base);
    A.drawCounterTop(screen.base, t);
  }
  screen.present();
}

requestAnimationFrame(frame);

// dev hook for automated checks
window.__ps = {
  S,
  get scene() {
    return scene;
  },
  step,
  set holding(v) {
    holding = v;
  },
  advance,
  get talk() {
    return talk;
  },
  // jump straight into a scene for checks
  chair: (o) => go(chairScene({ done() {}, ...o })),
  counterWith: (who, expr = "neutral") => {
    counter.cust = PEOPLE[who];
    counter.expr = expr;
    go(counter);
  },
  night: () => go(night()),
};
