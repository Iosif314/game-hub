// Three days in the pawnshop: who comes to the counter, what they say, what they carry.
// Money is in shillings, emotion in tenths of a jar (할).

export const EMOTIONS = {
  grief: { name: "슬픔", color: [56, 78, 168], motion: "sink" },
  fear: { name: "두려움", color: [120, 152, 104], motion: "tremble" },
  anger: { name: "분노", color: [214, 84, 36], motion: "swirl" },
  love: { name: "사랑", color: [236, 164, 56], motion: "glow" },
  joy: { name: "기쁨", color: [240, 214, 92], motion: "rise" },
  guilt: { name: "죄책감", color: [128, 64, 132], motion: "coil" },
  resign: { name: "체념", color: [150, 156, 170], motion: "still" },
  pity: { name: "연민", color: [214, 150, 170], motion: "glow" },
};
export const EMOTION_KEYS = Object.keys(EMOTIONS);

export const DATES = ["1851. 10. 14", "1851. 10. 15", "1851. 10. 16"];
export const DUE_DAYS = 2; // shortened for the prototype: a pawn lapses two days on
export const GUILD_DUE = 30; // the guild's weekly interest, paid on the evening of day 3

// what the shop already holds: the old master's stock, and my own jar
export const START_JARS = [
  {
    emotion: "grief",
    amount: 6,
    owned: true,
    label: { no: "0197", name: "에드윈 마로", emotion: "슬픔", object: "아내", amount: "6할", date: "1846. 3. 2", due: "1846. 3. 16", loan: "9", rate: "20%", memo: "찾으러 오지 않음", hand: "old" },
    moment: "검은 베일 아래로 빗물이 흐른다. 작은 관이 두 개, 나란히.",
  },
  {
    emotion: "guilt",
    amount: 3,
    owned: true,
    label: { no: "0233", name: "(긁혀 지워짐)", emotion: "죄책감", object: "", amount: "3할", date: "1847. 11. 9", due: "", loan: "30", rate: "", memo: "묻지 말 것", hand: "old" },
    moment: "물에 잠긴 손이 창살을 붙잡는다. 위에서 누군가 판자를 덮는다.",
  },
  {
    emotion: "fear",
    amount: 4,
    owned: true,
    label: { no: "0251", name: "J. 칼로 (병사)", emotion: "두려움", object: "포성", amount: "4할", date: "1848. 6. 1", due: "1848. 6. 15", loan: "6", rate: "10%", memo: "출정 전날", hand: "old" },
    moment: "참호 속. 귀가 먹먹하고, 옆 사람의 입만 움직인다.",
  },
  {
    emotion: "joy",
    amount: 3,
    owned: true,
    label: { no: "0260", name: "꽃 파는 소녀", emotion: "기쁨", object: "첫 품삯", amount: "3할", date: "1849. 5. 20", due: "1849. 6. 3", loan: "4", rate: "20%", memo: "", hand: "old" },
    moment: "동전 세 닢이 손바닥 위에서 반짝인다. 누군가 박수를 친다.",
  },
  {
    emotion: "grief",
    amount: 7,
    owned: false,
    mine: true,
    label: { no: "0301", name: "(내 이름)", emotion: "슬픔", object: "스승", amount: "7할", date: "1851. 10. 5", due: "1851. 10. 19", loan: "0", rate: "", memo: "", hand: "mine" },
    moment: "……아무것도 비치지 않는다. 가스가 확대경을 피해 병 바닥으로 숨는다.",
  },
];

// portraits: drawn from these few traits
export const PEOPLE = {
  tom: { name: "톰", look: { skin: 186, hair: 40, hat: "cap", coat: 64, beard: true } },
  margaret: { name: "마거릿", look: { skin: 204, hair: 60, hat: "bonnet", coat: 26, female: true } },
  nellie: { name: "넬리", look: { skin: 218, hair: 96, hat: "shawl", coat: 118, female: true, child: true } },
  gentleman: { name: "신사", look: { skin: 184, hat: "top", coat: 22, mustache: true } },
  gideon: { name: "기디언", look: { skin: 172, hat: "bowler", coat: 44, mustache: true, big: true } },
  worker: { name: "노동자", look: { skin: 178, hair: 30, hat: "none", coat: 84, bruised: true } },
  lily: { name: "릴리", look: { skin: 228, hair: 48, hat: "feather", coat: 124, female: true } },
  arthur: { name: "아서", look: { skin: 176, hair: 214, hat: "none", coat: 72, old: true, beard: true } },
  officer: { name: "보급관", look: { skin: 190, hat: "shako", coat: 58, mustache: true } },
  father: { name: "넬리의 아버지", look: { skin: 164, hat: "cap", coat: 52, beard: true, big: true } },
  inspector: { name: "조합 감독관", look: { skin: 196, hat: "top", coat: 34, spectacles: true } },
};

// how much of each emotion each person carries, in tenths of a jar
export const RESERVES = {
  tom: { fear: 6 },
  margaret: { grief: 9 },
  nellie: { love: 6 },
  worker: { anger: 7 },
  arthur: { joy: 3 },
};

// kinds: pawn (they leave an emotion for a loan), buy (they take a jar; inject = put into them here),
// redeem (they pay and take theirs back), sell (someone sells another's emotion to the shop),
// blackmail, last (pawn everything that is left)
export const DAYS = [
  [
    {
      who: "tom",
      kind: "pawn",
      intro: ["부두에서 크레인 일을 하오.", "높은 데 올라가면 다리가 말을 안 들어서. 이번 주 치 두려움만 맡기려고."],
      offer: { emotion: "fear", object: "높은 곳", amount: 3, loan: 5 },
      ask: [
        ["무엇이 두렵나?", "떨어지는 거요. 발밑으로 안개 깔린 부두가 보이면……"],
        ["언제 찾으러 오나?", "일당 받으면 바로 오지. 늘 그랬소."],
      ],
      moment: "크레인 꼭대기. 발밑으로 안개 낀 부두가 까마득하다. 쇠줄이 삐걱인다.",
      after: "고맙소. 일당 받으면 찾으러 오리다.",
      refuse: "……그럼 오늘은 그냥 올라가야겠군.",
    },
    {
      who: "margaret",
      kind: "pawn",
      intro: ["남편 장례를 어제 치렀어요.", "아이가 셋이에요. 내일부터 공장에 나가야 하는데, 이걸 안고는 실을 못 꿰겠어요."],
      offer: { emotion: "grief", object: "남편", amount: 4, loan: 8 },
      ask: [
        ["남편은 어떻게 죽었나?", "방직기에 소매가 말려 들어갔어요. 감독관은 그이가 졸았다더군요."],
        ["찾으러 올 수 있겠나?", "……돈이 생기면요."],
      ],
      moment: "방직기 소음 사이로 누군가 이름을 부른다. 바닥의 실타래가 젖어 있다.",
      after: "고마워요. 이제 좀 살 것 같네요.",
      refuse: "……다른 가게를 찾아볼게요.",
    },
    {
      who: "nellie",
      kind: "pawn",
      child: true,
      intro: ["……사랑도 맡을 수 있어요?", "공장 견습공 대니요. 아버지가 다시는 만나지 말래요. 그러니까 차라리 없애고 싶어요."],
      offer: { emotion: "love", object: "대니", amount: 5, loan: 12 },
      ask: [
        ["나이가 몇이냐?", "……열여덟이요. 1837년생이에요."],
        ["부모는 알고 있나?", "아버지가 알면 저 죽어요. 그러니까 빨리요."],
        ["손을 보여 봐라.", "(작은 손바닥이 실에 베인 자국투성이다. 손가락이 아직 가늘다.)"],
      ],
      moment: "기숙사 창가. 소년이 휘파람을 분다. 초 열네 개가 꽂힌 작은 빵.",
      after: "고맙습니다. ……이상하네요, 아무렇지도 않아요.",
      refuse: "……다른 데 가면 돼요.",
    },
    {
      who: "gentleman",
      kind: "buy",
      intro: ["좋은 아침이오.", "죄책감을 사러 왔소. 오래된 것일수록 좋소."],
      wants: "guilt",
      price: 6,
      ask: [["어디에 쓰십니까?", "그건 묻지 않는 게 이 거리의 예의 아니오?"]],
      after: "(병을 외투 안에 넣는다) 또 들르겠소. 새로 들어오면 따로 챙겨 두시오.",
      refuse: "아쉽군. 또 오지.",
    },
  ],
  [
    {
      who: "gideon",
      kind: "sell",
      sitter: "worker",
      intro: ["공장 감독관 기디언이오.", "이 친구 분노를 사 주시오. 요즘 공장에 이게 너무 많아서 말이오.", "값은 나한테 주면 되오."],
      offer: { emotion: "anger", object: "공장", amount: 6, price: 8 },
      ask: [
        ["본인도 원하나?", "기디언: 원하고말고. 그렇지?  (노동자는 대답 대신 바닥만 본다.)"],
        ["얼굴의 멍은 뭐요?", "기디언: 기계에 부딪혔소. 덜렁대서."],
      ],
      moment: "누군가의 구둣발이 다가온다. 손에 쥔 파업 전단이 구겨진다.",
      after: "(노동자가 일어나 기디언을 보고 웃는다) ……감사합니다, 감독관님.",
      refuse: "기디언: 조합 면허가 아깝지 않소? 다른 데는 묻지도 않던데.",
    },
    {
      who: "lily",
      kind: "buy",
      inject: true,
      intro: ["오늘 밤 「버림받은 아내」 첫 공연이에요.", "진짜 슬픔이 필요해요. 관객이 숨도 못 쉬게."],
      wants: "grief",
      price: 3,
      ask: [["다른 사람의 슬픔인데 괜찮겠소?", "슬픔에 주인이 어디 있어요? 무대에 서면 다 제 거예요."]],
      after: "(눈물 자국 하나 없이 웃는다) 완벽해요. 오늘 밤은 진짜로 울 수 있겠어요.",
      refuse: "슬픔도 안 파는 전당포라니, 세상 참 좋아졌네요.",
    },
    {
      who: "tom",
      kind: "redeem",
      needs: "tom",
      intro: ["일당 받았소. 맡긴 거 찾으러 왔지."],
      after: "(얼굴이 하얗게 질려 있다) ……이걸 안고 어떻게 올라갔던 거지. 높은 데는 이제 못 올라가겠소.",
      wrong: {
        grief: "……누가 죽은 것 같은 기분이오. 누구지?",
        love: "……갑자기 누군가 보고 싶소. 얼굴도 모르는 사람인데.",
        default: "……이상하군. 내 것 같지가 않소.",
      },
    },
    {
      who: "arthur",
      kind: "pawn",
      intro: ["집세가 밀려서 왔소.", "기쁨을 조금 맡기려 하오. 나이 들면 쓸 일도 별로 없으니."],
      offer: { emotion: "joy", object: "손녀", amount: 2, loan: 6 },
      ask: [
        ["무엇에 대한 기쁨이오?", "손녀가 처음 걸었던 날이오. 그 애는 지금 북쪽 공장에 있소."],
        ["얼마나 남았소?", "글쎄, 이게 거의 다일 거요."],
      ],
      moment: "흙바닥 위로 아기가 두 팔을 벌리고 비틀비틀 걸어온다.",
      after: "고맙소. 허허.",
      refuse: "……그럼 오늘 밤은 길에서 자야겠군.",
    },
  ],
  [
    {
      who: "officer",
      kind: "buy",
      intro: ["왕립 육군 보급관이오.", "두려움을 사들이고 있소. 병사 것이든 누구 것이든."],
      wants: "fear",
      price: 3,
      ask: [["어디에 쓰시오?", "전선에서는 두려움이 넘쳐 나오. 그걸 여기로 옮기는 거지. 빈자리는 채워 넣지 않소."]],
      after: "국가가 감사할 거요.",
      refuse: "애국심도 맡겨 버렸소? 다음엔 영장을 들고 오지.",
    },
    {
      who: "father",
      kind: "blackmail",
      needs: "nellie",
      intro: ["넬리 애비요.", "그 애가 여기서 뭘 맡겼는지 다 알아. 그 애는 열네 살이오.", "그 병, 나한테 넘기시오. 아니면 조합에 가서 다 말할 거요."],
      give: "(병을 품에 넣는다) 이건 내가 처리하지. 그 애는 다시는 그놈 생각 안 할 거요.",
      refuse: "두고 보시오.",
    },
    {
      who: "arthur",
      kind: "last",
      intro: ["또 왔소. 집주인이 기다려 주질 않는구려.", "남은 기쁨을 전부 맡기겠소."],
      offer: { emotion: "joy", object: "손녀", loan: 3 },
      ask: [["정말 전부요?", "남겨 둬 봐야 뭐 하겠소."]],
      moment: "흙바닥 위로 아기가 걸어온다. 얼굴이 이제 잘 보이지 않는다.",
      after: "(입꼬리를 올리려다 멈춘다) ……웃는 게 어떻게 하는 거였지?",
      refuse: "……그래, 그것도 나쁘지 않지.",
    },
    {
      who: "margaret",
      kind: "pawn",
      intro: ["또 왔어요.", "막내가 열이 나요. 남은 슬픔을 조금만 더 맡길게요."],
      offer: { emotion: "grief", object: "남편", amount: 3, loan: 6 },
      ask: [["지난번 것도 아직 못 찾았는데.", "알아요. ……알아요."]],
      moment: "관 뚜껑에 못을 박는 소리. 아이 셋이 손을 잡고 서 있다.",
      after: "(장례식 이야기를 하며 웃는다) 이상하죠, 그이 얼굴이 잘 생각이 안 나요.",
      refuse: "……그럼 약은 다음 주에요.",
    },
  ],
];

// the morning paper: market prices (shillings per tenth) and the day's news
export const PAPERS = [
  {
    head: "방직 공장 생산량 사상 최고",
    prices: { grief: 3, fear: 2, anger: 3, love: 5, joy: 4, resign: 2 },
    news: ["부두 노동자 임금 동결 — 조합 \"감정 맡기면 버틸 만하다\"", "북쪽 공장 지대 기침 환자 늘어"],
    notice: [
      "[조합 공문] 감정 추출 규정을 다시 알림",
      "하나. 열여섯 살 미만의 감정은 거래하지 않는다.",
      "둘. 본인의 뜻이 아닌 추출은 하지 않는다.",
      "셋. 한 감정을 바닥까지 뽑지 않는다.",
    ],
  },
  {
    head: "북부 공장 파업 조짐 사그라들어",
    prices: { grief: 3, fear: 2, anger: 5, love: 5, joy: 4, resign: 3 },
    news: ["공장주 협회 \"노동자들이 차분해졌다\"", "왕립극장 「버림받은 아내」 오늘 밤 개막"],
    notice: ["[조합 공문] 내일 오전 정기 점검을 실시함."],
  },
  {
    head: "",
    prices: { grief: 3, fear: 4, anger: 6, love: 5, joy: 4, resign: 3 },
    news: ["육군, 두려움 일괄 매입 \"전선의 사기를 위해\"", "실 가격 또 내려"],
    notice: ["[조합 공문] 이번 주 이자 30실링을 오늘 저녁까지 낼 것."],
  },
];

// what I can pawn myself with the old master's clockwork, and how much of each I carry.
// I am never told these numbers; winding past them takes everything and leaves a stain.
export const SELF = {
  fear: { name: "두려움", reserve: 6 },
  guilt: { name: "죄책감", reserve: 5 },
  pity: { name: "연민", reserve: 4 },
};
export const SELF_PRICE = 4; // what the guild pays per tenth of a keeper's own emotion
export const SELF_EFFECT = 2; // from this many tenths gone, I start to feel the lack

// a page of the master's notebook, found in the clockwork box the first time I open it
export const MASTER_NOTE = [
  "— 스승의 수첩에서 뜯어낸 한 장 —",
  "혼자 할 때는 태엽 장치를 쓴다. 감은 바퀴만큼 빠지고, 다 풀릴 때까지 멈추지 않는다.",
  "자기 몫이 얼마나 남았는지는 아무도 모른다. 적게 감아라.",
  "(마지막 줄은 잉크가 번져 읽을 수 없다.)",
];

// what comes back with my grief
export const MASTER_MEMORY = [
  "스승이 의자에 묶여 있다. 태엽 장치가 끝까지 감겨 있다.",
  "스승이 소리를 지른다. 멈춰 달라고. 멈출 수 없다는 걸 누구보다 잘 아는 사람이.",
  "태엽 손잡이를 쥔 손이 보인다. 마지막 한 바퀴를 감은 손.",
  "내 손이다.",
  "스승이 더 감으라고 했던가. 그렇게 기억하고 싶은 것뿐인가.",
];
