import * as THREE from "three";

// The view from the chair when I sit in it myself, in 3D but kept flat: a long lens from far back
// squashes the depth, and the light is mostly even, so it reads like a stage set rather than a room.
// Drawn at full quality, then averaged into the 320×180 grid and dithered to five faded sepia tones;
// only strong colour survives — my blood, the gas, my grief coming back.

const W = 320;
const H = 180;
const SS = 4;

const grey = (v) => new THREE.Color(v / 255, v / 255, v / 255);
const mat = (v, o = {}) => new THREE.MeshLambertMaterial({ color: grey(v), ...o });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const at = (o, x, y, z) => (o.position.set(x, y, z), o);

export function createSelf3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  renderer.setSize(W, H, false);
  const rt = new THREE.WebGLRenderTarget(W * SS, H * SS, { type: THREE.HalfFloatType, samples: 4, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

  const post = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  post.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: rt.texture }, grid: { value: new THREE.Vector2(W, H) }, exposure: { value: 1.2 }, dither: { value: 0.75 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: `
          uniform sampler2D tDiffuse; uniform vec2 grid; uniform float exposure; uniform float dither;
          varying vec2 vUv;
          float ign(vec2 p){ return fract(52.9829189 * fract(dot(floor(p), vec2(0.06711056, 0.00583715)))); }
          vec3 sepia(float i){
            if (i < 0.5) return vec3(0.078, 0.059, 0.047);
            if (i < 1.5) return vec3(0.212, 0.165, 0.125);
            if (i < 2.5) return vec3(0.384, 0.31, 0.231);
            if (i < 3.5) return vec3(0.596, 0.498, 0.376);
            return vec3(0.839, 0.769, 0.635);
          }
          void main(){
            vec3 c = vec3(0.0);
            for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
              vec2 o = (vec2(float(x), float(y)) + 0.5) / 4.0 - 0.5;
              c += texture2D(tDiffuse, vUv + o / grid).rgb;
            }
            c /= 16.0;
            float l = pow(clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)) * exposure, 0.0, 1.0), 1.0 / 2.2);
            float s = l * 4.0;
            float t = 0.5 + (ign(gl_FragCoord.xy) - 0.5) * dither;
            vec3 outc = sepia(clamp(floor(s) + step(t, fract(s)), 0.0, 4.0));
            float mx = max(c.r, max(c.g, c.b));
            float sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 0.001);
            float keep = smoothstep(0.45, 0.65, sat) * smoothstep(0.02, 0.08, mx);
            vec3 col = pow(clamp(c * exposure, 0.0, 1.0), vec3(1.0 / 2.2));
            gl_FragColor = vec4(mix(outc, col, keep), 1.0);
          }`,
      }),
    ),
  );

  const scene = new THREE.Scene();
  scene.background = grey(20);
  // a long lens from far back: almost no perspective, so depth stays flat
  const camera = new THREE.PerspectiveCamera(15, W / H, 1, 40);
  const CAM = new THREE.Vector3(0, 1.15, 14);
  // even light, so the faces of things barely differ
  scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.6));
  const lamp = new THREE.PointLight(0xffffff, 6, 10, 1.5);
  lamp.position.set(0, 2.8, 1);
  scene.add(lamp);

  // the room in front of me
  scene.add(at(box(9, 3.4, 0.1, mat(66)), 0, 1.7, -3));
  scene.add(at(box(9, 0.62, 0.05, mat(52)), 0, 0.31, -2.94));
  scene.add(at(box(9, 0.05, 0.08, mat(110)), 0, 0.62, -2.92));
  for (let x = -4; x <= 4; x += 0.36) scene.add(at(box(0.012, 0.6, 0.02, mat(44)), x, 0.3, -2.9));
  scene.add(at(box(9, 0.1, 6, mat(50)), 0, -0.05, 0));
  for (let z = -2.6; z < 3; z += 0.42) scene.add(at(box(9, 0.006, 0.02, mat(40)), 0, 0.002, z));

  // the generator, turning on its own
  const gen = new THREE.Group();
  gen.add(at(box(0.95, 0.5, 0.5, mat(80)), 0, 0.25, 0));
  gen.add(at(box(0.97, 0.04, 0.52, mat(120)), 0, 0.51, 0));
  const wheel = new THREE.Group();
  wheel.position.set(0, 0.82, 0.28);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 24), mat(150)));
  for (let k = 0; k < 4; k++) {
    const sp = box(0.54, 0.025, 0.02, mat(116));
    sp.rotation.z = (k * Math.PI) / 4;
    wheel.add(sp);
  }
  gen.add(wheel);
  gen.add(at(box(0.06, 0.34, 0.06, mat(96)), 0, 0.66, 0.24));
  gen.position.set(-2.0, 0, -2.0);
  scene.add(gen);

  // the master's clockwork, right in front of my knees
  const clock = new THREE.Group();
  clock.add(at(box(0.9, 0.7, 0.5, mat(78)), 0, 0.35, 0));
  clock.add(at(box(0.92, 0.04, 0.52, mat(120)), 0, 0.7, 0));
  const spring = new THREE.Group();
  for (let i = 0; i < 6; i++) spring.add(new THREE.Mesh(new THREE.TorusGeometry(0.05 + i * 0.04, 0.009, 4, 22), mat(176)));
  spring.position.set(0, 0.36, 0.26);
  clock.add(spring);
  clock.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.29, 22), mat(36)), 0, 0.36, 0.252));
  const key = new THREE.Group();
  key.add(at(box(0.05, 0.18, 0.05, mat(130)), 0, 0.09, 0));
  key.add(at(box(0.3, 0.05, 0.05, mat(170)), 0, 0.18, 0));
  key.position.set(0, 0.72, 0);
  clock.add(key);
  clock.position.set(0, 0, -0.6);
  scene.add(clock);

  // the bench and the jar, and the tube from my head across the ceiling to it
  const bench = new THREE.Group();
  bench.add(at(box(1.6, 0.07, 0.6, mat(96)), 0, 0.9, 0));
  for (const x of [-0.72, 0.72]) bench.add(at(box(0.07, 0.9, 0.5, mat(72)), x, 0.45, 0));
  bench.position.set(2.0, 0, -1.6);
  scene.add(bench);
  const JAR_H = 0.4;
  const jar = new THREE.Group();
  const glassMat = new THREE.MeshLambertMaterial({ color: grey(210), transparent: true, opacity: 0.25, side: THREE.DoubleSide });
  jar.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, JAR_H, 18, 1, true), glassMat), 0, JAR_H / 2, 0));
  jar.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 18), mat(90)), 0, JAR_H + 0.025, 0));
  for (let i = 1; i < 10; i++) jar.add(at(box(i % 5 ? 0.04 : 0.07, 0.008, 0.01, mat(220)), 0.09, (JAR_H * i) / 10, 0.155));
  const gas = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 1, 18), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }));
  jar.add(gas);
  jar.position.set(2.0, 0.935, -1.5);
  scene.add(jar);
  const tubePts = [
    [0, 4, 1.5],
    [0, 2.7, 1.5],
    [0, 2.7, -1.5],
    [2.0, 2.7, -1.5],
    [2.0, 0.935 + JAR_H + 0.05, -1.5],
  ];
  const tubeMat = mat(150);
  for (let i = 0; i < tubePts.length - 1; i++) {
    const a = new THREE.Vector3(...tubePts[i]);
    const b = new THREE.Vector3(...tubePts[i + 1]);
    const len = a.distanceTo(b);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), tubeMat);
    t.position.copy(a).add(b).multiplyScalar(0.5);
    t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    scene.add(t);
  }
  function tubeAt(u) {
    const lens = [];
    let total = 0;
    for (let i = 0; i < tubePts.length - 1; i++) {
      const l = Math.hypot(...tubePts[i + 1].map((v, j) => v - tubePts[i][j]));
      lens.push(l);
      total += l;
    }
    let d = u * total;
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i]) return tubePts[i].map((v, j) => v + (tubePts[i + 1][j] - v) * (d / lens[i]));
      d -= lens[i];
    }
    return tubePts[tubePts.length - 1];
  }

  // my forearms strapped to the armrests, close in front of me
  const hands = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.add(at(box(1.5, 0.1, 0.22, mat(96)), side * 0.3, -0.1, 0));
    const arm = box(1.4, 0.24, 0.24, mat(118));
    arm.position.set(side * 0.35, 0.08, 0);
    g.add(arm);
    const strap = box(0.16, 0.28, 0.28, mat(40));
    strap.position.set(-side * 0.25, 0.08, 0);
    g.add(strap);
    const hand = box(0.26, 0.2, 0.22, mat(190));
    hand.position.set(-side * 0.48, 0.08, 0);
    g.add(hand);
    g.position.set(side * 1.75, -0.05, 2.4);
    g.rotation.z = side * 0.3;
    g.scale.setScalar(1.35);
    scene.add(g);
    hands.push({ g, hand, side });
  }

  // things on the lens: my blood and my tears, close to the camera so they sit over everything
  const SCREEN_Z = 8;
  const screenW = 2 * (CAM.z - SCREEN_Z) * Math.tan(THREE.MathUtils.degToRad(15 / 2)) * (W / H);
  const screenH = screenW * (H / W);
  const blood = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.002, 0.006) });
  const bloodDark = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.09, 0.0, 0.003) });
  const splatGeo = new THREE.CircleGeometry(1, 7);
  const splats = new THREE.Group();
  scene.add(splats);
  // blood running down into my eyes, from the top of the world
  const veilCanvas = document.createElement("canvas");
  veilCanvas.width = 4;
  veilCanvas.height = 64;
  const vctx = veilCanvas.getContext("2d");
  const grad = vctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  vctx.fillStyle = grad;
  vctx.fillRect(0, 0, 4, 64);
  const veilTex = new THREE.CanvasTexture(veilCanvas);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH * 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.0, 0.003), map: veilTex, transparent: true, opacity: 0, depthTest: false }));
  veil.position.set(0, CAM.y + screenH * 0.2, SCREEN_Z + 0.5);
  scene.add(veil);
  // grief flooding in at the edges, and tears
  const edges = [];
  const sideCanvas = document.createElement("canvas");
  sideCanvas.width = 64;
  sideCanvas.height = 4;
  const sctx = sideCanvas.getContext("2d");
  const sg = sctx.createLinearGradient(0, 0, 64, 0);
  sg.addColorStop(0, "rgba(255,255,255,1)");
  sg.addColorStop(1, "rgba(255,255,255,0)");
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 64, 4);
  const sideTex = new THREE.CanvasTexture(sideCanvas);
  for (const side of [-1, 1]) {
    // fading in from the edge of my sight
    const e = new THREE.Mesh(new THREE.PlaneGeometry(screenW * 0.32, screenH * 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff, map: sideTex, transparent: true, opacity: 0, depthTest: false }));
    e.position.set(side * screenW * 0.34, CAM.y, SCREEN_Z + 0.4);
    if (side > 0) e.scale.x = -1;
    scene.add(e);
    edges.push(e);
  }
  const tears = [];

  const vivid = (c) => {
    const col = new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);
    const hsl = {};
    col.getHSL(hsl);
    return new THREE.Color().setHSL(hsl.h, 0.85, 0.5);
  };
  const gasBalls = [];
  const gasGeo = new THREE.SphereGeometry(0.04, 6, 4);

  const api = {
    show(v) {
      canvas.classList.toggle("hidden", !v);
    },
    clear() {
      splats.clear();
      for (const t of tears) scene.remove(t);
      tears.length = 0;
      veil.material.opacity = 0;
      for (const e of edges) e.material.opacity = 0;
    },
    update(dt, t, s) {
      // the machines run on their own
      wheel.rotation.z = -s.angle * 3;
      key.rotation.y = s.angle * 0.6;
      spring.rotation.z = -s.angle * 0.4;
      // my hands clench as it goes on
      for (const h of hands) h.hand.scale.set(1 - s.hands * 0.15, 1 + s.hands * 0.1, 1);
      // the jar and the gas
      const col = vivid(s.emotionColor);
      gas.material.color.copy(col);
      const lv = Math.max(0.001, Math.min(1, s.level / 10));
      gas.scale.y = lv * (JAR_H - 0.02);
      gas.position.y = (lv * (JAR_H - 0.02)) / 2 + 0.01;
      gas.visible = s.level > 0.01;
      while (gasBalls.length < s.gas.length) {
        const m = new THREE.Mesh(gasGeo, new THREE.MeshBasicMaterial({ color: col }));
        scene.add(m);
        gasBalls.push(m);
      }
      gasBalls.forEach((m, i) => {
        const g = s.gas[i];
        m.visible = !!g;
        if (!g) return;
        m.material.color.copy(col);
        m.position.set(...tubeAt(g.u));
      });
      // my blood lands on everything I can see, and drips
      if (s.bleeding && Math.random() < dt * 16) {
        const onHand = Math.random() < 0.35;
        const x = onHand ? (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.2) * screenW : (Math.random() - 0.5) * screenW;
        const y = onHand ? CAM.y - screenH * (0.32 + Math.random() * 0.1) : CAM.y + (Math.random() - 0.4) * screenH * 0.9;
        const g = new THREE.Group();
        const r = 0.01 + Math.random() * 0.035;
        const m = new THREE.Mesh(splatGeo, Math.random() < 0.4 ? bloodDark : blood);
        m.scale.setScalar(r);
        g.add(m);
        for (let i = 0; i < 3; i++) {
          const d = new THREE.Mesh(splatGeo, bloodDark);
          const a = Math.random() * Math.PI * 2;
          d.scale.setScalar(r * 0.35);
          d.position.set(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, 0.001);
          g.add(d);
        }
        const drip = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 1), bloodDark);
        drip.scale.y = 0.0001;
        g.add(drip);
        g.userData = { drip, born: t, max: 0.05 + Math.random() * 0.2 };
        g.position.set(x, y, SCREEN_Z + Math.random() * 0.1);
        splats.add(g);
      }
      for (const g of splats.children) {
        const len = Math.min(g.userData.max, (t - g.userData.born) * 0.12);
        g.userData.drip.scale.y = Math.max(0.0001, len);
        g.userData.drip.position.y = -len / 2;
      }
      veil.material.opacity = Math.min(0.97, s.blood);
      // grief at the edges and pouring down
      for (const e of edges) {
        e.material.color.copy(col);
        e.material.opacity = s.flood ? s.flood * (0.7 + Math.sin(t * 5) * 0.15) : 0;
      }
      if (s.flood && Math.random() < dt * 30) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.05 + Math.random() * 0.12), new THREE.MeshBasicMaterial({ color: col, depthTest: false }));
        m.position.set((Math.random() - 0.5) * screenW * 0.9, CAM.y + screenH * 0.55, SCREEN_Z + 0.3);
        m.userData.v = 0.4 + Math.random() * 0.6;
        scene.add(m);
        tears.push(m);
      }
      for (let i = tears.length - 1; i >= 0; i--) {
        tears[i].position.y -= tears[i].userData.v * dt;
        if (tears[i].position.y < CAM.y - screenH * 0.6) {
          scene.remove(tears[i]);
          tears.splice(i, 1);
        }
      }
      // shaking in the straps, and the lamp flickering while it runs
      const sh = s.shake || 0;
      camera.position.set(CAM.x + (Math.random() - 0.5) * 0.12 * sh, CAM.y + (Math.random() - 0.5) * 0.08 * sh, CAM.z);
      camera.lookAt(camera.position.x, CAM.y - 0.05, 0);
      lamp.intensity = 6 * (s.running ? 0.7 + Math.random() * 0.5 : 1);
    },
    render() {
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(post, postCam);
    },
  };
  return api;
}
