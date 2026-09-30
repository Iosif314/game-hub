import * as THREE from "three";
import { makeSprites } from "./sprites.js";
import * as M from "./models.js";

// Tower layout (world units ≈ metres). Floor 0 = radio room, floor 1 = lantern (lens room),
// gallery = the outside ledge around the lantern. Angles are atan2(z, x) in [0, 2π).
export const R = 4;
export const FLOOR_H = 3.2;
export const STEP_UP = 0.5;
const STAIR_SPAN = Math.PI * 1.5;
const STAIR_R0 = 2.6;
const STAIR_R1 = 3.9;
const STEPS = 20;
const HOLE_START = (120 / 180) * Math.PI;
// the inner handrail starts at the third step, so the lowest steps can still be stepped off sideways
const RAIL_START = (3 * (Math.PI * 1.5)) / 20;
const DOOR_A = (312 / 180) * Math.PI;
const DOOR_HALF = (13 / 180) * Math.PI;
const GALLERY_R = R + 1.5;
const LENS_R = 0.9;
const COLUMN_R = 0.5;
const BODY = 0.35;
const SEA_Y = -12;

// furniture footprints (circles), filled in by buildWorld
const OBSTACLES = [];

const TAU = Math.PI * 2;
const angleOf = (x, z) => {
  const a = Math.atan2(z, x);
  return a < 0 ? a + TAU : a;
};
const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);

function stairTop(a) {
  if (a < 0 || a > STAIR_SPAN) return null;
  const i = Math.min(STEPS - 1, Math.floor(a / (STAIR_SPAN / STEPS)));
  return ((i + 1) * FLOOR_H) / STEPS;
}

// Highest walkable surface under (x, z) that the player can reach from height y
export function groundAt(x, z, y) {
  const r = Math.hypot(x, z);
  const a = angleOf(x, z);
  let best = -Infinity;
  const consider = (h) => {
    if (h <= y + STEP_UP && h > best) best = h;
  };
  if (r < R) {
    consider(0);
    // collision hole matches the stair band, so anything that drops through lands on a step
    const inHole = r > STAIR_R0 - 0.05 && a >= HOLE_START && a <= STAIR_SPAN;
    if (!inHole) consider(FLOOR_H);
  } else if (r <= GALLERY_R) {
    consider(FLOOR_H);
  }
  if (r >= STAIR_R0 && r <= STAIR_R1) {
    const t = stairTop(a);
    if (t !== null) consider(t);
  }
  return best;
}

export function blocked(x, z, y) {
  const r = Math.hypot(x, z);
  const a = angleOf(x, z);
  const upper = y >= FLOOR_H - 0.6;
  for (const o of OBSTACLES) {
    if (o.upper === upper && Math.hypot(x - o.x, z - o.z) < o.r + BODY * 0.7) return true;
  }
  if (y < FLOOR_H - 0.6) {
    if (r > R - BODY || r < COLUMN_R + BODY) return true;
    // inner handrail: once up the flight you can't step off its open side
    if (y > 0.3 && r < STAIR_R0 + 0.05 && a >= RAIL_START && a <= STAIR_SPAN) return true;
    if (r >= STAIR_R0 - BODY && r <= STAIR_R1) {
      const t = stairTop(a);
      // walking under the flight: blocked where the steps would hit your head
      if (t !== null && t > y + STEP_UP && t < y + 2.0) return true;
    }
    return false;
  }
  if (r < LENS_R) return true;
  if (angDiff(a, DOOR_A) < DOOR_HALF - 0.04) return r > GALLERY_R - BODY;
  if (r < R) return r > R - BODY;
  return r < R + BODY || r > GALLERY_R - BODY;
}

// only the tower's shell and fixed fittings — used to let the player walk out if ever wedged
export function hardBlocked(x, z, y) {
  const r = Math.hypot(x, z);
  const a = angleOf(x, z);
  if (y < FLOOR_H - 0.6) return r > R - BODY || r < COLUMN_R + BODY;
  if (r < LENS_R) return true;
  if (angDiff(a, DOOR_A) < DOOR_HALF - 0.04) return r > GALLERY_R - BODY;
  if (r < R) return r > R - BODY;
  return r < R + BODY || r > GALLERY_R - BODY;
}

export function zoneOf(pos) {
  const r = Math.hypot(pos.x, pos.z);
  if (pos.y < FLOOR_H - 0.6) return pos.y > 0.3 ? "stairs" : "radio";
  return r < R ? "lantern" : "gallery";
}

function onWall(mesh, a, y, r = R - 0.02) {
  mesh.position.set(r * Math.cos(a), y, r * Math.sin(a));
  mesh.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
  return mesh;
}

const polar = (a, r, y = 0) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
const xz = (v) => ({ x: v.x, z: v.z });
const deg = (d) => (d / 180) * Math.PI;

export function buildWorld(scene) {
  const sp = makeSprites();
  const interactables = [];
  const animated = {};
  const solids = [];

  // sky and fog
  scene.background = new THREE.Color(0x8d8a84);
  scene.fog = new THREE.Fog(0x8d8a84, 30, 260);
  const skyGeo = new THREE.SphereGeometry(500, 24, 12);
  const skyCols = [];
  const sp0 = skyGeo.attributes.position;
  for (let i = 0; i < sp0.count; i++) {
    const t = Math.max(0, sp0.getY(i) / 500);
    const v = 0.62 - t * 0.35;
    skyCols.push(v, v, v * 0.97);
  }
  skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(skyCols, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  sky.userData.noShadow = true;
  scene.add(sky);

  // lights: low dawn sun, soft fill, the desk lamp and the lighthouse lamp itself
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.18);
  scene.add(hemi);
  // faint moonlight for the nights
  const moon = new THREE.DirectionalLight(0xffffff, 0);
  moon.position.set(50, 60, -30);
  scene.add(moon);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(-60, 25, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);
  // lights stay pure white: the post pass treats warm, saturated pixels as flame
  const deskLamp = new THREE.PointLight(0xffffff, 3.5, 6, 2);
  deskLamp.position.copy(polar(deg(318), 2.6, 1.6));
  scene.add(deskLamp);
  const lensLamp = new THREE.PointLight(0xffffff, 8, 8, 2);
  lensLamp.position.set(0, FLOOR_H + 1.3, 0);
  scene.add(lensLamp);

  const planks = new THREE.MeshStandardMaterial({ map: sp.planks, side: THREE.DoubleSide });
  sp.planks.repeat.set(4, 4);
  const stoneTex = sp.stone.clone();
  stoneTex.needsUpdate = true;
  stoneTex.repeat.set(12, 2);
  const stoneIn = new THREE.MeshStandardMaterial({ map: stoneTex, side: THREE.BackSide });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
  const paint = new THREE.MeshStandardMaterial({ color: 0xd8d4c8 });

  // floor 0
  const f0 = new THREE.Mesh(new THREE.RingGeometry(0, R, 48, 8), planks);
  f0.rotation.x = -Math.PI / 2;
  scene.add(f0);
  solids.push(f0);
  // floor 1 with the stair opening cut out (rotated +90° so geometry angle == world angle)
  const f1a = new THREE.Mesh(new THREE.RingGeometry(0, STAIR_R0 - 0.2, 32, 5), planks);
  const f1b = new THREE.Mesh(
    new THREE.RingGeometry(STAIR_R0 - 0.2, R, 48, 3, STAIR_SPAN, TAU - (STAIR_SPAN - HOLE_START)),
    planks,
  );
  for (const m of [f1a, f1b]) {
    m.rotation.x = Math.PI / 2;
    m.position.y = FLOOR_H;
    scene.add(m);
    solids.push(m);
  }

  // radio-room walls and the tower's outer shell down to the sea
  const wall0 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, FLOOR_H, 64, 8, true), stoneIn);
  wall0.position.y = FLOOR_H / 2;
  scene.add(wall0);
  solids.push(wall0);
  const shellH = FLOOR_H - SEA_Y;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.25, R + 1.2, shellH, 40, 10, true), paint);
  shell.position.y = SEA_Y + shellH / 2;
  scene.add(shell);

  // central tube the clockwork weight runs down
  const column = new THREE.Mesh(new THREE.CylinderGeometry(COLUMN_R, COLUMN_R, FLOOR_H, 16), iron);
  column.position.y = FLOOR_H / 2;
  scene.add(column);
  solids.push(column);
  // the winding crank sits on the weight tube
  column.userData.interact = { id: "wind", label: "태엽 감기" };
  interactables.push(column);

  // spiral stairs
  const stepGeo = new THREE.BoxGeometry(STAIR_R1 - STAIR_R0, 0.14, 0.72);
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x8a8274, roughness: 0.8 });
  for (let i = 0; i < STEPS; i++) {
    const a = (i + 0.5) * (STAIR_SPAN / STEPS);
    const s = new THREE.Mesh(stepGeo, stepMat);
    s.position.copy(polar(a, (STAIR_R0 + STAIR_R1) / 2, ((i + 1) * FLOOR_H) / STEPS - 0.07));
    s.rotation.y = -a;
    scene.add(s);
  }
  // inner handrail following the flight, with a post every other step
  const railR = STAIR_R0 + 0.04;
  const railPts = [];
  for (let i = 0; i <= 40; i++) {
    const a = RAIL_START + ((STAIR_SPAN - RAIL_START) * i) / 40;
    railPts.push(polar(a, railR, (a / STAIR_SPAN) * FLOOR_H + 0.9));
  }
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.6, metalness: 0.3 });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 60, 0.025, 5), railMat));
  for (let i = 3; i < STEPS; i += 2) {
    const a = (i + 0.5) * (STAIR_SPAN / STEPS);
    const top = ((i + 1) * FLOOR_H) / STEPS;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5), railMat);
    post.position.copy(polar(a, railR, top + 0.45));
    scene.add(post);
  }

  // lantern: low parapet with a gap for the gallery door, glazing bars, roof
  const doorTheta = Math.PI / 2 - DOOR_A;
  const parapet = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, 1.0, 48, 3, true, doorTheta + DOOR_HALF, TAU - DOOR_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0x5b5750, side: THREE.DoubleSide }),
  );
  parapet.position.y = FLOOR_H + 0.5;
  scene.add(parapet);
  solids.push(parapet);
  const barGeo = new THREE.BoxGeometry(0.08, 2.6, 0.08);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    if (angDiff(a, DOOR_A) < DOOR_HALF) continue;
    const b = new THREE.Mesh(barGeo, iron);
    b.position.copy(polar(a, R, FLOOR_H + 1.3));
    scene.add(b);
  }
  for (const a of [DOOR_A - DOOR_HALF, DOOR_A + DOOR_HALF]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), iron);
    b.position.copy(polar(a, R, FLOOR_H + 1.3));
    scene.add(b);
  }
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.3, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2c2b2a, side: THREE.DoubleSide }),
  );
  band.position.y = FLOOR_H + 2.75;
  scene.add(band);
  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(R + 0.05, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a3836, side: THREE.DoubleSide }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = FLOOR_H + 2.9;
  scene.add(ceiling);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(R + 0.5, 2.0, 32), new THREE.MeshStandardMaterial({ color: 0x2c2b2a }));
  roof.position.y = FLOOR_H + 3.9;
  scene.add(roof);

  // gallery ledge and railing
  const gallery = new THREE.Mesh(
    new THREE.RingGeometry(R, GALLERY_R, 48, 3),
    new THREE.MeshStandardMaterial({ color: 0x55524c, side: THREE.DoubleSide }),
  );
  gallery.rotation.x = Math.PI / 2;
  gallery.position.y = FLOOR_H;
  scene.add(gallery);
  solids.push(gallery);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(GALLERY_R - 0.05, 0.03, 4, 64), iron);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = FLOOR_H + 1.0;
  scene.add(rail);
  const postGeo = new THREE.BoxGeometry(0.05, 1.0, 0.05);
  for (let i = 0; i < 28; i++) {
    const p = new THREE.Mesh(postGeo, iron);
    p.position.copy(polar((i / 28) * TAU, GALLERY_R - 0.05, FLOOR_H + 0.5));
    scene.add(p);
  }

  // rocks and sea
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4744, flatShading: true });
  const rocks = [
    [0, 7, 3],
    [deg(70), 9, 2.2],
    [deg(150), 8, 2.8],
    [deg(230), 10, 2],
    [deg(300), 8, 2.5],
    [deg(40), 26, 1.6],
    [deg(200), 30, 2],
  ];
  for (const [a, r, s] of rocks) {
    const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMat);
    rk.position.copy(polar(a, r, SEA_Y + s * 0.3));
    rk.rotation.set(a, a * 2, 0);
    scene.add(rk);
  }
  const seaGeo = new THREE.PlaneGeometry(700, 700, 110, 110);
  seaGeo.rotateX(-Math.PI / 2);
  // waves are displaced in the vertex shader; flat shading derives facet normals from the displaced positions
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x4a4947, flatShading: true, roughness: 0.35 });
  const seaTime = { value: 0 };
  seaMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = seaTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        transformed.y += sin(position.x * 0.07 + uTime * 0.9) * 1.1
          + sin(position.z * 0.11 - uTime * 1.3) * 0.8
          + sin((position.x + position.z) * 0.23 + uTime * 1.7) * 0.45;`,
      );
  };
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = SEA_Y;
  scene.add(sea);
  animated.seaTime = seaTime;

  // rotating beam
  const beam = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  for (const dir of [1, -1]) {
    // narrow (lens-sized) at the lantern, widening out to sea
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 6, 90, 16, 1, true), beamMat);
    cone.userData.noShadow = true;
    cone.rotation.z = (dir * Math.PI) / 2;
    cone.position.x = dir * 45;
    beam.add(cone);
  }
  beam.position.y = FLOOR_H + 1.35;
  scene.add(beam);
  animated.beam = beam;

  // --- objects (low-poly models) ---
  const windowMats = [];
  const faceCentre = (a) => Math.atan2(-Math.cos(a), -Math.sin(a));
  const place = (obj, pos, rotY, info, obstacle) => {
    obj.position.copy(pos);
    obj.rotation.y = rotY;
    scene.add(obj);
    if (info) {
      obj.userData.interact = info;
      interactables.push(obj);
    }
    if (obstacle) OBSTACLES.push({ x: pos.x, z: pos.z, r: obstacle, upper: pos.y > FLOOR_H - 0.6 });
    return obj;
  };

  // radio room: desk with the logbook, lamp and telegraph printer; chair; the wireless on the wall
  const deskA = deg(318);
  const deskM = place(M.desk(), polar(deskA, 3.25), faceCentre(deskA));
  solids.push(deskM);
  OBSTACLES.push(
    { ...xz(polar(deskA - deg(9), 3.25)), r: 0.42, upper: false },
    { ...xz(polar(deskA + deg(9), 3.25)), r: 0.42, upper: false },
  );
  const book = M.logbook();
  book.position.set(-0.15, 0.8, 0.05);
  book.rotation.y = 0.15;
  book.userData.interact = { id: "logbook", label: "일지 읽기" };
  interactables.push(book);
  deskM.add(book);
  const printer = M.tapePrinter();
  printer.position.set(0.38, 0.8, -0.08);
  printer.userData.interact = { id: "tape", label: "전신 테이프 읽기" };
  interactables.push(printer);
  deskM.add(printer);
  // the hand lantern starts on the desk; it lives directly in the scene so it can be picked up and moved
  deskM.updateMatrixWorld(true);
  const lantern = M.handLantern();
  lantern.position.copy(deskM.localToWorld(new THREE.Vector3(-0.52, 0.8, -0.12)));
  lantern.userData.interact = { id: "lantern", label: "랜턴 들기" };
  scene.add(lantern);
  interactables.push(lantern);
  deskLamp.position.copy(lantern.position).add(new THREE.Vector3(0, lantern.userData.flameY, 0));
  place(M.chair(), polar(deskA, 2.45), faceCentre(deskA) + Math.PI, null, 0.3);

  const radioA = deg(334);
  const radio = place(M.radioSet(sp.radio), polar(radioA, R - 0.16, 1.45), faceCentre(radioA), { id: "radio", label: "무전기 듣기" });
  solids.push(radio);

  for (const [a, y] of [
    [deg(355), 1.7],
    [deg(160), 1.7],
    [deg(60), 1.7],
  ]) {
    const wm = new THREE.MeshBasicMaterial({ map: sp.window, transparent: true, alphaTest: 0.5 });
    windowMats.push(wm);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.85), wm);
    onWall(w, a, y);
    scene.add(w);
  }
  place(M.oilDrum(), polar(deg(290), 3.3), 0.3, { id: "drum", label: "석유 보충" }, 0.32);
  place(M.oilDrum(), polar(deg(282), 3.35), 1.1, null, 0.32);
  const person = place(M.survivor(), polar(deg(215), 1.7), faceCentre(deg(215)) + 0.6, { id: "survivor", label: "생존자와 대화" }, 0.3);
  animated.survivor = person;

  // lantern
  const lens = place(M.lensAssembly(), new THREE.Vector3(0, FLOOR_H, 0), 0, { id: "lens", label: "렌즈 작업" });
  lens.userData.reach = 2.2;
  lensLamp.position.set(0, FLOOR_H + 1.76, 0);
  place(M.filterKit(), polar(deg(20), 3.3, FLOOR_H), 0.8, { id: "filter", label: "수은 욕조 거르기" }, 0.28);

  // gallery
  const scopeA = deg(10);
  place(M.telescope(), polar(scopeA, R + 1.0, FLOOR_H), Math.PI - scopeA, { id: "telescope", label: "망원경 보기" }, 0.3);

  // supply boat moored off the rocks and the crate it leaves in the radio room (shown on supply days)
  const crate = place(M.supplyCrate(), polar(deg(170), 1.9), deg(20), { id: "crate", label: "보급품 확인" });
  const boat = M.supplyBoat();
  boat.position.copy(polar(deg(35), 16, SEA_Y + 0.4));
  boat.rotation.y = -deg(35) + Math.PI / 2;
  scene.add(boat);

  // a ship far out at sea
  const shipM = M.ship();
  shipM.position.set(-150, SEA_Y + 0.2, -180);
  scene.add(shipM);
  animated.ship = shipM;

  // everything solid casts and receives the sun's shadow; sky, beam, glass and flames are left out
  scene.traverse((o) => {
    if (!o.isMesh || o.userData.noShadow) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  sea.castShadow = false;

  const env = {
    sun,
    moon,
    hemi,
    skyMat: sky.material,
    background: scene.background,
    fog: scene.fog,
    windows: windowMats,
    lensLamp,
    flame: lens.userData.flame,
    beam,
    beamAngle: 0,
  };

  return { interactables, solids, animated, env, supply: { crate, boat }, lantern, lanternLight: deskLamp, spawn: polar(deg(300), 2.0, 0), spawnYaw: 0 };
}

export function animateWorld(world, t) {
  const { seaTime, ship, survivor } = world.animated;
  seaTime.value = t;
  ship.position.x = -150 + ((t * 1.2) % 300);
  // slow breathing
  survivor.userData.torso.scale.set(1 + Math.sin(t * 1.6) * 0.015, 1, 1 + Math.sin(t * 1.6) * 0.02);
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Sun arc from 06:00 to 18:00, dim moonlight at night; the lamp and its beam only when lit
export function setTimeOfDay(world, hours, lampOn, rotating, dt) {
  const e = world.env;
  const arc = (Math.PI * (hours - 6)) / 12;
  const elev = Math.sin(arc);
  const dayF = smooth(-0.08, 0.35, elev);
  e.sun.intensity = 2.6 * smooth(0, 0.25, elev);
  e.sun.position.set(-80 * Math.cos(arc), 70 * Math.max(elev, 0.02), 40);
  e.moon.intensity = (1 - dayF) * 0.35;
  e.hemi.intensity = 0.05 + 0.13 * dayF;
  const skyV = 0.08 + 0.92 * dayF;
  e.skyMat.color.setScalar(skyV);
  e.background.setRGB(0.553 * skyV, 0.541 * skyV, 0.518 * skyV);
  e.fog.color.copy(e.background);
  for (const m of e.windows) m.color.setScalar(0.15 + 0.85 * dayF);
  e.lensLamp.intensity = lampOn ? 8 : 0;
  e.flame.visible = lampOn;
  e.beam.visible = lampOn;
  if (lampOn && rotating) e.beamAngle -= dt * 0.5;
  e.beam.rotation.y = e.beamAngle;
}
