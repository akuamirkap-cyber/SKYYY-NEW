import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TrailRibbon } from './fx';
import { duneHeight } from './noise';

// ---------------------------------------------------------------------------
// SKY WHALES
// Huge humpback whales gliding through the sky alongside the rider.
// Body = lathe, flukes / pectoral fins / dorsal = extruded shapes, merged into
// one geometry. A vertex shader makes them swim; a fragment hook adds rim
// light + atmospheric haze. They use MeshStandardMaterial, so EVERY scene
// light (sun, sky, bounce, fill, rim) lights them too.
// ---------------------------------------------------------------------------

export const LEN = 60;
export const HEAD = 30;
export const R = 6.4;

function smooth(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** body radius profile, t = 0 at the tail, 1 at the nose */
export function radiusAt(t: number): number {
  const pts: [number, number][] = [
    [0, 0.05],
    [0.08, 0.1],
    [0.2, 0.22],
    [0.35, 0.5],
    [0.5, 0.8],
    [0.64, 0.97],
    [0.76, 1],
    [0.86, 0.93],
    [0.93, 0.76],
    [0.975, 0.48],
    [1, 0.02],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, r0] = pts[i];
    const [t1, r1] = pts[i + 1];
    if (t >= t0 && t <= t1) return r0 + (r1 - r0) * smooth((t - t0) / (t1 - t0));
  }
  return 0.02;
}

function prep(g: THREE.BufferGeometry, fin: number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.clearGroups();
  // keep exactly the same attribute set on every part so merging succeeds
  for (const name of Object.keys(ng.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') ng.deleteAttribute(name);
  }
  const n = ng.attributes.position.count;
  ng.setAttribute('aFin', new THREE.BufferAttribute(new Float32Array(n).fill(fin), 1));
  return ng;
}

function buildWhaleGeometry(): THREE.BufferGeometry {
  // ---------- body (nose points to +Z)
  const prof: THREE.Vector2[] = [];
  const S = 60;
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    prof.push(new THREE.Vector2(Math.max(radiusAt(t) * R, 0.001), -HEAD + t * LEN));
  }
  const body = new THREE.LatheGeometry(prof, 32);
  body.rotateX(Math.PI / 2);
  // slightly flatten the body vertically – whales are wider than tall
  body.scale(1.08, 0.9, 1);

  // ---------- tail flukes (faceted crystalline gem flukes)
  const fs = new THREE.Shape();
  fs.moveTo(0, -1.8);
  fs.quadraticCurveTo(6, -0.8, 13.5, 6.8);
  fs.quadraticCurveTo(10, 7.8, 6.2, 6.2);
  fs.quadraticCurveTo(2.4, 5.2, 0, 6.4);
  fs.quadraticCurveTo(-2.4, 5.2, -6.2, 6.2);
  fs.quadraticCurveTo(-10, 7.8, -13.5, 6.8);
  fs.quadraticCurveTo(-6, -0.8, 0, -1.8);
  const flukes = new THREE.ExtrudeGeometry(fs, {
    depth: 0.55,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.3,
    bevelSegments: 2,
    curveSegments: 16,
  });
  flukes.translate(0, 0, -0.27);
  flukes.rotateX(-Math.PI / 2);
  flukes.translate(0, 0, -HEAD + 1.6);

  // ---------- long crystalline pectoral fins
  const ps = new THREE.Shape();
  ps.moveTo(0, 0);
  ps.quadraticCurveTo(7, -2.0, 20.5, -4.2);
  ps.quadraticCurveTo(22.0, -3.2, 20.2, -2.2);
  ps.quadraticCurveTo(9.5, 1.6, 0, 3.4);
  ps.lineTo(0, 0);
  const finR = new THREE.ExtrudeGeometry(ps, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.2,
    bevelSegments: 2,
    curveSegments: 16,
  });
  finR.translate(0, 0, -0.21);
  finR.rotateX(-Math.PI / 2);
  finR.rotateZ(-0.52);
  finR.translate(R * 0.7, -R * 0.38, 9);
  const finL = finR.clone();
  finL.scale(-1, 1, 1);

  // ---------- crystalline dorsal crest
  const ds = new THREE.Shape();
  ds.moveTo(0, 0);
  ds.quadraticCurveTo(1.6, 2.2, 4.8, 2.6);
  ds.quadraticCurveTo(3.2, 0.8, 5.8, 0);
  ds.lineTo(0, 0);
  const dorsal = new THREE.ExtrudeGeometry(ds, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, curveSegments: 10 });
  dorsal.translate(0, 0, -0.25);
  dorsal.rotateY(Math.PI / 2);
  dorsal.translate(0, R * 0.47 - 0.2, -7);

  const merged = mergeGeometries([prep(body, 0), prep(flukes, 0), prep(finR, 1), prep(finL, 1), prep(dorsal, 0)]);
  if (!merged) throw new Error('whale geometry merge failed');

  // ---------- vertex colors: celestial crystal gradients (deep sapphire, prismatic cyan, luminous diamond)
  const pos = merged.attributes.position;
  const nor = merged.attributes.normal;
  const cols = new Float32Array(pos.count * 3);
  const crystalSpine = new THREE.Color('#586ce0'); // sapphire / astral violet crystal
  const crystalDepth = new THREE.Color('#3246a8'); // deep gem interior
  const crystalBelly = new THREE.Color('#e0f6ff'); // luminous diamond glass
  const crystalCyan = new THREE.Color('#7ae8f5');  // aquamarine gem edge
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = nor.getY(i);
    let b = smooth((0.15 - ny) / 0.75);
    // crystalline throat pleats
    if (ny < -0.35 && z > 3 && z < 27) {
      b *= 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(x * 4.4));
    }
    // back gradient with aquamarine rim
    c.copy(crystalSpine).lerp(crystalDepth, 0.35).lerp(crystalBelly, b);
    if (Math.abs(x) > R * 0.7) {
      c.lerp(crystalCyan, 0.3);
    }
    // embedded twinkling diamond glints across the crystal skin
    const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1;
    if (h > 0.96) c.lerp(new THREE.Color('#ffffff'), 0.55);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  merged.computeBoundingSphere();
  return merged;
}

interface WhaleUniforms {
  uTime: { value: number };
  uPhase: { value: number };
  uAmp: { value: number };
  uHaze: { value: THREE.Color };
  uHazeAmt: { value: number };
  uRim: { value: THREE.Color };
  uGlow: { value: number };
}

function makeWhaleMaterial(): { mat: THREE.MeshPhysicalMaterial; u: WhaleUniforms } {
  const u: WhaleUniforms = {
    uTime: { value: 0 },
    uPhase: { value: Math.random() * 20 },
    uAmp: { value: 1.5 },
    uHaze: { value: new THREE.Color('#ffd9bd') },
    uHazeAmt: { value: 0.3 },
    uRim: { value: new THREE.Color('#d8f0ff') },
    uGlow: { value: 0.8 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.08,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    iridescence: 1.0,
    iridescenceIOR: 1.45,
    iridescenceThicknessRange: [180, 720],
    sheen: 0.6,
    sheenColor: new THREE.Color('#d4f0ff'),
    ior: 1.8,
    envMapIntensity: 2.2,
    emissive: new THREE.Color('#4678d4'),
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
    fog: false,
  });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime; uniform float uPhase; uniform float uAmp; attribute float aFin;
        varying vec3 vCrP;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float tw = clamp((${HEAD.toFixed(1)} - transformed.z) / ${LEN.toFixed(1)}, 0.0, 1.2);
          float w = uTime * 1.2 + uPhase;
          transformed.y += sin(w - transformed.z * 0.085) * uAmp * (0.22 + tw * tw * 2.6);
          transformed.y += aFin * sin(w * 0.8 + 1.4) * abs(transformed.x) * 0.3;
          vCrP = position;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec3 uHaze; uniform float uHazeAmt; uniform vec3 uRim; uniform float uGlow;
        varying vec3 vCrP;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        {
          vec3 V = normalize(vViewPosition);
          vec3 N = normalize(normal);
          float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
          float fres = pow(1.0 - ndv, 2.4);

          // 1. glassy deep crystal core
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.35, 0.45, 0.95) * 1.5, (1.0 - fres) * 0.45);

          // 2. prismatic rainbow dispersion along the silhouette
          vec3 prism = 0.5 + 0.5 * cos(6.28318 * (fres * 1.6 + vCrP.z * 0.035 + uTime * 0.06 + vec3(0.0, 0.33, 0.67)));
          gl_FragColor.rgb += uRim * prism * fres * 1.35 * uGlow;

          // 3. internal 3D crystal facets & twinkling gem sparkles
          vec3 q = floor(vCrP * 0.45);
          float h = fract(sin(dot(q, vec3(12.9898, 78.233, 45.543))) * 43758.5453);
          float ph = h * 60.0 + ndv * 18.0 + uTime * 1.4;
          float glint = pow(max(sin(ph), 0.0), 30.0) * step(0.64, h);
          gl_FragColor.rgb += vec3(0.95, 0.98, 1.0) * glint * 1.3 * uGlow;

          // 4. flowing celestial caustics through the crystal body
          float c = sin(vCrP.z * 0.16 + sin(vCrP.y * 0.28 + uTime * 0.75) * 1.6 + uTime * 0.6);
          c *= sin(vCrP.x * 0.22 - uTime * 0.5 + vCrP.z * 0.05);
          float caus = pow(abs(c), 7.0);
          gl_FragColor.rgb += vec3(0.55, 0.88, 1.0) * caus * 0.38 * uGlow;

          // 5. atmospheric haze blend
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, uHazeAmt);
        }`,
      );
  };
  return { mat, u };
}

export interface Whale {
  root: THREE.Group;
  u: WhaleUniforms;
  /** orbit phase inside the pod */
  angle: number;
  /** how wide this whale roams inside the pod */
  radius: number;
  /** extra altitude */
  height: number;
  /** base distance ahead of the rider */
  ahead: number;
  /** base lateral offset */
  side: number;
  speed: number;
  dir: number;
  phase: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  roll: number;
  yawPrev: number;
  fade: number;
  trail: TrailRibbon;
  seeded: boolean;
}

export interface WhaleOpts {
  count: number;
  size: number;
  height: number;
  speed: number;
  glow: number;
  haze: number;
}

// Hand-placed pod layout so the first whales always land in a beautiful,
// clearly visible spot in front of the camera.
const LAYOUT: { ahead: number; side: number; height: number }[] = [
  { ahead: 210, side: -60, height: 58 },
  { ahead: 290, side: 110, height: 88 },
  { ahead: 170, side: 150, height: 44 },
  { ahead: 340, side: -170, height: 110 },
  { ahead: 250, side: 20, height: 130 },
  { ahead: 150, side: -190, height: 70 },
];

export class WhalePod {
  group = new THREE.Group();
  readonly whales: Whale[] = [];
  private podYaw = 0;
  private init = false;
  private t1 = new THREE.Vector3();
  private t2 = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private q = new THREE.Quaternion();
  private trailColor = new THREE.Color();
  private white = new THREE.Color('#ffffff');

  constructor(max = 6) {
    const geo = buildWhaleGeometry();
    for (let i = 0; i < max; i++) {
      const { mat, u } = makeWhaleMaterial();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      const root = new THREE.Group();
      root.add(mesh);
      root.visible = false;
      this.group.add(root);
      const trail = new TrailRibbon(150, 2.5, 0xfff1e0, 3.2, false, 0.22);
      trail.mesh.visible = false;
      this.group.add(trail.mesh);
      const L = LAYOUT[i % LAYOUT.length];
      this.whales.push({
        root,
        u,
        angle: Math.random() * Math.PI * 2,
        radius: 40 + Math.random() * 45,
        height: L.height,
        ahead: L.ahead,
        side: L.side,
        speed: 7 + Math.random() * 5,
        dir: Math.random() < 0.5 ? -1 : 1,
        phase: Math.random() * 100,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        roll: 0,
        yawPrev: 0,
        fade: 1,
        trail,
        seeded: false,
      });
    }
  }

  /**
   * @param yaw   rider heading – the pod keeps itself in front of the camera
   * @param haze  atmosphere color whales fade toward
   * @param rim   rim light color
   */
  update(
    dt: number,
    time: number,
    player: THREE.Vector3,
    yaw: number,
    o: WhaleOpts,
    haze: THREE.Color,
    rim: THREE.Color,
    cam: THREE.Vector3,
  ) {
    // pod heading follows the rider slowly (so turns feel like a big, lazy swing)
    if (!this.init) {
      this.podYaw = yaw;
      this.init = true;
    }
    let dy = yaw - this.podYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.podYaw += dy * (1 - Math.exp(-dt * 0.4));
    const fx = Math.sin(this.podYaw);
    const fz = Math.cos(this.podYaw);
    const rx = fz;
    const rz = -fx;

    this.trailColor.copy(haze).lerp(this.white, 0.55);

    for (let i = 0; i < this.whales.length; i++) {
      const w = this.whales[i];
      const active = i < o.count;
      w.fade += ((active ? 1 : 0) - w.fade) * (1 - Math.exp(-dt * 1.2));
      if (!active && w.fade < 0.01) {
        w.root.visible = false;
        w.trail.mesh.visible = false;
        w.seeded = false;
        continue;
      }
      w.root.visible = true;
      w.trail.mesh.visible = true;

      // ---------- target: a lazy loop inside the pod, positioned relative to the rider
      w.angle += (w.dir * w.speed * o.speed * dt) / w.radius;
      const spread = 0.75 + o.size * 0.25; // bigger whales need more room
      const ahead = (w.ahead + Math.cos(w.angle) * w.radius) * spread;
      const side = (w.side + Math.sin(w.angle) * w.radius) * spread;
      const tx = player.x + fx * ahead + rx * side;
      const tz = player.z + fz * ahead + rz * side;
      let ty = player.y + w.height * o.height + Math.sin(time * 0.17 + w.phase) * 9;
      // always keep clear of the dunes below
      const floor = duneHeight(tx, tz) + 26 * o.size;
      if (ty < floor) ty = floor;
      this.t2.set(tx, ty, tz);

      if (!w.seeded) {
        w.pos.copy(this.t2);
        w.vel.set(fx, 0, fz);
        w.yawPrev = Math.atan2(fx, fz);
        w.root.quaternion.setFromEuler(this.euler.set(0, w.yawPrev, 0));
        w.seeded = true;
        w.trail.reset(w.pos, rx, rz, 0);
      }

      // ---------- glide there, heading from real motion
      this.t1.copy(w.pos);
      w.pos.lerp(this.t2, 1 - Math.exp(-dt * 1.4));
      this.t1.subVectors(w.pos, this.t1).divideScalar(Math.max(dt, 1e-4));
      // blend in the pod's forward direction so whales always read as "swimming"
      this.t1.x += fx * 6;
      this.t1.z += fz * 6;
      w.vel.lerp(this.t1, 1 - Math.exp(-dt * 1.2));

      const horiz = Math.hypot(w.vel.x, w.vel.z);
      if (horiz > 0.05) {
        const wy = Math.atan2(w.vel.x, w.vel.z);
        let d = wy - w.yawPrev;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        w.yawPrev = wy;
        const rollT = Math.max(-0.4, Math.min(0.4, (-d / Math.max(dt, 1e-4)) * 1.4));
        w.roll += (rollT - w.roll) * (1 - Math.exp(-dt * 1.2));
        const pitch = -Math.atan2(w.vel.y, horiz) * 0.6 + Math.sin(time * 0.4 + w.phase) * 0.07;
        this.euler.set(pitch, wy, w.roll);
        this.q.setFromEuler(this.euler);
        w.root.quaternion.slerp(this.q, 1 - Math.exp(-dt * 1.5));
      }

      const scale = o.size * smooth(w.fade);
      w.root.position.copy(w.pos);
      w.root.scale.setScalar(Math.max(scale, 1e-4));
      w.root.updateMatrixWorld(true);

      // ---------- shader params
      w.u.uTime.value = time;
      w.u.uHaze.value.copy(haze);
      w.u.uRim.value.copy(rim);
      w.u.uGlow.value = 0.6 * o.glow;
      const dist = w.pos.distanceTo(cam);
      w.u.uHazeAmt.value = Math.min(0.4, Math.max(0.02, (0.02 + dist / 2200) * o.haze));

      // ---------- mist ribbon from the flukes
      const wv = time * 1.2 + w.u.uPhase.value;
      const tailZ = -HEAD - 4;
      const tw = Math.min(1.2, (HEAD - tailZ) / LEN);
      this.t1.set(0, Math.sin(wv - tailZ * 0.085) * 1.5 * (0.22 + tw * tw * 2.6), tailZ);
      w.root.localToWorld(this.t1);
      const inv = 1 / Math.max(horiz, 1e-4);
      w.trail.setColor(this.trailColor);
      w.trail.tick(dt);
      w.trail.push(this.t1, w.vel.z * inv, -w.vel.x * inv, 2.4 * scale);
    }
  }

  setEnv(tex: THREE.Texture) {
    for (const w of this.whales) {
      const mesh = w.root.children[0] as THREE.Mesh;
      if (mesh && mesh.material) {
        (mesh.material as THREE.MeshPhysicalMaterial).envMap = tex;
      }
    }
  }
}
