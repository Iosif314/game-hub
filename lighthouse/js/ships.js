import * as THREE from "three";

// Night ships, read through the telescope: hull type, flag pattern, lights, crew on deck, how low it sits.
// Models face +x. Flags are patterns, not colours (the game is greyscale).

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const HULL = std(0x2a2927);
const DECK = std(0x5a5246);
const PAINT = std(0x8f8a7e);
const GREY = std(0x55575a, { roughness: 0.6, metalness: 0.3 });
const CREW = std(0x1d1c1b);
const LAMP = new THREE.MeshBasicMaterial({ color: 0xffffff });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function flagTexture(pattern) {
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#e8e4da";
  g.fillRect(0, 0, 48, 32);
  g.fillStyle = "#111";
  if (pattern === "home") {
    g.fillRect(19, 0, 9, 32);
    g.fillRect(0, 12, 48, 8);
  } else if (pattern === "neutral") {
    for (let y = 0; y < 32; y += 8) g.fillRect(0, y, 48, 4);
  } else if (pattern === "military") {
    g.fillRect(0, 0, 48, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

// a flag on a short staff; the military pennant is a black triangle
function flag(pattern, size, lit) {
  if (!pattern) return null;
  let geo;
  if (pattern === "military") {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(size * 1.6, -size * 0.45);
    s.lineTo(0, -size * 0.9);
    s.closePath();
    geo = new THREE.ShapeGeometry(s);
    geo.translate(0, size * 0.9, 0);
  } else {
    geo = new THREE.PlaneGeometry(size * 1.5, size);
    geo.translate(size * 0.75, size * 0.5, 0);
  }
  const tex = flagTexture(pattern);
  // a little self-light keeps the pattern readable through the telescope at night
  const f = new THREE.Mesh(geo, std(0xffffff, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: lit ? 0.25 : 0, side: THREE.DoubleSide, roughness: 1 }));
  f.userData.flag = true;
  return f;
}

function crewAt(g, n, x0, x1, y, w) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.5, 5), CREW);
    p.position.set(x0 + (x1 - x0) * t, y + 0.75, ((i % 2) - 0.5) * w * 0.5);
    g.add(p);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 5, 4), CREW);
    head.position.set(p.position.x, y + 1.65, p.position.z);
    g.add(head);
  }
}

function lamp(g, x, y, z, r = 0.25) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), LAMP);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

export function buildShip(spec) {
  const g = new THREE.Group();
  const body = new THREE.Group(); // rolls and sinks when wrecked
  g.add(body);
  const lamps = [];
  let flagAt;
  let deckY;
  let length;

  if (spec.kind === "cargo") {
    length = 24;
    deckY = 2.4;
    body.add(box(24, 3.2, 6, HULL, 0, 0.8, 0));
    body.add(box(4, 2.8, 6.2, HULL, 11.5, 1.2, 0));
    body.add(box(23, 0.2, 5.6, DECK, 0, deckY, 0));
    body.add(box(5, 3, 4.6, PAINT, -7.5, deckY + 1.5, 0));
    body.add(box(1.2, 4, 1.2, std(0x1b1a19), -6.5, deckY + 4.5, 0));
    for (const x of [-1, 3.5]) body.add(box(3, 1.6, 3.6, DECK, x, deckY + 0.8, 0));
    body.add(box(0.3, 9, 0.3, DECK, 6, deckY + 4.5, 0));
    flagAt = new THREE.Vector3(-11.5, deckY + 3.5, 0);
    body.add(box(0.15, 3.5, 0.15, DECK, -11.5, deckY + 1.75, 0));
    if (spec.lights) lamps.push(lamp(body, 6, deckY + 9.2, 0), lamp(body, -7.5, deckY + 3.4, 2.4), lamp(body, 11, deckY + 1.5, 0));
    crewAt(body, spec.crew, -4, 9, deckY, 6);
  } else if (spec.kind === "fishing") {
    length = 10;
    deckY = 1.4;
    body.add(box(10, 1.8, 3.4, HULL, 0, 0.5, 0));
    body.add(box(2, 1.6, 3.5, HULL, 4.6, 0.8, 0));
    body.add(box(9.6, 0.15, 3.1, DECK, 0, deckY, 0));
    body.add(box(2.4, 2, 2.2, PAINT, -2.5, deckY + 1, 0));
    body.add(box(0.2, 6, 0.2, DECK, 1.5, deckY + 3, 0));
    const boom = box(5, 0.15, 0.15, DECK, -0.5, deckY + 4.5, 0);
    boom.rotation.z = -0.4;
    body.add(boom);
    flagAt = new THREE.Vector3(1.5, deckY + 6, 0);
    if (spec.lights) lamps.push(lamp(body, 1.5, deckY + 6.2, 0, 0.2), lamp(body, -2.5, deckY + 2.2, 1.2, 0.18));
    crewAt(body, spec.crew, -1, 3.5, deckY, 3.4);
  } else if (spec.kind === "warship") {
    length = 20;
    deckY = 1.8;
    body.add(box(20, 2.4, 4, GREY, 0, 0.6, 0));
    const bow = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 4), GREY);
    bow.rotation.set(0, Math.PI / 4, -Math.PI / 2);
    bow.position.set(12, 0.6, 0);
    body.add(bow);
    body.add(box(19.5, 0.15, 3.6, GREY, 0, deckY, 0));
    body.add(box(5, 2.2, 3, GREY, -2, deckY + 1.1, 0));
    body.add(box(2, 1, 2, GREY, 5.5, deckY + 0.5, 0));
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 6), GREY);
    gun.rotation.z = Math.PI / 2;
    gun.position.set(7.8, deckY + 0.8, 0);
    body.add(gun);
    body.add(box(0.25, 7, 0.25, GREY, -2, deckY + 5.5, 0));
    flagAt = new THREE.Vector3(-2, deckY + 8.5, 0);
    if (spec.lights) lamps.push(lamp(body, -2, deckY + 9, 0, 0.2), lamp(body, -9.5, deckY + 0.8, 0, 0.2));
    crewAt(body, spec.crew, -8, 3, deckY, 3.6);
  } else {
    // small boat
    length = 7;
    deckY = 1;
    body.add(box(7, 1.3, 2.6, HULL, 0, 0.35, 0));
    body.add(box(6.6, 0.12, 2.3, DECK, 0, deckY, 0));
    body.add(box(0.18, 4.5, 0.18, DECK, 0.5, deckY + 2.25, 0));
    flagAt = new THREE.Vector3(0.5, deckY + 4.5, 0);
    if (spec.lights) lamps.push(lamp(body, -3, deckY + 1, 0, 0.16));
    crewAt(body, spec.crew, -2.6, 2.6, deckY, 2.6);
  }

  // dark-running ships get no help: their flag only shows when the beam sweeps over it
  const f = flag(spec.flag, spec.kind === "cargo" ? 3 : spec.kind === "small" ? 1.6 : 2.2, spec.lights);
  if (f) {
    f.position.copy(flagAt);
    body.add(f);
    g.userData.flagMesh = f;
  }
  // deck lights so the ship and its flag can be read at night; dark-running ships have none
  if (spec.lights) {
    const light = new THREE.PointLight(0xffffff, 6, length * 1.6, 2);
    light.position.set(flagAt.x * 0.5, deckY + 3, 0);
    body.add(light);
    const flagLight = new THREE.PointLight(0xffffff, 12, 10, 2);
    flagLight.position.set(flagAt.x + 1.5, flagAt.y + 1, 2.5);
    body.add(flagLight);
  }
  // heavily laden ships sit noticeably lower in the water
  body.position.y = spec.heavy ? -1.1 : -0.3;
  g.userData.body = body;
  g.userData.lamps = lamps;
  g.userData.length = length;
  return g;
}
