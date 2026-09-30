// 2D close-up screens for maintenance. Drawn directly in the 1-bit palette at the 3D view's resolution.

const INK = "#161517";
const PAPER = "#c4bfb1";
const GLOW = "#fff3d0";

const NOZZLE_X = 192;
const NOZZLE_TOP = 138;
const SEAT_Y = 150;
const FIT = 3;
const MAX_DROP_SPEED = 110;
const MANTLE_W = 18;
const MANTLE_H = 26;

export function createCloseup(canvas, help, width, height) {
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;

  let state = null;
  let mouse = { x: width / 2, y: 40 };

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height };
  });
  canvas.addEventListener("mousedown", () => {
    if (state && (state.phase === "done" || state.phase === "out")) finish();
  });

  function dither(x, y, w, h, density) {
    // density 0..1 → ordered checker-ish fill in PAPER over INK
    g.fillStyle = PAPER;
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const t = ((xx & 1) * 2 + (yy & 1) * 3 + ((xx >> 1) & 1)) / 6;
        if (density > t) g.fillRect(xx, yy, 1, 1);
      }
    }
  }

  function rect(x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function tremor(t, amount) {
    const a = (amount / 100) * 7;
    return {
      x: a * (Math.sin(t * 13.1) * 0.55 + Math.sin(t * 7.7 + 1.3) * 0.35 + (Math.random() - 0.5) * 0.3),
      y: a * 0.6 * (Math.sin(t * 11.3 + 0.7) * 0.6 + (Math.random() - 0.5) * 0.3),
    };
  }

  function drawMantle(x, y, broken) {
    if (broken) {
      for (let i = 0; i < 14; i++) rect(x - 8 + ((i * 7) % 17), y + 10 + ((i * 5) % 14), 2, 1, PAPER);
      return;
    }
    rect(x - MANTLE_W / 2, y, MANTLE_W, MANTLE_H, PAPER);
    for (let yy = 2; yy < MANTLE_H; yy += 3) rect(x - MANTLE_W / 2 + 1, y + yy, MANTLE_W - 2, 1, "#9d988b");
    rect(x - MANTLE_W / 2, y, MANTLE_W, 2, INK);
    rect(x - 3, y + MANTLE_H - 2, 6, 2, INK);
    rect(x - 1, y - 6, 2, 6, PAPER);
  }

  function drawScene() {
    rect(0, 0, width, height, INK);
    dither(0, 150, width, height - 150, 0.18);
    // lens prisms framing the view
    for (let i = 0; i < 9; i++) {
      dither(0, 10 + i * 18, 70 - i * 2, 9, 0.55);
      dither(width - 70 + i * 2, 10 + i * 18, 70, 9, 0.55);
    }
    // burner tube, collar and nozzle
    rect(NOZZLE_X - 9, SEAT_Y, 18, height - SEAT_Y, "#6f6b62");
    rect(NOZZLE_X - 9, SEAT_Y, 2, height - SEAT_Y, PAPER);
    rect(NOZZLE_X - 14, 146, 28, 4, PAPER);
    rect(NOZZLE_X - 3, NOZZLE_TOP, 6, 8, PAPER);
    rect(NOZZLE_X - 1, NOZZLE_TOP - 2, 2, 2, GLOW);
  }

  function update(dt, mercury) {
    if (!state) return;
    state.t += dt;
    drawScene();

    if (state.phase === "carry") {
      const shake = tremor(state.t, mercury);
      const x = mouse.x + shake.x;
      const bottom = Math.min(mouse.y + shake.y, SEAT_Y + 4);
      const vy = (bottom - state.lastBottom) / Math.max(dt, 1 / 240);
      state.lastBottom = bottom;

      // the mantle has to be lifted clear first, so a cursor that starts low can't break it instantly
      if (bottom < NOZZLE_TOP - 20) state.armed = true;
      if (state.armed && !state.threaded && bottom >= NOZZLE_TOP) {
        if (Math.abs(x - NOZZLE_X) > FIT || vy > MAX_DROP_SPEED) {
          state.phase = "broken";
          state.brokenAt = { x, y: bottom - MANTLE_H };
          state.spares--;
          state.timer = 0;
          state.reason = Math.abs(x - NOZZLE_X) > FIT ? "노즐에 걸려 부서졌다" : "너무 세게 내려서 부서졌다";
        } else {
          state.threaded = true;
        }
      }
      if (state.threaded && bottom < NOZZLE_TOP - 2) state.threaded = false;
      if (state.threaded && bottom >= SEAT_Y) {
        state.phase = "done";
        state.x = NOZZLE_X;
      }
      if (state.phase === "carry") {
        const drawX = state.threaded ? NOZZLE_X + (x - NOZZLE_X) * 0.2 : x;
        drawMantle(drawX, bottom - MANTLE_H, false);
      }
    }

    if (state.phase === "broken") {
      state.timer += dt;
      drawMantle(state.brokenAt.x, state.brokenAt.y, true);
      if (state.timer > 1.2) {
        if (state.spares <= 0) state.phase = "out";
        else {
          state.phase = "carry";
          state.threaded = false;
          state.armed = false;
          state.lastBottom = mouse.y;
        }
      }
    }

    if (state.phase === "done") {
      drawMantle(NOZZLE_X, SEAT_Y - MANTLE_H, false);
      rect(NOZZLE_X - 4, SEAT_Y - 16, 8, 8, GLOW);
    }

    const lines = {
      carry: state.armed
        ? `맨틀 교체 · 여분 ${state.spares}개\n마우스로 천천히 내려 노즐에 끼우기`
        : `맨틀 교체 · 여분 ${state.spares}개\n먼저 맨틀을 위로 들어 올리기`,
      broken: `${state.reason}\n여분 ${state.spares}개`,
      done: "맨틀을 끼웠다\n클릭해서 나가기",
      out: "여분 맨틀이 없다\n클릭해서 나가기",
    };
    help.textContent = lines[state.phase];
  }

  let onDone = null;
  function finish() {
    const result = state.phase;
    state = null;
    canvas.classList.add("hidden");
    help.classList.add("hidden");
    if (onDone) onDone(result);
  }

  return {
    get active() {
      return state !== null;
    },
    open(kind, done) {
      onDone = done;
      state = { kind, phase: "carry", t: 0, spares: 5, threaded: false, armed: false, lastBottom: mouse.y };
      canvas.classList.remove("hidden");
      help.classList.remove("hidden");
    },
    cancel() {
      if (state) {
        state.phase = "cancelled";
        finish();
      }
    },
    update,
  };
}
