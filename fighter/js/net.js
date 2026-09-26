import { step } from "./sim.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
const API_BASE = LOCAL_HOSTS.includes(location.hostname)
  ? "http://localhost:8795/fighter"
  : "https://interrogation-room-rqxc.onrender.com/fighter";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

async function api(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Signaling is a single offer/answer exchange, so wait for ICE gathering to finish
// instead of trickling candidates through the server.
async function gatherIce(pc) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise((resolve) => {
    const done = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      }
    };
    const timer = setTimeout(resolve, 4000);
    pc.addEventListener("icegatheringstatechange", done);
  });
}

class Connection {
  constructor(pc) {
    this.pc = pc;
    // negotiated channels exist on both sides without an ondatachannel handshake
    this.game = pc.createDataChannel("game", { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
    this.ctrl = pc.createDataChannel("ctrl", { negotiated: true, id: 1, ordered: true });
    this.onGame = null;
    this.onCtrl = null;
    this.onClose = null;
    this.closed = false;
    this.game.onmessage = (e) => this.onGame && this.onGame(JSON.parse(e.data));
    this.ctrl.onmessage = (e) => this.onCtrl && this.onCtrl(JSON.parse(e.data));
    const lost = () => this.handleClose();
    this.game.onclose = lost;
    this.ctrl.onclose = lost;
    pc.addEventListener("connectionstatechange", () => {
      const st = pc.connectionState;
      if (st === "failed" || st === "closed") this.handleClose();
      if (st === "disconnected") {
        setTimeout(() => {
          if (pc.connectionState === "disconnected") this.handleClose();
        }, 4000);
      }
    });
  }

  opened(timeoutMs = 20000) {
    const ready = () => this.game.readyState === "open" && this.ctrl.readyState === "open";
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("연결에 실패했어요. 네트워크 환경(방화벽/공유기) 때문에 직접 연결이 막혔을 수 있어요.")), timeoutMs);
      const check = () => {
        if (ready()) {
          clearTimeout(timer);
          resolve();
        }
      };
      this.game.addEventListener("open", check);
      this.ctrl.addEventListener("open", check);
    });
  }

  sendGame(msg) {
    if (this.game.readyState === "open") this.game.send(JSON.stringify(msg));
  }

  sendCtrl(msg) {
    if (this.ctrl.readyState === "open") this.ctrl.send(JSON.stringify(msg));
  }

  handleClose() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.pc.close();
    } catch (e) {
      // already closed
    }
    if (this.onClose) this.onClose();
  }

  close() {
    this.onClose = null;
    this.handleClose();
  }
}

export async function hostRoom({ onCode, isCancelled }) {
  const pc = new RTCPeerConnection(ICE);
  const conn = new Connection(pc);
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await gatherIce(pc);
    const { code } = await api("/api/room/create", { offer: pc.localDescription.sdp });
    onCode(code);
    let answer = null;
    while (!answer) {
      if (isCancelled()) throw new Error("cancelled");
      await sleep(1200);
      if (isCancelled()) throw new Error("cancelled");
      ({ answer } = await api("/api/room/poll", { code }));
    }
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    await conn.opened();
    return conn;
  } catch (e) {
    conn.close();
    throw e;
  }
}

export async function joinRoom(code) {
  const { offer } = await api("/api/room/join", { code });
  const pc = new RTCPeerConnection(ICE);
  const conn = new Connection(pc);
  try {
    await pc.setRemoteDescription({ type: "offer", sdp: offer });
    await pc.setLocalDescription(await pc.createAnswer());
    await gatherIce(pc);
    await api("/api/room/answer", { code, answer: pc.localDescription.sdp });
    await conn.opened();
    return conn;
  } catch (e) {
    conn.close();
    throw e;
  }
}

// Rollback netcode: advance immediately using a predicted remote input, and when the
// real input arrives and differs, rewind to that frame and re-simulate forward.
export class RollbackSession {
  constructor({ localIndex, initialState, send, inputDelay = 2, maxRollback = 8 }) {
    this.localIndex = localIndex;
    this.state = initialState;
    this.frame = 0;
    this.send = send;
    this.inputDelay = inputDelay;
    this.maxRollback = maxRollback;
    this.local = [];
    this.remote = [];
    this.predicted = [];
    for (let f = 0; f < inputDelay; f++) {
      this.local[f] = 0;
      this.remote[f] = 0;
    }
    this.confirmedRemote = inputDelay - 1;
    this.remoteAck = inputDelay - 1;
    this.snapshots = new Map();
    this.rollbackFrom = Infinity;
    this.remoteFrame = 0;
    this.remoteAdv = 0;
    this.advSamples = [];
    this.skipCooldown = 0;
    this.stalledTicks = 0;
    this.rollbacks = 0;
  }

  // An input is final once sent, so only the first sample for a frame is kept.
  setLocalInput(input) {
    const f = this.frame + this.inputDelay;
    if (this.local[f] === undefined) this.local[f] = input;
  }

  sendInputs() {
    const last = this.frame + this.inputDelay;
    // Resend everything the peer hasn't acknowledged; dropping any frame would stall them forever.
    const start = this.remoteAck + 1;
    const d = [];
    for (let f = start; f <= last; f++) d.push(this.local[f] ?? 0);
    this.send({ t: "i", s: start, d, f: this.frame, a: this.confirmedRemote, v: this.frame - this.remoteFrame });
  }

  receive(msg) {
    if (msg.t !== "i") return;
    if (msg.a > this.remoteAck) this.remoteAck = msg.a;
    if (msg.f > this.remoteFrame) this.remoteFrame = msg.f;
    this.remoteAdv = msg.v;
    for (let k = 0; k < msg.d.length; k++) {
      const f = msg.s + k;
      if (this.remote[f] !== undefined) continue;
      this.remote[f] = msg.d[k];
      if (f < this.frame && this.predicted[f] !== msg.d[k]) this.rollbackFrom = Math.min(this.rollbackFrom, f);
    }
    while (this.remote[this.confirmedRemote + 1] !== undefined) this.confirmedRemote++;
    this.advSamples.push(this.frame - this.remoteFrame - this.remoteAdv);
    if (this.advSamples.length > 30) this.advSamples.shift();
  }

  simulate(f) {
    const remoteIn = this.remote[f] !== undefined ? this.remote[f] : this.remote[this.confirmedRemote] ?? 0;
    this.predicted[f] = remoteIn;
    const localIn = this.local[f] ?? 0;
    step(this.state, this.localIndex === 0 ? [localIn, remoteIn] : [remoteIn, localIn]);
  }

  advance() {
    if (this.rollbackFrom < this.frame) {
      const snap = this.snapshots.get(this.rollbackFrom);
      if (snap) {
        this.rollbacks++;
        this.state = structuredClone(snap);
        for (let f = this.rollbackFrom; f < this.frame; f++) {
          if (f !== this.rollbackFrom) this.snapshots.set(f, structuredClone(this.state));
          this.simulate(f);
        }
      }
    }
    this.rollbackFrom = Infinity;

    if (this.frame - this.confirmedRemote > this.maxRollback) {
      this.stalledTicks++;
      return false;
    }
    this.stalledTicks = 0;

    // If we're consistently ahead of the peer, idle a frame so they can catch up.
    if (this.skipCooldown > 0) {
      this.skipCooldown--;
    } else if (this.advSamples.length >= 10) {
      const avg = this.advSamples.reduce((a, b) => a + b, 0) / this.advSamples.length;
      if (avg > 2) {
        this.skipCooldown = 20;
        return false;
      }
    }

    this.snapshots.set(this.frame, structuredClone(this.state));
    this.simulate(this.frame);
    this.frame++;
    for (const k of this.snapshots.keys()) if (k < this.confirmedRemote) this.snapshots.delete(k);
    return true;
  }
}
