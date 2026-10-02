import * as THREE from 'three';
import { rideHeight as duneHeight } from './noise';

// ---------------------------------------------------------------------------
// SCARF / SLAYER
// A verlet rope with follow-the-leader constraints (inextensible, stable even
// at 100 km/h), rendered as a twisting ribbon with two skins:
//
//   CLOTH     - lit fabric with a sun-through-cloth gradient
//   ETHEREAL  - a ribbon of living light: translucent silk, flowing streaks,
//               a luminous hem, drifting sparkles, and a tip that dissolves
//               into light.
// ---------------------------------------------------------------------------

export const SCARF_COLORS = [
  { name: 'Crimson', hex: '#c42f3a' },
  { name: 'Gold', hex: '#e7ae45' },
  { name: 'Azure', hex: '#3d8fdc' },
  { name: 'Ivory', hex: '#f2e8d8' },
  { name: 'Indigo', hex: '#4a3a9e' },
  { name: 'Jade', hex: '#2ca58a' },
  { name: 'Rose', hex: '#e46f9a' },
  { name: 'Ember', hex: '#ff7a2e' },
];

export const ETHEREAL_SKINS = [
  { name: 'Merah', core: '#ff1c3a', edge: '#ff7a55', hi: '#ffe4d2' },
  { name: 'Darah Bulan', core: '#b3001b', edge: '#ff3b5c', hi: '#ffd0d8' },
  { name: 'Rose', core: '#ff3d8b', edge: '#ffa6d0', hi: '#fff0f7' },
  { name: 'Void', core: '#7a2bff', edge: '#ff4fc8', hi: '#ffe6ff' },
  { name: 'Aurora', core: '#1fe0b8', edge: '#7f8bff', hi: '#eafff9' },
  { name: 'Langit', core: '#3d9bff', edge: '#bfe6ff', hi: '#ffffff' },
  { name: 'Emas', core: '#ff9f1c', edge: '#ffe8a3', hi: '#ffffff' },
];

const N = 30;
const UPV = new THREE.Vector3(0, 1, 0);

export interface ScarfOpts {
  length: number;
  width: number;
  flutter: number;
}

function makeEmbroideryMaterial() {
  const u = {
    uTime: { value: 0 },
    uGlow: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        vN = normalMatrix * normal;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uGlow;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec2 uv = vUv; // x: lebar pita, y: leher -> ujung
        vec3 gold = vec3(1.0, 0.78, 0.32);
        // dasar: merah tua di leher -> oker hangat ke ujung (ala jubah Journey)
        vec3 base = mix(vec3(0.60, 0.12, 0.08), vec3(0.82, 0.33, 0.13), smoothstep(0.15, 0.95, uv.y));
        base += (h21(floor(uv * vec2(90.0, 200.0))) - 0.5) * 0.05; // tenunan halus
        // trim krem di tepi panjang & ujung pita
        float edge = smoothstep(0.09, 0.045, min(uv.x, 1.0 - uv.x));
        float hem = smoothstep(0.90, 0.93, uv.y);
        base = mix(base, vec3(0.93, 0.86, 0.72), clamp(max(edge, hem), 0.0, 1.0));
        // SULAMAN EMAS: diamond besar & kecil selang-seling + chevron dekat ujung
        float sym = 0.0;
        float cell = uv.y * 11.0;
        float ci = floor(cell);
        float cu = fract(cell) - 0.5;
        float d1 = abs(cu) * 0.9 + abs(uv.x - 0.5) * 1.1;
        sym = max(sym, smoothstep(0.30, 0.20, d1) * step(mod(ci, 2.0), 0.5));
        float d2 = abs(cu) * 0.9 + abs(uv.x - 0.5) * 1.5;
        sym = max(sym, smoothstep(0.22, 0.14, d2) * step(0.5, mod(ci, 2.0)));
        float ch = abs((uv.x - 0.5) * 1.5 + (uv.y - 0.82) * 2.6);
        sym = max(sym, smoothstep(0.16, 0.09, ch));
        float pulse = 0.72 + 0.28 * sin(uTime * 1.35 + uv.y * 11.0 + uv.x * 3.1);
        vec3 emb = gold * sym * uGlow * pulse * 1.9;
        // pencahayaan dua sisi + fresnel emas di lipatan
        vec3 N = normalize(vN);
        if (!gl_FrontFacing) N = -N;
        float diff = 0.52 + 0.48 * max(dot(N, normalize(vec3(0.35, 0.85, 0.4))), 0.0);
        float fres = pow(1.0 - abs(dot(N, normalize(vV))), 2.2);
        vec3 col = base * diff + gold * fres * 0.30 + emb;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  return { mat, u };
}

function makeEtherealMaterial() {
  const u = {
    uTime: { value: 0 },
    uCore: { value: new THREE.Color(ETHEREAL_SKINS[0].core) },
    uEdge: { value: new THREE.Color(ETHEREAL_SKINS[0].edge) },
    uHi: { value: new THREE.Color(ETHEREAL_SKINS[0].hi) },
    uGlow: { value: 1.3 },
    uAlpha: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        vN = normalMatrix * normal;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCore; uniform vec3 uEdge; uniform vec3 uHi;
      uniform float uGlow; uniform float uAlpha;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;

      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main(){
        float v = vUv.y;               // 0 = neck, 1 = tip
        float u = vUv.x;
        float ac = abs(u - 0.5) * 2.0; // 0 = centre line, 1 = hem
        float t = uTime;

        // silk flowing toward the tip
        float flow  = vn(vec2(u * 3.0, v * 7.0 - t * 1.4));
        float flow2 = vn(vec2(u * 6.0 + 3.1, v * 13.0 - t * 2.3));
        float streak = pow(0.5 + 0.5 * sin(v * 22.0 - t * 4.0 + u * 3.0 + flow * 3.0), 5.0);
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.8);

        vec3 col = mix(uCore, uEdge, clamp(smoothstep(0.15, 1.0, ac) * 0.8 + v * 0.25, 0.0, 1.0));
        col = mix(col, uHi, clamp(streak * 0.55 + fres * 0.35, 0.0, 1.0));
        col += uEdge * smoothstep(0.72, 0.98, ac) * 0.9;   // luminous hem

        // drifting sparkles
        float sp = step(0.975, h21(floor(vec2(u * 14.0, v * 70.0 - t * 5.0))));
        col += uHi * sp * 1.6;

        // alpha: soft hem, breathing silk, tip dissolving into light
        float a = 1.0 - smoothstep(0.82, 1.0, ac);
        a *= 0.45 + 0.35 * flow + 0.3 * streak + 0.2 * flow2;
        float dis = smoothstep(0.45, 1.0, v);
        float n = vn(vec2(u * 9.0, v * 24.0 - t * 2.6));
        a *= 1.0 - smoothstep(n - 0.12, n + 0.12, dis * 1.08);
        a = clamp(a * uAlpha + sp * 0.6 * (1.0 - dis), 0.0, 1.0);

        gl_FragColor = vec4(col * uGlow, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
  return { mat, u };
}

export class Scarf {
  mesh: THREE.Mesh;
  ethereal = false;
  private p: THREE.Vector3[] = [];
  private prev: THREE.Vector3[] = [];
  private pos: Float32Array;
  private nrm: Float32Array;
  private col: Float32Array;
  private posA: THREE.BufferAttribute;
  private nrmA: THREE.BufferAttribute;
  private colA: THREE.BufferAttribute;
  private clothMat: THREE.MeshStandardMaterial;
  private etherMat: THREE.ShaderMaterial;
  private eu: ReturnType<typeof makeEtherealMaterial>['u'];
  private embroideryMat: THREE.ShaderMaterial;
  private ju: ReturnType<typeof makeEmbroideryMaterial>['u'];
  private embroidered = false;
  private init = false;
  private phase: number;

  private dir = new THREE.Vector3();
  private sideB = new THREE.Vector3();
  private side = new THREE.Vector3();
  private bin = new THREE.Vector3();
  private n = new THREE.Vector3();
  private v = new THREE.Vector3();
  private acc = new THREE.Vector3();
  private before = new THREE.Vector3();
  private lat = new THREE.Vector3();
  private wind = new THREE.Vector3();
  private press = new THREE.Vector3();
  private baseColor = new THREE.Color();
  private tipColor = new THREE.Color();

  constructor(phase = 0) {
    this.phase = phase;
    for (let i = 0; i < N; i++) {
      this.p.push(new THREE.Vector3());
      this.prev.push(new THREE.Vector3());
    }
    this.pos = new Float32Array(N * 2 * 3);
    this.nrm = new Float32Array(N * 2 * 3);
    this.col = new Float32Array(N * 2 * 3);
    const uv = new Float32Array(N * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i < N; i++) {
      uv[i * 4] = 0;
      uv[i * 4 + 1] = i / (N - 1);
      uv[i * 4 + 2] = 1;
      uv[i * 4 + 3] = i / (N - 1);
      if (i < N - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(this.pos, 3);
    this.nrmA = new THREE.BufferAttribute(this.nrm, 3);
    this.colA = new THREE.BufferAttribute(this.col, 3);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    this.nrmA.setUsage(THREE.DynamicDrawUsage);
    this.colA.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posA);
    geo.setAttribute('normal', this.nrmA);
    geo.setAttribute('color', this.colA);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.clothMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0,
      emissive: new THREE.Color('#c42f3a'),
      emissiveIntensity: 0.06,
    });
    const em = makeEtherealMaterial();
    this.etherMat = em.mat;
    this.eu = em.u;
    const gm = makeEmbroideryMaterial();
    this.embroideryMat = gm.mat;
    this.ju = gm.u;

    this.mesh = new THREE.Mesh(geo, this.clothMat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.setColor(SCARF_COLORS[0].hex);
  }

  setColor(hex: string) {
    this.baseColor.set(hex);
    this.tipColor.copy(this.baseColor).lerp(new THREE.Color('#fff1dc'), 0.28);
    this.clothMat.emissive.copy(this.baseColor);
  }

  /** switch between the cloth and the ethereal skin */
  setSkin(ethereal: boolean, paletteIdx: number) {
    this.ethereal = ethereal;
    this.mesh.material = ethereal ? this.etherMat : this.embroidered ? this.embroideryMat : this.clothMat;
    const s = ETHEREAL_SKINS[((paletteIdx % ETHEREAL_SKINS.length) + ETHEREAL_SKINS.length) % ETHEREAL_SKINS.length];
    this.eu.uCore.value.set(s.core);
    this.eu.uEdge.value.set(s.edge);
    this.eu.uHi.value.set(s.hi);
  }

  /** sulaman emas ala Journey pada skin kain */
  setEmbroidery(on: boolean) {
    this.embroidered = on;
    if (!this.ethereal) this.mesh.material = on ? this.embroideryMat : this.clothMat;
  }

  /** kekuatan pendar sulaman emas */
  setGoldGlow(v: number) {
    this.ju.uGlow.value = v;
  }

  /** ethereal glow strength (follows the anti-glare controls) */
  setGlow(v: number) {
    this.eu.uGlow.value = 0.25 + 0.35 * v;
  }

  setVisible(v: boolean) {
    this.mesh.visible = v;
  }

  /** a point along the scarf, f = 0 (neck) .. 1 (tip) */
  pointAt(f: number, out: THREE.Vector3) {
    const i = Math.max(0, Math.min(N - 1, Math.floor(f * (N - 1))));
    return out.copy(this.p[i]);
  }

  private reset(anchor: THREE.Vector3, back: THREE.Vector3, seg: number) {
    for (let i = 0; i < N; i++) {
      this.p[i].copy(anchor).addScaledVector(back, seg * i);
      this.prev[i].copy(this.p[i]);
    }
    this.init = true;
  }

  update(dt: number, anchor: THREE.Vector3, back: THREE.Vector3, speed: number, time: number, o: ScarfOpts, vel?: THREE.Vector3) {
    const seg = o.length / (N - 1);
    if (!this.init || anchor.distanceTo(this.p[0]) > 25) this.reset(anchor, back, seg);
    this.eu.uTime.value = time + this.phase;
    this.ju.uTime.value = time + this.phase;

    this.p[0].copy(anchor);
    this.prev[0].copy(anchor);

    // ethereal silk is lighter: floats more, falls less
    const light = this.ethereal ? 0.55 : 1;
    // redaman lebih tinggi = kain tenang, tidak bergetar per frame
    const damp = Math.pow(this.ethereal ? 0.93 : 0.925, dt * 60);
    // ---- AERODINAMIKA: angin sembunyi (apparent wind) = -kecepatan rider.
    // Kain merasakan hembusan dari arah datangnya gerak — inilah yang membuat
    // selendang mengekori dengan benar saat ngebut / mengerem / jatuh.
    this.wind.set(
      -((vel && vel.x) || back.x * speed),
      -((vel && vel.y) || 0),
      -((vel && vel.z) || back.z * speed),
    );
    // hembusan ambient lembut (gust dua lapis) supaya kain tetap hidup saat pelan
    const gustK = Math.sin(time * 0.5 + this.phase) * 0.5 + Math.sin(time * 0.83 + this.phase * 2.1) * 0.5;
    this.wind.x += back.x * (2.5 + 1.8 * gustK);
    this.wind.z += back.z * (2.5 + 1.8 * gustK);
    const flut = o.flutter * (0.25 + Math.min(speed, 90) * 0.011); // lebih lembut dari sebelumnya
    this.lat.set(back.z, 0, -back.x);
    const dt2 = dt * dt;
    const t = time + this.phase;

    for (let i = 1; i < N; i++) {
      const f = i / (N - 1);
      this.v.subVectors(this.p[i], this.prev[i]).multiplyScalar(damp);
      this.prev[i].copy(this.p[i]);
      // gravitasi sungguhan (bukan angka ajaib)
      this.acc.set(0, -9.8 * light, 0);
      // gaya tekanan aerodinamis HANYA pada komponen angin yang tegak lurus
      // segmen (model bendera) → kain berkibar natural tanpa gaya dorong manual
      this.dir.subVectors(this.p[i], this.p[i - 1]);
      let len = this.dir.length() || 1e-4;
      this.dir.multiplyScalar(1 / len);
      this.press.copy(this.wind).addScaledVector(this.dir, -this.wind.dot(this.dir));
      const pl = this.press.length();
      if (pl > 0.02) {
        const k = (0.09 + o.width * 0.35) * Math.pow(Math.min(pl, 40), 1.5) * (0.35 + 0.65 * (1 - f * 0.5));
        this.acc.addScaledVector(this.press, k / pl);
      }
      // turbulensi lembut: sinus tak sinkron + fase berjalan sepanjang pita
      const fl = flut * f;
      this.acc.addScaledVector(this.lat, Math.sin(t * 5.3 - i * 0.55 + Math.sin(t * 0.71) * 1.4) * fl * 9);
      this.acc.y += Math.cos(t * 4.1 - i * 0.4 + Math.sin(t * 0.53)) * fl * 7;
      if (this.ethereal) this.acc.y += Math.sin(t * 1.7 - i * 0.2) * 3 * f; // gentle dreamy lift
      this.p[i].add(this.v).addScaledVector(this.acc, dt2);
    }

    // 3 iterasi follow-the-leader → panjang benar-benar konstan walau ngebut
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 1; i < N; i++) {
        this.before.copy(this.p[i]);
        this.dir.subVectors(this.p[i], this.p[i - 1]);
        const clen = this.dir.length() || 1e-4;
        this.p[i].copy(this.p[i - 1]).addScaledVector(this.dir, seg / clen);
        if (iter === 0) {
          const gy = duneHeight(this.p[i].x, this.p[i].z) + 0.12;
          if (this.p[i].y < gy) this.p[i].y = gy;
        }
        this.before.subVectors(this.p[i], this.before);
        this.prev[i].addScaledVector(this.before, iter === 0 ? 0.85 : 0.9);
      }
    }

    this.writeMesh(t, o);
  }

  private writeMesh(t: number, o: ScarfOpts) {
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      if (i < N - 1) this.dir.subVectors(this.p[i + 1], this.p[i]);
      else this.dir.subVectors(this.p[i], this.p[i - 1]);
      this.dir.normalize();

      this.sideB.crossVectors(this.dir, UPV);
      if (this.sideB.lengthSq() < 1e-4) this.sideB.set(1, 0, 0);
      this.sideB.normalize();
      this.bin.crossVectors(this.dir, this.sideB);

      const tw = Math.sin(t * 4.5 - i * 0.3) * 0.4 * o.flutter * f;
      this.side.copy(this.sideB).multiplyScalar(Math.cos(tw)).addScaledVector(this.bin, Math.sin(tw));

      // Streamlined profile: slender and elegantly tapered without widening in the middle.
      // Dua cincin pertama melebar → pita melebur mulus dari belitan kerah leher.
      const shape = this.ethereal ? (0.85 - 0.3 * f) : (0.9 - 0.35 * f);
      const root = i === 0 ? 1.05 : i === 1 ? 0.8 : shape;
      const w = o.width * root * 0.5;
      const k = i * 6;
      const p = this.p[i];
      this.pos[k] = p.x - this.side.x * w;
      this.pos[k + 1] = p.y - this.side.y * w;
      this.pos[k + 2] = p.z - this.side.z * w;
      this.pos[k + 3] = p.x + this.side.x * w;
      this.pos[k + 4] = p.y + this.side.y * w;
      this.pos[k + 5] = p.z + this.side.z * w;

      this.n.crossVectors(this.side, this.dir).normalize();
      for (let s = 0; s < 2; s++) {
        this.nrm[k + s * 3] = this.n.x;
        this.nrm[k + s * 3 + 1] = this.n.y;
        this.nrm[k + s * 3 + 2] = this.n.z;
        const c = f * f;
        this.col[k + s * 3] = this.baseColor.r + (this.tipColor.r - this.baseColor.r) * c;
        this.col[k + s * 3 + 1] = this.baseColor.g + (this.tipColor.g - this.baseColor.g) * c;
        this.col[k + s * 3 + 2] = this.baseColor.b + (this.tipColor.b - this.baseColor.b) * c;
      }
    }
    this.posA.needsUpdate = true;
    this.nrmA.needsUpdate = true;
    this.colA.needsUpdate = true;
  }
}
