// What the keeper's poisoned head does to the information passing through it.
// Only what passes through the head is touched: what is heard on the radio, read back from the
// logbook, made out through the telescope. Machine records (the telegraph tape) never change.
// The game never marks a hallucination; now and then the real thing shows through for a few frames.

export function stageOf(mercury) {
  return mercury >= 75 ? 4 : mercury >= 50 ? 3 : mercury >= 25 ? 2 : 1;
}

// glimpses: how often (mean seconds between) and how long (seconds) the real thing shows, per stage
const GLIMPSE = { 2: { every: 2.5, show: 0.2 }, 3: { every: 6, show: 0.12 }, 4: { every: 12, show: 0.07 } };

// what a poisoned mind swaps; longer phrases win over the shorter ones inside them
const SWAPS = [
  ["흰 바탕 검은 십자기", "가로 줄무늬 기"],
  ["가로 줄무늬 기", "흰 바탕 검은 십자기"],
  ["검은 삼각기", "가로 줄무늬 기"],
  ["무늬 없는 기", "검은 삼각기"],
  ["남동쪽", "북서쪽"],
  ["북쪽", "남쪽"],
  ["남쪽", "북쪽"],
  ["동쪽", "서쪽"],
  ["서쪽", "동쪽"],
  ["북풍", "남풍"],
  ["불을 꺼라", "불을 켜라"],
  ["불을 켜", "불을 꺼"],
  ["불이 꺼져", "불이 켜져"],
  ["불빛이 없었다", "불빛이 있었다"],
  ["켜져 있었어", "꺼져 있었어"],
  ["정지시키고", "통과시키고"],
  ["정지시켜", "통과시켜"],
  ["통과시켜라", "정지시켜라"],
  ["인도할 것", "정지시킬 것"],
  ["에델호", "마르타호"],
  ["마르타호", "에델호"],
  ["갈매기 3호", "갈매기 5호"],
  ["로사", "로라"],
  ["제7 초계정", "제9 초계정"],
  ["밀가루", "소총"],
  ["고등어", "밀가루"],
  ["생선", "소총"],
  ["빈 배", "만선"],
  ["역병", "전쟁"],
  ["군 보급선", "적 보급선"],
  ["체포되었다", "석방되었다"],
  ["무효다", "유효하다"],
  ["해제한다", "유지한다"],
  ["없음", "있음"],
  ["두 명", "세 명"],
  ["네 명", "여섯 명"],
];
const SPEAKERS = ["본부", "어선 갈매기 3호", "화물선 에델호", "어선 수리공"];

// voices that are not there (stage 4): never written in the log, never on the tape
const PHANTOMS = [
  ["본부", "등대, 오늘 밤은 모든 배를 멈춰 세워라. 이 지시는 전신으로 가지 않는다."],
  ["???", "……등대지기, 거기 있는 거 다 알아……"],
  ["어선 갈매기 3호", "어젯밤 등대 불이 한참 꺼져 있었다며? 다들 그 얘기야."],
  ["본부", "전신 테이프는 믿지 마라. 이 목소리만 믿어라."],
  ["???", "……불을 꺼…… 불을 꺼……"],
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// a repeatable roll in [0, 1) for a given key
export function roll(key) {
  let t = hash(key) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// every place in the text the mind could bend, as [start, end, replacement]
function candidates(text) {
  const found = [];
  for (const [from, to] of SWAPS) {
    let i = text.indexOf(from);
    while (i >= 0) {
      found.push([i, i + from.length, to]);
      i = text.indexOf(from, i + 1);
    }
  }
  for (const m of text.matchAll(/(\d\d):(\d\d)/g)) {
    const h = (Number(m[1]) + 1) % 24;
    found.push([m.index, m.index + m[0].length, `${String(h).padStart(2, "0")}:${m[2]}`]);
  }
  for (const m of text.matchAll(/(\d+)일째/g)) found.push([m.index, m.index + m[0].length, `${Number(m[1]) + 1}일째`]);
  // longest first, then drop anything overlapping a longer pick
  found.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
  const keep = [];
  for (const c of found) if (!keep.some((k) => c[0] < k[1] && k[0] < c[1])) keep.push(c);
  return keep.sort((a, b) => a[0] - b[0]);
}

// text → segments [{ t, real? }]; a segment with `real` is a bent word whose truth is `real`
export function bend(text, key) {
  const cs = candidates(text);
  if (!cs.length) return [{ t: text }];
  const [s, e, to] = cs[Math.floor(roll(key + "#pick") * cs.length)];
  const out = [];
  if (s > 0) out.push({ t: text.slice(0, s) });
  out.push({ t: to, real: text.slice(s, e) });
  if (e < text.length) out.push({ t: text.slice(e) });
  return out;
}

// does this piece of information get bent? chance per stage, rolled once per key so it holds still
export function bends(key, stage, chances) {
  const p = chances[stage] || 0;
  return p > 0 && roll(key) < p;
}

// what a line heard on the radio becomes in a head at this stage: [who, segments]
export function hearLine([who, text], key, stage) {
  let w = who;
  let wReal = null;
  if (stage >= 4 && who && roll(key + "#voice") < 0.2) {
    const others = SPEAKERS.filter((s) => s !== who);
    w = others[Math.floor(roll(key + "#who") * others.length)];
    wReal = who;
  }
  const segs = bends(key, stage, { 3: 0.35, 4: 0.5 }) ? bend(text, key) : [{ t: text }];
  return { who: w, whoReal: wReal, segs };
}

// the radio as heard today: some lines bent, and at stage 4 a voice that is not there
export function hearRadio(lines, day, stage) {
  const heard = lines.map((l, i) => hearLine(l, `radio:${day}:${i}`, stage));
  if (stage >= 4) {
    const [who, text] = PHANTOMS[Math.floor(roll(`phantom:${day}`) * PHANTOMS.length)];
    const at = 1 + Math.floor(roll(`phantom-at:${day}`) * Math.max(1, heard.length - 1));
    heard.splice(at, 0, { who, whoReal: null, segs: [{ t: text }], phantom: true });
  }
  return heard;
}

// the real thing shown through the noise: the last word or two, with some letters broken, and a question
export function crack(real, seed) {
  const words = real.split(" ");
  const part = words.slice(-2).join(" ");
  let out = "";
  let i = 0;
  for (const ch of part) {
    out += ch !== " " && i > 0 && roll(`${seed}:${i}`) < 0.3 ? "█" : ch;
    i++;
  }
  return `${out}?`;
}

const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// segments → html; bent words carry their truth for the glimpses
export function segHtml(segs, key) {
  return segs
    .map((s, i) => (s.real ? `<span class="hx" data-k="${escHtml(key)}:${i}" data-fake="${escHtml(s.t)}" data-real="${escHtml(s.real)}">${escHtml(s.t)}</span>` : escHtml(s.t)))
    .join("");
}

// schedules the glimpses: only while the bent thing is actually on screen, one at a time
export function createGlimpses() {
  let wait = 1.5;
  let cur = null; // { key, left }
  let flash = 0;
  const api = {
    lengthen: 1, // accessibility: show the glimpses longer
    // the key being glimpsed right now (also "flag" for the telescope)
    get showing() {
      return cur ? cur.key : null;
    },
    update(dt, stage, roots, extraKeys = []) {
      const g = GLIMPSE[stage];
      const els = [];
      for (const r of roots) if (r && !r.classList.contains("hidden")) els.push(...r.querySelectorAll(".hx"));
      if (cur) {
        cur.left -= dt;
        if (cur.left <= 0) cur = null;
      }
      if (!cur && g && (els.length || extraKeys.length)) {
        wait -= dt;
        if (wait <= 0) {
          const keys = els.map((e) => e.dataset.k).concat(extraKeys);
          cur = { key: keys[Math.floor(Math.random() * keys.length)], left: g.show * api.lengthen };
          flash++;
          wait = g.every * (0.5 + Math.random());
        }
      }
      // re-applied every frame, so a re-rendered panel keeps showing the glimpse
      for (const e of els) {
        const on = cur && e.dataset.k === cur.key;
        if (on && !e.classList.contains("glimpse")) {
          e.textContent = crack(e.dataset.real, `${e.dataset.k}:${flash}`);
          e.classList.add("glimpse");
        } else if (!on && e.classList.contains("glimpse")) {
          e.textContent = e.dataset.fake;
          e.classList.remove("glimpse");
        }
      }
    },
  };
  return api;
}
