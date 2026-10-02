import * as THREE from 'three';
import { NO_WATER, RUN, baseDune, biomeWeights, clamp, mix, worldSample, type WorldSample } from './noise';

// ---------------------------------------------------------------------------
// One single mesh covers the whole world around the rider. It slides in 4 unit
// steps: heights are shifted through the buffer and only the entering row /
// column is computed, so the CPU cost stays tiny no matter how far you ride.
// ---------------------------------------------------------------------------
export class TerrainField {
  readonly cell = 4;
  readonly nx = 161;
  readonly nz = 185;
  mesh: THREE.Mesh;

  private geo: THREE.BufferGeometry;
  private hgt: Float32Array;
  private wet: Float32Array;
  private ws: WorldSample = { h: 0, level: NO_WATER, surf: NO_WATER, e: 1e9 };
  private posA: THREE.BufferAttribute;
  private nrmA: THREE.BufferAttribute;
  private colA: THREE.BufferAttribute;
  private uvA: THREE.BufferAttribute;
  private baseI = 0;
  private baseJ = 0;
  private started = false;
  private cx: number;
  private cz: number;

  constructor() {
    const { nx, nz, cell } = this;
    this.cx = (nx - 1) / 2;
    this.cz = 32;

    this.geo = new THREE.BufferGeometry();
    const count = nx * nz;
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);

    let k = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const o = k * 3;
        pos[o] = (i - this.cx) * cell;
        pos[o + 2] = (j - this.cz) * cell;
        nrm[o + 1] = 1;
        uv[k * 2] = 0;
        uv[k * 2 + 1] = 0;
        k++;
      }
    }
    k = 0;
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        idx[k++] = a;
        idx[k++] = c;
        idx[k++] = b;
        idx[k++] = b;
        idx[k++] = c;
        idx[k++] = d;
      }
    }

    this.hgt = new Float32Array(count);
    this.wet = new Float32Array(count).fill(99);
    this.posA = new THREE.BufferAttribute(pos, 3);
    this.nrmA = new THREE.BufferAttribute(nrm, 3);
    this.colA = new THREE.BufferAttribute(col, 3);
    this.uvA = new THREE.BufferAttribute(uv, 2);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    this.nrmA.setUsage(THREE.DynamicDrawUsage);
    this.colA.setUsage(THREE.DynamicDrawUsage);
    this.uvA.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posA);
    this.geo.setAttribute('normal', this.nrmA);
    this.geo.setAttribute('color', this.colA);
    this.geo.setAttribute('uv', this.uvA);
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: makeSandTexture(),
      roughness: 0.98,
      metalness: 0,
    });

    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
  }

  /** sample terrain + river wetness for one grid vertex */
  private put(k: number, x: number, z: number) {
    worldSample(x, z, this.ws);
    this.hgt[k] = this.ws.h;
    // wet = height above the nearby water level (negative = underwater), 99 = dry land
    this.wet[k] = this.ws.level > NO_WATER && this.ws.e < 7 ? this.ws.h - this.ws.level : 99;
    // chasm walls & abyss: encoded as <= -100 (depth below the lip)
    const depth = baseDune(x, z) - this.ws.h;
    if (depth > 1.2) this.wet[k] = -100 - depth;
  }

  private fillAll() {
    const { nx, nz, cell } = this;
    for (let j = 0; j < nz; j++) {
      const cj = this.baseJ + j - this.cz;
      for (let i = 0; i < nx; i++) {
        const ci = this.baseI + i - this.cx;
        this.put(j * nx + i, ci * cell, cj * cell);
      }
    }
  }

  private shiftX(dir: number) {
    const { nx, nz, hgt, wet } = this;
    if (dir > 0) {
      for (let j = 0; j < nz; j++) {
        const o = j * nx;
        hgt.copyWithin(o, o + 1, o + nx);
        wet.copyWithin(o, o + 1, o + nx);
      }
      const i = nx - 1;
      const ci = this.baseI + 1 + i - this.cx;
      for (let j = 0; j < nz; j++) {
        const cj = this.baseJ + j - this.cz;
        this.put(j * nx + i, ci * this.cell, cj * this.cell);
      }
      this.baseI += 1;
    } else {
      for (let j = 0; j < nz; j++) {
        const o = j * nx;
        hgt.copyWithin(o + 1, o, o + nx - 1);
        wet.copyWithin(o + 1, o, o + nx - 1);
      }
      const ci = this.baseI - 1 - this.cx;
      for (let j = 0; j < nz; j++) {
        const cj = this.baseJ + j - this.cz;
        this.put(j * nx, ci * this.cell, cj * this.cell);
      }
      this.baseI -= 1;
    }
  }

  private shiftZ(dir: number) {
    const { nx, nz, hgt, wet } = this;
    if (dir > 0) {
      hgt.copyWithin(0, nx, nz * nx);
      wet.copyWithin(0, nx, nz * nx);
      const o = (nz - 1) * nx;
      const cj = this.baseJ + 1 + (nz - 1) - this.cz;
      for (let i = 0; i < nx; i++) {
        const ci = this.baseI + i - this.cx;
        this.put(o + i, ci * this.cell, cj * this.cell);
      }
      this.baseJ += 1;
    } else {
      const o = (nz - 1) * nx;
      hgt.copyWithin(nx, 0, o);
      wet.copyWithin(nx, 0, o);
      const cj = this.baseJ - 1 - this.cz;
      for (let i = 0; i < nx; i++) {
        const ci = this.baseI + i - this.cx;
        this.put(i, ci * this.cell, cj * this.cell);
      }
      this.baseJ -= 1;
    }
  }

  /** write derived attributes (y, normal, color, uv) for every vertex */
  private rebuild() {
    const { nx, nz, cell, hgt } = this;
    const pos = this.posA.array as Float32Array;
    const nrm = this.nrmA.array as Float32Array;
    const col = this.colA.array as Float32Array;
    const uv = this.uvA.array as Float32Array;
    const inv = 1 / (2 * cell);

    for (let j = 0; j < nz; j++) {
      const jm = j > 0 ? j - 1 : 0;
      const jp = j < nz - 1 ? j + 1 : nz - 1;
      const cj = this.baseJ + j - this.cz;
      // tint biome per baris (dikali — mood langit/palet tetap berlaku di atasnya)
      const bw = biomeWeights(cj * cell);
      const tintR = bw.dunes * 1.05 + bw.canyon * 0.98 + bw.temple * 1.04;
      const tintG = bw.dunes * 0.93 + bw.canyon * 0.74 + bw.temple * 0.95;
      const tintB = bw.dunes * 0.8 + bw.canyon * 0.62 + bw.temple * 0.76;
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const im = i > 0 ? i - 1 : 0;
        const ip = i < nx - 1 ? i + 1 : nx - 1;
        const h = hgt[k];

        const o = k * 3;
        pos[o + 1] = h;

        const sx = (hgt[j * nx + ip] - hgt[j * nx + im]) * inv;
        const sz = (hgt[jp * nx + i] - hgt[jm * nx + i]) * inv;
        const len = Math.sqrt(sx * sx + 1 + sz * sz);
        const ny = 1 / len;
        nrm[o] = -sx * ny;
        nrm[o + 1] = ny;
        nrm[o + 2] = -sz * ny;

        // --- surface shading (pure neutral base for both snow & desert)
        const flat = clamp((ny - 0.7) / 0.28, 0, 1);
        const relH = h - (-RUN.SLOPE * (cj * cell));
        const hl = clamp((relH + 18) / 36, 0, 1);
        let r = mix(0.86, 0.99, flat);
        let g = mix(0.85, 0.98, flat);
        let b = mix(0.87, 1.0, flat);
        const lm = mix(0.88, 1.04, hl);
        r *= lm;
        g *= lm;
        b *= lm;

        // --- warna pasir per biome (multiply) + strata merah berlapis di ngarai
        r *= tintR;
        g *= tintG;
        b *= tintB;
        if (bw.canyon > 0.01) {
          const strata = 1 + 0.09 * Math.sin(h * 1.4) * bw.canyon;
          const sr = strata;
          const sg = 1 + (strata - 1) * 0.3;
          r *= sr;
          g *= sg;
        }

        // --- river: dark wet sand on the shore, cool deep tint under water
        const wd = this.wet[k];
        if (wd <= -100) {
          // chasm: the rock darkens into a cool, shadowy abyss
          const d = clamp((-wd - 100) / 30, 0, 1);
          r *= mix(0.62, 0.1, d);
          g *= mix(0.56, 0.1, d);
          b *= mix(0.6, 0.16, d);
        } else if (wd < 99) {
          if (wd < 0) {
            const d = clamp(-wd / 4, 0, 1);
            r *= mix(0.62, 0.34, d);
            g *= mix(0.74, 0.55, d);
            b *= mix(0.82, 0.68, d);
          } else if (wd < 1.8) {
            const w = 1 - wd / 1.8;
            r *= 1 - 0.3 * w;
            g *= 1 - 0.24 * w;
            b *= 1 - 0.18 * w;
          }
        }
        col[o] = r;
        col[o + 1] = g;
        col[o + 2] = b;

        uv[k * 2] = (this.baseI + i - this.cx) * cell * 0.16;
        uv[k * 2 + 1] = cj * cell * 0.16;
      }
    }
    this.posA.needsUpdate = true;
    this.nrmA.needsUpdate = true;
    this.colA.needsUpdate = true;
    this.uvA.needsUpdate = true;
    this.mesh.position.set(this.baseI * cell, 0, this.baseJ * cell);
    this.mesh.updateMatrix();
  }

  /** force a full refill on the next update (new run = new chasm layout) */
  invalidate() {
    this.started = false;
  }

  update(px: number, pz: number) {
    const bi = Math.round(px / this.cell);
    const bj = Math.round(pz / this.cell);
    if (!this.started) {
      this.started = true;
      this.baseI = bi;
      this.baseJ = bj;
      this.fillAll();
      this.rebuild();
      return;
    }
    let di = bi - this.baseI;
    let dj = bj - this.baseJ;
    if (di === 0 && dj === 0) return;

    if (Math.abs(di) > 8 || Math.abs(dj) > 8) {
      this.baseI = bi;
      this.baseJ = bj;
      this.fillAll();
      this.rebuild();
      return;
    }
    while (di !== 0) {
      this.shiftX(di > 0 ? 1 : -1);
      di += di > 0 ? -1 : 1;
    }
    while (dj !== 0) {
      this.shiftZ(dj > 0 ? 1 : -1);
      dj += dj > 0 ? -1 : 1;
    }
    this.rebuild();
  }
}

function makeSandTexture(): THREE.Texture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
  const img = g.getImageData(0, 0, s, s);
  const d = img.data;
  for (let i = 0; i < s * s; i++) {
    const n = Math.random();
    let v = 1 - n * 0.14;
    if (n > 0.985) v = 0.78;
    d[i * 4] = 255 * v;
    d[i * 4 + 1] = 255 * v;
    d[i * 4 + 2] = 255 * (0.985 + v * 0.015);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
