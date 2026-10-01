// Day structure, clock, equipment, maintenance and the day's information for the 5-day build.
// Phases: dawn (a fixed number of maintenance jobs) → day (radio; the supply boat on its days) →
// dusk (light the lamp, plus one job) → wire (the evening telegram) → night (paused for now) →
// results → next dawn. The clock only moves when a job is done.
import { STORY } from "./story.js";
import { rosterFor, KIND_NAMES, FLAG_NAMES } from "./nights.js";

export const DAWN_JOBS = 4;
const DUSK_JOBS = 1;

export const DAYS = 5;
const PHASE_NAMES = { dawn: "새벽", day: "낮", dusk: "해 질 녘", wire: "저녁", night: "밤", results: "밤" };

export const TASKS = {
  mantle: { name: "맨틀 교체", minutes: 20, exposure: 2, phases: ["dawn", "dusk"] },
  lens: { name: "렌즈 닦기", minutes: 20, exposure: 3, phases: ["dawn", "dusk"] },
  pump: { name: "압력 펌프질", minutes: 10, exposure: 1, phases: ["dawn", "dusk"] },
  ignite: { name: "예열과 점화", minutes: 10, exposure: 1, phases: ["dusk", "wire"] },
  filter: { name: "수은 욕조 거르기", minutes: 40, exposure: 14, phases: ["dawn"] },
  spill: { name: "쏟아진 수은 모으기", minutes: 30, exposure: 10, phases: ["dawn", "dusk"] },
  wind: { name: "태엽 감기", minutes: 15, exposure: 0, phases: ["dawn", "dusk"] },
  refuel: { name: "석유 보충", minutes: 15, exposure: 0, phases: ["dawn", "dusk"] },
};

// which tasks each object in the tower offers
const STATIONS = {
  lens: ["mantle", "lens", "pump", "ignite"],
  filter: ["filter", "spill"],
  wind: ["wind"],
  drum: ["refuel"],
};

export function condition(v) {
  if (v >= 75) return "좋음";
  if (v >= 45) return "보통";
  if (v >= 20) return "나쁨";
  return "매우 나쁨";
}

const clamp = (v) => Math.max(0, Math.min(100, v));
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

export function createGame(hooks) {
  const g = {
    day: 1,
    minutes: 5 * 60,
    phase: "dawn",
    lampOn: true, // last night's light is still burning at 05:00
    jobs: DAWN_JOBS,
    eq: { mantle: 55, bath: 45, lens: 50, wound: 0, pressure: 0, tank: 40 },
    drum: 300,
    mantles: 3, // spare mantles on the shelf
    food: 3, // days of food for one person
    hungry: false,
    survivors: [], // people let in: { from, desc }
    knocks: [], // wrecks whose survivors are (or will be) at the door
    turnedAway: 0,
    gone: new Set(), // ids of ships wrecked or detained
    suspicion: 0, // hidden: how much the coast station distrusts this light
    pending: { notices: [], radio: [], suspicion: 0 }, // reactions arriving with today's radio and telegram
    spill: false,
    done: [],
    night: null,
    // what the keeper has been told; the logbook shows these
    orders: [],
    tonight: [],
    rumours: [],
    radioLog: [],
    notices: [],
    weather: null,
    today: { radio: false, supply: false, tape: false },
  };

  const story = () => STORY[g.day - 1] || {};

  function enterDay() {
    g.phase = "day";
    g.minutes = Math.max(g.minutes, 8 * 60);
    if (g.lampOn) g.lampOn = false;
    hooks.toast("새벽 정비를 마쳤다");
  }

  function enterNight() {
    const e = g.eq;
    const lit = g.lampOn;
    const notes = [];
    let hoursLit = lit ? 10 : 0;
    if (lit && e.tank < 35) {
      hoursLit = Math.round((10 * e.tank) / 35);
      notes.push("밤중에 석유가 떨어져 불이 꺼졌다");
    }
    if (lit && e.pressure < 30) {
      hoursLit = Math.min(hoursLit, 3);
      notes.push("압력이 떨어져 불꽃이 사그라들었다");
    }
    if (!g.today.tape) notes.push("전신 테이프를 읽지 않은 채 밤을 맞았다");
    const brightness = lit ? (0.4 * e.mantle + 0.35 * e.lens + 0.25 * clamp(e.pressure / 0.8)) / 100 : 0;
    const rotation = !lit ? "-" : e.wound >= 60 ? "밤새 돌았다" : e.wound > 0 ? "한밤중에 멈췄다" : "돌지 않았다";
    const steady = e.bath >= 50;
    if (lit && !steady) notes.push("수은 욕조가 더러워 렌즈가 덜컹거리며 돌았다");
    if (g.spill) notes.push("렌즈실 바닥에 흘린 수은이 그대로 남아 있다");
    g.night = { lit, hoursLit, brightness, rotation, steady, notes };
    g.phase = "night";
    g.minutes = 19 * 60;
    if (!lit) hooks.toast("등불 없이 밤이 되었다");
  }

  // what each ship's fate reads as in the results
  function fateText(o) {
    if (o.result === "detained") return "억류했다";
    if (o.result === "wrecked") {
      return { shutter: "차광막을 닫아 난파시켰다", dark: "어둠 속에서 암초에 부딪혔다", accident: "암초에 걸려 난파했다", sank: "가라앉았다" }[o.how] || "난파했다";
    }
    if (o.decision === "stop-send") return "검문한 뒤 보냈다";
    if (o.decision === "stop" && o.spec.ignoresStop) return "정지 신호를 무시하고 지나갔다";
    if (o.decision === "guide") return "인도해 지나갔다";
    return "지나갔다";
  }

  // the delayed consequences: nothing is said tonight, the reactions arrive with tomorrow's radio and telegram
  function reactionsFor(outcomes) {
    const out = { notices: [], radio: [], suspicion: 0 };
    for (const o of outcomes) {
      const r = o.spec.react || {};
      let re = null;
      if (o.result === "wrecked") {
        re = r.wrecked || (o.spec.listed ? { notice: `어젯밤 ${o.spec.eta} 통과 예정이던 ${o.spec.name}, 입항하지 않았음. 통과 여부를 보고할 것.`, suspicion: 2 } : null);
      } else if (o.result === "detained") {
        re = r.detained || null;
      } else if (o.decision === "stop-send") {
        re = o.spec.afterStop === "detain" ? r.sent || r.passed || null : null;
      } else if (o.spec.expect === "stop" && !(o.decision === "stop" && o.spec.ignoresStop)) {
        re = r.passed || null;
      }
      if (!re) continue;
      if (re.notice) out.notices.push(re.notice);
      if (re.radio) out.radio.push(re.radio);
      out.suspicion += re.suspicion || 0;
    }
    return out;
  }

  function results(night) {
    const n = g.night;
    const e = g.eq;
    if (n.lit) e.mantle = clamp(e.mantle - (20 + Math.random() * 15));
    if (n.lit) e.lens = clamp(e.lens - 25);
    e.bath = clamp(e.bath - 15);
    e.wound = 0;
    e.pressure = 0;
    const used = n.hoursLit * 3.5;
    e.tank = clamp(e.tank - used);
    hooks.expose(-6); // a night's sleep

    // survivors who knocked and were left outside all day give up
    for (const k of g.knocks) if (k.arrived && !k.answered) g.turnedAway += k.n;
    // anyone still outside by morning will be knocking at dawn
    for (const w of night.wrecks) if (!w.answered) w.when = "dawn";
    g.knocks = night.wrecks.filter((w) => !w.answered);

    const eaters = 1 + g.survivors.length;
    g.hungry = g.food < eaters;
    g.food = Math.max(0, g.food - eaters);

    for (const o of night.outcomes) if (o.result !== "passed") g.gone.add(o.spec.id);
    const re = reactionsFor(night.outcomes);
    if (g.turnedAway > 0) re.radio.push(["어선 갈매기 3호", "어젯밤 등대 바위에 사람이 매달려 있었다던데…… 아침엔 아무도 없었대."]);
    g.turnedAway = 0;
    g.suspicion += re.suspicion;
    g.pending = re;
    g.phase = "results";

    const notes = n.notes.slice();
    if (g.hungry) notes.push("식량이 모자라 굶었다. 내일 새벽은 몸이 무겁다");
    const last = g.day >= DAYS;
    const sus = g.suspicion <= 1 ? "낮다" : g.suspicion <= 4 ? "커지고 있다" : "높다";
    return {
      day: g.day,
      last,
      lines: [
        ["등불", n.lit ? (n.hoursLit >= 10 ? "밤새 켜져 있었다" : `${n.hoursLit}시간 만에 꺼졌다`) : "켜지 않았다"],
        ["빛 세기", n.lit ? (n.brightness >= 0.7 ? "강함" : n.brightness >= 0.45 ? "보통" : "약함") : "-"],
        ["회전", n.rotation],
        ["석유 사용", `${Math.round(used)} (드럼 남은 양 ${Math.round(g.drum)})`],
        ["식량", `${g.food}일치 남음 (${eaters}명이 먹었다)`],
      ],
      ships: night.outcomes.map((o) => [o.spec.name, fateText(o)]),
      notes,
      done: g.done.slice(),
      tomorrow: [
        ["맨틀", condition(e.mantle)],
        ["렌즈", condition(e.lens)],
        ["수은 욕조", condition(e.bath)],
        ["석유 탱크", condition(e.tank)],
      ],
      // the five-day build ends here: show what tomorrow's telegram would have said, and the suspicion
      final: last ? { suspicion: sus, notices: re.notices, radio: re.radio.map(([w, t]) => `${w}: ${t}`) } : null,
    };
  }

  const api = {
    state: g,
    get phaseName() {
      return PHASE_NAMES[g.phase];
    },
    clockText() {
      return `${g.day}일차 · ${PHASE_NAMES[g.phase]} ${hhmm(g.minutes)}`;
    },
    hint() {
      if (g.phase === "dawn") return `정비 ${g.jobs}/${DAWN_JOBS}회 남음 · N 정비 마치기${g.spill ? " · 렌즈실 바닥에 수은이 흘러 있다" : ""}`;
      if (g.phase === "day") {
        const todo = [];
        if (!g.today.radio) todo.push("무전을 들을 수 있다");
        if (api.supplyWaiting) todo.push("보급선이 왔다 · 무전실의 상자 확인");
        return `${todo.length ? todo.join(" · ") + " · " : ""}N 해 질 녘으로`;
      }
      if (g.phase === "dusk") return g.lampOn ? `N  일정 마치기${g.jobs ? ` · 정비 ${g.jobs}회 가능` : ""}` : "렌즈실에서 예열과 점화 · 켜지 않고 N을 누르면 등불 없는 밤";
      if (g.phase === "wire") return g.today.tape ? "N  밤으로 넘기기 (배 판단은 다음 단계에서)" : "전신이 왔다 · 무전실 전신기에서 테이프 읽기 · N 밤으로";
      if (g.phase === "night") return hooks.nightHint ? hooks.nightHint() : "";
      return "";
    },
    // hours used for lighting: the paused phases show midday and deep night
    get visualHours() {
      if (g.phase === "day") return 12;
      if (g.phase === "wire") return 19.2;
      if (g.phase === "night" || g.phase === "results") return 23;
      return g.minutes / 60;
    },
    get rotating() {
      return g.lampOn && g.eq.wound > 0;
    },
    checkClock() {
      if (g.phase === "dawn" && g.lampOn && g.minutes >= 6 * 60) {
        g.lampOn = false;
        hooks.toast("해가 떠서 등불을 껐다");
      }
      if (g.phase === "dawn" && g.jobs <= 0) enterDay();
    },
    stationTasks(station) {
      return (STATIONS[station] || []).filter((id) => id !== "spill" || g.spill);
    },
    // why a task can't be done right now, or null
    blockedReason(id) {
      const t = TASKS[id];
      if (!t.phases.includes(g.phase)) return `${t.phases.map((p) => PHASE_NAMES[p]).join("·")}에만`;
      if (id === "ignite" && g.lampOn) return "이미 켜져 있음";
      if (id !== "ignite" && g.jobs <= 0) return "오늘 정비 횟수를 다 썼음";
      if (id === "mantle" && g.mantles <= 0) return "여분 맨틀 없음";
      if (id === "refuel" && g.drum <= 0) return "드럼이 비었음";
      return null;
    },
    status(station) {
      const e = g.eq;
      if (station === "lens") return `맨틀 ${condition(e.mantle)} (여분 ${g.mantles}) · 렌즈 ${condition(e.lens)} · 압력 ${condition(e.pressure)}`;
      if (station === "filter") return `수은 욕조 ${condition(e.bath)}`;
      if (station === "wind") return e.wound > 0 ? "태엽이 감겨 있다" : "태엽이 풀려 있다";
      if (station === "drum") return `탱크 ${condition(e.tank)} · 드럼 남은 양 ${Math.round(g.drum)}`;
      return "";
    },
    complete(id, res) {
      const t = TASKS[id];
      const e = g.eq;
      if (!res) return;
      if (res.cancelled) {
        if (id === "mantle" && res.used) g.mantles = Math.max(0, g.mantles - res.used);
        return;
      }
      if (id === "mantle") {
        g.mantles = Math.max(0, g.mantles - res.used);
        if (res.ok) e.mantle = 100;
      }
      if (id === "lens") e.lens = clamp(res.clarity);
      if (id === "pump") e.pressure = clamp(res.pressure);
      if (id === "ignite" && res.lit) g.lampOn = true;
      if (id === "filter") {
        e.bath = 100;
        if (res.spilled > 12) {
          g.spill = true;
          hooks.toast("수은이 바닥에 쏟아졌다");
        }
      }
      if (id === "spill") g.spill = false;
      if (id === "wind" && res.ok) e.wound = 100;
      if (id === "refuel") {
        const used = Math.min(res.used, g.drum);
        g.drum -= used;
        e.tank = clamp(e.tank + Math.min(used, res.added));
      }
      hooks.expose(t.exposure);
      if (id !== "ignite") g.jobs--;
      g.minutes += t.minutes;
      g.done.push(`${hhmm(g.minutes)} ${t.name}`);
      api.checkClock();
    },
    skip() {
      if (g.phase === "dawn") {
        enterDay();
        return null;
      }
      if (g.phase === "day") {
        g.phase = "dusk";
        g.minutes = 18 * 60;
        g.jobs = DUSK_JOBS;
        return null;
      }
      if (g.phase === "dusk") {
        g.phase = "wire";
        g.minutes = 19 * 60;
        hooks.toast("무전실에서 전신기가 딸깍거리기 시작했다");
        return null;
      }
      if (g.phase === "wire") {
        enterNight();
        return null;
      }
      if (g.phase === "night") return results(hooks.nightRecord());
      return null;
    },
    nextDay() {
      const n = g.night;
      g.day++;
      g.minutes = 5 * 60;
      g.phase = "dawn";
      g.lampOn = n.lit && n.hoursLit >= 10;
      for (const k of g.knocks) k.arrived = true;
      if (g.hungry) hooks.toast("배가 고파 몸이 무겁다 · 오늘 정비는 3회");
      g.jobs = g.hungry ? DAWN_JOBS - 1 : DAWN_JOBS;
      g.done = [];
      g.night = null;
      g.tonight = [];
      g.weather = null;
      g.today = { radio: false, supply: false, tape: false };
    },
    get nightInfo() {
      const n = g.night;
      return { lit: n.lit, hoursLit: n.hoursLit, brightness: n.brightness, rotation: n.rotation, steady: n.steady, weather: story().wire.weather };
    },
    // survivors at the door: the first knock that has arrived
    get knock() {
      return g.knocks.find((k) => k.arrived && !k.answered) || null;
    },
    answerDoor(letIn) {
      const k = api.knock;
      if (!k) return;
      k.answered = true;
      if (letIn) for (let i = 0; i < k.n; i++) g.survivors.push({ from: k.from, desc: k.desc });
      else g.turnedAway += k.n;
    },
    // --- the day's information ---
    get supplyWaiting() {
      return g.phase === "day" && !!story().supply && !g.today.supply;
    },
    get supplyBoatHere() {
      return g.phase === "day" && !!story().supply;
    },
    get wireWaiting() {
      return g.phase === "wire" && !g.today.tape;
    },
    listenRadio() {
      if (g.phase !== "day") return null;
      // last night's consequences are part of today's chatter
      const lines = (story().radio || []).concat(g.pending.radio);
      if (!g.today.radio) {
        g.today.radio = true;
        g.radioLog.push({ day: g.day, lines });
      }
      return lines;
    },
    openSupply() {
      if (!api.supplyWaiting) return null;
      const sup = story().supply;
      g.today.supply = true;
      for (const [name, n] of sup.goods) {
        if (name === "석유") g.drum += n;
        if (name === "여분 맨틀") g.mantles += n;
        if (name === "식량") g.food += n;
      }
      for (const r of sup.sailor) g.rumours.push({ day: g.day, from: "보급선 선원", text: r });
      return sup;
    },
    readTape() {
      if (g.phase !== "wire") return null;
      const base = story().wire;
      // the expected-ships list comes from the actual roster, so it never names a ship that is gone
      const ships = rosterFor(g.day, g.gone)
        .filter((sp) => sp.listed)
        .map((sp) => ({ name: sp.name, kind: KIND_NAMES[sp.kind], flag: FLAG_NAMES[sp.flag], eta: sp.eta }));
      const w = { ...base, ships, notices: g.pending.notices.concat(base.notices) };
      if (!g.today.tape) {
        g.today.tape = true;
        for (const o of w.orders) {
          const i = g.orders.findIndex((x) => x.id === o.id);
          const entry = { ...o, day: g.day };
          if (i >= 0) g.orders[i] = entry;
          else g.orders.push(entry);
        }
        g.tonight = w.ships;
        g.weather = w.weather;
        for (const n of w.notices) g.notices.push({ day: g.day, text: n });
      }
      return w;
    },
    // extra mercury from the floor while a spill lies there
    get spillRate() {
      return g.spill ? 2 : 1;
    },
  };
  return api;
}
