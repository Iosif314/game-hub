export const TILE = {
  GRASS: 0,
  PATH: 1,
  TREE: 2,
  WATER: 3,
  FLOOR: 4,
  WALL: 5,
};

export const BLOCKING = new Set([TILE.TREE, TILE.WATER, TILE.WALL]);

export const TILE_SIZE = 32;
export const WORLD_W = 50;
export const WORLD_H = 32;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fillRect(grid, x, y, w, h, tile) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (yy >= 0 && yy < WORLD_H && xx >= 0 && xx < WORLD_W) {
        grid[yy][xx] = tile;
      }
    }
  }
}

function blob(grid, cx, cy, radius, tile, avoid) {
  for (let yy = cy - radius; yy <= cy + radius; yy++) {
    for (let xx = cx - radius; xx <= cx + radius; xx++) {
      if (xx < 1 || yy < 1 || xx >= WORLD_W - 1 || yy >= WORLD_H - 1) continue;
      const dist = Math.hypot(xx - cx, yy - cy);
      if (dist <= radius && Math.random() < 0.75 - dist / (radius * 2)) {
        if (avoid && avoid(xx, yy)) continue;
        grid[yy][xx] = tile;
      }
    }
  }
}

export const TOWN_ZONE = { x: 2, y: 2, w: 12, h: 9 };
export const WILD_ZONE = { x: 15, y: 1, w: WORLD_W - 17, h: WORLD_H - 3 };

export function generateWorld() {
  const grid = Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(TILE.GRASS));

  // border
  fillRect(grid, 0, 0, WORLD_W, 1, TILE.TREE);
  fillRect(grid, 0, WORLD_H - 1, WORLD_W, 1, TILE.TREE);
  fillRect(grid, 0, 0, 1, WORLD_H, TILE.TREE);
  fillRect(grid, WORLD_W - 1, 0, 1, WORLD_H, TILE.TREE);

  // town ground
  fillRect(grid, TOWN_ZONE.x, TOWN_ZONE.y, TOWN_ZONE.w, TOWN_ZONE.h, TILE.FLOOR);

  // a couple of decorative buildings (blocking) inside the town
  fillRect(grid, TOWN_ZONE.x + 1, TOWN_ZONE.y + 1, 3, 2, TILE.WALL);
  fillRect(grid, TOWN_ZONE.x + 6, TOWN_ZONE.y + 1, 4, 2, TILE.WALL);
  fillRect(grid, TOWN_ZONE.x + 1, TOWN_ZONE.y + 6, 4, 2, TILE.WALL);

  const inTown = (x, y) =>
    x >= TOWN_ZONE.x && x < TOWN_ZONE.x + TOWN_ZONE.w && y >= TOWN_ZONE.y && y < TOWN_ZONE.y + TOWN_ZONE.h;

  // tree clusters in the wilderness
  for (let i = 0; i < 14; i++) {
    const cx = randInt(WILD_ZONE.x + 2, WILD_ZONE.x + WILD_ZONE.w - 3);
    const cy = randInt(WILD_ZONE.y + 2, WILD_ZONE.y + WILD_ZONE.h - 3);
    blob(grid, cx, cy, randInt(2, 4), TILE.TREE, inTown);
  }

  // a pond
  blob(grid, WORLD_W - 14, 8, 4, TILE.WATER, inTown);

  // winding path from the town gate into the wilderness
  let px = TOWN_ZONE.x + TOWN_ZONE.w - 1;
  let py = TOWN_ZONE.y + Math.floor(TOWN_ZONE.h / 2);
  for (let i = 0; i < 70; i++) {
    if (grid[py] && grid[py][px] !== TILE.TREE && grid[py][px] !== TILE.WATER) {
      grid[py][px] = TILE.PATH;
    }
    const dir = Math.random();
    if (dir < 0.55) px += 1;
    else if (dir < 0.75) py += Math.random() < 0.5 ? 1 : -1;
    else px += 1;
    px = Math.max(1, Math.min(WORLD_W - 2, px));
    py = Math.max(1, Math.min(WORLD_H - 2, py));
  }

  return { grid };
}

export function isBlocked(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return true;
  return BLOCKING.has(world.grid[ty][tx]);
}

export function randomWalkableTile(world, zone, filterFn) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = randInt(zone.x, zone.x + zone.w - 1);
    const y = randInt(zone.y, zone.y + zone.h - 1);
    if (isBlocked(world, x, y)) continue;
    if (filterFn && !filterFn(x, y)) continue;
    return { x, y };
  }
  return null;
}
