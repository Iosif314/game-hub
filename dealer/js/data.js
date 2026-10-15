// Everything the prototype is made of that is not code: the kinds of customer, what they say, the
// three nights, and what can be bought between them.

export const HANDS_PER_NIGHT = 12;
export const NIGHTS = 3;

// how each kind of customer plays, bets, looks around and talks
export const TYPES = {
  whale: {
    label: "큰손",
    bank: 3000,
    bet: () => 150,
    hitBelow: 17,
    gaze: { hands: 0.2, cards: 0.45, away: 0.35 },
    lines: {
      sit: ["자, 오늘은 어디 한번 놀아 볼까.", "딜러 양반, 잘 부탁하네."],
      win: ["하하! 오늘 운이 좋군.", "역시 이 테이블이야.", "자, 이건 자네 몫이네."],
      lose: ["...한 판 더.", "흠. 다음은 내 차례지."],
      bored: ["이 테이블, 영 재미가 없어.", "자네, 오늘 손이 맵군."],
      leave: ["됐네. 다른 데로 가지."],
      idle: ["시가 한 대 피워도 되겠지?", "오늘 밤은 길 것 같군."],
    },
  },
  tourist: {
    label: "관광객",
    bank: 220,
    bet: () => 10 + Math.floor(Math.random() * 3) * 10,
    hitBelow: 16,
    gaze: { hands: 0.12, cards: 0.48, away: 0.4 },
    lines: {
      sit: ["와, 진짜 카지노다!", "이거 어떻게 하는 거예요?"],
      win: ["이겼다!", "오, 이거 쉽네요!"],
      lose: ["에이~", "아깝다..."],
      leave: ["여기까지만 할게요. 재밌었어요!"],
      idle: ["사진 찍어도 돼요?", "칵테일은 공짜예요?"],
    },
  },
  counter: {
    label: "카드 카운터",
    bank: 900,
    bet: (c) => (c.count >= 3 ? 90 : 10),
    hitBelow: 17,
    gaze: { hands: 0.15, cards: 0.7, away: 0.15 },
    lines: {
      sit: ["...", "(조용히 칩을 정리한다)"],
      win: ["...좋군요."],
      lose: ["(손가락으로 탁자를 두드린다)"],
      raise: ["이번엔 좀 크게 가죠.", "(칩을 한 움큼 밀어 놓는다)"],
      leave: ["(말없이 칩을 챙겨 일어난다)"],
      idle: ["(카드를 하나하나 눈으로 좇는다)"],
    },
  },
  // looks and bets like a tourist; only how he watches and what he asks give him away
  cop: {
    label: "관광객",
    bank: 400,
    bet: () => 20,
    hitBelow: 17,
    gaze: { hands: 0.6, cards: 0.25, away: 0.15 },
    lines: {
      sit: ["안녕하세요. 한 자리 괜찮죠?"],
      win: ["오, 운이 좋네요."],
      lose: ["그렇군요."],
      leave: ["오늘은 여기까지 하죠."],
      idle: ["손이 빠르시네요.", "여기서 오래 일하셨어요?", "카드는 몇 덱 쓰세요?", "(딜러의 손을 빤히 본다)"],
    },
  },
};

export const ACCUSE = ["방금 뭐였어요?! 속임수 아니야?", "딜러, 손 좀 보여 줘 봐요!"];

// who sits down at the start of each night, and who comes in later when a seat empties
export const NIGHT_PLAN = [
  { quota: 200, seats: ["tourist", "whale", "tourist"], arrivals: ["tourist", "tourist", "tourist"] },
  { quota: 350, seats: ["tourist", "whale", "counter"], arrivals: ["cop", "tourist", "tourist"] },
  { quota: 500, seats: ["counter", "whale", "tourist"], arrivals: ["cop", "tourist", "counter", "tourist"] },
];

export const BOSS = {
  open: [
    ["사장", "오늘 몫은 {quota}칩이다. 모자라면 네 주머니에서 채운다."],
    ["사장", "어제보다 올렸다. {quota}칩. 큰손은 놓치지 마라."],
    ["사장", "마지막이다. {quota}칩. 이번 주 장부를 닫아야 하니까."],
  ],
  made: ["몫은 채웠군. 잘했다.", "좋아. 손은 아직 녹슬지 않았군."],
  short: ["모자라. 그건 네 빚이다. 두 번은 없다."],
};

// the shop between nights: tools change the table, habits change how my hands behave
export const SHOP = [
  { id: "marked", kind: "도구", name: "표시한 카드", price: 90, desc: "덱 맨 위 카드가 늘 보인다. 대신 판마다 매니저 의심이 조금씩 오른다." },
  { id: "sleeve", kind: "도구", name: "소매 속 카드", price: 70, desc: "밤마다 한 번, 4를 누르면 내 패 한 장을 10으로 바꾼다. 보는 눈이 있으면 크게 의심받는다." },
  { id: "bribe", kind: "도구", name: "카메라 기사 매수", price: 110, desc: "천장 카메라가 우리 테이블을 비추는 시간이 절반으로 준다." },
  { id: "poker", kind: "버릇", name: "무표정", price: 60, desc: "손기술을 실패해도 손님들의 의심이 절반만 오른다." },
  { id: "banter", kind: "버릇", name: "너스레", price: 50, desc: "큰손이 져도 기분이 절반만 떨어진다." },
  { id: "quick", kind: "버릇", name: "빠른 손", price: 80, desc: "두 번째 카드 나누기의 틈이 1.5배 넓어진다." },
];
