import { TILE, TILE_SIZE, WORLD_W, WORLD_H, TOWN_ZONE, WILD_ZONE, generateWorld, isBlocked, randomWalkableTile } from "./world.js";
import { SPECIES, STARTER_IDS, WILD_IDS, createMonster } from "./monsters.js";
import { startBattle } from "./battle.js";
import { getGroupPassive } from "./passives.js";
import { openDeckEditor } from "./deckEditor.js";

const VIEW_W = 25;
const VIEW_H = 15;
const MOVE_DURATION = 150;

const canvas = document.getElementById("world-canvas");
const ctx = canvas.getContext("2d");
canvas.width = VIEW_W * TILE_SIZE;
canvas.height = VIEW_H * TILE_SIZE;

const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlay-message");
const starterChoices = document.getElementById("starter-choices");
const dialogueBox = document.getElementById("dialogue-box");
const dialogueName = document.getElementById("dialogue-name");
const dialogueText = document.getElementById("dialogue-text");
const dialogueNext = document.getElementById("dialogue-next");
const hudGold = document.getElementById("hud-gold");
const hudParty = document.getElementById("hud-party");

const TILE_COLORS = {
  [TILE.GRASS]: "#3a5a3a",
  [TILE.PATH]: "#8a7a5a",
  [TILE.TREE]: "#1f3a24",
  [TILE.WATER]: "#2d5a80",
  [TILE.FLOOR]: "#5a5a4a",
  [TILE.WALL]: "#4a4238",
};

let world = null;
let entities = [];
let mode = "starter-select";
let dialogueQueue = [];
let keysDown = new Set();

const player = {
  tileX: 0,
  tileY: 0,
  pixelX: 0,
  pixelY: 0,
  fromX: 0,
  fromY: 0,
  toX: 0,
  toY: 0,
  moving: false,
  moveT: 0,
  dir: "down",
  party: [],
  gold: 30,
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setupWorld() {
  world = generateWorld();
  entities = [];

  const gateX = TOWN_ZONE.x + TOWN_ZONE.w - 1;
  const gateY = TOWN_ZONE.y + Math.floor(TOWN_ZONE.h / 2);
  player.tileX = TOWN_ZONE.x + 2;
  player.tileY = gateY;
  player.pixelX = player.tileX * TILE_SIZE;
  player.pixelY = player.tileY * TILE_SIZE;

  // town NPCs
  const healerSpot = randomWalkableTile(world, { x: TOWN_ZONE.x + 5, y: TOWN_ZONE.y + 3, w: 4, h: 4 });
  if (healerSpot) {
    entities.push({
      kind: "npc",
      isHealer: true,
      name: "치료사",
      color: "#5da9e3",
      glyph: "N",
      tileX: healerSpot.x,
      tileY: healerSpot.y,
      pixelX: healerSpot.x * TILE_SIZE,
      pixelY: healerSpot.y * TILE_SIZE,
      moving: false,
      moveT: 0,
      dir: "down",
      leash: 0,
      homeX: healerSpot.x,
      homeY: healerSpot.y,
      wanderTimer: 9999,
      lines: ["어서 오세요! 몬스터들을 모두 치료해 드릴게요."],
    });
  }

  const villagerSpot = randomWalkableTile(world, { x: TOWN_ZONE.x + 1, y: TOWN_ZONE.y + 4, w: 3, h: 4 });
  if (villagerSpot) {
    entities.push({
      kind: "npc",
      isHealer: false,
      name: "마을 사람",
      color: "#c1cf4e",
      glyph: "N",
      tileX: villagerSpot.x,
      tileY: villagerSpot.y,
      pixelX: villagerSpot.x * TILE_SIZE,
      pixelY: villagerSpot.y * TILE_SIZE,
      moving: false,
      moveT: 0,
      dir: "down",
      leash: 1,
      homeX: villagerSpot.x,
      homeY: villagerSpot.y,
      wanderTimer: randInt(1000, 2500),
      lines: ["동쪽 들판에는 야생 몬스터가 많이 산대요.", "조심해서 다녀오세요!"],
    });
  }

  // trainers in the wild
  const trainerNames = ["여행자 민준", "낚시꾼 하늘"];
  for (let i = 0; i < 2; i++) {
    const spot = randomWalkableTile(world, WILD_ZONE, (x) => x > TOWN_ZONE.x + TOWN_ZONE.w + 3);
    if (!spot) continue;
    const speciesId = WILD_IDS[randInt(0, WILD_IDS.length - 1)];
    entities.push({
      kind: "trainer",
      name: trainerNames[i],
      speciesId,
      level: randInt(4, 7),
      reward: randInt(15, 30),
      defeated: false,
      color: "#e3915d",
      glyph: "!",
      tileX: spot.x,
      tileY: spot.y,
      pixelX: spot.x * TILE_SIZE,
      pixelY: spot.y * TILE_SIZE,
      moving: false,
      moveT: 0,
      dir: "down",
      leash: 0,
      homeX: spot.x,
      homeY: spot.y,
      wanderTimer: 9999,
      preLines: [`${trainerNames[i]}: 오, 트레이너잖아! 나랑 승부하자!`],
      postLines: [`${trainerNames[i]}: 역시 강하네... 다음엔 꼭 이길 거야.`],
    });
  }

  // wild monsters
  for (let i = 0; i < 10; i++) {
    const spot = randomWalkableTile(world, WILD_ZONE, (x) => x > TOWN_ZONE.x + TOWN_ZONE.w + 1);
    if (!spot) continue;
    const speciesId = WILD_IDS[randInt(0, WILD_IDS.length - 1)];
    entities.push({
      kind: "wild",
      speciesId,
      level: randInt(2, 6),
      color: SPECIES[speciesId].color,
      glyph: SPECIES[speciesId].glyph,
      name: SPECIES[speciesId].name,
      tileX: spot.x,
      tileY: spot.y,
      pixelX: spot.x * TILE_SIZE,
      pixelY: spot.y * TILE_SIZE,
      moving: false,
      moveT: 0,
      dir: "down",
      leash: 3,
      homeX: spot.x,
      homeY: spot.y,
      wanderTimer: randInt(800, 2000),
    });
  }
}

function entityAt(x, y) {
  return entities.find((e) => e.tileX === x && e.tileY === y) || null;
}

function dirFromDelta(dx, dy) {
  if (dx === 1) return "right";
  if (dx === -1) return "left";
  if (dy === 1) return "down";
  return "up";
}

function startMove(entity, dx, dy) {
  entity.dir = dirFromDelta(dx, dy);
  entity.moving = true;
  entity.moveT = 0;
  entity.fromX = entity.pixelX;
  entity.fromY = entity.pixelY;
  entity.tileX += dx;
  entity.tileY += dy;
  entity.toX = entity.tileX * TILE_SIZE;
  entity.toY = entity.tileY * TILE_SIZE;
}

function advanceMovement(entity, dt) {
  if (!entity.moving) return;
  entity.moveT += dt / MOVE_DURATION;
  if (entity.moveT >= 1) {
    entity.moveT = 1;
    entity.moving = false;
    entity.pixelX = entity.toX;
    entity.pixelY = entity.toY;
    if (entity === player && playerMoveQueue.length > 0) {
      const [qdx, qdy] = playerMoveQueue.shift();
      resolvePlayerMove(qdx, qdy);
    }
  } else {
    entity.pixelX = entity.fromX + (entity.toX - entity.fromX) * entity.moveT;
    entity.pixelY = entity.fromY + (entity.toY - entity.fromY) * entity.moveT;
  }
}

const MOVE_KEYS = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};

const playerMoveQueue = [];
const MAX_QUEUE = 4;

function resolvePlayerMove(dx, dy) {
  const nx = player.tileX + dx;
  const ny = player.tileY + dy;
  player.dir = dirFromDelta(dx, dy);

  const ent = entityAt(nx, ny);
  if (ent) {
    playerMoveQueue.length = 0;
    interact(ent);
    return;
  }
  if (isBlocked(world, nx, ny)) return;

  startMove(player, dx, dy);
}

function attemptPlayerMove(dx, dy) {
  if (mode !== "overworld") return;
  if (player.moving) {
    if (playerMoveQueue.length < MAX_QUEUE) playerMoveQueue.push([dx, dy]);
    return;
  }
  resolvePlayerMove(dx, dy);
}

function handlePlayerInput(dt) {
  if (mode !== "overworld") return;
  advanceMovement(player, dt);
  if (player.moving) return;

  for (const key of keysDown) {
    if (MOVE_KEYS[key]) {
      attemptPlayerMove(MOVE_KEYS[key][0], MOVE_KEYS[key][1]);
      break;
    }
  }
}

function updateWildEntities(dt) {
  if (mode !== "overworld") return;
  for (const ent of entities) {
    advanceMovement(ent, dt);
    if (ent.moving || ent.leash <= 0) continue;
    ent.wanderTimer -= dt;
    if (ent.wanderTimer > 0) continue;
    ent.wanderTimer = randInt(1200, 2600);
    if (Math.random() > 0.5) continue;

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [dx, dy] = dirs[randInt(0, 3)];
    const nx = ent.tileX + dx;
    const ny = ent.tileY + dy;
    if (Math.hypot(nx - ent.homeX, ny - ent.homeY) > ent.leash) continue;
    if (isBlocked(world, nx, ny)) continue;
    if (entityAt(nx, ny)) continue;
    if (player.tileX === nx && player.tileY === ny) continue;
    startMove(ent, dx, dy);
  }
}

function interact(ent) {
  if (ent.kind === "npc") {
    if (ent.isHealer) {
      healParty();
      renderHud();
      openDialogue(ent.name, ["...짜잔! 모든 몬스터가 회복되었습니다.", ...ent.lines]);
    } else {
      openDialogue(ent.name, ent.lines);
    }
  } else if (ent.kind === "trainer") {
    if (ent.defeated) {
      openDialogue(ent.name, ent.postLines);
    } else {
      mode = "battle";
      const enemy = createMonster(ent.speciesId, ent.level);
      startBattle({
        party: player.party,
        enemy,
        isTrainer: true,
        enemyTrainerName: ent.name,
        onEnd: (result) => {
          if (result === "win") {
            ent.defeated = true;
            player.gold += ent.reward;
          }
          mode = "overworld";
          renderHud();
          checkBlackout();
        },
      });
    }
  } else if (ent.kind === "wild") {
    mode = "battle";
    const enemy = createMonster(ent.speciesId, ent.level);
    startBattle({
      party: player.party,
      enemy,
      isTrainer: false,
      onEnd: (result) => {
        if (result === "win" || result === "caught") {
          entities = entities.filter((e) => e !== ent);
        }
        mode = "overworld";
        renderHud();
        checkBlackout();
      },
    });
  }
}

function checkBlackout() {
  if (player.party.every((m) => m.hp <= 0)) {
    const gateX = TOWN_ZONE.x + 2;
    const gateY = TOWN_ZONE.y + Math.floor(TOWN_ZONE.h / 2);
    player.tileX = gateX;
    player.tileY = gateY;
    player.pixelX = gateX * TILE_SIZE;
    player.pixelY = gateY * TILE_SIZE;
    healParty();
    renderHud();
    openDialogue("...", ["정신을 차려보니 마을 앞이었다.", "치료사가 몬스터들을 모두 치료해 주었다."]);
  }
}

function healParty() {
  for (const m of player.party) m.hp = m.maxHp;
}

function openDialogue(name, lines) {
  mode = "dialogue";
  dialogueQueue = [...lines];
  dialogueName.textContent = name;
  dialogueBox.classList.remove("hidden");
  showNextLine();
}

function showNextLine() {
  if (dialogueQueue.length === 0) {
    closeDialogue();
    return;
  }
  dialogueText.textContent = dialogueQueue.shift();
}

function closeDialogue() {
  dialogueBox.classList.add("hidden");
  mode = "overworld";
}

dialogueNext.addEventListener("click", showNextLine);

window.addEventListener("keydown", (e) => {
  if (MOVE_KEYS[e.key]) e.preventDefault();
  keysDown.add(e.key);
  if (mode === "dialogue" && (e.key === "Enter" || e.key === " ")) {
    showNextLine();
    return;
  }
  if (mode === "overworld" && MOVE_KEYS[e.key] && !e.repeat) {
    attemptPlayerMove(MOVE_KEYS[e.key][0], MOVE_KEYS[e.key][1]);
  }
});
window.addEventListener("keyup", (e) => {
  keysDown.delete(e.key);
});

function render() {
  const camX = Math.max(
    0,
    Math.min(WORLD_W * TILE_SIZE - canvas.width, player.pixelX + TILE_SIZE / 2 - canvas.width / 2)
  );
  const camY = Math.max(
    0,
    Math.min(WORLD_H * TILE_SIZE - canvas.height, player.pixelY + TILE_SIZE / 2 - canvas.height / 2)
  );

  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const startCol = Math.floor(camX / TILE_SIZE);
  const endCol = Math.ceil((camX + canvas.width) / TILE_SIZE);
  const startRow = Math.floor(camY / TILE_SIZE);
  const endRow = Math.ceil((camY + canvas.height) / TILE_SIZE);

  for (let ty = startRow; ty < endRow; ty++) {
    for (let tx = startCol; tx < endCol; tx++) {
      if (ty < 0 || ty >= WORLD_H || tx < 0 || tx >= WORLD_W) continue;
      const tile = world.grid[ty][tx];
      ctx.fillStyle = TILE_COLORS[tile];
      ctx.fillRect(tx * TILE_SIZE - camX, ty * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE);
    }
  }

  const drawEntity = (ent, glyph, color) => {
    const px = ent.pixelX - camX + TILE_SIZE / 2;
    const py = ent.pixelY - camY + TILE_SIZE / 2;
    if (px < -TILE_SIZE || py < -TILE_SIZE || px > canvas.width + TILE_SIZE || py > canvas.height + TILE_SIZE) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, TILE_SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#14141c";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(glyph, px, py + 1);
  };

  for (const ent of entities) {
    drawEntity(ent, ent.glyph, ent.color);
  }
  drawEntity(player, "@", "#f2c14e");
}

function renderHud() {
  hudGold.textContent = `골드 ${player.gold}`;
  hudParty.innerHTML = "";
  for (const m of player.party) {
    const chip = document.createElement("div");
    chip.className = "party-chip" + (m.hp <= 0 ? " fainted" : "");
    chip.title = (m.passives || []).map((p) => `${p.name}: ${p.desc}`).join("\n");
    const dot = document.createElement("span");
    dot.className = "party-chip-dot";
    dot.style.background = m.color;
    chip.appendChild(dot);
    const label = document.createElement("span");
    label.textContent = `${m.name} Lv.${m.level} ${m.hp}/${m.maxHp}`;
    chip.appendChild(label);
    chip.addEventListener("click", () => {
      if (mode !== "overworld") return;
      mode = "menu";
      openDeckEditor(m, player.party, () => {
        mode = "overworld";
        renderHud();
      });
    });
    hudParty.appendChild(chip);
  }
}

let lastTime = null;
function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (mode === "overworld") {
    handlePlayerInput(dt);
    updateWildEntities(dt);
  }
  if (mode === "overworld" || mode === "dialogue") {
    render();
  }
  requestAnimationFrame(loop);
}

function setupStarterSelect() {
  starterChoices.innerHTML = "";
  for (const id of STARTER_IDS) {
    const species = SPECIES[id];
    const btn = document.createElement("button");
    btn.className = "starter-btn";
    const groupPassive = getGroupPassive(id);
    btn.title = `종족 특성 - ${groupPassive.name}: ${groupPassive.desc}\n(선택 시 무작위 특성도 하나 추가로 부여됩니다)`;
    const glyph = document.createElement("div");
    glyph.className = "starter-glyph";
    glyph.style.background = species.color;
    glyph.textContent = species.glyph;
    btn.appendChild(glyph);
    const label = document.createElement("span");
    label.textContent = species.name;
    btn.appendChild(label);
    btn.addEventListener("click", () => chooseStarter(id));
    starterChoices.appendChild(btn);
  }
}

function chooseStarter(id) {
  player.party = [createMonster(id, 5)];
  overlay.classList.add("hidden");
  mode = "overworld";
  renderHud();
}

setupWorld();
setupStarterSelect();
requestAnimationFrame(loop);
