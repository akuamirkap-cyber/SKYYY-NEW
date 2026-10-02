import * as THREE from 'three';

// ---------------------------------------------------------------------------
// VISTA — pegunungan siluet berlapis di cakrawala.
//
// Dua cincin punggungan low-poly di radius 700 & 830 m (di dalam sky dome,
// tepat setelah medan detail berakhir ±590 m) yang mengikuti kamera seperti
// skybox. Puncak dibangkitkan dari jumlah sinus tak sinkron + ridged noise
// (lembah & celah gunung alami, deterministik), lalu DIWARNAI per-frame dari
// palet langit aktif → pegunungan selalu menyatu dengan suasana (golden
// hour = ungu-jingga, malam = biru gelap, dst) dengan perspektif atmosfer:
// cincin jauh lebih pucat, cincin dekat lebih pekat.
// ---------------------------------------------------------------------------

const SEG = 200;

/** tinggi punggungan pada sudut a (radian) — berlapis oktaf + ridged */
function ridge(a: number, seed: number): number {
  const s = seed * 17.31;
  let h =
    0.52 +
    0.30 * Math.sin(a * 3.1 + s) +
    0.21 * Math.sin(a * 7.3 + s * 1.7 + 1.9) +
    0.12 * Math.sin(a * 13.7 + s * 0.6 + 4.2);
  // ridged: puncak tajam & lembah dalam dari |sin|
  h += 0.34 * Math.abs(Math.sin(a * 5.9 + s * 2.3));
  h += 0.16 * Math.abs(Math.sin(a * 11.3 + s * 0.9 + 2.6));
  // celah gunung sesekali (pegunungan nyata tidak rata)
  h *= 0.55 + 0.45 * Math.sin(a * 0.9 + s * 3.1);
  return Math.max(0.06, h);
}

function ringGeo(
  radius: number,
  baseY: number,
  amp: number,
  seed: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const r = radius + Math.sin(a * 4.7 + seed * 5.1) * 18; // variasi jarak
    const top = baseY + ridge(a, seed) * amp;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    pos.push(x, top, z); // puncak
    pos.push(x, baseY - 140, z); // dasar jatuh jauh di bawah cakrawala
  }
  for (let i = 0; i < SEG; i++) {
    const t0 = i * 2;
    const t1 = (i + 1) * 2;
    idx.push(t0, t0 + 1, t1, t0 + 1, t1 + 1, t1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class DistantVista {
  group = new THREE.Group();
  private farMat: THREE.MeshBasicMaterial;
  private nearMat: THREE.MeshBasicMaterial;
  private cFar = new THREE.Color();
  private cNear = new THREE.Color();
  private tmp = new THREE.Color();

  constructor() {
    this.farMat = new THREE.MeshBasicMaterial({
      color: 0xbcc8dd,
      fog: false,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.nearMat = new THREE.MeshBasicMaterial({
      color: 0x8e9ab5,
      fog: false,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    // cincin jauh: lebih tinggi & pucat · cincin dekat: lebih rendah & pekat
    const far = new THREE.Mesh(ringGeo(830, -42, 150, 3), this.farMat);
    const near = new THREE.Mesh(ringGeo(700, -26, 96, 11), this.nearMat);
    far.renderOrder = -8;
    near.renderOrder = -7;
    far.frustumCulled = false;
    near.frustumCulled = false;
    this.group.add(far, near);
    this.group.renderOrder = -8;
  }

  /** warna menyatu dengan langit aktif: jauh = pucat keabu-biruan,
   *  dekat = lebih pekat — perspektif atmosfer klasik lukisan pemandangan */
  apply(top: THREE.Color, mid: THREE.Color, hor: THREE.Color, fog: THREE.Color) {
    this.tmp.copy(hor).lerp(mid, 0.62);
    this.cFar.copy(this.tmp).lerp(fog, 0.30).lerp(top, 0.10);
    this.cNear.copy(this.tmp).lerp(fog, 0.16).multiplyScalar(0.82);
    this.farMat.color.copy(this.cFar);
    this.nearMat.color.copy(this.cNear);
  }
}
