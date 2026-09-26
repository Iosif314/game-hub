import { createMatch, step, CHARACTERS } from "./sim.js";
import { createRenderer, drawPortrait } from "./render.js";
import { createCpu } from "./cpu.js";
import { createKeyboard } from "./input.js";
import { hostRoom, joinRoom, RollbackSession } from "./net.js";

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const renderer = createRenderer(canvas);
const screens = [...document.querySelectorAll(".screen")];

const LEVEL_LABEL = { easy: "쉬움", normal: "보통", hard: "어려움" };

let mode = null; // null | "cpu" | "online"
let state = null;
let paused = false;
let resultShown = false;

let cpu = null;
const cpuConfig = { me: "leon", cpu: "garon", level: "normal" };

let conn = null;
let role = null;
let session = null;
let pendingGame = [];
let lobby = null;
let matchChars = null;
let rematch = { me: false, op: false };
let ping = null;
let pingTimer = null;
let hostCancelled = false;

const keyboard = createKeyboard(() => mode !== null && !paused && document.activeElement?.tagName !== "INPUT");

function show(id) {
  for (const s of screens) s.classList.toggle("hidden", s.id !== id);
}
function hideAll() {
  for (const s of screens) s.classList.add("hidden");
}
function setStatus(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}

document.querySelectorAll("[data-go]").forEach((b) =>
  b.addEventListener("click", () => {
    setStatus($("title-notice"), "");
    show(b.dataset.go);
  }),
);

// ---------- character pickers ----------

function buildCharRow(row, initial, onPick) {
  const cards = {};
  for (const [id, ch] of Object.entries(CHARACTERS)) {
    const card = document.createElement("button");
    card.className = "char-card";
    const art = document.createElement("canvas");
    art.width = 150;
    art.height = 90;
    drawPortrait(art, id);
    const name = document.createElement("div");
    name.className = "char-name";
    name.textContent = ch.name;
    const title = document.createElement("div");
    title.className = "char-title";
    title.textContent = `${ch.title} · 필살기 ${ch.specialName}`;
    const desc = document.createElement("div");
    desc.className = "char-desc";
    desc.textContent = ch.desc;
    card.append(art, name, title, desc);
    card.addEventListener("click", () => {
      select(id);
      onPick(id);
    });
    row.appendChild(card);
    cards[id] = card;
  }
  function select(id) {
    for (const [cid, card] of Object.entries(cards)) card.classList.toggle("selected", cid === id);
  }
  select(initial);
  return { select };
}

buildCharRow(document.querySelector('[data-pick="me"]'), cpuConfig.me, (id) => (cpuConfig.me = id));
buildCharRow(document.querySelector('[data-pick="cpu"]'), cpuConfig.cpu, (id) => (cpuConfig.cpu = id));
const onlinePicker = buildCharRow(document.querySelector('[data-pick="online"]'), "leon", (id) => {
  if (!lobby) return;
  lobby.myChar = id;
  lobby.myReady = false;
  sendPick();
  updateLobbyUi();
});

document.querySelectorAll("#difficulty .seg-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    cpuConfig.level = btn.dataset.level;
    document.querySelectorAll("#difficulty .seg-btn").forEach((b) => b.classList.toggle("selected", b === btn));
  }),
);

// ---------- CPU mode ----------

function startCpu() {
  state = createMatch(cpuConfig.me, cpuConfig.cpu);
  cpu = createCpu(cpuConfig.level, 1);
  mode = "cpu";
  paused = false;
  resultShown = false;
  keyboard.clear();
  hideAll();
}

$("cpu-start").addEventListener("click", startCpu);

// Online matches can't pause (the peer keeps playing), so ESC only opens the menu and
// releases our controls while it's open.
window.addEventListener("keydown", (e) => {
  if (e.code !== "Escape" || !mode || resultShown) return;
  paused = !paused;
  if (paused) {
    $("pause-title").textContent = mode === "cpu" ? "일시정지" : "메뉴";
    setStatus($("pause-status"), mode === "online" ? "온라인 대전은 멈추지 않아요. 메뉴가 열린 동안엔 조작이 멈춰요." : "");
    keyboard.clear();
    show("pause-screen");
  } else {
    hideAll();
  }
});
$("resume-btn").addEventListener("click", () => {
  paused = false;
  hideAll();
});
$("quit-btn").addEventListener("click", () => leaveToTitle());

// ---------- results ----------

function localIndex() {
  return mode === "online" && session ? session.localIndex : 0;
}

function showResult() {
  resultShown = true;
  const w = state.winner;
  $("result-title").textContent = w === -1 ? "무승부" : w === localIndex() ? "승리!" : "패배...";
  $("rematch-btn").textContent = mode === "online" ? "재대결" : "다시 하기";
  $("rematch-btn").disabled = false;
  setStatus($("result-status"), mode === "cpu" ? `CPU 난이도: ${LEVEL_LABEL[cpuConfig.level]}` : "");
  show("result-screen");
}

$("rematch-btn").addEventListener("click", () => {
  if (mode === "cpu") {
    startCpu();
    return;
  }
  rematch.me = true;
  $("rematch-btn").disabled = true;
  conn.sendCtrl({ t: "rematch" });
  setStatus($("result-status"), rematch.op ? "곧 시작합니다..." : "상대의 응답을 기다리는 중...");
  tryRematch();
});
$("result-menu-btn").addEventListener("click", () => leaveToTitle());

function leaveToTitle(notice = "") {
  if (conn) conn.sendCtrl({ t: "bye" });
  cleanupOnline();
  mode = null;
  state = null;
  paused = false;
  show("title-screen");
  setStatus($("title-notice"), notice, !!notice);
}

// ---------- online mode ----------

function cleanupOnline() {
  clearInterval(pingTimer);
  pingTimer = null;
  if (conn) conn.close();
  conn = null;
  session = null;
  pendingGame = [];
  lobby = null;
  ping = null;
}

function setOnlineBusy(busy) {
  $("host-btn").disabled = busy;
  $("join-btn").disabled = busy;
}

$("host-btn").addEventListener("click", async () => {
  hostCancelled = false;
  setOnlineBusy(true);
  setStatus($("online-status"), "서버에 방을 만드는 중... (서버가 자고 있으면 처음엔 최대 1분 걸려요)");
  try {
    const c = await hostRoom({
      onCode: (code) => {
        $("room-code").textContent = code;
        setStatus($("wait-status"), "상대가 이 코드로 참가하기를 기다리는 중...");
        show("online-wait");
      },
      isCancelled: () => hostCancelled,
    });
    onConnected(c, "host");
  } catch (err) {
    if (err.message !== "cancelled") {
      show("online-menu");
      setStatus($("online-status"), err.message, true);
    }
  } finally {
    setOnlineBusy(false);
  }
});

$("host-cancel").addEventListener("click", () => {
  hostCancelled = true;
  setStatus($("online-status"), "");
  show("online-menu");
});

$("join-btn").addEventListener("click", async () => {
  const code = $("join-code").value.trim().toUpperCase();
  if (code.length !== 5) {
    setStatus($("online-status"), "5자리 방 코드를 입력해주세요.", true);
    return;
  }
  setOnlineBusy(true);
  setStatus($("online-status"), "연결 중... (서버가 자고 있으면 처음엔 최대 1분 걸려요)");
  try {
    const c = await joinRoom(code);
    onConnected(c, "guest");
  } catch (err) {
    setStatus($("online-status"), err.message, true);
  } finally {
    setOnlineBusy(false);
  }
});
$("join-code").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("join-btn").click();
});

function onConnected(c, r) {
  conn = c;
  role = r;
  conn.onCtrl = handleCtrl;
  conn.onGame = (msg) => {
    if (session) session.receive(msg);
    else pendingGame.push(msg);
  };
  conn.onClose = () => {
    cleanupOnline();
    leaveToTitle("상대와의 연결이 끊겼어요.");
  };
  lobby = { myChar: "leon", opChar: null, myReady: false, opReady: false };
  onlinePicker.select("leon");
  setStatus($("online-status"), "");
  setStatus($("lobby-status"), role === "host" ? "상대가 들어왔어요!" : "방에 참가했어요!");
  show("online-lobby");
  sendPick();
  updateLobbyUi();
  pingTimer = setInterval(() => conn && conn.sendCtrl({ t: "ping", ts: performance.now() }), 1000);
}

function sendPick() {
  if (conn && lobby) conn.sendCtrl({ t: "pick", char: lobby.myChar, ready: lobby.myReady });
}

function updateLobbyUi() {
  if (!lobby) return;
  const box = $("opponent-pick");
  box.innerHTML = "";
  box.classList.toggle("ready", lobby.opReady);
  if (lobby.opChar) {
    const art = document.createElement("canvas");
    art.width = 150;
    art.height = 110;
    drawPortrait(art, lobby.opChar);
    const label = document.createElement("div");
    label.textContent = `${CHARACTERS[lobby.opChar].name}${lobby.opReady ? " · 준비 완료" : ""}`;
    const wrap = document.createElement("div");
    wrap.append(art, label);
    box.appendChild(wrap);
  } else {
    box.textContent = "선택 중...";
  }
  $("lobby-ready").textContent = lobby.myReady ? "준비 취소" : "준비";
}

$("lobby-ready").addEventListener("click", () => {
  if (!lobby) return;
  lobby.myReady = !lobby.myReady;
  sendPick();
  updateLobbyUi();
  maybeStart();
});
$("lobby-leave").addEventListener("click", () => leaveToTitle());

function maybeStart() {
  if (role !== "host" || !lobby || !lobby.myReady || !lobby.opReady || !lobby.opChar) return;
  matchChars = { p1: lobby.myChar, p2: lobby.opChar };
  setStatus($("lobby-status"), "곧 시작합니다...");
  conn.sendCtrl({ t: "start", ...matchChars });
}

function tryRematch() {
  if (role === "host" && rematch.me && rematch.op && matchChars) conn.sendCtrl({ t: "start", ...matchChars });
}

function startOnline(p1, p2) {
  matchChars = { p1, p2 };
  session = new RollbackSession({
    localIndex: role === "host" ? 0 : 1,
    initialState: createMatch(p1, p2),
    send: (m) => conn && conn.sendGame(m),
  });
  for (const msg of pendingGame) session.receive(msg);
  pendingGame = [];
  state = session.state;
  mode = "online";
  paused = false;
  resultShown = false;
  rematch = { me: false, op: false };
  keyboard.clear();
  hideAll();
}

function handleCtrl(msg) {
  switch (msg.t) {
    case "ping":
      conn.sendCtrl({ t: "pong", ts: msg.ts });
      break;
    case "pong":
      ping = Math.round(performance.now() - msg.ts);
      break;
    case "pick":
      if (!lobby) return;
      lobby.opChar = msg.char;
      lobby.opReady = !!msg.ready;
      updateLobbyUi();
      maybeStart();
      break;
    case "start":
      if (role !== "guest") return;
      session = null;
      startOnline(msg.p1, msg.p2);
      conn.sendCtrl({ t: "go" });
      break;
    case "go":
      if (role !== "host") return;
      session = null;
      startOnline(matchChars.p1, matchChars.p2);
      break;
    case "rematch":
      rematch.op = true;
      if (resultShown) setStatus($("result-status"), rematch.me ? "곧 시작합니다..." : "상대가 재대결을 원해요!");
      tryRematch();
      break;
    case "bye":
      cleanupOnline();
      leaveToTitle("상대가 나갔어요.");
      break;
    default:
      break;
  }
}

// ---------- main loop ----------

function tick() {
  if (mode === "cpu" && state && !paused) {
    step(state, [keyboard.read(), cpu(state)]);
  } else if (mode === "online" && session) {
    session.setLocalInput(keyboard.read());
    session.sendInputs();
    session.advance();
    state = session.state;
  }
  if (mode && state && state.phase === "matchOver" && state.phaseTimer > 70 && !resultShown) showResult();
}

function hud() {
  if (mode === "cpu") return { labels: ["나", `CPU ${LEVEL_LABEL[cpuConfig.level]}`] };
  if (mode === "online" && session) {
    const labels = session.localIndex === 0 ? ["나", "상대"] : ["상대", "나"];
    return { labels, ping, waiting: session.stalledTicks > 30 };
  }
  return {};
}

const DT = 1000 / 60;
let last = performance.now();
let acc = 0;
function frame(now) {
  acc += now - last;
  last = now;
  if (acc > 250) acc = 250;
  while (acc >= DT) {
    tick();
    acc -= DT;
  }
  renderer.render(mode ? state : null, hud());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
