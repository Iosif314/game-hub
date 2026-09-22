import { buildDeck, makeCard, shuffle, BASE_KINDS, SPECIAL_KINDS } from "./cards.js";
import { getGroupPassive, pickRandomPassive } from "./passives.js";

export const SPECIES = {
  flambit: { name: "플램빗", color: "#e35d5d", glyph: "F", baseHp: 20, baseAtk: 6, baseDef: 3, baseSpd: 5, move: "불꽃니" },
  aquary: { name: "아쿠아리", color: "#5da9e3", glyph: "A", baseHp: 22, baseAtk: 5, baseDef: 4, baseSpd: 4, move: "물대포" },
  leafon: { name: "리폰", color: "#5da35d", glyph: "L", baseHp: 21, baseAtk: 5, baseDef: 5, baseSpd: 4, move: "잎날가르기" },
  rockid: { name: "록키드", color: "#a0824f", glyph: "R", baseHp: 19, baseAtk: 6, baseDef: 6, baseSpd: 2, move: "돌던지기" },
  batling: { name: "배틀링", color: "#8a5da3", glyph: "B", baseHp: 15, baseAtk: 7, baseDef: 2, baseSpd: 7, move: "초음파" },
  slimor: { name: "슬라이모", color: "#c1cf4e", glyph: "S", baseHp: 17, baseAtk: 4, baseDef: 3, baseSpd: 3, move: "몸통박치기" },
};

export const STARTER_IDS = ["flambit", "aquary", "leafon"];
export const WILD_IDS = ["rockid", "batling", "slimor", "leafon", "flambit", "aquary"];

const MAX_LEVEL = 30;

let nextInstanceId = 1;

function xpForLevel(level) {
  return level * 8;
}

function applyLevelStats(monster) {
  const species = SPECIES[monster.speciesId];
  const oldMaxHp = monster.maxHp;
  monster.maxHp = Math.round((species.baseHp + monster.level * 3) * monster.hpMultiplier);
  monster.hp = Math.min(monster.maxHp, monster.hp + (monster.maxHp - oldMaxHp));
  monster.atk = species.baseAtk + monster.level;
  monster.def = species.baseDef + monster.level;
  monster.spd = species.baseSpd + Math.floor(monster.level / 2);
}

// Adds xp to a monster and applies any level-ups it earns (can be more than
// one at once). Returns the number of levels gained.
export function gainExp(monster, amount) {
  if (monster.level >= MAX_LEVEL) return 0;
  monster.xp += amount;
  let levelsGained = 0;
  while (monster.level < MAX_LEVEL && monster.xp >= monster.xpToNext) {
    monster.xp -= monster.xpToNext;
    monster.level += 1;
    monster.xpToNext = xpForLevel(monster.level);
    applyLevelStats(monster);
    levelsGained += 1;
  }
  if (monster.level >= MAX_LEVEL) monster.xp = 0;
  return levelsGained;
}

export function expReward(enemy, isTrainer) {
  return enemy.level * (isTrainer ? 4 : 3);
}

export function createMonster(speciesId, level = 5) {
  const species = SPECIES[speciesId];
  const groupPassive = getGroupPassive(speciesId);
  const randomPassive = pickRandomPassive();
  const passives = [groupPassive, randomPassive];
  const hpMultiplier = randomPassive.id === "vitality" ? 1.15 : 1;
  const maxHp = Math.round((species.baseHp + level * 3) * hpMultiplier);

  const startingSpecial = SPECIAL_KINDS[Math.floor(Math.random() * SPECIAL_KINDS.length)];
  const deck = buildDeck();
  deck.push(makeCard(startingSpecial));
  shuffle(deck);

  return {
    instanceId: nextInstanceId++,
    speciesId,
    name: species.name,
    color: species.color,
    glyph: species.glyph,
    move: species.move,
    level,
    xp: 0,
    xpToNext: xpForLevel(level),
    hpMultiplier,
    maxHp,
    hp: maxHp,
    atk: species.baseAtk + level,
    def: species.baseDef + level,
    spd: species.baseSpd + Math.floor(level / 2),
    deck,
    discard: [],
    knownKinds: [...BASE_KINDS, startingSpecial],
    passives,
  };
}
