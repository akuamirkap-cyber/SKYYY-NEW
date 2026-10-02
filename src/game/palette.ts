// ---------------------------------------------------------------------------
// Sky / lighting / post "moods". Every value is smoothly blended at runtime so
// switching a palette feels like the sun is actually moving.
// ---------------------------------------------------------------------------

export interface Palette {
  name: string;
  skyTop: string;
  skyMid: string;
  skyHor: string;
  skyLow: string;
  sunAz: number;
  sunEl: number;
  sunTint: string;
  sunGlow: number;
  stars: number;
  fog: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fillColor: string;
  fillIntensity: number;
  bloom: number;
  bloomThreshold: number;
  bloomRadius: number;
  exposure: number;
  terrainTint: string;
}

export const PALETTES: Palette[] = [
  {
    name: 'Pasir Gurun Dulu',
    skyTop: '#224a7d',
    skyMid: '#86b6d8',
    skyHor: '#ffd29b',
    skyLow: '#ff8f54',
    sunAz: 0.55,
    sunEl: 0.28,
    sunTint: '#fff2d4',
    sunGlow: 1.15,
    stars: 0,
    fog: '#ffd2b0',
    fogDensity: 0.004,
    sunColor: '#ffd096',
    sunIntensity: 1.9,
    hemiSky: '#b8d8ff',
    hemiGround: '#e59a58',
    hemiIntensity: 1.15,
    fillColor: '#9ec0ff',
    fillIntensity: 0.45,
    bloom: 0.65,
    bloomThreshold: 0.82,
    bloomRadius: 0.8,
    exposure: 1.0,
    terrainTint: '#e59a58', // classic warm golden sand from original desert
  },
  {
    name: 'Salju Mega',
    skyTop: '#092244',
    skyMid: '#4b7ea8',
    skyHor: '#def0ff',
    skyLow: '#b9dbf2',
    sunAz: 0.65,
    sunEl: 0.38,
    sunTint: '#ffffff',
    sunGlow: 1.25,
    stars: 0,
    fog: '#d7eaf7',
    fogDensity: 0.0036,
    sunColor: '#fff9ed',
    sunIntensity: 2.15,
    hemiSky: '#d6ecff',
    hemiGround: '#dce8f5',
    hemiIntensity: 1.28,
    fillColor: '#b4d8ff',
    fillIntensity: 0.45,
    bloom: 0.68,
    bloomThreshold: 0.8,
    bloomRadius: 0.82,
    exposure: 1.02,
    terrainTint: '#eaf4fc', // gleaming pure alpine snow & ice powder
  },
  {
    name: 'Rumput Hijau Indah',
    skyTop: '#144c8a',
    skyMid: '#589de0',
    skyHor: '#d6efff',
    skyLow: '#b7e4c7',
    sunAz: 0.6,
    sunEl: 0.35,
    sunTint: '#fff9e6',
    sunGlow: 1.1,
    stars: 0,
    fog: '#cae9d5',
    fogDensity: 0.0032,
    sunColor: '#fff5d8',
    sunIntensity: 2.05,
    hemiSky: '#c2e6ff',
    hemiGround: '#3f8232',
    hemiIntensity: 1.22,
    fillColor: '#bce4c8',
    fillIntensity: 0.4,
    bloom: 0.62,
    bloomThreshold: 0.82,
    bloomRadius: 0.8,
    exposure: 1.0,
    terrainTint: '#469138', // rich lush green alpine meadow grass
  },
  {
    name: 'Ember',
    skyTop: '#241f4e',
    skyMid: '#a45e8a',
    skyHor: '#ff9d61',
    skyLow: '#ff6b3e',
    sunAz: -0.75,
    sunEl: 0.11,
    sunTint: '#ffd9a8',
    sunGlow: 1.35,
    stars: 0.12,
    fog: '#ffab7c',
    fogDensity: 0.006,
    sunColor: '#ffb172',
    sunIntensity: 1.5,
    hemiSky: '#b47cc4',
    hemiGround: '#d47a52',
    hemiIntensity: 0.88,
    fillColor: '#ff9ec0',
    fillIntensity: 0.4,
    bloom: 0.9,
    bloomThreshold: 0.72,
    bloomRadius: 0.9,
    exposure: 1.05,
    terrainTint: '#ffd9c2',
  },
  {
    name: 'Noon',
    skyTop: '#1f56b0',
    skyMid: '#7fb2e2',
    skyHor: '#e0edf6',
    skyLow: '#cfe2ee',
    sunAz: 0.95,
    sunEl: 0.9,
    sunTint: '#fffdf4',
    sunGlow: 0.75,
    stars: 0,
    fog: '#e7f1f7',
    fogDensity: 0.0036,
    sunColor: '#fff6e6',
    sunIntensity: 2.05,
    hemiSky: '#d3e8ff',
    hemiGround: '#f2e3cb',
    hemiIntensity: 1.25,
    fillColor: '#cfe4ff',
    fillIntensity: 0.35,
    bloom: 0.4,
    bloomThreshold: 0.9,
    bloomRadius: 0.72,
    exposure: 0.97,
    terrainTint: '#fff5e8',
  },
  {
    name: 'Twilight',
    skyTop: '#101a3c',
    skyMid: '#4b4b98',
    skyHor: '#dc8fbb',
    skyLow: '#b06ba2',
    sunAz: -1.65,
    sunEl: 0.06,
    sunTint: '#ffc2de',
    sunGlow: 1.5,
    stars: 0.55,
    fog: '#a97ab9',
    fogDensity: 0.0056,
    sunColor: '#ffbad8',
    sunIntensity: 1.12,
    hemiSky: '#7c7cda',
    hemiGround: '#9c6b8c',
    hemiIntensity: 0.72,
    fillColor: '#9ea8ff',
    fillIntensity: 0.5,
    bloom: 1.05,
    bloomThreshold: 0.62,
    bloomRadius: 0.95,
    exposure: 1.08,
    terrainTint: '#e2cbec',
  },
  {
    name: 'Moonlit',
    skyTop: '#04081c',
    skyMid: '#152950',
    skyHor: '#6080b0',
    skyLow: '#3d5782',
    sunAz: 2.25,
    sunEl: 0.58,
    sunTint: '#dbe8ff',
    sunGlow: 1.2,
    stars: 1,
    fog: '#3d5782',
    fogDensity: 0.0048,
    sunColor: '#bdd5ff',
    sunIntensity: 0.85,
    hemiSky: '#5b79b9',
    hemiGround: '#2b3b60',
    hemiIntensity: 0.52,
    fillColor: '#7f9cd8',
    fillIntensity: 0.55,
    bloom: 1.3,
    bloomThreshold: 0.45,
    bloomRadius: 1,
    exposure: 1.12,
    terrainTint: '#b9c9ea',
  },
];

// ---------------------------------------------------------------------------
// Hex helpers used for the live day/night cycle
// ---------------------------------------------------------------------------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}
const num = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smoothly interpolate two moods - used by the automatic time-of-day cycle. */
export function blendPalettes(a: Palette, b: Palette, t: number): Palette {
  return {
    name: t < 0.5 ? a.name : b.name,
    skyTop: mixHex(a.skyTop, b.skyTop, t),
    skyMid: mixHex(a.skyMid, b.skyMid, t),
    skyHor: mixHex(a.skyHor, b.skyHor, t),
    skyLow: mixHex(a.skyLow, b.skyLow, t),
    sunAz: num(a.sunAz, b.sunAz, t),
    sunEl: num(a.sunEl, b.sunEl, t),
    sunTint: mixHex(a.sunTint, b.sunTint, t),
    sunGlow: num(a.sunGlow, b.sunGlow, t),
    stars: num(a.stars, b.stars, t),
    fog: mixHex(a.fog, b.fog, t),
    fogDensity: num(a.fogDensity, b.fogDensity, t),
    sunColor: mixHex(a.sunColor, b.sunColor, t),
    sunIntensity: num(a.sunIntensity, b.sunIntensity, t),
    hemiSky: mixHex(a.hemiSky, b.hemiSky, t),
    hemiGround: mixHex(a.hemiGround, b.hemiGround, t),
    hemiIntensity: num(a.hemiIntensity, b.hemiIntensity, t),
    fillColor: mixHex(a.fillColor, b.fillColor, t),
    fillIntensity: num(a.fillIntensity, b.fillIntensity, t),
    bloom: num(a.bloom, b.bloom, t),
    bloomThreshold: num(a.bloomThreshold, b.bloomThreshold, t),
    bloomRadius: num(a.bloomRadius, b.bloomRadius, t),
    exposure: num(a.exposure, b.exposure, t),
    terrainTint: mixHex(a.terrainTint, b.terrainTint, t),
  };
}

export { DEFAULT_TUNE, FEEL_PRESETS, type FeelPreset, type Tune } from './tune';
