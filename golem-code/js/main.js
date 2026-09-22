import { createDungeon, simulateTick, GRID_SIZE } from "./game.js";

const startScreen = document.getElementById("start-screen");
const introScreen = document.getElementById("intro-screen");
const introNumber = document.getElementById("intro-number");
const introTitle = document.getElementById("intro-title");
const gameScreen = document.getElementById("game-screen");
const revealScreen = document.getElementById("reveal-screen");
const startBtn = document.getElementById("start-btn");
const startError = document.getElementById("start-error");
const hudStage = document.getElementById("hud-stage");

const dungeonName = document.getElementById("dungeon-name");
const dungeonNarrative = document.getElementById("dungeon-narrative");
const gimmickTitle = document.getElementById("gimmick-title");
const gimmickDesc = document.getElementById("gimmick-desc");
const bestiaryRow = document.getElementById("bestiary-row");

const dungeonGrid = document.getElementById("dungeon-grid");
const hpFill = document.getElementById("hp-fill");
const hpText = document.getElementById("hp-text");
const manaFill = document.getElementById("mana-fill");
const manaText = document.getElementById("mana-text");

const runBtn = document.getElementById("run-btn");
const pauseBtn = document.getElementById("pause-btn");
const stepBtn = document.getElementById("step-btn");
const speedSelect = document.getElementById("speed-select");
const codeEditor = document.getElementById("code-editor");
const runLog = document.getElementById("run-log");

const revealTitle = document.getElementById("reveal-title");
const revealMessage = document.getElementById("reveal-message");
const nextBtn = document.getElementById("next-btn");
const retryBtn = document.getElementById("retry-btn");

const GIMMICK_LABELS = {
  fire_dot: "화염 저주",
  low_visibility: "시야 제한",
  mana_drain: "마나 고갈",
  traps: "은신 함정",
  tough_enemies: "강화된 몬스터",
};

const DEFAULT_CODE = `// 골렘 명령서: 매 순간 위에서부터 다시 판단합니다.
// 방문했나()로 안 가본 곳을 우선 탐색하고, 막다른 길이면 마지막방향(왔던 길)만
// 피해서 자연스럽게 되돌아 나옵니다. 이 둘을 같이 써야 진짜 미로 탐색이 됩니다.
if (내구력 < 최대내구력 * 0.3) {
  회복룬_시전();
} else if (가장가까운적_거리() <= 1) {
  공격(가장가까운적_방향());
} else if (가장가까운적_거리() <= 4 && 주변확인(가장가까운적_방향()) != "벽") {
  마지막방향 = 가장가까운적_방향();
  이동(마지막방향);
} else if (주변확인("오른쪽") != "벽" && !방문했나("오른쪽")) {
  마지막방향 = "오른쪽";
  이동("오른쪽");
} else if (주변확인("아래") != "벽" && !방문했나("아래")) {
  마지막방향 = "아래";
  이동("아래");
} else if (주변확인("위") != "벽" && !방문했나("위")) {
  마지막방향 = "위";
  이동("위");
} else if (주변확인("왼쪽") != "벽" && !방문했나("왼쪽")) {
  마지막방향 = "왼쪽";
  이동("왼쪽");
} else {
  // 여기까지 왔다면 사방이 다 가본 곳이라는 뜻 - 진짜 되돌아가야 합니다.
  // 항상 같은 순서로만 후보를 고르면 방문한 칸들 사이에서 똑같은 큰 원을
  // 계속 돌 수 있어서, 무작위()로 순서를 섞어 그 반복을 깨줍니다.
  난수 = 무작위();
  if (난수 < 0.25) {
    우선방향 = "오른쪽";
  } else if (난수 < 0.5) {
    우선방향 = "아래";
  } else if (난수 < 0.75) {
    우선방향 = "위";
  } else {
    우선방향 = "왼쪽";
  }

  if (주변확인(우선방향) != "벽" && 반대방향(우선방향) != 마지막방향) {
    마지막방향 = 우선방향;
    이동(우선방향);
  } else if (주변확인("오른쪽") != "벽" && 마지막방향 != "왼쪽") {
    마지막방향 = "오른쪽";
    이동("오른쪽");
  } else if (주변확인("아래") != "벽" && 마지막방향 != "위") {
    마지막방향 = "아래";
    이동("아래");
  } else if (주변확인("위") != "벽" && 마지막방향 != "아래") {
    마지막방향 = "위";
    이동("위");
  } else if (주변확인("왼쪽") != "벽" && 마지막방향 != "오른쪽") {
    마지막방향 = "왼쪽";
    이동("왼쪽");
  } else if (주변확인("오른쪽") != "벽") {
    마지막방향 = "오른쪽";
    이동("오른쪽");
  } else if (주변확인("아래") != "벽") {
    마지막방향 = "아래";
    이동("아래");
  } else if (주변확인("위") != "벽") {
    마지막방향 = "위";
    이동("위");
  } else if (주변확인("왼쪽") != "벽") {
    마지막방향 = "왼쪽";
    이동("왼쪽");
  } else {
    대기();
  }
}
`;

let stage = 1;
let state = null;
let intervalId = null;
let isPaused = false;

codeEditor.value = DEFAULT_CODE;

function typewrite(el, text, speed) {
  return new Promise((resolve) => {
    el.textContent = "";
    el.classList.add("typing");
    let i = 0;
    const timer = setInterval(() => {
      el.textContent += text[i];
      i += 1;
      if (i >= text.length) {
        clearInterval(timer);
        el.classList.remove("typing");
        resolve();
      }
    }, speed);
  });
}

async function playIntro(title) {
  introNumber.textContent = "";
  introTitle.textContent = "";
  introScreen.classList.remove("hidden");
  await typewrite(introNumber, `스테이지 ${stage}`, 110);
  await new Promise((r) => setTimeout(r, 400));
  await typewrite(introTitle, title, 90);
  await new Promise((r) => setTimeout(r, 1400));
  introScreen.classList.add("hidden");
}

const API_BASE = "https://golem-code.onrender.com";

async function api(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function renderDungeonInfo() {
  dungeonName.textContent = `[${stage}] ${state.dungeonName}`;
  dungeonNarrative.textContent = state.narrative;
  gimmickTitle.textContent = `⚠ ${GIMMICK_LABELS[state.gimmickType] || state.gimmickType}`;
  gimmickDesc.textContent = state.gimmickFlavor;

  bestiaryRow.innerHTML = "";
  state.monsters.forEach((m) => {
    const item = document.createElement("div");
    item.className = "bestiary-item";
    const name = document.createElement("div");
    name.className = "bestiary-name";
    name.textContent = m.name;
    const tier = document.createElement("span");
    tier.className = "bestiary-tier";
    tier.textContent = m.tier;
    name.appendChild(tier);
    const flavor = document.createElement("div");
    flavor.className = "bestiary-flavor";
    flavor.textContent = m.flavor;
    item.append(name, flavor);
    bestiaryRow.appendChild(item);
  });
}

function renderGrid() {
  dungeonGrid.innerHTML = "";
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cellEl = document.createElement("div");
      const base = state.grid[y][x];
      let cls = base === "wall" ? "wall" : base === "exit" ? "exit" : "floor";
      if (state.revealedTraps.has(`${x},${y}`)) cls = "trap-revealed";
      cellEl.className = `cell ${cls}`;

      if (x === state.golem.x && y === state.golem.y) {
        const token = document.createElement("span");
        token.className = "token golem-token";
        token.textContent = "◆";
        cellEl.appendChild(token);
      } else {
        const monster = state.monsters.find((m) => m.hp > 0 && m.x === x && m.y === y);
        if (monster) {
          const token = document.createElement("span");
          token.className = "token monster-token";
          token.textContent = "●";
          cellEl.appendChild(token);
        }
      }
      dungeonGrid.appendChild(cellEl);
    }
  }
}

function renderStatus() {
  const hpPct = Math.max(0, (state.golem.hp / state.golem.maxHp) * 100);
  hpFill.style.width = `${hpPct}%`;
  hpText.textContent = `내구력 ${Math.max(0, state.golem.hp)}/${state.golem.maxHp}`;
  const manaPct = Math.max(0, (state.golem.mana / state.golem.maxMana) * 100);
  manaFill.style.width = `${manaPct}%`;
  manaText.textContent = `마나 ${state.golem.mana}/${state.golem.maxMana}`;
}

function appendLog(entries) {
  entries.forEach((entry) => {
    const el = document.createElement("div");
    el.className = `log-line ${entry.type}`;
    el.textContent = entry.text;
    runLog.appendChild(el);
  });
  runLog.scrollTop = runLog.scrollHeight;
}

function renderAll() {
  renderGrid();
  renderStatus();
}

function stopRun() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  runBtn.disabled = false;
  pauseBtn.disabled = true;
  stepBtn.disabled = true;
  codeEditor.disabled = false;
}

function doTick() {
  const log = [];
  simulateTick(state, codeEditor.value, log);
  appendLog(log);
  renderAll();
  if (state.finished) {
    stopRun();
    finishRun();
  }
}

function finishRun() {
  if (state.finished === "cleared") {
    revealTitle.textContent = "던전 돌파!";
    revealMessage.textContent = `"${state.dungeonName}"을(를) 성공적으로 돌파했습니다. 골렘의 명령서가 잘 작동했습니다.`;
    nextBtn.textContent = "다음 던전으로";
    nextBtn.classList.remove("hidden");
    retryBtn.classList.add("hidden");
  } else if (state.finished === "error") {
    revealTitle.textContent = "명령서 오류";
    revealMessage.textContent = state.error;
    nextBtn.classList.add("hidden");
    retryBtn.textContent = "코드 수정 후 재도전";
    retryBtn.classList.remove("hidden");
  } else {
    revealTitle.textContent = state.finished === "destroyed" ? "골렘 파괴" : "탐사 시간 초과";
    revealMessage.textContent =
      state.finished === "destroyed"
        ? "골렘이 던전에서 파괴되었습니다. 명령서를 수정해 다시 도전하세요."
        : "너무 오래 걸려 탐사가 중단되었습니다. 더 효율적인 경로를 짜보세요.";
    nextBtn.classList.add("hidden");
    retryBtn.textContent = "같은 스테이지 재도전";
    retryBtn.classList.remove("hidden");
  }
  gameScreen.classList.add("hidden");
  revealScreen.classList.remove("hidden");
}

async function loadDungeon() {
  const aiData = await api("/api/new_dungeon", { stage });
  state = createDungeon(aiData, stage);
  state.vars.마지막방향 = "";
  hudStage.textContent = `스테이지 ${stage}`;
  runLog.innerHTML = "";
  renderDungeonInfo();
  renderAll();
  startScreen.classList.add("hidden");
  revealScreen.classList.add("hidden");
  await playIntro(state.dungeonName);
}

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  startBtn.textContent = "던전 생성 중...";
  startError.textContent = "";
  try {
    stage = 1;
    codeEditor.value = DEFAULT_CODE;
    await loadDungeon();
    gameScreen.classList.remove("hidden");
  } catch (e) {
    startError.textContent = e.message;
    startBtn.disabled = false;
    startBtn.textContent = "다시 시도";
  }
});

runBtn.addEventListener("click", () => {
  runBtn.disabled = true;
  pauseBtn.disabled = false;
  stepBtn.disabled = false;
  codeEditor.disabled = true;
  isPaused = false;
  pauseBtn.textContent = "일시정지";
  const speed = parseInt(speedSelect.value, 10);
  intervalId = setInterval(doTick, speed);
});

pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  if (isPaused) {
    clearInterval(intervalId);
    intervalId = null;
    pauseBtn.textContent = "재개";
  } else {
    const speed = parseInt(speedSelect.value, 10);
    intervalId = setInterval(doTick, speed);
    pauseBtn.textContent = "일시정지";
  }
});

stepBtn.addEventListener("click", () => {
  if (!isPaused) {
    clearInterval(intervalId);
    intervalId = null;
    isPaused = true;
    pauseBtn.textContent = "재개";
  }
  doTick();
});

speedSelect.addEventListener("change", () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = setInterval(doTick, parseInt(speedSelect.value, 10));
  }
});

nextBtn.addEventListener("click", async () => {
  stage += 1;
  nextBtn.disabled = true;
  nextBtn.textContent = "던전 생성 중...";
  try {
    await loadDungeon();
    gameScreen.classList.remove("hidden");
  } catch (e) {
    revealMessage.textContent = `오류: ${e.message}`;
  } finally {
    nextBtn.disabled = false;
    nextBtn.textContent = "다음 던전으로";
  }
});

retryBtn.addEventListener("click", async () => {
  retryBtn.disabled = true;
  const original = retryBtn.textContent;
  retryBtn.textContent = "던전 생성 중...";
  try {
    await loadDungeon();
    gameScreen.classList.remove("hidden");
  } catch (e) {
    revealMessage.textContent = `오류: ${e.message}`;
  } finally {
    retryBtn.disabled = false;
    retryBtn.textContent = original;
  }
});
