import * as THREE from 'three';
import { SkyDome } from './world';

// ---------------------------------------------------------------------------
// CRYSTAL MATERIAL
// Built on MeshPhysicalMaterial (real clearcoat + thin-film iridescence +
// environment reflections), with a shader hook that adds:
//   • deep glassy core     - the centre darkens into a cool depth tint
//   • rainbow fresnel rim  - prismatic dispersion along the silhouette
//   • inner facets         - tiny internal planes that twinkle as you move
//   • soft caustic bands   - light flowing slowly through the body
// ---------------------------------------------------------------------------

export interface CrystalUniforms {
  uTime: { value: number };
  uRim: { value: THREE.Color };
  uDeep: { value: THREE.Color };
  uInner: { value: THREE.Color };
  uGlow: { value: number };
  uSpark: { value: number };
  uFacet: { value: number };
  uPrism: { value: number }; // rainbow dispersion on the silhouette
  uSparkK: { value: number }; // per-skin internal sparkle multiplier
  uDepth: { value: number }; // how deep / saturated the glass core is
}

// ---------------------------------------------------------------------------
// CRYSTAL SKINS: every colour keeps the glassy, clear look.
// ---------------------------------------------------------------------------
export interface CrystalSkin {
  name: string;
  tint: string; // body colour
  deep: string; // colour seen deep inside the glass
  rim: string; // edge light
  inner: string; // flowing inner light
  emissive: string;
  prism: number;
  spark: number;
  depth: number;
  ior: number;
}

export const CRYSTAL_SKINS: CrystalSkin[] = [
  { name: 'Putih', tint: '#eef6ff', deep: '#9fb4d8', rim: '#e6f4ff', inner: '#d8efff', emissive: '#bcd6ff', prism: 1, spark: 1, depth: 0.42, ior: 1.7 },
  { name: 'Diamond', tint: '#ffffff', deep: '#eef3ff', rim: '#ffffff', inner: '#ffffff', emissive: '#ffffff', prism: 1.9, spark: 2.4, depth: 0.14, ior: 2.42 },
  { name: 'Indigo', tint: '#8c80ff', deep: '#35279c', rim: '#d2ccff', inner: '#aa9eff', emissive: '#5b4bff', prism: 1.1, spark: 1.1, depth: 0.55, ior: 1.7 },
  { name: 'Safir', tint: '#7fb2ff', deep: '#1c4bb3', rim: '#d4e8ff', inner: '#9dcaff', emissive: '#3d7bff', prism: 1.1, spark: 1.1, depth: 0.55, ior: 1.77 },
  { name: 'Es Biru', tint: '#c8ecff', deep: '#4f9fd6', rim: '#f0faff', inner: '#bff0ff', emissive: '#8fd8ff', prism: 1.2, spark: 1.4, depth: 0.35, ior: 1.6 },
  { name: 'Aqua', tint: '#9ff2f2', deep: '#128a9c', rim: '#dcffff', inner: '#9ffff0', emissive: '#2fd6d0', prism: 1.1, spark: 1.1, depth: 0.5, ior: 1.6 },
  { name: 'Amethyst', tint: '#c9a0ff', deep: '#5e2aa8', rim: '#f0dcff', inner: '#dcb8ff', emissive: '#9b5cff', prism: 1.1, spark: 1.1, depth: 0.52, ior: 1.55 },
  { name: 'Rose Quartz', tint: '#ffc6d9', deep: '#c05888', rim: '#fff0f6', inner: '#ffd6e6', emissive: '#ff8fb8', prism: 1, spark: 1, depth: 0.4, ior: 1.55 },
  { name: 'Ruby', tint: '#ff8a98', deep: '#9c0f2c', rim: '#ffdbe0', inner: '#ffb0bb', emissive: '#ff3b5c', prism: 1, spark: 1.2, depth: 0.58, ior: 1.77 },
  { name: 'Emerald', tint: '#98f0c4', deep: '#127f56', rim: '#dcfff0', inner: '#a8ffd6', emissive: '#27d690', prism: 1, spark: 1.1, depth: 0.52, ior: 1.58 },
  { name: 'Citrine', tint: '#ffdc8f', deep: '#b06a1c', rim: '#fff4d6', inner: '#ffe6ad', emissive: '#ffae3a', prism: 1, spark: 1.1, depth: 0.45, ior: 1.55 },
  { name: 'Midnight', tint: '#434a86', deep: '#0c0e2c', rim: '#b3c0ff', inner: '#7f8cff', emissive: '#3a44c8', prism: 1.4, spark: 1.4, depth: 0.72, ior: 1.7 },
  // Slugpup: putih pucat khas Rain World — kaca mutiara lembut, ekor panjang
  // menyusul otomatis (lihat Game.updateScarf)
  { name: 'Slugpup ✦', tint: '#f2f4f6', deep: '#a9b6c6', rim: '#ffffff', inner: '#e8eff8', emissive: '#c8d4e2', prism: 0.5, spark: 0.55, depth: 0.3, ior: 1.45 },
];

export const ACCENT_METALS = [
  { name: 'Emas', color: '#ffd59a', emissive: '#ff9a4a' },
  { name: 'Perak', color: '#e8eef8', emissive: '#9fc4ff' },
  { name: 'Rose Gold', color: '#ffc0a8', emissive: '#ff8a7a' },
  { name: 'Platina', color: '#f4f8ff', emissive: '#d8e6ff' },
];

const _c = new THREE.Color();

/** apply a skin (or a custom colour derived into a full skin) to the crystal */
export function applyCrystalSkin(mat: THREE.MeshPhysicalMaterial, u: CrystalUniforms, skin: CrystalSkin) {
  mat.color.set(skin.tint);
  mat.emissive.set(skin.emissive);
  mat.sheenColor.set(skin.rim);
  mat.ior = skin.ior;
  mat.iridescence = skin.name === 'Diamond' ? 1 : 0.85;
  mat.roughness = skin.name === 'Diamond' ? 0.02 : 0.06;
  u.uDeep.value.set(skin.deep);
  u.uRim.value.set(skin.rim);
  u.uInner.value.set(skin.inner);
  u.uPrism.value = skin.prism;
  u.uSparkK.value = skin.spark;
  u.uDepth.value = skin.depth;
}

/** build a harmonious skin from a single picked colour */
export function customSkin(hex: string): CrystalSkin {
  const base = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const tint = _c.setHSL(hsl.h, Math.min(1, hsl.s * 0.9), Math.max(0.55, Math.min(0.9, hsl.l + 0.18))).getHexString();
  const deep = _c.setHSL(hsl.h, Math.min(1, hsl.s * 1.05 + 0.1), Math.max(0.08, hsl.l * 0.45)).getHexString();
  const rim = _c.setHSL(hsl.h, hsl.s * 0.5, 0.9).getHexString();
  const inner = _c.setHSL(hsl.h, hsl.s * 0.7, 0.8).getHexString();
  const em = _c.setHSL(hsl.h, Math.min(1, hsl.s + 0.1), 0.6).getHexString();
  return {
    name: 'Custom',
    tint: `#${tint}`,
    deep: `#${deep}`,
    rim: `#${rim}`,
    inner: `#${inner}`,
    emissive: `#${em}`,
    prism: 1.1,
    spark: 1.1,
    depth: 0.5,
    ior: 1.7,
  };
}

export function makeCrystalMaterial(opts: { tint?: string; deep?: string } = {}) {
  const u: CrystalUniforms = {
    uTime: { value: 0 },
    uRim: { value: new THREE.Color('#dff4ff') },
    uDeep: { value: new THREE.Color(opts.deep ?? '#6d8fd6') },
    uInner: { value: new THREE.Color('#bfe9ff') },
    uGlow: { value: 0.3 },
    uSpark: { value: 0.3 },
    uFacet: { value: 26 },
    uPrism: { value: 0.3 },
    uSparkK: { value: 0.3 },
    uDepth: { value: 0.42 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.tint ?? '#e8f6ff'),
    metalness: 0.0,
    roughness: 0.12,
    clearcoat: 0.8,
    clearcoatRoughness: 0.06,
    iridescence: 0.7,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 620],
    sheen: 0.2,
    sheenColor: new THREE.Color('#cdefff'),
    sheenRoughness: 0.4,
    specularIntensity: 0.8,
    ior: 1.6,
    envMapIntensity: 1.0,
    emissive: new THREE.Color('#7fb6ff'),
    emissiveIntensity: 0.018,
  });

  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCrP;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vCrP = position;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime; uniform vec3 uRim; uniform vec3 uDeep; uniform vec3 uInner;
        uniform float uGlow; uniform float uSpark; uniform float uFacet;
        uniform float uPrism; uniform float uSparkK; uniform float uDepth;
        varying vec3 vCrP;
        float crHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        {
          vec3 V = normalize(vViewPosition);
          vec3 N = normalize(normal);
          float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
          float fres = pow(1.0 - ndv, 2.6);

          // 1. glassy depth: the core facing you sinks into a cool tint
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * uDeep * 1.35, (1.0 - fres) * uDepth);

          // 2. prismatic rim: rainbow dispersion along the silhouette (diamond = strongest)
          vec3 prism = 0.55 + 0.45 * cos(6.28318 * (fres * 1.35 * uPrism + vCrP.y * 0.6 + uTime * 0.04 + vec3(0.0, 0.33, 0.67)));
          gl_FragColor.rgb += uRim * prism * fres * 0.28 * uGlow * uPrism;

          // 3. internal facets: tiny planes that catch the light as you move
          vec3 q = floor(vCrP * uFacet);
          float h = crHash(q);
          float ph = h * 60.0 + ndv * 18.0 + uTime * 1.3;
          float glint = pow(max(sin(ph), 0.0), 28.0) * step(0.62, h);
          gl_FragColor.rgb += vec3(1.0, 0.98, 0.94) * glint * 0.28 * uSpark * uSparkK;

          // 4. soft caustic light flowing through the body
          float c = sin(vCrP.y * 13.0 + sin(vCrP.x * 9.0 + uTime * 0.9) * 1.6 + uTime * 0.7);
          c *= sin(vCrP.z * 11.0 - uTime * 0.6 + vCrP.x * 4.0);
          float caus = pow(abs(c), 10.0);
          gl_FragColor.rgb += uInner * caus * 0.07 * uGlow * (0.4 + 0.6 * (1.0 - fres));
        }`,
      );
  };
  return { mat, u };
}

export function makeGoldMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffd59a'),
    metalness: 1,
    roughness: 0.18,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.4,
    emissive: new THREE.Color('#ff9a4a'),
    emissiveIntensity: 0.08,
  });
}

// ---------------------------------------------------------------------------
// ENVIRONMENT for reflections. A tiny scene (sky dome + sand floor) is
// rendered into a PMREM every couple of seconds with the CURRENT mood colors,
// so the crystal always reflects the sky you are riding under.
// ---------------------------------------------------------------------------
export class CrystalEnv {
  private pmrem: THREE.PMREMGenerator;
  private scene = new THREE.Scene();
  private sky = new SkyDome();
  private floorMat = new THREE.MeshBasicMaterial({ color: 0xd9a877 });
  private target: THREE.WebGLRenderTarget | null = null;
  private timer = 0;
  texture: THREE.Texture | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.add(this.sky.mesh);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(700, 48), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -40;
    this.scene.add(floor);
  }

  /** returns a NEW texture when it was regenerated this frame, otherwise null */
  update(
    dt: number,
    top: THREE.Color,
    mid: THREE.Color,
    hor: THREE.Color,
    low: THREE.Color,
    sunTint: THREE.Color,
    glow: number,
    stars: number,
    dir: THREE.Vector3,
    sand: THREE.Color,
  ): THREE.Texture | null {
    this.timer -= dt;
    if (this.timer > 0 && this.texture) return null;
    this.timer = 2.5;
    this.sky.apply(top, mid, hor, low, sunTint, glow, stars, dir);
    this.sky.setDisc(0.6);
    this.floorMat.color.copy(sand);
    const rt = this.pmrem.fromScene(this.scene, 0.02, 0.1, 1000);
    if (this.target) this.target.dispose();
    this.target = rt;
    this.texture = rt.texture;
    return rt.texture;
  }
}
