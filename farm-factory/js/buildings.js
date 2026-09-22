import { CROPS, RECIPES } from "./items.js";

export const PALETTE = [
  { id: "plot_wheat", kind: "plot", cropId: "wheat", name: "밀밭", cost: 8, directional: true },
  { id: "plot_corn", kind: "plot", cropId: "corn", name: "옥수수밭", cost: 10, directional: true },
  { id: "plot_tomato", kind: "plot", cropId: "tomato", name: "토마토밭", cost: 10, directional: true },
  { id: "autoplot_wheat", kind: "autoplot", cropId: "wheat", name: "자동 밀 재배기", cost: 70, directional: true },
  { id: "autoplot_corn", kind: "autoplot", cropId: "corn", name: "자동 옥수수 재배기", cost: 90, directional: true },
  { id: "autoplot_tomato", kind: "autoplot", cropId: "tomato", name: "자동 토마토 재배기", cost: 90, directional: true },
  { id: "belt", kind: "belt", name: "컨베이어 벨트", cost: 4, directional: true },
  { id: "mill", kind: "processor", recipeId: "mill", name: "제분기", cost: 55, directional: true },
  { id: "oven", kind: "processor", recipeId: "oven", name: "오븐", cost: 110, directional: true },
  { id: "juicer", kind: "processor", recipeId: "juicer", name: "착즙기", cost: 85, directional: true },
  { id: "popper", kind: "processor", recipeId: "popper", name: "팝콘기", cost: 85, directional: true },
  { id: "seller", kind: "seller", name: "판매대", cost: 15, directional: false },
];

export const PALETTE_BY_ID = Object.fromEntries(PALETTE.map((p) => [p.id, p]));

export const DIR_VECS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const DIR_ORDER = ["up", "right", "down", "left"];

export function nextDir(dir) {
  const i = DIR_ORDER.indexOf(dir);
  return DIR_ORDER[(i + 1) % DIR_ORDER.length];
}

export function createBuilding(tool, dir) {
  const base = { paletteId: tool.id, kind: tool.kind, dir: dir || "up" };
  if (tool.kind === "plot" || tool.kind === "autoplot") {
    return { ...base, cropId: tool.cropId, growProgress: 0, ready: false };
  }
  if (tool.kind === "belt") {
    return { ...base, item: null };
  }
  if (tool.kind === "processor") {
    return { ...base, recipeId: tool.recipeId, inputBuffered: false, processProgress: 0 };
  }
  if (tool.kind === "seller") {
    return { ...base, flashT: 0 };
  }
  return base;
}

export function canAcceptItem(targetCell, itemId) {
  if (!targetCell) return false;
  if (targetCell.kind === "belt") return targetCell.item === null;
  if (targetCell.kind === "processor") {
    const recipe = RECIPES[targetCell.recipeId];
    return recipe.input === itemId && !targetCell.inputBuffered;
  }
  if (targetCell.kind === "seller") return true;
  return false;
}

export function pushItemOnto(targetCell, itemId, onSell) {
  if (targetCell.kind === "belt") {
    targetCell.item = { itemId, progress: 0 };
  } else if (targetCell.kind === "processor") {
    targetCell.inputBuffered = true;
    targetCell.processProgress = 0;
  } else if (targetCell.kind === "seller") {
    targetCell.flashT = 300;
    if (onSell) onSell(itemId);
  }
}

function neighborCoord(x, y, dir) {
  const [dx, dy] = DIR_VECS[dir];
  return { x: x + dx, y: y + dy };
}

export function tickGrid(grid, dt, onSell) {
  const { cols, rows, cells } = grid;

  const getAt = (x, y) => (x >= 0 && y >= 0 && x < cols && y < rows ? cells[y][x] : null);

  // crops (manual plots just grow; autoplots also self-harvest)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = cells[y][x];
      if (!cell || (cell.kind !== "plot" && cell.kind !== "autoplot")) continue;
      const crop = CROPS[cell.cropId];
      if (!cell.ready) {
        cell.growProgress += dt / crop.growTime;
        if (cell.growProgress >= 1) {
          cell.growProgress = 1;
          cell.ready = true;
        }
      }
      if (cell.kind === "autoplot" && cell.ready) {
        const n = neighborCoord(x, y, cell.dir);
        const target = getAt(n.x, n.y);
        if (canAcceptItem(target, crop.itemId)) {
          pushItemOnto(target, crop.itemId, onSell);
          cell.ready = false;
          cell.growProgress = 0;
        }
      }
    }
  }

  // belts move their single item toward the next tile
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = cells[y][x];
      if (!cell || cell.kind !== "belt" || !cell.item) continue;
      if (cell.item.progress < 1) {
        cell.item.progress = Math.min(1, cell.item.progress + dt / 700);
      }
      if (cell.item.progress >= 1) {
        const n = neighborCoord(x, y, cell.dir);
        const target = getAt(n.x, n.y);
        if (canAcceptItem(target, cell.item.itemId)) {
          pushItemOnto(target, cell.item.itemId, onSell);
          cell.item = null;
        }
      }
    }
  }

  // processors consume buffered input over time, then push output
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = cells[y][x];
      if (!cell || cell.kind !== "processor" || !cell.inputBuffered) continue;
      const recipe = RECIPES[cell.recipeId];
      if (cell.processProgress < 1) {
        cell.processProgress = Math.min(1, cell.processProgress + dt / recipe.time);
      }
      if (cell.processProgress >= 1) {
        const n = neighborCoord(x, y, cell.dir);
        const target = getAt(n.x, n.y);
        if (canAcceptItem(target, recipe.output)) {
          pushItemOnto(target, recipe.output, onSell);
          cell.inputBuffered = false;
          cell.processProgress = 0;
        }
      }
    }
  }

  // seller flash fade
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = cells[y][x];
      if (cell && cell.kind === "seller" && cell.flashT > 0) {
        cell.flashT = Math.max(0, cell.flashT - dt);
      }
    }
  }
}

// Manual harvest for a player-clicked "plot" (autoplot harvests itself in tickGrid).
export function harvestPlot(grid, x, y, onSell) {
  const cell = grid.cells[y][x];
  if (!cell || cell.kind !== "plot" || !cell.ready) return false;
  const crop = CROPS[cell.cropId];
  const n = neighborCoord(x, y, cell.dir);
  const target = grid.cells[n.y]?.[n.x] ?? null;
  if (!canAcceptItem(target, crop.itemId)) return false;
  pushItemOnto(target, crop.itemId, onSell);
  cell.ready = false;
  cell.growProgress = 0;
  return true;
}
