export const MAX_ENERGY = 3;
export const HAND_SIZE = 4;

export const BASE_KINDS = ["jab", "attack", "heavy", "defend", "heal"];

export const DECK_COMPOSITION = [
  { kind: "jab", count: 2 },
  { kind: "attack", count: 3 },
  { kind: "heavy", count: 2 },
  { kind: "defend", count: 3 },
  { kind: "heal", count: 2 },
];

// Rare cards no monster starts with. A monster can only pick these up by
// learning them from a defeated enemy (see battle.js).
export const SPECIAL_CARD_DEFS = {
  crit_strike: { name: "회심의 일격", cost: 2, kindLabel: "공격", desc: "강공격보다 강한 피해를 입힌다", cssKind: "heavy" },
  vampiric_strike: { name: "흡혈", cost: 2, kindLabel: "공격", desc: "피해를 입히고 그 절반만큼 회복한다", cssKind: "heavy" },
  quick_strike: { name: "속공", cost: 1, kindLabel: "공격", desc: "약한 피해를 입히고 카드를 1장 더 뽑는다", cssKind: "attack" },
};

export const SPECIAL_KINDS = Object.keys(SPECIAL_CARD_DEFS);
export const ALL_KINDS = [...BASE_KINDS, ...SPECIAL_KINDS];

// Attack-type cards: how hard they hit (multiplier on the user's atk stat)
// plus any bonus on-hit effect.
export const ATTACK_KINDS = {
  jab: { mult: 0.5 },
  attack: { mult: 1.0 },
  heavy: { mult: 1.7 },
  crit_strike: { mult: 2.1 },
  vampiric_strike: { mult: 1.0, lifesteal: 0.5 },
  quick_strike: { mult: 0.4, draw: 1 },
};

let nextCardUid = 1;

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function makeCard(kind) {
  return { kind, uid: nextCardUid++ };
}

export function buildDeck() {
  const deck = [];
  for (const { kind, count } of DECK_COMPOSITION) {
    for (let i = 0; i < count; i++) deck.push(makeCard(kind));
  }
  return shuffle(deck);
}

export function cardMeta(kind, monster) {
  if (SPECIAL_CARD_DEFS[kind]) return SPECIAL_CARD_DEFS[kind];
  switch (kind) {
    case "jab":
      return { name: "잽", cost: 0, kindLabel: "공격", desc: "약한 피해를 입힌다", cssKind: "attack" };
    case "attack":
      return { name: monster.move, cost: 1, kindLabel: "공격", desc: "피해를 입힌다", cssKind: "attack" };
    case "heavy":
      return { name: `강력한 ${monster.move}`, cost: 2, kindLabel: "강공격", desc: "큰 피해를 입힌다", cssKind: "heavy" };
    case "defend":
      return { name: "방어", cost: 1, kindLabel: "방어", desc: "피해를 막는 방어막 생성", cssKind: "defend" };
    case "heal":
      return { name: "회복", cost: 2, kindLabel: "회복", desc: "체력을 회복한다", cssKind: "heal" };
    default:
      return { name: "?", cost: 0, kindLabel: "", desc: "", cssKind: "attack" };
  }
}

// Draws n cards from monster's own deck, reshuffling its own discard pile
// back in whenever the deck runs out. A card can't reappear until every
// other card in that monster's deck has been seen.
export function drawFromMonsterDeck(monster, n) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (monster.deck.length === 0) {
      if (monster.discard.length === 0) break;
      monster.deck = shuffle(monster.discard);
      monster.discard = [];
    }
    drawn.push(monster.deck.pop());
  }
  return drawn;
}
