import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HEAD, LEN, R, radiusAt, type WhalePod } from './whales';

// ---------------------------------------------------------------------------
// FISH SCHOOLS around every sky whale.
//
// Each whale is escorted by four beautiful formations:
//   1. HELIX A / B   two counter-rotating spirals wrapped around the body
//   2. HALO          a rotating ring around the head & pectoral fins
//   3. RIBBON        a sinuous comet-tail stream flowing behind the flukes
//
// Targets are computed in the whale's local space (so formations bank, pitch
// and scale with the whale), then every fish chases its target with its own
// lag. That lag is what makes the school ripple organically instead of moving
// like a rigid object. Fish face their real velocity and wiggle their tails
// in the vertex shader. One InstancedMesh = one draw call for all fish.
// ---------------------------------------------------------------------------

export const MAX_FISH_PER_WHALE = 90;
const TAU = Math.PI * 2;

const LANE_HELIX_A = 0;
const LANE_HELIX_B = 1;
const LANE_HALO = 2;
const LANE_RIBBON = 3;

interface Fish {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  alive: boolean;
  rate: number;
  phase: number;
  jx: number;
  jy: number;
  jz: number;
}

export interface FishOpts {
  count: number; // per whale
  size: number;
  glow: number;
}

function fishGeometry(): THREE.BufferGeometry {
  // slim body, length 1 along +Z (nose forward)
  const body = new THREE.SphereGeometry(0.5, 10, 7);
  body.scale(0.26, 0.4, 1);

  // vertical tail fin at the back
  const ts = new THREE.Shape();
  ts.moveTo(0, 0);
  ts.lineTo(-0.42, 0.3);
  ts.lineTo(-0.34, 0);
  ts.lineTo(-0.42, -0.3);
  ts.lineTo(0, 0);
  const tail = new THREE.ShapeGeometry(ts);
  tail.rotateY(-Math.PI / 2); // shape x -> -z (backwards), lies in the YZ plane
  tail.translate(0, 0, -0.4);

  // tiny dorsal fin
  const ds = new THREE.Shape();
  ds.moveTo(0, 0);
  ds.lineTo(-0.18, 0.16);
  ds.lineTo(-0.3, 0);
  ds.lineTo(0, 0);
  const dorsal = new THREE.ShapeGeometry(ds);
  dorsal.rotateY(-Math.PI / 2);
  dorsal.translate(0, 0.17, 0.05);

  const merged = mergeGeometries([body, tail, dorsal]);
  if (!merged) throw new Error('fish geometry merge failed');
  merged.computeBoundingSphere();
  return merged;
}

const COLORS = ['#e6f8ff', '#a9ecff', '#ffe7b3', '#cfdcff', '#ffffff', '#b8fff0', '#ffd6e8'];

export class FishSchool {
  mesh: THREE.InstancedMesh;
  private fish: Fish[] = [];
  private uTime = { value: 0 };
  private uHaze = { value: new THREE.Color('#ffd9bd') };
  private uHazeAmt = { value: 0.25 };
  private mat: THREE.MeshStandardMaterial;
  private tmp = new THREE.Vector3();
  private prev = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private m4 = new THREE.Matrix4();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private fwd = new THREE.Vector3(0, 0, 1);
  private whaleFwd = new THREE.Vector3();

  constructor(maxWhales = 6) {
    const total = maxWhales * MAX_FISH_PER_WHALE;
    const geo = fishGeometry();
    const phases = new Float32Array(total);
    for (let i = 0; i < total; i++) phases[i] = Math.random() * TAU;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.55,
      roughness: 0.28,
      emissive: new THREE.Color('#9fe6ff'),
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
          attribute float aPhase; uniform float uTime;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            // swimming wiggle: grows toward the tail, travels nose -> tail
            float tail = clamp(-transformed.z * 1.6 + 0.2, 0.0, 1.0);
            transformed.x += sin(uTime * 13.0 + aPhase - transformed.z * 5.0) * 0.17 * tail;
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

    this.mesh = new THREE.InstancedMesh(geo, this.mat, total);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < total; i++) {
      c.set(COLORS[i % COLORS.length]);
      this.mesh.setColorAt(i, c);
      this.mesh.setMatrixAt(i, this.zero);
      this.fish.push({
        pos: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, 1),
        alive: false,
        rate: 3 + Math.random() * 4,
        phase: Math.random() * TAU,
        jx: Math.random() * 2 - 1,
        jy: Math.random() * 2 - 1,
        jz: Math.random() * 2 - 1,
      });
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** whale body wave (same formula as the whale vertex shader) */
  private bodyWave(z: number, wv: number) {
    const tw = Math.min(1.2, Math.max(0, (HEAD - z) / LEN));
    return Math.sin(wv - z * 0.085) * 1.5 * (0.22 + tw * tw * 2.6);
  }

  /** local-space target for fish k of n (whale-local, unscaled units) */
  private target(k: number, n: number, f: Fish, t: number, wv: number, out: THREE.Vector3) {
    // lane split: 25% helix A, 25% helix B, 20% halo, 30% ribbon
    const u = k / Math.max(1, n);
    let lane: number;
    let lu: number; // 0..1 position inside the lane
    if (u < 0.25) {
      lane = LANE_HELIX_A;
      lu = u / 0.25;
    } else if (u < 0.5) {
      lane = LANE_HELIX_B;
      lu = (u - 0.25) / 0.25;
    } else if (u < 0.7) {
      lane = LANE_HALO;
      lu = (u - 0.5) / 0.2;
    } else {
      lane = LANE_RIBBON;
      lu = (u - 0.7) / 0.3;
    }

    if (lane === LANE_HELIX_A || lane === LANE_HELIX_B) {
      const dir = lane === LANE_HELIX_A ? 1 : -1;
      const z = -22 + 44 * lu + Math.sin(t * 0.5 + f.phase) * 1.6;
      const bodyR = radiusAt((z + HEAD) / LEN) * R;
      const ang = (lane === LANE_HELIX_B ? Math.PI : 0) + t * 0.55 * dir + z * 0.14 * dir + f.jx * 0.2;
      const r = bodyR + 4.6 + Math.sin(t * 0.8 + f.phase) * 1.3 + f.jy * 0.6;
      out.set(Math.cos(ang) * r * 1.08, Math.sin(ang) * r * 0.9 + this.bodyWave(z, wv), z);
      return;
    }

    if (lane === LANE_HALO) {
      const ang = lu * TAU + t * 0.85;
      const z = 12 + Math.sin(t * 0.7 + lu * TAU * 2) * 2.5 + f.jz * 0.8;
      const r = 15.5 + Math.sin(ang * 3 + t * 1.3) * 2.2 + f.jx * 0.7;
      // slightly tilted ring = more elegant silhouette
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r * 0.78;
      out.set(x, y + this.bodyWave(z, wv) + x * 0.12, z + y * 0.12);
      return;
    }

    // RIBBON: comet tail flowing behind the flukes, widening as it trails
    const j = lu;
    const z = -HEAD - 5 - j * 44;
    const spread = 1 + j * 3.2;
    const x = Math.sin(t * 1.25 - j * 6.5 + 0.4) * (1.5 + j * 9) + f.jx * spread * 0.9;
    const y =
      this.bodyWave(-HEAD, wv) * (1 - j) +
      Math.cos(t * 1.05 - j * 5.2) * (1.2 + j * 5) +
      f.jy * spread * 0.7;
    out.set(x, y, z + f.jz * spread * 0.6);
  }

  update(
    dt: number,
    time: number,
    pod: WhalePod,
    o: FishOpts,
    haze: THREE.Color,
    hazeAmt: number,
  ) {
    this.uTime.value = time;
    this.uHaze.value.copy(haze);
    this.uHazeAmt.value = hazeAmt;
    this.mat.emissiveIntensity = 0.55 * o.glow;

    const n = Math.max(0, Math.min(MAX_FISH_PER_WHALE, Math.round(o.count)));
    const whales = pod.whales;

    for (let wi = 0; wi < whales.length; wi++) {
      const w = whales[wi];
      const active = w.root.visible && w.fade > 0.02 && n > 0;
      const wv = time * 1.2 + w.u.uPhase.value;
      this.whaleFwd.set(0, 0, 1).applyQuaternion(w.root.quaternion);
      const fadeK = Math.min(1, Math.max(0, w.fade));
      const size = 2.1 * o.size * fadeK * fadeK * (3 - 2 * fadeK);

      for (let k = 0; k < MAX_FISH_PER_WHALE; k++) {
        const id = wi * MAX_FISH_PER_WHALE + k;
        const f = this.fish[id];
        if (!active || k >= n) {
          if (f.alive) {
            f.alive = false;
            this.mesh.setMatrixAt(id, this.zero);
          }
          continue;
        }

        this.target(k, n, f, time + f.phase * 0.05, wv, this.tmp);
        w.root.localToWorld(this.tmp);

        if (!f.alive) {
          f.pos.copy(this.tmp);
          f.dir.copy(this.whaleFwd);
          f.alive = true;
        }

        // chase the formation slot with a personal lag => organic ripples
        this.prev.copy(f.pos);
        f.pos.lerp(this.tmp, 1 - Math.exp(-dt * f.rate));

        // face the real swimming direction (always at least a bit "forward")
        this.vel.subVectors(f.pos, this.prev);
        const sp = this.vel.length();
        if (sp > 1e-5) {
          this.vel.multiplyScalar(1 / sp).addScaledVector(this.whaleFwd, 0.35).normalize();
          f.dir.lerp(this.vel, 1 - Math.exp(-dt * 7)).normalize();
        }
        this.q.setFromUnitVectors(this.fwd, f.dir);
        this.s.setScalar(size * (0.8 + 0.4 * ((k * 0.618) % 1)));
        this.m4.compose(f.pos, this.q, this.s);
        this.mesh.setMatrixAt(id, this.m4);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
