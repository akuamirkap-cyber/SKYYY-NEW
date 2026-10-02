// ---------------------------------------------------------------------------
// Deterministic value-noise based dune field.
// The exact same function drives the render mesh AND the physics, so the
// blade always sits perfectly on the sand.
// ---------------------------------------------------------------------------

export function hash2(ix: number, iz: number): number {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** smooth 0..1 value noise */
export function vnoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  const t = a + (b - a) * ux;
  const u = c + (d - c) * ux;
  return t + (u - t) * uz;
}

/** -1..1 value noise */
export function snoise(x: number, z: number): number {
  return vnoise(x, z) * 2 - 1;
}

// ---------------------------------------------------------------------------
// PRNG deterministik + SIMPLEX NOISE 2D (seed 1337 → dunia selalu sama)
// ---------------------------------------------------------------------------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _perm = (() => {
  const rnd = mulberry32(1337);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const pp = new Uint8Array(512);
  for (let i = 0; i < 512; i++) pp[i] = p[i & 255];
  return pp;
})();
const _grad = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1, 1, 0, -1, 0, 0, 1, 0, -1]);
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/** simplex noise 2D, hasil −1..1 (mulus antar tetangga, tanpa lompatan) */
export function simplex2(xin: number, yin: number): number {
  let n0 = 0;
  let n1 = 0;
  let n2 = 0;
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  let i1 = 0;
  let j1 = 1;
  if (x0 > y0) {
    i1 = 1;
    j1 = 0;
  }
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    t0 *= t0;
    const g = _perm[ii + _perm[jj]] % 12;
    n0 = t0 * t0 * (_grad[g * 2] * x0 + _grad[g * 2 + 1] * y0);
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    t1 *= t1;
    const g = _perm[ii + i1 + _perm[jj + j1]] % 12;
    n1 = t1 * t1 * (_grad[g * 2] * x1 + _grad[g * 2 + 1] * y1);
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    t2 *= t2;
    const g = _perm[ii + 1 + _perm[jj + 1]] % 12;
    n2 = t2 * t2 * (_grad[g * 2] * x2 + _grad[g * 2 + 1] * y2);
  }
  return 70 * (n0 + n1 + n2);
}

/** ridged: (1 − |noise|)² → punggung tajam dengan lembah landai (0..1) */
export function ridged2(x: number, z: number): number {
  const r = 1 - Math.abs(simplex2(x, z));
  return r * r;
}

// ---------------------------------------------------------------------------
// WORLD MODE (pilihan biome): 0 = Petualangan (auto blend) · 1 Gurun · 2 Ngarai · 3 Kuil
// ---------------------------------------------------------------------------
const WORLD = { mode: 0 };
export function setWorldMode(m: number) {
  WORLD.mode = clamp(Math.round(m), 0, 3);
}
export function getWorldMode(): number {
  return WORLD.mode;
}
export interface BiomeW {
  dunes: number;
  canyon: number;
  temple: number;
}
const _bw: BiomeW = { dunes: 1, canyon: 0, temple: 0 };

/**
 * biomeWeights(z): bobot tiga biome yang SELALU berjumlah 1. Memakai noise 1D
 * sangat lambat sehingga transisi antar biome mulus selama ratusan meter —
 * tidak pernah ada "garis batas".
 */
export function biomeWeights(z: number, out: BiomeW = _bw): BiomeW {
  if (WORLD.mode === 1) {
    out.dunes = 1;
    out.canyon = 0;
    out.temple = 0;
    return out;
  }
  if (WORLD.mode === 2) {
    out.dunes = 0;
    out.canyon = 1;
    out.temple = 0;
    return out;
  }
  if (WORLD.mode === 3) {
    out.dunes = 0;
    out.canyon = 0;
    out.temple = 1;
    return out;
  }
  const n = simplex2(z * 0.0011, 42.7) * 0.5 + 0.5;
  out.canyon = smoothstep(0.5, 0.62, n) * (1 - smoothstep(0.74, 0.82, n));
  out.temple = smoothstep(0.78, 0.88, n);
  out.dunes = 1 - smoothstep(0.38, 0.5, n);
  const s = out.dunes + out.canyon + out.temple;
  if (s <= 0.0001) {
    out.dunes = 1;
    return out;
  }
  out.dunes /= s;
  out.canyon /= s;
  out.temple /= s;
  return out;
}

/**
 * The dune field. Long ridges run roughly along X so you get beautiful
 * long carving lines, with domain warping so nothing ever repeats.
 */
/**
 * The dune field: sculpted like a mega-huge gentle rolling mountain (gunung lembut mega besar).
 * Broad, colossal mountain harmonics + aerodynamic launch mounds (gundukan pelontar)
 * and an endless wavy downhill slope (pitch bergelombang 0.30–0.86, rata-rata ~0.58)
 * that delivers a continuous, exhilarating Alto's Odyssey 3D mountain descent.
 */
export function baseDune(x: number, z: number): number {
  // domain warp (simplex) — bentuk mega tidak pernah berulang persis
  const wq = 0.004;
  const wx = x + 40 * simplex2(x * wq + 3.7, z * wq + 1.3);
  const wz = z + 40 * simplex2(x * wq + 12.1, z * wq + 8.4);

  const B = biomeWeights(z);
  const rug = B.canyon * 0.85 + B.temple * 0.25; // kekasaran permukaan per biome

  // ---- fractal layering (simplex + ridged) ----
  let h = 0;
  h += 52 * (ridged2(wx * 0.0011 + 0.3, wz * 0.0013) - 0.42); // mega dunes (puncak 500–900 m)
  h += 30 * (ridged2(wx * 0.002 + 7.3, wz * 0.0021 + 2.9) - 0.42); // bukit sekunder
  h += (5 + 8 * rug) * simplex2(wx * 0.0065, wz * 0.0065); // undulasi menengah
  h += (0.6 + 2.4 * rug) * simplex2(wx * 0.03, wz * 0.03); // tekstur permukaan
  h += 0.16 * (1 - rug) * simplex2(x * 0.22 + z * 0.05, z * 0.05); // riak pasir anisotropik (gurun)

  // NGARAI MERAH: teras MESA — ketinggian di-kuantisasi ke kelipatan 9 m dengan
  // tepi smoothstep, lalu di-lerp 60%. Di lorong tengah jalur efeknya diredam
  // supaya downhill tetap mulus & aman (tebing bertingkat menjulang di sisi).
  if (B.canyon > 0.01) {
    const lane = Math.abs(x - pathX(z));
    const terrAmt = 0.6 * B.canyon * smoothstep(8, 42, lane);
    if (terrAmt > 0.01) {
      const step = 9;
      const u = h / step;
      const fl = Math.floor(u);
      const q = (fl + smoothstep(0.25, 0.75, u - fl)) * step;
      h = mix(h, q, terrAmt);
    }
  }
  // RERUNTUHAN KUIL: dataran lebih rata & tenang
  h = mix(h, h * 0.65, 0.5 * B.temple);

  // ---- aturan global ----
  // mangkuk halus: jalur carving tetap di tengah lembah
  const dx = Math.abs(x - pathX(z));
  h += dx * dx * 0.0006;
  // dinding pegunungan raksasa di kedua sisi (peaks ridged skala kilometer, ×170 m)
  if (dx > 55) {
    const wall = smoothstep(55, 420, dx);
    const pk = 0.5 + 0.5 * simplex2(z * 0.0009, 11.7);
    h += wall * (40 + pk * 170);
  }

  // gameplay wajib: jurang + kicker pelontar sebelum bibir
  const ch = chasmOfSeg(Math.floor(z / RUN.L), _cb);
  if (ch) {
    const d = Math.max(ch.z0 - z, z - ch.z1, 0);
    h *= 0.32 + 0.68 * smoothstep(12, 70, d);
    h += 3.2 * smoothstep(ch.z0 - 24, ch.z0 - 1, z) * (z < ch.z0 + 1 ? 1 : 0);
  }

  // Gundukan pelontar (sculpted aerodynamic launch mounds) untuk air jump ala Alto:
  h += moundHeightAt(x, z);

  // DOWNHILL BERGELOMBANG (bukan lurus datar!): punggung landai (~0.30)
  // berpadu lereng MENUKIK (s/d ~0.86), rata-rata ~0.58, tak pernah mendaki.
  h -= 0.3 * z
    + 0.2 * (z - Math.sin(z * 0.0038 + 0.9) / 0.0038) // swell raksasa ~1650 m
    + 0.08 * (z - Math.sin(z * 0.011 + 2.3) / 0.011); // undulasi medium ~570 m

  return h;
}

/**
 * Sculpted launch mounds (gundukan pelontar) for beautiful air jumps:
 * Aerodynamic natural ramps placed along the downhill path that launch the player high
 * into the air with matching downhill landing slopes.
 */
export function moundHeightAt(x: number, z: number): number {
  const period = 104;
  const seg = Math.floor(z / period);
  const mz = seg * period + 42 + hash2(seg, 31) * 26;
  const mx = pathX(mz) + (hash2(seg, 73) - 0.5) * 36;

  // avoid placing right over a chasm span
  const ch = chasmOfSeg(Math.floor(mz / RUN.L), _cb);
  if (ch && mz > ch.z0 - 28 && mz < ch.z1 + 28) return 0;

  const dz = z - mz;
  const hl = 26; // 52m smooth ramp length — long & gentle like a soft mega-mountain swell
  if (Math.abs(dz) > hl) return 0;

  const dx = x - mx;
  const hw = 36; // 72m wide generous ramp
  if (Math.abs(dx) > hw) return 0;

  const lat = Math.cos((dx / hw) * (Math.PI * 0.5));
  const mh = 4.6 + hash2(seg, 19) * 2.6; // 4.6m to 7.2m tall soft launch mound

  let profile = 0;
  if (dz < 0) {
    // Upward launch kicker: smooth ramp rising up to the crest
    const u = (dz / hl) + 1; // 0 to 1
    profile = Math.sin(u * Math.PI * 0.5);
  } else {
    // Downward landing ramp: falls away to provide landing boost
    const u = dz / hl; // 0 to 1
    profile = Math.cos(u * Math.PI * 0.5) - u * 0.35;
  }

  return mh * lat * profile;
}

export function isOnMound(x: number, z: number): boolean {
  return moundHeightAt(x, z) > 0.8;
}

// ===========================================================================
// ENDLESS RUN: winding downhill path + chasms
// ===========================================================================
export const RUN = { start: 0, SLOPE: 0.48, HALF: 160, L: 280, DEPTH: 65 };

/** start a new run: chasms are placed relative to this point */
export function setRunStart(z: number) {
  RUN.start = z;
}

export function pathX(z: number): number {
  // jalur turun gunung dibuat lebih BERLIKU (tidak lurus membosankan):
  // tikungan panjang + seda menengah + gelitikan cepat untuk carving hidup
  return 58 * Math.sin(z * 0.0021 + 0.4) + 30 * Math.sin(z * 0.0072 + 2.2) + 13 * Math.sin(z * 0.016 + 5.1);
}
export function pathSlope(z: number): number {
  return (
    58 * 0.0021 * Math.cos(z * 0.0021 + 0.4) +
    30 * 0.0072 * Math.cos(z * 0.0072 + 2.2) +
    13 * 0.016 * Math.cos(z * 0.016 + 5.1)
  );
}
export function pathYaw(z: number): number {
  return Math.atan2(pathSlope(z), 1);
}

export interface Chasm {
  z0: number; // near lip
  z1: number; // far lip
  zc: number;
  w: number;
  id: number;
}
const _cb: Chasm = { z0: 0, z1: 0, zc: 0, w: 0, id: 0 };
const _cc: Chasm = { z0: 0, z1: 0, zc: 0, w: 0, id: 0 };

/**
 * The chasm of path segment n (or null). Deterministic; difficulty grows with
 * the distance from the run start: chasms get wider and more frequent.
 */
export function chasmOfSeg(n: number, out: Chasm): Chasm | null {
  const segZ = n * RUN.L;
  const rel = segZ - RUN.start;
  if (rel < 380) return null; // calm warm-up
  const km = rel / 1000;
  const p = Math.min(0.93, 0.62 + km * 0.07);
  if (hash2(n, 91) > p) return null;
  const w = 9 + Math.min(20, km * 3.6) + hash2(n, 17) * 7;
  const zc = segZ + 72 + hash2(n, 53) * 106;
  out.z0 = zc - w / 2;
  out.z1 = zc + w / 2;
  out.zc = zc;
  out.w = w;
  out.id = n;
  return out;
}

export function chasmAt(z: number, out: Chasm = _cc): Chasm | null {
  return chasmOfSeg(Math.floor(z / RUN.L), out);
}

/** is z strictly inside a chasm span */
export function inChasm(z: number): boolean {
  const c = chasmAt(z, _cc);
  return c !== null && z > c.z0 && z < c.z1;
}

/** terrain with the chasm carved out (steep walls, deep abyss) */
export function carveChasm(z: number, h: number): number {
  const c = chasmAt(z, _cc);
  if (!c) return h;
  const e = Math.min(z - c.z0, c.z1 - z);
  if (e <= 0) return h;
  return h - RUN.DEPTH * smoothstep(0, 1.6, e);
}

/** rivers don't fit an endless descent: switched off in this mode */
export const RIVERS_ON = false;

// ===========================================================================
// RIVERS & WATERFALLS
//
// A meandering river runs along +Z through the playground. It is split into
// 1 km segments: each one is born from a SPRING POOL, flows downhill through
// a carved valley / gorge, drops over WATERFALLS and ends in an OASIS LAKE.
//
// The water level of a segment is planned once from the dunes along its
// centre line (smoothed, biased downhill, look-ahead): wherever the dunes
// ahead fall away, the level steps down → a waterfall. Water therefore always
// flows downstream (+Z), in the direction you usually ride.
//
// duneHeight() returns the CARVED terrain (river bed, banks, gorge walls,
// cliffs under the falls, plunge pools). rideHeight() adds the water surface,
// so the rider hovers ON the water.
// ===========================================================================

export const RIVER = { SEG: 1000, RS: 70, RE: 930, DX: 2, POOL_R: 13, LAKE_R: 36, LAKE_OFF: 24 };
export const NO_WATER = -1e9;

export interface Fall {
  zl: number; // lip position
  top: number;
  bottom: number;
  run: number; // horizontal length of the falling arc
}

export interface RiverSeg {
  n: number;
  zs: number;
  ze: number;
  N: number;
  lvl: Float32Array;
  falls: Fall[];
  poolX: number;
  poolZ: number;
  poolLevel: number;
  lakeX: number;
  lakeZ: number;
  lakeLevel: number;
}

export function riverX(z: number): number {
  return 52 * Math.sin(z * 0.0041 + 0.7) + 26 * Math.sin(z * 0.0107 + 2.1);
}

export function riverSlope(z: number): number {
  return 52 * 0.0041 * Math.cos(z * 0.0041 + 0.7) + 26 * 0.0107 * Math.cos(z * 0.0107 + 2.1);
}

/** half width of the channel at local position u (m inside the segment) */
export function riverHalfW(u: number, n: number): number {
  const { RS, RE } = RIVER;
  let hw = 8.5 + 2.5 * Math.sin(u * 0.011 + n * 1.7);
  hw *= 0.45 + 0.55 * smoothstep(RS, RS + 45, u);
  hw += 9 * smoothstep(RE - 110, RE, u);
  return hw;
}

const segCache = new Map<number, RiverSeg>();

function buildSeg(n: number): RiverSeg {
  const { SEG, RS, RE, DX } = RIVER;
  const zs = n * SEG + RS;
  const ze = n * SEG + RE;
  const N = Math.round((RE - RS) / DX) + 1;
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const z = zs + i * DX;
    raw[i] = baseDune(riverX(z), z);
  }
  // smoothed dune line along the river, biased downhill
  const W = 15;
  const sm = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - W); j <= Math.min(N - 1, i + W); j++) {
      s += raw[j];
      c++;
    }
    sm[i] = s / c - 0.022 * i * DX;
  }
  const lvl = new Float32Array(N);
  const falls: Fall[] = [];
  let cur = Infinity;
  for (let i = 0; i < 12; i++) cur = Math.min(cur, sm[i]);
  cur -= 1.4;
  let last = -999;
  for (let i = 0; i < N; i++) {
    cur -= 0.0035 * DX; // gentle flowing slope
    let ahead = Infinity;
    for (let j = i; j <= Math.min(N - 1, i + 28); j++) ahead = Math.min(ahead, sm[j]);
    const need = cur - ahead;
    // fewer but TALLER falls: they collect the drop until it is worth a real waterfall
    if (i > 6 && i < N - 28 && ((need > 5 && i - last > 18) || need > 12)) {
      const drop = Math.min(need - 0.6, 20);
      if (drop > 3.8) {
        falls.push({ zl: zs + i * DX, top: cur, bottom: cur - drop, run: 2.2 + 1.35 * Math.sqrt(drop) });
        cur -= drop;
        last = i;
      }
    }
    lvl[i] = cur;
  }

  // guarantee: every river segment has at least one proper waterfall
  if (!falls.some((f) => f.top - f.bottom >= 5)) {
    let i0 = Math.round(N * 0.42);
    for (const f of falls) {
      const fi = Math.round((f.zl - zs) / DX);
      if (Math.abs(fi - i0) < 20) i0 = fi + 24;
    }
    i0 = Math.min(i0, N - 30);
    const drop = 8;
    const top = lvl[i0 - 1];
    for (const f of falls) {
      if (f.zl > zs + i0 * DX) {
        f.top -= drop;
        f.bottom -= drop;
      }
    }
    for (let j = i0; j < N; j++) lvl[j] -= drop;
    falls.push({ zl: zs + i0 * DX, top, bottom: top - drop, run: 2.2 + 1.35 * Math.sqrt(drop) });
    falls.sort((a, b) => a.zl - b.zl);
  }
  const lakeZ = ze + RIVER.LAKE_OFF;
  return {
    n,
    zs,
    ze,
    N,
    lvl,
    falls,
    poolX: riverX(zs),
    poolZ: zs,
    poolLevel: lvl[0],
    lakeX: riverX(lakeZ),
    lakeZ,
    lakeLevel: lvl[N - 1],
  };
}

export function getRiverSeg(n: number): RiverSeg {
  let s = segCache.get(n);
  if (!s) {
    s = buildSeg(n);
    segCache.set(n, s);
    if (segCache.size > 16) {
      const first = segCache.keys().next().value;
      if (first !== undefined) segCache.delete(first);
    }
  }
  return s;
}

/** planned level with sharp steps at the falls (used for the bed & banks) */
export function riverLevelAt(seg: RiverSeg, z: number): number {
  const f = (z - seg.zs) / RIVER.DX;
  if (f <= 0) return seg.lvl[0];
  if (f >= seg.N - 1) return seg.lvl[seg.N - 1];
  const i0 = Math.floor(f);
  const a = seg.lvl[i0];
  const b = seg.lvl[i0 + 1];
  if (a - b > 1) return a; // a waterfall lip starts at the next sample
  return a + (b - a) * (f - i0);
}

/** the actual water surface: lip acceleration + free-falling arc at every fall */
export function waterSurfaceZ(seg: RiverSeg, z: number): number {
  for (const f of seg.falls) {
    if (z < f.zl - 9 || z > f.zl + f.run) continue;
    if (z < f.zl) return riverLevelAt(seg, z) - 0.4 * smoothstep(f.zl - 9, f.zl, z);
    const t = (z - f.zl) / f.run;
    const top = f.top - 0.4;
    return top - (top - f.bottom) * t * t;
  }
  return riverLevelAt(seg, z);
}

/** flow texture coordinate: metres travelled by the water (falls add their height) */
export function riverV(seg: RiverSeg, z: number): number {
  let v = z - seg.zs;
  for (const f of seg.falls) {
    if (z <= f.zl) break;
    v += (f.top - f.bottom) * 1.15 * Math.min(1, (z - f.zl) / f.run);
  }
  return v;
}

function plungeAt(seg: RiverSeg, z: number): number {
  let p = 0;
  for (const f of seg.falls) {
    const land = f.zl + f.run;
    if (z < f.zl || z > land + 20) continue;
    const k = Math.min(1, (f.top - f.bottom) / 8);
    p += 2.8 * k * smoothstep(f.zl, land, z) * (1 - smoothstep(land + 4, land + 20, z));
  }
  return p;
}

export interface WorldSample {
  h: number; // carved terrain height
  level: number; // planned water level nearby (NO_WATER if none)
  surf: number; // water surface at this point (NO_WATER if dry)
  e: number; // signed distance to the water edge (negative = in the water)
}

interface SegHit {
  e: number;
  level: number;
  surf: number;
  hw: number;
  mode: number; // 0 channel, 1 spring pool, 2 lake
  seg: RiverSeg | null;
}
const _hA: SegHit = { e: 1e9, level: NO_WATER, surf: NO_WATER, hw: 0, mode: 0, seg: null };
const _hB: SegHit = { e: 1e9, level: NO_WATER, surf: NO_WATER, hw: 0, mode: 0, seg: null };

/** distance to the water of one river segment (channel, spring pool, lake) */
function segHit(n: number, x: number, z: number, out: SegHit): SegHit {
  out.e = 1e9;
  out.level = NO_WATER;
  out.surf = NO_WATER;
  out.hw = 0;
  out.mode = 0;
  out.seg = null;
  const { SEG, RS, RE } = RIVER;
  const u = z - n * SEG;
  // generous range: deep lake gorges may reach into the next segment
  if (u < RS - RIVER.POOL_R - 60 || u > RE + RIVER.LAKE_OFF + RIVER.LAKE_R + 72) return out;
  const seg = getRiverSeg(n);
  out.seg = seg;
  if (u >= RS && u <= RE) {
    const cx = riverX(z);
    if (Math.abs(x - cx) < 130) {
      const s = riverSlope(z);
      const dperp = Math.abs(x - cx) / Math.sqrt(1 + s * s);
      out.hw = riverHalfW(u, n);
      out.e = dperp - out.hw;
      out.level = riverLevelAt(seg, z);
      out.surf = waterSurfaceZ(seg, z);
    }
  }
  const dp = Math.hypot(x - seg.poolX, z - seg.poolZ) - RIVER.POOL_R;
  if (dp < out.e) {
    out.e = dp;
    out.level = out.surf = seg.poolLevel;
    out.hw = RIVER.POOL_R;
    out.mode = 1;
  }
  const dl = Math.hypot(x - seg.lakeX, z - seg.lakeZ) - RIVER.LAKE_R;
  if (dl < out.e) {
    out.e = dl;
    out.level = out.surf = seg.lakeLevel;
    out.hw = RIVER.LAKE_R;
    out.mode = 2;
  }
  return out;
}

/** full world sample: carved terrain + water */
export function worldSample(x: number, z: number, out: WorldSample): WorldSample {
  const base = baseDune(x, z);
  out.h = carveChasm(z, base);
  out.level = NO_WATER;
  out.surf = NO_WATER;
  out.e = 1e9;
  if (!RIVERS_ON) return out;
  const n = Math.floor(z / RIVER.SEG);
  let H = segHit(n, x, z, _hA);
  // the previous segment's oasis lake can spill across the boundary
  if (z - n * RIVER.SEG < 120) {
    const B2 = segHit(n - 1, x, z, _hB);
    if (B2.e < H.e) H = B2;
  }
  if (H.level === NO_WATER || !H.seg) return out;
  const seg = H.seg;
  const e = H.e;
  const level = H.level;
  const surf = H.surf;
  const hw = H.hw;
  const mode = H.mode;
  const B = 13 + 0.75 * Math.max(0, base - level); // wider walls for deep gorges
  if (e > B) return out;

  out.e = e;
  out.level = level;
  if (e >= 0) {
    // banks / gorge walls / embankments blend back into the dunes
    const t = smoothstep(0, B, e);
    out.h = level + 0.75 + (base - level - 0.75) * t;
    if (e < 1.4) out.surf = surf;
  } else {
    // river bed: soft shore, then deepening toward the middle
    const D = mode === 2 ? 5.5 : mode === 1 ? 4 : 3.1;
    const bed = mode === 0 ? level - plungeAt(seg, z) : level;
    out.h =
      bed +
      0.75 -
      1.35 * smoothstep(0, -2.5, e) -
      (D - 0.6) * smoothstep(-1.5, -Math.max(3, Math.min(hw * 0.75, 14)), e);
    out.surf = surf;
  }
  return out;
}

const _ws: WorldSample = { h: 0, level: NO_WATER, surf: NO_WATER, e: 1e9 };

/** carved terrain height (river bed, banks, gorges, waterfall cliffs) */
export function duneHeight(x: number, z: number): number {
  return worldSample(x, z, _ws).h;
}

/** water surface height at a point, or NO_WATER */
export function waterLevel(x: number, z: number): number {
  return worldSample(x, z, _ws).surf;
}

/** the surface the rider hovers over: terrain or water, whichever is higher */
export function rideHeight(x: number, z: number): number {
  worldSample(x, z, _ws);
  return _ws.surf > _ws.h ? _ws.surf : _ws.h;
}

// ---------------------------------------------------------------------------
// SMOOTH SURFACE: a gaussian-ish spatial blur of the dune field.
// Speed-independent low-pass: rough contours disappear, big dune shapes stay.
// 13 taps: center + inner ring (6) + outer ring (6, rotated 30°).
// ---------------------------------------------------------------------------
const RING_A: [number, number][] = [];
const RING_B: [number, number][] = [];
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  RING_A.push([Math.cos(a), Math.sin(a)]);
  const b = a + Math.PI / 6;
  RING_B.push([Math.cos(b), Math.sin(b)]);
}

/**
 * Smoothed RIDE surface: what the hover physics floats on.
 * The slopes are blurred (silky hover), but a chasm is a SHARP cut: over a
 * chasm the surface is the abyss floor, so the rider really drops.
 */
export function smoothHeight(x: number, z: number, r: number): number {
  if (inChasm(z)) return baseDune(x, z) - RUN.DEPTH;
  return slopeSmooth(x, z, r);
}

/** blurred terrain ignoring chasms (used for gliding over them in the menu) */
export function slopeSmooth(x: number, z: number, r: number): number {
  if (r < 0.3) return baseDune(x, z);
  let h = baseDune(x, z) * 0.26;
  const ri = r * 0.5;
  let a = 0;
  let b = 0;
  for (let i = 0; i < 6; i++) {
    a += baseDune(x + RING_A[i][0] * ri, z + RING_A[i][1] * ri);
    b += baseDune(x + RING_B[i][0] * r, z + RING_B[i][1] * r);
  }
  h += (a / 6) * 0.42 + (b / 6) * 0.32;
  return h;
}

/** smoothing radius (m) derived from the "bump filter" setting */
export function surfaceRadius(bumpFilter: number): number {
  return 1.5 + clamp(bumpFilter, 0, 4) * 4.5;
}

/** gradient of the RIDE surface (terrain or water) – used for slope pull & attitude */
export function duneGradient(x: number, z: number, e = 1.6, out: { x: number; z: number }) {
  // slope of the terrain without chasms: a chasm never "pulls" the rider in
  out.x = (baseDune(x + e, z) - baseDune(x - e, z)) / (2 * e);
  out.z = (baseDune(x, z + e) - baseDune(x, z - e)) / (2 * e);
  return out;
}

/** direction the river flows at z (yaw, same convention as the rider) */
export function riverYaw(z: number): number {
  return Math.atan2(riverSlope(z), 1);
}

export interface FallInfo {
  lipX: number;
  lipZ: number;
  landX: number;
  landZ: number;
  drop: number;
  seg: number;
}

/** the next waterfall downstream of z (at least `minAhead` m ahead) */
export function nextWaterfall(z: number, minAhead = 0, minDrop = 4): FallInfo | null {
  if (!RIVERS_ON) return null;
  const n0 = Math.floor(z / RIVER.SEG);
  for (let n = n0; n < n0 + 5; n++) {
    const seg = getRiverSeg(n);
    for (const f of seg.falls) {
      if (f.zl < z + minAhead || f.top - f.bottom < minDrop) continue;
      return {
        lipX: riverX(f.zl),
        lipZ: f.zl,
        landX: riverX(f.zl + f.run),
        landZ: f.zl + f.run,
        drop: f.top - f.bottom,
        seg: n,
      };
    }
  }
  return null;
}

/**
 * Start ON the river, ~170 m upstream of the first proper waterfall, facing
 * downstream, so the very first thing you ride into is a waterfall.
 */
export function findStart(): { x: number; z: number; yaw: number } {
  const f = nextWaterfall(0, 200, 5);
  const z = f ? f.lipZ - 170 : getRiverSeg(0).zs + 40;
  return { x: riverX(z), z, yaw: riverYaw(z) };
}
