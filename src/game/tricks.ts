// ---------------------------------------------------------------------------
// SKATE TRICK BOOK, adapted for a hover sword.
//
// BOARD TRICKS: the sword flips / spins UNDER the rider while the rider's
// feet pop off and catch it again (the body keeps its own attitude).
//   roll  = turns around the sword's long axis   (kickflip / heelflip)
//   yaw   = flat turns under the feet             (shove-it / helicopter)
//   pitch = end-over-end turns                    (impossible)
//
// GRABS: signature skate poses. The rider pulls the sword up and holds a
// specific edge; each grab has its own full-body pose (see model.ts).
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;

export interface BoardTrickDef {
  id: string;
  name: string;
  key: string;
  keyLabel: string;
  roll: number;
  yaw: number;
  pitch: number;
  /** pivot along the sword (m, relative to the board centre); impossible wraps around the back foot */
  pivotZ: number;
  dur: number;
  pts: number;
  desc: string;
}

export const BOARD_TRICKS: BoardTrickDef[] = [
  { id: 'kickflip', name: 'KICKFLIP', key: 'KeyJ', keyLabel: 'J', roll: -1, yaw: 0, pitch: 0, pivotZ: 0, dur: 0.5, pts: 260, desc: 'pedang berputar di sumbu panjang ke sisi tumit' },
  { id: 'heelflip', name: 'HEELFLIP', key: 'KeyK', keyLabel: 'K', roll: 1, yaw: 0, pitch: 0, pivotZ: 0, dur: 0.5, pts: 260, desc: 'pedang berputar di sumbu panjang ke sisi jari' },
  { id: 'tre', name: 'TRE FLIP', key: 'KeyL', keyLabel: 'L', roll: -1, yaw: 1, pitch: 0, pivotZ: 0, dur: 0.62, pts: 520, desc: 'kickflip + 360 shove-it sekaligus' },
  { id: 'shuv', name: '360 SHOVE-IT', key: 'KeyI', keyLabel: 'I', roll: 0, yaw: 1, pitch: 0, pivotZ: 0, dur: 0.55, pts: 300, desc: 'pedang berputar datar 360° di bawah kaki' },
  { id: 'impossible', name: 'IMPOSSIBLE', key: 'KeyU', keyLabel: 'U', roll: 0, yaw: 0, pitch: -1, pivotZ: -0.4, dur: 0.6, pts: 480, desc: 'pedang melingkar ujung-ke-ujung di kaki belakang' },
  { id: 'laser', name: 'LASER FLIP', key: 'KeyO', keyLabel: 'O', roll: 1, yaw: -1, pitch: 0, pivotZ: 0, dur: 0.62, pts: 560, desc: 'heelflip + frontside 360 shove-it' },
  { id: 'double', name: 'DOUBLE KICKFLIP', key: 'KeyM', keyLabel: 'M', roll: -2, yaw: 0, pitch: 0, pivotZ: 0, dur: 0.72, pts: 480, desc: 'dua putaran kickflip' },
  { id: 'hardflip', name: 'HARDFLIP', key: 'Comma', keyLabel: ',', roll: -1, yaw: 0, pitch: -1, pivotZ: 0, dur: 0.66, pts: 580, desc: 'kickflip sambil pedang berputar vertikal' },
  { id: 'heli', name: 'SWORD HELICOPTER', key: 'KeyN', keyLabel: 'N', roll: 0, yaw: 2, pitch: 0, pivotZ: 0, dur: 0.72, pts: 440, desc: 'pedang berputar 720° seperti baling-baling' },
];

export interface GrabDef {
  id: string;
  name: string;
  key: string;
  keyLabel: string;
  pts: number;
  desc: string;
}

export const GRABS: GrabDef[] = [
  { id: 'indy', name: 'INDY', key: 'KeyZ', keyLabel: 'Z', pts: 180, desc: 'tangan belakang pegang sisi jari, lutut ditekuk' },
  { id: 'method', name: 'METHOD', key: 'KeyX', keyLabel: 'X', pts: 260, desc: 'pedang ditarik ke belakang punggung, badan melengkung' },
  { id: 'melon', name: 'MELON', key: 'KeyC', keyLabel: 'C', pts: 180, desc: 'tangan depan pegang sisi tumit' },
  { id: 'stalefish', name: 'STALEFISH', key: 'KeyV', keyLabel: 'V', pts: 220, desc: 'tangan belakang dari balik kaki pegang sisi tumit' },
  { id: 'superman', name: 'SUPERMAN', key: 'KeyB', keyLabel: 'B', pts: 380, desc: 'pegang pedang di depan, tubuh terbang lurus' },
  { id: 'christ', name: 'CHRIST AIR', key: 'KeyG', keyLabel: 'G', pts: 320, desc: 'lengan terbentang, tubuh melengkung anggun' },
  { id: 'nose', name: 'NOSE GRAB', key: 'KeyY', keyLabel: 'Y', pts: 200, desc: 'ujung pedang diangkat & dipegang' },
  { id: 'tail', name: 'TAIL GRAB', key: 'KeyH', keyLabel: 'H', pts: 200, desc: 'gagang pedang dipegang, ujung menunduk' },
  { id: 'japan', name: 'JAPAN AIR', key: 'KeyQ', keyLabel: 'Q', pts: 280, desc: 'lutut depan menekuk dalam, pedang ditarik ke atas' },
];

export function grabName(id: string | null): string {
  if (!id) return '';
  const g = GRABS.find((x) => x.id === id);
  return g ? g.name : id.toUpperCase();
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Plays board tricks. Progress p runs 0..1 with a "flick & catch" ease:
 * slow pop, fast spin in the middle, slow catch at the end. With smart landing
 * on, the flip speeds up so it is always caught before touchdown.
 */
export class BoardTrickPlayer {
  def: BoardTrickDef | null = null;
  p = 0;
  queued: BoardTrickDef | null = null;
  chained = false;
  done: string[] = [];
  pts = 0;
  roll = 0;
  yaw = 0;
  pitch = 0;
  pivotZ = 0;

  get active() {
    return this.def !== null;
  }

  reset() {
    this.def = null;
    this.p = 0;
    this.queued = null;
    this.chained = false;
    this.done = [];
    this.pts = 0;
    this.roll = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.pivotZ = 0;
  }

  /** start a trick; while one is finishing, the next one is queued (chain) */
  start(d: BoardTrickDef): boolean {
    if (!this.def) {
      this.def = d;
      this.p = 0;
      this.chained = false;
      return true;
    }
    if (this.p > 0.5 && !this.queued) {
      this.queued = d;
      return true;
    }
    return false;
  }

  update(dt: number, ttl: number, margin: number, speed: number, smart: boolean) {
    if (!this.def) {
      this.roll = this.yaw = this.pitch = this.pivotZ = 0;
      return;
    }
    let rate = Math.max(0.3, speed) / this.def.dur;
    // Auto catch saat mendekati pendaratan: putaran dipercepat agar papan tertangkap rata sebelum mendarat
    if (smart || ttl < 0.55) {
      const rem = Math.max(0.04, ttl - Math.max(0.06, margin * 0.5));
      rate = Math.max(rate, (1 - this.p) / rem);
    }
    rate = Math.min(rate, 24);
    this.p += rate * dt;
    // Trik selesai sebelum menyentuh tanah (< 0.08 detik)
    if (this.p >= 1 || ttl <= 0.07) {
      this.done.push(this.def.name);
      this.pts += this.def.pts;
      this.def = this.queued;
      this.queued = null;
      this.p = 0;
      this.chained = this.def !== null;
    }
    if (this.def) {
      const p = clamp(this.p, 0, 1);
      const e = p - Math.sin(TAU * p) / TAU;
      this.roll = this.def.roll * TAU * e;
      this.yaw = this.def.yaw * TAU * e;
      this.pitch = this.def.pitch * TAU * e;
      this.pivotZ = this.def.pivotZ;
    } else {
      this.roll = this.yaw = this.pitch = this.pivotZ = 0;
    }
  }

  /** how far the feet are lifted off the sword (0..1) */
  feetLift(): number {
    if (!this.def) return 0;
    const up = this.chained ? 1 : smoothstep(0, 0.12, this.p);
    const down = this.queued ? 0 : smoothstep(0.78, 0.97, this.p);
    return up * (1 - down);
  }

  /** landing with the sword mid-flip = not caught */
  caught(): boolean {
    return !this.def || this.p < 0.04 || this.p > 0.85;
  }

  currentName(): string | null {
    return this.def ? this.def.name : null;
  }
}
