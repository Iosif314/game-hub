import { mountFace, updateFace } from "./face.js";

const MAX_ROUNDS = 8;

const startScreen = document.getElementById("start-screen");
const introScreen = document.getElementById("intro-screen");
const introNumber = document.getElementById("intro-number");
const introTitle = document.getElementById("intro-title");
const gameScreen = document.getElementById("game-screen");
const revealScreen = document.getElementById("reveal-screen");
const startBtn = document.getElementById("start-btn");
const startError = document.getElementById("start-error");

const hudRound = document.getElementById("hud-round");
const caseTypeBadge = document.getElementById("case-type-badge");
const caseTitle = document.getElementById("case-title");
const caseBrief = document.getElementById("case-brief");
const suspectNameLabel = document.getElementById("suspect-name-label");
const suspectPortrait = document.getElementById("suspect-portrait");
const evidenceRow = document.getElementById("evidence-row");
const transcript = document.getElementById("transcript");
const stressFill = document.getElementById("stress-fill");
const stressPercent = document.getElementById("stress-percent");
const tacticButtons = [...document.querySelectorAll(".tactic-btn")];
const verdictRow = document.getElementById("verdict-row");
const chargeBtn = document.getElementById("charge-btn");
const releaseBtn = document.getElementById("release-btn");

mountFace(suspectPortrait);
updateFace(suspectPortrait, 0);

const revealTitle = document.getElementById("reveal-title");
const revealMessage = document.getElementById("reveal-message");
const revealTruth = document.getElementById("reveal-truth");
const restartBtn = document.getElementById("restart-btn");

const difficultyButtons = [...document.querySelectorAll(".difficulty-btn")];
const recordsBtn = document.getElementById("records-btn");
const recordsScreen = document.getElementById("records-screen");
const recordsBackBtn = document.getElementById("records-back-btn");
const recordsListView = document.getElementById("records-list-view");
const recordsList = document.getElementById("records-list");
const recordDetailView = document.getElementById("record-detail-view");
const recordDetailBackBtn = document.getElementById("record-detail-back-btn");
const recordDetailTitle = document.getElementById("record-detail-title");
const recordDetailMeta = document.getElementById("record-detail-meta");
const recordDetailBrief = document.getElementById("record-detail-brief");
const recordDetailTranscript = document.getElementById("record-detail-transcript");
const recordDetailResult = document.getElementById("record-detail-result");
const detectorPanel = document.getElementById("detector-panel");

const RECORDS_KEY = "interrogation_room_records_v1";
const DIFFICULTY_LABEL = { easy: "쉬움", normal: "보통", hard: "어려움" };

let sessionId = null;
let roundsUsed = 0;
let confessed = false;
let selectedDifficulty = "normal";
let conversationLog = [];
let currentCase = null;

difficultyButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedDifficulty = btn.dataset.difficulty;
    difficultyButtons.forEach((b) => b.classList.toggle("selected", b === btn));
  });
});

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveRecord(record) {
  try {
    const records = loadRecords();
    records.unshift(record);
    records.length = Math.min(records.length, 50);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    // storage unavailable; skip silently
  }
}

function renderRecordsList() {
  const records = loadRecords();
  recordsList.innerHTML = "";
  if (records.length === 0) {
    const empty = document.createElement("div");
    empty.id = "records-empty";
    empty.textContent = "아직 취조 기록이 없습니다.";
    recordsList.appendChild(empty);
    return;
  }
  records.forEach((rec) => {
    const item = document.createElement("div");
    item.className = `record-item ${rec.success ? "record-success" : "record-fail"}`;

    const title = document.createElement("div");
    title.className = "record-item-title";
    title.textContent = rec.caseTitle;

    const meta = document.createElement("div");
    meta.className = "record-item-meta";
    const typePrefix = rec.caseType ? `[${rec.caseType}] ` : "";
    meta.textContent = `${typePrefix}${rec.date} · 난이도: ${DIFFICULTY_LABEL[rec.difficulty] || rec.difficulty} · ${rec.outcomeTitle}`;

    item.append(title, meta);
    item.addEventListener("click", () => showRecordDetail(rec));
    recordsList.appendChild(item);
  });
}

function showRecordDetail(rec) {
  recordsListView.classList.add("hidden");
  recordDetailView.classList.remove("hidden");
  recordDetailTitle.textContent = rec.caseTitle;
  const typePrefix = rec.caseType ? `[${rec.caseType}] ` : "";
  recordDetailMeta.textContent = `${typePrefix}${rec.date} · 난이도: ${DIFFICULTY_LABEL[rec.difficulty] || rec.difficulty} · 심문 ${rec.roundsUsed}턴`;
  recordDetailBrief.textContent = rec.caseBrief;

  recordDetailTranscript.innerHTML = "";
  rec.transcript.forEach((entry) => {
    const el = document.createElement("div");
    if (entry.speaker === "interrogator" || entry.speaker === "suspect") {
      el.className = `bubble ${entry.speaker}`;
      const label = document.createElement("div");
      label.className = "bubble-speaker";
      label.textContent = entry.speaker === "interrogator" ? "심문관" : "용의자";
      el.appendChild(label);
      const body = document.createElement("div");
      body.textContent = entry.text;
      el.appendChild(body);
    } else if (entry.speaker === "alert") {
      el.className = "bubble alert";
      el.textContent = entry.text;
    } else {
      el.className = "bubble system";
      el.textContent = entry.text;
    }
    recordDetailTranscript.appendChild(el);
  });

  recordDetailResult.textContent = `${rec.outcomeTitle} — ${rec.outcomeMessage}\n\n실제 진실: ${rec.privateTruth}`;
}

recordsBtn.addEventListener("click", () => {
  renderRecordsList();
  recordsListView.classList.remove("hidden");
  recordDetailView.classList.add("hidden");
  startScreen.classList.add("hidden");
  recordsScreen.classList.remove("hidden");
});

recordsBackBtn.addEventListener("click", () => {
  recordsScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});

recordDetailBackBtn.addEventListener("click", () => {
  recordDetailView.classList.add("hidden");
  recordsListView.classList.remove("hidden");
});

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

async function playIntro(caseTitleText) {
  const caseNumber = String(Math.floor(Math.random() * 9000) + 1000);
  introNumber.textContent = "";
  introTitle.textContent = "";
  introScreen.classList.remove("hidden");
  await typewrite(introNumber, `사건 #${caseNumber}`, 130);
  await new Promise((r) => setTimeout(r, 500));
  await typewrite(introTitle, caseTitleText, 100);
  await new Promise((r) => setTimeout(r, 1800));
  introScreen.classList.add("hidden");
}

const API_BASE = "https://interrogation-room-rqxc.onrender.com/interrogation-room";

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

function addBubble(speaker, text, { log = true } = {}) {
  const el = document.createElement("div");
  if (speaker === "system" || speaker === "alert") {
    el.className = speaker === "alert" ? "bubble alert" : "bubble system";
    el.textContent = text;
  } else {
    el.className = `bubble ${speaker}`;
    const label = document.createElement("div");
    label.className = "bubble-speaker";
    label.textContent = speaker === "interrogator" ? "심문관" : "용의자";
    el.appendChild(label);
    const body = document.createElement("div");
    body.textContent = text;
    el.appendChild(body);
  }
  transcript.insertBefore(el, verdictRow);
  transcript.scrollTop = transcript.scrollHeight;
  if (log) conversationLog.push({ speaker, text });
}

function flashContradiction() {
  detectorPanel.classList.add("alert-flash");
  setTimeout(() => detectorPanel.classList.remove("alert-flash"), 1500);
}

function setStress(value) {
  const clamped = Math.max(0, Math.min(100, value));
  stressFill.style.width = `${clamped}%`;
  stressFill.style.background = clamped > 66 ? "var(--danger)" : clamped > 33 ? "#e3b95d" : "var(--good)";
  stressPercent.textContent = `${Math.round(clamped)}%`;
  updateFace(suspectPortrait, clamped);
}

function updateRoundHud() {
  hudRound.textContent = `심문 진행: ${roundsUsed}/${MAX_ROUNDS}`;
}

function lockControls() {
  tacticButtons.forEach((b) => (b.disabled = true));
  evidenceRow.querySelectorAll("button").forEach((b) => (b.disabled = true));
}

function unlockControls() {
  tacticButtons.forEach((b) => (b.disabled = false));
  evidenceRow.querySelectorAll("button").forEach((b) => {
    b.disabled = b.classList.contains("used");
  });
}

function endInterrogation() {
  lockControls();
  verdictRow.classList.remove("hidden");
  transcript.scrollTop = transcript.scrollHeight;
}

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  startBtn.textContent = "사건 생성 중...";
  startError.textContent = "";
  try {
    const data = await api("/api/new_case", { difficulty: selectedDifficulty });
    sessionId = data.session_id;
    roundsUsed = 0;
    confessed = false;
    conversationLog = [];
    currentCase = {
      caseTitle: data.case_title,
      caseBrief: data.case_brief,
      caseType: data.case_type,
      difficulty: selectedDifficulty,
    };

    caseTypeBadge.textContent = data.case_type;
    caseTitle.textContent = data.case_title;
    caseBrief.textContent = data.case_brief;
    suspectNameLabel.textContent = data.suspect_name;
    suspectNameLabel.title = data.suspect_persona;
    suspectPortrait.title = data.suspect_persona;

    evidenceRow.innerHTML = "";
    data.evidence.forEach((ev, idx) => {
      const card = document.createElement("div");
      card.className = "evidence-card";

      const index = document.createElement("div");
      index.className = "evidence-index";
      index.textContent = `증거 ${idx + 1}`;

      const name = document.createElement("div");
      name.className = "evidence-name";
      name.textContent = ev.name;

      const desc = document.createElement("div");
      desc.className = "evidence-desc";
      desc.textContent = ev.description;

      const btn = document.createElement("button");
      btn.className = "evidence-btn";
      btn.textContent = "제시하기";
      btn.addEventListener("click", () => presentEvidence(ev, btn, card));

      card.append(index, name, desc, btn);
      evidenceRow.appendChild(card);
    });

    transcript.querySelectorAll(".bubble").forEach((b) => b.remove());
    addBubble("system", `"${data.case_title}" 심문을 시작합니다.`);
    setStress(0);
    verdictRow.classList.add("hidden");
    unlockControls();
    updateRoundHud();

    startScreen.classList.add("hidden");
    revealScreen.classList.add("hidden");
    await playIntro(data.case_title);
    gameScreen.classList.remove("hidden");
  } catch (e) {
    startError.textContent = e.message;
    startBtn.disabled = false;
    startBtn.textContent = "다시 시도";
  }
});

async function runRound({ evidenceName, evidenceDescription, style } = {}) {
  lockControls();
  try {
    if (evidenceName) {
      const { line } = await api("/api/present_evidence", {
        session_id: sessionId,
        evidence_name: evidenceName,
        evidence_description: evidenceDescription,
      });
      addBubble("interrogator", line);
    } else {
      const { line } = await api("/api/interrogator_turn", { session_id: sessionId, style });
      addBubble("interrogator", line);
    }

    const result = await api("/api/suspect_turn", { session_id: sessionId });
    addBubble("suspect", result.reply);
    setStress(result.stress);
    roundsUsed += 1;
    updateRoundHud();

    if (result.contradiction) {
      addBubble("alert", `⚠ 모순 포착: ${result.contradiction_note}`);
      flashContradiction();
    }

    if (result.confessed) {
      confessed = true;
      addBubble("system", "용의자가 자백했습니다.");
      await finishInterrogation();
      return;
    }
    if (roundsUsed >= MAX_ROUNDS) {
      addBubble("system", "심문 가능 시간이 끝났습니다. 최종 판단을 내리세요.");
      endInterrogation();
      return;
    }
  } catch (e) {
    addBubble("system", `오류: ${e.message}`);
  } finally {
    if (roundsUsed < MAX_ROUNDS && !confessed) {
      unlockControls();
    }
  }
}

function presentEvidence(ev, btn, card) {
  btn.disabled = true;
  btn.classList.add("used");
  btn.textContent = "제시함";
  card.classList.add("used");
  runRound({ evidenceName: ev.name, evidenceDescription: ev.description });
}

tacticButtons.forEach((btn) => {
  btn.addEventListener("click", () => runRound({ style: btn.dataset.style }));
});

async function finishInterrogation() {
  // confession already tells the story; skip the charge/release choice and go straight to reveal
  lockControls();
  await reveal("confession");
}

chargeBtn.addEventListener("click", () => reveal("charge"));
releaseBtn.addEventListener("click", () => reveal("release"));

async function reveal(verdict) {
  try {
    const data = await api("/api/reveal", { session_id: sessionId, verdict });
    const messages = {
      correct_confession: "자백을 받아냈고, 실제로 유죄였습니다. 사건 해결!",
      false_confession: "자백을 받아냈지만... 용의자는 사실 무고했습니다. 씁쓸한 승리입니다.",
      correct_charge: "기소했고, 실제로 유죄였습니다. 정의가 실현되었습니다.",
      wrongful_charge: "기소했지만, 용의자는 사실 무죄였습니다. 억울한 사람을 몰아붙였습니다.",
      let_guilty_go: "방면했지만, 사실은 유죄였습니다. 범인을 놓쳤습니다.",
      correct_release: "방면했고, 실제로 무죄였습니다. 올바른 판단이었습니다.",
    };
    const titles = {
      correct_confession: "사건 해결",
      false_confession: "찜찜한 승리",
      correct_charge: "사건 해결",
      wrongful_charge: "오판",
      let_guilty_go: "놓친 범인",
      correct_release: "올바른 판단",
    };
    const outcomeTitle = titles[data.outcome] || "결과";
    const outcomeMessage = messages[data.outcome] || "";
    revealTitle.textContent = outcomeTitle;
    revealMessage.textContent = outcomeMessage;
    revealTruth.textContent = `실제 진실: ${data.private_truth}`;
    gameScreen.classList.add("hidden");
    revealScreen.classList.remove("hidden");

    const successOutcomes = ["correct_confession", "correct_charge", "correct_release"];
    saveRecord({
      caseTitle: currentCase ? currentCase.caseTitle : "",
      caseBrief: currentCase ? currentCase.caseBrief : "",
      caseType: currentCase ? currentCase.caseType : "",
      difficulty: currentCase ? currentCase.difficulty : "normal",
      date: new Date().toLocaleString("ko-KR"),
      transcript: conversationLog.slice(),
      outcome: data.outcome,
      outcomeTitle,
      outcomeMessage,
      privateTruth: data.private_truth,
      roundsUsed,
      success: successOutcomes.includes(data.outcome),
    });
  } catch (e) {
    addBubble("system", `오류: ${e.message}`);
  }
}

restartBtn.addEventListener("click", () => {
  revealScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  startBtn.disabled = false;
  startBtn.textContent = "새 사건 시작";
});
