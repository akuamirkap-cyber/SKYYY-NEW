import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { duneHeight } from './noise';

const TAU = Math.PI * 2;

function smooth(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function wrapAngle(a: number) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

// ===========================================================================
// MANTA RAYS
// Parametric swept wings + domed body + cephalic horns + whip tail.
//
// Motion (rewritten):
//  • The wing phase is ACCUMULATED on the CPU (phase += freq·dt). The old
//    version used time·freq, so every tiny frequency change made the wings
//    jump. That was the jittery flapping.
//  • Each manta follows its formation slot with a spring-damper that also
//    matches the slot's velocity, so it moves smoothly, without lag or strafing.
//  • Heading, turn rate, bank and pitch are all filtered. Bank angle comes
//    from a coordinated-turn model (tan φ = v·ω / g), like a real glider.
//  • Flap / glide cycles: mantas beat their wings for a while, then glide
//    with wings slightly raised, and always flap when climbing.
//  • Spacing is scaled by wingspan, so mantas never clip through each other.
// ===========================================================================

const M_L = 12;
const M_HALF = 17.5; // much longer, sweeping fantasy wingspan

function buildMantaGeometry(): THREE.BufferGeometry {
  const NX = 42;
  const NZ = 30;
  const pos: number[] = [];
  const span: number[] = [];
  const tail: number[] = [];
  const idx: number[] = [];

  for (let j = 0; j <= NZ; j++) {
    const t = j / NZ; // 0 = back edge, 1 = nose
    // Fantasy wing chord: wide body tapering to elongated, elegant swept wingtips
    const wing = M_HALF * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.72))), 1.15);
    const body = 1.45 * Math.sin(Math.PI * Math.min(1, t * 1.04)) + 0.4;
    const w = Math.max(wing, body);
    const wk = wing / M_HALF;

    for (let i = 0; i <= NX; i++) {
      const u = (i / NX) * 2 - 1;
      const au = Math.abs(u);
      const x = u * w;

      // Fantasy sweep: wings sweep gracefully backwards, outer tips trail into long feathers
      let z = (t - 0.5) * M_L - Math.pow(au, 2.2) * 5.8 * wk;
      // Wingtip fantasy crest and trailing streamer flare
      z -= Math.pow(smooth((au - 0.75) / 0.25), 1.8) * 3.4;

      // Cephalic fantasy horns at the nose (front)
      if (t > 0.8) {
        const hornDist = Math.abs(au - 0.24);
        const horn = 2.4 * Math.exp(-Math.pow(hornDist / 0.09, 2)) * smooth((t - 0.8) / 0.2);
        z += horn;
      }

      // Body dome & arched fantasy wing camber
      const bodyMask = Math.max(0, 1 - Math.abs(x) / 1.8);
      const y = 0.65 * Math.pow(bodyMask, 1.4) * Math.sin(Math.PI * t) +
        Math.sin(au * Math.PI) * 0.45 * wk +
        Math.pow(au, 3.0) * 0.35 * wk;

      pos.push(x, y, z);
      span.push(Math.min(1, Math.abs(x) / M_HALF));
      tail.push(0);
    }
  }
  const row = NX + 1;
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const bodyG = new THREE.BufferGeometry();
  bodyG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bodyG.setAttribute('aSpan', new THREE.Float32BufferAttribute(span, 1));
  bodyG.setAttribute('aTail', new THREE.Float32BufferAttribute(tail, 1));
  bodyG.setIndex(idx);
  bodyG.computeVertexNormals();

  // Fantasy super-long whip tail (over 3.5x longer, segmented & undulating)
  const TL = 28.0;
  const tailG = new THREE.CylinderGeometry(0.015, 0.18, TL, 6, 36);
  tailG.deleteAttribute('uv');
  tailG.rotateX(-Math.PI / 2);
  const front = -M_L / 2 + 0.8;
  tailG.translate(0, 0.06, front - TL / 2);
  const tp = tailG.attributes.position;
  const tSpan = new Float32Array(tp.count);
  const tTail = new Float32Array(tp.count);
  for (let i = 0; i < tp.count; i++) {
    tTail[i] = Math.min(1, Math.max(0, (front - tp.getZ(i)) / TL));
  }
  tailG.setAttribute('aSpan', new THREE.BufferAttribute(tSpan, 1));
  tailG.setAttribute('aTail', new THREE.BufferAttribute(tTail, 1));

  // Twin fantasy tail streamer fins at the base
  const fsShape = new THREE.Shape();
  fsShape.moveTo(0, 0);
  fsShape.quadraticCurveTo(0.4, -2.5, 0.05, -7.5);
  fsShape.quadraticCurveTo(-0.25, -3.5, 0, 0);
  const streamR = new THREE.ExtrudeGeometry(fsShape, { depth: 0.04, bevelEnabled: false });
  streamR.rotateX(-Math.PI / 2);
  streamR.translate(0.35, 0.04, front - 1.2);
  const streamL = streamR.clone();
  streamL.scale(-1, 1, 1);
  streamL.translate(-0.7, 0, 0);

  const prepMantaPart = (g: THREE.BufferGeometry, defaultSpan = 0, defaultTail = 0): THREE.BufferGeometry => {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    ng.clearGroups();
    for (const name of Object.keys(ng.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'aSpan' && name !== 'aTail') {
        ng.deleteAttribute(name);
      }
    }
    const count = ng.attributes.position.count;
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.aSpan) {
      ng.setAttribute('aSpan', new THREE.BufferAttribute(new Float32Array(count).fill(defaultSpan), 1));
    }
    if (!ng.attributes.aTail) {
      ng.setAttribute('aTail', new THREE.BufferAttribute(new Float32Array(count).fill(defaultTail), 1));
    }
    return ng;
  };

  const merged = mergeGeometries([
    prepMantaPart(bodyG),
    prepMantaPart(tailG),
    prepMantaPart(streamR, 0.2, 0.25),
    prepMantaPart(streamL, 0.2, 0.25),
  ]);
  if (!merged) throw new Error('manta geometry merge failed');
  merged.computeBoundingSphere();
  return merged;
}

interface MantaU {
  uWing: { value: number };
  uAmp: { value: number };
  uLift: { value: number };
  uHaze: { value: THREE.Color };
  uHazeAmt: { value: number };
  uRim: { value: THREE.Color };
  uGlow: { value: number };
  uTop: { value: THREE.Color };
  uBelly: { value: THREE.Color };
}

const MANTA_TOPS = ['#1a2456', '#2f1854', '#0c384c', '#42163b', '#133a38'];

function makeMantaMaterial(i: number): { mat: THREE.MeshStandardMaterial; u: MantaU } {
  const u: MantaU = {
    uWing: { value: Math.random() * TAU },
    uAmp: { value: 1 },
    uLift: { value: 0 },
    uHaze: { value: new THREE.Color('#ffd9bd') },
    uHazeAmt: { value: 0.2 },
    uRim: { value: new THREE.Color('#7fe8ff') },
    uGlow: { value: 0.8 },
    uTop: { value: new THREE.Color(MANTA_TOPS[i % MANTA_TOPS.length]) },
    uBelly: { value: new THREE.Color('#e4f5fc') },
  };
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.38,
    metalness: 0.12,
    side: THREE.DoubleSide,
    fog: false,
  });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aSpan; attribute float aTail;
        uniform float uWing; uniform float uAmp; uniform float uLift;
        varying float vSpan; varying float vTail; varying vec3 vLocalPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float s = aSpan;
          // Fluid multi-frequency wave for extended fantasy wingspan
          float wave = sin(uWing - s * 1.8 - transformed.z * 0.07);
          float flutter = sin(uWing * 2.4 - s * 3.4) * 0.22 * pow(s, 1.8);
          transformed.y += (wave + flutter) * 2.8 * uAmp * pow(s, 1.35) + uLift * pow(s, 1.2) * 1.5;
          transformed.x *= 1.0 - 0.05 * abs(wave) * s * uAmp;

          // Super-long serpentine whip-tail undulation
          float tw = uWing * 1.35 - aTail * 6.0;
          transformed.x += pow(aTail, 1.25) * sin(tw) * 3.2;
          transformed.y += pow(aTail, 1.15) * cos(tw * 0.85) * 1.8;

          vSpan = s;
          vTail = aTail;
          vLocalPos = transformed;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uHaze; uniform float uHazeAmt; uniform vec3 uRim; uniform float uGlow;
        uniform vec3 uTop; uniform vec3 uBelly;
        varying float vSpan; varying float vTail; varying vec3 vLocalPos;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (gl_FrontFacing) {
          // Bioluminescent fantasy markings along the sweeping wingtips
          float marginGlow = smoothstep(0.65, 1.0, vSpan);
          vec3 neonCyan = vec3(0.35, 0.92, 1.0);
          vec3 starGold = vec3(1.0, 0.85, 0.45);
          float vein = sin(vSpan * 28.0 - vLocalPos.z * 0.8) * 0.5 + 0.5;
          vein = pow(vein, 5.0) * smoothstep(0.3, 0.95, vSpan);
          vec3 fantasyTop = mix(uTop, neonCyan * 1.6 + starGold * 0.3, marginGlow * 0.65 + vein * 0.5);
          diffuseColor.rgb = fantasyTop;
        } else {
          diffuseColor.rgb = mix(uBelly, vec3(0.7, 0.95, 1.0), smoothstep(0.5, 1.0, vSpan) * 0.4);
        }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        {
          vec3 nV = normalize(normal);
          float rimF = pow(1.0 - clamp(abs(dot(nV, normalize(vViewPosition))), 0.0, 1.0), 2.0);
          vec3 wingRim = mix(uRim, vec3(0.4, 0.95, 1.0), smoothstep(0.4, 1.0, vSpan));
          gl_FragColor.rgb += wingRim * rimF * uGlow * 1.35;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, uHazeAmt);
        }`,
      );
  };
  return { mat, u };
}

interface Manta {
  mesh: THREE.Mesh;
  u: MantaU;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  slotPrev: THREE.Vector3;
  slotVel: THREE.Vector3;
  yaw: number;
  yawRate: number;
  pitch: number;
  roll: number;
  omega: number;
  wing: number;
  amp: number;
  gliding: boolean;
  glideT: number;
  fade: number;
  seeded: boolean;
}

export interface MantaOpts {
  count: number;
  size: number;
  height: number;
  speed: number;
  formation: number; // 0 = V, 1 = ring carousel, 2 = wave stream
  glow: number;
  haze: number;
}

export class MantaFlock {
  group = new THREE.Group();
  private mantas: Manta[] = [];
  private center = new THREE.Vector3();
  private cVel = new THREE.Vector3();
  private tPrev = new THREE.Vector3();
  private tVel = new THREE.Vector3();
  private flockYaw = 0;
  private leadYaw = 0;
  private theta = Math.random() * TAU;
  private init = false;
  private tmp = new THREE.Vector3();
  private slot = new THREE.Vector3();
  private dv = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(max = 12) {
    const geo = buildMantaGeometry();
    for (let i = 0; i < max; i++) {
      const { mat, u } = makeMantaMaterial(i);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.group.add(mesh);
      this.mantas.push({
        mesh,
        u,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        slotPrev: new THREE.Vector3(),
        slotVel: new THREE.Vector3(),
        yaw: 0,
        yawRate: 0,
        pitch: 0,
        roll: 0,
        omega: 0.75 + Math.random() * 0.45,
        wing: Math.random() * TAU,
        amp: 1,
        gliding: Math.random() < 0.3,
        glideT: Math.random() * 4,
        fade: 0,
        seeded: false,
      });
    }
  }

  /** formation slot in flock space (x right, y up, z forward), in base units */
  private slotOf(k: number, n: number, form: number, t: number, out: THREE.Vector3) {
    if (form === 1) {
      // carousel ring, radius grows with the count so wings never overlap
      const r = Math.max(26, n * 4.2);
      const a = (k / Math.max(1, n)) * TAU + t * 0.18;
      return out.set(Math.cos(a) * r, Math.sin(t * 0.45 + k * 1.3) * 2.8 + (k % 2 ? 1.8 : -1.8), Math.sin(a) * r);
    }
    if (form === 2) {
      // snaking ribbon with long tails
      return out.set(Math.sin(t * 0.55 - k * 0.75) * 11, Math.sin(t * 0.45 - k * 0.55) * 3.5 + (k % 2 ? 1.4 : -1.4), -k * 18);
    }
    // V formation, spaced for grand fantasy wings
    if (k === 0) return out.set(0, Math.sin(t * 0.5) * 0.6, 0);
    const side = k % 2 === 1 ? 1 : -1;
    const rank = Math.ceil(k / 2);
    return out.set(side * rank * 18, -rank * 2.2 + Math.sin(t * 0.5 + rank * 0.9) * 1.2, -rank * 15);
  }

  update(
    dt: number,
    time: number,
    player: THREE.Vector3,
    yaw: number,
    o: MantaOpts,
    haze: THREE.Color,
    rim: THREE.Color,
    cam: THREE.Vector3,
  ) {
    const n = Math.max(0, Math.min(this.mantas.length, Math.round(o.count)));
    const idt = 1 / Math.max(dt, 1e-4);

    // ---- flock heading follows the rider lazily (no jumps when you turn)
    if (!this.init) {
      this.flockYaw = yaw;
      this.leadYaw = yaw;
    }
    this.flockYaw += wrapAngle(yaw - this.flockYaw) * (1 - Math.exp(-dt * 0.35));
    const fx = Math.sin(this.flockYaw);
    const fz = Math.cos(this.flockYaw);
    const rx = fz;
    const rz = -fx;

    // ---- centre target: a lazy loop through the sky in front of the rider
    this.theta += dt * 0.07 * o.speed;
    const R = 70 + 25 * o.size;
    const lx = Math.cos(this.theta) * R;
    const lz = Math.sin(this.theta) * R * 0.5;
    const ahead = 140 + 25 * o.size;
    const tx = player.x + fx * (ahead + lz) + rx * lx;
    const tz = player.z + fz * (ahead + lz) + rz * lx;
    let ty = player.y + 30 * o.height + Math.sin(time * 0.2) * 6;
    const floor = duneHeight(tx, tz) + 18 * o.size;
    if (ty < floor) ty = floor;
    this.tmp.set(tx, ty, tz);
    if (!this.init) {
      this.center.copy(this.tmp);
      this.tPrev.copy(this.tmp);
      this.cVel.set(0, 0, 0);
      this.tVel.set(0, 0, 0);
      this.init = true;
    }

    // ---- centre: critically-damped spring WITH velocity feed-forward (no lag, no jerk)
    this.dv.subVectors(this.tmp, this.tPrev).multiplyScalar(idt);
    this.tPrev.copy(this.tmp);
    this.tVel.lerp(this.dv, 1 - Math.exp(-dt * 2.5));
    const w0 = 0.55;
    this.cVel.x += ((this.tmp.x - this.center.x) * w0 * w0 + (this.tVel.x - this.cVel.x) * 2 * w0) * dt;
    this.cVel.y += ((this.tmp.y - this.center.y) * w0 * w0 + (this.tVel.y - this.cVel.y) * 2 * w0) * dt;
    this.cVel.z += ((this.tmp.z - this.center.z) * w0 * w0 + (this.tVel.z - this.cVel.z) * 2 * w0) * dt;
    this.center.addScaledVector(this.cVel, dt);

    // ---- formation orientation = smoothed direction of travel
    const hx = this.cVel.x + fx * 8;
    const hz = this.cVel.z + fz * 8;
    this.leadYaw += wrapAngle(Math.atan2(hx, hz) - this.leadYaw) * (1 - Math.exp(-dt * 0.6));
    const lf = Math.sin(this.leadYaw);
    const lfz = Math.cos(this.leadYaw);
    const lrx = lfz;
    const lrz = -lf;
    // spacing scales with the wingspan (16 m × size)
    const spacing = 1.25 * o.size;

    for (let i = 0; i < this.mantas.length; i++) {
      const m = this.mantas[i];
      const active = i < n;
      m.fade += ((active ? 1 : 0) - m.fade) * (1 - Math.exp(-dt * 1.3));
      if (!active && m.fade < 0.01) {
        m.mesh.visible = false;
        m.seeded = false;
        continue;
      }
      m.mesh.visible = true;

      // ---- world slot
      this.slotOf(i, n, o.formation, time, this.slot);
      const ox = this.slot.x * spacing;
      const oy = this.slot.y * spacing;
      const oz = this.slot.z * spacing;
      this.tmp.set(
        this.center.x + lrx * ox + lf * oz,
        this.center.y + oy,
        this.center.z + lrz * ox + lfz * oz,
      );

      if (!m.seeded) {
        m.pos.copy(this.tmp);
        m.slotPrev.copy(this.tmp);
        m.vel.copy(this.cVel);
        m.slotVel.copy(this.cVel);
        m.yaw = this.leadYaw;
        m.yawRate = 0;
        m.pitch = 0;
        m.roll = 0;
        m.seeded = true;
      }

      // ---- slot velocity (smoothed) for feed-forward
      this.dv.subVectors(this.tmp, m.slotPrev).multiplyScalar(idt);
      m.slotPrev.copy(this.tmp);
      m.slotVel.lerp(this.dv, 1 - Math.exp(-dt * 3));

      // ---- spring-damper toward the slot (slightly under-damped = organic)
      const om = m.omega;
      const zeta = 0.8;
      m.vel.x += ((this.tmp.x - m.pos.x) * om * om + (m.slotVel.x - m.vel.x) * 2 * om * zeta) * dt;
      m.vel.y += ((this.tmp.y - m.pos.y) * om * om + (m.slotVel.y - m.vel.y) * 2 * om * zeta) * dt;
      m.vel.z += ((this.tmp.z - m.pos.z) * om * om + (m.slotVel.z - m.vel.z) * 2 * om * zeta) * dt;
      m.pos.addScaledVector(m.vel, dt);
      const fl = duneHeight(m.pos.x, m.pos.z) + 8 * o.size;
      if (m.pos.y < fl) {
        m.pos.y = fl;
        if (m.vel.y < 0) m.vel.y = 0;
      }

      // ---- orientation: heading, coordinated-turn bank, pitch, all filtered
      const horiz = Math.hypot(m.vel.x, m.vel.z);
      if (horiz > 0.5) {
        const yT = Math.atan2(m.vel.x, m.vel.z);
        const prevYaw = m.yaw;
        m.yaw += wrapAngle(yT - m.yaw) * (1 - Math.exp(-dt * 2.2));
        const rate = wrapAngle(m.yaw - prevYaw) * idt;
        m.yawRate += (rate - m.yawRate) * (1 - Math.exp(-dt * 1.8));
        const rollT = clamp(-Math.atan((horiz * m.yawRate) / 25), -0.7, 0.7);
        m.roll += (rollT - m.roll) * (1 - Math.exp(-dt * 1.6));
        const pT = clamp(-Math.atan2(m.vel.y, horiz) * 0.9, -0.5, 0.5);
        m.pitch += (pT - m.pitch) * (1 - Math.exp(-dt * 1.8));
      }

      // ---- flap / glide cycles (phase accumulated, never jumps)
      const climb = clamp(m.vel.y / 8, -1, 1);
      m.glideT -= dt;
      if (m.glideT <= 0) {
        m.gliding = !m.gliding;
        m.glideT = m.gliding ? 1.8 + Math.random() * 2.5 : 4 + Math.random() * 5;
      }
      const wantAmp = climb > 0.25 ? 1 : m.gliding ? 0.18 : 1;
      m.amp += (wantAmp - m.amp) * (1 - Math.exp(-dt * 1.2));
      const freq = (1.8 + 0.9 * Math.max(0, climb)) * (0.35 + 0.65 * m.amp);
      m.wing += dt * freq;

      // ---- apply (subtle body bob + pitch nod synced to the wingbeat)
      this.euler.set(m.pitch + Math.cos(m.wing) * 0.05 * m.amp, m.yaw, m.roll);
      m.mesh.quaternion.setFromEuler(this.euler);
      m.mesh.position.copy(m.pos);
      m.mesh.position.y -= Math.sin(m.wing) * 0.45 * m.amp * o.size;
      m.mesh.scale.setScalar(Math.max(1e-4, o.size * smooth(m.fade)));

      m.u.uWing.value = m.wing;
      m.u.uAmp.value = m.amp;
      m.u.uLift.value = (1 - m.amp) * 0.55;
      m.u.uHaze.value.copy(haze);
      m.u.uRim.value.copy(rim);
      m.u.uGlow.value = 0.65 * o.glow;
      const dist = m.pos.distanceTo(cam);
      m.u.uHazeAmt.value = Math.min(0.38, Math.max(0.02, (0.02 + dist / 2200) * o.haze));
    }
  }
}

// ===========================================================================
// FLYING FISH
// Schools leap out of the dunes in staggered arcs, glide on spread wing-fins
// (flat-topped trajectory, like real flying fish) and dive back into the sand
// with a puff. They race alongside the rider, sometimes crossing in front.
// ===========================================================================

function buildFlyerGeometry(): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(0.5, 10, 7);
  body.scale(0.2, 0.24, 1);

  const ws = new THREE.Shape();
  ws.moveTo(0.08, 0.24);
  ws.quadraticCurveTo(0.62, 0.28, 1.08, -0.1);
  ws.quadraticCurveTo(0.62, -0.1, 0.08, -0.12);
  ws.lineTo(0.08, 0.24);
  const wingR = new THREE.ShapeGeometry(ws, 8);
  wingR.rotateX(Math.PI / 2);
  wingR.translate(0, 0.04, 0.05);
  const wingL = wingR.clone();
  wingL.scale(-1, 1, 1);

  const ts = new THREE.Shape();
  ts.moveTo(0, 0);
  ts.lineTo(-0.36, 0.26);
  ts.lineTo(-0.3, 0);
  ts.lineTo(-0.5, -0.34);
  ts.lineTo(0, 0);
  const tail = new THREE.ShapeGeometry(ts);
  tail.rotateY(-Math.PI / 2);
  tail.translate(0, 0, -0.42);

  const parts = [body, wingR, wingL, tail];
  for (let p = 0; p < parts.length; p++) {
    const g = parts[p];
    const n = g.attributes.position.count;
    const a = new Float32Array(n);
    if (p === 1 || p === 2) for (let i = 0; i < n; i++) a[i] = Math.min(1, Math.abs(g.attributes.position.getX(i)));
    g.setAttribute('aWing', new THREE.BufferAttribute(a, 1));
  }
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('flying fish geometry merge failed');
  merged.computeBoundingSphere();
  return merged;
}

interface Flyer {
  on: boolean;
  t: number;
  T: number;
  sx: number;
  sz: number;
  dx: number;
  dz: number;
  dist: number;
  h: number;
  size: number;
  exited: boolean;
  entered: boolean;
  spark: number;
}

export interface FlyerOpts {
  rate: number;
  size: number;
  glow: number;
}

const FLYER_COLORS = ['#dff6ff', '#b4e8ff', '#c9d6ff', '#ffffff', '#aef3ea', '#ffe9c4'];

export class FlyingFishSchool {
  mesh: THREE.InstancedMesh;
  private f: Flyer[] = [];
  private timer = 1.5;
  private cursor = 0;
  private uTime = { value: 0 };
  private uHaze = { value: new THREE.Color('#ffd9bd') };
  private uHazeAmt = { value: 0.08 };
  private mat: THREE.MeshStandardMaterial;
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private d = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);

  constructor(max = 96) {
    const geo = buildFlyerGeometry();
    const ph = new Float32Array(max);
    for (let i = 0; i < max; i++) ph[i] = Math.random() * TAU;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));

    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.7,
      roughness: 0.22,
      emissive: new THREE.Color('#a8e6ff'),
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
      fog: false,
    });
    const uTime = this.uTime;
    const uHaze = this.uHaze;
    const uHazeAmt = this.uHazeAmt;
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.uniforms.uHaze = uHaze;
      sh.uniforms.uHazeAmt = uHazeAmt;
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aWing; attribute float aPhase; uniform float uTime;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            transformed.y += aWing * sin(uTime * 38.0 + aPhase) * 0.035;
            transformed.y += aWing * aWing * 0.08;
            float tl = clamp(-transformed.z * 1.6 - 0.3, 0.0, 1.0);
            transformed.x += sin(uTime * 17.0 + aPhase) * 0.13 * tl;
          }`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 uHaze; uniform float uHazeAmt;`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, uHazeAmt);`,
        );
    };

    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) {
      c.set(FLYER_COLORS[i % FLYER_COLORS.length]);
      this.mesh.setColorAt(i, c);
      this.mesh.setMatrixAt(i, this.zero);
      this.f.push({
        on: false,
        t: 0,
        T: 1,
        sx: 0,
        sz: 0,
        dx: 0,
        dz: 1,
        dist: 0,
        h: 0,
        size: 1,
        exited: false,
        entered: false,
        spark: 0,
      });
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private spawnGroup(player: THREE.Vector3, fx: number, fz: number, speed: number) {
    const n = 5 + Math.floor(Math.random() * 8);
    const side = Math.random() < 0.5 ? -1 : 1;
    const rx = fz;
    const rz = -fx;
    const cross = Math.random() < 0.28;
    const ahead = cross ? 30 + Math.random() * 30 : 16 + Math.random() * 42;
    const lateral = side * (cross ? 16 + Math.random() * 8 : 8 + Math.random() * 22);
    let ang = Math.atan2(fx, fz) + (Math.random() - 0.5) * 0.3;
    if (cross) ang -= side * (0.75 + Math.random() * 0.35);
    const gdx = Math.sin(ang);
    const gdz = Math.cos(ang);
    const T = 1.45 + Math.random() * 0.8;
    const travel = Math.max(speed, 10) * (cross ? 0.65 : 1.06) + 6 + Math.random() * 6;
    const h = 4.5 + Math.random() * 6;
    const stagger = 0.07 + Math.random() * 0.05;

    for (let i = 0; i < n; i++) {
      const f = this.f[this.cursor];
      this.cursor = (this.cursor + 1) % this.f.length;
      f.on = true;
      f.t = -i * stagger;
      f.T = T * (0.9 + Math.random() * 0.2);
      f.sx = player.x + fx * (ahead + i * 0.9 + (Math.random() - 0.5) * 3) + rx * (lateral + (Math.random() - 0.5) * 5);
      f.sz = player.z + fz * (ahead + i * 0.9 + (Math.random() - 0.5) * 3) + rz * (lateral + (Math.random() - 0.5) * 5);
      const jd = (Math.random() - 0.5) * 0.08;
      f.dx = gdx + gdz * jd;
      f.dz = gdz - gdx * jd;
      const dl = Math.hypot(f.dx, f.dz);
      f.dx /= dl;
      f.dz /= dl;
      f.dist = travel * f.T;
      f.h = h * (0.82 + Math.random() * 0.36);
      f.size = 0.8 + Math.random() * 0.45;
      f.exited = false;
      f.entered = false;
      f.spark = 0;
    }
  }

  private at(f: Flyer, s: number, surf: (x: number, z: number) => number, out: THREE.Vector3) {
    const x = f.sx + f.dx * f.dist * s;
    const z = f.sz + f.dz * f.dist * s;
    const k = 2 * s - 1;
    const arc = f.h * (0.5 * (1 - k * k) + 0.5 * (1 - k * k * k * k));
    return out.set(x, surf(x, z) - 0.6 + arc, z);
  }

  update(
    dt: number,
    time: number,
    player: THREE.Vector3,
    fx: number,
    fz: number,
    speed: number,
    o: FlyerOpts,
    surf: (x: number, z: number) => number,
    onSplash: (x: number, y: number, z: number, s: number) => void,
    onSparkle: (x: number, y: number, z: number) => void,
    haze: THREE.Color,
    hazeAmt: number,
  ) {
    this.uTime.value = time;
    this.uHaze.value.copy(haze);
    this.uHazeAmt.value = hazeAmt;
    this.mat.emissiveIntensity = 0.5 * o.glow;

    if (o.rate > 0.01) {
      this.timer -= dt * o.rate;
      if (this.timer <= 0) {
        this.spawnGroup(player, fx, fz, speed);
        this.timer = 2 + Math.random() * 3.5;
      }
    }

    for (let i = 0; i < this.f.length; i++) {
      const f = this.f[i];
      if (!f.on) {
        this.mesh.setMatrixAt(i, this.zero);
        continue;
      }
      f.t += dt;
      if (f.t < 0) {
        this.mesh.setMatrixAt(i, this.zero);
        continue;
      }
      const s = f.t / f.T;
      if (s >= 1) {
        f.on = false;
        this.mesh.setMatrixAt(i, this.zero);
        continue;
      }
      this.at(f, s, surf, this.p);
      this.at(f, Math.min(1, s + 0.015), surf, this.d);
      this.d.sub(this.p);
      if (this.d.lengthSq() < 1e-8) this.d.set(f.dx, 0, f.dz);
      this.d.normalize();

      const g = surf(this.p.x, this.p.z);
      if (!f.exited && this.p.y > g) {
        f.exited = true;
        onSplash(this.p.x, g, this.p.z, 1);
      }
      if (f.exited && !f.entered && s > 0.6 && this.p.y < g) {
        f.entered = true;
        onSplash(this.p.x, g, this.p.z, 0.8);
      }
      f.spark -= dt;
      if (f.spark <= 0 && this.p.y > g + 0.6) {
        onSparkle(this.p.x, this.p.y, this.p.z);
        f.spark = 0.06 + Math.random() * 0.05;
      }

      this.q.setFromUnitVectors(this.fwd, this.d);
      this.s.setScalar(1.6 * o.size * f.size);
      this.m4.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
