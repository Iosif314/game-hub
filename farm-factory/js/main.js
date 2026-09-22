import { TILE_SIZE, COLS, ROWS, createGrid } from "./grid.js";
import { PALETTE, PALETTE_BY_ID, DIR_VECS, nextDir, createBuilding, tickGrid, harvestPlot } from "./buildings.js";
import { ITEMS, CROPS, RECIPES, SELL_PRICE } from "./items.js";

const canvas = document.getElementById("world-canvas");
const ctx = canvas.getContext("2d");
canvas.width = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;

const hudGold = document.getElementById("hud-gold");
const hudHint = document.getElementById("hud-hint");
const hudToast = document.getElementById("hud-toast");
const paletteEl = document.getElementById("palette");

const RECIPE_COLORS = { mill: "#a0824f", oven: "#c9834b", juicer: "#e35d9d", popper: "#e3b95d" };

const grid = createGrid();
let gold = 120;
let selectedToolId = null;
let currentDir = "up";
let hoverTile = null;
let toastText = "";
let toastTimer = 0;

function cropColor(cropId) {
  return ITEMS[CROPS[cropId].itemId].color;
}

function showToast(msg) {
  toastText = msg;
  toastTimer = 1800;
}

function onSell(itemId) {
  gold += SELL_PRICE[itemId] || 0;
}

function renderHud() {
  hudGold.textContent = `골드 ${Math.floor(gold)}`;
  let toolLabel;
  if (selectedToolId === "__demolish") {
    toolLabel = "선택: 철거 도구 — 건물을 클릭하면 철거합니다";
  } else if (selectedToolId) {
    toolLabel = `선택: ${PALETTE_BY_ID[selectedToolId].name} (${currentDir}) — R로 회전`;
  } else {
    toolLabel = "R: 회전 · 클릭: 설치/수확 · Esc: 선택 해제";
  }
  hudHint.textContent = toolLabel;
  hudToast.textContent = toastTimer > 0 ? toastText : "";
}

function setupPalette() {
  paletteEl.innerHTML = "";
  for (const tool of PALETTE) {
    const btn = document.createElement("button");
    btn.className = "palette-btn";
    btn.dataset.id = tool.id;

    const swatch = document.createElement("span");
    swatch.className = "palette-swatch";
    if (tool.kind === "plot" || tool.kind === "autoplot") swatch.style.background = cropColor(tool.cropId);
    else if (tool.kind === "belt") swatch.style.background = "#888";
    else if (tool.kind === "processor") swatch.style.background = RECIPE_COLORS[tool.recipeId];
    else if (tool.kind === "seller") swatch.style.background = "#f2c14e";
    btn.appendChild(swatch);

    const label = document.createElement("span");
    label.textContent = tool.name;
    btn.appendChild(label);

    const cost = document.createElement("span");
    cost.className = "palette-cost";
    cost.textContent = `${tool.cost}G`;
    btn.appendChild(cost);

    btn.addEventListener("click", () => selectTool(tool.id));
    paletteEl.appendChild(btn);
  }

  const demolish = document.createElement("button");
  demolish.className = "palette-btn tool-btn";
  demolish.dataset.id = "__demolish";
  demolish.textContent = "🔨 철거 (50% 환불)";
  demolish.addEventListener("click", () => selectTool("__demolish"));
  paletteEl.appendChild(demolish);

  refreshPaletteButtons();
}

function selectTool(id) {
  selectedToolId = selectedToolId === id ? null : id;
  currentDir = "up";
  refreshPaletteButtons();
}

function refreshPaletteButtons() {
  paletteEl.querySelectorAll(".palette-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.id === selectedToolId);
    if (btn.dataset.id !== "__demolish") {
      const tool = PALETTE_BY_ID[btn.dataset.id];
      btn.disabled = gold < tool.cost;
    }
  });
}

function getTileFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor(((e.clientX - rect.left) * scaleX) / TILE_SIZE);
  const y = Math.floor(((e.clientY - rect.top) * scaleY) / TILE_SIZE);
  return { x, y };
}

canvas.addEventListener("mousemove", (e) => {
  hoverTile = getTileFromEvent(e);
});
canvas.addEventListener("mouseleave", () => {
  hoverTile = null;
});

canvas.addEventListener("click", (e) => {
  const { x, y } = getTileFromEvent(e);
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;

  if (selectedToolId === "__demolish") {
    const cell = grid.cells[y][x];
    if (!cell) return;
    const tool = PALETTE_BY_ID[cell.paletteId];
    const refund = tool ? Math.floor(tool.cost * 0.5) : 0;
    gold += refund;
    grid.cells[y][x] = null;
    showToast(`철거 완료 (+${refund}G)`);
    return;
  }

  if (selectedToolId) {
    const tool = PALETTE_BY_ID[selectedToolId];
    if (grid.cells[y][x]) {
      showToast("이미 건물이 있어요.");
      return;
    }
    if (gold < tool.cost) {
      showToast("골드가 부족해요.");
      return;
    }
    gold -= tool.cost;
    grid.cells[y][x] = createBuilding(tool, tool.directional ? currentDir : null);
    refreshPaletteButtons();
    return;
  }

  // pointer mode: try manual harvest
  const cell = grid.cells[y][x];
  if (cell && cell.kind === "plot") {
    if (cell.ready) {
      const ok = harvestPlot(grid, x, y, onSell);
      if (!ok) showToast("출력 경로가 막혀있어요.");
    }
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") {
    currentDir = nextDir(currentDir);
  } else if (e.key === "Escape") {
    selectedToolId = null;
  }
});

function drawArrow(cx, cy, dir, size, color) {
  const [dx, dy] = DIR_VECS[dir];
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.6, -size * 0.6);
  ctx.lineTo(-size * 0.6, size * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function itemPositionOnTile(px, py, dir, progress) {
  const [dx, dy] = DIR_VECS[dir];
  const startX = px + TILE_SIZE / 2 - (dx * TILE_SIZE) / 2;
  const startY = py + TILE_SIZE / 2 - (dy * TILE_SIZE) / 2;
  const endX = px + TILE_SIZE / 2 + (dx * TILE_SIZE) / 2;
  const endY = py + TILE_SIZE / 2 + (dy * TILE_SIZE) / 2;
  return { x: startX + (endX - startX) * progress, y: startY + (endY - startY) * progress };
}

function drawCell(cell, px, py) {
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;

  if (cell.kind === "plot" || cell.kind === "autoplot") {
    ctx.fillStyle = "#4a3c2c";
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    const color = cropColor(cell.cropId);
    if (cell.ready) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE_SIZE * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35 + cell.growProgress * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE_SIZE * 0.12 + cell.growProgress * TILE_SIZE * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (cell.kind === "autoplot") {
      ctx.strokeStyle = "#f2c14e";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }
    drawArrow(px + TILE_SIZE - 8, py + TILE_SIZE - 8, cell.dir, 6, "#e8e6f0");
  } else if (cell.kind === "belt") {
    ctx.fillStyle = "#3a3a48";
    ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    drawArrow(cx, cy, cell.dir, 9, "#7d7d90");
    if (cell.item) {
      const { x, y } = itemPositionOnTile(px, py, cell.dir, cell.item.progress);
      ctx.fillStyle = ITEMS[cell.item.itemId].color;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (cell.kind === "processor") {
    const recipe = RECIPES[cell.recipeId];
    ctx.fillStyle = RECIPE_COLORS[cell.recipeId];
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.fillStyle = "#14141c";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(recipe.name[0], cx, cy - 4);
    if (cell.inputBuffered) {
      ctx.fillStyle = "rgba(20,20,28,0.6)";
      ctx.fillRect(px + 5, py + TILE_SIZE - 10, (TILE_SIZE - 10) * cell.processProgress, 5);
    }
    drawArrow(px + TILE_SIZE - 8, py + 8, cell.dir, 6, "#14141c");
  } else if (cell.kind === "seller") {
    ctx.fillStyle = cell.flashT > 0 ? "#fff3c4" : "#f2c14e";
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.fillStyle = "#14141c";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", cx, cy);
  }
}

function render() {
  ctx.fillStyle = "#3a5a3a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE_SIZE, 0);
    ctx.lineTo(x * TILE_SIZE, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE_SIZE);
    ctx.lineTo(canvas.width, y * TILE_SIZE);
    ctx.stroke();
  }

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = grid.cells[y][x];
      if (cell) drawCell(cell, x * TILE_SIZE, y * TILE_SIZE);
    }
  }

  if (hoverTile && selectedToolId && selectedToolId !== "__demolish") {
    const { x, y } = hoverTile;
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) {
      const tool = PALETTE_BY_ID[selectedToolId];
      const valid = !grid.cells[y][x] && gold >= tool.cost;
      ctx.globalAlpha = 0.5;
      const ghost = createBuilding(tool, currentDir);
      drawCell(ghost, x * TILE_SIZE, y * TILE_SIZE);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = valid ? "#5da35d" : "#e35d5d";
      ctx.lineWidth = 2;
      ctx.strokeRect(x * TILE_SIZE + 1, y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  } else if (hoverTile && selectedToolId === "__demolish") {
    const { x, y } = hoverTile;
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS && grid.cells[y][x]) {
      ctx.strokeStyle = "#e35d5d";
      ctx.lineWidth = 2;
      ctx.strokeRect(x * TILE_SIZE + 1, y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }
}

let lastTime = null;
function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  const dt = Math.min(100, timestamp - lastTime);
  lastTime = timestamp;

  tickGrid(grid, dt, onSell);
  if (toastTimer > 0) toastTimer -= dt;

  render();
  renderHud();
  requestAnimationFrame(loop);
}

setupPalette();
requestAnimationFrame(loop);
