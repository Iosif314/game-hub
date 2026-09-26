import { IN } from "./sim.js";

const KEYMAP = {
  KeyW: IN.UP,
  KeyS: IN.DOWN,
  KeyA: IN.LEFT,
  KeyD: IN.RIGHT,
  ArrowUp: IN.UP,
  ArrowDown: IN.DOWN,
  ArrowLeft: IN.LEFT,
  ArrowRight: IN.RIGHT,
  KeyJ: IN.A,
  KeyK: IN.B,
  KeyL: IN.C,
  KeyZ: IN.A,
  KeyX: IN.B,
  KeyC: IN.C,
};

export function createKeyboard(isCapturing) {
  const down = new Set();
  window.addEventListener("keydown", (e) => {
    if (KEYMAP[e.code] === undefined || !isCapturing()) return;
    down.add(e.code);
    e.preventDefault();
  });
  window.addEventListener("keyup", (e) => down.delete(e.code));
  window.addEventListener("blur", () => down.clear());
  return {
    read() {
      let m = 0;
      for (const code of down) m |= KEYMAP[code];
      return m;
    },
    clear() {
      down.clear();
    },
  };
}
