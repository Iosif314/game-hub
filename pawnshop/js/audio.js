// All the sound is made here, nothing is recorded: the generator's hum, a throat that screams,
// wails and laughs, and a few small noises of the shop.

let ac = null;
let out = null;
let noise = null;

export function startAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 6;
  out = ac.createGain();
  out.gain.value = 0.75;
  out.connect(comp);
  comp.connect(ac.destination);
  const len = ac.sampleRate * 2;
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

const now = () => (ac ? ac.currentTime : 0);

function noiseSource() {
  const n = ac.createBufferSource();
  n.buffer = noise;
  n.loop = true;
  return n;
}

// the hand generator: a low electric hum that rises with the cranking
export function createGenerator() {
  if (!ac) return { set() {}, cut() {} };
  const g = ac.createGain();
  g.gain.value = 0;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const a = ac.createOscillator();
  a.type = "sawtooth";
  const b = ac.createOscillator();
  b.type = "square";
  a.frequency.value = 48;
  b.frequency.value = 96.5;
  const bg = ac.createGain();
  bg.gain.value = 0.25;
  a.connect(lp);
  b.connect(bg).connect(lp);
  lp.connect(g).connect(out);
  a.start();
  b.start();
  return {
    set(speed) {
      const t = now();
      g.gain.setTargetAtTime(speed * 0.22, t, 0.05);
      a.frequency.setTargetAtTime(40 + speed * 36, t, 0.08);
      b.frequency.setTargetAtTime(81 + speed * 72, t, 0.08);
    },
    cut() {
      g.gain.cancelScheduledValues(now());
      g.gain.setValueAtTime(0, now());
    },
  };
}

// a throat: a buzzing source through a few vowel formants, roughened by distortion
export function createVoice() {
  if (!ac) return { set() {}, cut() {} };
  const src = ac.createOscillator();
  src.type = "sawtooth";
  const vib = ac.createOscillator();
  vib.frequency.value = 6;
  const vibAmt = ac.createGain();
  vibAmt.gain.value = 0;
  vib.connect(vibAmt).connect(src.frequency);
  const breath = noiseSource();
  const breathG = ac.createGain();
  breathG.gain.value = 0.15;
  const shaper = ac.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(x * 3);
  }
  shaper.curve = curve;
  const pre = ac.createGain();
  pre.gain.value = 1;
  src.connect(pre);
  breath.connect(breathG).connect(pre);
  pre.connect(shaper);
  const mix = ac.createGain();
  mix.gain.value = 0;
  const forms = [800, 1250, 2600].map((f, i) => {
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = 6;
    const fg = ac.createGain();
    fg.gain.value = [1, 0.7, 0.35][i];
    shaper.connect(bp).connect(fg).connect(mix);
    return bp;
  });
  mix.connect(out);
  src.start();
  vib.start();
  breath.start();
  return {
    // f0: pitch, loud: 0..1, vowel: 0 = "o" (low formants) .. 1 = "a" (open, screaming),
    // rough: how much breath and grit, wobble: vibrato depth in Hz
    set({ f0 = 300, loud = 0, vowel = 1, rough = 0.2, wobble = 0 }) {
      const t = now();
      src.frequency.setTargetAtTime(f0, t, 0.02);
      mix.gain.setTargetAtTime(loud * 0.5, t, 0.02);
      breathG.gain.setTargetAtTime(0.05 + rough * 0.6, t, 0.03);
      pre.gain.setTargetAtTime(1 + rough * 4, t, 0.03);
      vibAmt.gain.setTargetAtTime(wobble, t, 0.05);
      const f1 = 450 + vowel * 400;
      const f2 = 850 + vowel * 450;
      forms[0].frequency.setTargetAtTime(f1, t, 0.04);
      forms[1].frequency.setTargetAtTime(f2, t, 0.04);
    },
    // silence at once: the moment the cranking stops
    cut() {
      mix.gain.cancelScheduledValues(now());
      mix.gain.setValueAtTime(0, now());
    },
  };
}

function ping(freq, dur, vol = 0.2, type = "sine", when = 0) {
  if (!ac) return;
  const t = now() + when;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function burst(dur, freq, q, vol, when = 0) {
  if (!ac) return;
  const t = now() + when;
  const n = noiseSource();
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(bp).connect(g).connect(out);
  n.start(t);
  n.stop(t + dur + 0.05);
}

export const sfx = {
  bell() {
    ping(1320, 1.2, 0.12);
    ping(1980, 0.9, 0.06, "sine", 0.02);
  },
  coins(n = 3) {
    for (let i = 0; i < n; i++) ping(2600 + Math.random() * 900, 0.15, 0.08, "triangle", i * 0.07);
  },
  click() {
    burst(0.03, 3000, 2, 0.15);
  },
  crankTick() {
    burst(0.02, 1800, 4, 0.1);
  },
  strap() {
    burst(0.12, 600, 3, 0.25);
    burst(0.08, 900, 3, 0.15, 0.1);
  },
  scrub() {
    burst(0.09, 2200 + Math.random() * 800, 1.5, 0.12);
  },
  glass() {
    ping(3100, 0.25, 0.06);
    ping(4700, 0.18, 0.03, "sine", 0.01);
  },
  paper() {
    burst(0.18, 4000, 0.8, 0.08);
  },
  steps() {
    for (let i = 0; i < 4; i++) burst(0.06, 220 + Math.random() * 60, 2.5, 0.35, i * 0.32);
  },
  knock() {
    burst(0.07, 180, 2, 0.6);
    burst(0.07, 180, 2, 0.6, 0.22);
    burst(0.07, 180, 2, 0.6, 0.44);
  },
};
