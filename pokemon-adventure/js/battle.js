import { createMonster, gainExp, expReward } from "./monsters.js";
import { MAX_ENERGY, HAND_SIZE, cardMeta, drawFromMonsterDeck, ATTACK_KINDS, makeCard } from "./cards.js";
import { hasPassive } from "./passives.js";

const LEARN_CHANCE = 0.35;

const screen = document.getElementById("battle-screen");
const enemyName = document.getElementById("enemy-name");
const enemyLevel = document.getElementById("enemy-level");
const enemyHpFill = document.getElementById("enemy-hp-fill");
const enemyHpText = document.getElementById("enemy-hp-text");
const enemySprite = document.getElementById("enemy-sprite");
const enemyPassivesEl = document.getElementById("enemy-passives");
const playerMonName = document.getElementById("player-mon-name");
const playerMonLevel = document.getElementById("player-mon-level");
const playerHpFill = document.getElementById("player-hp-fill");
const playerHpText = document.getElementById("player-hp-text");
const playerSprite = document.getElementById("player-sprite");
const playerBlockBadge = document.getElementById("player-block");
const playerPassivesEl = document.getElementById("player-passives");
const logEl = document.getElementById("battle-log");
const actionsEl = document.getElementById("battle-actions");
const handEl = document.getElementById("battle-hand");
const energyEl = document.getElementById("battle-energy");
const endTurnBtn = document.getElementById("end-turn-btn");

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hpColor(hp, maxHp) {
  const ratio = hp / maxHp;
  if (ratio > 0.5) return "var(--hp-good)";
  if (ratio > 0.2) return "var(--hp-mid)";
  return "var(--hp-low)";
}

function calcDamage(attacker, defender, mult) {
  let dmg = attacker.atk * mult - defender.def + randInt(-1, 2);
  if (hasPassive(attacker, "group_A_offense")) dmg *= 1.15;
  if (hasPassive(attacker, "brute_force")) dmg += 2;
  dmg = Math.round(dmg);
  if (hasPassive(defender, "thick_hide")) dmg -= 1;
  return Math.max(1, dmg);
}

function calcBlock(monster) {
  let block = monster.def * 0.8 + 4;
  if (hasPassive(monster, "group_B_defense")) block *= 1.2;
  block = Math.round(block);
  if (hasPassive(monster, "guardian")) block += 3;
  return block;
}

function calcHeal(monster) {
  let heal = monster.maxHp * 0.25 + 3;
  if (hasPassive(monster, "group_C_support")) heal *= 1.25;
  heal = Math.round(heal);
  if (hasPassive(monster, "meditation")) heal += 2;
  return heal;
}

function calcHandSize(monster) {
  return HAND_SIZE + (hasPassive(monster, "extra_card") ? 1 : 0);
}

function calcMaxEnergy(monster) {
  return MAX_ENERGY + (hasPassive(monster, "extra_energy") ? 1 : 0);
}

function renderPassiveTags(container, monster) {
  container.innerHTML = "";
  for (const passive of monster.passives || []) {
    const tag = document.createElement("span");
    tag.className = `passive-tag${passive.id.startsWith("group_") ? "" : " tag-random"}`;
    tag.textContent = passive.name;
    tag.title = passive.desc;
    container.appendChild(tag);
  }
}

export function startBattle({ party, enemy, isTrainer, enemyTrainerName, onEnd }) {
  const state = {
    party,
    activeIndex: party.findIndex((m) => m.hp > 0),
    enemy,
    isTrainer,
    hand: [],
    energy: 0,
    maxEnergy: MAX_ENERGY,
    block: 0,
    finished: false,
  };

  screen.classList.remove("hidden");
  logEl.innerHTML = "";
  addLog(isTrainer ? `${enemyTrainerName}이(가) 대결을 신청했다!` : `야생의 ${enemy.name}이(가) 나타났다!`);

  function active() {
    return state.party[state.activeIndex];
  }

  function addLog(msg) {
    const line = document.createElement("div");
    line.textContent = msg;
    logEl.prepend(line);
  }

  function render() {
    const p = active();
    enemyName.textContent = enemy.name;
    enemyLevel.textContent = `Lv.${enemy.level}`;
    enemyHpText.textContent = `${Math.max(0, enemy.hp)}/${enemy.maxHp}`;
    enemyHpFill.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
    enemyHpFill.style.background = hpColor(enemy.hp, enemy.maxHp);
    enemySprite.style.background = enemy.color;
    enemySprite.textContent = enemy.glyph;
    renderPassiveTags(enemyPassivesEl, enemy);

    playerMonName.textContent = p.name;
    playerMonLevel.textContent = `Lv.${p.level}`;
    playerHpText.textContent = `${Math.max(0, p.hp)}/${p.maxHp}`;
    playerHpFill.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    playerHpFill.style.background = hpColor(p.hp, p.maxHp);
    playerSprite.style.background = p.color;
    playerSprite.textContent = p.glyph;
    renderPassiveTags(playerPassivesEl, p);

    if (state.block > 0) {
      playerBlockBadge.textContent = `🛡${state.block}`;
      playerBlockBadge.classList.remove("hidden");
    } else {
      playerBlockBadge.classList.add("hidden");
    }

    energyEl.textContent = `⚡ ${state.energy}/${state.maxEnergy}`;
    renderHand();
    renderActions();
  }

  function renderHand() {
    handEl.innerHTML = "";
    state.hand.forEach((card, i) => {
      const meta = cardMeta(card.kind, active());
      const affordable = meta.cost <= state.energy;
      const el = document.createElement("div");
      el.className = `hand-card kind-${meta.cssKind}${affordable ? "" : " disabled"}`;
      el.innerHTML = `
        <div class="hand-card-top">
          <span class="hand-card-kind">${meta.kindLabel}</span>
          <span class="hand-card-cost">${meta.cost}</span>
        </div>
        <div class="hand-card-name">${meta.name}</div>
        <div class="hand-card-desc">${meta.desc}</div>
      `;
      if (affordable) el.addEventListener("click", () => playCard(i));
      handEl.appendChild(el);
    });
  }

  function renderActions() {
    actionsEl.innerHTML = "";
    const buttons = [];
    if (!isTrainer) {
      buttons.push({
        label: `잡기${party.length >= 4 ? " (가방 가득참)" : ""}`,
        action: doCatch,
        disabled: party.length >= 4,
      });
      buttons.push({ label: "도망가기", action: doRun });
    }
    const hasBackup = party.some((m, i) => i !== state.activeIndex && m.hp > 0);
    buttons.push({ label: "몬스터 교체", action: doSwitch, disabled: !hasBackup });

    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.className = "battle-action-btn";
      btn.textContent = b.label;
      btn.disabled = !!b.disabled;
      if (b.action) btn.addEventListener("click", b.action);
      actionsEl.appendChild(btn);
    }
  }

  function lockBottom() {
    handEl.querySelectorAll(".hand-card").forEach((el) => el.classList.add("disabled"));
    actionsEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
    endTurnBtn.disabled = true;
  }

  function startPlayerTurn() {
    if (state.finished) return;
    state.block = 0;
    state.hand = drawFromMonsterDeck(active(), calcHandSize(active()));
    state.maxEnergy = calcMaxEnergy(active());
    state.energy = state.maxEnergy;
    endTurnBtn.disabled = false;
    render();
  }

  function playCard(index) {
    if (state.finished) return;
    const card = state.hand[index];
    if (!card) return;
    const meta = cardMeta(card.kind, active());
    if (meta.cost > state.energy) return;

    state.energy -= meta.cost;
    state.hand.splice(index, 1);
    active().discard.push(card);

    const p = active();
    const atkInfo = ATTACK_KINDS[card.kind];
    if (atkInfo) {
      const dmg = calcDamage(p, enemy, atkInfo.mult);
      enemy.hp -= dmg;
      addLog(`${p.name}의 ${meta.name}! ${enemy.name}에게 ${dmg}의 피해.`);
      if (atkInfo.lifesteal) {
        const healBack = Math.round(dmg * atkInfo.lifesteal);
        p.hp = Math.min(p.maxHp, p.hp + healBack);
        addLog(`${p.name}이(가) 흡혈로 체력을 ${healBack} 회복했다.`);
      }
      if (enemy.hp <= 0) {
        enemy.hp = 0;
        addLog(`${enemy.name}을(를) 쓰러뜨렸다!`);
        tryLearnCard(p);
        awardExp(p, expReward(enemy, isTrainer));
        finish("win");
        return;
      }
      if (atkInfo.draw) {
        const drawn = drawFromMonsterDeck(p, atkInfo.draw);
        state.hand.push(...drawn);
        addLog(`${p.name}이(가) 카드를 ${drawn.length}장 더 뽑았다.`);
      }
    } else if (card.kind === "defend") {
      const gained = calcBlock(p);
      state.block += gained;
      addLog(`${p.name}이(가) 방어막을 ${gained} 얻었다.`);
    } else if (card.kind === "heal") {
      const healAmt = calcHeal(p);
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      addLog(`${p.name}이(가) 체력을 ${healAmt} 회복했다.`);
    }

    render();
  }

  function awardExp(p, amount) {
    addLog(`${p.name}이(가) 경험치 ${amount}을(를) 얻었다.`);
    const levelsGained = gainExp(p, amount);
    if (levelsGained > 0) {
      addLog(`${p.name}의 레벨이 ${p.level}(으)로 올랐다!`);
    }
  }

  function tryLearnCard(p) {
    const enemyKinds = new Set([...enemy.deck, ...enemy.discard].map((c) => c.kind));
    const learnable = [...enemyKinds].filter((k) => !p.knownKinds.includes(k));
    if (learnable.length === 0) return;
    if (Math.random() >= LEARN_CHANCE) return;

    const kind = learnable[randInt(0, learnable.length - 1)];
    p.knownKinds.push(kind);
    p.discard.push(makeCard(kind));
    const meta = cardMeta(kind, p);
    addLog(`${p.name}이(가) ${enemy.name}에게서 '${meta.name}' 카드를 배웠다!`);
  }

  function enemyAttack() {
    if (state.finished || enemy.hp <= 0) return;
    const p = active();
    let dmg = calcDamage(enemy, p, 1.0);
    if (state.block > 0) {
      const absorbed = Math.min(state.block, dmg);
      state.block -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) addLog(`방어막이 ${absorbed}의 피해를 막았다!`);
    }
    if (dmg > 0) {
      p.hp -= dmg;
      addLog(`${enemy.name}의 공격! ${p.name}에게 ${dmg}의 피해.`);
    }

    if (p.hp <= 0) {
      p.hp = 0;
      addLog(`${p.name}이(가) 쓰러졌다!`);
      const next = state.party.findIndex((m) => m.hp > 0);
      if (next === -1) {
        finish("lose");
        return;
      }
      state.activeIndex = next;
      addLog(`${state.party[next].name}, 이어서 싸워라!`);
    }
  }

  function endTurn() {
    if (state.finished) return;
    active().discard.push(...state.hand);
    state.hand = [];
    lockBottom();
    render();
    setTimeout(() => {
      enemyAttack();
      if (state.finished) return;
      render();
      setTimeout(startPlayerTurn, 500);
    }, 500);
  }

  function doCatch() {
    if (party.length >= 4) return;
    lockBottom();
    const hpFrac = enemy.hp / enemy.maxHp;
    const chance = Math.min(0.9, Math.max(0.15, 0.85 - hpFrac * 0.55));
    addLog(`몬스터볼을 던졌다...`);
    if (Math.random() < chance) {
      addLog(`${enemy.name}을(를) 잡았다!`);
      party.push(createMonster(enemy.speciesId, enemy.level));
      awardExp(active(), expReward(enemy, isTrainer));
      finish("caught");
    } else {
      addLog(`아쉽게 놓쳤다!`);
      endTurn();
    }
  }

  function doRun() {
    lockBottom();
    if (Math.random() < 0.8) {
      addLog(`무사히 도망쳤다.`);
      finish("fled");
    } else {
      addLog(`도망치지 못했다!`);
      endTurn();
    }
  }

  function doSwitch() {
    const options = party
      .map((m, i) => ({ m, i }))
      .filter(({ m, i }) => i !== state.activeIndex && m.hp > 0);
    if (options.length === 0) return;
    lockBottom();
    actionsEl.innerHTML = "";
    for (const { m, i } of options) {
      const btn = document.createElement("button");
      btn.className = "battle-action-btn";
      btn.textContent = `${m.name} Lv.${m.level} (${m.hp}/${m.maxHp})`;
      btn.addEventListener("click", () => {
        active().discard.push(...state.hand);
        state.hand = [];
        state.activeIndex = i;
        addLog(`${m.name}, 나와라!`);
        endTurn();
      });
      actionsEl.appendChild(btn);
    }
    const cancel = document.createElement("button");
    cancel.className = "battle-action-btn";
    cancel.textContent = "취소";
    cancel.addEventListener("click", () => {
      endTurnBtn.disabled = false;
      render();
    });
    actionsEl.appendChild(cancel);
  }

  endTurnBtn.onclick = endTurn;

  function finish(result) {
    state.finished = true;
    if (state.hand.length) {
      active().discard.push(...state.hand);
      state.hand = [];
    }
    lockBottom();
    setTimeout(() => {
      screen.classList.add("hidden");
      onEnd(result);
    }, 700);
  }

  startPlayerTurn();
}
