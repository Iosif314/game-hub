import * as THREE from "three";
import { rosterFor, WEATHER_RISK } from "./nights.js";
import { buildShip } from "./ships.js";

// Runs one night: ships come one at a time along a lane that passes the reef, the keeper watches
// through the telescope and signals with the lamp. Nothing is judged here; outcomes are recorded and
// the game turns them into next-day reactions.

const SEA_Y = -12;
const LANE = 240; // metres from a ship's entry to the point where its lane passes the reef
const REEF_R = 55; // distance of that point from the tower
const DANGER = 25; // a ship this close to the reef point carries on with whatever the light shows
const STOP_AT = 60; // where a stopped ship heaves to
const SPEED = 3.1; // metres per second: about 70 s from appearing to the danger line
const ASK_COST = 15; // each signalled question lets the ship come this much closer
const QUESTIONS = { who: "정체", where: "목적지", cargo: "화물", hurt: "부상자" };

const etaMinutes = (eta) => {
  const m = /^(\d\d):(\d\d)$/.exec(eta);
  if (!m) return null;
  let t = Number(m[1]) * 60 + Number(m[2]);
  if (t < 12 * 60) t += 24 * 60; // after midnight
  return t;
};

export function createNight(scene, hooks) {
  let queue = [];
  let cur = null;
  let gap = 0;
  let ctx = null;
  const outcomes = [];
  const wrecks = [];
  let shutter = false;

  function laneOf(spec) {
    const b = (spec.bearing / 180) * Math.PI;
    const p = new THREE.Vector3(REEF_R * Math.cos(b), SEA_Y, REEF_R * Math.sin(b));
    const t = new THREE.Vector3(-Math.sin(b), 0, Math.cos(b));
    return { p, t, start: p.clone().addScaledVector(t, -LANE) };
  }

  function spawn(spec) {
    const ship = buildShip(spec);
    const lane = laneOf(spec);
    ship.position.copy(lane.start);
    ship.rotation.y = Math.atan2(-lane.t.z, lane.t.x);
    scene.add(ship);
    cur = { spec, ship, lane, s: 0, state: "approach", decision: null, asked: [], inspected: false, flash: 0, sink: 0, note: "" };
    const t = etaMinutes(spec.eta);
    hooks.setClock(t !== null ? t - 10 : null);
    hooks.toast(spec.lights ? "수평선에 불빛이 보인다" : "어둠 속에서 무언가 움직인다");
  }

  // is the light reaching the sea when this ship gets there?
  function lightOn() {
    if (shutter || !ctx.lit) return false;
    const now = hooks.getClock();
    return now === null || (now - 19 * 60) / 60 < ctx.hoursLit;
  }

  function accidentChance() {
    let p = WEATHER_RISK[ctx.weather] || 0;
    if (ctx.brightness < 0.45) p += 0.25;
    if (ctx.rotation !== "밤새 돌았다") p += 0.2;
    if (!ctx.steady) p += 0.1;
    return Math.min(0.85, p);
  }

  function finish(result, how) {
    outcomes.push({ spec: cur.spec, result, how, decision: cur.decision, inspected: cur.inspected, asked: cur.asked.slice() });
  }

  function wreck(how) {
    cur.state = "wrecking";
    cur.sink = 0;
    cur.wreckHow = how;
    const sv = cur.spec.survivors || { max: 0 };
    const min = sv.min || 0;
    const stormy = (WEATHER_RISK[ctx.weather] || 0) >= 0.2;
    const n = Math.max(min, Math.min(sv.max, min + Math.floor(Math.random() * (sv.max - min + 1)) - (stormy ? 1 : 0)));
    if (n > 0) wrecks.push({ from: cur.spec.name, n, desc: sv.desc, how, when: Math.random() < 0.5 ? "night" : "dawn" });
    hooks.toast(`${cur.spec.name} · 암초에 부딪혔다`);
  }

  function advance(dist) {
    cur.s = Math.min(cur.s + dist, LANE * 2);
    cur.ship.position.copy(cur.lane.start).addScaledVector(cur.lane.t, cur.s);
  }

  const api = {
    get active() {
      return cur;
    },
    get shutter() {
      return shutter;
    },
    get remaining() {
      return queue.length + (cur ? 1 : 0);
    },
    outcomes,
    wrecks,
    start(day, info, gone = new Set()) {
      ctx = info;
      queue = rosterFor(day, gone);
      outcomes.length = 0;
      wrecks.length = 0;
      shutter = false;
      gap = 3;
    },
    // distance left before the ship is committed
    get distance() {
      return cur ? Math.max(0, Math.round(LANE - DANGER - cur.s)) : 0;
    },
    ask(key) {
      if (!cur || (cur.state !== "approach" && cur.state !== "stopped")) return null;
      const dim = ctx.brightness < 0.45 && Math.random() < 0.4;
      const answer = dim ? "(응답이 없다 · 빛이 약해 신호를 못 본 것 같다)" : cur.spec.answers[key];
      cur.asked.push([QUESTIONS[key], answer]);
      cur.flash = 1.5;
      if (cur.state === "approach") advance(ASK_COST);
      return answer;
    },
    decide(action) {
      if (!cur || cur.state !== "approach") return;
      if (action === "guide") {
        cur.decision = "guide";
        cur.state = "guided";
      } else if (action === "stop") {
        cur.decision = "stop";
        if (cur.spec.ignoresStop) {
          cur.note = "정지 신호를 무시하고 그대로 온다";
          cur.state = "guided";
        } else cur.state = "stopping";
      } else if (action === "shutter") {
        cur.decision = "shutter";
        shutter = true;
        cur.state = "guided";
        hooks.toast("차광막을 닫았다 · 등대 빛이 바다에 닿지 않는다");
      }
    },
    afterStop(choice) {
      if (!cur || cur.state !== "stopped") return;
      cur.inspected = true;
      if (choice === "send") {
        cur.decision = "stop-send";
        cur.state = "guided";
      } else {
        cur.decision = "stop-detain";
        finish("detained", "detain");
        cur.state = "anchored";
        gap = 5;
      }
    },
    update(dt) {
      if (!ctx) return;
      if (!cur) {
        if (!queue.length) return;
        gap -= dt;
        if (gap <= 0) spawn(queue.shift());
        return;
      }
      const ship = cur.ship;
      // flag flutter and the answering lamp blinking
      if (ship.userData.flagMesh) ship.userData.flagMesh.rotation.y = Math.sin(performance.now() / 300) * 0.25;
      if (cur.flash > 0) cur.flash -= dt;
      const blink = cur.flash > 0 ? Math.floor(cur.flash * 6) % 2 === 0 : true;
      for (const l of ship.userData.lamps) l.visible = blink && !(cur.spec.flicker && Math.random() < 0.15);

      if (cur.state === "approach") {
        advance(SPEED * dt);
        if (cur.spec.sinks && cur.s >= LANE - 30) {
          wreck("sank");
          return;
        }
        // nobody decided: the ship sails on with whatever the light shows
        if (cur.s >= LANE - DANGER) {
          cur.decision = cur.decision || "none";
          cur.state = "guided";
        }
      } else if (cur.state === "stopping") {
        advance(Math.min(SPEED * dt, Math.max(0, LANE - STOP_AT - cur.s)));
        if (cur.s >= LANE - STOP_AT - 0.01) cur.state = "stopped";
      } else if (cur.state === "guided") {
        const before = cur.s;
        advance(SPEED * 1.4 * dt);
        if (before < LANE && cur.s >= LANE) {
          if (cur.spec.sinks) return wreck("sank");
          if (!lightOn()) return wreck(cur.decision === "shutter" ? "shutter" : "dark");
          if (Math.random() < accidentChance()) return wreck("accident");
        }
        if (cur.s >= LANE * 2 - 1) {
          finish("passed", cur.decision);
          scene.remove(ship);
          cur = null;
          gap = 4;
        }
      } else if (cur.state === "wrecking") {
        cur.sink += dt;
        const body = ship.userData.body;
        body.rotation.x = Math.min(0.5, cur.sink * 0.08);
        body.position.y -= dt * 0.6;
        if (cur.sink > 9) {
          finish("wrecked", cur.wreckHow);
          scene.remove(ship);
          cur = null;
          gap = 5;
          if (shutter) {
            shutter = false;
            hooks.toast("차광막을 다시 열었다");
          }
        }
      } else if (cur.state === "anchored") {
        gap -= dt;
        if (gap <= 0) {
          cur.ship.visible = false;
          scene.remove(ship);
          cur = null;
          gap = 3;
        }
      }
    },
    // N during the night: let whatever is left play out by default
    resolveRest() {
      const rest = [];
      if (cur && (cur.state === "approach" || cur.state === "guided" || cur.state === "stopping" || cur.state === "stopped")) rest.push(cur);
      else if (cur && cur.state === "wrecking") {
        finish("wrecked", cur.wreckHow);
      }
      if (cur) scene.remove(cur.ship);
      for (const r of rest) {
        cur = r;
        if (r.state === "stopped") {
          finish("passed", "stop-send");
          continue;
        }
        r.decision = r.decision || "none";
        if (r.spec.sinks) wreck("sank");
        else if (!lightOn()) wreck(r.decision === "shutter" ? "shutter" : "dark");
        else if (Math.random() < accidentChance()) wreck("accident");
        else {
          finish("passed", r.decision);
          continue;
        }
        finish("wrecked", r.wreckHow);
      }
      for (const spec of queue) {
        cur = { spec, decision: "none", asked: [], inspected: false };
        if (spec.sinks) wreck("sank");
        else if (!lightOn()) wreck("dark");
        else if (Math.random() < accidentChance()) wreck("accident");
        else {
          finish("passed", "none");
          continue;
        }
        finish("wrecked", cur.wreckHow);
      }
      queue = [];
      cur = null;
      shutter = false;
    },
  };
  return api;
}

export { QUESTIONS };
