import * as THREE from 'three';
import {
  RIVER,
  getRiverSeg,
  riverHalfW,
  riverSlope,
  riverV,
  riverX,
  smoothstep,
  waterSurfaceZ,
  type RiverSeg,
} from './noise';
import { FOG_U } from './fog';

// ---------------------------------------------------------------------------
// WATER RENDERER
//   • river ribbon rebuilt around the rider (follows the meander, flows +Z)
//   • waterfalls = the same ribbon bending into a free-falling arc, with
//     white streaky curtains, foam at the lip and churning white water below
//   • spring pools & oasis lakes as calm discs
//   • rainbows hovering in the waterfall mist (strongest with the sun behind you)
//
// Shading: fresnel sky reflection, sun glints, depth colour (deep → shallow),
// flowing foam lines whose speed follows the slope, soft edge foam.
// ---------------------------------------------------------------------------

export const WATER_PALETTES = [
  { name: 'Tosca', deep: '#0a5f73', shallow: '#46d6cf' },
  { name: 'Biru Laut', deep: '#10498c', shallow: '#56a9e6' },
  { name: 'Kristal', deep: '#3f97b8', shallow: '#c4f3ff' },
  { name: 'Zamrud', deep: '#0e6a4e', shallow: '#62e2a8' },
  { name: 'Senja', deep: '#5e3a78', shallow: '#f2a48c' },
];

export interface VisibleFall {
  lipX: number;
  lipZ: number;
  top: number;
  bottom: number;
  landX: number;
  landZ: number;
  hw: number;
  drop: number;
}

export interface WaterOpts {
  palette: number;
  flow: number;
  glint: number;
  foam: number;
  clarity: number;
  rainbow: number;
}

const MAX_ROWS = 1400;

const VERT = /* glsl */ `
  attribute float aSteep;
  attribute float aFoam;
  attribute vec3 aNormal;
  varying vec2 vUv;
  varying float vSteep;
  varying float vFoam;
  varying vec3 vWN;
  varying vec3 vWP;
  #include <fog_pars_vertex>
  void main(){
    vUv = uv;
    vSteep = aSteep;
    vFoam = aFoam;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    vWN = normalize(mat3(modelMatrix) * aNormal);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */ `
  uniform float uTime; uniform float uMode; uniform float uFlow; uniform float uGlint;
  uniform float uFoamK; uniform float uAlpha;
  uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSkyHi;
  uniform vec3 uFoamC; uniform vec3 uSunDir; uniform vec3 uSunC;
  varying vec2 vUv; varying float vSteep; varying float vFoam; varying vec3 vWN; varying vec3 vWP;
  #include <fog_pars_fragment>

  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p){ return vn(p) * 0.55 + vn(p * 2.1 + 7.3) * 0.3 + vn(p * 4.3 + 1.7) * 0.15; }

  void main(){
    float u = vUv.x;
    float v = vUv.y;
    float t = uTime;
    float speed = (2.4 + vSteep * 15.0) * uFlow;
    vec2 fp;
    float edge;
    if (uMode < 0.5) {
      fp = vec2(u * 5.0, v * 0.33 - t * speed * 0.33);
      edge = abs(u - 0.5) * 2.0;
    } else {
      fp = vWP.xz * 0.07 + vec2(sin(t * 0.05), -t * 0.06) * uFlow;
      edge = length(vUv - 0.5) * 2.0;
    }
    float n1 = fbm(fp);
    float n2 = fbm(fp * 2.6 + vec2(3.1, -t * 0.55 * uFlow));

    // ripple normal (small, flowing)
    vec3 N = normalize(vWN);
    N = normalize(N + vec3(n1 - 0.5, 0.0, n2 - 0.5) * (0.3 + vSteep * 0.5));
    vec3 V = normalize(cameraPosition - vWP);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    // Schlick fresnel for water (F0 = 0.02), capped so the river never turns into a
    // pale sky-coloured sheet when seen from a low angle
    float fres = min(0.02 + 0.98 * pow(1.0 - ndv, 5.0), 0.46);

    // body colour: rich deep centre, bright clear shallows near the shore
    float shore = smoothstep(0.3, 1.0, edge);
    vec3 body = mix(uDeep, uShallow, shore * 0.9 + (n1 - 0.5) * 0.14);
    // light dancing through the water (caustics)
    float caus = pow(clamp(fbm(fp * 2.2 + vec2(t * 0.25, -t * 0.4)), 0.0, 1.0), 3.0);
    body += uShallow * caus * 0.55 * (1.0 - vSteep);
    vec3 R = reflect(-V, N);
    vec3 refl = mix(uSky, uSkyHi, clamp(R.y * 1.4, 0.0, 1.0));
    refl = mix(refl, uShallow, 0.18); // reflections carry a little of the water's colour
    vec3 col = mix(body, refl, fres);

    // sun glints + tiny sparkles
    float spec = pow(max(dot(R, uSunDir), 0.0), 220.0);
    float sparkle = step(0.985, h21(floor(vWP.xz * 2.2 + floor(t * 6.0)))) * pow(max(dot(R, uSunDir), 0.0), 8.0);
    col += uSunC * (spec * 2.6 + sparkle * 1.2) * uGlint;

    // foam: shore, flowing lines, churning base below the falls
    float foamEdge = smoothstep(0.82, 0.99, edge + (n2 - 0.5) * 0.28);
    float lines = smoothstep(0.64, 0.72, fbm(vec2(u * 8.0, v * 0.7 - t * speed * 0.7))) * 0.28;
    float base = vFoam * smoothstep(0.25, 0.75, n1 + vFoam * 0.45);
    float foam = clamp((foamEdge * 0.7 + lines + base) * uFoamK, 0.0, 1.0);
    col = mix(col, uFoamC, foam);

    // WATERFALL CURTAIN: fast vertical streaks of white water over clear blue water
    float fs1 = fbm(vec2(u * 34.0, v * 0.09 - t * speed * 0.09));
    float fs2 = fbm(vec2(u * 71.0 + 5.0, v * 0.17 - t * speed * 0.2));
    float strands = smoothstep(0.38, 0.78, fs1 * 0.65 + fs2 * 0.45);
    vec3 fallCol = mix(uShallow * 1.05 + 0.08, uFoamC, strands);
    fallCol += uSunC * pow(max(dot(R, uSunDir), 0.0), 30.0) * 0.6 * uGlint;
    col = mix(col, fallCol, vSteep);

    float a = mix(0.8, 0.97, max(fres * 2.0, foam));
    a = mix(a, mix(0.62, 0.95, strands), vSteep);
    if (uMode > 0.5) a *= 1.0 - smoothstep(0.96, 1.0, edge);
    gl_FragColor = vec4(col, a * uAlpha);
    #include <fog_fragment>
  }`;

const RAINBOW_FRAG = /* glsl */ `
  uniform float uAlpha;
  varying vec2 vP;
  vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
  void main(){
    float r = length(vP);
    float t = (r - 0.74) / 0.26;
    if (t < 0.0 || t > 1.0) discard;
    vec3 c = hue(0.83 * (1.0 - t));
    float band = sin(t * 3.14159);
    float ends = smoothstep(0.0, 0.35, vP.y / max(r, 1e-3));
    gl_FragColor = vec4(c * band * ends * uAlpha, band * ends * uAlpha);
  }`;

export class RiverRenderer {
  group = new THREE.Group();
  falls: VisibleFall[] = [];
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private uv: Float32Array;
  private steep: Float32Array;
  private foam: Float32Array;
  private nrm: Float32Array;
  private idx: Uint32Array;
  private attrs: THREE.BufferAttribute[];
  private idxAttr: THREE.BufferAttribute;
  private lastZ = NaN;
  private discs: THREE.Mesh[] = [];
  private rainbows: { mesh: THREE.Mesh; u: { uAlpha: { value: number } } }[] = [];
  private shared: Record<string, { value: unknown }>;
  private matRibbon: THREE.ShaderMaterial;
  private matDisc: THREE.ShaderMaterial;
  private tmp = new THREE.Vector3();
  private deep = new THREE.Color();
  private shallow = new THREE.Color();

  constructor() {
    // ---- shared uniforms (both materials point at the same objects)
    this.shared = {
      uTime: { value: 0 },
      uFlow: { value: 1 },
      uGlint: { value: 1 },
      uFoamK: { value: 1 },
      uAlpha: { value: 1 },
      uDeep: { value: new THREE.Color(WATER_PALETTES[0].deep) },
      uShallow: { value: new THREE.Color(WATER_PALETTES[0].shallow) },
      uSky: { value: new THREE.Color('#a4c4da') },
      uSkyHi: { value: new THREE.Color('#2f5f9e') },
      uFoamC: { value: new THREE.Color('#f3fbff') },
      uSunDir: { value: new THREE.Vector3(0, 0.4, 1) },
      uSunC: { value: new THREE.Color('#fff1d4') },
    };
    const mkMat = (mode: number) =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          ...FOG_U,
          ...this.shared,
          uMode: { value: mode },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      });
    this.matRibbon = mkMat(0);
    this.matDisc = mkMat(1);

    // ---- ribbon buffers
    const nv = MAX_ROWS * 2;
    this.pos = new Float32Array(nv * 3);
    this.uv = new Float32Array(nv * 2);
    this.steep = new Float32Array(nv);
    this.foam = new Float32Array(nv);
    this.nrm = new Float32Array(nv * 3);
    this.idx = new Uint32Array((MAX_ROWS - 1) * 6);
    this.geo = new THREE.BufferGeometry();
    const pA = new THREE.BufferAttribute(this.pos, 3);
    const uA = new THREE.BufferAttribute(this.uv, 2);
    const sA = new THREE.BufferAttribute(this.steep, 1);
    const fA = new THREE.BufferAttribute(this.foam, 1);
    const nA = new THREE.BufferAttribute(this.nrm, 3);
    this.attrs = [pA, uA, sA, fA, nA];
    for (const a of this.attrs) a.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', pA);
    this.geo.setAttribute('uv', uA);
    this.geo.setAttribute('aSteep', sA);
    this.geo.setAttribute('aFoam', fA);
    this.geo.setAttribute('aNormal', nA);
    this.idxAttr = new THREE.BufferAttribute(this.idx, 1);
    this.idxAttr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setIndex(this.idxAttr);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const ribbon = new THREE.Mesh(this.geo, this.matRibbon);
    ribbon.frustumCulled = false;
    ribbon.renderOrder = 2;
    this.group.add(ribbon);

    // ---- pools & lakes
    const disc = new THREE.CircleGeometry(1, 72);
    disc.rotateX(-Math.PI / 2);
    const n = disc.attributes.position.count;
    disc.setAttribute('aSteep', new THREE.BufferAttribute(new Float32Array(n), 1));
    disc.setAttribute('aFoam', new THREE.BufferAttribute(new Float32Array(n), 1));
    const dn = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) dn[i * 3 + 1] = 1;
    disc.setAttribute('aNormal', new THREE.BufferAttribute(dn, 3));
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(disc, this.matDisc);
      m.frustumCulled = false;
      m.renderOrder = 2;
      m.visible = false;
      this.group.add(m);
      this.discs.push(m);
    }

    // ---- rainbows
    const rg = new THREE.RingGeometry(0.74, 1, 96, 1, 0, Math.PI);
    for (let i = 0; i < 3; i++) {
      const u = { uAlpha: { value: 0 } };
      const mat = new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: RAINBOW_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(rg, mat);
      m.frustumCulled = false;
      m.visible = false;
      m.renderOrder = 4;
      this.group.add(m);
      this.rainbows.push({ mesh: m, u });
    }
  }

  // --------------------------------------------------------------- ribbon
  private rebuild(pz: number) {
    const { SEG, DX } = RIVER;
    const zA = pz - 240;
    const zB = pz + 560;
    let rows = 0;
    let ii = 0;
    this.falls.length = 0;
    const zs: number[] = [];

    for (let n = Math.floor(zA / SEG); n <= Math.floor(zB / SEG); n++) {
      const seg = getRiverSeg(n);
      const z0 = Math.max(zA, seg.zs);
      const z1 = Math.min(zB, seg.ze);
      if (z0 >= z1) continue;
      // regular samples + dense samples through every waterfall arc
      zs.length = 0;
      for (let z = Math.ceil(z0 / DX) * DX; z <= z1; z += DX) zs.push(z);
      for (const f of seg.falls) {
        if (f.zl + f.run < z0 - 10 || f.zl > z1 + 10) continue;
        for (let k = 0; k <= 12; k++) {
          const z = f.zl + (f.run * k) / 12;
          if (z >= z0 && z <= z1) zs.push(z);
        }
        for (const dz of [-6, -3, -1.2]) if (f.zl + dz >= z0) zs.push(f.zl + dz);
        const drop = f.top - f.bottom;
        this.falls.push({
          lipX: riverX(f.zl),
          lipZ: f.zl,
          top: f.top,
          bottom: f.bottom,
          landX: riverX(f.zl + f.run),
          landZ: f.zl + f.run,
          hw: riverHalfW(f.zl - n * SEG, n),
          drop,
        });
      }
      zs.sort((a, b) => a - b);
      let first = true;
      let prevZ = -1e9;
      for (const z of zs) {
        if (z - prevZ < 0.05 || rows >= MAX_ROWS) continue;
        prevZ = z;
        this.writeRow(rows, seg, z);
        if (!first) {
          const a = (rows - 1) * 2;
          const b = rows * 2;
          this.idx[ii++] = a;
          this.idx[ii++] = b;
          this.idx[ii++] = a + 1;
          this.idx[ii++] = a + 1;
          this.idx[ii++] = b;
          this.idx[ii++] = b + 1;
        }
        first = false;
        rows++;
      }
    }
    for (const a of this.attrs) a.needsUpdate = true;
    this.idxAttr.needsUpdate = true;
    this.geo.setDrawRange(0, ii);
  }

  private writeRow(r: number, seg: RiverSeg, z: number) {
    const n = seg.n;
    const cx = riverX(z);
    const s = riverSlope(z);
    const inv = 1 / Math.sqrt(1 + s * s);
    const sx = inv;
    const sz = -s * inv;
    const u = z - n * RIVER.SEG;
    const y = waterSurfaceZ(seg, z);
    const dy = (waterSurfaceZ(seg, z + 0.25) - waterSurfaceZ(seg, z - 0.25)) / 0.5;
    let inArc = false;
    let foam = 0;
    for (const f of seg.falls) {
      const land = f.zl + f.run;
      if (z >= f.zl - 0.5 && z <= land) inArc = true;
      if (z >= land - 2 && z < land + 34) foam = Math.max(foam, Math.exp(-(z - land + 2) / 9));
      if (z > f.zl - 7 && z < f.zl) foam = Math.max(foam, 0.35 * smoothstep(f.zl - 7, f.zl, z));
    }
    const hw = riverHalfW(u, n) + (inArc ? 0.2 : 1.3);
    const v = riverV(seg, z);
    const steep = Math.min(1, Math.abs(dy) / 1.6);

    // normal = cross(tangent, side)
    const tl = Math.sqrt(s * s + dy * dy + 1);
    const tx = s / tl;
    const ty = dy / tl;
    const tz = 1 / tl;
    let nx = ty * sz - tz * 0;
    let ny = tz * sx - tx * sz;
    let nz = tx * 0 - ty * sx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }

    for (let side = 0; side < 2; side++) {
      const k = r * 2 + side;
      const sg = side === 0 ? -1 : 1;
      this.pos[k * 3] = cx + sx * hw * sg;
      this.pos[k * 3 + 1] = y;
      this.pos[k * 3 + 2] = z + sz * hw * sg;
      this.uv[k * 2] = side;
      this.uv[k * 2 + 1] = v;
      this.steep[k] = steep;
      this.foam[k] = foam;
      this.nrm[k * 3] = nx;
      this.nrm[k * 3 + 1] = ny;
      this.nrm[k * 3 + 2] = nz;
    }
  }

  // --------------------------------------------------------------- update
  update(
    time: number,
    player: THREE.Vector3,
    camera: THREE.Camera,
    o: WaterOpts,
    sky: THREE.Color,
    skyHi: THREE.Color,
    sunDir: THREE.Vector3,
    sunC: THREE.Color,
    glare: number,
  ) {
    const S = this.shared;
    S.uTime.value = time;
    S.uFlow.value = o.flow;
    S.uGlint.value = o.glint * glare;
    S.uFoamK.value = o.foam;
    S.uAlpha.value = 0.55 + 0.45 * o.clarity;
    const pal = WATER_PALETTES[((Math.round(o.palette) % WATER_PALETTES.length) + WATER_PALETTES.length) % WATER_PALETTES.length];
    // tint the water just slightly with the sky mood (keeps it clearly WATER-coloured)
    this.deep.set(pal.deep).lerp(skyHi, 0.08);
    this.shallow.set(pal.shallow).lerp(sky, 0.06);
    (S.uDeep.value as THREE.Color).copy(this.deep);
    (S.uShallow.value as THREE.Color).copy(this.shallow);
    (S.uSky.value as THREE.Color).copy(sky);
    (S.uSkyHi.value as THREE.Color).copy(skyHi);
    (S.uSunDir.value as THREE.Vector3).copy(sunDir);
    (S.uSunC.value as THREE.Color).copy(sunC);

    // ---- ribbon (rebuild as the rider travels)
    if (!(Math.abs(player.z - this.lastZ) < 6)) {
      this.rebuild(player.z);
      this.lastZ = player.z;
    }

    // ---- pools & lakes near the rider
    let d = 0;
    const { SEG } = RIVER;
    for (let n = Math.floor((player.z - 300) / SEG); n <= Math.floor((player.z + 600) / SEG) && d < this.discs.length; n++) {
      const seg = getRiverSeg(n);
      if (Math.abs(seg.poolZ - player.z) < 700 && d < this.discs.length) {
        const m = this.discs[d++];
        m.visible = true;
        m.position.set(seg.poolX, seg.poolLevel, seg.poolZ);
        m.scale.setScalar(RIVER.POOL_R + 1.3);
      }
      if (Math.abs(seg.lakeZ - player.z) < 700 && d < this.discs.length) {
        const m = this.discs[d++];
        m.visible = true;
        m.position.set(seg.lakeX, seg.lakeLevel, seg.lakeZ);
        m.scale.setScalar(RIVER.LAKE_R + 1.3);
      }
    }
    for (; d < this.discs.length; d++) this.discs[d].visible = false;

    // ---- rainbows in the mist of the nearest big falls
    const sorted = this.falls
      .filter((f) => f.drop > 4.5)
      .sort((a, b) => Math.abs(a.landZ - player.z) - Math.abs(b.landZ - player.z));
    for (let i = 0; i < this.rainbows.length; i++) {
      const rb = this.rainbows[i];
      const f = sorted[i];
      if (!f || o.rainbow <= 0.01) {
        rb.mesh.visible = false;
        continue;
      }
      rb.mesh.visible = true;
      const cy = f.bottom + 0.5;
      rb.mesh.position.set(f.landX, cy, f.landZ + 3);
      // face the camera horizontally, stay upright
      this.tmp.set(camera.position.x - f.landX, 0, camera.position.z - f.landZ);
      rb.mesh.rotation.set(0, Math.atan2(this.tmp.x, this.tmp.z), 0);
      rb.mesh.scale.setScalar(Math.min(26, f.drop * 1.15 + f.hw * 0.9));
      // rainbows sit opposite the sun: strongest when the sun is behind you
      this.tmp.set(f.landX - camera.position.x, cy - camera.position.y, f.landZ - camera.position.z).normalize();
      const anti = -this.tmp.dot(sunDir);
      const vis = 0.14 + 0.5 * smoothstep(-0.15, 0.65, anti);
      const dist = this.tmp.set(f.landX - player.x, 0, f.landZ - player.z).length();
      rb.u.uAlpha.value = vis * o.rainbow * Math.min(1, glare + 0.2) * (1 - smoothstep(180, 320, dist)) * 0.8;
    }
  }
}
