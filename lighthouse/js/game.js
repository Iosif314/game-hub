// Day structure, clock, equipment and maintenance tasks for the 5-day build.
// Phases: dawn 05:00–08:00 (clock runs, maintenance) → day (paused for now) → dusk 18:00–19:00
// (clock runs, light the lamp) → night (paused for now) → results → next dawn.

export const DAYS = 5;
const TIME_SCALE = 0.75; // game minutes per real second while the clock runs
const PHASE_NAMES = { dawn: "새벽", day: "낮", dusk: "해 질 녘", night: "밤", results: "밤" };

export const TASKS = {
  mantle: { name: "맨틀 교체", minutes: 20, exposure: 2, phases: ["dawn", "dusk"] },
  lens: { name: "렌즈 닦기", minutes: 20, exposure: 3, phases: ["dawn", "dusk"] },
  pump: { name: "압력 펌프질", minutes: 10, exposure: 1, phases: ["dawn", "dusk"] },
  ignite: { name: "예열과 점화", minutes: 10, exposure: 1, phases: ["dusk", "night"] },
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
    eq: { mantle: 55, bath: 45, lens: 50, wound: 0, pressure: 0, tank: 40 },
    drum: 300,
    spill: false,
    done: [],
    night: null,
  };

  function enterDay() {
    g.phase = "day";
    hooks.toast("아침이 되었다. 정비 시간이 끝났다");
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

  function results() {
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
    g.phase = "results";
    return {
      day: g.day,
      last: g.day >= DAYS,
      lines: [
        ["등불", n.lit ? (n.hoursLit >= 10 ? "밤새 켜져 있었다" : `${n.hoursLit}시간 만에 꺼졌다`) : "켜지 않았다"],
        ["빛 세기", n.lit ? (n.brightness >= 0.7 ? "강함" : n.brightness >= 0.45 ? "보통" : "약함") : "-"],
        ["회전", n.rotation],
        ["석유 사용", `${Math.round(used)} (드럼 남은 양 ${Math.round(g.drum)})`],
      ],
      notes: n.notes,
      done: g.done.slice(),
      tomorrow: [
        ["맨틀", condition(e.mantle)],
        ["렌즈", condition(e.lens)],
        ["수은 욕조", condition(e.bath)],
        ["석유 탱크", condition(e.tank)],
      ],
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
      if (g.phase === "dawn") return g.spill ? "08:00까지 정비 · 렌즈실 바닥에 수은이 흘러 있다" : "08:00까지 정비";
      if (g.phase === "day") return "N  해 질 녘으로 넘기기 (낮 활동은 다음 단계에서)";
      if (g.phase === "dusk") return g.lampOn ? "N  밤으로 넘기기" : "19:00 전에 렌즈실에서 예열과 점화";
      if (g.phase === "night") return "N  새벽으로 넘기기 (배 판단은 다음 단계에서)";
      return "";
    },
    // hours used for lighting: the paused phases show midday and deep night
    get visualHours() {
      if (g.phase === "day") return 12;
      if (g.phase === "night" || g.phase === "results") return 23;
      return g.minutes / 60;
    },
    get rotating() {
      return g.lampOn && g.eq.wound > 0;
    },
    tick(dt) {
      if (g.phase !== "dawn" && g.phase !== "dusk") return;
      g.minutes += dt * TIME_SCALE;
      api.checkClock();
    },
    checkClock() {
      if (g.phase === "dawn" && g.lampOn && g.minutes >= 6 * 60) {
        g.lampOn = false;
        hooks.toast("해가 떠서 등불을 껐다");
      }
      if (g.phase === "dawn" && g.minutes >= 8 * 60) enterDay();
      if (g.phase === "dusk" && g.minutes >= 19 * 60) enterNight();
    },
    stationTasks(station) {
      return (STATIONS[station] || []).filter((id) => id !== "spill" || g.spill);
    },
    // why a task can't be done right now, or null
    blockedReason(id) {
      const t = TASKS[id];
      if (!t.phases.includes(g.phase)) return `${t.phases.map((p) => PHASE_NAMES[p]).join("·")}에만`;
      if (id === "ignite" && g.lampOn) return "이미 켜져 있음";
      if (id === "refuel" && g.drum <= 0) return "드럼이 비었음";
      return null;
    },
    status(station) {
      const e = g.eq;
      if (station === "lens") return `맨틀 ${condition(e.mantle)} · 렌즈 ${condition(e.lens)} · 압력 ${condition(e.pressure)}`;
      if (station === "filter") return `수은 욕조 ${condition(e.bath)}`;
      if (station === "wind") return e.wound > 0 ? "태엽이 감겨 있다" : "태엽이 풀려 있다";
      if (station === "drum") return `탱크 ${condition(e.tank)} · 드럼 남은 양 ${Math.round(g.drum)}`;
      return "";
    },
    complete(id, res) {
      const t = TASKS[id];
      const e = g.eq;
      if (!res || res.cancelled) {
        g.minutes += 5;
        api.checkClock();
        return;
      }
      if (id === "mantle" && res.ok) e.mantle = 100;
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
      g.minutes += t.minutes;
      g.done.push(`${hhmm(g.minutes)} ${t.name}`);
      api.checkClock();
    },
    skip() {
      if (g.phase === "day") {
        g.phase = "dusk";
        g.minutes = 18 * 60;
        return null;
      }
      if (g.phase === "dusk") {
        enterNight();
        return null;
      }
      if (g.phase === "night") return results();
      return null;
    },
    nextDay() {
      const n = g.night;
      g.day++;
      g.minutes = 5 * 60;
      g.phase = "dawn";
      g.lampOn = n.lit && n.hoursLit >= 10;
      g.done = [];
      g.night = null;
    },
    // extra mercury from the floor while a spill lies there
    get spillRate() {
      return g.spill ? 2 : 1;
    },
  };
  return api;
}
