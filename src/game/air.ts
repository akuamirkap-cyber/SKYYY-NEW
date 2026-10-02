// ---------------------------------------------------------------------------
// AIR SYSTEM: momentum freestyle with a SMART ROTATION PLANNER,
// skate board tricks and styled grabs.
//
// Body rotations
//   • hold jump in the air  -> backflip       • S / E / F -> auto freestyle
//   • A / D                 -> spin
// Board tricks (the sword flips under the feet, see tricks.ts)
// Grabs (hold a grab key or SHIFT, see tricks.ts)
//
// Smart landing: from a trajectory prediction we know the seconds left before
// touchdown. Every rotation axis keeps a whole-turn TARGET; we accelerate to
// finish it, or unwind back to upright if it can't be reached. Board flips
// speed up so they are always caught in time.
// ---------------------------------------------------------------------------

import { BoardTrickPlayer, GRABS, grabName } from './tricks';

export const TAU = Math.PI * 2;

export interface AirTune {
  flipSpeed: number;
  spin: number;
  landAssist: number;
  landWindow: number;
  floaty: number;
  airJumps: number;
  smart: boolean;
  ambition: number;
  margin: number;
}

export interface AirInput {
  flip: number; // +1 back, -1 front, 0 none
  steer: number; // -1..1
  grab: boolean;
  grabType: string;
}

export type LandQuality = 'perfect' | 'clean' | 'sketchy' | 'none';
export type PlanMode = 'none' | 'build' | 'finish' | 'unwind';

export interface LandResult {
  quality: LandQuality;
  flips: number;
  front: boolean;
  spins: number;
  grab: number;
  grabs: number;
  boardTricks: number;
  airJumps: number;
  airTime: number;
  error: number;
  name: string;
  points: number;
  bail: 'board' | 'rotation' | null;
}

export function uprightError(a: number): number {
  const m = ((a % TAU) + TAU) % TAU;
  return Math.min(m, TAU - m);
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

export class AirSystem {
  flip = 0;
  flipVel = 0;
  spin = 0;
  spinVel = 0;
  grabT = 0;
  grabW = 0;
  airTime = 0;
  airJumpsLeft = 0;
  airJumpsUsed = 0;
  maxFlipAbs = 0;

  // ---- skate tricks
  board = new BoardTrickPlayer();
  grabNames: string[] = [];
  curGrab: string | null = null;
  private curGrabT = 0;
  /** grab pose currently shown (kept while it fades out) */
  poseId: string | null = null;

  // chain across multiple jumps
  chain = 0;
  chainTimer = 0;
  chainPoints = 0;

  // ---- auto freestyle
  autoFlip = 0;
  autoSpin = 0;
  autoGrab = false;
  autoGrabType = 'indy';
  autoActive = false;
  plan: PlanMode = 'none';
  private flipT = 0;
  private flipHas = false;
  private spinT = 0;
  private spinHas = false;

  takeoff(t: AirTune) {
    this.flip = 0;
    this.flipVel = 0;
    this.spin = 0;
    this.spinVel = 0;
    this.grabT = 0;
    this.airTime = 0;
    this.airJumpsLeft = Math.round(t.airJumps);
    this.airJumpsUsed = 0;
    this.maxFlipAbs = 0;
    this.autoFlip = 0;
    this.autoSpin = 0;
    this.autoGrab = false;
    this.autoActive = false;
    this.flipHas = false;
    this.spinHas = false;
    this.plan = 'none';
    this.board.reset();
    this.grabNames = [];
    this.curGrab = null;
    this.curGrabT = 0;
  }

  startAuto(flipDir: number, spinDir = 0, grab: string | false = false) {
    this.autoActive = true;
    if (flipDir !== 0) {
      if (this.autoFlip !== flipDir) this.flipHas = false;
      this.autoFlip = flipDir;
    }
    if (spinDir !== 0) {
      if (this.autoSpin !== spinDir) this.spinHas = false;
      this.autoSpin = spinDir;
    }
    if (grab) {
      this.autoGrab = true;
      this.autoGrabType = grab;
    }
  }

  gravityMul(vy: number, t: AirTune, tricking: boolean): number {
    const apex = Math.exp(-(vy / 7) * (vy / 7));
    let g = 1 - t.floaty * 0.42 * apex;
    if (tricking) g *= 0.9;
    return Math.max(0.25, g);
  }

  // ------------------------------------------------------------ planner
  private planAxis(angle: number, want: number, has: boolean, target: number, tRem: number, maxW: number, amb: number) {
    if (!has) target = Math.round(angle / TAU) * TAU;
    const reachW = maxW * 1.7;
    if (want !== 0) {
      if ((target - angle) * want < 0.4) {
        const base = want > 0 ? Math.ceil((angle + 0.4) / TAU) : Math.floor((angle - 0.4) / TAU);
        target = base * TAU;
      }
      const easy = maxW * (0.4 + 0.5 * clamp(amb, 0, 1));
      for (let i = 0; i < 5; i++) {
        const next = target + want * TAU;
        if (Math.abs(next - angle) / tRem <= easy) target = next;
        else break;
      }
    }
    for (let i = 0; i < 6; i++) {
      if (Math.abs(target - angle) / tRem <= reachW) break;
      const nt = target - Math.sign(target - angle) * TAU;
      if (Math.abs(nt - angle) >= Math.abs(target - angle)) break;
      target = nt;
    }
    return target;
  }

  private driveAxis(angle: number, vel: number, target: number, tRem: number, dt: number, maxW: number) {
    const need = clamp((target - angle) / tRem, -maxW * 1.8, maxW * 1.8);
    const urgency = 1 - Math.min(1, tRem / 0.7);
    const k = 5 + 14 * urgency;
    return vel + (need - vel) * (1 - Math.exp(-dt * k));
  }

  update(dt: number, inp: AirInput, t: AirTune, timeToLand: number) {
    this.airTime += dt;
    const maxF = 7.4 * t.flipSpeed;
    const maxS = 7.2 * t.spin;
    const tRem = Math.max(0.04, timeToLand - t.margin);

    // Saat mendekati pendaratan (< 0.42 detik), abaikan input baru & prioritaskan auto-alignment mendarat tegak lurus
    const isLandingApproach = timeToLand < 0.44;

    if (inp.flip !== 0 && this.autoFlip !== 0 && inp.flip !== this.autoFlip) {
      this.autoFlip = inp.flip;
      this.flipHas = false;
    }
    const steerDir = Math.abs(inp.steer) > 0.3 ? Math.sign(inp.steer) : 0;
    if (steerDir !== 0 && this.autoSpin !== 0 && steerDir !== this.autoSpin) {
      this.autoSpin = steerDir;
      this.spinHas = false;
    }

    // Jika mendekati tanah, hentikan dorongan rotasi baru agar papan auto-ngepas
    const wantF = isLandingApproach ? 0 : inp.flip !== 0 ? inp.flip : this.autoFlip;
    const wantS = isLandingApproach ? 0 : steerDir !== 0 ? steerDir : this.autoSpin;

    if (t.smart) {
      this.flipT = this.planAxis(this.flip, wantF, this.flipHas, this.flipT, tRem, maxF, t.ambition);
      this.flipHas = true;
      this.flipVel = this.driveAxis(this.flip, this.flipVel, this.flipT, tRem, dt, maxF);
      this.flip += this.flipVel * dt;
      this.spinT = this.planAxis(this.spin, wantS, this.spinHas, this.spinT, tRem, maxS, t.ambition * 0.8);
      this.spinHas = true;
      this.spinVel = this.driveAxis(this.spin, this.spinVel, this.spinT, tRem, dt, maxS);
      this.spin += this.spinVel * dt;

      // Auto-align tegas saat detik-detik menjelang mendarat: skate otomatis 100% pas tegak & tidak kebalik
      if (timeToLand < 0.22) {
        const targetFlip = Math.round(this.flip / TAU) * TAU;
        const targetSpin = Math.round(this.spin / TAU) * TAU;
        const urgency = clamp(1 - timeToLand / 0.22, 0, 1);
        const k = 1 - Math.exp(-dt * (18 + urgency * 30));
        this.flip += (targetFlip - this.flip) * k;
        this.spin += (targetSpin - this.spin) * k;
        this.flipVel *= Math.exp(-dt * 14);
        this.spinVel *= Math.exp(-dt * 14);
      }
      const dF = Math.abs(this.flipT - this.flip);
      const dS = Math.abs(this.spinT - this.spin);
      if (wantF !== 0 || wantS !== 0 || this.board.active) this.plan = 'build';
      else if (Math.abs(this.flipT) + 0.01 < Math.abs(this.flip) || Math.abs(this.spinT) + 0.01 < Math.abs(this.spin))
        this.plan = 'unwind';
      else if (dF > 0.05 || dS > 0.05) this.plan = 'finish';
      else this.plan = 'none';
    } else {
      if (wantF !== 0) {
        const rev = Math.sign(this.flipVel) !== wantF && this.flipVel !== 0 ? 1.8 : 1;
        this.flipVel += wantF * 15 * t.flipSpeed * rev * dt;
        this.flipVel = clamp(this.flipVel, -maxF, maxF);
      } else {
        this.flipVel *= Math.exp(-dt * 4.2);
      }
      this.flip += this.flipVel * dt;
      if (wantS !== 0) {
        this.spinVel += wantS * 10 * t.spin * dt;
        this.spinVel = clamp(this.spinVel, -maxS, maxS);
      } else {
        this.spinVel *= Math.exp(-dt * 3.2);
      }
      this.spin += this.spinVel * dt;
      if (timeToLand < 0.5) {
        const k = 1 - Math.exp(-dt * (12 + 16 * t.landAssist) * (1 - timeToLand / 0.5 + 0.2));
        const targetFlip = Math.round(this.flip / TAU) * TAU;
        const targetSpin = Math.round(this.spin / TAU) * TAU;
        this.flip += (targetFlip - this.flip) * k;
        this.spin += (targetSpin - this.spin) * k;
        this.flipVel *= Math.exp(-dt * 10);
        this.spinVel *= Math.exp(-dt * 10);
      }
      this.plan = wantF !== 0 || wantS !== 0 || this.board.active ? 'build' : 'none';
    }
    this.maxFlipAbs = Math.max(this.maxFlipAbs, Math.abs(this.flip));

    // ---- BOARD TRICKS (sword flips under the feet)
    this.board.update(dt, timeToLand, t.margin, t.flipSpeed, t.smart);

    // ---- GRABS (selesai lebih awal agar kaki & tangan siap menyerap pendaratan)
    const autoG = this.autoGrab && this.airTime > 0.15 && tRem > 0.3;
    const grabbing = (inp.grab || autoG) && !this.board.active && tRem > 0.22;
    const type = inp.grab ? inp.grabType : this.autoGrabType;
    if (grabbing) {
      if (type !== this.curGrab) {
        this.curGrab = type;
        this.curGrabT = 0;
      }
      this.curGrabT += dt;
      this.grabT += dt;
      if (this.curGrabT > 0.25 && !this.grabNames.includes(type)) this.grabNames.push(type);
      this.poseId = type;
    } else {
      this.curGrab = null;
      this.curGrabT = 0;
    }
    this.grabW += ((grabbing ? 1 : 0) - this.grabW) * (1 - Math.exp(-dt * 10));
  }

  tickGround(dt: number) {
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) {
        this.chain = 0;
        this.chainPoints = 0;
      }
    }
    this.grabW *= Math.exp(-dt * 10);
  }

  completedFlips() {
    return Math.floor((Math.abs(this.flip) + 0.7) / TAU);
  }
  completedSpins() {
    return Math.floor((Math.abs(this.spin) + 0.6) / TAU);
  }

  label(): string {
    const board = [...this.board.done];
    const cur = this.board.currentName();
    if (cur) board.push(cur);
    const grabs = this.grabNames.map((g) => grabName(g));
    if (this.curGrab && !this.grabNames.includes(this.curGrab)) grabs.push(grabName(this.curGrab));
    return comboLabel({
      flips: this.completedFlips(),
      front: this.flip < 0,
      spins: this.completedSpins(),
      board,
      grabs,
      grabT: this.grabT,
      airJumps: this.airJumpsUsed,
      airTime: this.airTime,
    });
  }

  landState(window: number): 'perfect' | 'clean' | 'sketchy' {
    if (!this.board.caught()) return 'sketchy';
    const err = Math.max(uprightError(this.flip), uprightError(this.spin) * 0.7);
    if (err < 0.3 * window) return 'perfect';
    if (err < 0.9 * window) return 'clean';
    return 'sketchy';
  }

  land(t: AirTune): LandResult {
    const flips = this.completedFlips();
    const spins = this.completedSpins();
    const front = this.flip < 0;
    const err = Math.max(uprightError(this.flip), uprightError(this.spin) * 0.7);
    const caught = this.board.caught();
    const boardN = this.board.done.length;
    const grabN = this.grabNames.length;
    const tricked = flips > 0 || spins > 0 || grabN > 0 || boardN > 0 || this.airJumpsUsed > 0;

    let quality: LandQuality = 'none';
    let bail: LandResult['bail'] = null;
    if (!caught) {
      quality = 'sketchy';
      bail = 'board';
    } else if (err > 0.9 * t.landWindow) {
      quality = 'sketchy';
      bail = 'rotation';
    } else if (tricked || this.airTime > 0.7) quality = err < 0.3 * t.landWindow ? 'perfect' : 'clean';

    let grabPts = 0;
    for (const g of this.grabNames) grabPts += GRABS.find((x) => x.id === g)?.pts ?? 150;
    const variety = (flips > 0 ? 1 : 0) + (spins > 0 ? 1 : 0) + (boardN > 0 ? 1 : 0) + (grabN > 0 ? 1 : 0);
    const points =
      flips * 320 +
      spins * 220 +
      this.board.pts +
      grabPts +
      Math.min(3, this.grabT) * 120 +
      this.airJumpsUsed * 90 +
      Math.max(0, this.airTime - 0.4) * 70 +
      Math.max(0, variety - 1) * 220;

    const board = [...this.board.done];
    return {
      quality,
      flips,
      front,
      spins,
      grab: this.grabT,
      grabs: grabN,
      boardTricks: boardN,
      airJumps: this.airJumpsUsed,
      airTime: this.airTime,
      error: err,
      name: comboLabel({
        flips,
        front,
        spins,
        board,
        grabs: this.grabNames.map((g) => grabName(g)),
        grabT: this.grabT,
        airJumps: this.airJumpsUsed,
        airTime: this.airTime,
      }),
      points,
      bail,
    };
  }

  resetAngles() {
    this.flip = 0;
    this.flipVel = 0;
    this.spin = 0;
    this.spinVel = 0;
    this.grabT = 0;
    this.airTime = 0;
    this.flipHas = false;
    this.spinHas = false;
    this.plan = 'none';
    this.board.reset();
    this.grabNames = [];
    this.curGrab = null;
  }
}

export function comboLabel(o: {
  flips: number;
  front: boolean;
  spins: number;
  board: string[];
  grabs: string[];
  grabT: number;
  airJumps: number;
  airTime: number;
}): string {
  const parts: string[] = [];
  const counts = new Map<string, number>();
  for (const n of o.board) counts.set(n, (counts.get(n) ?? 0) + 1);
  for (const [n, c] of counts) parts.push(c > 1 ? `${n} ×${c}` : n);
  if (o.flips > 0) {
    const base = o.front ? 'FRONTFLIP' : 'BACKFLIP';
    parts.push(o.flips === 1 ? base : `${['', '', 'DOUBLE', 'TRIPLE', 'QUAD', 'QUINT'][Math.min(5, o.flips)]} ${base}`);
  }
  if (o.spins > 0) parts.push(`${o.spins * 360}°`);
  o.grabs.forEach((g, i) => parts.push(i === o.grabs.length - 1 && o.grabT > 1.4 ? `LONG ${g}` : g));
  if (o.airJumps > 0) parts.push(o.airJumps > 1 ? `AIR ×${o.airJumps}` : 'AIR JUMP');
  if (parts.length === 0) return o.airTime > 0.7 ? 'HANG TIME' : 'AIR';
  return parts.join(' + ');
}
