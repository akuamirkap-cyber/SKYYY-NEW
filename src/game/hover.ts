import * as THREE from 'three';
import { clamp, duneGradient, duneHeight, mix, smoothHeight, surfaceRadius } from './noise';
import { UP } from './math';

// ---------------------------------------------------------------------------
// HOVER RIG
//
// Why the old hover felt rough: the blade followed the raw terrain, so every
// small ridge on a mountain came through. Now:
//
//  1. SPATIAL low-pass: the blade rides a blurred copy of the terrain
//     (13-tap kernel, radius 3–15 m). This is speed-independent, so it stays
//     smooth whether you crawl or fly.
//  2. TEMPORAL low-pass + soft spring on top of that, which gives the
//     hovercraft float and settle.
//  3. SOFT floor: if a sharp peak rises above the rail, the blade eases up
//     over it instead of snapping.
//  4. ATTITUDE from a long-wave slope, plus nose anticipation that reads the
//     smoothed curvature ahead.
// ---------------------------------------------------------------------------

export interface HoverTune {
  rideHeight: number;
  softness: number;
  bumpFilter: number;
  tilt: number;
  tiltSmooth: number;
  glide: number;
}

export class HoverRig {
  railY = 0;
  private railVel = 0;

  readonly up = new THREE.Vector3(0, 1, 0);
  yaw = 0;
  private gx = 0;
  private gz = 0;
  nose = 0;
  groundVy = 0;
  clearance = 0;

  private tmp = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private right = new THREE.Vector3();
  private basis = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private g = { x: 0, z: 0 };
  private spinAngle = 0;
  private leanVis = 0;
  private pitchVis = 0;
  private flipVis = 0;
  private grabVis = 0;
  private airW = 0;
  private qFinal = new THREE.Quaternion();
  private pv = new THREE.Vector3();
  private pv2 = new THREE.Vector3();

  /**
   * On landing the physics angles reset to ~0. Zero out the visual spin and flip angles
   * completely so the board is instantly aligned forward without any backwards unwinding.
   */
  wrap() {
    this.flipVis = 0;
    this.spinAngle = 0;
  }

  /** touchdown: keep a small, soft squash instead of a deep spring dip */
  onLand() {
    this.railVel = Math.max(this.railVel * 0.3, -6);
  }

  reset(x: number, z: number, yaw: number) {
    this.railY = duneHeight(x, z);

    this.railVel = 0;
    this.up.set(0, 1, 0);
    this.yaw = yaw;
    this.gx = 0;
    this.gz = 0;
    this.nose = 0;
    this.groundVy = 0;
    this.clearance = 0;
    this.spinAngle = 0;
    this.leanVis = 0;
    this.pitchVis = 0;
    this.camInit = false;
  }

  update(
    dt: number,
    grounded: boolean,
    x: number,
    z: number,
    physY: number,
    physVy: number,
    targetYaw: number,
    spin: number,
    lean: number,
    t: HoverTune,
    flip = 0,
    grab = 0,
  ): void {
    // flips come from physics already smooth; a light filter removes frame steps
    this.flipVis += (flip - this.flipVis) * (1 - Math.exp(-dt * 20));
    this.grabVis += (grab - this.grabVis) * (1 - Math.exp(-dt * 9));
    this.airW += ((grounded ? 0 : 1) - this.airW) * (1 - Math.exp(-dt * 6));
    const r = surfaceRadius(t.bumpFilter);

    // ---------------- 1. spatially smoothed surface
    const smoothH = smoothHeight(x, z, r);
    // fine floor: removes only the tiniest grain, used to avoid visible clipping
    const floorH = smoothHeight(x, z, Math.min(r, 2.4)) + 0.06;

    // ---------------- 2. temporal stage (light), then soft spring
    // The PHYSICS now does the hovering (one-sided air cushion + gravity), so
    // physY already floats above the sand and already includes every jump.
    // The visual only follows it with a very light filter to remove frame
    // steps. No extra spring = no lag = jumps and air jumps read instantly.
    {
      const prev = this.railY;
      this.railY += (physY - this.railY) * (1 - Math.exp(-dt * 30));
      this.railVel = (this.railY - prev) / Math.max(dt, 1e-4);
    }

    // ---------------- 3. soft floor, eases over sharp peaks, no snapping
    if (this.railY < floorH) {
      const k = 1 - Math.exp(-dt * 16);
      this.railY += (floorH - this.railY) * k;
      if (this.railVel < 0) this.railVel *= Math.exp(-dt * 12);
    }
    // absolute safety: never deep inside the sand
    const raw = duneHeight(x, z);
    if (this.railY < raw - 0.35) this.railY = raw - 0.35;

    this.groundVy += ((this.railVel || 0) - this.groundVy) * (1 - Math.exp(-dt * 6));
    this.clearance = this.railY - smoothH;

    // ---------------- 4. long-wave slope for the attitude
    const eps = Math.max(6, r * 1.3) + 4 * clamp(t.bumpFilter, 0, 3);
    duneGradient(x, z, eps, this.g);
    const gRate = 1 - Math.exp(-dt * (grounded ? 3 : 2) * t.tiltSmooth);
    this.gx += (this.g.x - this.gx) * gRate;
    this.gz += (this.g.z - this.gz) * gRate;

    // ---------------- 5. anticipation on the SMOOTHED surface
    const ax = Math.sin(targetYaw);
    const az = Math.cos(targetYaw);
    const ahead = 11 + r * 0.4;
    const hA = smoothHeight(x + ax * ahead, z + az * ahead, r);
    const hB = smoothHeight(x - ax * ahead, z - az * ahead, r);
    const curv = hA - smoothH - (smoothH - hB);
    const noseTarget = clamp((curv / ahead) * 0.55, -0.45, 0.45) * t.glide * (grounded ? 1 : 0.35);
    this.nose += (noseTarget - this.nose) * (1 - Math.exp(-dt * 3 * t.tiltSmooth));

    // ---------------- 6. heading
    let dy = targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * (1 - Math.exp(-dt * (grounded ? 11 : 6.5)));

    // ---------------- attitude basis
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    // tilt scales how much the slope leans the board
    this.tmp.set(-this.gx * t.tilt, 1, -this.gz * t.tilt).normalize();
    const nTarget = grounded ? this.tmp : UP;
    this.up.lerp(nTarget, 1 - Math.exp(-dt * (grounded ? 5 : 2.4) * t.tiltSmooth)).normalize();

    this.fwd.set(fx, 0, fz).projectOnPlane(this.up).normalize();
    this.right.crossVectors(this.up, this.fwd).normalize();
    this.basis.makeBasis(this.right, this.up, this.fwd);
    this.q.setFromRotationMatrix(this.basis);

    this.spinAngle += (spin - this.spinAngle) * (1 - Math.exp(-dt * 13));
    this.leanVis += (lean - this.leanVis) * (1 - Math.exp(-dt * 5.5));
    const pitchAim = grounded
      ? -this.nose
      : clamp(-physVy * 0.012, -0.32, 0.4) - this.nose * 0.5;
    this.pitchVis += (pitchAim - this.pitchVis) * (1 - Math.exp(-dt * 4));
  }

  apply(obj: THREE.Object3D, x: number, z: number, steer: number, grounded: boolean, t: { tilt: number }) {
    obj.quaternion.copy(this.q);
    obj.rotateY(this.spinAngle);
    // backflip = nose up = negative X rotation
    obj.rotateX(this.pitchVis - this.flipVis);
    obj.rotateZ(this.leanVis + (grounded ? 0 : steer * 0.16) * t.tilt);
    // grab: board tweaked under the rider
    if (this.grabVis > 0.001) {
      obj.rotateZ(this.grabVis * 0.42);
      obj.rotateX(this.grabVis * 0.22);
    }
    this.qFinal.copy(obj.quaternion);

    // rotate around the rider's centre of mass (not the feet) while airborne
    const pivot = 1.15 * this.airW;
    this.pv.set(0, pivot, 0).applyQuaternion(this.q);
    this.pv2.set(0, pivot, 0).applyQuaternion(this.qFinal);
    obj.position.set(x + this.pv.x - this.pv2.x, this.railY + this.pv.y - this.pv2.y, z + this.pv.z - this.pv2.z);
    obj.updateMatrixWorld(true);
  }

  slopeX() {
    return this.gx;
  }
  slopeZ() {
    return this.gz;
  }

  private camY = 0;
  private camInit = false;
  cameraY(dt: number, rate: number): number {
    if (!this.camInit) {
      this.camInit = true;
      this.camY = this.railY;
    }
    this.camY += (this.railY - this.camY) * (1 - Math.exp(-dt * rate));
    return this.camY;
  }
  resetCameraY() {
    this.camInit = false;
  }

  static ease(cur: number, target: number, dt: number, rate: number) {
    return mix(cur, target, 1 - Math.exp(-dt * rate));
  }
}
