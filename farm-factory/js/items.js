export const ITEMS = {
  wheat: { name: "밀", color: "#e3c15d" },
  corn: { name: "옥수수", color: "#f2d33d" },
  tomato: { name: "토마토", color: "#e35d5d" },
  flour: { name: "밀가루", color: "#f0e6d2" },
  bread: { name: "빵", color: "#c98a4b" },
  juice: { name: "토마토주스", color: "#e34d9d" },
  popcorn: { name: "팝콘", color: "#fff3c4" },
};

export const SELL_PRICE = {
  wheat: 3,
  corn: 4,
  tomato: 4,
  flour: 9,
  bread: 20,
  juice: 13,
  popcorn: 15,
};

export const CROPS = {
  wheat: { name: "밀", itemId: "wheat", growTime: 7000 },
  corn: { name: "옥수수", itemId: "corn", growTime: 11000 },
  tomato: { name: "토마토", itemId: "tomato", growTime: 9000 },
};

export const RECIPES = {
  mill: { name: "제분기", input: "wheat", output: "flour", time: 3500 },
  oven: { name: "오븐", input: "flour", output: "bread", time: 6000 },
  juicer: { name: "착즙기", input: "tomato", output: "juice", time: 4500 },
  popper: { name: "팝콘기", input: "corn", output: "popcorn", time: 4000 },
};
