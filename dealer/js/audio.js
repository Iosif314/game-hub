// Small table noises, all made here: a card flicked off the shoe, chips, the riffle of a shuffle,
// a metronome tick for the false shuffle, and a heartbeat that grows as suspicion does.

let ac = null;
let out = null;
let noise = null;
let heart = null;

export function startAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  out = ac.createGain();
  out.gain.value = 0.7;
  out.connect(ac.destination);
  const len = ac.sampleRate;
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  heart = { level: 0, next: 0 };
}

const t0 = () => ac.currentTime;

function burst(at, dur, freq, q, gain) {
  const n = ac.createBufferSource();
  n.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  n.connect(f).connect(g).connect(out);
  n.start(at, Math.random() * 0.5);
  n.stop(at + dur + 0.02);
}

function tone(at, freq, dur, gain, type = "sine") {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export const sfx = {
  card() {
    if (!ac) return;
    burst(t0(), 0.06, 3200, 0.8, 0.35);
  },
  chips(n = 3) {
    if (!ac) return;
    for (let i = 0; i < n; i++) {
      const at = t0() + i * 0.045 + Math.random() * 0.02;
      tone(at, 2400 + Math.random() * 900, 0.05, 0.08, "triangle");
      burst(at, 0.03, 5000, 2, 0.12);
    }
  },
  shuffle() {
    if (!ac) return;
    for (let i = 0; i < 26; i++) burst(t0() + i * 0.022, 0.02, 2600 + Math.random() * 1500, 1, 0.15);
  },
  tick(strong) {
    if (!ac) return;
    tone(t0(), strong ? 1300 : 900, 0.05, 0.12, "square");
  },
  good() {
    if (!ac) return;
    tone(t0(), 660, 0.08, 0.08);
    tone(t0() + 0.06, 990, 0.1, 0.06);
  },
  bad() {
    if (!ac) return;
    tone(t0(), 140, 0.25, 0.25, "sawtooth");
    burst(t0(), 0.2, 400, 1, 0.3);
  },
  click() {
    if (!ac) return;
    tone(t0(), 1800, 0.02, 0.05, "square");
  },
  // call every frame with 0..1; beats come faster and louder as it rises
  heartbeat(level, time) {
    if (!ac || level < 0.45) return;
    if (time < heart.next) return;
    const k = (level - 0.45) / 0.55;
    heart.next = time + 1.1 - k * 0.55;
    const at = t0();
    tone(at, 55, 0.12, 0.25 * k + 0.08);
    tone(at + 0.16, 50, 0.1, 0.18 * k + 0.05);
  },
};
