import * as THREE from "three";
import { buildWorld, animateWorld, setTimeOfDay, addSurvivorModel, groundAt, blocked, hardBlocked, zoneOf } from "./world.js";
import { createNight } from "./night.js";
import { createGame, TASKS, DAYS } from "./game.js";
import { createCloseup } from "./closeup.js";

// mosaic grid; the scene is rendered SS× larger and averaged down per block
const W = 288;
const H = 162;
const SS = 5;
const EYE = 1.6;
const SPEED = 2.6;
const REACH = 2.6;
const GRAVITY = 14;

const $ = (id) => document.getElementById(id);
const view = $("view");
const overlay = $("overlay");
const overlayHint = $("overlay-hint");
const promptEl = $("prompt");
const toastEl = $("toast");
const debugEl = $("debug");
const debugText = $("debug-text");
const slider = $("mercury-slider");
const clockEl = $("clock");
const hintEl = $("hint");
const menuEl = $("menu");
const resultsEl = $("results");
const paperEl = $("paper");
const scopeEl = $("scope");
const crosshairEl = $("crosshair");

// --- renderer: full-quality render into an HDR target, then each mosaic block is averaged
// and dithered to four greys ---
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: false });
renderer.setPixelRatio(1);
renderer.autoClear = false;
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;

const rt = new THREE.WebGLRenderTarget(W * SS, H * SS, {
  type: THREE.HalfFloatType,
  samples: 4,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
});
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postUniforms = {
  tDiffuse: { value: rt.texture },
  grid: { value: new THREE.Vector2(W, H) },
  exposure: { value: 1.15 },
  // how much of each step between greys is dithered: 1 = all of it (grainy), lower = only the middle,
  // the rest snaps to the nearer grey
  dither: { value: 0.45 },
};
postScene.add(
  new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: postUniforms,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 grid;
        uniform float exposure;
        uniform float dither;
        varying vec2 vUv;
        // interleaved gradient noise: an evenly spread threshold with no regular cross-hatch
        float ign(vec2 p){ return fract(52.9829189 * fract(dot(floor(p), vec2(0.06711056, 0.00583715)))); }
        float aces(float x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        float tone(vec3 c){ return pow(aces(dot(c, vec3(0.2126, 0.7152, 0.0722)) * exposure), 1.0 / 2.2); }
        vec3 grey(float i){
          if (i < 0.5) return vec3(0.086, 0.082, 0.090);
          if (i < 1.5) return vec3(0.29, 0.282, 0.263);
          if (i < 2.5) return vec3(0.541, 0.525, 0.486);
          return vec3(0.769, 0.749, 0.694);
        }
        vec3 quantise(float l, float t){
          float s = l * 3.0;
          return grey(clamp(floor(s) + step(t, fract(s)), 0.0, 3.0));
        }
        void main(){
          // box-average the block this output pixel covers (4x4 bilinear taps over the supersampled image)
          vec3 c = vec3(0.0);
          for (int y = 0; y < 4; y++) {
            for (int x = 0; x < 4; x++) {
              vec2 o = (vec2(float(x), float(y)) + 0.5) / 4.0 - 0.5;
              c += texture2D(tDiffuse, vUv + o / grid).rgb;
            }
          }
          c /= 16.0;
          // the lamp is the only saturated warm thing in the scene; everything else goes grey
          float glow = smoothstep(0.15, 0.55, c.r - c.b);
          vec3 outc = quantise(tone(c), 0.5 + (ign(gl_FragCoord.xy) - 0.5) * dither);
          gl_FragColor = vec4(mix(outc, vec3(1.0, 0.93, 0.74), glow), 1.0);
        }`,
    }),
  ),
);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, W / H, 0.05, 900);
camera.rotation.order = "YXZ";
const world = buildWorld(scene);
// point-sampled textures with mip levels, as tuned for this look
scene.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    if (!m.map) continue;
    m.map.magFilter = THREE.NearestFilter;
    m.map.minFilter = THREE.NearestMipmapNearestFilter;
    m.map.needsUpdate = true;
  }
});

// --- player ---
const player = { pos: world.spawn.clone(), vy: 0, yaw: 0, pitch: 0, eyeY: world.spawn.y + EYE };
{
  const desk = new THREE.Vector3(3.2 * Math.cos((318 / 180) * Math.PI), 0, 3.2 * Math.sin((318 / 180) * Math.PI));
  player.yaw = Math.atan2(-(desk.x - player.pos.x), -(desk.z - player.pos.z));
}
let mercury = 0;

const keys = new Set();
let mode = "menu";
let debugOn = false;

const closeup = createCloseup($("closeup"), $("closeup-help"));

// unadjustedMovement skips OS acceleration and avoids Chrome's occasional bogus movement spikes
function lockPointer() {
  let req;
  try {
    req = view.requestPointerLock({ unadjustedMovement: true });
  } catch {
    req = null;
  }
  if (req && req.catch) req.catch(() => view.requestPointerLock());
}
overlay.addEventListener("click", lockPointer);
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === view) {
    mode = "play";
    overlay.classList.add("hidden");
  } else if (mode === "play" || mode === "scope") {
    if (scope) exitScope();
    showMenu("클릭해서 계속");
  }
});

function showMenu(hint) {
  mode = "menu";
  closeMenu();
  overlayHint.textContent = hint;
  overlay.classList.remove("hidden");
  keys.clear();
}

document.addEventListener("mousemove", (e) => {
  if (mode !== "play" && mode !== "scope") return;
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) {
    diag.lookSpikes++;
    diag.lastSpike = `${e.movementX}, ${e.movementY}`;
    console.warn("ignored mouse spike", e.movementX, e.movementY);
    return;
  }
  if (scope) {
    // finer aim when zoomed in
    const k = 0.0022 * (scope.fov / 70);
    scope.yaw -= e.movementX * k;
    scope.pitch = Math.max(-0.6, Math.min(0.3, scope.pitch - e.movementY * k));
    return;
  }
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022));
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Tab") {
    e.preventDefault();
    debugOn = !debugOn;
    debugEl.classList.toggle("hidden", !debugOn);
    return;
  }
  if (closeup.active) {
    if (e.code === "Escape") closeup.cancel();
    else closeup.key(e.code);
    return;
  }
  if (reading) {
    if (reading.kind === "door" && (e.code === "Digit1" || e.code === "Digit2")) answerDoor(e.code === "Digit1");
    else if (e.code === "Space") {
      e.preventDefault();
      advanceRadio();
    } else if ((e.code === "KeyE" || e.code === "Escape") && reading.kind !== "door") closePaper();
    else if (e.code === "Escape") closePaper();
    return;
  }
  if (mode === "scope") {
    if (e.code === "KeyE" || e.code === "Escape") exitScope();
    else if (e.code.startsWith("Digit")) signalKey(e.code);
    else if (e.code === "KeyN") {
      exitScope();
      skipPhase();
    }
    return;
  }
  if (mode !== "play") return;
  if (menu) {
    const n = Number(e.code.replace("Digit", ""));
    if (e.code.startsWith("Digit") && n >= 1) chooseTask(n - 1);
    else if (e.code === "KeyE") closeMenu();
    return;
  }
  keys.add(e.code);
  if (e.code === "KeyE" && target) interact(target.userData.interact);
  if (e.code === "KeyG" && holding) putDownLantern();
  if (e.code === "KeyN") skipPhase();
});
document.addEventListener("keyup", (e) => keys.delete(e.code));
document.addEventListener("wheel", (e) => {
  if (!scope) return;
  scope.fov = Math.max(3, Math.min(24, scope.fov * (e.deltaY > 0 ? 1.12 : 0.89)));
});

slider.addEventListener("input", () => {
  mercury = Number(slider.value);
});

// --- interaction ---
const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const center = new THREE.Vector2(0, 0);
let target = null;

const NOT_YET = {
  survivor: "……  (생존자 대화는 4단계에서)",
  telescope: "망원경 · 밤의 배 판단은 다음 단계에서",
};

let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastTimer = 2.5;
}

// --- day structure and maintenance ---
const game = createGame({
  toast,
  expose(amount) {
    mercury = Math.max(0, Math.min(100, mercury + amount));
  },
  nightHint: () => nightHint(),
  nightRecord: () => ({ outcomes: night.outcomes.slice(), wrecks: night.wrecks.slice() }),
});

// station menu: pick a task with the number keys so the pointer can stay locked
let menu = null; // { station, tasks }
function openMenu(station) {
  const tasks = game.stationTasks(station);
  menu = { station, tasks };
  const rows = tasks.map((id, i) => {
    const t = TASKS[id];
    const why = game.blockedReason(id);
    return `<div class="${why ? "off" : ""}">${i + 1}  ${t.name}${why ? `  (${why})` : ""}</div>`;
  });
  const left = game.state.phase === "dawn" || game.state.phase === "dusk" ? ` · 정비 ${game.state.jobs}회 남음` : "";
  menuEl.innerHTML = `<div class="menu-status">${game.status(station)}${left}</div>${rows.join("")}<div class="menu-foot">번호로 선택 · E 닫기</div>`;
  menuEl.classList.remove("hidden");
}
function closeMenu() {
  menu = null;
  menuEl.classList.add("hidden");
}
function chooseTask(i) {
  const id = menu && menu.tasks[i];
  if (!id) return;
  const why = game.blockedReason(id);
  if (why) {
    toast(`${TASKS[id].name} · ${why}`);
    return;
  }
  closeMenu();
  if (id === "spill") {
    toast("쏟아진 수은을 모았다");
    game.complete("spill", {});
    return;
  }
  mode = "closeup";
  keys.clear();
  promptEl.textContent = "";
  document.exitPointerLock();
  closeup.open(id, { mercury: () => mercury, eq: game.state.eq, drum: game.state.drum, mantles: game.state.mantles }, (res) => {
    // toast first so a phase change announced by complete() is the message left on screen
    if (!res.cancelled) toast(`${TASKS[id].name} 완료`);
    game.complete(id, res);
    showMenu("클릭해서 계속");
  });
}

function skipPhase() {
  // N at night lets the remaining ships play out by default
  if (game.state.phase === "night" && night.remaining > 0) night.resolveRest();
  const summary = game.skip();
  if (game.state.phase === "night" && nightDay !== game.state.day) {
    nightDay = game.state.day;
    night.start(game.state.day, game.nightInfo, game.state.gone);
    // fog and storms close in the view
    const w = game.nightInfo.weather;
    world.weatherFog = /안개/.test(w) ? 0.35 : /폭풍/.test(w) ? 0.45 : /비/.test(w) ? 0.7 : 1;
  }
  if (summary) showResults(summary);
}

function showResults(r) {
  world.weatherFog = 1;
  mode = "results";
  keys.clear();
  closeMenu();
  document.exitPointerLock();
  const rows = (list) => list.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
  resultsEl.innerHTML = `
    <h2>${r.day}일차 밤</h2>
    <table>${rows(r.lines)}</table>
    ${r.notes.length ? `<ul class="notes">${r.notes.map((n) => `<li>${n}</li>`).join("")}</ul>` : ""}
    ${r.ships.length ? `<h3>오늘 밤 배</h3><table>${rows(r.ships)}</table>` : ""}
    <h3>오늘 한 일</h3>
    <div class="done">${r.done.length ? r.done.join("<br>") : "아무것도 하지 않았다"}</div>
    <h3>다음 날 장비 상태</h3>
    <table>${rows(r.tomorrow)}</table>
    ${
      r.final
        ? `<h3>여섯째 날 아침에 올 소식</h3><div class="done">${r.final.notices.concat(r.final.radio).join("<br>") || "조용하다"}</div><h3>본부의 의심</h3><div class="done">${r.final.suspicion}</div>`
        : ""
    }
    <div class="hint">${r.last ? "시험판의 마지막 날이에요 · 클릭하면 처음부터" : "클릭해서 다음 날로"}</div>`;
  resultsEl.classList.remove("hidden");
}
resultsEl.addEventListener("click", () => {
  resultsEl.classList.add("hidden");
  if (game.state.day >= DAYS) {
    location.reload();
    return;
  }
  game.nextDay();
  showMenu(`${game.state.day}일차 · 클릭해서 시작`);
});

// --- reading screens: radio, telegraph tape, supply crate, logbook ---
// they keep the pointer locked: Space shows the next radio line, E closes
let reading = null; // { kind, lines?, shown?, timer? }
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function openPaper(kind, html, extra = {}) {
  reading = { kind, ...extra };
  mode = "reading";
  keys.clear();
  closeMenu();
  promptEl.textContent = "";
  paperEl.className = `paper-${kind}`;
  paperEl.innerHTML = html;
  paperEl.classList.remove("hidden");
}

function closePaper() {
  reading = null;
  paperEl.classList.add("hidden");
  if (document.pointerLockElement === view) mode = "play";
  else showMenu("클릭해서 계속");
}

function radioLineHtml([who, text]) {
  return `<div class="line">${who ? `<span class="who">${esc(who)}</span>` : ""}<span>${esc(text)}</span></div>`;
}

function openRadio() {
  const lines = game.listenRadio();
  if (!lines) {
    toast("치지직…… 낮에만 교신이 잡힌다");
    return;
  }
  openPaper("radio", `<div class="head">무전 · ${game.state.day}일차 낮</div><div class="body"></div><div class="foot">Space 다음 · E 닫기</div>`, {
    lines,
    shown: 0,
    timer: 0,
  });
  advanceRadio();
}

function advanceRadio() {
  if (!reading || reading.kind !== "radio" || reading.shown >= reading.lines.length) return;
  paperEl.querySelector(".body").insertAdjacentHTML("beforeend", radioLineHtml(reading.lines[reading.shown]));
  reading.shown++;
  reading.timer = 0;
  if (reading.shown >= reading.lines.length) paperEl.querySelector(".foot").textContent = "교신이 끊겼다 · E 닫기";
}

function openTape() {
  const w = game.readTape();
  if (!w) {
    toast(game.state.phase === "dusk" ? "해 질 녘 일정을 마치면 전신이 온다" : "전신기가 조용하다");
    return;
  }
  const rows = [];
  rows.push(`== 해안 본부 → 암초 등대 · ${game.state.day}일차 ==`);
  if (w.orders.length) {
    rows.push("[지침]");
    for (const o of w.orders) rows.push(`${o.changed ? "(변경) " : ""}${o.text}`);
  }
  rows.push("[입항 예정]");
  for (const sh of w.ships) rows.push(`${sh.eta}  ${sh.kind} ${sh.name} · ${sh.flag}`);
  rows.push(`[날씨] ${w.weather}`);
  for (const n of w.notices) rows.push(`[공문] ${n}`);
  rows.push("== 끝 ==");
  openPaper("tape", `<div class="strip">${rows.map((r) => `<div>${esc(r)}</div>`).join("")}</div><div class="foot">E 닫기 · 일지에 옮겨 적었다</div>`);
}

function openSupply() {
  const sup = game.openSupply();
  if (!sup) return;
  const goods = sup.goods.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
  const news = sup.newspaper;
  openPaper(
    "supply",
    `<div class="head">보급품 · ${game.state.day}일차</div>
     <table>${goods}</table>
     <div class="news"><div class="news-title">${esc(news.title)}</div>${news.lines.map((l) => `<div>${esc(l)}</div>`).join("")}</div>
     <div class="sub">선원이 한 말</div>
     ${sup.sailor.map((r) => `<div class="quote">“${esc(r)}”</div>`).join("")}
     <div class="foot">E 닫기</div>`,
  );
}

function openLogbook() {
  const s = game.state;
  const list = (items, empty) => (items.length ? items.join("") : `<div class="empty">${empty}</div>`);
  const orders = list(
    s.orders.map((o) => `<div class="item"><span class="day">${o.day}일</span>${o.changed ? "(변경) " : ""}${esc(o.text)}</div>`),
    "받은 지침이 없다",
  );
  const ships = list(
    s.tonight.map((sh) => `<div class="item"><span class="day">${esc(sh.eta)}</span>${esc(sh.kind)} ${esc(sh.name)} · ${esc(sh.flag)}</div>`),
    s.today.tape ? "예정된 배가 없다" : "오늘 밤 전신을 아직 받지 않았다",
  );
  const notices = list(s.notices.map((n) => `<div class="item"><span class="day">${n.day}일</span>${esc(n.text)}</div>`), "없음");
  const rumours = list(s.rumours.map((r) => `<div class="item"><span class="day">${r.day}일</span>${esc(r.text)}</div>`), "들은 소문이 없다");
  const radio = list(
    s.radioLog.map((r) => `<div class="item"><span class="day">${r.day}일</span>${r.lines.filter(([w]) => w).map(([w, t]) => `${esc(w)}: ${esc(t)}`).join("<br>")}</div>`),
    "기록된 교신이 없다",
  );
  openPaper(
    "log",
    `<div class="head">등대 일지 · ${s.day}일차</div>
     <div class="sub">현재 지침</div>${orders}
     <div class="sub">오늘 밤 입항 예정${s.weather ? ` · 날씨 ${esc(s.weather)}` : ""}</div>${ships}
     <div class="sub">공문</div>${notices}
     <div class="sub">들은 소문</div>${rumours}
     <div class="sub">무전 기록</div>${radio}
     <div class="foot">E 닫기</div>`,
  );
}

// --- the night: ships, the telescope and signal lamp, survivors at the door ---
const night = createNight(scene, {
  toast,
  setClock(m) {
    const s = game.state;
    if (m === null) s.minutes += 45;
    else if (m > s.minutes) s.minutes = m;
  },
  getClock: () => game.state.minutes,
});
let nightDay = 0;

function nightHint() {
  if (game.knock) return "누군가 등대 문을 두드린다 · 무전실 문";
  if (night.remaining > 0) return `난간의 망원경으로 바다를 지켜보기 · 남은 배 ${night.remaining}척 · N 남은 배 넘기기`;
  return "오늘 밤 배는 모두 지나갔다 · N 새벽으로";
}

// survivors of a wreck reach the door either later the same night or at dawn
function updateKnocks(dt) {
  for (const w of night.wrecks) {
    if (w.when !== "night" || w.arrived) continue;
    if (w.timer === undefined) w.timer = 10 + Math.random() * 25;
    w.timer -= dt;
    if (w.timer <= 0) {
      w.arrived = true;
      if (!game.state.knocks.includes(w)) game.state.knocks.push(w);
      toast("쾅, 쾅…… 누군가 등대 문을 두드린다");
    }
  }
}

function openDoor() {
  const k = game.knock;
  if (!k) {
    toast("문밖에는 파도 소리뿐이다");
    return;
  }
  const by = k.how === "shutter" ? "<div class=\"quote\">“불이…… 등대 불이 갑자기 꺼졌어요……”</div>" : "";
  openPaper(
    "door",
    `<div class="head">문밖에 누군가 있다</div>
     <div>${esc(k.desc)}</div>
     <div class="sub">${esc(k.from)}에서 살아남은 사람 ${k.n}명</div>${by}
     <div class="sub">식량 ${game.state.food}일치 · 등대에 있는 사람 ${1 + game.state.survivors.length}명</div>
     <div class="foot">1 들여보낸다 · 2 내보낸다</div>`,
  );
}

function answerDoor(letIn) {
  const k = game.knock;
  if (!k) return;
  const before = game.state.survivors.length;
  game.answerDoor(letIn);
  if (letIn) {
    for (let i = before; i < game.state.survivors.length; i++) addSurvivorModel(world, scene, i, game.state.survivors[i]);
    toast("문을 열어 들여보냈다");
  } else toast("문을 열지 않았다. 발소리가 멀어진다");
  closePaper();
}

// telescope: the view from the eyepiece, with the signal lamp worked from the same spot
let scope = null; // { yaw, pitch, fov, refresh }
function enterScope() {
  const b = world.telescope.bearing;
  scope = { yaw: Math.atan2(-Math.cos(b), -Math.sin(b)), pitch: -0.2, fov: 14, refresh: 0 };
  mode = "scope";
  keys.clear();
  promptEl.textContent = "";
  scopeEl.classList.remove("hidden");
  menuEl.classList.add("in-scope");
  crosshairEl.style.display = "none";
  postUniforms.exposure.value = 1.7;
  // the beam's haze would wash out the boosted eyepiece view whenever it sweeps past
  world.env.beamMat.opacity = 0.06;
  renderSignal();
}
function exitScope() {
  scope = null;
  scopeEl.classList.add("hidden");
  menuEl.classList.remove("in-scope");
  crosshairEl.style.display = "";
  menuEl.classList.add("hidden");
  postUniforms.exposure.value = 1.15;
  world.env.beamMat.opacity = 0.16;
  camera.fov = 70;
  camera.updateProjectionMatrix();
  if (mode === "scope") mode = "play";
}

function renderSignal() {
  const a = night.active;
  let html;
  if (game.state.phase !== "night") {
    html = `<div class="menu-status">밤이 되면 지나가는 배를 여기서 지켜본다</div>`;
  } else if (!a) {
    html = `<div class="menu-status">바다가 조용하다${night.remaining ? " · 다음 배를 기다린다" : " · 오늘 밤 배는 모두 지나갔다"}</div>`;
  } else {
    const head = `${a.spec.lights ? "불빛을 단 배" : "불 꺼진 배"} · 위험선까지 ${night.distance}m${night.shutter ? " · 차광막 닫힘" : ""}`;
    const asked = a.asked.map(([q, ans]) => `<div>${esc(q)}: ${esc(ans)}</div>`).join("");
    let body = "";
    if (a.note) body += `<div>${esc(a.note)}</div>`;
    if (a.state === "approach") {
      body += `<div>1 정체 · 2 목적지 · 3 화물 · 4 부상자 (물을수록 배가 다가온다)</div><div>5 인도한다 · 6 멈춰 세운다 · 7 차광막을 닫는다</div>`;
    } else if (a.state === "stopping") body += "<div>배가 멈추고 있다……</div>";
    else if (a.state === "stopped") body += `<div>검문: ${esc(a.spec.inspect)}</div><div>1 보낸다 · 2 억류하고 본부에 알린다</div>`;
    else if (a.state === "guided") body += `<div>${a.decision === "shutter" ? "빛을 가렸다" : a.decision === "guide" || a.decision === "stop-send" ? "빛을 따라 지나간다" : "아무 신호도 보내지 않았다"}</div>`;
    else if (a.state === "wrecking") body += "<div>배가 암초에 걸려 기울어진다……</div>";
    else if (a.state === "anchored") body += "<div>배를 억류하고 본부에 알렸다</div>";
    html = `<div class="menu-status">${head}</div>${asked}${body}`;
  }
  menuEl.innerHTML = `${html}<div class="menu-foot">휠 확대 · E 망원경에서 눈 떼기</div>`;
  menuEl.classList.remove("hidden");
}

function signalKey(code) {
  const a = night.active;
  if (!a || game.state.phase !== "night") return;
  const n = Number(code.replace("Digit", ""));
  if (a.state === "approach") {
    const asks = ["who", "where", "cargo", "hurt"];
    if (n >= 1 && n <= 4) night.ask(asks[n - 1]);
    if (n === 5) night.decide("guide");
    if (n === 6) night.decide("stop");
    if (n === 7) night.decide("shutter");
  } else if (a.state === "stopped") {
    if (n === 1) night.afterStop("send");
    if (n === 2) night.afterStop("detain");
  }
  renderSignal();
}

function interact(info) {
  if (info.id === "lantern") {
    pickUpLantern();
    return;
  }
  if (info.id === "lens" || info.id === "filter" || info.id === "wind" || info.id === "drum") {
    openMenu(info.id);
    return;
  }
  if (info.id === "radio") return openRadio();
  if (info.id === "tape") return openTape();
  if (info.id === "crate") return openSupply();
  if (info.id === "logbook") return openLogbook();
  if (info.id === "telescope") return enterScope();
  if (info.id === "door") return openDoor();
  if (info.id === "survivor") return toast(`${info.from}에서 온 사람 · ${info.desc}  (대화는 다음 단계에서)`);
  toast(NOT_YET[info.id] || info.label);
}

function findTarget() {
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(world.solids.concat(world.interactables), true);
  const hit = hits[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !o.userData.interact) o = o.parent;
  if (!o || !o.visible) return null;
  const reach = o.userData.reach || REACH;
  return hit.distance <= reach ? o : null;
}

// --- the carried lantern: drawn in its own pass over the scene so it never clips into walls ---
const heldScene = new THREE.Scene();
heldScene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 0.35));
const heldGlow = new THREE.PointLight(0xffffff, 0.25, 0.6, 2);
heldScene.add(heldGlow);
const heldCam = new THREE.PerspectiveCamera(70, W / H, 0.01, 10);
const HOLD = new THREE.Vector3(0.36, -0.5, -0.72); // lantern base in camera space, hanging from the right hand
let holding = false;
let walkPhase = 0;
const lanternFlame = new THREE.Vector3();

function setLanternShadows(on) {
  world.lantern.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) o.castShadow = on;
  });
}

function pickUpLantern() {
  holding = true;
  scene.remove(world.lantern);
  heldScene.add(world.lantern);
  world.lantern.position.copy(HOLD);
  world.lantern.rotation.set(0, 0, 0);
  const i = world.interactables.indexOf(world.lantern);
  if (i >= 0) world.interactables.splice(i, 1);
  setLanternShadows(false);
  world.lanternLight.intensity = 2.2;
  toast("랜턴을 들었다 · G로 내려놓기");
}

function putDownLantern() {
  // on the flat surface under the crosshair if it's within reach, otherwise just in front of your feet
  camera.position.set(player.pos.x, player.eyeY, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(center, camera);
  let spot = null;
  const hit = raycaster.intersectObjects(world.solids, true)[0];
  if (hit && hit.face) {
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (Math.abs(n.y) > 0.7 && hit.point.y < camera.position.y - 0.3) spot = hit.point.clone();
  }
  if (!spot) {
    const p = player.pos.clone().add(new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)).multiplyScalar(0.5));
    const g = groundAt(p.x, p.z, player.pos.y);
    spot = blocked(p.x, p.z, player.pos.y) || g === -Infinity ? player.pos.clone() : new THREE.Vector3(p.x, g, p.z);
  }
  holding = false;
  heldScene.remove(world.lantern);
  scene.add(world.lantern);
  world.lantern.position.copy(spot);
  world.lantern.rotation.set(0, player.yaw, 0);
  setLanternShadows(true);
  world.lanternLight.intensity = 3.5;
  world.interactables.push(world.lantern);
  world.lanternLight.position.copy(spot).add(new THREE.Vector3(0, world.lantern.userData.flameY, 0));
}

// sway with each step, plus the mercury tremor in the hand (the only place the tremor shows in 3D)
function updateHeldLantern(dt, t, moved) {
  const L = world.lantern;
  walkPhase += dt * (moved ? 7 : 0);
  const shake = mercury / 100;
  L.position.set(
    HOLD.x + Math.sin(walkPhase) * 0.012 + (Math.sin(t * 13.1) * 0.6 + Math.sin(t * 7.7 + 1.3) * 0.4) * shake * 0.02,
    HOLD.y + Math.abs(Math.cos(walkPhase)) * 0.01 + Math.sin(t * 11.3 + 0.7) * shake * 0.012,
    HOLD.z,
  );
  L.rotation.z = Math.sin(walkPhase) * 0.06 + Math.sin(t * 9.1) * shake * 0.08;
  L.rotation.x = Math.sin(t * 1.3) * 0.02;
  lanternFlame.set(L.position.x, L.position.y + L.userData.flameY, L.position.z);
  heldGlow.position.copy(lanternFlame);
  camera.updateMatrixWorld();
  world.lanternLight.position.copy(camera.localToWorld(lanternFlame.clone()));
}

// --- movement ---
function move(dt) {
  const fwd = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const side = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  let dx = 0;
  let dz = 0;
  if (fwd || side) {
    const len = Math.hypot(fwd, side);
    const s = (SPEED * dt) / len;
    dx = (-Math.sin(player.yaw) * fwd + Math.cos(player.yaw) * side) * s;
    dz = (-Math.cos(player.yaw) * fwd - Math.sin(player.yaw) * side) * s;
  }
  const p = player.pos;
  // if the player is somehow already inside a blocked spot, only the tower shell stops them, so they can walk out
  const test = blocked(p.x, p.z, p.y) ? hardBlocked : blocked;
  // try each axis separately so walls slide instead of stopping dead
  for (const [ax, d] of [
    ["x", dx],
    ["z", dz],
  ]) {
    if (!d) continue;
    const nx = ax === "x" ? p.x + d : p.x;
    const nz = ax === "z" ? p.z + d : p.z;
    const g = groundAt(nx, nz, p.y);
    const ny = Math.max(p.y, g);
    if (g === -Infinity || test(nx, nz, ny)) continue;
    p.x = nx;
    p.z = nz;
  }
  const g = groundAt(p.x, p.z, p.y);
  if (g >= p.y) {
    p.y = g;
    player.vy = 0;
  } else {
    player.vy -= GRAVITY * dt;
    p.y = Math.max(g, p.y + player.vy * dt);
    if (p.y === g) player.vy = 0;
  }
  player.eyeY += (p.y + EYE - player.eyeY) * Math.min(1, dt * 14);
}

function updateMercury(dt, zone) {
  // per real second; a mercury spill on the lantern floor doubles what the room gives off
  const rate = { lantern: 0.12 * game.spillRate, gallery: -0.2, radio: -0.03, stairs: -0.03 }[zone];
  mercury = Math.max(0, Math.min(100, mercury + rate * dt));
  if (document.activeElement !== slider) slider.value = String(Math.round(mercury));
}

// --- loop ---
const clock = new THREE.Clock();
let fpsAcc = 0;
let fpsFrames = 0;
let fps = 0;

// diagnostics for the "snapped back" report: position jumps vs. long frame stalls
const diag = { jumps: 0, lastJump: "-", hitches: 0, lastHitch: "-", lookSpikes: 0, lastSpike: "-" };
const before = new THREE.Vector3();

// one frame of simulation and drawing (also callable from the dev hook)
function update(dt, t) {
  if (closeup.active) {
    closeup.update(dt);
    return;
  }

  clockEl.textContent = game.clockText();
  hintEl.textContent = game.hint() + (game.knock && game.state.phase !== "night" ? " · 누군가 문을 두드린다" : "");
  before.copy(player.pos);
  if (mode === "play") move(dt);
  const jumped = before.distanceTo(player.pos);
  if (jumped > 0.4) {
    diag.jumps++;
    diag.lastJump = `${jumped.toFixed(2)}m (${before.x.toFixed(1)},${before.y.toFixed(1)},${before.z.toFixed(1)} -> ${player.pos.x.toFixed(1)},${player.pos.y.toFixed(1)},${player.pos.z.toFixed(1)})`;
    console.warn("position jump", diag.lastJump);
  }
  const zone = zoneOf(player.pos);
  updateMercury(dt, zone);

  if (scope) {
    camera.position.copy(world.telescope.eye);
    camera.rotation.set(scope.pitch, scope.yaw, 0);
    if (camera.fov !== scope.fov) {
      camera.fov = scope.fov;
      camera.updateProjectionMatrix();
    }
    scope.refresh -= dt;
    if (scope.refresh <= 0) {
      scope.refresh = 0.2;
      renderSignal();
    }
  } else {
    camera.position.set(player.pos.x, player.eyeY, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  }
  if (holding) updateHeldLantern(dt, t, jumped > 0.0005);
  animateWorld(world, t);
  if (game.state.phase === "night") {
    night.update(dt);
    updateKnocks(dt);
  }
  setTimeOfDay(world, game.visualHours, game.state.lampOn, game.rotating, dt, game.state.phase === "night" && night.shutter);
  world.supply.crate.visible = game.supplyWaiting;
  world.supply.boat.visible = game.supplyBoatHere;
  if (reading && reading.kind === "radio") {
    reading.timer += dt;
    if (reading.timer > 1.8) advanceRadio();
  }

  target = mode === "play" ? findTarget() : null;
  promptEl.textContent = target ? `E  ${target.userData.interact.label}` : "";

  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, camera);
  if (holding && !scope) {
    renderer.clearDepth();
    renderer.render(heldScene, heldCam);
  }
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);

  if (debugOn) {
    const p = player.pos;
    debugText.textContent = `구역 ${zone}\n위치 ${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}\n수은 ${mercury.toFixed(1)}\nfps ${fps}\n위치 튐 ${diag.jumps}회  ${diag.lastJump}\n프레임 멈춤 ${diag.hitches}회  ${diag.lastHitch}\n시점 튐(무시함) ${diag.lookSpikes}회  ${diag.lastSpike}`;
  }
}

function frame() {
  const rawDt = clock.getDelta();
  const dt = Math.min(0.05, rawDt);
  if (rawDt > 0.25) {
    diag.hitches++;
    diag.lastHitch = `${rawDt.toFixed(2)}s`;
    console.warn("frame stall", rawDt);
  }
  const t = clock.elapsedTime;
  update(dt, t);

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) toastEl.textContent = "";
  }
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 0.5) {
    fps = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0;
    fpsFrames = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// dev hook for automated checks
window.__lh = { player, world, interact, diag, game, closeup, night, camera, postUniforms, frameOnce: (dt = 1 / 60) => update(dt, clock.elapsedTime), get scope() { return scope; }, signalKey, answerDoor, enterScope, exitScope, closePaper, advanceRadio, get reading() { return reading; }, chooseTask, skipPhase, get menu() { return menu; }, putDownLantern, get holding() { return holding; }, get mercury() { return mercury; }, set mercury(v) { mercury = v; }, get mode() { return mode; } };
