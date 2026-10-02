import * as THREE from 'three';

// ---------------------------------------------------------------------------
// AURORA — tirai cahaya polar prosedural di langit.
//
// Cara kerja (semua di fragment shader, murah & tanpa tekstur):
//   1. TEPI BAWAH TIRAI bergelombang dari fbm noise di sumbu azimut —
//      lentur besar + riak kecil, hanyut super lambat.
//   2. SINAR-SINAR VERTIKAL: noise frekuensi tinggi di azimut, dipertajam
//      (pow) jadi kolom-kolom cahaya terpisah; kolom hanyut & berkedip.
//   3. PROFIL VERTIKAL: naik tajam dari tepi bawah → puncak → luruh
//      eksponensial panjang ke atas, persis siluet aurora asli.
//   4. FRINGE PINK klasik: strip tipis merah muda di tepi bawah tirai.
//   5. PULSA berjalan sepanjang tirai (kilau "hujan cahaya").
//
// WARNANYA ADAPTIF (applyMood): dihitung dari warna langit yang SEDANG
// aktif — hue aurora selalu dipilih yang paling kontras namun selaras
// (split-complementary dari hue langit atas), lalu dilebur sedikit ke warna
// horizon. Palet siang → aurora samar lembut; palet malam/twilight →
// aurora penuh gemilang.
// ---------------------------------------------------------------------------

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColA;   // inti tirai (paling terang)
  uniform vec3 uColB;   // bagian atas tirai
  uniform vec3 uColC;   // fringe tepi bawah (pink klasik)
  uniform vec3 uHor;    // warna horizon langit aktif (untuk melebur)
  varying vec3 vDir;

  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h21(i), b = h21(i + vec2(1.0, 0.0));
    float c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * vnoise(p);
      p = p * 2.13 + vec2(11.7, 5.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float az = atan(d.x, d.z); // sudut horizontal -pi..pi
    float h = d.y;             // elevasi

    float t = uTime * 0.026; // waktu super lambat (drama, bukan disco)

    // ---- 1) gelombang tepi bawah tirai: lentur besar + riak
    float base = 0.13
      + 0.115 * fbm(vec2(az * 1.5 + t, t * 0.6))
      + 0.045 * fbm(vec2(az * 4.2 - t * 1.35, 5.2 + t * 0.2));

    // ---- 2) kolom cahaya vertikal: noise tajam di azimut, hanyut pelan
    float drift = t * 2.4;
    float rays = fbm(vec2(az * 20.0 + drift, t * 0.4));
    rays = pow(max(rays, 0.0), 2.3) * 1.55 + 0.22;
    float fine = fbm(vec2(az * 52.0 - drift * 1.6, 7.7 + t * 0.25));
    rays *= 0.62 + 0.75 * fine;

    // ---- 3) profil vertikal dari tepi ke atas
    float span = max(0.2, 0.85 - base);
    float rel = (h - base) / span; // 0 = tepi bawah, makin besar makin tinggi
    float body = smoothstep(0.0, 0.055, rel) * exp(-max(rel, 0.0) * 2.5);

    // ---- 4) fringe pink klasik di strip tipis tepi bawah
    float fringe = smoothstep(-0.025, 0.012, rel) * (1.0 - smoothstep(0.015, 0.11, rel));

    // ---- 5) pulsa berjalan + denyut global lembut
    float pulse = 0.7
      + 0.3 * sin(az * 8.0 - uTime * 0.42 + rays * 4.0)
      + 0.16 * sin(az * 2.6 + uTime * 0.21)
      + 0.08 * sin(uTime * 0.15);

    // mask: muncul di langit atas, meluruh sebelum zenith & di bawah horizon
    float mask = smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.5, 0.92, h));

    float i = body * rays * pulse * mask * uIntensity;
    if (i < 0.004) discard;

    // warna: inti -> atas, fringe menyala di tepi, melebur ke warna horizon
    vec3 col = mix(uColA, uColB, clamp(rel * 1.45, 0.0, 1.0));
    col = mix(col, uColC, fringe * 0.9);
    col = mix(col, uHor, (1.0 - smoothstep(0.0, 0.24, rel)) * 0.32);

    gl_FragColor = vec4(col * i, i);
  }
`;

const CANDIDATE_HUES = [0.34, 0.44, 0.52, 0.76, 0.86]; // hijau, teal, cyan, ungu, magenta

function hueDist(a: number, b: number) {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
}

export class Aurora {
  mesh: THREE.Mesh;
  private u = {
    uTime: { value: 0 },
    uIntensity: { value: 1 },
    uColA: { value: new THREE.Color('#37ffa0') },
    uColB: { value: new THREE.Color('#7a5cff') },
    uColC: { value: new THREE.Color('#ff5fb0') },
    uHor: { value: new THREE.Color('#ffd2a2') },
  };
  private hsl = { h: 0, s: 0, l: 0 };
  private cA = new THREE.Color();
  private cB = new THREE.Color();
  private cC = new THREE.Color();

  constructor() {
    // silinder terbuka mengelilingi pemain, DI DALAM sky dome (r 900) dan
    // DI BELAKANG awan (r <= 760) → tirai tampak jauh di angkasa
    const geo = new THREE.CylinderGeometry(820, 820, 760, 96, 1, true);
    geo.translate(0, 250, 0); // dari y -130 sampai 630: dominan di langit atas
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -9; // tepat setelah sky dome (-10), sebelum awan
  }

  /**
   * Adaptasi warna dari mood langit AKTIF:
   *  - hue tirai = kandidat yang paling jauh dari hue langit atas & horizon
   *    (split-complementary) → selalu kontras tapi selalu selaras
   *  - fringe = tetangga komplementer dari hue inti (hijau↔pink klasik)
   *  - siang (langit terang) → tirai samar lembut; malam/twilight → gemilang
   */
  applyMood(top: THREE.Color, hor: THREE.Color, stars: number, glow: number, userAmount: number) {
    top.getHSL(this.hsl);
    const topH = this.hsl.h;
    hor.getHSL(this.hsl);
    const horH = this.hsl.h;
    const horL = this.hsl.l;

    // dua hue terjauh dari langit (inti dulu, lalu pendamping yang masih jauh)
    let bestA = CANDIDATE_HUES[0];
    let bestB = CANDIDATE_HUES[2];
    let dA = -1;
    for (const c of CANDIDATE_HUES) {
      const d = Math.min(hueDist(c, topH), hueDist(c, horH));
      if (d > dA) {
        dA = d;
        bestA = c;
      }
    }
    let dB = -1;
    for (const c of CANDIDATE_HUES) {
      const d = Math.min(hueDist(c, topH), hueDist(c, horH)) * 0.6 + hueDist(c, bestA) * 0.4;
      if (c !== bestA && d > dB) {
        dB = d;
        bestB = c;
      }
    }
    // fringe: komplemen lembut dari inti (hijau → pink, magenta → hijau emas)
    const fringeH = (bestA + 0.5) % 1;

    // saturasi & terang; sedikit dilebur ke horizon agar menyatu
    this.cA.setHSL(bestA, 0.9, 0.6).lerp(hor, 0.1);
    this.cB.setHSL(bestB, 0.78, 0.48).lerp(hor, 0.08);
    this.cC.setHSL(fringeH, 0.85, 0.62).lerp(hor, 0.12);
    this.u.uColA.value.copy(this.cA);
    this.u.uColB.value.copy(this.cB);
    this.u.uColC.value.copy(this.cC);
    this.u.uHor.value.copy(hor);

    // kekuatan: malam/twilight penuh, siang samar tapi tetap ada
    const dark = 1 - Math.min(1, horL * 1.35);
    const nf = 0.34 + stars * 0.52 + dark * 0.5;
    this.u.uIntensity.value = Math.min(1.25, nf) * Math.max(0, userAmount) * (0.7 + 0.3 * glow);
  }

  update(time: number) {
    this.u.uTime.value = time;
  }
}
