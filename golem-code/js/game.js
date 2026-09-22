import { parseProgram, runTick, LangError } from "./lang.js";

export const GRID_ROOMS = 5; // 5x5 rooms -> 9x9 array
export const GRID_SIZE = GRID_ROOMS * 2 - 1;

const TIER_STATS = {
  weak: { hp: 8, atk: 2 },
  normal: { hp: 14, atk: 4 },
  strong: { hp: 22, atk: 7 },
};

const DIRS = {
  위: { dx: 0, dy: -1 },
  아래: { dx: 0, dy: 1 },
  왼쪽: { dx: -1, dy: 0 },
  오른쪽: { dx: 1, dy: 0 },
};

function roomAt(rx, ry) {
  return { x: rx * 2, y: ry * 2 };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function carveMaze() {
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill("wall"));
  const visited = Array.from({ length: GRID_ROOMS }, () => Array(GRID_ROOMS).fill(false));
  const stack = [[0, 0]];
  visited[0][0] = true;
  const roomOrder = [[0, 0]];
  const setFloor = (x, y) => { grid[y][x] = "floor"; };
  setFloor(0, 0);

  while (stack.length) {
    const [rx, ry] = stack[stack.length - 1];
    const neighbors = shuffle([
      [rx + 1, ry], [rx - 1, ry], [rx, ry + 1], [rx, ry - 1],
    ]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < GRID_ROOMS && ny < GRID_ROOMS && !visited[ny][nx]);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny] = neighbors[0];
    const a = roomAt(rx, ry);
    const b = roomAt(nx, ny);
    setFloor(a.x, a.y);
    setFloor(b.x, b.y);
    setFloor((a.x + b.x) / 2, (a.y + b.y) / 2);
    visited[ny][nx] = true;
    roomOrder.push([nx, ny]);
    stack.push([nx, ny]);
  }
  return { grid, roomOrder };
}

export function createDungeon(aiData, stage) {
  const { grid, roomOrder } = carveMaze();
  const start = roomAt(0, 0);
  const [exitRx, exitRy] = roomOrder[roomOrder.length - 1];
  const exit = roomAt(exitRx, exitRy);
  grid[exit.y][exit.x] = "exit";

  const usedCells = new Set([`${start.x},${start.y}`, `${exit.x},${exit.y}`]);
  const floorRooms = [];
  for (let ry = 0; ry < GRID_ROOMS; ry += 1) {
    for (let rx = 0; rx < GRID_ROOMS; rx += 1) {
      const { x, y } = roomAt(rx, ry);
      if (grid[y][x] === "floor" && !usedCells.has(`${x},${y}`)) floorRooms.push({ x, y });
    }
  }
  shuffle(floorRooms);

  const monsters = (aiData.monsters || []).slice(0, 6).map((m, idx) => {
    const cell = floorRooms[idx % floorRooms.length] || { x: exit.x, y: exit.y };
    usedCells.add(`${cell.x},${cell.y}`);
    const stats = TIER_STATS[m.tier] || TIER_STATS.normal;
    return {
      id: `m${idx}`,
      name: m.name,
      flavor: m.flavor,
      tier: m.tier,
      x: cell.x,
      y: cell.y,
      hp: stats.hp + stage * 2,
      maxHp: stats.hp + stage * 2,
      atk: stats.atk + Math.floor(stage / 2),
    };
  });

  const traps = new Set();
  if (aiData.gimmick_type === "traps") {
    const remaining = floorRooms.filter((c) => !usedCells.has(`${c.x},${c.y}`));
    shuffle(remaining);
    remaining.slice(0, Math.max(2, Math.floor(remaining.length * 0.25))).forEach((c) => {
      traps.add(`${c.x},${c.y}`);
    });
  }

  const maxHp = 30 + stage * 4;
  const maxMana = aiData.gimmick_type === "mana_drain" ? 20 : 40;

  return {
    stage,
    grid,
    start,
    exit,
    monsters,
    traps,
    revealedTraps: new Set(),
    gimmickType: aiData.gimmick_type,
    dungeonName: aiData.dungeon_name,
    narrative: aiData.narrative,
    gimmickFlavor: aiData.gimmick_flavor,
    bossName: aiData.boss_name,
    bossFlavor: aiData.boss_flavor,
    golem: { x: start.x, y: start.y, hp: maxHp, maxHp, mana: maxMana, maxMana },
    tick: 0,
    finished: null, // null | "cleared" | "destroyed" | "timeout"
    vars: {}, // persisted script variables, carried across ticks
    visited: new Set([`${start.x},${start.y}`]),
  };
}

function cellType(state, x, y) {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return "벽";
  if (state.grid[y][x] === "wall") return "벽";
  const monster = state.monsters.find((m) => m.hp > 0 && m.x === x && m.y === y);
  if (monster) return "적";
  if (state.grid[y][x] === "exit") return "출구";
  if (state.traps.has(`${x},${y}`) && !state.revealedTraps.has(`${x},${y}`)) return "빈공간";
  return "빈공간";
}

function nearestMonster(state) {
  const alive = state.monsters.filter((m) => m.hp > 0);
  if (alive.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const m of alive) {
    const dist = Math.abs(m.x - state.golem.x) + Math.abs(m.y - state.golem.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = m;
    }
  }
  return { monster: best, dist: bestDist };
}

function directionTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "오른쪽" : "왼쪽";
  return dy >= 0 ? "아래" : "위";
}

function buildApi(state, log, lowVisibility) {
  const vars = state.vars; // persisted across ticks
  const actions = new Set(["이동", "공격", "회복룬_시전", "대기"]);
  const functions = new Set([...actions, "가장가까운적_거리", "가장가까운적_방향", "주변확인", "무작위", "반대방향", "방문했나"]);
  const OPPOSITE = { 위: "아래", 아래: "위", 왼쪽: "오른쪽", 오른쪽: "왼쪽" };

  const readables = {
    내구력: () => state.golem.hp,
    최대내구력: () => state.golem.maxHp,
    마나: () => state.golem.mana,
    최대마나: () => state.golem.maxMana,
    턴수: () => state.tick,
  };

  function requireDir(name, args, line) {
    const d = args[0];
    if (typeof d !== "string" || !DIRS[d]) {
      throw new LangError(`${name}()의 방향 값은 "위"/"아래"/"왼쪽"/"오른쪽" 중 하나여야 합니다`, line);
    }
    return d;
  }

  function call(name, args, line) {
    if (name === "무작위") {
      return Math.random();
    }
    if (name === "반대방향") {
      const d = requireDir(name, args, line);
      return OPPOSITE[d];
    }
    if (name === "방문했나") {
      const d = requireDir(name, args, line);
      const { dx, dy } = DIRS[d];
      return state.visited.has(`${state.golem.x + dx},${state.golem.y + dy}`);
    }
    if (name === "가장가까운적_거리") {
      const found = nearestMonster(state);
      if (!found) return 999;
      if (lowVisibility && found.dist > 3) return 999;
      return found.dist;
    }
    if (name === "가장가까운적_방향") {
      const found = nearestMonster(state);
      if (!found) return "없음";
      if (lowVisibility && found.dist > 3) return "없음";
      return directionTo(state.golem, found.monster);
    }
    if (name === "주변확인") {
      const d = requireDir(name, args, line);
      const { dx, dy } = DIRS[d];
      return cellType(state, state.golem.x + dx, state.golem.y + dy);
    }
    if (name === "이동") {
      const d = requireDir(name, args, line);
      const { dx, dy } = DIRS[d];
      const nx = state.golem.x + dx;
      const ny = state.golem.y + dy;
      const t = cellType(state, nx, ny);
      if (t === "벽") {
        log.push({ type: "info", text: "골렘이 벽에 막혔습니다." });
        return false;
      }
      if (t === "적") {
        log.push({ type: "info", text: "적이 가로막아 이동할 수 없습니다." });
        return false;
      }
      state.golem.x = nx;
      state.golem.y = ny;
      state.visited.add(`${nx},${ny}`);
      const key = `${nx},${ny}`;
      if (state.traps.has(key) && !state.revealedTraps.has(key)) {
        state.revealedTraps.add(key);
        const dmg = 4 + Math.floor(state.stage / 2);
        state.golem.hp -= dmg;
        log.push({ type: "damage", text: `숨겨진 함정을 밟았습니다! (${dmg} 피해)` });
      } else {
        log.push({ type: "move", text: `${d}(으)로 이동했습니다.` });
      }
      return true;
    }
    if (name === "공격") {
      const d = requireDir(name, args, line);
      const { dx, dy } = DIRS[d];
      const tx = state.golem.x + dx;
      const ty = state.golem.y + dy;
      const target = state.monsters.find((m) => m.hp > 0 && m.x === tx && m.y === ty);
      if (!target) {
        log.push({ type: "info", text: "그 방향엔 공격할 대상이 없습니다." });
        return false;
      }
      const dmg = 7 + Math.floor(state.stage / 2);
      target.hp -= dmg;
      log.push({ type: "attack", text: `${target.name}을(를) 공격! (${dmg} 피해, 남은 체력 ${Math.max(target.hp, 0)})` });
      if (target.hp <= 0) log.push({ type: "kill", text: `${target.name}을(를) 쓰러뜨렸습니다.` });
      return true;
    }
    if (name === "회복룬_시전") {
      const cost = 10;
      if (state.golem.mana < cost) {
        log.push({ type: "info", text: "마나가 부족해 회복룬을 시전할 수 없습니다." });
        return false;
      }
      state.golem.mana -= cost;
      const heal = 12;
      state.golem.hp = Math.min(state.golem.maxHp, state.golem.hp + heal);
      log.push({ type: "heal", text: `회복룬을 시전해 체력을 ${heal} 회복했습니다.` });
      return true;
    }
    if (name === "대기") {
      log.push({ type: "info", text: "골렘이 대기합니다." });
      return true;
    }
    throw new LangError(`알 수 없는 함수 '${name}'`, line);
  }

  return { vars, actions, functions, readables, call };
}

export function simulateTick(state, source, log) {
  if (state.finished) return state;
  state.tick += 1;

  const lowVisibility = state.gimmickType === "low_visibility";
  const api = buildApi(state, log, lowVisibility);

  let ast;
  try {
    ast = parseProgram(source);
  } catch (e) {
    state.finished = "error";
    state.error = e.message;
    return state;
  }

  try {
    runTick(ast, api);
  } catch (e) {
    state.finished = "error";
    state.error = e instanceof LangError ? e.message : String(e);
    return state;
  }

  if (state.gimmickType === "fire_dot" && state.tick % 3 === 0) {
    state.golem.hp -= 2;
    log.push({ type: "damage", text: "화염 저주로 2의 피해를 입었습니다." });
  }
  if (state.gimmickType === "mana_drain" && state.tick % 3 === 0) {
    state.golem.mana = Math.max(0, state.golem.mana - 2);
  } else {
    state.golem.mana = Math.min(state.golem.maxMana, state.golem.mana + 1);
  }

  if (state.golem.hp <= 0) {
    state.finished = "destroyed";
    log.push({ type: "system", text: "골렘이 파괴되었습니다..." });
    return state;
  }

  // monster turns
  for (const m of state.monsters) {
    if (m.hp <= 0) continue;
    const dist = Math.abs(m.x - state.golem.x) + Math.abs(m.y - state.golem.y);
    if (dist === 1) {
      state.golem.hp -= m.atk;
      log.push({ type: "damage", text: `${m.name}의 공격! (${m.atk} 피해)` });
      if (state.golem.hp <= 0) {
        state.finished = "destroyed";
        log.push({ type: "system", text: "골렘이 파괴되었습니다..." });
        return state;
      }
    } else if (dist <= 4) {
      const d = directionTo(m, state.golem);
      const { dx, dy } = DIRS[d];
      const nx = m.x + dx;
      const ny = m.y + dy;
      if (cellType(state, nx, ny) === "빈공간") {
        m.x = nx;
        m.y = ny;
      }
    }
  }

  if (state.golem.x === state.exit.x && state.golem.y === state.exit.y) {
    state.finished = "cleared";
    log.push({ type: "system", text: `"${state.dungeonName}" 던전을 돌파했습니다!` });
  }

  if (state.tick >= 800 && !state.finished) {
    state.finished = "timeout";
    log.push({ type: "system", text: "제한 턴을 넘겨 탐사가 중단되었습니다." });
  }

  return state;
}
