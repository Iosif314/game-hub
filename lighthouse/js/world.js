import * as THREE from "three";
import { makeSprites } from "./sprites.js";
import * as M from "./models.js";

// Tower layout (world units ≈ metres), as in the design doc. Floors stack up the tower:
//   level 0  entrance and storage      level 1  living quarters
//   level 2  radio room                level 3  clockwork room
//   level 4  lantern (lens room), with the gallery ledge outside it
// One spiral flight runs up each interior level, always over the same quarter-turns, so every
// upper floor has its stair opening in the same place. Angles are atan2(z, x) in [0, 2π).
export const R = 4;
export const FLOOR_H = 3.2;
export const STEP_UP = 0.5;
const INTERIOR = 4; // interior levels below the lantern
export const TOP = INTERIOR * FLOOR_H; // lantern floor
const STAIR_SPAN = Math.PI * 1.5;
const STAIR_R0 = 2.6;
const STAIR_R1 = 3.9;
const STEPS = 20;
const HOLE_START = (120 / 180) * Math.PI;
// the inner handrail starts at the third step, so the lowest steps can still be stepped off sideways
const RAIL_START = (3 * (Math.PI * 1.5)) / 20;
const GALLERY_DOOR_A = (312 / 180) * Math.PI;
const DOOR_HALF = (13 / 180) * Math.PI;
const GALLERY_R = R + 1.5;
const LENS_R = 0.9;
const COLUMN_R = 0.5;
const BODY = 0.35;
const SEA_Y = -12;

// furniture footprints (circles) per level, filled in by buildWorld
const OBSTACLES = [];

const TAU = Math.PI * 2;
const angleOf = (x, z) => {
  const a = Math.atan2(z, x);
  return a < 0 ? a + TAU : a;
};
const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);
const levelOf = (y) => Math.max(0, Math.min(INTERIOR, Math.floor((y + 0.3) / FLOOR_H)));

// height of the step under angle a, measured from the bottom of its flight
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
    for (let L = 1; L <= INTERIOR; L++) if (!inHole) consider(L * FLOOR_H);
  } else if (r <= GALLERY_R) {
    consider(TOP);
  }
  if (r >= STAIR_R0 && r <= STAIR_R1) {
    const t = stairTop(a);
    if (t !== null) for (let L = 0; L < INTERIOR; L++) consider(L * FLOOR_H + t);
  }
  return best;
}

function interiorBlocked(r, a, y) {
  if (r > R - BODY || r < COLUMN_R + BODY) return true;
  const base = Math.floor((y + 0.01) / FLOOR_H) * FLOOR_H;
  // inner handrail: once up a flight you can't step off its open side
  if (y - base > 0.3 && r < STAIR_R0 + 0.05 && a >= RAIL_START && a <= STAIR_SPAN) return true;
  if (r >= STAIR_R0 - BODY && r <= STAIR_R1) {
    const t = stairTop(a);
    // walking under the flight above: blocked where its steps would hit your head
    if (t !== null && base + t > y + STEP_UP && base + t < y + 2.0) return true;
  }
  return false;
}

function lanternBlocked(r, a) {
  if (r < LENS_R) return true;
  if (angDiff(a, GALLERY_DOOR_A) < DOOR_HALF - 0.04) return r > GALLERY_R - BODY;
  if (r < R) return r > R - BODY;
  return r < R + BODY || r > GALLERY_R - BODY;
}

export function blocked(x, z, y) {
  const r = Math.hypot(x, z);
  const a = angleOf(x, z);
  const level = levelOf(y);
  for (const o of OBSTACLES) {
    if (o.level === level && Math.hypot(x - o.x, z - o.z) < o.r + BODY * 0.7) return true;
  }
  return y < TOP - 0.6 ? interiorBlocked(r, a, y) : lanternBlocked(r, a);
}

// only the tower's shell and fixed fittings — used to let the player walk out if ever wedged
export function hardBlocked(x, z, y) {
  const r = Math.hypot(x, z);
  const a = angleOf(x, z);
  if (y < TOP - 0.6) return r > R - BODY || r < COLUMN_R + BODY;
  return lanternBlocked(r, a);
}

const ROOMS = ["storage", "living", "radio", "clock"];
export function zoneOf(pos) {
  const r = Math.hypot(pos.x, pos.z);
  if (pos.y >= TOP - 0.6) return r < R ? "lantern" : "gallery";
  const L = levelOf(pos.y);
  return pos.y - L * FLOOR_H > 0.3 ? "stairs" : ROOMS[L];
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
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 24, bottom: -24, near: 1, far: 220 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  sun.target.position.set(0, TOP / 2, 0);
  scene.add(sun.target);
  // lights stay pure white: the post pass treats warm, saturated pixels as flame
  const deskLamp = new THREE.PointLight(0xffffff, 3.5, 6, 2);
  scene.add(deskLamp);
  const lensLamp = new THREE.PointLight(0xffffff, 8, 8, 2);
  lensLamp.position.set(0, TOP + 1.76, 0);
  scene.add(lensLamp);

  const planks = new THREE.MeshStandardMaterial({ map: sp.planks, side: THREE.DoubleSide });
  sp.planks.repeat.set(4, 4);
  const stoneTex = sp.stone.clone();
  stoneTex.needsUpdate = true;
  stoneTex.repeat.set(12, 2 * INTERIOR);
  const stoneIn = new THREE.MeshStandardMaterial({ map: stoneTex, side: THREE.BackSide });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
  const paint = new THREE.MeshStandardMaterial({ color: 0xd8d4c8 });

  // floors: the ground floor is whole; every floor above has the stair opening cut out
  // (upper floors are rotated +90° so geometry angle == world angle)
  const f0 = new THREE.Mesh(new THREE.RingGeometry(0, R, 48, 8), planks);
  f0.rotation.x = -Math.PI / 2;
  scene.add(f0);
  solids.push(f0);
  for (let L = 1; L <= INTERIOR; L++) {
    const inner = new THREE.Mesh(new THREE.RingGeometry(0, STAIR_R0 - 0.2, 32, 5), planks);
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(STAIR_R0 - 0.2, R, 48, 3, STAIR_SPAN, TAU - (STAIR_SPAN - HOLE_START)),
      planks,
    );
    for (const m of [inner, outer]) {
      m.rotation.x = Math.PI / 2;
      m.position.y = L * FLOOR_H;
      scene.add(m);
      solids.push(m);
    }
  }

  // inner walls up to the lantern, and the tower's outer shell from the sea, tapering as it rises
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, TOP, 64, 8 * INTERIOR, true), stoneIn);
  wall.position.y = TOP / 2;
  scene.add(wall);
  solids.push(wall);
  const shellH = TOP - SEA_Y;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.25, R + 1.8, shellH, 40, 16, true), paint);
  shell.position.y = SEA_Y + shellH / 2;
  scene.add(shell);
  // a dark band marks each floor on the outside
  for (let L = 1; L <= INTERIOR; L++) {
    const y = L * FLOOR_H;
    const rr = R + 0.25 + ((TOP - y) / shellH) * 1.55;
    const bandO = new THREE.Mesh(new THREE.CylinderGeometry(rr + 0.03, rr + 0.04, 0.18, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x3b3936 }));
    bandO.position.y = y;
    scene.add(bandO);
  }

  // central tube the clockwork weight runs down, through every interior floor
  const column = new THREE.Mesh(new THREE.CylinderGeometry(COLUMN_R, COLUMN_R, TOP, 16), iron);
  column.position.y = TOP / 2;
  scene.add(column);
  solids.push(column);

  // spiral stairs: one flight per interior level, each with its inner handrail
  const stepGeo = new THREE.BoxGeometry(STAIR_R1 - STAIR_R0, 0.14, 0.72);
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x8a8274, roughness: 0.8 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.6, metalness: 0.3 });
  const railR = STAIR_R0 + 0.04;
  for (let L = 0; L < INTERIOR; L++) {
    const base = L * FLOOR_H;
    for (let i = 0; i < STEPS; i++) {
      const a = (i + 0.5) * (STAIR_SPAN / STEPS);
      const s = new THREE.Mesh(stepGeo, stepMat);
      s.position.copy(polar(a, (STAIR_R0 + STAIR_R1) / 2, base + ((i + 1) * FLOOR_H) / STEPS - 0.07));
      s.rotation.y = -a;
      scene.add(s);
    }
    const railPts = [];
    for (let i = 0; i <= 40; i++) {
      const a = RAIL_START + ((STAIR_SPAN - RAIL_START) * i) / 40;
      railPts.push(polar(a, railR, base + (a / STAIR_SPAN) * FLOOR_H + 0.9));
    }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 60, 0.025, 5), railMat));
    for (let i = 3; i < STEPS; i += 2) {
      const a = (i + 0.5) * (STAIR_SPAN / STEPS);
      const top = base + ((i + 1) * FLOOR_H) / STEPS;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5), railMat);
      post.position.copy(polar(a, railR, top + 0.45));
      scene.add(post);
    }
  }

  // lantern: low parapet with a gap for the gallery door, glazing bars, roof
  const doorTheta = Math.PI / 2 - GALLERY_DOOR_A;
  const parapet = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, 1.0, 48, 3, true, doorTheta + DOOR_HALF, TAU - DOOR_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0x5b5750, side: THREE.DoubleSide }),
  );
  parapet.position.y = TOP + 0.5;
  scene.add(parapet);
  solids.push(parapet);
  const barGeo = new THREE.BoxGeometry(0.08, 2.6, 0.08);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    if (angDiff(a, GALLERY_DOOR_A) < DOOR_HALF) continue;
    const b = new THREE.Mesh(barGeo, iron);
    b.position.copy(polar(a, R, TOP + 1.3));
    scene.add(b);
  }
  for (const a of [GALLERY_DOOR_A - DOOR_HALF, GALLERY_DOOR_A + DOOR_HALF]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), iron);
    b.position.copy(polar(a, R, TOP + 1.3));
    scene.add(b);
  }
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.3, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2c2b2a, side: THREE.DoubleSide }),
  );
  band.position.y = TOP + 2.75;
  scene.add(band);
  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(R + 0.05, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a3836, side: THREE.DoubleSide }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = TOP + 2.9;
  scene.add(ceiling);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(R + 0.5, 2.0, 32), new THREE.MeshStandardMaterial({ color: 0x2c2b2a }));
  roof.position.y = TOP + 3.9;
  scene.add(roof);

  // gallery ledge and railing
  const gallery = new THREE.Mesh(
    new THREE.RingGeometry(R, GALLERY_R, 48, 3),
    new THREE.MeshStandardMaterial({ color: 0x55524c, side: THREE.DoubleSide }),
  );
  gallery.rotation.x = Math.PI / 2;
  gallery.position.y = TOP;
  scene.add(gallery);
  solids.push(gallery);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(GALLERY_R - 0.05, 0.03, 4, 64), iron);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = TOP + 1.0;
  scene.add(rail);
  const postGeo = new THREE.BoxGeometry(0.05, 1.0, 0.05);
  for (let i = 0; i < 28; i++) {
    const p = new THREE.Mesh(postGeo, iron);
    p.position.copy(polar((i / 28) * TAU, GALLERY_R - 0.05, TOP + 0.5));
    scene.add(p);
  }

  // rocks and sea
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4744, flatShading: true });
  const rocks = [
    [0, 8, 3],
    [deg(70), 10, 2.2],
    [deg(150), 9, 2.8],
    [deg(230), 11, 2],
    [deg(300), 9, 2.5],
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
  const beamSpots = [];
  // soft beam: brightest along its core and near the lens, fading at the edges and out to sea
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0.22 } },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      varying float vAlong;
      void main() {
        vAlong = 1.0 - uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float strength;
      varying vec3 vN;
      varying vec3 vV;
      varying float vAlong;
      void main() {
        // brightest through the middle, but never fully dark at the outline (that read as a seam)
        float core = 0.35 + 0.65 * pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        // clamp first: at the cone's rim 1 - vAlong can dip just below zero, and pow() of a negative
        // number is NaN, which came out of the post pass as a black ring
        float fade = pow(max(0.0, 1.0 - vAlong), 2.6);
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.94), strength * core * fade);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (const dir of [1, -1]) {
    // narrow (lens-sized) at the lantern, widening out to sea
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 24, 120, 24, 1, true), beamMat);
    cone.userData.noShadow = true;
    cone.rotation.z = (dir * Math.PI) / 2;
    cone.position.x = dir * 60;
    beam.add(cone);
    // the beam actually lights what it sweeps over, so dark-running ships show for a moment
    const spot = new THREE.SpotLight(0xffffff, 0, 400, 0.2, 1, 1); // fully soft edge: no ring on the water
    spot.target.position.set(dir * 100, -24, 0);
    beam.add(spot, spot.target);
    beamSpots.push(spot);
  }
  beam.position.y = TOP + 1.76; // level with the flame at the lens's focus
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
    if (obstacle) OBSTACLES.push({ x: pos.x, z: pos.z, r: obstacle, level: levelOf(pos.y) });
    return obj;
  };
  const addWindow = (a, y) => {
    const wm = new THREE.MeshBasicMaterial({ map: sp.window, transparent: true, alphaTest: 0.5 });
    windowMats.push(wm);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.85), wm);
    onWall(w, a, y);
    scene.add(w);
  };

  // level 0 — entrance and storage: the door onto the rocks, oil drums, food, the supply crate
  const y0 = 0;
  const door = new THREE.Group();
  door.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.08), new THREE.MeshStandardMaterial({ color: 0x4a3f33, roughness: 0.9 })));
  const doorFrame = new THREE.MeshStandardMaterial({ color: 0x2c2722 });
  for (const x of [-0.55, 0.55]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.14), doorFrame);
    post.position.x = x;
    door.add(post);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 10), new THREE.MeshStandardMaterial({ color: 0x777065, metalness: 0.6, roughness: 0.4 }));
  ring.position.set(0.32, 0, 0.06);
  door.add(ring);
  const doorA = deg(300);
  door.position.copy(polar(doorA, R - 0.06, y0 + 1.0));
  door.rotation.y = faceCentre(doorA);
  door.userData.interact = { id: "door", label: "등대 문" };
  scene.add(door);
  interactables.push(door);
  place(M.oilDrum(), polar(deg(330), 3.3, y0), 0.3, { id: "drum", label: "석유 보충" }, 0.32);
  place(M.oilDrum(), polar(deg(340), 3.35, y0), 1.1, null, 0.32);
  place(M.oilDrum(), polar(deg(321), 3.4, y0), 2.0, null, 0.32);
  place(M.foodSacks(), polar(deg(280), 3.1, y0), faceCentre(deg(280)), null, 0.5);
  place(M.shelf(), polar(deg(355), R - 0.25, y0), faceCentre(deg(355)), null, 0.4);
  const crate = place(M.supplyCrate(), polar(deg(310), 2.3, y0), deg(20), { id: "crate", label: "보급품 확인" });
  addWindow(deg(60), y0 + 1.7);

  // level 1 — living quarters: bunk, stove, table, the mirror; survivors who are let in live here
  const y1 = FLOOR_H;
  // the bunk lies along the wall; two circles cover its length
  const bunk = place(M.bunk(), polar(deg(300), 3.3, y1), faceCentre(deg(300)));
  bunk.updateMatrixWorld(true);
  for (const x of [-0.55, 0.55]) OBSTACLES.push({ ...xz(bunk.localToWorld(new THREE.Vector3(x, 0, 0))), r: 0.55, level: 1 });
  // bedside table at the head of the bunk, where the hand lantern starts
  const stand = place(M.nightstand(), bunk.localToWorld(new THREE.Vector3(-1.32, 0, 0)), bunk.rotation.y, null, 0.3);
  solids.push(stand);
  place(M.stove(), polar(deg(340), 3.35, y1), faceCentre(deg(340)), null, 0.4);
  place(M.table(), polar(deg(20), 1.8, y1), 0.4, null, 0.5);
  const mirror = M.mirror();
  onWall(mirror, deg(358), y1 + 1.55, R - 0.04);
  scene.add(mirror);
  addWindow(deg(70), y1 + 1.7);
  addWindow(deg(280), y1 + 1.7);

  // level 2 — radio room: desk with the logbook, lamp and telegraph printer; chair; the wireless on the wall
  const y2 = FLOOR_H * 2;
  const deskA = deg(318);
  const deskM = place(M.desk(), polar(deskA, 3.25, y2), faceCentre(deskA));
  solids.push(deskM);
  OBSTACLES.push(
    { ...xz(polar(deskA - deg(9), 3.25)), r: 0.42, level: 2 },
    { ...xz(polar(deskA + deg(9), 3.25)), r: 0.42, level: 2 },
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
  // the hand lantern starts on the bedside table; it lives directly in the scene so it can be picked up and moved
  const lantern = M.handLantern();
  lantern.position.copy(stand.position).add(new THREE.Vector3(0, 0.58, 0));
  lantern.userData.interact = { id: "lantern", label: "랜턴 들기" };
  scene.add(lantern);
  interactables.push(lantern);
  deskLamp.position.copy(lantern.position).add(new THREE.Vector3(0, lantern.userData.flameY, 0));
  place(M.chair(), polar(deskA, 2.45, y2), faceCentre(deskA) + Math.PI, null, 0.3);
  const radioA = deg(334);
  const radio = place(M.radioSet(sp.radio), polar(radioA, R - 0.16, y2 + 1.45), faceCentre(radioA), { id: "radio", label: "무전기 듣기" });
  solids.push(radio);
  addWindow(deg(355), y2 + 1.7);
  addWindow(deg(60), y2 + 1.7);

  // level 3 — clockwork room: the machine that turns the lens, its weight cable running into the tube
  const y3 = FLOOR_H * 3;
  const clockA = deg(300);
  const clock = place(M.clockwork(), polar(clockA, 1.45, y3), faceCentre(clockA) + Math.PI, { id: "wind", label: "태엽 감기" }, 0.55);
  solids.push(clock);
  addWindow(deg(30), y3 + 1.7);

  // level 4 — lantern
  const lens = place(M.lensAssembly(), new THREE.Vector3(0, TOP, 0), 0, { id: "lens", label: "렌즈 작업" });
  lens.userData.reach = 2.2;
  place(M.filterKit(), polar(deg(20), 3.3, TOP), 0.8, { id: "filter", label: "수은 욕조 거르기" }, 0.28);

  // gallery
  const scopeA = deg(10);
  place(M.telescope(), polar(scopeA, R + 1.0, TOP), Math.PI - scopeA, { id: "telescope", label: "망원경과 신호등" }, 0.3);
  const telescope = { eye: polar(scopeA, R + 1.0, TOP + 1.2), bearing: scopeA };

  // the reef: rocks breaking the surface in a ring off the tower
  for (let i = 0; i < 26; i++) {
    const a = deg(-80 + i * 6.5 + Math.sin(i * 7.1) * 2);
    const r = 52 + Math.sin(i * 3.3) * 6;
    const sz = 1.2 + ((i * 37) % 10) / 6;
    const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(sz, 0), rockMat);
    rk.position.copy(polar(a, r, SEA_Y + sz * 0.2));
    rk.rotation.set(i, i * 2, 0);
    scene.add(rk);
  }

  // supply boat moored off the rocks (shown on supply days)
  const boat = M.supplyBoat();
  boat.position.copy(polar(deg(35), 18, SEA_Y + 0.4));
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
    glass: lens.userData.glass,
    time: 0,
    beam,
    beamMat,
    beamSpots,
    beamAngle: 0,
  };

  // the keeper wakes in the living quarters, facing the room
  const spawnA = deg(240);
  return {
    interactables,
    solids,
    animated,
    env,
    supply: { crate, boat },
    lantern,
    lanternLight: deskLamp,
    telescope,
    survivorModels: [],
    spawn: polar(spawnA, 1.6, y1),
    spawnYaw: Math.atan2(Math.cos(spawnA), Math.sin(spawnA)),
  };
}

export function animateWorld(world, t) {
  const { seaTime, ship } = world.animated;
  seaTime.value = t;
  ship.position.x = -150 + ((t * 1.2) % 300);
  // slow breathing
  for (const [i, p] of world.survivorModels.entries()) {
    p.userData.torso.scale.set(1 + Math.sin(t * 1.6 + i) * 0.015, 1, 1 + Math.sin(t * 1.6 + i) * 0.02);
  }
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Sun arc from 06:00 to 18:00, dim moonlight at night; the lamp and its beam only when lit
export function setTimeOfDay(world, hours, lampOn, rotating, dt, shutter = false, viewPos = null) {
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
  // clear nights see further; the weather can pull the fog in
  const fogScale = world.weatherFog || 1;
  e.fog.near = (30 + 50 * (1 - dayF)) * fogScale;
  e.fog.far = (260 + 240 * (1 - dayF)) * fogScale;
  for (const m of e.windows) m.color.setScalar(0.15 + 0.85 * dayF);
  e.flame.visible = lampOn;
  // the flame breathes a little
  e.time += dt;
  const flick = 0.92 + 0.05 * Math.sin(e.time * 13.7) + 0.03 * Math.sin(e.time * 29.3 + 1.1);
  e.flame.scale.set(1, 0.9 + 0.15 * (flick - 0.92) / 0.08, 1);
  e.lensLamp.intensity = lampOn ? 8 * flick : 0;
  // a flash when one of the beams swings round to face the viewer
  let flash = 0;
  if (lampOn && !shutter && viewPos) {
    const vx = viewPos.x;
    const vz = viewPos.z;
    const len = Math.hypot(vx, vz) || 1;
    const align = Math.abs((Math.cos(e.beamAngle) * vx - Math.sin(e.beamAngle) * vz) / len);
    flash = smooth(0.93, 0.995, align) * (1 - dayF * 0.7);
  }
  e.glass.emissiveIntensity = lampOn ? (0.35 + 0.9 * flash) * flick : 0;
  // the shutter blocks the light from reaching the sea; the flame keeps burning behind it
  e.beam.visible = lampOn && !shutter;
  for (const s of e.beamSpots) s.intensity = lampOn && !shutter ? 900 * (1 - dayF) : 0;
  world.animated.ship.visible = dayF > 0.3;
  if (lampOn && rotating) e.beamAngle -= dt * 0.5;
  e.beam.rotation.y = e.beamAngle;
}

// people let in through the door: they stay in the living quarters
const SURVIVOR_SLOTS = [
  [215, 1.7],
  [245, 1.8],
  [185, 1.6],
  [265, 2.0],
  [160, 1.9],
];
export function addSurvivorModel(world, scene, index, info) {
  const [a, r] = SURVIVOR_SLOTS[index % SURVIVOR_SLOTS.length];
  const ang = deg(a);
  const p = M.survivor();
  p.position.copy(polar(ang, r, FLOOR_H));
  p.rotation.y = Math.atan2(-Math.cos(ang), -Math.sin(ang)) + 0.5;
  p.userData.interact = { id: "survivor", label: `${info.name} · 말 걸기`, index };
  scene.add(p);
  world.interactables.push(p);
  world.survivorModels.push(p);
  OBSTACLES.push({ x: p.position.x, z: p.position.z, r: 0.3, level: 1 });
}
