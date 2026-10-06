import { createScreen, W, H, rect, crect, rng } from "./screen.js?v=20261007c";
import * as A from "./art.js?v=20261007c";
import { ROOM } from "./art.js?v=20261007c";
import { createSelf3D } from "./self3d.js?v=20261007c";
import { startAudio, createGenerator, createVoice, sfx } from "./audio.js?v=20261007c";
import { EMOTIONS, DATES, DUE_DAYS, GUILD_DUE, START_JARS, PEOPLE, RESERVES, DAYS, PAPERS, SELF, SELF_PRICE, SELF_EFFECT, MASTER_NOTE, MASTER_MEMORY } from "./data.js?v=20261007c";

const $ = (id) => document.getElementById(id);
const view = $("view");
const screen = createScreen(view);
// the view from the chair when I sit in it myself is drawn in 3D on its own canvas
const S3 = createSelf3D($("view3d"));
S3.show(false);
const hudEl = $("hud");
const tipEl = $("tip");
const dlg = $("dialog");
const dName = dlg.querySelector(".name");
const dText = dlg.querySelector(".text");
const dChoices = dlg.querySelector(".choices");
const pnl = $("panel");
const labelTip = $("label-tip");
const fadeEl = $("fade");
const overlay = $("overlay");

// the build number is the cache-busting tag on this script's address, e.g. 20261006c → v2026.10.06c
{
  const tag = new URL(import.meta.url).searchParams.get("v") || "dev";
  const m = /^(\d{4})(\d{2})(\d{2})(.*)$/.exec(tag);
  $("version").textContent = m ? `v${m[1]}.${m[2]}.${m[3]}${m[4]}` : `v${tag}`;
}

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
  selfTaken: { fear: 0, guilt: 0, pity: 0 }, // tenths of my own emotions sold through the clockwork
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
// moving between rooms: the screen goes dark, the room changes, and it comes back
const FADE = 0.35; // seconds each way
let fade = null; // { k: darkness 0..1, dir: 1 darkening | -1 clearing, then: the change made at full dark }
function fadeTo(then) {
  if (fade) return;
  fade = { k: 0, dir: 1, then };
}
function stepFade(dt) {
  fade.k += (fade.dir * dt) / FADE;
  if (fade.dir > 0 && fade.k >= 1) {
    fade.k = 1;
    const then = fade.then;
    fade.then = null;
    fade.dir = -1;
    then();
  } else if (fade.dir < 0 && fade.k <= 0) fade = null;
  const k = fade ? fade.k : 0;
  fadeEl.style.opacity = String(k * k * (3 - 2 * k));
}

let scene = null;
function go(s) {
  if (scene && scene.leave) scene.leave();
  scene = s;
  labelTip.classList.add("hidden");
  if (s.enter) s.enter();
}

// --- the counter ---
let fakeStain = null; // a splash on the counter that is not there
// the rules pinned beside the grille, read by clicking the paper
const onRules = (x, y) => {
  const r = A.RULES_PAPER;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
};
function showRules() {
  sfx.paper();
  panel(
    `<div class="paper rules">
       <div class="masthead">공장 도시 전당업 조합</div>
       <div class="headline">감정 추출 규정</div>
       <div>하나. 열여섯 살 미만의 감정은 거래하지 않는다.</div>
       <div>둘. 본인의 뜻이 아닌 추출은 하지 않는다.</div>
       <div>셋. 한 감정을 바닥까지 뽑지 않는다.</div>
       <div class="notice">어긴 자의 면허는 조합이 거둔다.</div>
     </div>`,
    [{ label: "닫기", fn: closePanel }],
    "center",
  );
}

const counter = {
  cust: null,
  expr: "neutral",
  hoverRules: false,
  move(x, y) {
    this.hoverRules = onRules(x, y);
    view.style.cursor = this.hoverRules ? "pointer" : "";
  },
  down(x, y) {
    if (onRules(x, y)) showRules();
  },
  leave() {
    this.hoverRules = false;
    view.style.cursor = "";
  },
  draw(t, dt) {
    const b = screen.base;
    A.drawCounter(b, t);
    // someone stepping up to the grille rises into view
    const rise = this.arrivedAt ? Math.max(0, 1 - (t - this.arrivedAt) / 0.6) : 0;
    if (this.cust) A.drawBust(b, this.cust.look, { t, expr: this.expr, y: 112 + Math.round(rise * rise * 26) });
    A.drawGrille(b);
    A.drawCounterTop(b, t, true, this.bellAt ? t - this.bellAt : -10);
    if (this.hoverRules) A.drawGlow(screen.color, A.rulesSilhouette, t);
    // after enough screams, the counter sometimes shows blood for a few frames
    if (S.extractions >= 2 && !lacks("guilt")) {
      if (!fakeStain && Math.random() < dt / 25) fakeStain = { left: 0.12 + Math.random() * 0.1, x: 30 + Math.random() * 260, y: 116 + Math.random() * 40, seed: Math.floor(Math.random() * 1e6) };
      if (fakeStain) {
        drawSplat(screen.color, { x: fakeStain.x, y: fakeStain.y, r: 4, seed: fakeStain.seed, a: 1 });
        fakeStain.left -= dt;
        if (fakeStain.left <= 0) fakeStain = null;
      }
    }
  },
};

// --- walking the shop: the counter room in front, the back room behind it ---
// where I stand, kept between scenes; x is in the coordinates of whichever room I am in
const keeper = { x: 150, facing: 1 };
let entry = null; // { x, facing } where the room I am going into puts me
function arrive() {
  if (entry) Object.assign(keeper, entry);
  entry = null;
  return keeper;
}
const WALK = 74; // my walking speed, px a second; the customer following keeps up
const keyDir = () => (keysDown.has("KeyD") || keysDown.has("ArrowRight") ? 1 : 0) - (keysDown.has("KeyA") || keysDown.has("ArrowLeft") ? 1 : 0);
const camFor = (x, lo, hi) => Math.max(lo, Math.min(hi - W, x - W / 2));

// whoever is coming to the grille or waiting there, until I answer the bell
let arrival = null;
// a deal struck at the grille: the customer has gone round to the back door to be let in
let pending = null;
let bellAt = -10;

// time passes for the customer outside wherever I am: they come up to the grille and ring
function tickArrival(dt, t) {
  const a = arrival;
  if (!a) return;
  if (a.state === "outside") {
    a.wait -= dt;
    if (a.wait <= 0) {
      a.state = "window";
      a.at = t;
      a.ringIn = 1.5;
      sfx.steps();
    }
  } else {
    a.ringIn -= dt;
    if (a.ringIn <= 0) {
      sfx.bell();
      bellAt = t;
      a.rung++;
      a.ringIn = 9; // left waiting, they ring again
    }
  }
}
const ringing = () => arrival && arrival.rung > 0;
const bellText = () => (arrival.rung > 1 ? "딸랑, 딸랑— 손님이 다시 벨을 울린다" : "딸랑— 손님이 창구의 벨을 울렸다");

// the counter room, the grille straight ahead; the far left leads to the back room
const front = {
  me: { x: 0, facing: 1, walk: 0 },
  cam: 0,
  near: { window: false, rules: false },
  leaving: null, // whoever just stepped away from the grille, sinking out of sight
  enter() {
    hud();
    hideDialog();
    const at = arrive();
    Object.assign(this.me, { x: at.x, facing: at.facing, walk: 0 });
    this.cam = camFor(this.me.x, 0, A.FW);
  },
  leave() {
    keeper.x = this.me.x;
    keeper.facing = this.me.facing;
    tip("");
  },
  update(dt, t) {
    tickArrival(dt, t);
    const me = this.me;
    const busy = !pnl.classList.contains("hidden");
    const dir = busy ? 0 : keyDir();
    if (dir) {
      me.x += dir * WALK * dt;
      me.facing = dir;
      me.walk += dt * 11;
    } else me.walk = 0;
    this.cam += (camFor(me.x, 0, A.FW) - this.cam) * Math.min(1, dt * 6);
    if (me.x <= A.FSPOT.exit) {
      // down the passage into the back room
      return fadeTo(() => {
        entry = { x: A.RL + 16, facing: 1 };
        enterBack();
      });
    }
    if (me.x >= A.FSPOT.stairs) {
      // down the stairs to the storeroom; back up the same way
      return fadeTo(() =>
        go(
          cellarScene({
            title: "저장고 · 병에 마우스를 올리면 라벨이 보인다",
            back: () =>
              fadeTo(() => {
                entry = { x: A.FSPOT.stairs - 14, facing: -1 };
                go(front);
              }),
          }),
        ),
      );
    }
    this.near.window = Math.abs(me.x - A.FSPOT.window) < 40;
    this.near.rules = Math.abs(me.x - A.FSPOT.rules) < 14;
    if (busy) return;
    if (this.near.window && ringing()) {
      tip("E  응대한다");
      if (ePressed) serve(arrival);
    } else if (this.near.rules) {
      tip(ringing() ? `E  조합 규정을 읽는다 · ${bellText()}` : "E  조합 규정을 읽는다");
      if (ePressed) showRules();
    } else if (pending) tip("← 추출실로 간다 · 손님이 뒷문에서 기다린다");
    else if (ringing()) tip(`${bellText()} · 창구로 간다`);
    else tip("← → 이동 · ← 추출실 · → 저장고");
  },
  draw(t) {
    const b = screen.base;
    const c = screen.color;
    const cx = Math.round(this.cam);
    const a = arrival;
    let cust = null;
    if (a && a.state === "window") cust = { look: PEOPLE[a.v.who].look, expr: a.v.kind === "last" ? "sad" : "neutral", rise: Math.max(0, 1 - (t - a.at) / 0.6) };
    else if (this.leaving) {
      if (this.leaving.at === null) this.leaving.at = t;
      const k = (t - this.leaving.at) / 0.6;
      if (k < 1) cust = { look: this.leaving.look, expr: "neutral", rise: k };
      else this.leaving = null;
    }
    b.save();
    b.translate(-cx, 0);
    A.drawFront(b, t, { bellSince: t - bellAt, cust });
    A.drawWalker(b, A.KEEPER, this.me.x, this.me.facing, this.me.walk);
    b.restore();
    const glow = (paint) => A.drawGlow(c, (m) => (m.save(), m.translate(-cx, 0), paint(m), m.restore()), t);
    if (this.near.window && ringing()) glow(A.frontWindowSilhouette);
    if (this.near.rules) glow(A.frontRulesSilhouette);
  },
};

// the back room when nobody is in the chair: walk about; the far right leads back to the counter
const backRoom = {
  me: { x: 0, facing: -1, walk: 0 },
  cam: 0,
  enter() {
    hud();
    hideDialog();
    const at = arrive();
    Object.assign(this.me, { x: at.x, facing: at.facing, walk: 0 });
    this.cam = camFor(this.me.x, A.RL, A.RW);
  },
  leave() {
    keeper.x = this.me.x;
    keeper.facing = this.me.facing;
    tip("");
  },
  update(dt, t) {
    tickArrival(dt, t);
    const me = this.me;
    const dir = keyDir();
    if (dir) {
      me.x = Math.min(A.RW - 12, me.x + dir * WALK * dt);
      me.facing = dir;
      me.walk += dt * 11;
    } else me.walk = 0;
    this.cam += (camFor(me.x, A.RL, A.RW) - this.cam) * Math.min(1, dt * 6);
    if (me.x <= A.RL + 8) return toFrontFromBack();
    if (ringing()) tip(`${bellText()} · ← 창구로 간다`);
    else tip("← → 이동 · ← 끝은 창구");
  },
  draw(t) {
    const b = screen.base;
    const c = screen.color;
    const cx = Math.round(this.cam);
    b.save();
    c.save();
    b.translate(-cx, 0);
    c.translate(-cx, 0);
    A.drawRoom(b, t);
    A.drawGenerator(b, 0);
    A.drawChair(b);
    const j = ROOM.jar;
    A.drawJar(b, j.x, j.y, j.w, j.h, {});
    A.drawWalker(b, A.KEEPER, this.me.x, this.me.facing, this.me.walk);
    A.drawRoomLight(b, t);
    if (!lacks("guilt")) drawPerm(c);
    b.restore();
    c.restore();
  },
};

function enterBack() {
  if (pending) go(chairScene(pending));
  else go(backRoom);
}
function toFrontFromBack() {
  fadeTo(() => {
    entry = { x: A.FSPOT.exit + 14, facing: 1 };
    go(front);
  });
}

// a deal struck: they go round to the back door, and I go to let them in
function backDoor(o) {
  pending = o;
  front.leaving = counter.cust ? { look: counter.cust.look, at: null } : null;
  counter.cust = null;
  hideDialog();
  return front;
}

function toFront() {
  counter.cust = null;
  entry = { x: 120, facing: 1 };
  go(front);
  nextVisit();
}

// done at the grille: they step away, and the next one comes
function leaveCounter() {
  const p = counter.cust;
  counter.cust = null;
  hideDialog();
  front.leaving = p ? { look: p.look, at: null } : null;
  go(front);
  nextVisit();
}

// done in the chair: they have gone out the back door; I am still in the back room
function afterJob() {
  counter.cust = null;
  hideDialog();
  go(backRoom);
  nextVisit();
}

function nextVisit() {
  hud();
  const v = S.queue.shift();
  if (!v) {
    arrival = null;
    go(evening);
    return;
  }
  if (v.needs && !jarOf(v.needs)) return nextVisit();
  arrival = { v, state: "outside", wait: 2 + Math.random() * 2, at: 0, rung: 0, ringIn: 0 };
}

function serve(a) {
  arrival = null;
  counter.cust = PEOPLE[a.v.who];
  counter.expr = a.v.kind === "last" ? "sad" : "neutral";
  counter.arrivedAt = 0;
  go(counter);
  const run = { pawn: pawnFlow, last: pawnFlow, buy: buyFlow, redeem: redeemFlow, sell: sellFlow, blackmail: blackmailFlow }[a.v.kind];
  run(a.v);
}

const jarOf = (who) => S.jars.find((j) => j.owner === who);
const remaining = (who, emo) => (S.reserve[who] && S.reserve[who][emo]) || 0;

// --- questions at the grille: each visit has a few written questions, each asked once ---
function questionsLeft(v) {
  v.asked = v.asked || new Set();
  return (v.ask || []).filter(([q]) => !v.asked.has(q));
}

// the visit's menu: the questions left to ask, then the deal's own actions
function talkMenu(v, prompt, actions) {
  const p = PEOPLE[v.who];
  // without pity there is no reason left to turn anyone away
  if (lacks("pity")) actions = actions.filter((a) => !a.pity);
  dlg.classList.remove("hidden");
  dName.textContent = p.name;
  talk = null;
  dText.classList.remove("more");
  const conv = v.last ? `<div class="me">나: ${esc(v.last.mine)}</div><div>${esc(v.last.reply)}</div>` : "";
  dText.innerHTML = `${conv}<div class="deal">${esc(prompt)}</div>`;
  dChoices.innerHTML = "";
  for (const [q, a] of questionsLeft(v)) {
    const btn = document.createElement("button");
    btn.className = "say-line";
    btn.textContent = `“${q}”`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      sfx.click();
      v.asked.add(q);
      v.last = { mine: q, reply: a };
      talkMenu(v, prompt, actions);
    });
    dChoices.appendChild(btn);
  }
  for (const a of actions) {
    const btn = document.createElement("button");
    btn.textContent = a.label + (a.note ? `  (${a.note})` : "");
    btn.disabled = !!a.disabled;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      sfx.click();
      dChoices.innerHTML = "";
      a.fn();
    });
    dChoices.appendChild(btn);
  }
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
  talkMenu(v,
    `${emo} ${amount}할을 맡기고 ${o.loan}실링을 빌리려 한다.`,
    [
      { label: "맡는다", disabled: S.cash < o.loan, note: S.cash < o.loan ? "돈이 모자라다" : "", fn: () => interestMenu(v, amount) },
      { label: "돌려보낸다", pity: true, fn: () => refuse(v) },
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
          backDoor({
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
    leaveCounter();
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
  talkMenu(v,
    `${EMOTIONS[v.wants].name}을(를) 원한다. 1할에 ${v.price}실링.`,
    [
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
      { label: "돌려보낸다", pity: true, fn: () => refuse(v) },
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
            go(backDoor({ mode: "inject", who: v.who, emotion: jar.emotion, amount: jar.amount, done: (res) => afterChair(v, res, toCounterNext) }));
          } else {
            say(p.name, [v.after], leaveCounter);
          }
        },
      },
      { label: "다른 병을 고른다", fn: () => buyMenu(v) },
    ],
    p.name,
  );
}

// back from the chair: they have already gone out
function toCounterNext() {
  afterJob();
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
      leaveCounter();
    });
    return;
  }
  say(p.name, v.intro.concat([`(${pay}실링을 내민다)`]), () => redeemMenu(v, pay));
}

function redeemMenu(v, pay) {
  const p = PEOPLE[v.who];
  talkMenu(v,
    `${pay}실링을 내밀고 기다린다.`,
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
                  return say("", ["이건 내 것이다."], () => redeemMenu(v, pay));
                }
                S.cash += pay;
                sfx.coins(4);
                hud();
                removeJar(jar);
                const right = jar.owner === v.who;
                S.flags.tom = right ? "right" : "wrong";
                note(`${p.name}이(가) ${pay}실링을 갚고 병을 찾아갔다${right ? "" : " (다른 사람의 병)"}`);
                const after = right ? v.after : v.wrong[jar.emotion] || v.wrong.default;
                go(backDoor({ mode: "inject", who: v.who, emotion: jar.emotion, amount: jar.amount, done: (res) => afterChair({ ...v, after }, res, toCounterNext) }));
              },
              back: () => {
                go(counter);
                redeemMenu(v, pay);
              },
            }),
          );
        },
      },
    ],
    p.name,
  );
}

function sellFlow(v) {
  const p = PEOPLE[v.who];
  say(p.name, v.intro, () => sellMenu(v));
}

function sellMenu(v) {
  const p = PEOPLE[v.who];
  const o = v.offer;
  talkMenu(v,
    `${PEOPLE[v.sitter].name}의 ${EMOTIONS[o.emotion].name} ${o.amount}할을 ${o.price}실링에 사 달라고 한다.`,
    [
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
            backDoor({
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
      { label: "거절한다", pity: true, fn: () => refuse(v) },
    ],
    p.name,
  );
}

function blackmailFlow(v) {
  const p = PEOPLE[v.who];
  say(p.name, v.intro, () => blackmailMenu(v));
}

function blackmailMenu(v) {
  const p = PEOPLE[v.who];
  talkMenu(v,
    "병을 넘기라고 한다.",
    [
      {
        label: "병을 넘긴다",
        fn: () => {
          removeJar(jarOf(v.needs));
          note(`넬리의 병을 아버지에게 넘겼다`);
          say(p.name, [v.give], () => {
            leaveCounter();
          });
        },
      },
      {
        label: "거절한다",
        fn: () => {
          S.flags.reported = true;
          note(`넬리의 아버지를 돌려보냈다`);
          say(p.name, [v.refuse], () => {
            leaveCounter();
          });
        },
      },
    ],
    p.name,
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
  if (lacks("guilt")) return; // without guilt I do not see them; the inspector still does
  for (const s of S.perm) drawSplat(c, s);
}

// mode "extract": hold to crank, the emotion leaves through the tube and the blood stays where it lands
// until the cranking stops. mode "inject": hold to push a jar back in; no blood, the emotion swells.
// how many 할 a second the chair moves: taking out is slow enough to be felt; putting back in is quick
const EXTRACT_RATE = 0.47;
const INJECT_RATE = 1.1; // a customer's jar, pushed back by the generator
const SELF_INJECT_RATE = 0.9; // my own jar, the clockwork running down

function chairScene(o) {
  const look = PEOPLE[o.who].look;
  const injecting = o.mode === "inject";
  const reserve = injecting ? Infinity : remaining(o.who, o.emotion);
  const st = {
    phase: "walk", // walk → seating → strap → ready → running → after → leave → done
    timer: 0,
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
  // I come in by the passage; the customer waits outside the yard door until I let them in,
  // then keeps a step behind me
  const at = arrive();
  const me = { x: at.x, facing: at.facing, walk: 0 };
  const guest = { x: A.SPOTS.backdoor, facing: -1, walk: 0, state: o.outside === false ? "follow" : "outside" };
  if (guest.state === "outside") st.phase = "door";
  let cam = camFor(me.x, A.RL, A.RW);
  let doorOpen = 0;
  let handle = [56, 92];
  const near = { chair: false, crank: false, crankZone: false, door: false };

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
    tip("");
    if (!injecting) {
      S.reserve[o.who][o.emotion] = round1(reserve - st.taken);
      S.extractions++;
    }
  }

  function moveToward(p, x, speed, dt) {
    const d = x - p.x;
    if (Math.abs(d) < 1) {
      p.walk = 0;
      return true;
    }
    const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    p.x += step;
    p.facing = Math.sign(d);
    p.walk += dt * 11;
    return false;
  }

  function walking(dt) {
    near.crank = Math.abs(me.x - A.SPOTS.crank) < 14;
    near.crankZone = Math.abs(me.x - A.SPOTS.crank) < 28;
    near.chair = Math.abs(me.x - A.SPOTS.chair) < 26 && Math.abs(guest.x - me.x) < 44;
    near.door = Math.abs(me.x - A.SPOTS.backdoor) < 18;
    const cranking = (st.phase === "ready" || st.phase === "running") && near.crank && (holding || keysDown.has("KeyE"));
    const free = !cranking && st.phase !== "after" && st.phase !== "leave" && st.phase !== "done";
    const dir = free ? (keysDown.has("KeyD") || keysDown.has("ArrowRight") ? 1 : 0) - (keysDown.has("KeyA") || keysDown.has("ArrowLeft") ? 1 : 0) : 0;
    if (dir) {
      // with someone inside I stay in here; before that I can still go back to the counter
      me.x = Math.min(A.RW - 12, Math.max(st.phase === "door" ? A.RL : A.RL + 14, me.x + dir * WALK * dt));
      me.facing = dir;
      me.walk += dt * 11;
    } else me.walk = 0;
    if (cranking) me.x = A.SPOTS.crank;
    if (near.crank && !dir && (st.phase === "ready" || st.phase === "running")) me.facing = 1;
    // the customer
    if (guest.state === "follow") {
      const behind = me.x - me.facing * 22;
      if (Math.abs(guest.x - behind) > 3) moveToward(guest, behind, WALK + 4, dt);
      else {
        guest.walk = 0;
        guest.facing = Math.sign(me.x - guest.x) || guest.facing;
      }
    } else if (guest.state === "toChair") {
      if (moveToward(guest, A.SPOTS.seat, 50, dt)) {
        guest.state = "seated";
        st.phase = "strap";
        st.timer = 0.9;
        sfx.strap();
      }
    } else if (guest.state === "leave") {
      // out the way they came, by the back door
      doorOpen = Math.min(1, doorOpen + dt * 3);
      if (moveToward(guest, A.SPOTS.backdoor, 58, dt)) {
        guest.state = "gone";
        st.phase = "done";
        sfx.knock();
        o.done({ amount: round1(st.taken) });
      }
    }
    if (guest.state !== "leave") doorOpen = Math.max(0, doorOpen - dt * (guest.state === "outside" ? 3 : 0.8));
    cam += (camFor(me.x, A.RL, A.RW) - cam) * Math.min(1, dt * 6);
    return cranking;
  }

  const sc = {
    me,
    enter() {
      hud();
      tip("");
      if (!generator.node) generator.node = createGenerator();
      if (!voice.node) voice.node = createVoice();
    },
    leave() {
      generator.node.cut();
      voice.node.cut();
      holding = false;
      keeper.x = me.x;
      keeper.facing = me.facing;
    },
    update(dt, t) {
      const cranking = walking(dt);
      if (st.phase === "door") {
        if (me.x <= A.RL + 8) return toFrontFromBack();
        if (near.door) {
          tip("E  뒷문을 열고 손님을 들인다");
          if (ePressed) {
            // they come in off the alley and fall in behind me
            pending = null;
            doorOpen = 1;
            sfx.steps();
            guest.state = "follow";
            st.phase = "walk";
          }
        } else tip("→ 뒷문으로 간다 · 손님이 기다린다");
        return;
      }
      if (st.phase === "walk") {
        if (near.chair) {
          tip("E  손님을 의자에 앉힌다");
          if (ePressed) {
            guest.state = "toChair";
            st.phase = "seating";
            tip("");
          }
        } else tip("← → 이동 · 손님을 추출 의자로 데려간다");
        return;
      }
      if (st.phase === "seating") return;
      if (st.phase === "strap") {
        st.timer -= dt;
        if (st.timer <= 0) st.phase = "ready";
        return;
      }
      if (st.phase === "ready") {
        if (near.crank) tip(injecting ? "E·Space 누르고 있기: 발전기를 거꾸로 돌린다" : "E·Space 누르고 있기: 발전기를 돌린다 · 떼면 멈춘다");
        else tip("← 발전기로 간다");
      }
      if (st.phase === "after") {
        st.timer -= dt;
        if (st.timer <= 0) {
          // they get up, thank me, and see themselves out
          st.phase = "leave";
          guest.state = "leave";
          sfx.strap();
          tip("");
        }
        return;
      }
      if (st.phase === "leave" || st.phase === "done") return;

      const on = cranking;
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
        if (on) st.level = Math.max(0, st.level - dt * INJECT_RATE);
        if (on && Math.random() < dt * 40) st.gas.push({ s: TUBE.total, v: -110 });
        injectVoice(t);
        if (o.emotion === "grief" && on) {
          for (let k = 0; k < 3; k++) if (Math.random() < dt * 30 * st.intensity) st.tears.push({ from: true, vx: -10 - Math.random() * 50, vy: -20 + Math.random() * 30 });
        }
        if (st.level <= 0) finish();
      } else {
        if (on && st.taken < reserve) st.taken = Math.min(reserve, st.taken + dt * EXTRACT_RATE * st.speed);
        st.level = st.taken;
        const left = (reserve - st.taken) / reserve;
        const flow = st.taken >= reserve ? 0 : left < 0.3 && !lacks("fear") ? left / 0.3 : 1;
        if (on && Math.random() < dt * 60 * flow) st.gas.push({ s: 0, v: 100 + Math.random() * 30, thin: flow < 0.6 });
        if (on) st.faceBlood = Math.min(1, st.faceBlood + dt * 0.18);
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
        // without fear I no longer hear the scream break as it nears the bottom
        if (lacks("fear")) extractVoice(t, 1, false);
        else extractVoice(t, left, st.taken >= reserve);
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
      st.drops = st.drops.filter((d) => !d.dead && d.x > -5 && d.x < A.RW + 5);
      if (st.splats.length > 700) st.splats.splice(0, st.splats.length - 700);
    },
    draw(t) {
      const b = screen.base;
      const c = screen.color;
      const cx = Math.round(cam);
      b.save();
      c.save();
      b.translate(-cx, 0);
      c.translate(-cx, 0);
      A.drawRoom(b, t, 0, doorOpen);
      handle = A.drawGenerator(b, st.angle);
      A.drawChair(b);
      const running = st.phase === "running";
      const seated = guest.state === "seated";
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
      const head = seated ? A.drawSitter(b, look, pose, t) : { hx: 0, hy: 0 };
      if (!seated && guest.state !== "gone" && guest.state !== "outside") A.drawWalker(b, look, guest.x, guest.facing, guest.walk, { expr: st.phase === "leave" ? "smile" : "neutral" });
      const crankingNow = near.crank && (st.phase === "ready" || st.phase === "running");
      A.drawWalker(b, A.KEEPER, me.x, me.facing, me.walk, { armTo: crankingNow ? handle : null });
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
      if (seated && !injecting && st.faceBlood > 0) {
        // streams running down from the nose and the eye
        const len = Math.floor(st.faceBlood * 22);
        crect(c, head.hx - 10, head.hy + 3, 1, len, [140, 12, 14]);
        crect(c, head.hx - 6, head.hy - 1, 1, Math.floor(len * 0.6), [150, 14, 16]);
        crect(c, head.hx + 2, head.hy + 1, 1, Math.floor(len * 0.4), [130, 10, 12]);
      }
      if (running && injecting) drawSwell(c, head, t);
      b.restore();
      c.restore();
      // whatever I can use from where I stand glows along its outline
      const glow = (paint) => A.drawGlow(c, (m) => (m.save(), m.translate(-cx, 0), paint(m), m.restore()), t);
      if (st.phase === "walk" && near.chair) glow(A.chairSilhouette);
      if (st.phase === "door" && near.door) glow(A.backDoorSilhouette);
      if (st.phase === "ready" && near.crankZone) glow(A.generatorSilhouette);
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
      view.style.cursor = "";
    },
    move(x, y, ev) {
      if (open) return;
      hover = -1;
      S.jars.forEach((j, i) => {
        const s = A.shelfSlot(i);
        if (x >= s.x - 3 && x <= s.x + s.w + 3 && y >= s.y - 6 && y <= s.y + s.h + 2) hover = i;
      });
      view.style.cursor = hover >= 0 ? "pointer" : "";
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
    else if (jar.self && back) buttons.push({ label: "내게 다시 넣는다", fn: () => reinjectSelf(jar, back) });
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
          else toFront();
        },
      },
    ],
    "paper-panel",
  );
}

// day 3: the guild inspector is coming; stains that did not vanish must be scrubbed off before he arrives
function inspection() {
  const left = () => S.perm.filter((s) => s.a > 0.05).length;
  if (!left() || lacks("guilt")) return inspectorArrives();
  let timer = 25;
  let scrubAt = null;
  let hoverAt = null;
  let sound = 0;
  const stainNear = (x, y) => S.perm.find((s) => s.a > 0.05 && Math.hypot(s.x - x, s.y - y) < 8);
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
      hoverAt = [x, y];
      if (scrubAt) scrubAt = [x, y];
      view.style.cursor = stainNear(x, y) ? "pointer" : "";
    },
    leave() {
      view.style.cursor = "";
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
      const near = hoverAt && stainNear(hoverAt[0], hoverAt[1]);
      if (near) A.drawGlow(screen.color, (m) => drawSplat(m, { ...near, a: 1 }), t);
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
    leaveCounter();
  });
}

const evening = {
  enter() {
    hud();
    tip("");
    hideDialog();
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
    buttons.unshift({ label: "태엽 장치로 내 감정을 뽑는다", fn: () => selfPawn(() => go(evening)) });
    for (const j of S.jars.filter((x) => x.self)) {
      const pay = Math.round(j.amount * SELF_PRICE);
      buttons.unshift({
        label: `내 ${EMOTIONS[j.emotion].name} ${j.amount}할을 조합에 넘긴다 (${pay}실링)`,
        fn: () => {
          removeJar(j);
          S.cash += pay;
          sfx.coins(5);
          note(`내 ${EMOTIONS[j.emotion].name} ${j.amount}할을 조합에 넘기고 ${pay}실링을 받았다`);
          go(evening);
        },
      });
    }
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
      if (lacks("guilt")) return; // nothing haunts a keeper who has sold his guilt
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

// the last night: the ticket in the drawer, then how the three days ended
function ending() {
  const mine = S.jars.find((j) => j.mine);
  go({
    draw(t) {
      A.drawCellar(screen.base);
      S.jars.forEach((j, i) => A.drawShelfJar(screen.base, screen.color, j, i, t, false));
    },
  });
  if (!mine) return summary();
  sfx.paper();
  panel(
    `<div class="night-text">
       <div class="head">서랍 속 전당표</div>
       <div>No. 0301 · (내 이름) · 슬픔 · 대상: 스승 · 7할</div>
       <div>스승이 죽던 날 이 가게에 맡겼다. 그날 무슨 일이 있었는지는 이 병 안에 있다.</div>
     </div>`,
    [
      {
        label: "내 슬픔을 찾아온다",
        fn: () => {
          closePanel();
          removeJar(mine);
          S.flags.grief = true;
          go(selfChairScene({ mode: "inject", emotion: "grief", turns: 7, done: () => say("", MASTER_MEMORY, () => (hideDialog(), summary())) }));
        },
      },
      { label: "서랍을 닫는다", fn: () => (closePanel(), summary()) },
    ],
    "night-panel",
  );
}

function summary() {
  const f = S.flags;
  const lines = [];
  lines.push(f.guild === "paid" ? "조합 이자를 냈다. 다음 주에도 낼 수 있을까." : "조합 이자를 내지 못했다. 다음 주에는 가게를 걷어 갈 것이다.");
  if (f.tom === "right") lines.push("톰은 두려움을 찾아갔고, 일자리를 잃었다.");
  else if (f.tom === "wrong") lines.push("톰은 다른 사람의 감정을 안고 크레인에 올랐다.");
  else lines.push("톰은 두려움을 찾지 못한 채 크레인에 올랐다.");
  if (f.reported) lines.push("넬리의 아버지가 조합에 고발장을 냈다.");
  if (f.fined) lines.push("감독관에게 벌금을 냈다.");
  const sold = Object.entries(S.selfTaken).filter(([, v]) => v > 0);
  if (sold.length) lines.push(`나는 내 ${sold.map(([k, v]) => `${SELF[k].name} ${v}할`).join(", ")}을 잃은 채다.`);
  lines.push(`사흘 동안 들은 비명 ${S.screams}번. 지워지지 않은 자국 ${S.violations}번.`);
  lines.push(f.grief ? "스승이 어떻게 죽었는지 기억해 냈다." : "서랍 속 전당표의 기한까지 사흘이 남았다.");
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
// my own emotions: the old master's clockwork lets me sit in the chair alone
// ---------------------------------------------------------------------------------------------
const lacks = (e) => S.selfTaken[e] >= SELF_EFFECT;

const SELF_TUBE = (() => {
  const pts = [[A.ROOM_SELF.tube[0][0], A.ROOM_SELF.tube[0][1]], ...A.ROOM_SELF.tube.map((s) => [s[2], s[3]])];
  const seg = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    seg.push({ a: pts[i], b: pts[i + 1], l, start: total });
    total += l;
  }
  return { seg, total };
})();
function selfTubeAt(s) {
  for (const g of SELF_TUBE.seg) {
    if (s <= g.start + g.l) {
      const k = (s - g.start) / g.l;
      return [g.a[0] + (g.b[0] - g.a[0]) * k, g.a[1] + (g.b[1] - g.a[1]) * k];
    }
  }
  return SELF_TUBE.seg[SELF_TUBE.seg.length - 1].b;
}

function selfPawn(back) {
  // the first time, the master's note is lying in the box
  if (!S.flags.note) {
    S.flags.note = true;
    sfx.paper();
    panel(`<div class="paper note">${MASTER_NOTE.map((l) => `<div>${esc(l)}</div>`).join("")}</div>`, [{ label: "수첩을 덮는다", fn: () => selfPawn(back) }], "paper-panel");
    return;
  }
  const rows = Object.entries(SELF).map(([k, e]) => ({
    label: `${e.name}${S.selfTaken[k] ? `  (이미 ${S.selfTaken[k]}할 맡김)` : ""}`,
    disabled: S.selfTaken[k] >= e.reserve,
    fn: () => {
      closePanel();
      fadeTo(() => go(selfRoomScene(k, () => fadeTo(() => go(evening)))));
    },
  }));
  panel(
    `<div class="ledger">
       <div class="head">태엽 장치</div>
       <div class="row">무엇을 맡길까. 조합이 1할에 ${SELF_PRICE}실링씩 쳐 준다.</div>
       <div class="row">내 안에 얼마나 남았는지는 아무도 모른다.</div>
     </div>`,
    [...rows, { label: "그만둔다", fn: back }],
    "paper-panel",
  );
}

// alone in the back room: I walk to the clockwork and wind it a turn at a time, sit down and strap my
// wrists, and pull the lever. From there it is my own eyes, and it does not stop.
const CLOCK_X = 99;

function selfRoomScene(e, back) {
  // in by the passage at the left edge; walking back out that way gives it up
  const me = { x: A.RL + 16, facing: 1, walk: 0 };
  let cam = camFor(me.x, A.RL, A.RW);
  let turns = 0;
  let seated = false;
  let windAngle = 0;
  let spin = 0;
  const near = { clock: false, chair: false };

  return {
    enter() {
      hideDialog();
      hud();
    },
    leave() {
      tip("");
    },
    update(dt) {
      near.clock = !seated && Math.abs(me.x - CLOCK_X) < 20;
      near.chair = !seated && Math.abs(me.x - A.SPOTS.chair) < 22;
      if (!seated) {
        const dir = keyDir();
        if (dir) {
          me.x = Math.min(A.RW - 12, me.x + dir * WALK * dt);
          me.facing = dir;
          me.walk += dt * 11;
        } else me.walk = 0;
      }
      cam += (camFor(me.x, A.RL, A.RW) - cam) * Math.min(1, dt * 6);
      if (me.x <= A.RL + 8) return back();
      if (spin > 0) {
        spin -= dt;
        windAngle += dt * 9;
      }
      const wound = turns ? `${turns}바퀴 (${SELF[e].name} ${turns}할)` : "";
      if (near.clock) {
        tip(turns >= 10 ? `더는 감기지 않는다 · ${wound}` : `E  태엽을 한 바퀴 감는다${wound ? " · " + wound : ""}`);
        if (ePressed && turns < 10) {
          turns++;
          spin = 0.35;
          sfx.crankTick();
          setTimeout(() => sfx.crankTick(), 120);
        }
      } else if (near.chair && turns > 0) {
        tip(`E  의자에 앉아 손목을 묶는다 · ${wound}`);
        if (ePressed) go(selfChairScene({ mode: "extract", emotion: e, turns, done: (taken) => afterSelf(e, taken) }));
      } else if (me.x < A.SPOTS.door + 20) tip(turns ? `← 그만두고 돌아간다 · ${wound}` : "→ 태엽 장치로 간다 · ← 돌아간다");
      else tip(turns ? `← → 이동 · 의자에 앉는다 · ${wound}` : "← → 이동 · 태엽 장치로 간다");
    },
    draw(t) {
      const b = screen.base;
      const c = screen.color;
      const cx = Math.round(cam);
      b.save();
      c.save();
      b.translate(-cx, 0);
      c.translate(-cx, 0);
      A.drawRoom(b, t, windAngle);
      A.drawGenerator(b, 0);
      A.drawChair(b);
      if (seated) A.drawSitter(b, A.KEEPER, { shake: 0, scream: 0, back: 0, face: "calm" }, t);
      else A.drawWalker(b, A.KEEPER, me.x, me.facing, me.walk);
      const j = ROOM.jar;
      A.drawJar(b, j.x, j.y, j.w, j.h, { target: turns || null });
      A.drawRoomLight(b, t);
      drawPerm(c);
      b.restore();
      c.restore();
      const glow = (paint) => A.drawGlow(c, (m) => (m.save(), m.translate(-cx, 0), paint(m), m.restore()), t);
      if (near.clock) glow(A.clockworkSilhouette);
      if (near.chair && turns > 0) glow(A.chairSilhouette);
    },
  };
}

function afterSelf(e, taken) {
  const amount = round1(taken);
  S.selfTaken[e] = round1(S.selfTaken[e] + amount);
  if (amount > 0) {
    S.jars.push({
      id: ++uid,
      emotion: e,
      amount,
      owned: true,
      self: true,
      owner: "me",
      moment: "의자의 가죽 끈, 혼자 돌아가는 태엽. 비명을 지르는 목소리가 내 것이다.",
      label: { no: String(S.ticket++).padStart(4, "0"), name: "(내 이름)", emotion: SELF[e].name, object: "", amount: `${Math.max(1, Math.round(amount))}할`, date: dateOf(S.day), due: "", loan: "", rate: "", memo: "태엽 장치로 직접 뽑음", hand: "mine" },
    });
    sfx.glass();
  }
  note(`내 ${SELF[e].name} ${amount}할을 뽑아 저장고에 두었다`);
  hideDialog();
  go(evening);
}

// my own jar back into me: the lack it left goes too
function reinjectSelf(jar, back) {
  closePanel();
  go(
    selfChairScene({
      mode: "inject",
      emotion: jar.emotion,
      turns: jar.amount,
      done: () => {
        S.selfTaken[jar.emotion] = Math.max(0, round1(S.selfTaken[jar.emotion] - jar.amount));
        removeJar(jar);
        note(`내 ${EMOTIONS[jar.emotion].name} ${jar.amount}할을 다시 내게 넣었다`);
        back();
      },
    }),
  );
}

// strapped in, seen from my own eyes. mode "extract": the clockwork runs down and nobody can stop it;
// mode "inject": something of mine coming back
function selfChairScene(o) {
  const injecting = o.mode === "inject";
  const reserve = injecting ? Infinity : SELF[o.emotion].reserve - S.selfTaken[o.emotion];
  const emo = EMOTIONS[o.emotion];
  const st = { phase: "strap", timer: 1.2, wind: o.turns, taken: 0, level: injecting ? o.turns : 0, angle: 0, intensity: 0, blood: 0, splats: [], tears: [], gas: [], tick: 0 };

  function finish() {
    generator.node.cut();
    voice.node.cut();
    if (!injecting && st.taken >= reserve - 0.01) {
      // everything gone: under my own chair too, a stain that does not go
      S.violations++;
      S.perm.push({ x: ROOM.chairX + 16, y: ROOM.floor + 5, r: 3, seed: Math.floor(Math.random() * 1e6), flat: true, a: 1 });
    }
    st.splats = [];
    st.tears = [];
    st.gas = [];
    st.blood = 0;
    S3.clear();
    st.intensity = 0;
    st.phase = "after";
    st.timer = 1.6;
    tip("");
  }

  return {
    enter() {
      hideDialog();
      S3.clear();
      S3.show(true);
      if (!generator.node) generator.node = createGenerator();
      if (!voice.node) voice.node = createVoice();
      if (o.autostart) {
        st.phase = "running";
        tip("");
        sfx.click();
        if (!injecting) {
          S.screams++;
          S.screamsToday++;
        }
        return;
      }
      sfx.strap();
      tip(injecting ? "" : "손목을 묶었다");
    },
    leave() {
      generator.node.cut();
      voice.node.cut();
      holding = false;
      S3.show(false);
    },
    update(dt, t) {
      if (st.phase === "strap") {
        st.timer -= dt;
        if (st.timer <= 0) {
          st.phase = "ready";
          tip(injecting ? "E·Space  레버를 당긴다" : `E·Space  태엽을 푼다 · 다 풀릴 때까지 멈출 수 없다 · ${o.turns}바퀴`);
        }
        return;
      }
      if (st.phase === "ready") {
        if (holding || ePressed) {
          st.phase = "running";
          tip("");
          sfx.click();
          if (!injecting) {
            S.screams++;
            S.screamsToday++;
          }
        }
        return;
      }
      if (st.phase === "after") {
        st.timer -= dt;
        if (st.timer <= 0) {
          st.phase = "done";
          sfx.strap();
          if (injecting) o.done(st.taken);
          else say("", ["……", "아무렇지도 않다."], () => o.done(st.taken));
        }
        return;
      }
      if (st.phase !== "running") return;

      // the spring runs down at its own pace; holding or letting go changes nothing now
      st.wind = Math.max(0, st.wind - dt * (injecting ? SELF_INJECT_RATE : EXTRACT_RATE));
      st.angle += dt * 6;
      st.tick += dt * 6;
      if (st.tick > Math.PI / 2) {
        st.tick = 0;
        sfx.crankTick();
      }
      generator.node.set(1);
      st.intensity = Math.min(1, st.intensity + dt * 2);
      if (injecting) {
        st.level = Math.max(0, st.level - dt * SELF_INJECT_RATE);
        if (Math.random() < dt * 40) st.gas.push({ s: SELF_TUBE.total, v: -110 });
        // fear comes back as shaking and a thin high whine; the rest come back as weeping
        if (o.emotion === "fear") {
          voice.node.set({ f0: 320 + Math.sin(t * 23) * 30 + (Math.random() - 0.5) * 30, loud: st.intensity * 0.8, vowel: 0.6, rough: 0.7, wobble: 18 });
        } else {
          if (Math.random() < dt * 30) st.tears.push({ x: 40 + Math.random() * (W - 80), y: -4, vy: 40 + Math.random() * 60, len: 4 + Math.random() * 10 });
          const sob = Math.sin(t * Math.PI * 2 * 1.6) > -0.2 ? 1 : 0.25;
          voice.node.set({ f0: 210 + Math.sin(t * 1.3) * 40, loud: st.intensity * sob, vowel: 0.25, rough: 0.4, wobble: 9 });
        }
      } else {
        if (st.taken < reserve) st.taken = Math.min(reserve, st.taken + dt * EXTRACT_RATE);
        st.level = st.taken;
        const flow = st.taken >= reserve ? 0 : 1;
        if (Math.random() < dt * 60 * flow) st.gas.push({ s: 0, v: 100 + Math.random() * 30 });
        st.blood = Math.min(1, st.blood + dt * 0.15);
        // my blood on my own hands and on everything I can see
        if (Math.random() < dt * 14) {
          const onHand = Math.random() < 0.4;
          const x = onHand ? (Math.random() < 0.5 ? 70 + Math.random() * 30 : W - 100 + Math.random() * 30) : Math.random() * W;
          const y = onHand ? 140 + Math.random() * 18 : Math.random() < 0.5 ? Math.random() * 60 : 60 + Math.random() * 100;
          st.splats.push({ x, y, r: 1 + Math.random() * 4, seed: Math.floor(Math.random() * 1e6), born: t, drip: 0 });
        }
        for (const s of st.splats) s.drip = Math.min(14, Math.floor((t - s.born) * 7));
        const empty = st.taken >= reserve;
        const gate = empty ? (Math.sin(t * Math.PI * 2 * 6.5) > 0 ? 1 : 0.12) : 1;
        voice.node.set({ f0: empty ? 170 + Math.random() * 50 : 230 + st.intensity * 200 + (Math.random() - 0.5) * 40, loud: st.intensity * gate, vowel: 1, rough: empty ? 1 : 0.6, wobble: 12 });
      }
      for (const g of st.gas) g.s += g.v * dt;
      st.gas = st.gas.filter((g) => g.s >= 0 && g.s <= SELF_TUBE.total);
      for (const tr of st.tears) tr.y += tr.vy * dt;
      st.tears = st.tears.filter((tr) => tr.y < H);
      if (st.wind <= 0) finish();
    },
    draw(t, dt = 1 / 60) {
      // seen in 3D, kept flat; the 2D layers stay empty underneath
      const running = st.phase === "running";
      S3.update(dt, t, {
        angle: st.angle,
        hands: running ? st.intensity : 0,
        shake: running ? st.intensity * (injecting && o.emotion !== "fear" ? 0.4 : 1) : 0,
        level: st.level,
        emotionColor: emo.color,
        gas: st.gas.map((g) => ({ u: Math.max(0, Math.min(1, g.s / SELF_TUBE.total)) })),
        bleeding: running && !injecting,
        blood: st.blood,
        flood: injecting && running ? st.intensity : 0,
        tears: o.emotion !== "fear",
        running,
      });
      S3.render();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// input and the loop
// ---------------------------------------------------------------------------------------------
let holding = false;
const keysDown = new Set();
let ePressed = false; // E went down since the last frame

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
  keysDown.add(ev.code);
  if (ev.code === "KeyE" && !ev.repeat) ePressed = true;
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
  keysDown.delete(ev.code);
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
  if (fade) stepFade(dt);
  if (scene) {
    if (scene.update && !fade) scene.update(dt, t);
    ePressed = false;
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
  screen, // the grey scene layer and the colour layer, for exporting pictures
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
  selfChair: (o) => go(selfChairScene({ done() {}, ...o })),
  evening: () => go(evening),
  front: () => toFront(),
  get arrival() {
    return arrival;
  },
  ending: () => ending(),
};
