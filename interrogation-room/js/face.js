const FACE_SVG = `
<svg viewBox="0 0 100 100" class="face-svg">
  <circle class="face-head" cx="50" cy="54" r="36"></circle>
  <ellipse class="ear ear-left" cx="14" cy="54" rx="5" ry="8"></ellipse>
  <ellipse class="ear ear-right" cx="86" cy="54" rx="5" ry="8"></ellipse>
  <g class="eyebrow eyebrow-left"><rect x="26" y="36" width="16" height="4" rx="2"></rect></g>
  <g class="eyebrow eyebrow-right"><rect x="58" y="36" width="16" height="4" rx="2"></rect></g>
  <circle class="eye eye-left" cx="34" cy="48" r="3.4"></circle>
  <circle class="eye eye-right" cx="66" cy="48" r="3.4"></circle>
  <path class="mouth" d="M38,68 Q50,72 62,68"></path>
  <g class="sweat sweat-1"><path d="M22,32 q-3,6 0,10 q3,-4 0,-10 Z"></path></g>
  <g class="sweat sweat-2"><path d="M78,32 q-3,6 0,10 q3,-4 0,-10 Z"></path></g>
  <g class="sweat sweat-3"><path d="M50,18 q-3,6 0,10 q3,-4 0,-10 Z"></path></g>
</svg>`;

const MOUTHS = [
  "M38,68 Q50,72 62,68", // calm — soft smile
  "M38,69 L62,69", // nervous — flat
  "M36,66 Q42,72 50,66 Q58,72 64,66", // agitated — wavy
  "M38,64 Q50,80 62,64 Q50,74 38,64", // breaking down — open/distressed
];
const BROW_ANGLE = [0, 6, 14, 20];
const HEAD_COLOR = ["#e8c9a0", "#e8c9a0", "#e0b89a", "#d9a68c"];

function tierFor(stress) {
  if (stress < 25) return 0;
  if (stress < 50) return 1;
  if (stress < 75) return 2;
  return 3;
}

export function mountFace(container) {
  container.innerHTML = FACE_SVG;
}

export function updateFace(container, stress) {
  const tier = tierFor(stress);
  const head = container.querySelector(".face-head");
  const browL = container.querySelector(".eyebrow-left");
  const browR = container.querySelector(".eyebrow-right");
  const mouth = container.querySelector(".mouth");

  if (!head) return;

  head.style.fill = HEAD_COLOR[tier];
  mouth.setAttribute("d", MOUTHS[tier]);
  browL.style.transform = `rotate(${-BROW_ANGLE[tier]}deg)`;
  browR.style.transform = `rotate(${BROW_ANGLE[tier]}deg)`;

  for (let i = 1; i <= 3; i++) {
    const drop = container.querySelector(`.sweat-${i}`);
    if (drop) drop.style.display = i <= tier ? "block" : "none";
  }

  container.classList.toggle("shake", stress >= 80);
}
