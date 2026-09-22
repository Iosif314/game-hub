// Species are grouped into three archetypes; every monster of a group shares
// that group's fixed passive. On top of that, every monster instance also
// rolls one random passive from a shared pool, independent of its species.
export const SPECIES_GROUPS = {
  flambit: "A",
  aquary: "B",
  leafon: "C",
  rockid: "B",
  batling: "A",
  slimor: "C",
};

export const GROUP_PASSIVES = {
  A: { id: "group_A_offense", name: "맹공", desc: "공격 카드 피해 +15%" },
  B: { id: "group_B_defense", name: "철벽", desc: "방어 카드 방어막 +20%" },
  C: { id: "group_C_support", name: "재생", desc: "회복 카드 회복량 +25%" },
};

export const RANDOM_PASSIVES = [
  { id: "brute_force", name: "괴력", desc: "공격 카드 피해 +2" },
  { id: "thick_hide", name: "여문 가죽", desc: "받는 피해 -1 (최소 1)" },
  { id: "vitality", name: "생명력", desc: "최대 체력 +15%" },
  { id: "meditation", name: "명상", desc: "회복 카드 회복량 +2" },
  { id: "guardian", name: "수호", desc: "방어 카드 방어막 +3" },
  { id: "extra_card", name: "여분의 패", desc: "매 턴 카드를 1장 더 뽑는다" },
  { id: "extra_energy", name: "기민한 두뇌", desc: "매 턴 에너지 +1" },
];

export function getGroupPassive(speciesId) {
  return GROUP_PASSIVES[SPECIES_GROUPS[speciesId]];
}

export function pickRandomPassive() {
  return RANDOM_PASSIVES[Math.floor(Math.random() * RANDOM_PASSIVES.length)];
}

export function hasPassive(monster, id) {
  return !!monster.passives && monster.passives.some((p) => p.id === id);
}
