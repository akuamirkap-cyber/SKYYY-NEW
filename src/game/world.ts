import * as THREE from 'three';
import type { Palette } from './palette';
import {
  NO_WATER,
  RUN,
  baseDune,
  biomeWeights,
  chasmAt,
  chasmOfSeg,
  duneHeight,
  pathX,
  worldSample,
  type Chasm,
  type WorldSample,
} from './noise';

// ---------------------------------------------------------------------------
// CHASM MARKERS: a row of glowing crystal posts on both lips of every chasm,
// warm on the take-off side, cool on the landing side, so the gaps read from
// far away (the Alto "cliff edge" moment).
// ---------------------------------------------------------------------------
export class ChasmMarkers {
  group = new THREE.Group();
  private posts: THREE.InstancedMesh;
  private caps: THREE.InstancedMesh;
  private mat: THREE.MeshStandardMaterial;
  private capMat: THREE.MeshStandardMaterial;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private ch: Chasm = { z0: 0, z1: 0, zc: 0, w: 0, id: 0 };
  private cap = 120;

  constructor() {
    const pg = new THREE.CylinderGeometry(0.16, 0.32, 1, 6);
    pg.translate(0, 0.5, 0);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x6b5a72,
      roughness: 0.6,
      metalness: 0.1,
      flatShading: true,
    });
    this.posts = new THREE.InstancedMesh(pg, this.mat, this.cap);
    this.posts.frustumCulled = false;
    this.capMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 2.4,
      roughness: 0.3,
    });
    this.caps = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.42, 0), this.capMat, this.cap);
    this.caps.frustumCulled = false;
    for (let i = 0; i < this.cap; i++) {
      this.posts.setMatrixAt(i, this.zero);
      this.caps.setMatrixAt(i, this.zero);
      this.caps.setColorAt(i, this.c.set(0xffffff));
    }
    this.group.add(this.posts, this.caps);
  }

  setGlow(v: number) {
    this.capMat.emissiveIntensity = 2.4 * v;
  }

  update(pz: number, time: number) {
    let k = 0;
    const n0 = Math.floor((pz - 120) / RUN.L);
    const n1 = Math.floor((pz + 520) / RUN.L);
    for (let n = n0; n <= n1 && k < this.cap - 16; n++) {
      const c = chasmOfSeg(n, this.ch);
      if (!c) continue;
      for (let side = 0; side < 2; side++) {
        const z = side === 0 ? c.z0 - 1.6 : c.z1 + 1.6;
        const cx = pathX(z);
        for (let j = -3; j <= 3; j++) {
          const x = cx + j * 13 + (side ? 6.5 : 0);
          const y = baseDune(x, z);
          const hgt = 2.6 + (Math.abs(j) === 3 ? 2.2 : 0);
          this.v.set(x, y - 0.3, z);
          this.q.identity();
          this.s.set(1, hgt, 1);
          this.m4.compose(this.v, this.q, this.s);
          this.posts.setMatrixAt(k, this.m4);
          const bob = Math.sin(time * 2.2 + j + side * 1.7) * 0.18;
          this.v.set(x, y + hgt + 0.25 + bob, z);
          this.q.setFromAxisAngle(this.s.set(0, 1, 0), time * 1.3 + j);
          this.s.set(1, 1.5, 1);
          this.m4.compose(this.v, this.q, this.s);
          this.caps.setMatrixAt(k, this.m4);
          this.caps.setColorAt(k, this.c.set(side === 0 ? 0xffb35c : 0x8fe6ff));
          k++;
        }
      }
    }
    for (let i = k; i < this.cap; i++) {
      this.posts.setMatrixAt(i, this.zero);
      this.caps.setMatrixAt(i, this.zero);
    }
    this.posts.instanceMatrix.needsUpdate = true;
    this.caps.instanceMatrix.needsUpdate = true;
    if (this.caps.instanceColor) this.caps.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Sky dome - every color is a uniform so palettes can cross-fade live
// ---------------------------------------------------------------------------
export class SkyDome {
  mesh: THREE.Mesh;
  uTop = { value: new THREE.Color('#2f5f9e') };
  uMid = { value: new THREE.Color('#a4c4da') };
  uHor = { value: new THREE.Color('#ffd2a2') };
  uLow = { value: new THREE.Color('#ff9f6c') };
  uSunTint = { value: new THREE.Color('#fff1d4') };
  uSun = { value: new THREE.Vector3(0, 0.3, 1) };
  uGlow = { value: 1 };
  uStars = { value: 0 };
  uDisc = { value: 1 };
  uFogCol = { value: new THREE.Color('#ffd9bd') };
  uFogAmt = { value: 0.3 };

  /** blend the lower sky into the fog color so the horizon melts into the mist */
  setFog(c: THREE.Color, amt: number) {
    this.uFogCol.value.copy(c);
    this.uFogAmt.value = amt;
  }

  /** brightness of the sun DISC only (halo stays) – main glare source in the sky */
  setDisc(v: number) {
    this.uDisc.value = v;
  }

  constructor() {
    const geo = new THREE.SphereGeometry(900, 48, 28);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: this.uTop,
        uMid: this.uMid,
        uHor: this.uHor,
        uLow: this.uLow,
        uSun: this.uSun,
        uSunTint: this.uSunTint,
        uGlow: this.uGlow,
        uStars: this.uStars,
        uDisc: this.uDisc,
        uFogCol: this.uFogCol,
        uFogAmt: this.uFogAmt,
      },
      vertexShader: `
        varying vec3 vDir;
        void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uLow;
        uniform vec3 uSun; uniform vec3 uSunTint; uniform float uGlow; uniform float uStars; uniform float uDisc;
        uniform vec3 uFogCol; uniform float uFogAmt;
        varying vec3 vDir;

        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }

        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;

          vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.40, h));
          c = mix(c, uTop, smoothstep(0.20, 0.95, h));
          c = mix(uLow, c, smoothstep(-0.42, 0.015, h));

          // horizon melts into the fog gently without wiping out the sky
          float fogBand = 1.0 - smoothstep(-0.05, 0.02 + 0.16 * clamp(uFogAmt, 0.0, 1.0), h);
          c = mix(c, uFogCol, fogBand * 0.45);

          // sun disc + crisp halo (no overly broad white washout across the sky)
          float s = max(dot(d, normalize(uSun)), 0.0);
          c += uSunTint * pow(s, 1600.0) * 5.0 * uGlow * uDisc;
          c += uSunTint * pow(s, 140.0) * 0.65 * uGlow * uDisc;
          c += uSunTint * pow(s, 36.0) * 0.20 * uGlow * uDisc;

          // stars (night moods)
          if (uStars > 0.001) {
            vec3 sp = floor(d * 420.0);
            float st = hash(sp);
            float tw = 0.6 + 0.4 * sin(uGlow * 0.0 + st * 90.0);
            float star = smoothstep(0.9975, 1.0, st) * uStars * tw;
            c += vec3(0.85, 0.92, 1.0) * star * smoothstep(0.02, 0.45, h) * 1.6;
          }

          // gentle dither kills gradient banding
          float dith = fract(sin(dot(d.xy * 780.0, vec2(12.9898, 78.233))) * 43758.5453);
          c += (dith - 0.5) * 0.012;

          gl_FragColor = vec4(c, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  apply(
    top: THREE.Color,
    mid: THREE.Color,
    hor: THREE.Color,
    low: THREE.Color,
    tint: THREE.Color,
    glow: number,
    stars: number,
    dir: THREE.Vector3,
  ) {
    this.uTop.value.copy(top);
    this.uMid.value.copy(mid);
    this.uHor.value.copy(hor);
    this.uLow.value.copy(low);
    this.uSunTint.value.copy(tint);
    this.uGlow.value = glow;
    this.uStars.value = stars;
    this.uSun.value.copy(dir);
  }
}

// ---------------------------------------------------------------------------
// Clouds ---------------------------------------------------------------------
// ---------------------------------------------------------------------------
export class CloudLayer {
  group = new THREE.Group();
  private mats: THREE.SpriteMaterial[] = [];
  private sprites: THREE.Sprite[] = [];
  private tint = new THREE.Color('#ffffff');

  constructor() {
    const tex = makeCloudTexture();
    for (let i = 0; i < 15; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.3 + Math.random() * 0.28,
        depthWrite: false,
        fog: false,
        color: 0xffffff,
      });
      const s = new THREE.Sprite(mat);
      const a = Math.random() * Math.PI * 2;
      const r = 360 + Math.random() * 400;
      s.position.set(Math.cos(a) * r, 55 + Math.random() * 230, Math.sin(a) * r);
      const w = 240 + Math.random() * 340;
      s.scale.set(w, w * (0.2 + Math.random() * 0.13), 1);
      this.group.add(s);
      this.sprites.push(s);
      this.mats.push(mat);
    }
  }

  setTint(c: THREE.Color, mul: number) {
    this.tint.copy(c).multiplyScalar(mul);
    for (let i = 0; i < this.mats.length; i++) {
      this.mats[i].color.copy(this.tint);
      this.mats[i].opacity = (0.26 + (i % 4) * 0.06) * mul;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].position.x += dt * (2 + (i % 3));
      if (this.sprites[i].position.x > 840) this.sprites[i].position.x -= 1680;
    }
  }
}

function makeCloudTexture(): THREE.Texture {
  const w = 256;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 30; i++) {
    const x = 26 + Math.random() * (w - 52);
    const y = 38 + Math.random() * 54;
    const r = 16 + Math.random() * 44;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Ancient megalith statues, stone arches, ruins & boulders -------------------
// ---------------------------------------------------------------------------
export type CollisionOutcome =
  | 'bounce'
  | 'clear'
  | 'statue_bounce'
  | 'statue_clear'
  | 'arch_glide'
  | 'arch_leap'
  | 'crash'
  | 'near_miss'
  | 'none';

interface ObstacleItem {
  x: number;
  z: number;
  y: number;
  h: number;
  r: number;
  rot: number;
  seed: number;
  type: 'rock' | 'ruin' | 'statue' | 'arch';
  cleared: boolean;
}

function mergeBufferGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geos) {
    totalVerts += g.getAttribute('position').count;
    if (g.index) totalIndices += g.index.count;
  }
  const pos = new Float32Array(totalVerts * 3);
  const nrm = new Float32Array(totalVerts * 3);
  const idx = new Uint32Array(totalIndices);
  let vOff = 0;
  let iOff = 0;
  for (const g of geos) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    pos.set(p.array as Float32Array, vOff * 3);
    if (n) nrm.set(n.array as Float32Array, vOff * 3);
    if (g.index) {
      for (let k = 0; k < g.index.count; k++) {
        idx[iOff + k] = g.index.getX(k) + vOff;
      }
      iOff += g.index.count;
    }
    vOff += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nrm.length > 0) out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export class Monoliths {
  group = new THREE.Group();
  items: ObstacleItem[] = [];
  private stones: THREE.InstancedMesh;
  private beacons: THREE.InstancedMesh;
  private boulders: THREE.InstancedMesh;
  private statues: THREE.InstancedMesh;
  private statueEyes: THREE.InstancedMesh;
  private arches: THREE.InstancedMesh;

  private countRuin: number;
  private countRock = 9; // batu lebih jarang = downhill aman ala Alto
  private countStatue = 8;
  private countArch = 6;

  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private axis = new THREE.Vector3(0, 1, 0);
  private eu = new THREE.Euler();
  private beaconMat!: THREE.MeshStandardMaterial;
  private eyeMat!: THREE.MeshStandardMaterial;
  private ws: WorldSample = { h: 0, level: NO_WATER, surf: NO_WATER, e: 1e9 };

  /** glowing beacon and statue eye brightness */
  setGlow(v: number) {
    this.beaconMat.emissiveIntensity = 2.4 * v;
    this.eyeMat.emissiveIntensity = 2.8 * v;
  }

  constructor(ruinCount = 8) {
    this.countRuin = ruinCount;

    // 1. Ancient temple ruins pillars
    const stoneGeo = new THREE.CylinderGeometry(0.75, 1.05, 1, 6, 1);
    stoneGeo.translate(0, 0.5, 0);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x6e6359,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
      emissive: new THREE.Color(0x221a16),
      emissiveIntensity: 0.35,
    });
    this.stones = new THREE.InstancedMesh(stoneGeo, stoneMat, this.countRuin);
    this.stones.frustumCulled = false;

    // Beacons floating above ruins
    const beaconGeo = new THREE.OctahedronGeometry(1, 0);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xd8f6ff,
      emissive: new THREE.Color(0x7fe4ff),
      emissiveIntensity: 2.4,
      roughness: 0.3,
      metalness: 0,
    });
    this.beacons = new THREE.InstancedMesh(beaconGeo, beaconMat, this.countRuin);
    this.beacons.frustumCulled = false;
    this.beaconMat = beaconMat;

    // 2. Mountain & desert rocks / boulders (Alto's Odyssey obstacles to dodge or jump over)
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x7a6b5d,
      roughness: 0.95,
      metalness: 0.02,
      flatShading: true,
      emissive: new THREE.Color(0x1c1713),
      emissiveIntensity: 0.25,
    });
    this.boulders = new THREE.InstancedMesh(rockGeo, rockMat, this.countRock);
    this.boulders.frustumCulled = false;

    // 3. Patung Megalit (Ancient Carved Colossus Statues / Megalith Idols)
    // Carved stone head, brow, nose and torso
    const gBase = new THREE.CylinderGeometry(1.6, 2.0, 1.4, 7);
    gBase.translate(0, 0.7, 0);
    const gTorso = new THREE.BoxGeometry(2.4, 3.4, 1.8);
    gTorso.translate(0, 3.0, 0);
    const gHead = new THREE.BoxGeometry(1.9, 2.5, 1.9);
    gHead.translate(0, 5.8, 0);
    const gBrow = new THREE.BoxGeometry(1.7, 0.45, 0.5);
    gBrow.translate(0, 6.4, 0.95);
    const gNose = new THREE.BoxGeometry(0.55, 1.2, 0.6);
    gNose.translate(0, 5.8, 1.05);
    const gCrown = new THREE.CylinderGeometry(0.7, 1.1, 0.9, 6);
    gCrown.translate(0, 7.4, 0);

    const statueGeo = mergeBufferGeometries([gBase, gTorso, gHead, gBrow, gNose, gCrown]);
    const statueMat = new THREE.MeshStandardMaterial({
      color: 0x685e54,
      roughness: 0.94,
      metalness: 0.04,
      flatShading: true,
      emissive: new THREE.Color(0x211c18),
      emissiveIntensity: 0.3,
    });
    this.statues = new THREE.InstancedMesh(statueGeo, statueMat, this.countStatue);
    this.statues.frustumCulled = false;

    // Glowing eyes / arcane relics on the Megalith statues
    const eyeGeo = new THREE.OctahedronGeometry(0.35, 0);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xaff5ff,
      emissive: new THREE.Color(0x5be4ff),
      emissiveIntensity: 2.8,
      roughness: 0.2,
      metalness: 0,
    });
    this.statueEyes = new THREE.InstancedMesh(eyeGeo, eyeMat, this.countStatue);
    this.statueEyes.frustumCulled = false;
    this.eyeMat = eyeMat;

    // 4. Gerbang Batu Megalit (Megalith Dolmen / Stone Trilithon Arches)
    const pLeft = new THREE.CylinderGeometry(0.75, 0.95, 6.8, 6);
    pLeft.translate(-3.1, 3.4, 0);
    const pRight = new THREE.CylinderGeometry(0.75, 0.95, 6.8, 6);
    pRight.translate(3.1, 3.4, 0);
    const lintel = new THREE.BoxGeometry(8.2, 1.3, 1.9);
    lintel.translate(0, 7.3, 0);
    const archGeo = mergeBufferGeometries([pLeft, pRight, lintel]);
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x5e564d,
      roughness: 0.93,
      metalness: 0.05,
      flatShading: true,
      emissive: new THREE.Color(0x1a1613),
      emissiveIntensity: 0.28,
    });
    this.arches = new THREE.InstancedMesh(archGeo, archMat, this.countArch);
    this.arches.frustumCulled = false;

    this.group.add(this.stones);
    // CATATAN: "permata melayang di atas reruntuhan" (beacons) sengaja DIHAPUS
    // dari scene — permata sekarang hanya yang bisa diambil (EnergyCrystals).
    this.group.add(this.boulders);
    this.group.add(this.statues);
    this.group.add(this.statueEyes);
    this.group.add(this.arches);

    // Initialize ruins - spaced far apart as ancient monuments
    for (let i = 0; i < this.countRuin; i++) {
      this.items.push({
        x: 0,
        z: 0,
        y: 0,
        h: 12,
        r: 3,
        rot: 0,
        seed: Math.random() * 100,
        type: 'ruin',
        cleared: false,
      });
      this.placeRuin(i, 0, 0, (i / this.countRuin) * 1300 + 180);
    }

    // Initialize boulders
    for (let i = 0; i < this.countRock; i++) {
      this.items.push({
        x: 0,
        z: 0,
        y: 0,
        h: 1.8,
        r: 1.6,
        rot: 0,
        seed: Math.random() * 100,
        type: 'rock',
        cleared: false,
      });
      this.placeRock(this.countRuin + i, 0, 0, (i / this.countRock) * 1200 + 120);
    }

    // Initialize statues - spaced far apart
    for (let i = 0; i < this.countStatue; i++) {
      this.items.push({
        x: 0,
        z: 0,
        y: 0,
        h: 9,
        r: 2.6,
        rot: 0,
        seed: Math.random() * 100,
        type: 'statue',
        cleared: false,
      });
      this.placeStatue(this.countRuin + this.countRock + i, 0, 0, (i / this.countStatue) * 1400 + 260);
    }

    // Initialize arches
    for (let i = 0; i < this.countArch; i++) {
      this.items.push({
        x: 0,
        z: 0,
        y: 0,
        h: 8,
        r: 4.2,
        rot: 0,
        seed: Math.random() * 100,
        type: 'arch',
        cleared: false,
      });
      this.placeArch(this.countRuin + this.countRock + this.countStatue + i, 0, 0, (i / this.countArch) * 1500 + 360);
    }
  }

  private placeRuin(i: number, px: number, pz: number, dist: number) {
    void px;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 8; tries++) {
      z = pz + dist + (Math.random() - 0.5) * 50;
      x = pathX(z) + (Math.random() - 0.5) * 160;
      const c = chasmAt(z);
      const nearGap = c !== null && z > c.z0 - 28 && z < c.z1 + 16;
      worldSample(x, z, this.ws);
      if (!nearGap && (this.ws.level === NO_WATER || this.ws.e > 14)) break;
    }
    const it = this.items[i];
    it.x = x;
    it.z = z;
    it.y = duneHeight(x, z);
    it.h = 10 + Math.random() * 18;
    it.r = 2.4 + Math.random() * 2.5;
    it.rot = Math.random() * Math.PI * 2;
    it.seed = Math.random() * 100;
    it.cleared = false;

    this.q.setFromAxisAngle(this.axis, it.rot);
    this.v.set(it.x, it.y - 1.2, it.z);
    this.sc.set(it.r, it.h, it.r * 0.85);
    this.m4.compose(this.v, this.q, this.sc);
    this.stones.setMatrixAt(i, this.m4);
    this.stones.instanceMatrix.needsUpdate = true;
  }

  private placeRock(itemIdx: number, px: number, pz: number, dist: number) {
    void px;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 8; tries++) {
      z = pz + dist + (Math.random() - 0.5) * 35;
      // batu selalu minggir 14–72m dari garis tengah: jalur carving pusat tetap bersih & aman
      x = pathX(z) + (14 + Math.random() * 58) * (Math.random() < 0.5 ? -1 : 1);
      const c = chasmAt(z);
      const nearGap = c !== null && z > c.z0 - 20 && z < c.z1 + 12;
      worldSample(x, z, this.ws);
      if (!nearGap && (this.ws.level === NO_WATER || this.ws.e > 10)) break;
    }
    const it = this.items[itemIdx];
    it.x = x;
    it.z = z;
    it.y = duneHeight(x, z);
    it.h = 1.3 + Math.random() * 1.2;
    it.r = 1.2 + Math.random() * 1.3;
    it.rot = Math.random() * Math.PI * 2;
    it.seed = Math.random() * 100;
    it.cleared = false;

    const rockIdx = itemIdx - this.countRuin;
    this.eu.set(Math.random() * 0.4, it.rot, Math.random() * 0.4);
    this.q.setFromEuler(this.eu);
    this.v.set(it.x, it.y + it.h * 0.35, it.z);
    this.sc.set(it.r, it.h * 0.9, it.r * (0.8 + Math.random() * 0.3));
    this.m4.compose(this.v, this.q, this.sc);
    this.boulders.setMatrixAt(rockIdx, this.m4);
    this.boulders.instanceMatrix.needsUpdate = true;
  }

  private placeStatue(itemIdx: number, px: number, pz: number, dist: number) {
    void px;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 8; tries++) {
      z = pz + dist + (Math.random() - 0.5) * 45;
      // Statues line the descent corridor and mound approaches
      x = pathX(z) + (Math.random() - 0.5) * 110;
      const c = chasmAt(z);
      const nearGap = c !== null && z > c.z0 - 24 && z < c.z1 + 18;
      worldSample(x, z, this.ws);
      if (!nearGap && (this.ws.level === NO_WATER || this.ws.e > 12)) break;
    }
    const it = this.items[itemIdx];
    it.x = x;
    it.z = z;
    it.y = duneHeight(x, z);
    it.h = 8 + Math.random() * 3.5; // 8m to 11.5m tall
    it.r = 2.4;
    it.rot = Math.atan2(pathX(z + 10) - pathX(z), 10) + (Math.random() - 0.5) * 0.8;
    it.seed = Math.random() * 100;
    it.cleared = false;

    const statueIdx = itemIdx - (this.countRuin + this.countRock);
    const scale = it.h / 7.8;
    this.q.setFromAxisAngle(this.axis, it.rot);
    this.v.set(it.x, it.y - 0.4, it.z);
    this.sc.set(scale, scale, scale);
    this.m4.compose(this.v, this.q, this.sc);
    this.statues.setMatrixAt(statueIdx, this.m4);
    this.statues.instanceMatrix.needsUpdate = true;

    // Statue glowing eyes
    const eyeY = it.y + 6.4 * scale;
    const eyeForward = 1.1 * scale;
    this.v.set(
      it.x + Math.sin(it.rot) * eyeForward,
      eyeY,
      it.z + Math.cos(it.rot) * eyeForward,
    );
    this.sc.set(scale, scale, scale);
    this.m4.compose(this.v, this.q, this.sc);
    this.statueEyes.setMatrixAt(statueIdx, this.m4);
    this.statueEyes.instanceMatrix.needsUpdate = true;
  }

  private placeArch(itemIdx: number, px: number, pz: number, dist: number) {
    void px;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 8; tries++) {
      z = pz + dist + (Math.random() - 0.5) * 50;
      // Arches are placed spanning across or right next to the surfing path
      x = pathX(z) + (Math.random() - 0.5) * 50;
      const c = chasmAt(z);
      const nearGap = c !== null && z > c.z0 - 24 && z < c.z1 + 18;
      worldSample(x, z, this.ws);
      if (!nearGap && (this.ws.level === NO_WATER || this.ws.e > 12)) break;
    }
    const it = this.items[itemIdx];
    it.x = x;
    it.z = z;
    it.y = duneHeight(x, z);
    it.h = 8.0;
    it.r = 4.2; // total span radius
    it.rot = Math.atan2(pathX(z + 10) - pathX(z), 10) + (Math.random() - 0.5) * 0.4;
    it.seed = Math.random() * 100;
    it.cleared = false;

    const archIdx = itemIdx - (this.countRuin + this.countRock + this.countStatue);
    this.q.setFromAxisAngle(this.axis, it.rot);
    this.v.set(it.x, it.y - 0.3, it.z);
    this.sc.set(1, 1, 1);
    this.m4.compose(this.v, this.q, this.sc);
    this.arches.setMatrixAt(archIdx, this.m4);
    this.arches.instanceMatrix.needsUpdate = true;
  }

  update(px: number, pz: number, fx: number, fz: number, time: number) {
    void fx;
    void fz;
    void time;
    // 1. Update ruins - spread far apart
    for (let i = 0; i < this.countRuin; i++) {
      const it = this.items[i];
      const dx = it.x - px;
      const dz = it.z - pz;
      if (Math.hypot(dx, dz) > 600 || dz < -60) {
        this.placeRuin(i, px, pz, 380 + Math.random() * 450);
      }
    }

    // 2. Update boulders
    for (let i = 0; i < this.countRock; i++) {
      const itemIdx = this.countRuin + i;
      const it = this.items[itemIdx];
      const dx = it.x - px;
      const dz = it.z - pz;
      if (Math.hypot(dx, dz) > 600 || dz < -50) {
        this.placeRock(itemIdx, px, pz, 320 + Math.random() * 420);
      }
    }

    // 3. Update statues - spaced far apart
    for (let i = 0; i < this.countStatue; i++) {
      const itemIdx = this.countRuin + this.countRock + i;
      const it = this.items[itemIdx];
      const dx = it.x - px;
      const dz = it.z - pz;
      if (Math.hypot(dx, dz) > 600 || dz < -60) {
        this.placeStatue(itemIdx, px, pz, 420 + Math.random() * 500);
      }
    }

    // 4. Update arches - spaced far apart
    for (let i = 0; i < this.countArch; i++) {
      const itemIdx = this.countRuin + this.countRock + this.countStatue + i;
      const it = this.items[itemIdx];
      const dx = it.x - px;
      const dz = it.z - pz;
      if (Math.hypot(dx, dz) > 600 || dz < -60) {
        this.placeArch(itemIdx, px, pz, 450 + Math.random() * 550);
      }
    }
  }

  /**
   * Check collision with obstacles:
   * - 'bounce': leaped and touched the top of a rock -> bounce boost!
   * - 'clear': clean jump hurdle over rock
   * - 'statue_bounce': massive launch off top of megalith statue!
   * - 'statue_clear': leaped over megalith statue!
   * - 'arch_glide': carved cleanly through a megalith arch portal!
   * - 'arch_leap': jumped over the top of a megalith arch!
   * - 'crash': crashed into rock, statue, or arch column on ground
   * - 'none': clear air
   */
  checkCollision(
    p: THREE.Vector3,
    radius: number,
    normal: THREE.Vector3,
    vy: number,
    grounded: boolean,
  ): CollisionOutcome {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const dx = p.x - it.x;
      const dz = p.z - it.z;

      if (it.type === 'rock') {
        const hitRadius = it.r + radius;
        const dist2 = dx * dx + dz * dz;
        if (dist2 < hitRadius * hitRadius) {
          const dist = Math.sqrt(dist2) || 0.001;
          const rockTop = it.y + it.h;

          // Airborne above rock
          if (!grounded && p.y >= rockTop - 0.25) {
            if (!it.cleared) {
              it.cleared = true;
              if (p.y <= rockTop + 1.35 && vy <= 2.5) {
                return 'bounce';
              }
              return 'clear';
            }
            continue;
          }

          normal.set(dx / dist, 0, dz / dist);
          p.x = it.x + normal.x * hitRadius;
          p.z = it.z + normal.z * hitRadius;
          return 'crash';
        }
      } else if (it.type === 'statue') {
        const hitRadius = it.r + radius;
        const dist2 = dx * dx + dz * dz;
        if (dist2 < hitRadius * hitRadius) {
          const dist = Math.sqrt(dist2) || 0.001;
          const statueTop = it.y + it.h;

          if (!grounded && p.y >= statueTop - 0.3) {
            if (!it.cleared) {
              it.cleared = true;
              if (p.y <= statueTop + 1.8 && vy <= 2.5) {
                return 'statue_bounce';
              }
              return 'statue_clear';
            }
            continue;
          }

          normal.set(dx / dist, 0, dz / dist);
          p.x = it.x + normal.x * hitRadius;
          p.z = it.z + normal.z * hitRadius;
          return 'crash';
        }
      } else if (it.type === 'arch') {
        // Arch check in local rotated coordinates
        const cos = Math.cos(-it.rot);
        const sin = Math.sin(-it.rot);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;

        // When crossing arch plane
        if (Math.abs(lz) < 1.6 + radius) {
          // Inside the arch portal opening
          if (Math.abs(lx) < 2.4) {
            if (p.y < it.y + 6.8) {
              if (!it.cleared) {
                it.cleared = true;
                return 'arch_glide';
              }
            } else {
              if (!it.cleared) {
                it.cleared = true;
                return 'arch_leap';
              }
            }
            continue;
          }

          // Hit left or right pillar
          if (Math.abs(lx) >= 2.4 && Math.abs(lx) <= 4.2 + radius) {
            if (p.y < it.y + 7.8) {
              const sign = lx > 0 ? 1 : -1;
              p.x = it.x + Math.sin(it.rot) * sign * (4.2 + radius);
              p.z = it.z + Math.cos(it.rot) * sign * (4.2 + radius);
              normal.set(Math.sin(it.rot) * sign, 0, Math.cos(it.rot) * sign);
              return 'crash';
            }
          }
        }
      } else {
        // Ancient ruin column
        const hitRadius = it.r + radius;
        const dist2 = dx * dx + dz * dz;
        if (dist2 < hitRadius * hitRadius) {
          const dist = Math.sqrt(dist2) || 0.001;
          normal.set(dx / dist, 0, dz / dist);
          p.x = it.x + normal.x * hitRadius;
          p.z = it.z + normal.z * hitRadius;
          return 'crash';
        }
      }

      // Check near-miss evasive maneuver reward
      if (!it.cleared && grounded) {
        const hitRadius = it.r + radius;
        const dist2 = dx * dx + dz * dz;
        const nearMargin = hitRadius + 2.4;
        if (dist2 < nearMargin * nearMargin && dz > 0.4 && dz < 3.2) {
          it.cleared = true;
          return 'near_miss';
        }
      }
    }
    return 'none';
  }

  /** backward compatibility */
  collide(p: THREE.Vector3, radius: number, normal: THREE.Vector3): number {
    const outcome = this.checkCollision(p, radius, normal, -1, true);
    return outcome === 'crash' ? 1 : 0;
  }
}

// ---------------------------------------------------------------------------
// Speed Pads (Alur Akselerasi Luncur) - Mountain Downhill Boost Channels
// ---------------------------------------------------------------------------
export class SpeedPads {
  group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private mat: THREE.MeshStandardMaterial;
  private count = 16;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private axis = new THREE.Vector3(0, 1, 0);
  private items: { x: number; y: number; z: number; rot: number; active: boolean; cd: number }[] = [];

  constructor() {
    // Chevron-arrow aerodynamic flight shape
    const geo = new THREE.ConeGeometry(1.6, 3.8, 4);
    geo.rotateX(Math.PI * 0.5);
    geo.scale(1, 0.12, 1);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x4df0ff,
      emissive: new THREE.Color(0x00c4e6),
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.count);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    for (let i = 0; i < this.count; i++) {
      this.items.push({ x: 0, y: 0, z: 0, rot: 0, active: true, cd: 0 });
      this.place(i, 0, (i / this.count) * 1100 + 90);
    }
  }

  setGlow(v: number) {
    this.mat.emissiveIntensity = 1.8 * v;
  }

  private place(i: number, pz: number, dist: number) {
    const z = pz + dist + (Math.random() - 0.5) * 30;
    const x = pathX(z) + (Math.random() - 0.5) * 48;
    const y = duneHeight(x, z) + 0.08;
    const rot = Math.atan2(pathX(z + 10) - pathX(z), 10);
    const it = this.items[i];
    it.x = x;
    it.y = y;
    it.z = z;
    it.rot = rot;
    it.active = true;
    it.cd = 0;

    this.q.setFromAxisAngle(this.axis, rot);
    this.v.set(x, y, z);
    this.sc.set(1.4, 1, 1.4);
    this.m4.compose(this.v, this.q, this.sc);
    this.mesh.setMatrixAt(i, this.m4);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(pz: number, dt: number) {
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      if (it.cd > 0) it.cd -= dt;
      if (it.z - pz < -60 || it.z - pz > 1200) {
        this.place(i, pz, 400 + Math.random() * 500);
      }
    }
  }

  /** returns true when player glides over a boost pad */
  checkBoost(p: THREE.Vector3): boolean {
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      if (it.cd > 0) continue;
      const dx = p.x - it.x;
      const dz = p.z - it.z;
      if (dx * dx + dz * dz < 3.2 * 3.2) {
        it.cd = 1.5;
        return true;
      }
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Energy Crystals (Kristal Surya / Inti Energi) - Collectible mountain trail rewards
// ---------------------------------------------------------------------------
export class EnergyCrystals {
  group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private mat: THREE.MeshStandardMaterial;
  /** pendar lembut di sekitar permata (bukan sinar tajam) */
  private halo: THREE.Points;
  private haloSize: THREE.BufferAttribute;
  private haloPos: THREE.BufferAttribute;
  private haloSeed: Float32Array;
  private haloU = { uTime: { value: 0 }, uMul: { value: 1 } };
  private count = 42;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private items: { x: number; y: number; z: number; collected: boolean; seed: number }[] = [];
  /** daftar obstacle (relic/patung/batu) yang harus dihindari permata */
  private avoid: { x: number; z: number; r: number }[] = [];

  constructor() {
    const geo = new THREE.OctahedronGeometry(0.55, 0);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffea78,
      emissive: new THREE.Color(0xffaa20),
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.1,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.count);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    // ---- PENDAR LEMBUT (bukan sinar tajam ke atas): halo bercahaya pelan
    // di sekitar setiap permata yang bisa diambil — bernapas perlahan,
    // menghilang saat permata terkoleksi. Terasa seperti kunang-kunang emas.
    {
      const pos = new Float32Array(this.count * 3);
      const size = new Float32Array(this.count);
      this.haloSeed = new Float32Array(this.count);
      for (let i = 0; i < this.count; i++) this.haloSeed[i] = Math.random() * 9;
      const geo = new THREE.BufferGeometry();
      this.haloPos = new THREE.BufferAttribute(pos, 3);
      this.haloSize = new THREE.BufferAttribute(size, 1);
      this.haloPos.setUsage(THREE.DynamicDrawUsage);
      this.haloSize.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', this.haloPos);
      geo.setAttribute('aSize', this.haloSize);
      geo.setAttribute('aSeed', new THREE.BufferAttribute(this.haloSeed, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      const mat = new THREE.ShaderMaterial({
        uniforms: this.haloU,
        vertexShader: `
          attribute float aSize; attribute float aSeed;
          uniform float uTime;
          varying float vB;
          void main(){
            // bernapas pelan, tiap permata punya fasenya sendiri
            vB = 0.62 + 0.38 * sin(uTime * 1.35 + aSeed * 6.28);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (300.0 / max(0.001, -mv.z));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform float uMul;
          varying float vB;
          void main(){
            float d = length(gl_PointCoord - 0.5) * 2.0;
            // profil pendar: inti lembut + rok cahaya yang meluruh halus
            float a = pow(max(0.0, 1.0 - d), 3.2) * 0.85 + pow(max(0.0, 1.0 - d), 1.6) * 0.16;
            a *= vB * uMul;
            if (a < 0.004) discard;
            vec3 col = vec3(1.0, 0.86, 0.55) * a; // emas hangat
            gl_FragColor = vec4(col, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.halo = new THREE.Points(geo, mat);
      this.halo.frustumCulled = false;
      this.halo.renderOrder = 4;
      this.group.add(this.halo);
    }

    for (let i = 0; i < this.count; i++) {
      this.items.push({ x: 0, y: 0, z: 0, collected: false, seed: Math.random() * 100 });
      this.place(i, 0, (i / this.count) * 1200 + 40);
    }
  }

  /** daftar Hindari: permata tidak pernah muncul di atas / menempel relic */
  setAvoid(list: { x: number; z: number; r: number }[]) {
    this.avoid = list;
  }

  setGlow(v: number) {
    this.mat.emissiveIntensity = 2.2 * v;
    this.haloU.uMul.value = Math.min(1.35, v);
  }

  /** kandidat target lock-on kamera Sekiro */
  lockCandidates(): readonly { x: number; y: number; z: number; collected: boolean }[] {
    return this.items;
  }

  private place(i: number, pz: number, dist: number) {
    const z = pz + dist;
    // form gentle curving arcs along the trail or over launch mounds
    const spread = Math.sin(i * 0.4) * 28;
    let x = pathX(z) + spread;
    // jangan menempel pada relic / patung / batu: geser sampai bebas
    if (this.avoid.length) {
      for (let tries = 0; tries < 8; tries++) {
        let hit = false;
        for (const a of this.avoid) {
          if (Math.hypot(x - a.x, z - a.z) < a.r + 7) {
            hit = true;
            break;
          }
        }
        if (!hit) break;
        x = pathX(z) + (Math.random() - 0.5) * 110;
      }
    }
    const y = duneHeight(x, z) + 1.6 + Math.sin(i * 0.8) * 1.2;
    const it = this.items[i];
    it.x = x;
    it.y = y;
    it.z = z;
    it.collected = false;

    this.v.set(x, y, z);
    this.q.identity();
    this.sc.set(1, 1.4, 1);
    this.m4.compose(this.v, this.q, this.sc);
    this.mesh.setMatrixAt(i, this.m4);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(pz: number, time: number) {
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      if (it.z - pz < -50 || it.z - pz > 1200) {
        this.place(i, pz, 360 + Math.random() * 450);
        continue;
      }
      if (it.collected) {
        this.mesh.setMatrixAt(i, this.zero);
        this.haloSize.array[i] = 0;
        continue;
      }
      const bob = Math.sin(time * 3 + it.seed) * 0.25;
      this.v.set(it.x, it.y + bob, it.z);
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), time * 2.2 + it.seed);
      this.sc.set(1, 1.35, 1);
      this.m4.compose(this.v, this.q, this.sc);
      this.mesh.setMatrixAt(i, this.m4);
      // pendar lembut mengikuti permata (denyut ada di shader)
      const hp = this.haloPos.array as Float32Array;
      hp[i * 3] = it.x;
      hp[i * 3 + 1] = it.y + bob * 0.4;
      hp[i * 3 + 2] = it.z;
      this.haloSize.array[i] = 2.4;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.haloPos.needsUpdate = true;
    this.haloSize.needsUpdate = true;
    this.haloU.uTime.value = time;
  }

  /** checks collection by player position; returns count of shards collected */
  checkCollect(p: THREE.Vector3): number {
    let collectedCount = 0;
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      if (it.collected) continue;
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const dz = p.z - it.z;
      if (dx * dx + dy * dy + dz * dz < 2.8 * 2.8) {
        it.collected = true;
        collectedCount++;
      }
    }
    return collectedCount;
  }
}

// ---------------------------------------------------------------------------
// Mountain Altitude Sectors (Zona Eksplorasi Gunung Mega Dahsyat)
// ---------------------------------------------------------------------------
export interface MountainSector {
  name: string;
  subtitle: string;
  startDist: number;
  endDist: number;
  accentColor: string;
}

export const MOUNTAIN_SECTORS: MountainSector[] = [
  {
    name: 'Puncak Salju Abadi',
    subtitle: 'Lereng Es & Angin Dingin Puncak Raksasa',
    startDist: 0,
    endDist: 1400,
    accentColor: '#a8e5ff',
  },
  {
    name: 'Punggung Kuil Megalit',
    subtitle: 'Monumen Kuno & Gerbang Peradaban Hilang',
    startDist: 1400,
    endDist: 3200,
    accentColor: '#ffdf94',
  },
  {
    name: 'Ngarai Cadas Terjal',
    subtitle: 'Labirin Tebing Curam & Jurang Menganga',
    startDist: 3200,
    endDist: 5200,
    accentColor: '#ff9a70',
  },
  {
    name: 'Lembah Kristal Bercahaya',
    subtitle: 'Pendar Geode Mistis & Formasi Mengambang',
    startDist: 5200,
    endDist: 7400,
    accentColor: '#b48aff',
  },
  {
    name: 'Gurun Keemasan Mega',
    subtitle: 'Lautan Pasir Megah Menuruni Kaki Gunung',
    startDist: 7400,
    endDist: 10000,
    accentColor: '#ffd073',
  },
];

export function getMountainSector(dist: number): MountainSector {
  const cycleDist = dist % 10000;
  const tier = Math.floor(dist / 10000) + 1;
  for (const sec of MOUNTAIN_SECTORS) {
    if (cycleDist >= sec.startDist && cycleDist < sec.endDist) {
      if (tier > 1) {
        return { ...sec, name: `${sec.name} · Tahap ${tier}` };
      }
      return sec;
    }
  }
  return MOUNTAIN_SECTORS[0];
}

// ---------------------------------------------------------------------------
// BIOME SCENERY: dekorasi procedural per biome, semuanya instanced.
// Gurun → pohon palem · Ngarai Merah → kaktus & butte mesa raksasa ·
// Reruntuhan Kuil → platform, pilar (20% roboh), obelisk. Lorong jalur
// |x − pathX| ≤ 14 selalu bersih; penempatan menolak sungai & jurang.
// ---------------------------------------------------------------------------
interface DecoItem {
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  sy: number;
  fallen: boolean;
}
type DecoKind = 'dunes' | 'canyon' | 'temple';

export class BiomeScenery {
  group = new THREE.Group();

  private palmTrunks: THREE.InstancedMesh;
  private palmCrowns: THREE.InstancedMesh;
  private cacti: THREE.InstancedMesh;
  private mesas: THREE.InstancedMesh;
  private platforms: THREE.InstancedMesh;
  private pillars: THREE.InstancedMesh;
  private obelisks: THREE.InstancedMesh;

  private palmItems: DecoItem[] = [];
  private cactiItems: DecoItem[] = [];
  private mesaItems: DecoItem[] = [];
  private platformItems: DecoItem[] = [];
  private pillarItems: DecoItem[] = [];
  private obeliskItems: DecoItem[] = [];

  private static N_PALM = 26;
  private static N_CACTI = 20;
  private static N_MESA = 8;
  private static N_PLATFORM = 6;
  private static N_PILLAR = 30;
  private static N_OBELISK = 10;

  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private eu = new THREE.Euler();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private ws: WorldSample = { h: 0, level: 0, surf: 0, e: 1e9 };

  constructor() {
    // --- PALEM (Gurun Pasir): batang + mahkota 7 kerucut daun ---
    const trunkGeo = new THREE.CylinderGeometry(0.26, 0.48, 9, 5);
    trunkGeo.translate(0, 4.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a44,
      roughness: 0.95,
      flatShading: true,
      emissive: new THREE.Color(0x221708),
      emissiveIntensity: 0.28,
    });
    this.palmTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, BiomeScenery.N_PALM);
    this.palmTrunks.frustumCulled = false;
    const fronds: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const f = new THREE.ConeGeometry(0.55, 4.4, 4);
      f.translate(0, -2.1, 0); // pangkal di titik puncak batang
      f.rotateX(Math.PI * 0.62);
      f.rotateY((i / 7) * Math.PI * 2);
      fronds.push(f);
    }
    const crownGeo = mergeBufferGeometries(fronds);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x5f8f52,
      roughness: 0.9,
      flatShading: true,
      emissive: new THREE.Color(0x11240c),
      emissiveIntensity: 0.4,
    });
    this.palmCrowns = new THREE.InstancedMesh(crownGeo, crownMat, BiomeScenery.N_PALM);
    this.palmCrowns.frustumCulled = false;

    // --- KAKTUS (Ngarai Merah): badan kapsul + 2 lengan ---
    const cBody = new THREE.CapsuleGeometry(0.55, 3.0, 3, 7);
    cBody.translate(0, 2.1, 0);
    const cArmL = new THREE.CapsuleGeometry(0.34, 1.5, 3, 6);
    cArmL.rotateZ(0.9);
    cArmL.translate(-0.95, 2.5, 0);
    const cArmR = new THREE.CapsuleGeometry(0.32, 1.3, 3, 6);
    cArmR.rotateZ(-1.05);
    cArmR.translate(0.9, 1.7, 0);
    const cactiGeo = mergeBufferGeometries([cBody, cArmL, cArmR]);
    const cactiMat = new THREE.MeshStandardMaterial({
      color: 0x608a50,
      roughness: 0.92,
      flatShading: true,
      emissive: new THREE.Color(0x14240e),
      emissiveIntensity: 0.35,
    });
    this.cacti = new THREE.InstancedMesh(cactiGeo, cactiMat, BiomeScenery.N_CACTI);
    this.cacti.frustumCulled = false;

    // --- MESA / BUTTE (Ngarai Merah): silinder 7 sisi raksasa di sisi lembah ---
    const mesaGeo = new THREE.CylinderGeometry(1, 1.22, 1, 7, 1);
    mesaGeo.translate(0, 0.5, 0);
    const mesaMat = new THREE.MeshStandardMaterial({
      color: 0xa05238,
      roughness: 0.96,
      flatShading: true,
      emissive: new THREE.Color(0x2a120a),
      emissiveIntensity: 0.3,
    });
    this.mesas = new THREE.InstancedMesh(mesaGeo, mesaMat, BiomeScenery.N_MESA);
    this.mesas.frustumCulled = false;

    // --- PLATFORM KUIL ---
    const platGeo = new THREE.BoxGeometry(15, 1.7, 15);
    const platMat = new THREE.MeshStandardMaterial({
      color: 0x9c8a70,
      roughness: 0.9,
      flatShading: true,
      emissive: new THREE.Color(0x221c12),
      emissiveIntensity: 0.3,
    });
    this.platforms = new THREE.InstancedMesh(platGeo, platMat, BiomeScenery.N_PLATFORM);
    this.platforms.frustumCulled = false;

    // --- PILAR KUIL (20% roboh) ---
    const pillarGeo = new THREE.CylinderGeometry(0.65, 0.82, 7, 8);
    pillarGeo.translate(0, 3.5, 0);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xa89474,
      roughness: 0.88,
      flatShading: true,
      emissive: new THREE.Color(0x241d12),
      emissiveIntensity: 0.28,
    });
    this.pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, BiomeScenery.N_PILLAR);
    this.pillars.frustumCulled = false;

    // --- OBELISK KUIL (4 sisi meruncing) ---
    const obGeo = new THREE.CylinderGeometry(0.34, 1.15, 11, 4);
    obGeo.translate(0, 5.5, 0);
    const obMat = new THREE.MeshStandardMaterial({
      color: 0x8f7e66,
      roughness: 0.85,
      flatShading: true,
      emissive: new THREE.Color(0x1f1910),
      emissiveIntensity: 0.36,
    });
    this.obelisks = new THREE.InstancedMesh(obGeo, obMat, BiomeScenery.N_OBELISK);
    this.obelisks.frustumCulled = false;

    this.group.add(this.palmTrunks, this.palmCrowns, this.cacti, this.mesas, this.platforms, this.pillars, this.obelisks);
  }

  private newItem(): DecoItem {
    return { x: 0, y: -4000, z: -1e9, rot: 0, scale: 1, sy: 1, fallen: false };
  }

  /**
   * Cari tempat legal untuk 1 dekorasi: biome cocok (mode auto), landai,
   * bukan sungai/jurang, dan lorong jalur tetap bersih. Retry 6×.
   */
  private place(it: DecoItem, kind: DecoKind, pz: number, dist: number, minLane = 15): boolean {
    for (let t = 0; t < 6; t++) {
      const z = pz + dist + Math.random() * 260;
      const b = biomeWeights(z);
      const w = kind === 'dunes' ? b.dunes : kind === 'canyon' ? b.canyon : b.temple;
      if (w < 0.3) continue;
      const span = kind === 'canyon' ? 200 : 160;
      const x = pathX(z) + (minLane + Math.random() * span) * (Math.random() < 0.5 ? -1 : 1);
      if (Math.abs(x - pathX(z)) < 14) continue;
      worldSample(x, z, this.ws);
      if (this.ws.level > NO_WATER && this.ws.e < 7) continue; // sungai
      if (baseDune(x, z) - this.ws.h > 1.2) continue; // dinding jurang
      const hx1 = duneHeight(x + 2, z);
      const hx2 = duneHeight(x - 2, z);
      const hz1 = duneHeight(x, z + 2);
      const hz2 = duneHeight(x, z - 2);
      const gx = (hx1 - hx2) * 0.25;
      const gz = (hz1 - hz2) * 0.25;
      if (1 / Math.sqrt(1 + gx * gx + gz * gz) < 0.55) continue; // terlalu curam
      it.x = x;
      it.z = z;
      it.y = this.ws.h;
      it.rot = Math.random() * Math.PI * 2;
      return true;
    }
    return false;
  }

  private writeInst(
    mesh: THREE.InstancedMesh,
    idx: number,
    it: DecoItem,
    sink: number,
    sxMul: number,
    syMul: number,
    szMul: number,
    crown?: THREE.InstancedMesh,
  ) {
    if (it.z < -1e8) {
      mesh.setMatrixAt(idx, this.zero);
      if (crown) crown.setMatrixAt(idx, this.zero);
      return;
    }
    if (it.fallen) {
      this.eu.set(Math.PI * 0.5 + (Math.sin(it.rot) * 0.08), it.rot, 0);
      this.q.setFromEuler(this.eu);
      this.v.set(it.x, it.y + it.scale, it.z);
    } else {
      this.eu.set(0, it.rot, 0);
      this.q.setFromEuler(this.eu);
      this.v.set(it.x, it.y - sink, it.z);
    }
    this.sc.set(it.scale * sxMul, it.sy * syMul, it.scale * szMul);
    this.m4.compose(this.v, this.q, this.sc);
    mesh.setMatrixAt(idx, this.m4);
    if (crown) crown.setMatrixAt(idx, this.m4);
  }

  /** spawn ulang SEMUA dekorasi (dipanggil saat ganti mode dunia / mulai run) */
  respawnAll(px: number, pz: number) {
    this.palmItems = [];
    this.cactiItems = [];
    this.mesaItems = [];
    this.platformItems = [];
    this.pillarItems = [];
    this.obeliskItems = [];
    void px; // penempatan x berbasis pathX(z), bukan px rider
    for (let i = 0; i < BiomeScenery.N_PALM; i++) {
      const it = this.newItem();
      it.scale = 0.8 + Math.random() * 0.7;
      it.sy = it.scale * (0.85 + Math.random() * 0.45);
      this.place(it, 'dunes', pz - 120, 240, 18);
      this.palmItems.push(it);
    }
    for (let i = 0; i < BiomeScenery.N_CACTI; i++) {
      const it = this.newItem();
      it.scale = 0.8 + Math.random() * 0.9;
      it.sy = it.scale * (0.7 + Math.random() * 0.8);
      this.place(it, 'canyon', pz - 120, 240);
      this.cactiItems.push(it);
    }
    for (let i = 0; i < BiomeScenery.N_MESA; i++) {
      const it = this.newItem();
      it.scale = 18 + Math.random() * 24; // radius 18–42 m
      it.sy = 55 + Math.random() * 55; // tinggi 55–110 m
      this.place(it, 'canyon', pz - 120, 260, 60);
      this.mesaItems.push(it);
    }
    for (let i = 0; i < BiomeScenery.N_PLATFORM; i++) {
      const it = this.newItem();
      it.scale = 0.7 + Math.random() * 0.9;
      it.sy = 1;
      this.place(it, 'temple', pz - 120, 240);
      this.platformItems.push(it);
    }
    for (let i = 0; i < BiomeScenery.N_PILLAR; i++) {
      const it = this.newItem();
      it.scale = 0.7 + Math.random() * 0.7;
      it.sy = it.scale * (0.6 + Math.random() * 0.9);
      it.fallen = Math.random() < 0.2;
      this.place(it, 'temple', pz - 120, 240);
      this.pillarItems.push(it);
    }
    for (let i = 0; i < BiomeScenery.N_OBELISK; i++) {
      const it = this.newItem();
      it.scale = 0.55 + Math.random() * 0.75;
      it.sy = it.scale * (0.7 + Math.random() * 0.9);
      it.fallen = Math.random() < 0.2;
      this.place(it, 'temple', pz - 120, 240);
      this.obeliskItems.push(it);
    }
    this.writeAll(pz);
  }

  /** tulis ulang matrix semua instance (dipakai respawnAll & update) */
  private writeAll(pz: number) {
    for (let i = 0; i < this.palmItems.length; i++) {
      const it = this.palmItems[i];
      if (it.z < pz - 60 && it.z > -1e8) this.place(it, 'dunes', pz, 300, 18) || (it.z = -1e9);
      this.writeInst(this.palmTrunks, i, it, 0.35, 1, 1, 1, this.palmCrowns);
    }
    for (let i = 0; i < this.cactiItems.length; i++) {
      const it = this.cactiItems[i];
      if (it.z < pz - 60 && it.z > -1e8) this.place(it, 'canyon', pz, 300) || (it.z = -1e9);
      this.writeInst(this.cacti, i, it, 0.3, 1, 1, 1);
    }
    for (let i = 0; i < this.mesaItems.length; i++) {
      const it = this.mesaItems[i];
      if (it.z < pz - 220 && it.z > -1e8) this.place(it, 'canyon', pz, 340, 60) || (it.z = -1e9);
      this.writeInst(this.mesas, i, it, 4, 1, 1, 1);
    }
    for (let i = 0; i < this.platformItems.length; i++) {
      const it = this.platformItems[i];
      if (it.z < pz - 60 && it.z > -1e8) this.place(it, 'temple', pz, 300) || (it.z = -1e9);
      this.writeInst(this.platforms, i, it, 0.55, 1, 1, 1);
    }
    for (let i = 0; i < this.pillarItems.length; i++) {
      const it = this.pillarItems[i];
      if (it.z < pz - 60 && it.z > -1e8) this.place(it, 'temple', pz, 300) || (it.z = -1e9);
      this.writeInst(this.pillars, i, it, 0.3, 1, 1, 1);
    }
    for (let i = 0; i < this.obeliskItems.length; i++) {
      const it = this.obeliskItems[i];
      if (it.z < pz - 60 && it.z > -1e8) this.place(it, 'temple', pz, 300) || (it.z = -1e9);
      this.writeInst(this.obelisks, i, it, 0.5, 1, 1, 1);
    }
    this.palmTrunks.instanceMatrix.needsUpdate = true;
    this.palmCrowns.instanceMatrix.needsUpdate = true;
    this.cacti.instanceMatrix.needsUpdate = true;
    this.mesas.instanceMatrix.needsUpdate = true;
    this.platforms.instanceMatrix.needsUpdate = true;
    this.pillars.instanceMatrix.needsUpdate = true;
    this.obelisks.instanceMatrix.needsUpdate = true;
  }

  /** panggil tiap frame di samping monoliths.update — spawn maju saat rider turun */
  update(_px: number, pz: number) {
    this.writeAll(pz);
  }
}

export type { Palette };
