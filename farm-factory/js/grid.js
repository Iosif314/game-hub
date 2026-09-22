export const TILE_SIZE = 40;
export const COLS = 20;
export const ROWS = 13;

export function createGrid() {
  const cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  return { cols: COLS, rows: ROWS, cells };
}

export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}
