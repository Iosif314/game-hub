import { cardMeta, makeCard } from "./cards.js";

const MIN_DECK_SIZE = 6;
const MAX_DECK_SIZE = 16;

const overlay = document.getElementById("deck-editor");
const titleEl = document.getElementById("deck-editor-title");
const xpTextEl = document.getElementById("deck-editor-xp-text");
const xpFillEl = document.getElementById("deck-editor-xp-fill");
const totalEl = document.getElementById("deck-editor-total");
const rowsEl = document.getElementById("deck-editor-rows");
const closeBtn = document.getElementById("deck-editor-close");
const releaseBtn = document.getElementById("deck-editor-release");

export function openDeckEditor(monster, party, onClose) {
  overlay.classList.remove("hidden");
  render();

  function totalCount() {
    return monster.deck.length + monster.discard.length;
  }

  function countOf(kind) {
    let count = 0;
    for (const c of monster.deck) if (c.kind === kind) count++;
    for (const c of monster.discard) if (c.kind === kind) count++;
    return count;
  }

  function render() {
    titleEl.textContent = `${monster.name}의 덱 편집`;

    xpTextEl.textContent = `Lv.${monster.level}  경험치 ${monster.xp}/${monster.xpToNext}`;
    xpFillEl.style.width = `${Math.min(100, (monster.xp / monster.xpToNext) * 100)}%`;

    const total = totalCount();
    totalEl.textContent = `총 ${total}장 (최소 ${MIN_DECK_SIZE} · 최대 ${MAX_DECK_SIZE})`;

    releaseBtn.disabled = party.length <= 1;
    releaseBtn.title = party.length <= 1 ? "마지막 남은 몬스터는 놓아줄 수 없습니다" : "";

    rowsEl.innerHTML = "";
    for (const kind of monster.knownKinds) {
      const meta = cardMeta(kind, monster);
      const count = countOf(kind);
      const row = document.createElement("div");
      row.className = "deck-row";

      const info = document.createElement("div");
      info.className = "deck-row-info";
      info.innerHTML = `
        <span class="deck-row-name">${meta.name}</span>
        <span class="deck-row-desc">${meta.desc} (비용 ${meta.cost})</span>
      `;

      const controls = document.createElement("div");
      controls.className = "deck-row-controls";

      const minusBtn = document.createElement("button");
      minusBtn.className = "deck-row-btn";
      minusBtn.textContent = "-";
      minusBtn.disabled = count <= 0 || total <= MIN_DECK_SIZE;
      minusBtn.addEventListener("click", () => removeCard(kind));

      const countEl = document.createElement("span");
      countEl.className = "deck-row-count";
      countEl.textContent = count;

      const plusBtn = document.createElement("button");
      plusBtn.className = "deck-row-btn";
      plusBtn.textContent = "+";
      plusBtn.disabled = total >= MAX_DECK_SIZE;
      plusBtn.addEventListener("click", () => addCard(kind));

      controls.appendChild(minusBtn);
      controls.appendChild(countEl);
      controls.appendChild(plusBtn);

      row.appendChild(info);
      row.appendChild(controls);
      rowsEl.appendChild(row);
    }
  }

  function removeCard(kind) {
    if (totalCount() <= MIN_DECK_SIZE) return;
    let idx = monster.discard.findIndex((c) => c.kind === kind);
    if (idx !== -1) {
      monster.discard.splice(idx, 1);
      render();
      return;
    }
    idx = monster.deck.findIndex((c) => c.kind === kind);
    if (idx !== -1) {
      monster.deck.splice(idx, 1);
      render();
    }
  }

  function addCard(kind) {
    if (totalCount() >= MAX_DECK_SIZE) return;
    monster.discard.push(makeCard(kind));
    render();
  }

  function releaseMonster() {
    if (party.length <= 1) return;
    const ok = window.confirm(`정말 ${monster.name}을(를) 놓아주시겠어요? 되돌릴 수 없습니다.`);
    if (!ok) return;
    const idx = party.indexOf(monster);
    if (idx !== -1) party.splice(idx, 1);
    overlay.classList.add("hidden");
    if (onClose) onClose();
  }

  releaseBtn.onclick = releaseMonster;

  closeBtn.onclick = () => {
    overlay.classList.add("hidden");
    if (onClose) onClose();
  };
}
