// The ships of each night. What the keeper can read off a ship is only what is modelled
// (hull, flag pattern, lights, crew, how low it sits); answers to signals may be lies.
//
// expect: what that night's orders call for — "guide" or "stop".
// afterStop: what the orders want once a stopped ship is inspected — "send", "detain" or "either".
// react: what comes back the next day. Keys: wrecked, passed (guided without the stop the orders
// wanted), sent (stopped, inspected, let go), detained. Each may carry a telegram notice, a radio
// line, and a change to the hidden suspicion score. A listed ship that is wrecked always draws the
// generic "did not arrive" query even without its own entry.
//
// survivors.people: who comes out of the water, in order (the first n make it). Their characters,
// secrets and lies live on the server, keyed by id, so the public code does not give them away.

export const NIGHTS = [
  // night 1: practice — both ships are expected and should simply be guided
  [
    {
      id: "edel1",
      name: "에델호",
      kind: "cargo",
      flag: "home",
      lights: true,
      crew: 4,
      heavy: true,
      bearing: 20,
      eta: "21:00",
      listed: true,
      answers: { who: "화물선 에델호", where: "남쪽 항구", cargo: "밀가루와 석탄", hurt: "없음" },
      inspect: "밀가루 포대와 석탄. 선원 명부 네 명, 갑판의 사람도 네 명. 이상 없음.",
      expect: "guide",
      afterStop: "send",
      survivors: { max: 2, desc: "에델호 선원 두 명. 한 명은 팔이 부러졌다.", people: [{ id: "edel_hans", name: "한스", desc: "팔이 부러진 에델호 갑판장" }, { id: "edel_jonas", name: "요나스", desc: "에델호의 젊은 화부" }] },
      react: {},
    },
    {
      id: "gull1",
      name: "갈매기 3호",
      kind: "fishing",
      flag: "neutral",
      lights: true,
      crew: 2,
      heavy: false,
      bearing: -10,
      eta: "23:30",
      listed: true,
      answers: { who: "어선 갈매기 3호", where: "집으로", cargo: "고등어", hurt: "없음" },
      inspect: "고등어 상자 몇 개. 늙은 어부 둘.",
      expect: "guide",
      afterStop: "send",
      survivors: { max: 1, desc: "갈매기 3호의 늙은 어부. 그물을 붙잡고 왔다.", people: [{ id: "gull_otto", name: "오토", desc: "갈매기 3호의 늙은 어부" }] },
      react: {
        wrecked: { radio: ["어선 수리공", "갈매기 3호가 어젯밤 안 돌아왔대. 마지막으로 본 게 등대 근처였다던데."], suspicion: 1 },
      },
    },
  ],
  // night 2: a new order — dark-running ships are to be stopped and reported. The Rosa is going down.
  [
    {
      id: "patrol2",
      name: "제7 초계정",
      kind: "warship",
      flag: "military",
      lights: true,
      crew: 6,
      heavy: false,
      bearing: 40,
      eta: "22:00",
      listed: true,
      answers: { who: "해군 초계정. 질문하지 마라.", where: "기밀", cargo: "기밀", hurt: "없음" },
      inspect: "정지 신호에 응하지 않고 그대로 지나간다.",
      ignoresStop: true,
      expect: "guide",
      afterStop: "either",
      survivors: { max: 2, desc: "해군 수병 둘. 군복이 찢겼고 말을 아낀다.", people: [{ id: "patrol_leon", name: "레온", desc: "제7 초계정 수병" }, { id: "patrol_matthias", name: "마티아스", desc: "제7 초계정 막내 수병" }] },
      react: {
        wrecked: { notice: "제7 초계정 연락 두절. 마지막 위치는 등대 해역. 경위를 보고할 것.", suspicion: 3 },
      },
    },
    {
      id: "dark2",
      name: "불을 끈 배",
      kind: "small",
      flag: null,
      lights: false,
      crew: 3,
      heavy: true,
      bearing: 0,
      eta: "00:30",
      listed: false,
      answers: { who: "어선이오", where: "북쪽 마을", cargo: "생선", hurt: "없소" },
      inspect: "생선 상자 밑에 소총 상자가 있다. 선원들이 눈을 피한다.",
      expect: "stop",
      afterStop: "detain",
      survivors: { max: 1, desc: "무등화 선박의 선원 하나. 아무것도 묻지 말라고 한다.", people: [{ id: "dark_karl", name: "카를", desc: "불 끈 배의 선원" }] },
      react: {
        passed: { notice: "무등화 선박이 남부 해안에 무기를 내린 것으로 확인됨. 등대 앞을 지났을 것으로 보임.", suspicion: 2 },
        sent: { notice: "무등화 선박이 남부 해안에 무기를 내린 것으로 확인됨. 등대 앞을 지났을 것으로 보임.", suspicion: 2 },
        detained: { notice: "억류 선박 인계를 확인함. 협조에 감사함.", suspicion: -1 },
      },
    },
    {
      id: "rosa2",
      name: "로사",
      kind: "cargo",
      flag: "neutral",
      lights: true,
      flicker: true,
      crew: 5,
      heavy: true,
      bearing: -30,
      eta: "02:00",
      listed: false,
      sinks: true,
      answers: { who: "로사…… 물이 차……", where: "어디든……", cargo: "……", hurt: "많다" },
      inspect: "선체가 기울어 있다. 갑판까지 물이 찼다.",
      expect: "guide",
      afterStop: "either",
      survivors: { min: 1, max: 2, desc: "로사호의 젊은 항해사와 노인. 둘 다 저체온으로 떨고 있다.", people: [{ id: "rosa_elli", name: "엘리", desc: "로사호 항해사" }, { id: "rosa_bern", name: "베른", desc: "로사호의 늙은 요리사" }] },
      react: {},
    },
  ],
  // night 3: the radio told the keeper to shutter the light for the patrol boat; the tape did not
  [
    {
      id: "marta3",
      name: "마르타호",
      kind: "cargo",
      flag: "home",
      lights: true,
      crew: 4,
      heavy: false,
      bearing: 15,
      eta: "20:30",
      listed: true,
      answers: { who: "화물선 마르타호", where: "북쪽 항구", cargo: "빈 배", hurt: "없음" },
      inspect: "빈 선창. 서류 이상 없음.",
      expect: "guide",
      afterStop: "send",
      survivors: { max: 2, desc: "마르타호 선원 둘. 선장이 아직 배에 있다며 울부짖는다.", people: [{ id: "marta_frieda", name: "프리다", desc: "마르타호 선원" }, { id: "marta_august", name: "아우구스트", desc: "마르타호 일등항해사" }] },
      react: {},
    },
    {
      id: "patrol3",
      sameAs: "patrol2", // the same boat — it can't come back if it was lost on night 2
      name: "제7 초계정",
      kind: "warship",
      flag: "military",
      lights: true,
      crew: 6,
      heavy: false,
      bearing: 35,
      eta: "01:00",
      listed: true,
      answers: { who: "해군 초계정. 등대, 수고한다.", where: "기밀", cargo: "기밀", hurt: "없음" },
      inspect: "정지 신호에 응하지 않고 그대로 지나간다.",
      ignoresStop: true,
      expect: "guide",
      afterStop: "either",
      survivors: { max: 2, desc: "해군 수병 둘. 한 명이 \"등대 불이 꺼졌다\"고 중얼거린다.", people: [{ id: "patrol_leon", name: "레온", desc: "제7 초계정 수병" }, { id: "patrol_matthias", name: "마티아스", desc: "제7 초계정 막내 수병" }] },
      react: {
        wrecked: {
          notice: "제7 초계정 연락 두절. 마지막 위치는 등대 해역. 등대 운영 경위를 즉시 보고할 것.",
          radio: ["어선 갈매기 3호", "해군 배가 등대 근처에서 사라졌대. 등대 불이 꺼져 있었다는 말이 있어."],
          suspicion: 4,
        },
      },
    },
  ],
  // night 4: the orders changed — even home-flag ships are to be stopped and searched.
  // The radio told the keeper to let everything through.
  [
    {
      id: "edel4",
      name: "에델호",
      kind: "cargo",
      flag: "home",
      lights: true,
      crew: 7,
      heavy: true,
      bearing: 20,
      eta: "21:30",
      listed: true,
      answers: { who: "화물선 에델호", where: "남쪽 항구", cargo: "밀가루", hurt: "없음" },
      inspect: "선창에 무장한 남자 여섯이 숨어 있다. 선원 명부에는 네 명뿐이다.",
      expect: "stop",
      afterStop: "detain",
      survivors: { max: 2, desc: "에델호에 타고 있던 남자 둘. 선원이라고 하지만 손에 굳은살이 없다.", people: [{ id: "edel4_franz", name: "프란츠", desc: "에델호 선원이라는 남자" }, { id: "edel4_luca", name: "루카", desc: "에델호 선원이라는 젊은 남자" }] },
      react: {
        passed: { notice: "에델호로 위장한 적 수송선이 남쪽 항구에 상륙을 시도함. 등대의 검문 여부를 보고할 것.", suspicion: 3 },
        sent: { notice: "에델호로 위장한 적 수송선이 남쪽 항구에 상륙을 시도함. 검문하고도 통과시킨 경위를 보고할 것.", suspicion: 4 },
        detained: { notice: "위장 선박 적발을 확인함. 등대의 협조에 감사함.", suspicion: -2 },
      },
    },
    {
      id: "refugee4",
      name: "이름 없음",
      kind: "small",
      flag: "blank",
      lights: true,
      crew: 5,
      heavy: true,
      bearing: -20,
      eta: "23:00",
      listed: true,
      answers: { who: "북쪽 마을 사람들입니다", where: "어디든 남쪽으로", cargo: "없습니다", hurt: "아이가 아픕니다" },
      inspect: "피난민 다섯. 열이 나는 아이가 있다. 기침 소리가 계속된다.",
      expect: "stop",
      afterStop: "either",
      survivors: { min: 1, max: 2, desc: "북쪽 마을 여자와 아이. 아이가 계속 기침을 한다.", people: [{ id: "refugee_anna", name: "안나", desc: "북쪽 마을 여자" }, { id: "refugee_mia", name: "미아", desc: "기침하는 아이" }] },
      react: {
        passed: { notice: "무등록 선박이 남쪽 해안에 닿았음. 북부 이동 제한 위반자로 보임.", suspicion: 1 },
        detained: { notice: "억류한 피난민을 격리 수용소로 이송함.", suspicion: 0 },
      },
    },
  ],
  // night 5: a storm, and a military ship nobody announced
  [
    {
      id: "gull5",
      sameAs: "gull1",
      name: "갈매기 3호",
      kind: "fishing",
      flag: "neutral",
      lights: true,
      crew: 2,
      heavy: false,
      bearing: -5,
      eta: "22:00",
      listed: true,
      answers: { who: "어선 갈매기 3호", where: "집으로. 폭풍이 온다.", cargo: "없음", hurt: "없음" },
      inspect: "빈 그물. 어부들이 서두르라고 손짓한다.",
      expect: "guide",
      afterStop: "send",
      survivors: { max: 1, desc: "갈매기 3호의 젊은 어부. 형이 물에 빠졌다고 한다.", people: [{ id: "gull5_felix", name: "펠릭스", desc: "갈매기 3호의 젊은 어부" }] },
      react: {
        wrecked: { radio: ["어선 수리공", "갈매기 3호, 결국 폭풍에 갔다더군. 등대가 보였다면 살았을 텐데."], suspicion: 1 },
      },
    },
    {
      id: "unknown5",
      name: "예정에 없는 군함",
      kind: "warship",
      flag: "military",
      lights: false,
      crew: 8,
      heavy: true,
      bearing: 30,
      eta: "02:30",
      listed: false,
      answers: { who: "본부 직속. 길을 비켜라.", where: "말할 수 없다", cargo: "-", hurt: "-" },
      inspect: "정지 신호를 무시한다. 갑판의 사람들이 등대를 향해 무언가를 겨눈다.",
      ignoresStop: true,
      expect: "stop",
      afterStop: "either",
      survivors: { max: 2, desc: "군복 차림의 두 사람. 계급장을 떼어냈다.", people: [{ id: "unknown_markus", name: "마르쿠스", desc: "계급장을 뗀 남자" }, { id: "unknown_sergeant", name: "하사", desc: "마르쿠스를 따르는 남자" }] },
      react: {},
    },
  ],
];

export const FLAG_NAMES = {
  home: "흰 바탕 검은 십자기",
  neutral: "가로 줄무늬 기",
  military: "검은 삼각기",
  blank: "무늬 없는 기",
};

// how much each night's weather adds to the chance a guided ship still strikes the reef
export const WEATHER_RISK = { "맑음 · 서풍 약함": 0, "밤부터 짙은 안개": 0.15, "흐림 · 북풍": 0.05, "비 · 남동풍 강함": 0.1, "폭풍 접근": 0.25 };

export const KIND_NAMES = { cargo: "화물선", fishing: "어선", warship: "군함", small: "소형선" };

// tonight's roster, minus ships that were lost or detained on an earlier night
export function rosterFor(day, gone) {
  return (NIGHTS[day - 1] || []).filter((sp) => !(sp.sameAs && gone.has(sp.sameAs)));
}
