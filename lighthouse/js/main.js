import * as THREE from "three";
import { buildWorld, animateWorld, groundAt, blocked, zoneOf } from "./world.js";
import { createCloseup } from "./closeup.js";

// mosaic grid; the scene is rendered SS× larger and averaged down per block
const W = 288;
const H = 162;
const SS = 5;
const EYE = 1.6;
const SPEED = 2.6;
const REACH = 2.6;
const GRAVITY = 14;

const $ = (id) => document.getElementById(id);
const view = $("view");
const overlay = $("overlay");
const overlayHint = $("overlay-hint");
const promptEl = $("prompt");
const toastEl = $("toast");
const debugEl = $("debug");
const debugText = $("debug-text");
const slider = $("mercury-slider");

// --- renderer: full-quality render into an HDR target, then each mosaic block is averaged
// and dithered to four greys ---
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;

const rt = new THREE.WebGLRenderTarget(W * SS, H * SS, {
  type: THREE.HalfFloatType,
  samples: 4,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
});
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postUniforms = {
  tDiffuse: { value: rt.texture },
  grid: { value: new THREE.Vector2(W, H) },
  exposure: { value: 1.15 },
};
postScene.add(
  new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: postUniforms,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 grid;
        uniform float exposure;
        varying vec2 vUv;
        // interleaved gradient noise: an evenly spread threshold with no regular cross-hatch
        float ign(vec2 p){ return fract(52.9829189 * fract(dot(floor(p), vec2(0.06711056, 0.00583715)))); }
        float aces(float x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        float tone(vec3 c){ return pow(aces(dot(c, vec3(0.2126, 0.7152, 0.0722)) * exposure), 1.0 / 2.2); }
        vec3 grey(float i){
          if (i < 0.5) return vec3(0.086, 0.082, 0.090);
          if (i < 1.5) return vec3(0.29, 0.282, 0.263);
          if (i < 2.5) return vec3(0.541, 0.525, 0.486);
          return vec3(0.769, 0.749, 0.694);
        }
        vec3 quantise(float l, float t){
          float s = l * 3.0;
          return grey(clamp(floor(s) + step(t, fract(s)), 0.0, 3.0));
        }
        void main(){
          // box-average the block this output pixel covers (4x4 bilinear taps over the supersampled image)
          vec3 c = vec3(0.0);
          for (int y = 0; y < 4; y++) {
            for (int x = 0; x < 4; x++) {
              vec2 o = (vec2(float(x), float(y)) + 0.5) / 4.0 - 0.5;
              c += texture2D(tDiffuse, vUv + o / grid).rgb;
            }
          }
          c /= 16.0;
          // the lamp is the only saturated warm thing in the scene; everything else goes grey
          float glow = smoothstep(0.15, 0.55, c.r - c.b);
          vec3 outc = quantise(tone(c), ign(gl_FragCoord.xy));
          gl_FragColor = vec4(mix(outc, vec3(1.0, 0.93, 0.74), glow), 1.0);
        }`,
    }),
  ),
);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, W / H, 0.05, 900);
camera.rotation.order = "YXZ";
const world = buildWorld(scene);
// point-sampled textures with mip levels, as tuned for this look
scene.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    if (!m.map) continue;
    m.map.magFilter = THREE.NearestFilter;
    m.map.minFilter = THREE.NearestMipmapNearestFilter;
    m.map.needsUpdate = true;
  }
});

// --- player ---
const player = { pos: world.spawn.clone(), vy: 0, yaw: 0, pitch: 0, eyeY: world.spawn.y + EYE };
{
  const desk = new THREE.Vector3(3.2 * Math.cos((318 / 180) * Math.PI), 0, 3.2 * Math.sin((318 / 180) * Math.PI));
  player.yaw = Math.atan2(-(desk.x - player.pos.x), -(desk.z - player.pos.z));
}
let mercury = 0;

const keys = new Set();
let mode = "menu";
let debugOn = false;

const closeup = createCloseup($("closeup"), $("closeup-help"), 384, 216);

// unadjustedMovement skips OS acceleration and avoids Chrome's occasional bogus movement spikes
function lockPointer() {
  let req;
  try {
    req = view.requestPointerLock({ unadjustedMovement: true });
  } catch {
    req = null;
  }
  if (req && req.catch) req.catch(() => view.requestPointerLock());
}
overlay.addEventListener("click", lockPointer);
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === view) {
    mode = "play";
    overlay.classList.add("hidden");
  } else if (mode === "play") {
    showMenu("클릭해서 계속");
  }
});

function showMenu(hint) {
  mode = "menu";
  overlayHint.textContent = hint;
  overlay.classList.remove("hidden");
  keys.clear();
}

document.addEventListener("mousemove", (e) => {
  if (mode !== "play") return;
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) {
    diag.lookSpikes++;
    diag.lastSpike = `${e.movementX}, ${e.movementY}`;
    console.warn("ignored mouse spike", e.movementX, e.movementY);
    return;
  }
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022));
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Tab") {
    e.preventDefault();
    debugOn = !debugOn;
    debugEl.classList.toggle("hidden", !debugOn);
    return;
  }
  if (e.code === "Escape" && closeup.active) {
    closeup.cancel();
    return;
  }
  if (mode !== "play") return;
  keys.add(e.code);
  if (e.code === "KeyE" && target) interact(target.userData.interact);
});
document.addEventListener("keyup", (e) => keys.delete(e.code));

slider.addEventListener("input", () => {
  mercury = Number(slider.value);
});

// --- interaction ---
const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const center = new THREE.Vector2(0, 0);
let target = null;

const NOT_YET = {
  radio: "무전기 · 시험판에는 아직 없어요",
  logbook: "일지 · 시험판에는 아직 없어요",
  tape: "전신 테이프 · 시험판에는 아직 없어요",
  drum: "석유 보충 · 시험판에는 아직 없어요",
  survivor: "……  (생존자 대화는 다음 단계에서)",
  filter: "수은 욕조 거르기 · 시험판에는 아직 없어요",
  telescope: "망원경 · 밤에 쓰는 장비예요",
};

let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastTimer = 2.5;
}

function interact(info) {
  if (info.id === "mantle") {
    mode = "closeup";
    keys.clear();
    promptEl.textContent = "";
    document.exitPointerLock();
    closeup.open("mantle", (result) => {
      if (result === "done") toast("맨틀을 새로 끼웠다");
      else if (result === "out") toast("맨틀이 다 부서졌다");
      showMenu("클릭해서 계속");
    });
    return;
  }
  toast(NOT_YET[info.id] || info.label);
}

function findTarget() {
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(world.solids.concat(world.interactables), true);
  const hit = hits[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !o.userData.interact) o = o.parent;
  if (!o) return null;
  const reach = o.userData.reach || REACH;
  return hit.distance <= reach ? o : null;
}

// --- movement ---
function move(dt) {
  const fwd = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const side = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  let dx = 0;
  let dz = 0;
  if (fwd || side) {
    const len = Math.hypot(fwd, side);
    const s = (SPEED * dt) / len;
    dx = (-Math.sin(player.yaw) * fwd + Math.cos(player.yaw) * side) * s;
    dz = (-Math.cos(player.yaw) * fwd - Math.sin(player.yaw) * side) * s;
  }
  const p = player.pos;
  // try each axis separately so walls slide instead of stopping dead
  for (const [ax, d] of [
    ["x", dx],
    ["z", dz],
  ]) {
    if (!d) continue;
    const nx = ax === "x" ? p.x + d : p.x;
    const nz = ax === "z" ? p.z + d : p.z;
    const g = groundAt(nx, nz, p.y);
    const ny = Math.max(p.y, g);
    if (g === -Infinity || blocked(nx, nz, ny)) continue;
    p.x = nx;
    p.z = nz;
  }
  const g = groundAt(p.x, p.z, p.y);
  if (g >= p.y) {
    p.y = g;
    player.vy = 0;
  } else {
    player.vy -= GRAVITY * dt;
    p.y = Math.max(g, p.y + player.vy * dt);
    if (p.y === g) player.vy = 0;
  }
  player.eyeY += (p.y + EYE - player.eyeY) * Math.min(1, dt * 14);
}

function updateMercury(dt, zone) {
  const rate = { lantern: 0.5, gallery: -0.4, radio: -0.05, stairs: -0.05 }[zone];
  mercury = Math.max(0, Math.min(100, mercury + rate * dt));
  if (document.activeElement !== slider) slider.value = String(Math.round(mercury));
}

// --- loop ---
const clock = new THREE.Clock();
let fpsAcc = 0;
let fpsFrames = 0;
let fps = 0;

// diagnostics for the "snapped back" report: position jumps vs. long frame stalls
const diag = { jumps: 0, lastJump: "-", hitches: 0, lastHitch: "-", lookSpikes: 0, lastSpike: "-" };
const before = new THREE.Vector3();

function frame() {
  const rawDt = clock.getDelta();
  const dt = Math.min(0.05, rawDt);
  if (rawDt > 0.25) {
    diag.hitches++;
    diag.lastHitch = `${rawDt.toFixed(2)}s`;
    console.warn("frame stall", rawDt);
  }
  const t = clock.elapsedTime;

  if (closeup.active) {
    closeup.update(dt, mercury);
  } else {
    before.copy(player.pos);
    if (mode === "play") move(dt);
    const jumped = before.distanceTo(player.pos);
    if (jumped > 0.4) {
      diag.jumps++;
      diag.lastJump = `${jumped.toFixed(2)}m (${before.x.toFixed(1)},${before.y.toFixed(1)},${before.z.toFixed(1)} -> ${player.pos.x.toFixed(1)},${player.pos.y.toFixed(1)},${player.pos.z.toFixed(1)})`;
      console.warn("position jump", diag.lastJump);
    }
    const zone = zoneOf(player.pos);
    updateMercury(dt, zone);

    camera.position.set(player.pos.x, player.eyeY, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    animateWorld(world, t);

    target = mode === "play" ? findTarget() : null;
    promptEl.textContent = target ? `E  ${target.userData.interact.label}` : "";

    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);

    if (debugOn) {
      const p = player.pos;
      debugText.textContent = `구역 ${zone}\n위치 ${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}\n수은 ${mercury.toFixed(1)}\nfps ${fps}\n위치 튐 ${diag.jumps}회  ${diag.lastJump}\n프레임 멈춤 ${diag.hitches}회  ${diag.lastHitch}\n시점 튐(무시함) ${diag.lookSpikes}회  ${diag.lastSpike}`;
    }
  }

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) toastEl.textContent = "";
  }
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 0.5) {
    fps = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0;
    fpsFrames = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// dev hook for automated checks
window.__lh = { player, world, interact, diag, get mercury() { return mercury; }, set mercury(v) { mercury = v; }, get mode() { return mode; } };
