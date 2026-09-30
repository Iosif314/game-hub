import * as THREE from "three";

// Low-poly props built from primitives. Kept deliberately coarse (6–16 segments) to suit the PS1 raster.
// Flames use a saturated warm MeshBasicMaterial: the post pass turns everything grey except that colour.

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const IRON = std(0x2f2f2f, { roughness: 0.55, metalness: 0.4 });
const BRASS = std(0x9a9486, { roughness: 0.35, metalness: 0.6 });
const WOOD = std(0x5b4d3d, { roughness: 0.85 });
const PAPER = std(0xd9d3c3, { roughness: 0.95 });
const CLOTH = std(0x3b3a38, { roughness: 1 });
const SKIN = std(0xa9a296, { roughness: 0.9 });
const MERCURY = std(0xd0d0d0, { roughness: 0.12, metalness: 0.9 });
const FLAME = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.55, 0.1) });

function glass() {
  const m = std(0xe6e6e6, { roughness: 0.05, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  return m;
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// a thin cylinder between two points
function rod(a, b, r, mat, seg = 5) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), seg), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

function linesTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Fresnel lens on its cast-iron pedestal, floating in the mercury bath, with the burner inside
export function lensAssembly() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.42, 0.9, 10), IRON, 0, 0.45, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.76, 0.7, 0.2, 16), IRON, 0, 1.0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.02, 16), MERCURY, 0, 1.1, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16), BRASS, 0, 1.14, 0));

  const H = 1.3;
  const rAt = (y) => 0.34 + 0.2 * Math.sin((Math.PI * y) / H);
  const pts = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const y = (i / N) * H;
    // alternate points stick out a little: the stepped prism rings of a Fresnel lens
    pts.push(new THREE.Vector2(rAt(y) + (i % 2 ? 0.035 : 0), y));
  }
  const lens = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), glass());
  lens.position.y = 1.17;
  lens.userData.noShadow = true;
  g.add(lens);
  for (const y of [0.05, 0.4, 0.9, 1.25]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rAt(y) + 0.04, 0.014, 4, 16), BRASS);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.17 + y;
    g.add(ring);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const top = new THREE.Vector3(Math.cos(a) * (rAt(H) + 0.04), 1.17 + H, Math.sin(a) * (rAt(H) + 0.04));
    const mid = new THREE.Vector3(Math.cos(a) * (rAt(H / 2) + 0.04), 1.17 + H / 2, Math.sin(a) * (rAt(H / 2) + 0.04));
    const bot = new THREE.Vector3(Math.cos(a) * (rAt(0) + 0.04), 1.17, Math.sin(a) * (rAt(0) + 0.04));
    g.add(rod(bot, mid, 0.012, BRASS, 4), rod(mid, top, 0.012, BRASS, 4));
  }
  g.add(mesh(new THREE.ConeGeometry(0.42, 0.28, 12), IRON, 0, 1.17 + H + 0.14, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), IRON, 0, 1.17 + H + 0.38, 0));

  // burner tube and the glowing mantle at the lens's focus
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 8), IRON, 0, 1.42, 0));
  const flame = mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.17, 8), FLAME, 0, 1.76, 0);
  flame.userData.noShadow = true;
  g.add(flame);
  return g;
}

export function oilDrum() {
  const g = new THREE.Group();
  const body = std(0x4b4a47, { roughness: 0.6, metalness: 0.3 });
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.86, 12), body, 0, 0.43, 0));
  for (const y of [0.29, 0.57]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.016, 4, 12), body);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = y;
    g.add(rib);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 6), IRON, 0.14, 0.88, 0.05));
  return g;
}

// bucket, chamois and a stoneware flask: the kit for straining the mercury
export function filterKit() {
  const g = new THREE.Group();
  const tin = std(0x777570, { roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide });
  g.add(mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.3, 10, 1, true), tin, 0, 0.15, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 10), tin, 0, 0.005, 0));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.008, 4, 10, Math.PI), IRON);
  handle.position.y = 0.3;
  g.add(handle);
  const cloth = mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), std(0xbdb6a6), 0.05, 0.31, 0.04);
  cloth.rotation.set(0.2, 0.4, -0.25);
  g.add(cloth);
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), std(0x57534c), 0.34, 0.1, 0.05));
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 6), std(0x57534c), 0.34, 0.23, 0.05));
  return g;
}

export function telescope() {
  const g = new THREE.Group();
  const head = new THREE.Vector3(0, 1.05, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    g.add(rod(head, new THREE.Vector3(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38), 0.018, WOOD, 5));
  }
  const tube = new THREE.Group();
  tube.add(mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.7, 8), BRASS, 0, 0.2, 0));
  tube.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), BRASS, 0, -0.3, 0));
  tube.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.08, 6), IRON, 0, -0.5, 0));
  tube.rotation.z = Math.PI / 2 - 0.12;
  tube.position.copy(head).add(new THREE.Vector3(0, 0.06, 0));
  g.add(tube);
  return g;
}

export function logbook() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.015, 0.32), std(0x2a2724), 0, 0.008, 0));
  const pageTex = linesTexture(64, 48, (c) => {
    c.fillStyle = "#d9d3c3";
    c.fillRect(0, 0, 64, 48);
    c.fillStyle = "#6d675d";
    for (let y = 6; y < 44; y += 4) {
      const w = 20 + ((y * 7) % 30);
      c.fillRect(4, y, Math.min(w, 56), 1);
    }
  });
  const pageMat = [PAPER, PAPER, std(0xffffff, { map: pageTex, roughness: 0.95 }), PAPER, PAPER, PAPER];
  for (const side of [-1, 1]) {
    const p = mesh(new THREE.BoxGeometry(0.22, 0.02, 0.3), pageMat, side * 0.112, 0.025, 0);
    p.rotation.z = side * 0.07;
    g.add(p);
  }
  g.add(rod(new THREE.Vector3(0.05, 0.04, 0.2), new THREE.Vector3(0.2, 0.04, 0.12), 0.006, IRON, 4));
  return g;
}

// hurricane lantern: fuel fount, glass globe in a wire guard, side air tubes and a bail handle.
// Origin is the bottom of the fount; userData.flameY is the flame height for the light that follows it.
export function handLantern() {
  const g = new THREE.Group();
  const tin = std(0x3a3935, { roughness: 0.5, metalness: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.06, 10), tin, 0, 0.03, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.02, 10), tin, 0, 0.07, 0));
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(0.035 + Math.sin(Math.PI * t) * 0.035, 0.08 + t * 0.15));
  }
  const globe = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), glass());
  globe.userData.noShadow = true;
  g.add(globe);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const at = (r, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    g.add(rod(at(0.05, 0.08), at(0.078, 0.155), 0.003, tin, 3), rod(at(0.078, 0.155), at(0.05, 0.23), 0.003, tin, 3));
  }
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.003, 3, 12), tin);
  guard.rotation.x = Math.PI / 2;
  guard.position.y = 0.155;
  g.add(guard);
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.055, 0.04, 10), tin, 0, 0.25, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), tin, 0, 0.285, 0));
  // side air tubes from the fount up to the cap
  for (const x of [-0.085, 0.085]) {
    g.add(rod(new THREE.Vector3(x, 0.06, 0), new THREE.Vector3(x, 0.25, 0), 0.006, tin, 4));
    g.add(rod(new THREE.Vector3(x, 0.25, 0), new THREE.Vector3(x * 0.4, 0.27, 0), 0.006, tin, 4));
  }
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.004, 3, 12, Math.PI), tin);
  bail.position.y = 0.25;
  g.add(bail);
  const flame = mesh(new THREE.ConeGeometry(0.012, 0.045, 6), FLAME, 0, 0.14, 0);
  flame.userData.noShadow = true;
  g.add(flame);
  g.userData.flameY = 0.14;
  g.userData.handleY = 0.335;
  return g;
}

export function desk() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.4, 0.06, 0.7), WOOD, 0, 0.77, 0));
  for (const [x, z] of [
    [-0.64, -0.29],
    [0.64, -0.29],
    [-0.64, 0.29],
    [0.64, 0.29],
  ]) {
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.74, 0.06), WOOD, x, 0.37, z));
  }
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.14, 0.62), WOOD, 0.4, 0.66, 0));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), BRASS, 0.4, 0.66, 0.315));
  return g;
}

export function chair() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), WOOD, 0, 0.45, 0));
  for (const [x, z] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ]) {
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), WOOD, x, 0.225, z));
  }
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.45, 0.04), WOOD, 0, 0.7, -0.19));
  return g;
}

// wall-mounted wireless set; the front face reuses the drawn panel
export function radioSet(panelTex) {
  const g = new THREE.Group();
  const cab = std(0x3d3833, { roughness: 0.7 });
  const front = std(0xffffff, { map: panelTex, roughness: 0.6 });
  g.add(mesh(new THREE.BoxGeometry(0.72, 0.52, 0.28), [cab, cab, cab, cab, front, cab], 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.04, 0.34), WOOD, 0, -0.28, 0));
  for (const x of [-0.12, 0.12]) {
    const knob = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8), IRON, x + 0.18, 0.12, 0.15);
    knob.rotation.x = Math.PI / 2;
    g.add(knob);
  }
  return g;
}

// telegraph printer with its paper tape spilling onto the shelf
export function tapePrinter() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.16, 0.22), std(0x33302c, { roughness: 0.6 }), 0, 0.08, 0));
  const roll = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), PAPER, -0.06, 0.2, 0);
  roll.rotation.x = Math.PI / 2;
  g.add(roll);
  const tape = mesh(new THREE.BoxGeometry(0.34, 0.004, 0.03), PAPER, 0.28, 0.004, 0.02);
  tape.rotation.y = 0.3;
  g.add(tape);
  return g;
}

export function survivor() {
  const g = new THREE.Group();
  const coat = std(0x33322f, { roughness: 1 });
  const trousers = std(0x262523, { roughness: 1 });
  for (const x of [-0.09, 0.09]) {
    g.add(mesh(new THREE.BoxGeometry(0.13, 0.82, 0.15), trousers, x, 0.41, 0));
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.08, 0.24), std(0x1c1b1a), x, 0.04, 0.04));
  }
  const torso = mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.72, 6), coat, 0, 1.16, 0);
  g.add(torso);
  g.userData.torso = torso;
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.BoxGeometry(0.11, 0.66, 0.12), coat, side * 0.27, 1.12, 0.02);
    arm.rotation.z = side * 0.08;
    g.add(arm);
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.09, 0.08), SKIN, side * 0.3, 0.76, 0.03));
  }
  // blanket over the shoulders
  const blanket = mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.3, 6, 1, true), std(0x6a655b, { side: THREE.DoubleSide }), 0, 1.4, 0);
  g.add(blanket);
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 6), SKIN, 0, 1.56, 0));
  g.add(mesh(new THREE.SphereGeometry(0.12, 7, 5), SKIN, 0, 1.69, 0.01));
  const hair = mesh(new THREE.SphereGeometry(0.125, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), std(0x1e1d1c), 0, 1.71, -0.005);
  g.add(hair);
  return g;
}

export function ship() {
  const g = new THREE.Group();
  const hull = std(0x252422, { roughness: 0.9 });
  const shape = new THREE.Shape();
  shape.moveTo(-9, 1.5);
  shape.lineTo(9, 1.5);
  shape.lineTo(13, 3.2);
  shape.lineTo(-10, 2.8);
  shape.lineTo(-9, 1.5);
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false });
  hullGeo.translate(0, -1.5, -2.5);
  g.add(mesh(new THREE.BoxGeometry(18, 1.6, 4.4), hull, 0, 0.3, 0));
  g.add(new THREE.Mesh(hullGeo, hull));
  const sail = std(0xcfc9ba, { side: THREE.DoubleSide, roughness: 1 });
  for (const [x, h] of [
    [-3, 14],
    [4, 12],
  ]) {
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, h, 5), WOOD, x, h / 2 + 1, 0));
    g.add(mesh(new THREE.BoxGeometry(0.1, h * 0.55, 5.5), sail, x + 0.3, h * 0.55, 0));
    g.add(mesh(new THREE.BoxGeometry(0.1, h * 0.25, 4.2), sail, x + 0.3, h * 0.92, 0));
  }
  return g;
}
