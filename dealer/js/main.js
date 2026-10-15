// 「딜러」 prototype: one blackjack table, three nights. I deal; the customers play by their own
// habits; I can peek, deal seconds and false-shuffle to move the house's money, while the whale's
// mood, every watcher's suspicion and the ceiling camera push back.

import * as A from "./art.js?v=20261015f";
import { HANDS_PER_NIGHT, NIGHTS, TYPES, ACCUSE, NIGHT_PLAN, BOSS, SHOP } from "./data.js?v=20261015f";
import { startAudio, sfx } from "./audio.js?v=20261015f";

const $ = (id) => document.getElementById(id);
const view = $("view");
view.width = A.W;
view.height = A.H;
const ctx = view.getContext("2d");
ctx.imageSmoothingEnabled = false;
const hudEl = $("hud");
const tipEl = $("tip");
const pnl = $("panel");
const mgrBar = $("mgr-fill");
const bubbles = [0, 1, 2].map((i) => $(`b${i}`));
const dealerBubble = $("bd");

// speech bubbles sit above and to the right of each head, growing upward
A.SEAT_X.forEach((x, i) => {
  const headTop = A.arcY(x) + 2 - 46 - 14;
  bubbles[i].style.left = `${((x + 12) / A.W) * 100}%`;
  bubbles[i].style.bottom = `${((A.H - headTop) / A.H) * 100}%`;
});

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------------------------
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["s", "h", "d", "c"];
const DECKS = 3;
const RESHUFFLE_AT = 40;

function newShoe() {
  const s = [];
  for (let d = 0; d < DECKS; d++) for (const r of RANKS) for (const su of SUITS) s.push({ r, s: su });
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}
const cardValue = (c) => (c.r === "A" ? 11 : ["10", "J", "Q", "K"].includes(c.r) ? 10 : Number(c.r));
function handTotal(cards) {
  let t = 0;
  let aces = 0;
  for (const { c } of cards) {
    t += cardValue(c);
    if (c.r === "A") aces++;
  }
  while (t > 21 && aces) {
    t -= 10;
    aces--;
  }
  return { t, soft: aces > 0 };
}
const isBlackjack = (cards) => cards.length === 2 && handTotal(cards).t === 21;
const hiLo = (c) => (cardValue(c) <= 6 ? 1 : cardValue(c) >= 10 ? -1 : 0);

// ---------------------------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------------------------
const S = {
  night: 1,
  hand: 0,
  quota: 0,
  take: 0,
  wallet: 0,
  misses: 0,
  carry: 0, // a shortfall owed from an earlier night, added to the next quota
  mgr: 0, // the floor manager's suspicion; it stays from night to night
  owned: new Set(),
  seats: [null, null, null],
  arrivals: [],
  shoe: [],
  dealer: [],
  phase: "title",
  queue: [],
  after: null,
  turn: -1,
  timer: 0,
  peek: null,
  stack: false,
  sleeveUsed: false,
  trick: null,
  waitT: 0,
  camOffset: 0,
  time: 0,
  floats: [],
  trickedThisHand: false,
  mgrX: 60,
  mgrDir: 1,
};

const owns = (id) => S.owned.has(id);
const cameraOn = () => {
  const period = 10;
  const on = owns("bribe") ? 2 : 4;
  return (S.time + S.camOffset) % period < on;
};
const customers = () => S.seats.filter(Boolean);
const shoeTop = () => S.shoe[S.shoe.length - 1];

// ---------------------------------------------------------------------------------------------
// customers
// ---------------------------------------------------------------------------------------------
const HAIR = ["#2a2420", "#5a3a22", "#8a6a3a", "#1a1a1a", "#b08850"];
const SKIN = ["#e0b48e", "#c99872", "#a8784e", "#ecc8a4"];
const SHIRT = ["#2d7a8a", "#c8642a", "#7a3d8a", "#3a7a3a"];

function makeCustomer(type) {
  const T = TYPES[type];
  let look;
  if (type === "whale") look = { skin: "#d9a882", hair: "#d8d2c4", coat: "#e4ddcb", shirt: "#2a2a2a", tie: "#8a1c1c", chain: true, cigar: true, big: true, mustache: true };
  else if (type === "counter") look = { skin: pick(SKIN), hair: "#2a2420", coat: "#4a4c52", shirt: "#d8d2c4", tie: "#2a3a5a", glasses: true };
  else if (type === "cop") look = { skin: pick(SKIN), hair: "#2a2420", coat: pick(SHIRT), pattern: "#f0d070", mustache: true };
  else look = { skin: pick(SKIN), hair: pick(HAIR), coat: pick(SHIRT), pattern: "#f0d070", shades: Math.random() < 0.5 };
  return {
    type,
    look,
    bank: T.bank,
    bet: 0,
    cards: [],
    susp: 0,
    mood: 70,
    gaze: "cards",
    side: Math.random() < 0.5 ? -1 : 1,
    gazeT: 0,
    count: 0,
    confused: false,
    losses: 0,
    played: 0,
    maxHands: type === "tourist" ? 5 + Math.floor(Math.random() * 4) : 99,
    leaving: false,
    praised: false,
    idleT: 3 + Math.random() * 6,
  };
}

function say(i, text, dur = 2.6) {
  const b = i === "D" ? dealerBubble : bubbles[i];
  if (!b) return;
  b.textContent = text;
  b.classList.remove("hidden");
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.add("hidden"), dur * 1000);
}

function seatIndex(cu) {
  return S.seats.indexOf(cu);
}

function leave(cu, line) {
  const i = seatIndex(cu);
  if (i < 0) return;
  if (line) say(i, line);
  S.seats[i] = null;
}

function fillSeats() {
  for (let i = 0; i < 3; i++) {
    if (S.seats[i]) continue;
    let type = S.arrivals.shift();
    if (!type && Math.random() < 0.5) type = "tourist";
    if (!type) continue;
    const cu = makeCustomer(type);
    S.seats[i] = cu;
    say(i, pick(TYPES[type].lines.sit));
  }
}

function updateGaze(dt) {
  for (const cu of customers()) {
    cu.gazeT -= dt;
    if (cu.gazeT <= 0) {
      const g = TYPES[cu.type].gaze;
      const r = Math.random();
      cu.gaze = r < g.hands ? "hands" : r < g.hands + g.cards ? "cards" : "away";
      cu.side = Math.random() < 0.5 ? -1 : 1;
      cu.gazeT = 1.1 + Math.random() * 2.2;
    }
    cu.idleT -= dt;
    if (cu.idleT <= 0) {
      cu.idleT = 7 + Math.random() * 9;
      const lines = TYPES[cu.type].lines.idle;
      if (lines && Math.random() < 0.6) say(seatIndex(cu), pick(lines));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// suspicion
// ---------------------------------------------------------------------------------------------
function raiseSuspicion(success, strength = 1) {
  const close = S.mgr >= 70 ? 1.5 : 1;
  for (const cu of customers()) {
    let a = cu.gaze === "hands" ? (success ? 14 : 40) : cu.gaze === "cards" ? (success ? 2 : 22) : success ? 0 : 12;
    if (!success && owns("poker")) a *= 0.5;
    if (cu.type === "cop") a *= 2;
    cu.susp = clamp(cu.susp + a * strength * close, 0, 100);
  }
  if (cameraOn()) S.mgr += (success ? 10 : 22) * strength;
  else if (!success) S.mgr += 6;
  S.mgr = clamp(S.mgr, 0, 100);
  S.trickedThisHand = true;
  checkCaught();
}

function checkCaught() {
  if (S.phase === "over") return;
  for (const cu of customers()) {
    if (cu.susp < 100) continue;
    if (cu.type === "cop") return gameOver("cop");
    say(seatIndex(cu), pick(ACCUSE), 3);
    S.mgr = clamp(S.mgr + 25, 0, 100);
    sfx.bad();
    leave(cu);
  }
  if (S.mgr >= 100) gameOver("manager");
}

// ---------------------------------------------------------------------------------------------
// dealing
// ---------------------------------------------------------------------------------------------
function handOf(target) {
  return target === "D" ? S.dealer : S.seats[target] ? S.seats[target].cards : null;
}

function slotPos(target, idx) {
  if (target === "D") return { x: A.DEALER_CARDS.x - 14 + idx * 14, y: A.DEALER_CARDS.y };
  const p = A.seatCardPos(target);
  return { x: p.x - 8 + idx * 11, y: p.y + (idx % 2) };
}

// every face-up card is seen by the counters at the table
function seen(card) {
  for (const cu of customers()) if (cu.type === "counter" && !cu.confused) cu.count += hiLo(card);
}

function dealTo(target, second) {
  const hand = handOf(target);
  if (!hand) return;
  let card;
  if (target === "D" && S.stack && S.dealer.length < 2) {
    // the stacked deck: a ten waits near the top for each of my first two cards
    const k = S.shoe.map((c, i) => [c, i]).reverse().find(([c]) => cardValue(c) >= 10);
    card = k ? S.shoe.splice(k[1], 1)[0] : S.shoe.pop();
  } else if (second && S.shoe.length > 1) {
    card = S.shoe.splice(S.shoe.length - 2, 1)[0];
  } else card = S.shoe.pop();
  const up = !(target === "D" && S.dealer.length === 1);
  hand.push({ c: card, up, a: 0 });
  if (up) seen(card);
  if (S.peek && card === S.peek) S.peek = null;
  sfx.card();
  S.waitT = 0;
}

function dealNext(second = false) {
  if (S.phase !== "deal" || !S.queue.length || S.trick) return;
  const target = S.queue.shift();
  dealTo(target, second);
  if (!S.queue.length) {
    S.phase = "wait";
    S.timer = 0.35;
  }
}

// ---------------------------------------------------------------------------------------------
// a hand
// ---------------------------------------------------------------------------------------------
function startHand() {
  S.hand++;
  S.trickedThisHand = false;
  for (const cu of customers()) cu.praised = false;
  fillSeats();
  if (!customers().length) {
    // nobody at the table: the hand passes empty
    S.phase = "idle";
    S.timer = 1.2;
    return;
  }
  if (S.shoe.length < RESHUFFLE_AT) {
    S.phase = "shuffle";
    S.waitT = 0;
    return;
  }
  placeBets();
}

function placeBets() {
  S.phase = "bet";
  S.timer = 0.8;
  for (const cu of customers()) {
    const T = TYPES[cu.type];
    const want = T.bet(cu);
    cu.bet = Math.min(cu.bank, want);
    if (cu.type === "counter" && want > 20) say(seatIndex(cu), pick(T.lines.raise));
  }
  sfx.chips(4);
}

function startDeal() {
  const order = [];
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 3; i++) if (S.seats[i] && S.seats[i].bet > 0) order.push(i);
    order.push("D");
  }
  S.queue = order;
  S.phase = "deal";
  S.after = () => playSeat(0);
  S.waitT = 0;
}

function playSeat(i) {
  while (i < 3 && (!S.seats[i] || !S.seats[i].bet || isBlackjack(S.seats[i].cards))) i++;
  if (i >= 3) return dealerTurn();
  S.turn = i;
  S.phase = "think";
  S.timer = 0.7;
}

function decide(i) {
  const cu = S.seats[i];
  if (!cu) return playSeat(i + 1);
  const { t, soft } = handTotal(cu.cards);
  if (t > 21) {
    say(i, "버스트!", 1.6);
    return playSeat(i + 1);
  }
  const up = S.dealer[0] ? cardValue(S.dealer[0].c) : 10;
  let hit = t < TYPES[cu.type].hitBelow;
  if (cu.type !== "tourist" && up <= 6 && t >= 12 && !soft) hit = false;
  if (cu.type === "whale" && soft && t < 18) hit = true;
  if (hit) {
    say(i, "한 장 더.", 1.4);
    S.queue = [i];
    S.phase = "deal";
    S.after = () => {
      S.phase = "think";
      S.timer = 0.6;
    };
  } else {
    say(i, "그만.", 1.4);
    playSeat(i + 1);
  }
}

function dealerTurn() {
  S.turn = -1;
  S.phase = "reveal";
  S.timer = 0.6;
}

function dealerStep() {
  const { t } = handTotal(S.dealer);
  const live = customers().some((cu) => cu.bet && handTotal(cu.cards).t <= 21);
  if (t < 17 && live) {
    S.queue = ["D"];
    S.phase = "deal";
    S.after = () => {
      S.phase = "dealerwait";
      S.timer = 0.4;
    };
  } else settle();
}

function settle() {
  S.phase = "settle";
  S.timer = 1.8;
  const d = handTotal(S.dealer).t;
  const dbj = isBlackjack(S.dealer);
  for (let i = 0; i < 3; i++) {
    const cu = S.seats[i];
    if (!cu || !cu.bet) continue;
    const p = handTotal(cu.cards).t;
    let net;
    if (p > 21) net = -cu.bet;
    else if (isBlackjack(cu.cards) && !dbj) net = Math.round(cu.bet * 1.5);
    else if (dbj && !isBlackjack(cu.cards)) net = -cu.bet;
    else if (d > 21 || p > d) net = cu.bet;
    else if (p < d) net = -cu.bet;
    else net = 0;
    cu.bank += net;
    S.take -= net;
    cu.played++;
    const pos = A.seatCardPos(i);
    S.floats.push({ x: pos.x, y: pos.y - 26, str: net > 0 ? `-${net}` : net < 0 ? `+${-net}` : "0", col: net < 0 ? "#7fd08a" : net > 0 ? "#ff7a6a" : "#c9c0b0", t: 1.6 });
    const L = TYPES[cu.type].lines;
    if (net > 0) {
      cu.losses = 0;
      if (cu.type === "whale") {
        cu.mood = clamp(cu.mood + (isBlackjack(cu.cards) ? 18 : 10), 0, 100);
        const tip = Math.round(net * 0.1);
        S.wallet += tip;
        say(i, pick(L.win));
      } else if (Math.random() < 0.6) say(i, pick(L.win));
    } else if (net < 0) {
      cu.losses++;
      if (cu.type === "whale") cu.mood = clamp(cu.mood - (cu.bet / 10) * (owns("banter") ? 0.5 : 1), 0, 100);
      if (Math.random() < 0.5) say(i, pick(L.lose));
      // a long run of losses starts to look wrong even without a trick
      if (cu.losses >= 4) cu.susp = clamp(cu.susp + 6, 0, 100);
    }
  }
  sfx.chips(6);
  // suspicion fades a little every hand, and more after a clean one
  for (const cu of customers()) cu.susp = clamp(cu.susp - (S.trickedThisHand ? 3 : 7), 0, 100);
  if (!S.trickedThisHand) S.mgr = clamp(S.mgr - 2, 0, 100);
  if (owns("marked")) S.mgr = clamp(S.mgr + 1, 0, 100);
  checkCaught();
}

function endHand() {
  // the cards go to the tray; who has had enough gets up
  S.dealer = [];
  S.peek = null;
  S.stack = false;
  for (let i = 0; i < 3; i++) {
    const cu = S.seats[i];
    if (!cu) continue;
    cu.cards = [];
    cu.bet = 0;
    const L = TYPES[cu.type].lines;
    if (cu.type === "whale" && cu.mood <= 0) leave(cu, pick(L.leave));
    else if (cu.type === "whale" && cu.mood < 30 && Math.random() < 0.5) say(i, pick(L.bored));
    else if (cu.bank < 10 || cu.played >= cu.maxHands) leave(cu, pick(L.leave));
  }
  if (S.hand >= HANDS_PER_NIGHT) return nightEnd();
  S.phase = "idle";
  S.timer = 0.8;
}

// ---------------------------------------------------------------------------------------------
// tricks
// ---------------------------------------------------------------------------------------------
function canPeek() {
  return !S.trick && !owns("marked") && ["deal", "think", "wait", "bet"].includes(S.phase) && S.shoe.length && S.peek !== shoeTop();
}
function canSecond() {
  return !S.trick && S.phase === "deal" && S.queue.length > 0;
}
function canShuffleTrick() {
  return !S.trick && S.phase === "shuffle";
}
function canSleeve() {
  return !S.trick && owns("sleeve") && !S.sleeveUsed && S.dealer.length === 2 && !S.dealer[1].up && ["deal", "think", "wait"].includes(S.phase);
}

function startPeek() {
  if (!canPeek()) return;
  S.trick = { kind: "peek", k: 0, zone: [0.35, 0.62] };
  sfx.click();
}
function releasePeek() {
  const tr = S.trick;
  if (!tr || tr.kind !== "peek") return;
  const ok = tr.k >= tr.zone[0] && tr.k <= tr.zone[1];
  // a glance costs less than moving a card
  finishTrick(ok, ok ? "덱 맨 위 카드를 봤다." : tr.k < tr.zone[0] ? "너무 빨랐다. 아무것도 못 봤다." : "너무 오래 들여다봤다.", 0.5);
  if (ok) S.peek = shoeTop();
}

function startSecond() {
  if (!canSecond()) return;
  const w = owns("quick") ? 0.18 : 0.12;
  const z = 0.15 + Math.random() * (0.7 - w);
  S.trick = { kind: "second", k: 0, dir: 1, zone: [z, z + w], life: 3 };
  sfx.click();
}
function hitSecond() {
  const tr = S.trick;
  if (!tr || tr.kind !== "second") return;
  const ok = tr.k >= tr.zone[0] && tr.k <= tr.zone[1];
  S.trick = null;
  finishTrick(ok, ok ? "두 번째 카드를 나눴다." : "카드가 손에서 걸렸다!");
  S.phase = "deal";
  dealNext(ok);
}

function startFalseShuffle() {
  if (!canShuffleTrick()) return;
  const b = S.time + 0.7;
  S.trick = { kind: "shuffle", beats: [b, b + 0.45, b + 0.9, b + 1.35], hits: [], ticked: 0 };
  sfx.shuffle();
}
function tapShuffle() {
  const tr = S.trick;
  if (!tr || tr.kind !== "shuffle") return;
  const i = tr.hits.length;
  if (i >= 4) return;
  tr.hits.push(Math.abs(S.time - tr.beats[i]) < 0.13);
  sfx.click();
}

function useSleeve() {
  if (!canSleeve()) return;
  S.sleeveUsed = true;
  S.dealer[1].c = { r: "K", s: pick(["s", "c"]) };
  raiseSuspicion(true, 2.5);
  flash("소매 속 카드로 내 패를 바꿨다.");
  sfx.good();
}

function finishTrick(ok, msg, strength = 1) {
  S.trick = null;
  raiseSuspicion(ok, strength);
  flash(msg);
  ok ? sfx.good() : sfx.bad();
}

let flashT = 0;
let flashMsg = "";
function flash(msg) {
  flashMsg = msg;
  flashT = 2.2;
}

function updateTrick(dt) {
  const tr = S.trick;
  if (!tr) return;
  if (tr.kind === "peek") {
    tr.k += dt / 1.0;
    if (tr.k >= 1) {
      tr.k = 1;
      releasePeek();
    }
  } else if (tr.kind === "second") {
    tr.k += tr.dir * dt * 1.6;
    if (tr.k > 1) (tr.k = 1), (tr.dir = -1);
    if (tr.k < 0) (tr.k = 0), (tr.dir = 1);
    tr.life -= dt;
    if (tr.life <= 0) hitSecond();
  } else if (tr.kind === "shuffle") {
    while (tr.ticked < 4 && S.time >= tr.beats[tr.ticked]) {
      sfx.tick(tr.ticked === 0);
      tr.ticked++;
    }
    if (S.time > tr.beats[3] + 0.3) {
      while (tr.hits.length < 4) tr.hits.push(false);
      const good = tr.hits.filter(Boolean).length;
      const ok = good >= 3;
      S.trick = null;
      raiseSuspicion(ok, 0.8);
      ok ? sfx.good() : sfx.bad();
      S.shoe = newShoe();
      if (ok) {
        S.stack = true;
        for (const cu of customers()) if (cu.type === "counter") (cu.confused = true), (cu.count = 0);
        flash("가짜 섞기 성공. 다음 판 내 패는 셀 것이다.");
      } else flash("섞는 손이 꼬였다.");
      placeBets();
    }
  }
}

function honestShuffle() {
  if (S.phase !== "shuffle" || S.trick) return;
  S.shoe = newShoe();
  for (const cu of customers()) if (cu.type === "counter") (cu.count = 0), (cu.confused = false);
  sfx.shuffle();
  placeBets();
}

// ---------------------------------------------------------------------------------------------
// talking to customers: report to the floor manager, or flatter the whale
// ---------------------------------------------------------------------------------------------
function customerMenu(i) {
  const cu = S.seats[i];
  if (!cu || S.phase === "over" || S.phase === "shop" || S.phase === "title" || S.phase === "boss") return;
  const opts = [{ label: "매니저에게 알린다", fn: () => report(i) }];
  if (cu.type === "whale") opts.push({ label: cu.praised ? "칭찬했다 (이번 판)" : "추켜세운다", disabled: cu.praised, fn: () => praise(i) });
  opts.push({ label: "그만둔다", fn: closePanel });
  panel(`<div class="who">${TYPES[cu.type].label}</div><div class="small">의심 ${Math.round(cu.susp)}${cu.type === "whale" ? ` · 기분 ${Math.round(cu.mood)}` : ""}</div>`, opts, "small-panel");
}

function report(i) {
  closePanel();
  const cu = S.seats[i];
  if (!cu) return;
  if (cu.type === "counter") {
    say(i, "...알겠습니다. 나가죠.", 2.5);
    S.wallet += 40;
    S.mgr = clamp(S.mgr - 8, 0, 100);
    flash("매니저가 카운터를 데리고 나갔다. 보상 40칩.");
    leave(cu);
  } else if (cu.type === "cop") {
    say(i, "...저는 그냥 손님인데요.", 2.5);
    cu.susp = clamp(cu.susp + 20, 0, 100);
    S.mgr = clamp(S.mgr + 5, 0, 100);
    flash("매니저가 고개를 젓고 돌아갔다. 그 손님이 나를 더 오래 본다.");
    checkCaught();
  } else {
    say(i, "뭐요? 내가 뭘 했다고!", 2.5);
    S.mgr = clamp(S.mgr + 6, 0, 100);
    flash("엉뚱한 손님이었다. 손님이 화를 내며 나갔다.");
    leave(cu);
  }
}

function praise(i) {
  closePanel();
  const cu = S.seats[i];
  if (!cu || cu.praised) return;
  cu.praised = true;
  cu.mood = clamp(cu.mood + 8, 0, 100);
  say("D", pick(["오늘 밤 테이블의 주인공이십니다.", "역시 손님은 배짱이 다르시네요."]), 2.2);
  say(i, "하하, 자네 말을 잘하는군.", 2.2);
}

// ---------------------------------------------------------------------------------------------
// nights
// ---------------------------------------------------------------------------------------------
function startNight() {
  const plan = NIGHT_PLAN[S.night - 1];
  S.quota = plan.quota + S.carry;
  S.take = 0;
  S.hand = 0;
  S.seats = [null, null, null];
  plan.seats.forEach((t, i) => (S.seats[i] = makeCustomer(t)));
  S.arrivals = plan.arrivals.slice();
  S.shoe = [];
  S.dealer = [];
  S.sleeveUsed = false;
  S.camOffset = Math.random() * 10;
  if (owns("marked")) S.mgr = clamp(S.mgr + 4, 0, 100);
  const [who, line] = BOSS.open[S.night - 1];
  S.phase = "boss";
  panel(`<div class="boss"><div class="who">${who}</div><div>${line.replace("{quota}", S.quota)}</div></div>`, [
    {
      label: "테이블로 간다",
      fn: () => {
        closePanel();
        S.seats.forEach((cu, i) => cu && say(i, pick(TYPES[cu.type].lines.sit)));
        // the first hand opens like any other: the empty shoe asks for a shuffle
        S.phase = "idle";
        S.timer = 0.4;
      },
    },
  ]);
}

function nightEnd() {
  S.phase = "boss";
  // a night off the floor: the manager's suspicion cools a little, but not all the way
  S.mgr = clamp(S.mgr - 15, 0, 100);
  const made = S.take >= S.quota;
  let html;
  if (made) {
    const pay = 20 + Math.round((S.take - S.quota) * 0.2);
    S.wallet += pay;
    S.carry = 0;
    html = `<div class="who">사장</div><div>${pick(BOSS.made)}</div><div class="small">오늘 하우스 몫 ${S.take} / ${S.quota}칩 · 내 몫 +${pay}칩</div>`;
  } else {
    S.misses++;
    if (S.misses >= 2) return gameOver("debt");
    S.carry = S.quota - S.take;
    html = `<div class="who">사장</div><div>${BOSS.short[0]}</div><div class="small">오늘 하우스 몫 ${S.take} / ${S.quota}칩 · 모자란 ${S.carry}칩은 내일 몫에 더해진다</div>`;
  }
  if (S.night >= NIGHTS) {
    panel(`<div class="boss">${html}</div>`, [{ label: "결과 보기", fn: () => ending(made) }]);
    return;
  }
  panel(`<div class="boss">${html}</div>`, [{ label: "뒷골목 가게로", fn: () => shop() }]);
}

function shop() {
  S.phase = "shop";
  const rows = SHOP.map((it) => {
    const have = owns(it.id);
    return `<div class="item ${have ? "have" : ""}"><div class="name">${it.name} <span class="kind">${it.kind}</span></div><div class="desc">${it.desc}</div><div class="price">${have ? "가지고 있다" : it.price + "칩"}</div></div>`;
  }).join("");
  const buttons = SHOP.filter((it) => !owns(it.id)).map((it) => ({
    label: `${it.name} 사기 (${it.price})`,
    disabled: S.wallet < it.price,
    fn: () => {
      S.wallet -= it.price;
      S.owned.add(it.id);
      sfx.chips(3);
      shop();
    },
  }));
  buttons.push({
    label: "다음 밤으로",
    fn: () => {
      closePanel();
      S.night++;
      startNight();
    },
  });
  panel(`<div class="shop"><div class="who">뒷골목 가게 · 내 돈 ${S.wallet}칩</div>${rows}</div>`, buttons, "wide");
}

function ending(clean) {
  S.phase = "over";
  const [head, body] = clean
    ? ["사흘 밤을 버텼다", "사장은 장부를 덮고 아무 말 없이 다음 주 근무표를 내민다."]
    : ["빚을 진 채로 한 주를 마쳤다", `사장은 장부에 ${S.carry}칩을 적어 넣는다. "다음 주에는 이걸 먼저 갚는다."`];
  panel(
    `<div class="boss"><div class="who">${head}</div><div>${body}</div><div class="small">시험판은 여기까지예요. 내 돈 ${S.wallet}칩 · 매니저 의심 ${Math.round(S.mgr)}</div></div>`,
    [{ label: "처음부터", fn: () => location.reload() }],
  );
}

function gameOver(why) {
  S.phase = "over";
  S.trick = null;
  const text = {
    cop: ["잠복 수사관이었다", "평범한 관광객인 줄 알았던 손님이 배지를 꺼낸다. \"손 좀 보여 주시죠, 딜러 양반.\""],
    manager: ["매니저에게 들켰다", "플로어 매니저가 내 손목을 잡는다. 사장 사무실의 문이 열린다."],
    debt: ["몫을 두 번 못 채웠다", "사장은 더 말하지 않는다. 내 이름이 근무표에서 지워진다."],
  }[why];
  sfx.bad();
  panel(`<div class="boss"><div class="who">${text[0]}</div><div>${text[1]}</div><div class="small">${S.night}번째 밤, ${S.hand}번째 판에서 끝났다.</div></div>`, [{ label: "처음부터", fn: () => location.reload() }]);
}

// ---------------------------------------------------------------------------------------------
// panel
// ---------------------------------------------------------------------------------------------
function panel(html, buttons, cls = "") {
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
}
function closePanel() {
  pnl.className = "hidden";
  pnl.innerHTML = "";
}

// ---------------------------------------------------------------------------------------------
// the loop
// ---------------------------------------------------------------------------------------------
const WAITING = () => (S.phase === "deal" && !S.trick) || S.phase === "shuffle";

function update(dt) {
  S.time += dt;
  if (S.phase === "title" || S.phase === "over") return;
  for (const h of [S.dealer, ...customers().map((c) => c.cards)]) for (const c of h) c.a = Math.min(1, c.a + dt * 5);
  S.floats = S.floats.filter((f) => (f.t -= dt) > 0);
  if (flashT > 0) flashT -= dt;
  // the manager walks the back of the room, and stays close once he suspects me
  S.mgrX += S.mgrDir * dt * 18;
  if (S.mgrX > 440) S.mgrDir = -1;
  if (S.mgrX < 40) S.mgrDir = 1;
  if (S.phase === "boss" || S.phase === "shop") return;
  updateGaze(dt);
  updateTrick(dt);
  // the table waits for me; the whale does not like waiting
  if (WAITING()) {
    S.waitT += dt;
    if (S.waitT > 6) for (const cu of customers()) if (cu.type === "whale") cu.mood = clamp(cu.mood - dt * 3, 0, 100);
  }
  if (S.timer > 0) {
    S.timer -= dt;
    if (S.timer > 0) return;
  }
  switch (S.phase) {
    case "idle":
      startHand();
      break;
    case "bet":
      startDeal();
      break;
    case "wait":
      S.after();
      break;
    case "think":
      decide(S.turn);
      break;
    case "reveal":
      if (S.dealer[1] && !S.dealer[1].up) {
        S.dealer[1].up = true;
        seen(S.dealer[1].c);
        sfx.card();
        S.phase = "dealerwait";
        S.timer = 0.5;
      } else dealerStep();
      break;
    case "dealerwait":
      dealerStep();
      break;
    case "settle":
      endHand();
      break;
  }
}

function tipText() {
  if (S.trick) {
    if (S.trick.kind === "peek") return "1을 누른 채로… 초록 칸에서 떼기";
    if (S.trick.kind === "second") return "바늘이 초록 틈에 올 때 2 또는 Space";
    return "박자에 맞춰 Space 네 번";
  }
  if (flashT > 0) return flashMsg;
  switch (S.phase) {
    case "shuffle":
      return "섞을 차례 · Space 그냥 섞기 · 3 가짜 섞기";
    case "deal": {
      const t = S.queue[0];
      const who = t === "D" ? "내 패" : `${t + 1}번 자리`;
      const extra = [canPeek() ? "1 엿보기(꾹)" : "", "2 두 번째 카드", canSleeve() ? "4 소매 속 카드" : ""].filter(Boolean).join(" · ");
      return `Space 또는 덱 클릭: ${who}에 카드 · ${extra}${S.waitT > 6 ? " · 손님들이 기다린다" : ""}`;
    }
    default:
      return canPeek() ? "1 엿보기(꾹) · 손님을 클릭하면 매니저에게 알리거나 큰손을 추켜세울 수 있다" : "";
  }
}

function hud() {
  hudEl.textContent = `밤 ${S.night}/${NIGHTS} · 판 ${Math.min(S.hand, HANDS_PER_NIGHT)}/${HANDS_PER_NIGHT}\n하우스 몫 ${S.take} / ${S.quota}\n내 돈 ${S.wallet}칩${cameraOn() ? "\n● 카메라가 이 테이블을 본다" : ""}`;
  mgrBar.style.width = `${S.mgr}%`;
  mgrBar.style.background = S.mgr >= 70 ? "#ff4040" : "#d88a3a";
  tipEl.textContent = tipText();
  for (const [id, ok] of [
    ["t1", canPeek()],
    ["t2", canSecond()],
    ["t3", canShuffleTrick()],
    ["t4", canSleeve()],
  ])
    $(id).disabled = !ok;
  $("t4").classList.toggle("hidden", !owns("sleeve"));
  $("t1").classList.toggle("hidden", owns("marked"));
}

function draw() {
  const t = S.time;
  const cam = cameraOn();
  A.drawRoom(ctx, t, cam);
  A.drawManager(ctx, S.mgr >= 70 ? 64 : S.mgrX, t, S.mgr >= 70);
  const heads = [];
  for (let i = 0; i < 3; i++) if (S.seats[i]) heads[i] = A.drawCustomer(ctx, S.seats[i], A.SEAT_X[i], t);
  A.drawTable(ctx, t, cam);
  for (let i = 0; i < 3; i++) if (S.seats[i]) A.drawWatch(ctx, S.seats[i], A.SEAT_X[i], heads[i], t);
  // bets and cards
  for (let i = 0; i < 3; i++) {
    const cu = S.seats[i];
    if (!cu) continue;
    const bp = A.seatBetPos(i);
    A.drawChips(ctx, bp.x, bp.y, cu.bet);
    drawHand(cu.cards, i, S.turn === i && S.phase === "think");
  }
  drawHand(S.dealer, "D", false);
  // where the next card goes
  if (S.phase === "deal" && S.queue.length) {
    const tg = S.queue[0];
    const hand = handOf(tg);
    if (hand) {
      const p = slotPos(tg, hand.length);
      if (Math.floor(t * 4) % 2 === 0) {
        ctx.strokeStyle = "#f0c060";
        ctx.strokeRect(Math.round(p.x - A.CARD_W / 2) - 1.5, Math.round(p.y - A.CARD_H / 2) - 1.5, A.CARD_W + 3, A.CARD_H + 3);
      }
    }
  }
  // the top of the shoe, if I have seen it
  const top = shoeTop();
  if (top && (owns("marked") || S.peek === top)) A.drawCard(ctx, top, A.SHOE.x - 26, A.SHOE.y + 24, true, "rgba(240,192,96,0.55)");
  // the trick in progress
  const tr = S.trick;
  if (tr && (tr.kind === "peek" || tr.kind === "second")) A.drawTrickBar(ctx, tr.kind, tr.zone, tr.k, null);
  if (tr && tr.kind === "shuffle") A.drawBeats(ctx, tr.beats, S.time, tr.hits);
  for (const f of S.floats) A.text(ctx, f.str, f.x - A.textWidth(f.str, 2) / 2, f.y - (1.6 - f.t) * 10, f.col, 2);
}

function drawHand(cards, target, active) {
  cards.forEach((h, idx) => {
    const p = slotPos(target, idx);
    const k = 1 - (1 - h.a) ** 3;
    const x = A.SHOE.x + A.SHOE.w / 2 + (p.x - A.SHOE.x - A.SHOE.w / 2) * k;
    const y = A.SHOE.y + 10 + (p.y - A.SHOE.y - 10) * k;
    A.drawCard(ctx, h.c, x, y, h.up && h.a > 0.6, active && idx === cards.length - 1 ? "rgba(240,192,96,0.4)" : null);
  });
  const shown = cards.filter((h) => h.up);
  if (!shown.length) return;
  const tot = handTotal(shown).t;
  const p = slotPos(target, 0);
  const label = String(tot);
  const lx = p.x - A.CARD_W / 2 - A.textWidth(label, 1) - 5;
  ctx.fillStyle = "rgba(10,8,7,0.75)";
  ctx.fillRect(lx - 2, p.y - 6, A.textWidth(label, 1) + 4, 9);
  A.text(ctx, label, lx, p.y - 4, tot > 21 ? "#ff6a5a" : "#e8e2d4", 1);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  requestAnimationFrame(frame);
}
function step(dt) {
  update(dt);
  draw();
  hud();
  sfx.heartbeat(Math.max(S.mgr, ...customers().map((c) => c.susp)) / 100, S.time);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------------------------
function toCanvas(ev) {
  const r = view.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * A.W, ((ev.clientY - r.top) / r.height) * A.H];
}

view.addEventListener("click", (ev) => {
  if (S.phase === "title") return;
  const [x, y] = toCanvas(ev);
  const s = A.SHOE;
  if (x >= s.x - 6 && x <= s.x + s.w + 6 && y >= s.y - 6 && y <= s.y + s.h + 6) return onDealKey();
  // a customer: above the far rail, around a seat
  for (let i = 0; i < 3; i++) if (S.seats[i] && Math.abs(x - A.SEAT_X[i]) < 32 && y < A.arcY(A.SEAT_X[i]) + 4) return customerMenu(i);
});

function onDealKey() {
  if (S.trick && S.trick.kind === "second") return hitSecond();
  if (S.trick && S.trick.kind === "shuffle") return tapShuffle();
  if (S.phase === "shuffle") return honestShuffle();
  dealNext(false);
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (S.phase === "title" || S.phase === "over" || S.phase === "boss" || S.phase === "shop") return;
  if (e.code === "Space") {
    e.preventDefault();
    onDealKey();
  } else if (e.code === "Digit1") startPeek();
  else if (e.code === "Digit2") (S.trick && S.trick.kind === "second" ? hitSecond : startSecond)();
  else if (e.code === "Digit3") startFalseShuffle();
  else if (e.code === "Digit4") useSleeve();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Digit1") releasePeek();
});

// the same tricks as buttons, for the mouse
$("t1").addEventListener("pointerdown", (e) => (e.preventDefault(), startPeek()));
$("t1").addEventListener("pointerup", () => releasePeek());
$("t1").addEventListener("pointerleave", () => releasePeek());
$("t2").addEventListener("click", () => (S.trick && S.trick.kind === "second" ? hitSecond() : startSecond()));
$("t3").addEventListener("click", () => startFalseShuffle());
$("t4").addEventListener("click", () => useSleeve());
$("deal").addEventListener("click", () => onDealKey());

$("overlay").addEventListener("click", () => {
  $("overlay").classList.add("hidden");
  startAudio();
  startNight();
});

$("version").textContent = "v2026.10.15f";

// dev hook for automated checks
window.__dl = {
  S,
  step,
  onDealKey,
  startPeek,
  releasePeek,
  startSecond,
  hitSecond,
  startFalseShuffle,
  tapShuffle,
  customerMenu,
  report,
  shop,
  nightEnd,
};
