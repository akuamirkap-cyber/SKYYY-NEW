// ---------------------------------------------------------------------------
// Feel tuning: every number that changes how the game *plays*, *glides* and
// *is lit*. Grouped so the settings UI can mirror it directly.
// ---------------------------------------------------------------------------

export interface Tune {
  // ---- world mood
  palette: number;
  cycle: boolean;
  haze: number;

  // ---- LIGHT: direction (offsets on top of the mood's own sun position)
  sunAz: number; // radians, added to the mood azimuth
  sunEl: number; // radians, added to the mood elevation

  // ---- LIGHT: power
  sunlight: number; // key light (the sun)
  ambient: number; // sky dome / ambient bounce from above
  bounce: number; // warm light reflected up off the sand
  fill: number; // cool light from the opposite side
  rim: number; // edge light from behind the rider
  skyGlow: number; // sun halo strength inside the sky shader
  terrainLight: number; // how bright the sand itself is
  shadow: number; // contact shadow strength
  fogTint: number; // how strongly fog takes the mood color

  // ---- LIGHT: post grading
  exposure: number;
  bloom: number;
  contrast: number;
  saturation: number;
  warmth: number; // -1 cool .. +1 warm
  tint: number; // -1 green .. +1 magenta
  lift: number; // black point
  gain: number; // white point
  vignette: number;
  grain: number;

  // ---- hover
  rideHeight: number;
  softness: number;
  bumpFilter: number;
  tilt: number;
  tiltSmooth: number;
  glide: number;

  // ---- motion
  gravity: number;
  floaty: number;
  spin: number;
  turn: number;
  airTurn: number; // multiplier belok saat di udara
  speed: number;

  // ---- camera
  camStyle: number; // 0 = Klasik, 1 = Sekiro (third-person + lock-on), 2 = Sword of the Sea (sinematik), 3 = Bodycam
  worldMode: number; // 0 = Petualangan (auto blend biome), 1 = Gurun Pasir, 2 = Ngarai Merah, 3 = Reruntuhan Kuil
  camDist: number;
  camLag: number;
  fov: number;
  shake: number;

  // ---- penyetelan PER MODE kamera (jarak = pengali · sudut dalam DERAJAT).
  // Yaw: 0 = tepat di belakang rider, positif = makin ke kanan (serong).
  // Pitch: positif = kamera makin tinggi / menunduk, negatif = rendah / menengadah.
  cam0Dist: number; // Klasik — jarak
  cam0Pitch: number; // Klasik — sudut vertikal
  cam0Yaw: number; // Klasik — sudut horizontal (default 40° = samping-belakang kanan asli)
  cam0Height: number; // Klasik — offset tinggi letak kamera (meter)
  cam1Dist: number; // Sekiro — jarak dasar
  cam1Pitch: number; // Sekiro — sudut vertikal dasar (default 2° ≈ level → third-person)
  cam1Yaw: number; // Sekiro — sudut horizontal dasar
  cam1Height: number; // Sekiro — offset tinggi letak kamera (meter)
  cam2Dist: number; // Sword of the Sea — jarak
  cam2Pitch: number; // Sword of the Sea — sudut vertikal
  cam2Yaw: number; // Sword of the Sea — sudut horizontal
  cam2Height: number; // Sword of the Sea — offset tinggi letak kamera (meter)
  cam3Dist: number; // Bodycam — jarak (mengalikan offset 0.85 m dari punggung)
  cam3Pitch: number; // Bodycam — sudut vertikal (positif = menunduk ke lintasan)
  cam3Yaw: number; // Bodycam — sudut horizontal (toleh kiri/kanan)
  cam3Height: number; // Bodycam — offset tinggi letak kamera (meter)

  // ---- fx
  particles: number;
  trails: number;

  // ---- BLOOM (anti-glare control)
  bloomThreshold: number; // offset added to the mood threshold (higher = only very bright things glow)
  bloomRadius: number; // spread multiplier
  bloomDynamic: number; // extra bloom when fast / boosting / airborne
  glowFx: number; // intensity of additive particles, aura and light trails

  // ---- SCARF (slayer)
  scarfLength: number; // meters
  scarfWidth: number;
  scarfFlutter: number;
  scarfColor: number; // index into SCARF_COLORS
  scarfTwin: boolean; // two tails
  scarfGlow: boolean; // extra light ribbon from the neck
  scarfSkin: number; // 0 = cloth, 1 = ethereal
  scarfEthereal: number; // index into ETHEREAL_SKINS

  // ---- SLAYER: sulaman emas ala Journey (diamond & chevron berdenyut)
  scarfEmbroidery: boolean; // sulaman emas pada slayer skin kain
  scarfEmbroideryGlow: number; // kekuatan pendar sulaman (ikut energi flow)

  // ---- CHARACTER
  crystalSkin: number; // index into CRYSTAL_SKINS
  crystalCustom: boolean;
  crystalC: string;
  accentMetal: number; // index into ACCENT_METALS
  swordSkin: number; // index into SWORD_SKINS (0 = Silver Surfer krom, default)
  boardType: number; // PAPAN: 0 = papan surf Silver Surfer (default) · 1 = pedang skate
  bodyHeight: number; // 1 = normal, ~0.78 = short, ~0.5 = chibi
  headSize: number;
  swordSize: number;
  swordGlow: number; // pencahayaan & pendar pedang skate (0 = redup, 1 = pendar lembut normal)

  // ---- AURORA (tirai cahaya polar di langit)
  aurora: number; // 0 = mati · 1 = normal · 2 = super gemilang

  // ---- SKY WHALES
  whales: number; // count 0..6
  whaleSize: number;
  whaleHeight: number;
  whaleSpeed: number;
  whaleSong: boolean;
  whaleGlow: number; // rim light on the whales
  whaleHaze: number; // how much they fade into the atmosphere
  fishCount: number; // fish per whale
  fishSize: number;
  fishGlow: number;

  // ---- MANTA RAYS
  mantas: number; // 0..12
  mantaSize: number;
  mantaHeight: number;
  mantaSpeed: number;
  mantaFormation: number; // 0 V, 1 ring, 2 wave

  // ---- FLYING FISH
  flyingFish: number; // how often schools leap (0 = off)
  flyingFishSize: number;

  // ---- WATER (rivers & waterfalls)
  waterPalette: number;
  waterFlow: number; // flow speed of the texture
  waterGlint: number; // sun sparkle on the water
  waterFoam: number;
  waterClarity: number; // opacity
  waterMist: number; // waterfall mist amount
  waterRainbow: number; // rainbow strength
  waterCurrent: number; // how strongly the river pushes you downstream

  // ---- FOG (advanced)
  fogStart: number; // metres of clear air before the fog begins
  fogHeight: number; // valley mist amount
  fogLayer: number; // valley mist thickness in metres
  fogScatter: number; // sun glow inside the fog
  fogMax: number; // maximum fog opacity
  fogSky: number; // how much the horizon of the sky blends into the fog
  fogCustom: boolean; // use my own fog color

  // ---- AIR / TRICKS (Alto style)
  jumpStyle: number; // 0 = Tinggi (Melayang Bebas), 1 = Rendah / Grounded (Pasir Menempel - tidak terbang mulu)
  jumpPower: number; // base pop
  launchBoost: number; // how much the terrain's upward momentum adds to the jump
  flipSpeed: number; // hold-to-flip rotation speed
  landAssist: number; // auto-straighten near the ground
  landWindow: number; // landing forgiveness
  airJumps: number; // air jumps per jump (0..3)
  airJumpPower: number;
  perfectBoost: number; // speed gained on a perfect landing
  slowmo: number; // slow motion while flipping (0 = off)
  smartLand: boolean; // plan rotations so you always land upright
  autoTrick: boolean; // every big jump automatically does a freestyle
  styleAmbition: number; // how many rotations auto freestyle attempts (0..1)
  landMargin: number; // seconds of safety: rotation finishes this long before touchdown

  // ---- CLIMBING
  climb: number; // 0 = realistic (hills slow you), 1 = hills cost nothing
  minSpeed: number; // speed you never drop under when grounded

  // ---- ANTI-GLARE master controls
  glare: number; // master glare level: scales bloom, emissive, sun disc, glow fx
  highlights: number; // compress bright whites (0 = off, 1 = strong)
  sunDisc: number; // brightness of the sun disc in the sky
  emissive: number; // glowing objects: sparks, beacons, blade
  motes: number; // floating dust motes

  // ---- CUSTOM LIGHT COLORS (override the mood)
  customColors: boolean;
  colorMix: number; // 0 = mood colors, 1 = fully custom
  sunC: string;
  ambientC: string;
  bounceC: string;
  skyTopC: string;
  skyHorC: string;
  fogC: string;
}

export const DEFAULT_TUNE: Tune = {
  palette: 5, // Twilight (Langit Twilight)
  cycle: false,
  haze: 0.3,

  sunAz: 0,
  sunEl: 0,

  // Cahaya Netral
  sunlight: 1,
  ambient: 1,
  bounce: 1,
  fill: 1,
  rim: 0.35,
  skyGlow: 0.85,
  terrainLight: 1,
  shadow: 1,
  fogTint: 1,

  exposure: 1.6,
  bloom: 1.26,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  tint: 0,
  lift: 0,
  gain: 1,
  vignette: 0, // tanpa vignette gelap — layar bersih
  grain: 0.03,

  // default = the "Silk" feel, so it glides beautifully out of the box
  rideHeight: 0.74,
  softness: 1.5,
  bumpFilter: 2.1,
  tilt: 0.9,
  tiltSmooth: 0.85,
  glide: 1.15,

  gravity: 1,
  floaty: 1,
  spin: 1,
  turn: 1.2,
  airTurn: 0.85,
  speed: 1,

  camStyle: 3, // DEFAULT = Bodycam — tekan 1/2/3/4 untuk ganti
  worldMode: 0, // DEFAULT = Petualangan (biome berganti mulus sepanjang perjalanan)
  camDist: 1,
  camLag: 1.15,
  fov: 0.75,
  shake: 0.35,

  // default per mode: Klasik & SotS ≈ framing asli · Sekiro 2° = third-person
  // level (bukan top-down) · Bodycam default ×2.0 · 30° (menunduk ke lintasan,
  // bisa diatur sampai 90° = top-down penuh)
  cam0Dist: 1,
  cam0Pitch: 17,
  cam0Yaw: 40,
  cam0Height: 0,
  cam1Dist: 1,
  cam1Pitch: 2,
  cam1Yaw: 0,
  cam1Height: 0,
  cam2Dist: 1,
  cam2Pitch: 9,
  cam2Yaw: 0,
  cam2Height: 0,
  cam3Dist: 2,
  cam3Pitch: 15,
  cam3Yaw: 0,
  cam3Height: 0,

  particles: 1,
  trails: 1,

  // Bloom Data 1
  bloomThreshold: 0.42,
  bloomRadius: 0.65,
  bloomDynamic: 0.08,
  glowFx: 0.18,

  scarfLength: 4.2, // Selendang jubah panjang anggun khas Sky: Children of the Light
  scarfWidth: 0.22, // Jubah lebar melayang
  scarfFlutter: 1.05,
  scarfColor: 0,
  scarfTwin: false, // DEFAULT = satu ujung (twin tail bisa diaktifkan di Settings)
  scarfGlow: false,
  scarfSkin: 0, // DEFAULT: kain (agar sulaman emas terlihat)
  scarfEthereal: 0,

  scarfEmbroidery: true, // DEFAULT: slayer memakai sulaman emas ala Journey
  scarfEmbroideryGlow: 1,

  crystalSkin: 2, // Indigo default
  crystalCustom: false,
  crystalC: '#8c80ff',
  accentMetal: 0,
  swordSkin: 0, // DEFAULT = Silver Surfer (krom reflektif)
  boardType: 0, // DEFAULT = papan surf krom ikonik Silver Surfer
  bodyHeight: 0.74, // Karakter Zelda / Sky: Children of the Light (anggun, ramping & lincah)
  headSize: 1.08, // Kepala berkarakter dengan mata bintang bercahaya khas Sky / Zelda
  swordSize: 0.64,
  swordGlow: 1.5, // pencahayaan pedang skate terang

  aurora: 1, // aktif normal — warna otomatis mengikuti palet langit
  whales: 3,
  whaleSize: 1.6,
  whaleHeight: 1,
  whaleSpeed: 1,
  whaleSong: true,
  whaleGlow: 0.8,
  whaleHaze: 0.4,
  fishCount: 70,
  fishSize: 1.2,
  fishGlow: 0.8,

  mantas: 5,
  mantaSize: 1.3,
  mantaHeight: 1,
  mantaSpeed: 1,
  mantaFormation: 0,

  flyingFish: 1,
  flyingFishSize: 1.3,

  waterPalette: 0,
  waterFlow: 1,
  waterGlint: 1,
  waterFoam: 1,
  waterClarity: 0.8,
  waterMist: 1,
  waterRainbow: 1,
  waterCurrent: 1,

  // clear distance visibility: no blinding white haze
  // PANORAMA: kabut tipis — pemandangan jauh & pegunungan siluet terlihat jelas
  fogStart: 340,
  fogHeight: 0.04,
  fogLayer: 30,
  fogScatter: 0.22,
  fogMax: 0.5,
  fogSky: 0.06,
  fogCustom: false,

  jumpStyle: 1, // 1 = Rendah / Grounded (Pasir Menempel - tidak terbang mulu)
  jumpPower: 1,
  launchBoost: 1.1,
  flipSpeed: 1,
  landAssist: 0.9,
  landWindow: 1.1,
  airJumps: 0, // double jump dinonaktifkan dulu (bisa diaktifkan lagi di tab Udara & Trik)
  airJumpPower: 1,
  perfectBoost: 1,
  slowmo: 0.5,
  smartLand: true,
  autoTrick: false,
  styleAmbition: 0.6,
  landMargin: 0.12,

  climb: 0.85,
  minSpeed: 26,

  // Pengaturan Silau
  glare: 0.65,
  highlights: 0,
  sunDisc: 1.5,
  emissive: 1.5,
  motes: 0.5,

  customColors: false,
  colorMix: 0.7,
  sunC: '#ffd29a',
  ambientC: '#a8ccff',
  bounceC: '#e8a877',
  skyTopC: '#2f5f9e',
  skyHorC: '#ffd2a2',
  fogC: '#ffd9bd',
};

/** Fog presets. */
export const FOG_PRESETS: FeelPreset[] = [
  {
    name: 'Panorama ✦',
    desc: 'DEFAULT: kabut tipis — pegunungan jauh & vista terbuka jernih',
    values: { haze: 0.3, fogStart: 340, fogHeight: 0.04, fogLayer: 30, fogScatter: 0.22, fogMax: 0.5, fogSky: 0.06 },
  },
  {
    name: 'Super Jernih',
    desc: 'udara bening total — siluet gunung setajam mungkin',
    values: { haze: 0.18, fogStart: 520, fogHeight: 0.02, fogLayer: 36, fogScatter: 0.15, fogMax: 0.3, fogSky: 0.03 },
  },
  {
    name: 'Ekstra Jernih',
    desc: 'udara sangat bening, tanpa kabut di sekitar',
    values: { haze: 0.25, fogStart: 200, fogHeight: 0, fogLayer: 15, fogScatter: 0.15, fogSky: 0.04, fogMax: 0.7 },
  },
  {
    name: 'Tipis',
    desc: 'kabut tipis lembut di kejauhan',
    values: { haze: 0.6, fogStart: 80, fogHeight: 0.12, fogLayer: 16, fogScatter: 0.35, fogSky: 0.15, fogMax: 0.9 },
  },
  {
    name: 'Seimbang',
    desc: 'sedikit atmosferik tanpa silau',
    values: { haze: 0.75, fogStart: 60, fogHeight: 0.18, fogLayer: 18, fogScatter: 0.45, fogSky: 0.2, fogMax: 0.95 },
  },
  {
    name: 'Kabut Lembah',
    desc: 'kabut tebal mengisi lembah bukit',
    values: { haze: 0.85, fogStart: 40, fogHeight: 0.45, fogLayer: 14, fogScatter: 0.6, fogSky: 0.3, fogMax: 1 },
  },
  {
    name: 'Badai Pasir',
    desc: 'pekat, hangat, dramatis',
    values: { haze: 1.4, fogStart: 10, fogHeight: 0.5, fogLayer: 25, fogScatter: 0.8, fogSky: 0.5, fogMax: 1, fogTint: 1.2 },
  },
  {
    name: 'Mimpi',
    desc: 'kabut bercahaya lembut',
    values: { haze: 0.9, fogStart: 30, fogHeight: 0.3, fogLayer: 20, fogScatter: 0.9, fogSky: 0.4, fogMax: 0.95 },
  },
];

/** Air / trick feel presets. */
export const AIR_PRESETS: FeelPreset[] = [
  {
    name: 'Zen',
    desc: 'santai, banyak bantuan mendarat',
    values: {
      jumpPower: 0.95,
      launchBoost: 0.9,
      flipSpeed: 0.8,
      landAssist: 1,
      landWindow: 1.5,
      airJumps: 2,
      floaty: 1.3,
      slowmo: 0.7,
      perfectBoost: 1,
    },
  },
  {
    name: 'Alto',
    desc: 'seperti Alto\u2019s Odyssey — seimbang',
    values: {
      jumpPower: 1,
      launchBoost: 1.1,
      flipSpeed: 1,
      landAssist: 0.6,
      landWindow: 1,
      airJumps: 2,
      floaty: 1,
      slowmo: 0.5,
      perfectBoost: 1,
    },
  },
  {
    name: 'Pro',
    desc: 'rotasi cepat, harus presisi',
    values: {
      jumpPower: 1.1,
      launchBoost: 1.2,
      flipSpeed: 1.3,
      landAssist: 0.15,
      landWindow: 0.7,
      airJumps: 1,
      floaty: 0.85,
      slowmo: 0.25,
      perfectBoost: 1.4,
    },
  },
  {
    name: 'Sky',
    desc: 'lompatan tinggi, 3 air jump',
    values: {
      jumpPower: 1.3,
      launchBoost: 1.5,
      flipSpeed: 1.1,
      landAssist: 0.7,
      landWindow: 1.2,
      airJumps: 3,
      airJumpPower: 1.2,
      floaty: 1.4,
      slowmo: 0.6,
      perfectBoost: 1.2,
    },
  },
];

/** Quick bloom presets – from "no glare at all" to "dreamy glow". */
export const BLOOM_PRESETS: FeelPreset[] = [
  {
    name: 'Data 1',
    desc: 'silau 65%, bloom 126%, pendar pedang & matahari 150%, exposure 160%',
    values: {
      glare: 0.65,
      bloom: 1.26,
      bloomThreshold: 0.42,
      highlights: 0,
      sunDisc: 1.5,
      emissive: 1.5,
      swordGlow: 1.5,
      exposure: 1.6,
      motes: 0.6,
      bloomRadius: 0.55,
      bloomDynamic: 0.15,
      glowFx: 0.45,
    },
  },
  {
    name: 'Anti-Silau',
    desc: 'nyaris tanpa glare, paling jernih & bilah redup',
    values: {
      glare: 0.4,
      bloom: 0.22,
      bloomThreshold: 0.55,
      bloomRadius: 0.4,
      bloomDynamic: 0,
      glowFx: 0.3,
      highlights: 0.8,
      sunDisc: 0.3,
      emissive: 0.35,
      motes: 0.4,
      exposure: 0.94,
      swordGlow: 0.1,
    },
  },
  {
    name: 'Jernih',
    desc: 'bloom tipis, detail tetap tajam',
    values: {
      glare: 0.55,
      bloom: 0.32,
      bloomThreshold: 0.45,
      bloomRadius: 0.5,
      bloomDynamic: 0.12,
      glowFx: 0.4,
      highlights: 0.55,
      sunDisc: 0.55,
      emissive: 0.48,
      motes: 0.5,
      exposure: 0.98,
      swordGlow: 0.18,
    },
  },
  {
    name: 'Seimbang',
    desc: 'default yang enak dilihat & bebas silau',
    values: {
      glare: 0.6,
      bloom: 0.36,
      bloomThreshold: 0.42,
      bloomRadius: 0.55,
      bloomDynamic: 0.18,
      glowFx: 0.45,
      highlights: 0.5,
      sunDisc: 0.55,
      emissive: 0.5,
      motes: 0.55,
      exposure: 0.98,
      swordGlow: 0.22,
    },
  },
  {
    name: 'Data 1 (Tinggi)',
    desc: 'silau 65%, bloom 126%, pendar pedang & matahari 150%, exposure 160%',
    values: {
      glare: 0.65,
      highlights: 0,
      sunDisc: 1.5,
      emissive: 1.5,
      motes: 0.5,
      bloom: 1.26,
      bloomThreshold: 0.42,
      bloomRadius: 0.65,
      bloomDynamic: 0.08,
      glowFx: 0.25,
      swordGlow: 1.5,
      exposure: 1.6,
    },
  },
];

export interface MasterPreset {
  name: string;
  desc: string;
  paletteName: string;
  paletteIndex: number;
  lightName: string;
  bloomName: string;
  values: Partial<Tune>;
}

export const MASTER_PRESETS: MasterPreset[] = [
  {
    name: 'Twilight Netral (Data 1 Tinggi)',
    desc: 'Langit Twilight · Cahaya Netral · Bloom Data 1 (Silau 65%, Bloom 126%, Pedang & Matahari 150%)',
    paletteName: 'Twilight',
    paletteIndex: 5,
    lightName: 'Netral',
    bloomName: 'Data 1 (Tinggi)',
    values: {
      palette: 5, // Twilight
      cycle: false,
      // Cahaya Netral
      sunAz: 0,
      sunEl: 0,
      sunlight: 1,
      ambient: 1,
      bounce: 1,
      fill: 1,
      rim: 0.35,
      skyGlow: 0.85,
      terrainLight: 1,
      shadow: 1,
      fogTint: 1,
      exposure: 1.6,
      contrast: 1,
      saturation: 1,
      warmth: 0,
      tint: 0,
      lift: 0,
      gain: 1,
      vignette: 0,
      grain: 0.03,
      customColors: false,
      // Bloom & Silau sesuai Data 1
      glare: 0.65,
      highlights: 0,
      sunDisc: 1.5,
      emissive: 1.5,
      motes: 0.5,
      bloom: 1.26,
      bloomThreshold: 0.42,
      bloomRadius: 0.65,
      bloomDynamic: 0.08,
      glowFx: 0.25,
      swordGlow: 1.5,
    },
  },
];

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
export interface FeelPreset {
  name: string;
  desc: string;
  values: Partial<Tune>;
}

/** Camera mode presets — sistem "desired → smoothed" (tekan 1 / 2 / 3 / 4 saat main).
 *  Preset TIDAK menimpa camXPitch/Yaw/Dist — penyetelan per mode milik user tetap. */
export const CAM_PRESETS: FeelPreset[] = [
  {
    name: 'Klasik',
    desc: 'samping-belakang kanan; makin ngebut makin mundur & FOV melebar',
    values: { camStyle: 0, camDist: 1, camLag: 1, fov: 0.95, shake: 0.5 },
  },
  {
    name: 'Sekiro ✦',
    desc: 'DEFAULT: third-person di bahu — drag = orbit · scroll = zoom · lock-on kristal',
    values: { camStyle: 1, camDist: 1, camLag: 1.15, fov: 0.75, shake: 0.35 },
  },
  {
    name: 'Sword of the Sea',
    desc: 'drone sinematik rendah & lebar yang menyapu vista, dutch angle',
    values: { camStyle: 2, camDist: 1, camLag: 0.85, fov: 1.0, shake: 0.3 },
  },
  {
    name: 'Bodycam v1 ●',
    desc: 'DEFAULT: head-cam — di kepala, 15° menunduk, lensa super lebar, handheld kencang',
    values: { camStyle: 3, camDist: 1, camLag: 1.6, fov: 0.85, shake: 0.65 },
  },
];

/**
 * Skin pedang-skate. 0 = Silver Surfer: krom murni reflektif seperti papan
 * si Silver Surfer (default). 1 = Baja Asli: pedang biru-baja dengan gagang
 * emas seperti release pertama.
 */
export const SWORD_SKINS: { name: string; desc: string }[] = [
  { name: 'Silver Surfer', desc: 'krom murni — papan reflektif ala Silver Surfer' },
  { name: 'Baja Asli', desc: 'bilah baja kebiruan + gagang emas (klasik)' },
];

/** World/biome mode presets — ganti kapan saja, medan langsung terbangun ulang. */
export const WORLD_PRESETS: FeelPreset[] = [
  {
    name: 'Petualangan ✦',
    desc: 'DEFAULT: biome berganti mulus selama turun — gurun → ngarai → kuil',
    values: { worldMode: 0 },
  },
  {
    name: 'Gurun Pasir',
    desc: 'mega dunes ridged + riak angin anisotropik, palem di kejauhan',
    values: { worldMode: 1 },
  },
  {
    name: 'Ngarai Merah',
    desc: 'teras mesa 9 m & butte raksasa merah berlapis strata, kaktus',
    values: { worldMode: 2 },
  },
  {
    name: 'Reruntuhan Kuil',
    desc: 'dataran tenang — platform, pilar & obelisk (20% roboh)',
    values: { worldMode: 3 },
  },
];

/** One-click complete "glide" presets. */
export const FEEL_PRESETS: FeelPreset[] = [
  {
    name: 'Silk',
    desc: 'melayang paling halus, nol getar',
    values: {
      rideHeight: 0.74,
      softness: 1.5,
      bumpFilter: 2.1,
      tilt: 0.85,
      tiltSmooth: 0.8,
      glide: 1.15,
      camLag: 0.8,
      shake: 0.5,
      fov: 0.9,
    },
  },
  {
    name: 'Dream',
    desc: 'sangat floaty, kamera jauh, lambat',
    values: {
      rideHeight: 1.05,
      softness: 1.9,
      bumpFilter: 2.4,
      tilt: 0.7,
      tiltSmooth: 0.6,
      glide: 1.4,
      gravity: 0.8,
      floaty: 1.4,
      speed: 0.9,
      camDist: 1.22,
      camLag: 0.7,
      fov: 0.85,
      shake: 0.25,
      trails: 1.3,
    },
  },
  {
    name: 'Surf',
    desc: 'melekat di pasir, carve agresif',
    values: {
      rideHeight: 0.36,
      softness: 0.8,
      bumpFilter: 1,
      tilt: 1.35,
      tiltSmooth: 1.6,
      glide: 0.7,
      turn: 1.25,
      camDist: 0.92,
      camLag: 1.3,
      fov: 1.1,
      shake: 1.2,
    },
  },
  {
    name: 'Cinema',
    desc: 'kamera drone, cinematic, tanpa guncang',
    values: {
      rideHeight: 0.8,
      softness: 1.4,
      bumpFilter: 2,
      tilt: 0.8,
      tiltSmooth: 0.7,
      camDist: 1.35,
      camLag: 0.55,
      fov: 0.8,
      shake: 0,
      bloom: 1.25,
      vignette: 0.3,
    },
  },
  {
    name: 'Arcade',
    desc: 'cepat, responsif, juicy',
    values: {
      rideHeight: 0.5,
      softness: 1,
      bumpFilter: 1.3,
      tilt: 1.2,
      tiltSmooth: 1.5,
      glide: 0.9,
      gravity: 1.1,
      spin: 1.35,
      turn: 1.2,
      speed: 1.15,
      camDist: 0.95,
      camLag: 1.4,
      fov: 1.2,
      shake: 1.1,
      particles: 1.2,
    },
  },
  {
    name: 'Moon Drift',
    desc: 'malam, lambat, melayang jauh',
    values: {
      palette: 4,
      rideHeight: 1.15,
      softness: 1.7,
      bumpFilter: 2.2,
      tilt: 0.75,
      tiltSmooth: 0.7,
      gravity: 0.85,
      floaty: 1.35,
      speed: 0.88,
      camDist: 1.15,
      camLag: 0.75,
      bloom: 1.3,
      shake: 0.3,
      trails: 1.35,
    },
  },
];

/** One-click complete LIGHTING presets — direction, power and grade together. */
export const LIGHT_PRESETS: FeelPreset[] = [
  {
    name: 'Netral',
    desc: 'mengikuti mood langit apa adanya',
    values: {
      sunAz: 0,
      sunEl: 0,
      sunlight: 1,
      ambient: 1,
      bounce: 1,
      fill: 1,
      rim: 0.55,
      skyGlow: 1,
      terrainLight: 1,
      shadow: 1,
      fogTint: 1,
      exposure: 1,
      bloom: 1,
      contrast: 1,
      saturation: 1,
      warmth: 0,
      tint: 0,
      lift: 0,
      gain: 1,
      vignette: 0.18,
      grain: 0.03,
    },
  },
  {
    name: 'Terik',
    desc: 'siang scorching, kontras tinggi',
    values: {
      sunAz: 0.3,
      sunEl: 0.55,
      sunlight: 1.75,
      ambient: 0.85,
      bounce: 1.5,
      fill: 0.5,
      rim: 0.3,
      skyGlow: 0.7,
      terrainLight: 1.16,
      shadow: 1.5,
      fogTint: 0.7,
      exposure: 1.02,
      bloom: 0.6,
      contrast: 1.2,
      saturation: 1.12,
      warmth: 0.1,
      tint: 0,
      lift: -0.02,
      gain: 1.04,
      vignette: 0.1,
      grain: 0.02,
      haze: 0.7,
    },
  },
  {
    name: 'Lembut',
    desc: 'mendung lembut, flat & pastel',
    values: {
      sunAz: 0,
      sunEl: 0.3,
      sunlight: 0.62,
      ambient: 1.7,
      bounce: 1.15,
      fill: 1.5,
      rim: 0.15,
      skyGlow: 0.45,
      terrainLight: 0.95,
      shadow: 0.35,
      fogTint: 1.3,
      exposure: 1.04,
      bloom: 0.55,
      contrast: 0.86,
      saturation: 0.78,
      warmth: -0.04,
      tint: 0.05,
      lift: 0.045,
      gain: 0.97,
      vignette: 0.08,
      grain: 0.02,
      haze: 1.5,
    },
  },
  {
    name: 'Dramatis',
    desc: 'matahari rendah, rim kuat, gelap',
    values: {
      sunAz: -0.9,
      sunEl: -0.14,
      sunlight: 1.95,
      ambient: 0.5,
      bounce: 1.1,
      fill: 0.3,
      rim: 1.7,
      skyGlow: 1.5,
      terrainLight: 0.82,
      shadow: 1.6,
      fogTint: 0.85,
      exposure: 0.99,
      bloom: 1.1,
      contrast: 1.3,
      saturation: 1.18,
      warmth: 0.28,
      tint: -0.06,
      lift: -0.035,
      gain: 1.06,
      vignette: 0.42,
      grain: 0.05,
      haze: 1.05,
    },
  },
  {
    name: 'Purnama',
    desc: 'cahaya bulan biru, dingin',
    values: {
      sunAz: 1.6,
      sunEl: 0.42,
      sunlight: 0.5,
      ambient: 0.7,
      bounce: 0.45,
      fill: 1.35,
      rim: 1.1,
      skyGlow: 1.15,
      terrainLight: 0.72,
      shadow: 1.15,
      fogTint: 1.2,
      exposure: 1.1,
      bloom: 1.2,
      contrast: 1.12,
      saturation: 0.82,
      warmth: -0.42,
      tint: 0.08,
      lift: 0.035,
      gain: 1.02,
      vignette: 0.34,
      grain: 0.06,
      haze: 1.15,
    },
  },
  {
    name: 'Neon Senja',
    desc: 'magenta menyala, super saturasi',
    values: {
      sunAz: -0.45,
      sunEl: 0.02,
      sunlight: 1.35,
      ambient: 1.1,
      bounce: 1.35,
      fill: 1.2,
      rim: 1.35,
      skyGlow: 1.7,
      terrainLight: 1.05,
      shadow: 0.9,
      fogTint: 1.35,
      exposure: 1.06,
      bloom: 1.25,
      contrast: 1.14,
      saturation: 1.42,
      warmth: 0.12,
      tint: 0.3,
      lift: 0.02,
      gain: 1.05,
      vignette: 0.3,
      grain: 0.04,
      haze: 1.25,
    },
  },
];
