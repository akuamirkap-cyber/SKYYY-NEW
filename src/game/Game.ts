import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  NO_WATER,
  clamp,
  duneGradient,
  duneHeight,
  findStart,
  mix,
  rideHeight,
  riverSlope,
  setWorldMode,
  smoothHeight,
  smoothstep,
  surfaceRadius,
  waterLevel,
} from './noise';
import { RiverRenderer } from './river';
import { nextWaterfall, riverX, riverYaw } from './noise';
import {
  RIVERS_ON,
  RUN,
  baseDune,
  chasmAt,
  chasmOfSeg,
  isOnMound,
  pathX,
  setRunStart,
  slopeSmooth,
  type Chasm,
} from './noise';
import { ChasmMarkers } from './world';
import { AXIS_Z, UP } from './math';
import { TerrainField } from './terrain';
import { Motes, Particles, Ripples, TrailRibbon, WindStreaks, makeGlowTexture, makeSoftDiscTexture } from './fx';
import { buildRider } from './model';
import { BiomeScenery, CloudLayer, Monoliths, SkyDome, SpeedPads, EnergyCrystals, getMountainSector } from './world';
import { Aurora } from './aurora';
import { DistantVista } from './vista';
import { AudioEngine } from './audio';
import { PALETTES, blendPalettes, type Palette } from './palette';
import { DEFAULT_TUNE, SWORD_SKINS, type Tune } from './tune';
import { HoverRig } from './hover';
import { GradePass } from './grade';
import { ETHEREAL_SKINS, SCARF_COLORS, Scarf } from './scarf';
import { WhalePod } from './whales';
import { FishSchool } from './fish';
import { FlyingFishSchool, MantaFlock } from './creatures';
import { FOG_U, installFog, patchFogChunks } from './fog';
import { ACCENT_METALS, CRYSTAL_SKINS, CrystalEnv, applyCrystalSkin, customSkin } from './crystal';
import { AirSystem, type AirInput } from './air';
import { BOARD_TRICKS, GRABS } from './tricks';
import { DownhillRelics } from './relics';
import { RivalBotsManager } from './bots';

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export interface HudStats {
  score: number;
  best: number;
  combo: number;
  mult: number;
  speed: number;
  flow: number;
  airborne: boolean;
  distance: number;
  state: GameState;
  trick: string;
  airTime: number;
  palette: string;
  clearance: number;
  // ---- air system
  flipDeg: number;
  spinDeg: number;
  landState: 'perfect' | 'clean' | 'sketchy' | 'none';
  timeToLand: number;
  airJumpsLeft: number;
  airJumpsMax: number;
  chain: number;
  chainPoints: number;
  chainTime: number;
  airFlash: number;
  autoOn: boolean;
  plan: string;
  // ---- navigation to the next waterfall
  navOn: boolean;
  navDist: number;
  navBearing: number;
  navDrop: number;
  onWater: boolean;
  // ---- sinar putih (objective): jarak & arah ke pilar tujuan
  beamOn: boolean;
  beamDist: number;
  beamBearing: number;
  // ---- endless descent
  gapOn: boolean;
  gapDist: number;
  gapW: number;
  jumpNow: boolean;
  bestDist: number;
  overReason: string;
  // ---- mountain exploration & survival
  shield: number;
  maxShield: number;
  sectorName: string;
  sectorSubtitle: string;
  altitudeDrop: number;
  crystalsCollected: number;
  // ---- kamera aktif (untuk overlay REC bodycam) + durasi run
  camStyle: number;
  runTime: number;
  // ---- DOWNHILL RELICS & SPEED BOOST
  relicGateOn: boolean;
  relicGateIndex: number;
  relicGateDist: number;
  relicGateBearing: number;
  relicStreak: number;
  relicsPassed: number;
  relicsMissed: number;
  boosting: boolean;
  // ---- RIVAL RACE
  raceRank: number;
  raceTotal: number;
  botLeaderName: string;
  botLeaderDist: number;
  // ---- JUMP MODE
  jumpStyle: number;
}

export interface PopupEvent {
  id: number;
  text: string;
  sub?: string;
  tone: 'gold' | 'cyan' | 'rose';
}

export interface GameHooks {
  onStats: (s: HudStats) => void;
  onPopup: (p: PopupEvent) => void;
  onState: (s: GameState) => void;
}

interface Spark {
  x: number;
  y: number;
  z: number;
  active: boolean;
  phase: number;
}

const GRAV = 44;

// ---------------------------------------------------------------------------
// FREESTYLE otomatis (klik kiri): daftar gaya + KANTONG ACAK ADIL (shuffle
// bag) — semua gaya terpakai satu kali sebelum ada yang mengulang, jadi tak
// pernah ada freestyle yang "ga kepake". Tiap klik pasti gaya berbeda.
// ---------------------------------------------------------------------------
interface Freestyle {
  name: string;
  flip: number; // 1 backflip · -1 frontflip · 0 tanpa flip
  spin: number; // 1 / -1 arah spin badan
  grab: string; // pose grab (lihat GRABS)
  board: string | null; // trik papan (lihat BOARD_TRICKS)
}
const FREESTYLES: Freestyle[] = [
  { name: 'Backflip Indy', flip: 1, spin: 0, grab: 'indy', board: null },
  { name: 'Frontflip Melon', flip: -1, spin: 0, grab: 'melon', board: null },
  { name: 'Full Spin Method', flip: 0, spin: 1, grab: 'method', board: null },
  { name: 'Spin Japan', flip: 0, spin: -1, grab: 'japan', board: null },
  { name: 'Superman', flip: 0, spin: 0, grab: 'superman', board: null },
  { name: 'Christ Air', flip: 0, spin: 0, grab: 'christ', board: null },
  { name: 'Nose Grab Spin', flip: 0, spin: 1, grab: 'nose', board: null },
  { name: 'Tail Grab Backflip', flip: 1, spin: 0, grab: 'tail', board: null },
  { name: 'Kickflip Indy', flip: 0, spin: 0, grab: 'indy', board: 'kickflip' },
  { name: 'Tre Flip Stalefish', flip: 0, spin: 1, grab: 'stalefish', board: 'tre' },
  { name: 'Heelflip Method', flip: 0, spin: 0, grab: 'method', board: 'heelflip' },
  { name: 'Laser Japan', flip: 0, spin: -1, grab: 'japan', board: 'laser' },
  { name: 'Impossible Superman', flip: 0, spin: 0, grab: 'superman', board: 'impossible' },
  { name: 'Shuv Christ', flip: 0, spin: 0, grab: 'christ', board: 'shuv' },
];
/** derajat → radian (tune kamera menyimpan sudut dalam derajat agar ramah UI) */
const rad = (d: number) => (d * Math.PI) / 180;

/** gradien vertikal untuk pilar sinar: transparan di langit, pekat di tanah */
function makeBeamTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.86, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, val: string) {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Live-blended lighting / sky state
// ---------------------------------------------------------------------------
class MoodMixer {
  top = new THREE.Color();
  mid = new THREE.Color();
  hor = new THREE.Color();
  low = new THREE.Color();
  sunTint = new THREE.Color();
  fog = new THREE.Color();
  sunColor = new THREE.Color();
  hemiSky = new THREE.Color();
  hemiGround = new THREE.Color();
  fillColor = new THREE.Color();
  terrainTint = new THREE.Color();
  sunDir = new THREE.Vector3(0, 0.3, 1);

  glow = 1;
  stars = 0;
  fogDensity = 0.005;
  sunIntensity = 1.7;
  hemiIntensity = 1;
  fillIntensity = 0.45;
  bloom = 0.62;
  bloomThreshold = 0.82;
  bloomRadius = 0.8;
  exposure = 1;

  name = PALETTES[0].name;
  private tgt: Palette = PALETTES[0];
  private tmp = new THREE.Color();

  set(p: Palette, snap = false) {
    this.tgt = p;
    this.name = p.name;
    if (snap) this.update(1);
  }

  update(k: number) {
    const t = this.tgt;
    const L = (c: THREE.Color, hex: string) => c.lerp(this.tmp.set(hex), k);
    L(this.top, t.skyTop);
    L(this.mid, t.skyMid);
    L(this.hor, t.skyHor);
    L(this.low, t.skyLow);
    L(this.sunTint, t.sunTint);
    L(this.fog, t.fog);
    L(this.sunColor, t.sunColor);
    L(this.hemiSky, t.hemiSky);
    L(this.hemiGround, t.hemiGround);
    L(this.fillColor, t.fillColor);
    L(this.terrainTint, t.terrainTint);

    this.glow = mix(this.glow, t.sunGlow, k);
    this.stars = mix(this.stars, t.stars, k);
    this.fogDensity = mix(this.fogDensity, t.fogDensity, k);
    this.sunIntensity = mix(this.sunIntensity, t.sunIntensity, k);
    this.hemiIntensity = mix(this.hemiIntensity, t.hemiIntensity, k);
    this.fillIntensity = mix(this.fillIntensity, t.fillIntensity, k);
    this.bloom = mix(this.bloom, t.bloom, k);
    this.bloomThreshold = mix(this.bloomThreshold, t.bloomThreshold, k);
    this.bloomRadius = mix(this.bloomRadius, t.bloomRadius, k);
    this.exposure = mix(this.exposure, t.exposure, k);

    const el = mix(Math.asin(clamp(this.sunDir.y, -1, 1)), t.sunEl, k);
    const az = mix(Math.atan2(this.sunDir.x, this.sunDir.z), t.sunAz, k);
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  }
}

export class Game {
  private container: HTMLElement;
  private hooks: GameHooks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private fog: THREE.FogExp2;
  private sky = new SkyDome();
  private aurora = new Aurora();
  private vista = new DistantVista();
  private clouds = new CloudLayer();
  private sun = new THREE.DirectionalLight(0xffcf9a, 1.7);
  private hemi = new THREE.HemisphereLight(0xa8ccff, 0xe2a97a, 1.05);
  private fill = new THREE.DirectionalLight(0x9ab8ff, 0.45);
  private rim = new THREE.DirectionalLight(0xffd9b8, 0.55);
  /** warm light reflected UP from the sand (lights rider & whale bellies) */
  private bounceLight = new THREE.DirectionalLight(0xe8a877, 0.5);
  /** effective (mood + custom override) colors used this frame */
  private eff = {
    top: new THREE.Color(),
    mid: new THREE.Color(),
    hor: new THREE.Color(),
    low: new THREE.Color(),
    sunTint: new THREE.Color(),
    sunColor: new THREE.Color(),
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    fog: new THREE.Color(),
  };
  private cc = new THREE.Color();
  private tmpC = new THREE.Color();
  private white = new THREE.Color('#ffffff');
  private ambient = new THREE.AmbientLight(0xffd9b0, 0.16);
  private grade!: GradePass;
  private terrain = new TerrainField();
  private monoliths = new Monoliths(8);
  private speedPads = new SpeedPads();
  private energyCrystals = new EnergyCrystals();
  private downhillRelics = new DownhillRelics();
  private rivalBots = new RivalBotsManager();
  private biomeScenery = new BiomeScenery();
  private shield = 3;
  private maxShield = 3;
  private shieldCooldown = 0;
  private crystalsCollected = 0;
  private lastSectorName = '';
  private dashCooldown = 0;
  private slipstreamTimer = 0;
  private lastRaceRank = 1;
  private rankNotifyCooldown = 0;
  private rider = buildRider();
  private shadow: THREE.Mesh;
  private aura: THREE.Sprite;
  private dust = new Particles(1600, false);
  private glow = new Particles(900, true);
  private ripples = new Ripples(20);
  private motes = new Motes(280, 95);
  private windStreaks = new WindStreaks(46);
  private trailGlow = new TrailRibbon(180, 0.22, 0xffd08a, 0.85, true, 0.25);
  private trailWake = new TrailRibbon(140, 0.32, 0x8a7058, 0.75, false, 0.18);
  private trailScarf = new TrailRibbon(100, 0.10, 0x9ad9ff, 0.85, true, 0.2);
  private trailAir = new TrailRibbon(130, 0.14, 0xbfe8ff, 1.2, true, 0.2);
  /** ekor putih halus di ujung pedang — pendek & lembut seperti trail paus */
  private trailSword = new TrailRibbon(190, 0.22, 0xf6faff, 0.6, false, 0.2);
  private scarfA = new Scarf(0);
  private scarfB = new Scarf(1.7);
  /** ekor panjang slugpup — tali verlet dari pangkal punggung (skin Slugpup) */
  private scarfTail = new Scarf(3.1);
  /** ujung pendek syal yang terurai di depan dada — look "sedang memakai syal" */
  private scarfFront = new Scarf(4.3);
  /** bentuk SLUGPUP: target & blend mulus (0 = humanoid, 1 = pup penuh) */
  private pupOn = false;
  private pupBlend = 0;
  private whales = new WhalePod(6);
  private fish = new FishSchool(6);
  // ---- endless descent
  private chasmMarkers = new ChasmMarkers();
  private decorated = new Set<number>();
  private overT = 0;
  private overReason: 'fall' | 'wall' | '' = '';
  private bestDist = 0;
  private lastCleared = -1;
  private gapDist = 0;
  private gapW = 0;
  private gapOn = false;
  private chA: Chasm = { z0: 0, z1: 0, zc: 0, w: 0, id: 0 };
  // ---- water
  private river = new RiverRenderer();
  private mist = new Particles(700, false);
  private onWater = false;
  private waterY = 0;
  private rippleT = 0;
  private mistAcc = 0;
  private sprayAcc = 0;
  private wasOnWater = false;
  private wakeSand = new THREE.Color(0x8a7058);
  private wakeWater = new THREE.Color(0xbfeeff);
  private skyRefl = new THREE.Color();
  private prevWZ = 0;
  private navTimer = 0;
  private navFall: ReturnType<typeof nextWaterfall> = null;
  private navDist = 0;
  private navBearing = 0;
  private skyReflHi = new THREE.Color();
  private crystalEnv!: CrystalEnv;
  private sandC = new THREE.Color();
  private mantas = new MantaFlock(12);
  private flyers = new FlyingFishSchool(96);
  private fogBase = 0;
  private fogBaseInit = false;
  private splashV = new THREE.Vector3();
  private songTimer = 9;
  private scarfColorIdx = -1;
  private scarfSkinKey = -1;
  private crystalKey = '';
  private boardCur = -1;
  private scarfSparkAcc = 0;
  private sparkCol = new THREE.Color();
  private sparkMesh: THREE.InstancedMesh;
  private sparks: Spark[] = [];
  private sparkCount = 54;
  audio = new AudioEngine();

  // ---- mood + tuning
  private mood = new MoodMixer();
  tune: Tune = { ...DEFAULT_TUNE };
  private cycleT = 0;

  // ---- hover rig (all smoothness lives here)
  private rig = new HoverRig();

  // ---- player physics
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private yaw = 0;
  private grounded = true;
  private airTime = 0;
  private spinAngle = 0;
  private spinVel = 0;
  // ---- Alto-style air system
  private air = new AirSystem();
  private airInput: AirInput = { flip: 0, steer: 0, grab: false, grabType: 'indy' };
  private touchGrab = 'indy';
  private jumpHeld = false;
  private frontHeld = false;
  private grabHeld = false;
  private airJumpFlash = 0;
  private steer = 0;
  private steerTarget = 0;
  private boosting = false;
  private boostHeld = false;
  private flow = 45;
  private combo = 0;
  private chain = 0;
  private chainTimer = 0;
  private chimeStep = 0;
  private score = 0;
  private best = 0;
  private distance = 0;
  private shake = 0;
  private shakeAmp = 0;
  private crashCD = 0;
  private dustAcc = 0;
  private glowAcc = 0;
  private timeScale = 1;
  private trickLabel = '';
  private bobT = 0;
  private runT = 0; // durasi run aktif (untuk timer REC bodycam)

  // ---- camera
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camRoll = 0;
  private camFov = 66;
  private lookSmooth = new THREE.Vector3();
  // ---- kamera Sekiro/bodycam: state orbit sesi (drag/scroll) + lock-on (kristal energi).
  // Pitch dasar kini datang dari tune per-mode (default Sekiro 2° = third-person),
  // offset orbit ini kembali ke 0 saat idle.
  private orbit = { yaw: 0, pitch: 0, zoom: 1, lastInput: -10 };
  private lockTarget: { x: number; y: number; z: number; collected: boolean } | null = null;
  private lockCooldown = 0;
  // ---- kamera "drone pengikut mobil": heading MILIK KAMERA sendiri — dari
  // arah luncur (velocity), BUKAN dari badan rider. Rider = bola: badannya
  // boleh spin trick 1080°, layar tidak ikut muter.
  private camHeading = 0;
  // ---- freestyle klik: kantong acak adil
  private freestyleBag: number[] = [];
  private lastFreestyle = -1;
  private camHeadingInit = false;
  private clearLift = 0; // clearance terrain yang di-haluskan (naik cepat, turun pelan)
  /** cincin reticle lock-on (billboard, depthTest off = selalu terlihat) */
  private lockRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 40),
    new THREE.MeshBasicMaterial({ color: 0xaef3ff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }),
  );

  // ---- SINAR PUTIH: pilar cahaya tujuan yang turun dari langit. Rider harus
  // menuju titik tempat sinar menyentuh pasir; setelah tercapai sinar baru
  // muncul lebih jauh di depan → memberi arah eksplorasi yang jelas.
  private beamGroup = new THREE.Group();
  private beamCoreMat: THREE.MeshBasicMaterial = null as unknown as THREE.MeshBasicMaterial;
  private beamGlowMat: THREE.MeshBasicMaterial = null as unknown as THREE.MeshBasicMaterial;
  private beamRing: THREE.Mesh = null as unknown as THREE.Mesh;
  private beamBase: THREE.Sprite = null as unknown as THREE.Sprite;
  private beamPos = new THREE.Vector3(0, 0, 400);
  private beamDist = 0;
  private beamBearing = 0;
  private beamsReached = 0;

  // ---- loop
  private raf = 0;
  private last = 0;
  private time = 0;
  private frames = 0;
  private fpsAvg = 60;
  private resScale = 1;
  private basePR = 1;
  private statTick = 0;
  private popupId = 1;
  state: GameState = 'menu';

  // scratch
  private grad = { x: 0, z: 0 };
  private t1 = new THREE.Vector3();
  private t2 = new THREE.Vector3();
  private t3 = new THREE.Vector3();
  private t4 = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private m4 = new THREE.Matrix4();
  private nrm = new THREE.Vector3();

  private keys = new Set<string>();
  private ro: ResizeObserver | null = null;
  private pointerId: number | null = null;
  private pointerStart = 0;
  private pointerStartY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private steerLeftHeld = false;
  private steerRightHeld = false;


  constructor(container: HTMLElement, hooks: GameHooks) {
    this.container = container;
    this.hooks = hooks;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    // advanced fog chunks must be in place before any material compiles
    patchFogChunks();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.basePR = Math.min(window.devicePixelRatio || 1, 1.7);
    this.renderer.setPixelRatio(this.basePR);
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.fog = new THREE.FogExp2(0xffd9bd, 0.005);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(66, w / h, 0.3, 2000);
    this.camera.position.set(0, 8, -14);

    this.sun.position.set(150, 90, 275);
    this.scene.add(this.sun);
    this.scene.add(this.hemi);
    this.scene.add(this.ambient);
    this.fill.position.set(-0.5, 0.35, -0.8);
    this.scene.add(this.fill);
    this.rim.position.set(-0.3, 0.45, -0.85);
    this.scene.add(this.rim);
    this.bounceLight.position.set(0.2, -1, 0.15);
    this.scene.add(this.bounceLight);

    this.scene.add(this.sky.mesh);
    this.scene.add(this.aurora.mesh); // tirai aurora: tepat di depan sky dome
    this.scene.add(this.vista.group); // pegunungan siluet berlapis di cakrawala
    this.scene.add(this.clouds.group);
    this.scene.add(this.terrain.mesh);
    this.scene.add(this.monoliths.group);
    this.scene.add(this.speedPads.group);
    this.scene.add(this.energyCrystals.group);
    this.scene.add(this.downhillRelics.group);
    this.scene.add(this.rivalBots.group);
    this.scene.add(this.biomeScenery.group);

    // ---- pilar SINAR PUTIH (objective): inti + lapisan glow + cincin & semburat
    // di tanah. Additive + warna sedikit di atas 1.0 → disentuh bloom, terlihat
    // "hidup" dari jarak ratusan meter. fog:false = tidak pudar dimakan kabut.
    {
      const tex = makeBeamTexture();
      const mkBeamMat = (op: number) =>
        new THREE.MeshBasicMaterial({
          map: tex,
          color: new THREE.Color(1.4, 1.5, 1.7), // putih dingin sedikit HDR
          transparent: true,
          opacity: op,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          fog: false,
        });
      this.beamCoreMat = mkBeamMat(0.95);
      this.beamGlowMat = mkBeamMat(0.16);
      const H = 340; // tinggi pilar — menembus awan di horizon
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.75, H, 20, 1, true),
        this.beamCoreMat,
      );
      core.position.y = H / 2;
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4, 4.9, H, 20, 1, true),
        this.beamGlowMat,
      );
      glow.position.y = H / 2;
      this.beamRing = new THREE.Mesh(
        new THREE.RingGeometry(1.15, 1.5, 48),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      this.beamRing.rotation.x = -Math.PI / 2;
      this.beamRing.position.y = 0.25;
      this.beamBase = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeGlowTexture(),
          color: 0xffffff,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      this.beamBase.scale.set(30, 30, 1);
      this.beamBase.position.y = 2;
      this.beamGroup.add(core, glow, this.beamRing, this.beamBase);
      this.beamGroup.renderOrder = 5;
      this.scene.add(this.beamGroup);
    }

    this.scene.add(this.rider.group);
    applyCrystalSkin(this.rider.crystal, this.rider.crystalU, CRYSTAL_SKINS[2]); // Indigo default
    this.aura = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: 0x9fdcff,
        transparent: true,
        opacity: 0.1, // reduced by 70%+
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.aura.scale.set(5.2, 5.2, 1);
    this.aura.position.set(0, 0.3, 0.5);
    this.rider.group.add(this.aura);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({
        map: makeSoftDiscTexture(),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        color: 0x4a2c18,
      }),
    );
    this.scene.add(this.shadow);

    this.scene.add(this.dust.points);
    this.scene.add(this.glow.points);
    this.scene.add(this.ripples.group);
    this.scene.add(this.motes.points);
    this.scene.add(this.windStreaks.lines);
    this.scene.add(this.trailGlow.mesh);
    // permata tidak pernah menempel pada relic / patung / batu
    this.energyCrystals.setAvoid(this.monoliths.items);
    this.scene.add(this.trailWake.mesh);
    this.scene.add(this.trailScarf.mesh);
    this.scene.add(this.trailAir.mesh);
    this.scene.add(this.trailSword.mesh);
    this.lockRing.renderOrder = 30;
    this.lockRing.visible = false;
    this.scene.add(this.lockRing);
    this.scene.add(this.scarfA.mesh);
    this.scene.add(this.scarfB.mesh);
    this.scene.add(this.scarfTail.mesh);
    this.scene.add(this.scarfFront.mesh);
    // ekor slugpup: kain putih pucat, bukan selendang warna
    this.scarfTail.setColor('#e9eef4');
    this.scarfTail.setSkin(false, 0);
    this.scarfTail.setVisible(false);
    this.scene.add(this.whales.group);
    this.scene.add(this.fish.mesh);
    this.scene.add(this.river.group);
    this.river.group.visible = RIVERS_ON;
    this.scene.add(this.chasmMarkers.group);
    this.scene.add(this.mist.points);
    this.scene.add(this.mantas.group);
    this.scene.add(this.flyers.mesh);

    this.sparkMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfff3d6,
        emissive: new THREE.Color(0xffbe5c),
        emissiveIntensity: 3.4,
        roughness: 0.3,
        metalness: 0,
      }),
      this.sparkCount,
    );
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.scene.add(this.sparkMesh);
    for (let i = 0; i < this.sparkCount; i++)
      this.sparks.push({ x: 0, y: 0, z: 0, active: false, phase: Math.random() * 9 });

    this.best = Number(safeGet('swordsea_best') || 0);

    this.setupPost(w, h);
    this.mood.set(PALETTES[this.tune.palette], true);
    this.applyMood();
    this.resetPlayer();
    this.bindEvents();
    // every fog-enabled material gets the shared advanced-fog uniforms
    installFog(this.scene);
    // live sky reflections for the crystal rider
    this.crystalEnv = new CrystalEnv(this.renderer);

    this.last = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.loop);
  }

  private setupPost(w: number, h: number) {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.62, 0.8, 0.82);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.grade = new GradePass();
    this.composer.addPass(this.grade);
    this.composer.setSize(w, h);
  }

  // ------------------------------------------------------------------ input
  private onKeyDown = (e: KeyboardEvent) => {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    const fresh = !this.keys.has(e.code);
    this.keys.add(e.code);
    if (!fresh) return;
    if (e.code === 'Space') {
      if (this.state === 'menu') this.begin();
      else if (this.state === 'over') {
        if (this.overT > 0.9) this.restart();
      } else this.pressJump();
    }
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.airJump();
    if (e.code === 'KeyQ') this.dash(-1); // Manuver mengelak kiri
    if (e.code === 'KeyE') {
      if (this.grounded) this.dash(1); // Manuver mengelak kanan saat di tanah
      else this.pressStyle(1); // auto backflip saat di udara
    }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.pressStyle(-1); // auto frontflip
    if (e.code === 'KeyF') this.pressCombo(); // auto combo
    if (e.code === 'KeyV') this.toggleJumpStyle(); // Ganti Mode Lompatan: Rendah (Menempel Pasir) ⇄ Tinggi (Melayang)
    // ---- gaya kamera (1 = Klasik · 2 = Sekiro · 3 = Sword of the Sea · 4 = Bodycam)
    if (e.code === 'Digit1') this.setCamStyle(0);
    if (e.code === 'Digit2') this.setCamStyle(1);
    if (e.code === 'Digit3') this.setCamStyle(2);
    if (e.code === 'Digit4') this.setCamStyle(3);
    // ---- skate board tricks (J K L I U O M , N)
    const bt = BOARD_TRICKS.find((b) => b.key === e.code);
    if (bt) this.pressBoardTrick(bt.id);
    // ---- grab keys on the ground pop a jump so the grab can follow
    if (this.grounded && this.state === 'playing' && GRABS.some((g) => g.key === e.code)) this.jump();
    if (e.code === 'KeyR') this.restart();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'Space') this.releaseJump();
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.state === 'menu') {
      this.begin();
      return;
    }
    if (this.state === 'over') {
      if (this.overT > 0.9) this.restart();
      return;
    }
    this.pointerId = e.pointerId;
    this.pointerStart = e.clientX;
    this.pointerStartY = e.clientY;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
    // KLIK KIRI / TAP = FREESTYLE otomatis (kantong acak adil).
    // KLIK KANAN = lompat (tahan = flip). Drag tetap = sudut kamera.
    if (e.button === 2) {
      this.pressJump();
      return;
    }
    if (e.button === 0 || e.pointerType === 'touch') this.autoFreestyle();
  };
  private onPointerMove = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    const dx = e.clientX - this.pointerX;
    const dy = e.clientY - this.pointerY;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
    if (this.state !== 'playing') return;
    // ---- SEMUA MODE: drag = sudut kamera (orbit/toleh).
    // Mouse selalu boleh; sentuh hanya di mode Sekiro/Bodycam (di mode lain sentuh
    // dipakai penuh untuk lompat/flip).
    const camStyle = Math.round(this.tune.camStyle);
    if (e.pointerType === 'touch' && camStyle !== 1 && camStyle !== 3) return;
    const dragDist = Math.hypot(e.clientX - this.pointerStart, e.clientY - this.pointerStartY);
    if (dragDist < 9) return; // deadzone: klik-lompat tak sengaja memutar kamera
    const sens = 0.0052;
    const o = this.orbit;
    o.yaw -= dx * sens;
    o.pitch = clamp(o.pitch + dy * sens * 0.7, -1.35, 1.35);
    o.lastInput = this.time;
    // drag > 40 px memutus lock-on (kontrol manual menang)
    if (dragDist > 40 && this.lockTarget) {
      this.lockTarget = null;
      this.lockCooldown = 2.5;
    }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.releaseJump();
  };
  /** SEMUA MODE: scroll = zoom orbit (bodycam lebih ketat: 0.75–1.5) */
  private onWheel = (e: WheelEvent) => {
    if (this.state !== 'playing') return;
    const o = this.orbit;
    const [lo, hi] = Math.round(this.tune.camStyle) === 3 ? [0.75, 1.5] : [0.55, 2.2];
    o.zoom = clamp(o.zoom * (1 - e.deltaY * 0.001), lo, hi);
    o.lastInput = this.time;
  };

  private onCtx = (e: Event) => e.preventDefault();
  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: true });
    el.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('resize', this.onResize);
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => this.onResize());
      this.ro.observe(this.container);
    }
  }

  // ------------------------------------------------------------- public API
  begin() {
    if (this.state === 'playing') return;
    this.audio.init();
    this.audio.resume();
    // the title screen glides far down the mountain: every run starts fresh at the top
    this.resetPlayer();
    this.score = 0;
    this.combo = 0;
    this.distance = 0;
    this.runT = 0;
    this.flow = 45;
    this.shield = this.maxShield;
    this.shieldCooldown = 0;
    this.crystalsCollected = 0;
    this.lastSectorName = '';
    this.dashCooldown = 0;
    this.lastRaceRank = 1;
    this.rankNotifyCooldown = 3.5;
    this.beamsReached = 0;
    this.spawnBeam();
    this.state = 'playing';
    this.hooks.onState(this.state);
    this.popup('TURUN GUNUNG', 'ikuti SINAR PUTIH di kejauhan ✦', 'cyan');
  }

  restart() {
    this.resetPlayer();
    this.monoliths.update(this.pos.x, this.pos.z, 0, 1, this.time);
    this.score = 0;
    this.combo = 0;
    this.chain = 0;
    this.flow = 45;
    this.distance = 0;
    this.runT = 0;
    this.shield = this.maxShield;
    this.shieldCooldown = 0;
    this.crystalsCollected = 0;
    this.lastSectorName = '';
    this.dashCooldown = 0;
    this.lastRaceRank = 1;
    this.rankNotifyCooldown = 3.5;
    this.beamsReached = 0;
    this.spawnBeam();
    this.state = 'playing';
    this.audio.init();
    this.audio.resume();
    this.hooks.onState(this.state);
  }

  setPaused(p: boolean) {
    if (p && this.state === 'playing') {
      this.state = 'paused';
      this.hooks.onState(this.state);
    } else if (!p && this.state === 'paused') {
      this.state = 'playing';
      this.hooks.onState(this.state);
    }
  }

  /** ganti mode kamera: 0 = Klasik · 1 = Sekiro · 2 = Sword of the Sea · 3 = Bodycam */
  setCamStyle(s: number) {
    const style = clamp(Math.round(s), 0, 3);
    if (style === clamp(Math.round(this.tune.camStyle), 0, 3)) return;
    this.setTune({ camStyle: style });
    // orbit sesi di-nol-kan (yaw/pitch) saat pindah mode supaya framing mode baru
    // langsung murni; zoom biarkan — itu preferensi jarak user.
    this.orbit.yaw = 0;
    this.orbit.pitch = 0;
    this.lockTarget = null;
    const names = ['KAMERA KLASIK', 'KAMERA SEKIRO ✦', 'SWORD OF THE SEA ✦', 'KAMERA BODYCAM ●REC'];
    const descs = [
      'samping-belakang kanan, FOV melebar saat ngebut',
      'third-person di bahu — drag = orbit · scroll = zoom · lock-on kristal',
      'drone sinematik lebar yang menyapu vista',
      'terpasang di dada — drag = toleh · scroll = maju/mundur',
    ];
    this.popup(names[style], descs[style], 'cyan');
  }

  setTune(t: Partial<Tune>) {
    const prevPal = this.tune.palette;
    const prevWorld = this.tune.worldMode;
    this.tune = { ...this.tune, ...t };
    if (t.palette !== undefined && t.palette !== prevPal) {
      this.mood.set(PALETTES[this.tune.palette]);
      this.audio.chime(3, 0.14);
    }
    // Mode dunia diganti → bangkitkan ulang medan & dekorasi biome SEKETIKA.
    // Terrain f(x,z) murni → cukup invalidate cache, segalanya konsisten lagi.
    if (t.worldMode !== undefined && Math.round(t.worldMode) !== Math.round(prevWorld)) {
      setWorldMode(t.worldMode);
      this.terrain.invalidate();
      this.biomeScenery.respawnAll(this.pos.x, this.pos.z);
      this.audio.chime(4, 0.18);
      const names = ['PETUALANGAN', 'GURUN PASIR', 'NGARAI MERAH', 'RERUNTUHAN KUIL'];
      const nm = names[Math.round(Math.max(0, Math.min(3, t.worldMode)))];
      this.popup('DUNIA: ' + nm, 'medan terbangun ulang', 'cyan');
    }
  }

  /**
   * Jump button down:
   *  - on the ground                      -> jump
   *  - just left a crest (coyote time)    -> still counts as a full jump
   *  - in the air                         -> AIR JUMP (double jump, like skating games)
   *  - about to touch down, no air jumps  -> buffered, fires on landing
   * Keep holding afterwards to flip.
   */
  pressJump() {
    if (this.state !== 'playing') return;
    this.jumpHeld = true;
    if (this.grounded) {
      this.jump();
    } else if (
      !this.jumpedThisAir &&
      (this.air.airTime < 0.22 || this.pos.y - this.surfaceY(this.pos.x, this.pos.z) < this.hoverH() + 1.5)
    ) {
      // just floated off a crest (or still skimming the sand) -> full ground jump
      this.jump();
    } else if (this.air.airJumpsLeft > 0) {
      this.airJump();
    } else if (this.timeToLand < 0.22) {
      this.jumpBuffer = 0.2;
    }
  }

  releaseJump() {
    this.jumpHeld = false;
  }

  /** legacy alias (touch UI) */
  jumpOrTrick() {
    this.pressJump();
  }

  setGrab(on: boolean) {
    // touch GRAB: every press picks a different signature grab
    if (on && !this.grabHeld) {
      let g = this.touchGrab;
      while (g === this.touchGrab) g = GRABS[Math.floor(Math.random() * GRABS.length)].id;
      this.touchGrab = g;
    }
    this.grabHeld = on;
  }

  /** skate board trick: on the ground it pops a jump first */
  pressBoardTrick(id: string) {
    if (this.state !== 'playing') return;
    const def = BOARD_TRICKS.find((b) => b.id === id);
    if (!def) return;
    if (this.grounded) this.jump();
    const ttl = this.predictTTL();
    if (this.tune.smartLand && ttl < 0.24) return; // too low: the sword could never be caught
    if (this.air.board.start(def)) this.audio.whoosh(0.85);
  }

  /** jump straight onto the river, ~150 m upstream of the next waterfall */
  teleportToWaterfall() {
    const f = nextWaterfall(this.pos.z, 160, 5) ?? nextWaterfall(this.pos.z, 160, 3);
    if (!f) return;
    const z = f.lipZ - 150;
    const x = riverX(z);
    this.yaw = riverYaw(z);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.groundY = this.surfaceY(x, z);
    this.pos.set(x, this.groundY + this.hoverH(), z);
    this.vel.set(fx * 30, 0, fz * 30);
    this.prevGroundInit = false;
    this.groundVy = 0;
    this.lastGroundVy = 0;
    this.grounded = true;
    this.air.resetAngles();
    this.prevWZ = z;
    this.navTimer = 0;
    this.terrain.update(x, z);
    this.rig.reset(x, z, this.yaw);
    this.rig.resetCameraY();
    this.camPos.set(x - fx * 12, this.pos.y + 5, z - fz * 12);
    this.lookSmooth.copy(this.pos);
    this.camLook.copy(this.pos);
    this.trailGlow.reset(this.t1.copy(this.pos), -fz, fx, 0.18);
    this.trailWake.reset(this.t1.copy(this.pos), -fz, fx, 0.28);
    this.trailScarf.reset(this.t1.copy(this.pos), -fz, fx, 0.08);
    this.trailAir.reset(this.t1.copy(this.pos), -fz, fx, 0.12);
    this.trailSword.reset(this.t1.copy(this.pos), -fz, fx, 0.15);
    this.popup('AIR TERJUN', `${Math.round(f.drop)} m di depan · ikuti sungai`, 'cyan');
    this.audio.chime(6, 0.18);
  }

  /** touch FLIP button: a random board trick */
  pressRandomBoardTrick() {
    const pool = BOARD_TRICKS.slice(0, 7);
    this.pressBoardTrick(pool[Math.floor(Math.random() * pool.length)].id);
  }

  setFrontFlip(on: boolean) {
    this.frontHeld = on;
    if (on) this.pressStyle(-1);
  }

  /**
   * MOMENTUM JUMP: pop + forward speed + the terrain's own upward velocity.
   * Jumping right as you crest a dune = a big, satisfying "crest launch".
   */
  private jump() {
    const T = this.tune;
    const isLow = T.jumpStyle === 1;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const sp = Math.max(0, this.vel.x * fx + this.vel.z * fz);
    const rising = Math.max(0, this.lastGroundVy);

    // full carry of the slope's upward speed
    // (pop dasar disesuaikan dengan jumpStyle: rendah agar menempel pasir & tidak terbang terus, tinggi untuk melayang)
    const basePop = isLow ? 7.2 : 14.5;
    const spK = isLow ? 0.08 : 0.16;
    const launchK = isLow ? 0.38 : T.launchBoost;
    let vy = (basePop + sp * spK) * T.jumpPower + rising * launchK;

    // crest / mound detection
    const onMound = isOnMound(this.pos.x, this.pos.z);
    const here = this.surfaceY(this.pos.x, this.pos.z);
    const ahead = this.surfaceY(this.pos.x + fx * 9, this.pos.z + fz * 9);
    const crest = rising > 3 && ahead < here - 0.3;

    if (onMound || rising > 7) {
      if (isLow) {
        vy = Math.max(vy, (9.5 + sp * 0.12) * T.jumpPower + rising * 0.45);
        this.popup('LOMPATAN RENDAH! ✦', 'Gaya Menempel Pasir (Grounded)', 'cyan');
      } else {
        vy = Math.max(vy, (18.5 + sp * 0.22) * T.jumpPower + rising * 1.3);
        const pts = Math.round(180 * this.mult());
        this.popup('GUNDUKAN AIR JUMP! ✦', `Lompatan Indah · +${pts}`, 'gold');
      }
      this.score += Math.round((isLow ? 80 : 180) * this.mult());
      this.combo += 2;
      this.flow = clamp(this.flow + 14, 0, 100);
      this.audio.chime(7, 0.22);
      this.nrm.set(0, 1, 0);
      this.ripples.spawn(this.t1.copy(this.pos), this.nrm, 9 + sp * 0.08, 1.2, 0x8fe8ff);
      this.emitBurst(this.pos, Math.round(20 * T.particles), 0.7, 0.9, 1);
    } else if (crest) {
      vy *= 1 + (isLow ? 0.06 : 0.18) * T.launchBoost;
      this.popup(isLow ? 'CREST GLIDE ✦' : 'CREST LAUNCH ✦', `+${Math.round(40 * this.mult())}`, 'cyan');
      this.score += 40 * this.mult();
      this.audio.chime(6, 0.14);
    }

    const wasAirborne = !this.grounded;
    this.vel.y = wasAirborne ? Math.max(this.vel.y, vy) : vy;
    this.grounded = false;
    this.jumpedThisAir = true;
    this.jumpBuffer = 0;
    if (!wasAirborne) this.air.takeoff(this.airTune());
    this.airTime = 0;
    this.audio.whoosh(0.65 + sp / 85 + (onMound ? 0.35 : crest ? 0.2 : 0));
    this.emitDust(this.pos, Math.round(16 * T.particles), 6);
    this.nrm.set(0, 1, 0);
    this.ripples.spawn(this.t1.copy(this.pos), this.nrm, 3.5 + sp * 0.05, 0.7, 0xffe4bb);
    this.timeScale = 1;
  }

  /** limited mid-air jump, lets you extend a combo */
  airJump() {
    if (this.state !== 'playing' || this.grounded) return;
    if (this.air.airJumpsLeft <= 0) {
      this.audio.thump(0.15);
      return;
    }
    this.air.airJumpsLeft--;
    this.air.airJumpsUsed++;
    this.jumpedThisAir = true;
    // costs a little flow if you have it, but never blocks the jump
    this.flow = clamp(this.flow - 6, 0, 100);
    // air jump: pop baru yang tidak terlalu tinggi dari posisi apa pun (bahkan saat jatuh)
    this.vel.y = Math.max(this.vel.y, 0) * 0.35 + 14 * this.tune.airJumpPower;
    this.airJumpFlash = 1;
    this.popup('AIR JUMP INDAH! ✦', 'Gaya Melayang', 'cyan');
    this.audio.whoosh(1.15);
    this.audio.chime(4 + this.air.airJumpsUsed, 0.22);
    this.rider.neck.getWorldPosition(this.t1);
    this.t1.y -= 1;
    this.nrm.set(0, 1, 0);
    this.ripples.spawn(this.t1, this.nrm, 8, 0.6, 0xbfe8ff);
    this.emitBurst(this.t1, 24, 0.6, 0.88, 1);
  }

  private airTune() {
    const T = this.tune;
    return {
      flipSpeed: T.flipSpeed,
      spin: T.spin,
      landAssist: T.landAssist,
      landWindow: T.landWindow,
      floaty: T.floaty,
      airJumps: T.airJumps,
      smart: T.smartLand,
      ambition: T.styleAmbition,
      margin: T.landMargin,
    };
  }

  /**
   * AUTO FREESTYLE: S / E / touch FRONT. On the ground it jumps first.
   * The smart planner then fits as many rotations as the air time allows and
   * always finishes upright right before touchdown.
   */
  pressStyle(dir: number) {
    if (this.state !== 'playing') return;
    if (this.grounded) this.jump();
    this.air.startAuto(dir);
  }

  /** AUTO COMBO: flip + (sometimes) spin + grab, all landed cleanly */
  /** ambil gaya freestyle berikutnya: kantong dikocok ulang setelah habis —
   *  semua gaya pasti terpakai sebelum ada yang mengulang */
  private popFreestyle(): number {
    if (this.freestyleBag.length === 0) {
      for (let i = 0; i < FREESTYLES.length; i++) this.freestyleBag.push(i);
      for (let i = this.freestyleBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.freestyleBag[i], this.freestyleBag[j]] = [this.freestyleBag[j], this.freestyleBag[i]];
      }
      // saat kantong baru diisi, jangan langsung mengulang gaya terakhir
      if (this.freestyleBag.length > 1 && this.freestyleBag[0] === this.lastFreestyle) {
        [this.freestyleBag[0], this.freestyleBag[1]] = [this.freestyleBag[1], this.freestyleBag[0]];
      }
    }
    const v = this.freestyleBag.pop()!;
    this.lastFreestyle = v;
    return v;
  }

  /** KLIK KIRI: freestyle otomatis — gaya berikutnya dari kantong acak adil.
   *  Di tanah = lompat dulu lalu trik menyusul di udara; rotasi disesuaikan
   *  dengan sisa waktu udara supaya selalu mendarat aman. */
  autoFreestyle() {
    if (this.state !== 'playing') return;
    if (this.grounded) this.jump();
    const f = FREESTYLES[this.popFreestyle()];
    const ttl = this.predictTTL();
    if (this.tune.smartLand && ttl < 0.14) return; // terlalu rendah — fokus mendarat
    const flip = ttl > 0.55 ? f.flip : 0;
    const spin = ttl > 0.6 ? f.spin : 0;
    if (f.board && ttl > 0.42) {
      const bt = BOARD_TRICKS.find((b) => b.id === f.board);
      if (bt) this.air.board.start(bt);
    }
    this.air.startAuto(flip, spin, f.grab);
    this.popup(f.name.toUpperCase(), 'freestyle ✦', 'cyan');
    this.audio.whoosh(0.9);
  }

  pressCombo() {
    if (this.state !== 'playing') return;
    if (this.grounded) this.jump();
    this.autoCombo();
    this.audio.chime(5, 0.12);
  }

  private autoCombo() {
    // a skate line: board flip first, then a styled grab, plus body rotations
    const ttl = this.predictTTL();
    const flip = Math.random() < 0.55 ? (Math.random() < 0.7 ? 1 : -1) : 0;
    const spin = Math.random() < 0.45 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    const grab = GRABS[Math.floor(Math.random() * GRABS.length)].id;
    if (ttl > 0.75 && Math.random() < 0.8) {
      this.air.board.start(BOARD_TRICKS[Math.floor(Math.random() * 7)]);
    }
    this.air.startAuto(flip, spin, grab);
  }

  /**
   * Predict seconds until touchdown by simulating the real trajectory over
   * the real (smoothed) terrain ahead: accounts for downslopes, crests and
   * the floaty apex. This is what makes the landing planner "smart".
   */
  private predictTTL(): number {
    const T = this.tune;
    const g = GRAV * T.gravity;
    const lift = this.hoverH() * 1.15 + 0.2; // same threshold the landing uses
    const at = this.airTune();
    let x = this.pos.x;
    let y = this.pos.y;
    let z = this.pos.z;
    let vy = this.vel.y;
    const vx = this.vel.x;
    const vz = this.vel.z;
    const step = 0.06;
    let prevGap = y - (this.surfaceY(x, z) + lift);
    if (prevGap <= 0 && vy <= this.groundVy + 1) return 0.01;
    for (let t = step; t <= 3.6; t += step) {
      vy -= g * this.air.gravityMul(vy, at, false) * step;
      x += vx * step;
      y += vy * step;
      z += vz * step;
      const gap = y - (this.surfaceY(x, z) + lift);
      if (gap <= 0 && vy < 0) {
        const f = prevGap > 0 ? prevGap / Math.max(1e-4, prevGap - gap) : 1;
        return t - step + step * clamp(f, 0, 1);
      }
      prevGap = gap;
    }
    return 3.6;
  }

  /** swift lateral evade / dash maneuver (Q/E or mobile swipe/button) */
  dash(dir: -1 | 1) {
    if (this.dashCooldown > 0 || this.state !== 'playing') return;
    this.dashCooldown = 0.38;
    const fx = Math.sin(this.rig.yaw);
    const fz = Math.cos(this.rig.yaw);
    // screen-right is (-fz, fx), screen-left is (fz, -fx)
    const latX = -fz * dir;
    const latZ = fx * dir;
    this.vel.x += latX * 24;
    this.vel.z += latZ * 24;
    this.shake = 0.22;
    this.audio.whoosh(1.35);
    this.popup(dir < 0 ? '◀ MANUVER KIRI!' : 'MANUVER KANAN! ▶', 'Mengelak Kilat', 'cyan');
    this.emitBurst(this.pos, 16, 0.4, 0.9, 1.0);
  }

  dashLeft() {
    this.dash(-1);
  }

  dashRight() {
    this.dash(1);
  }

  toggleJumpStyle(): number {
    this.tune.jumpStyle = this.tune.jumpStyle === 1 ? 0 : 1;
    const isLow = this.tune.jumpStyle === 1;
    this.popup(
      isLow ? 'MODE LOMPAT: RENDAH (GROUNDED)' : 'MODE LOMPAT: TINGGI (FREESTYLE)',
      isLow ? 'Menempel pasir gurun · Tidak terbang mulu' : 'Melayang bebas di udara',
      isLow ? 'cyan' : 'gold',
    );
    this.audio.whoosh(isLow ? 0.75 : 1.15);
    return this.tune.jumpStyle;
  }

  setSteerLeft(on: boolean) {
    this.steerLeftHeld = on;
  }

  setSteerRight(on: boolean) {
    this.steerRightHeld = on;
  }

  setBoost(on: boolean) {
    this.boostHeld = on;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('contextmenu', this.onCtx);
    this.ro?.disconnect();
    this.audio.dispose();
    this.rivalBots.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // ------------------------------------------------------------------ setup
  private resetPlayer() {
    // every run starts somewhere new on the endless mountain => a fresh chasm layout
    setRunStart(Math.floor(Math.random() * 40) * 1500 + 500);
    setWorldMode(this.tune.worldMode);
    this.terrain.invalidate();
    this.decorated.clear();
    this.lastCleared = -1;
    this.overReason = '';
    this.overT = 0;
    this.gapOn = false;
    if (!this.bestDist) this.bestDist = Number(safeGet('swordsea_bestdist') || 0);
    const s = findStart();
    this.groundY = this.surfaceY(s.x, s.z);
    this.pos.set(s.x, this.groundY + this.hoverH(), s.z);
    this.biomeScenery.respawnAll(this.pos.x, this.pos.z);
    this.downhillRelics.reset(this.pos.z);
    this.rivalBots.reset(this.pos.x, this.pos.z, this.yaw);
    this.prevGroundInit = false;
    this.groundVy = 0;
    this.prevWZ = s.z;
    this.navTimer = 0;
    this.yaw = s.yaw;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.vel.set(fx * 22, 0, fz * 22);
    this.grounded = true;
    this.airTime = 0;
    this.spinAngle = 0;
    this.spinVel = 0;
    this.camHeading = this.yaw;
    this.camHeadingInit = true;
    this.clearLift = 0;
    this.air.resetAngles();
    this.air.chain = 0;
    this.air.chainTimer = 0;
    this.shake = 0;
    this.shakeAmp = 0;
    this.terrain.update(this.pos.x, this.pos.z);
    this.rig.reset(this.pos.x, this.pos.z, this.yaw);
    this.rig.resetCameraY();
    this.camPos.set(this.pos.x - fx * 12, this.pos.y + 5, this.pos.z - fz * 12);
    this.camLook.copy(this.pos);
    this.lookSmooth.copy(this.pos);
    this.trailGlow.reset(this.t1.copy(this.pos).setY(this.pos.y + 0.3), -fz, fx, 0.18);
    this.trailWake.reset(this.t1.copy(this.pos).setY(this.pos.y + 0.1), -fz, fx, 0.28);
    this.trailScarf.reset(this.t1.copy(this.pos).setY(this.pos.y + 1.7), -fz, fx, 0.08);
    this.trailAir.reset(this.t1.copy(this.pos).setY(this.pos.y + 1), -fz, fx, 0.12);
    this.trailSword.reset(this.t1.copy(this.pos).setY(this.pos.y + 0.6), -fz, fx, 0.15);
    for (const sp of this.sparks) sp.active = false;
    for (let i = 0; i < 7; i++) this.spawnRun();
    this.updateRider(0.016);
  }

  private mult() {
    return Math.min(12, 1 + Math.floor(this.combo / 4));
  }

  private popup(text: string, sub: string | undefined, tone: PopupEvent['tone']) {
    this.hooks.onPopup({ id: this.popupId++, text, sub, tone });
  }

  private lightDir = new THREE.Vector3(0, 0.3, 1);

  private applyMood() {
    const m = this.mood;
    const T = this.tune;

    // ---------- sun direction: mood position + user offsets
    const baseEl = Math.asin(clamp(m.sunDir.y, -1, 1));
    const baseAz = Math.atan2(m.sunDir.x, m.sunDir.z);
    const el = clamp(baseEl + T.sunEl, -0.12, 1.45);
    const az = baseAz + T.sunAz;
    this.lightDir
      .set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
      .normalize();

    // ---------- effective colors = mood colors, optionally pulled toward custom picks
    const e = this.eff;
    e.top.copy(m.top);
    e.mid.copy(m.mid);
    e.hor.copy(m.hor);
    e.low.copy(m.low);
    e.sunTint.copy(m.sunTint);
    e.sunColor.copy(m.sunColor);
    e.hemiSky.copy(m.hemiSky);
    e.hemiGround.copy(m.hemiGround);
    e.fog.copy(m.fog);
    if (T.customColors) {
      const k = clamp(T.colorMix, 0, 1);
      const cc = this.cc;
      e.sunColor.lerp(cc.set(T.sunC), k);
      e.sunTint.lerp(cc.set(T.sunC).lerp(this.white, 0.35), k);
      e.hemiSky.lerp(cc.set(T.ambientC), k);
      e.hemiGround.lerp(cc.set(T.bounceC), k);
      e.top.lerp(cc.set(T.skyTopC), k);
      e.mid.lerp(cc.set(T.skyTopC).lerp(this.tmpC.set(T.skyHorC), 0.55), k);
      e.hor.lerp(cc.set(T.skyHorC), k);
      e.low.lerp(cc.set(T.skyHorC).multiplyScalar(0.85), k);
      e.fog.lerp(cc.set(T.fogC), k);
    }

    // ---------- sky dome
    this.sky.apply(e.top, e.mid, e.hor, e.low, e.sunTint, m.glow * T.skyGlow, m.stars, this.lightDir);
    // ---------- aurora: warna tirai menyesuaikan palet langit yang sedang aktif
    this.aurora.applyMood(e.top, e.hor, m.stars, m.glow, T.aurora);
    // ---------- vista: pegunungan jauh menyatu dengan warna langit & kabut
    this.vista.apply(e.top, e.mid, e.hor, this.fog.color);

    // ---------- atmosphere (advanced fog)
    if (T.fogCustom) e.fog.set(T.fogC);
    this.fog.color.copy(e.fog).lerp(e.sunTint, clamp(0.15 * T.fogTint, 0, 0.9));
    this.fog.density = m.fogDensity * T.haze;
    // valley mist sits in the lower mountain gorge beneath the rider
    const baseTarget = this.groundY - 14;
    if (!this.fogBaseInit) {
      this.fogBase = baseTarget;
      this.fogBaseInit = true;
    }
    // follows rapidly to keep pace with the steep 0.48 downhill descent
    this.fogBase += (baseTarget - this.fogBase) * 0.12;
    FOG_U.uFogStart.value = T.fogStart;
    FOG_U.uFogHeightAmt.value = T.fogHeight;
    FOG_U.uFogFalloff.value = 1 / Math.max(1, T.fogLayer);
    FOG_U.uFogBase.value = this.fogBase;
    FOG_U.uFogScatter.value = T.fogScatter * (0.55 + 0.45 * m.glow);
    FOG_U.uFogSunDir.value.copy(this.lightDir);
    FOG_U.uFogSunColor.value.copy(e.sunTint).lerp(e.sunColor, 0.4);
    FOG_U.uFogClear.value = 1 - clamp(T.fogMax, 0, 1);
    this.sky.setFog(this.fog.color, T.fogSky);

    // ---------- 1. KEY light (the sun)
    this.sun.color.copy(e.sunColor);
    this.sun.intensity = m.sunIntensity * T.sunlight;
    this.sun.position.copy(this.lightDir).multiplyScalar(300);

    // ---------- 2. AMBIENT: sky dome from above
    this.hemi.color.copy(e.hemiSky);
    this.hemi.groundColor.copy(e.hemiGround).multiplyScalar(0.6 + 0.4 * T.bounce);
    this.hemi.intensity = m.hemiIntensity * T.ambient;
    this.ambient.color.copy(e.hemiSky).lerp(e.sunTint, 0.35);
    this.ambient.intensity = 0.16 * T.ambient;

    // ---------- 3. BOUNCE: warm light reflected up off the sunlit sand (capped on rider)
    this.bounceLight.color.copy(e.hemiGround).lerp(e.sunColor, 0.3);
    const rawBounce = 0.55 * T.bounce * (0.35 + 0.65 * Math.max(0, this.lightDir.y) * 1.6) * (0.4 + 0.6 * T.sunlight) * T.terrainLight;
    this.bounceLight.intensity = Math.min(0.32, rawBounce * 0.5);
    this.bounceLight.position.set(this.lightDir.x * 0.25, -1, this.lightDir.z * 0.25);

    // ---------- 4. FILL: cool light into the shadow side
    this.fill.color.copy(m.fillColor);
    if (T.customColors) this.fill.color.lerp(this.cc.set(T.ambientC), clamp(T.colorMix, 0, 1) * 0.6);
    this.fill.intensity = m.fillIntensity * T.fill;
    this.fill.position.set(-this.lightDir.x, 0.35, -this.lightDir.z);

    // ---------- 5. RIM: edge light from behind, opposite the sun
    this.rim.color.copy(e.sunTint).lerp(e.sunColor, 0.5);
    this.rim.intensity = 0.9 * T.rim * (0.5 + T.sunlight * 0.5);
    this.rim.position.set(-this.lightDir.x * 0.6, 0.5, -this.lightDir.z * 0.6);

    // ---------- the sand itself
    (this.terrain.mesh.material as THREE.MeshStandardMaterial).color
      .copy(m.terrainTint)
      .multiplyScalar(T.terrainLight);

    this.clouds.setTint(e.sunTint, 0.5 + m.glow * T.skyGlow * 0.35);

    // ---------- post
    this.renderer.toneMappingExposure = m.exposure * T.exposure;
    // bloom threshold: higher => only the truly brightest pixels glow (no glare on sand)
    this.bloomPass.threshold = clamp(m.bloomThreshold + T.bloomThreshold + 0.15, 0.45, 1.8);
    this.bloomPass.radius = clamp(m.bloomRadius * T.bloomRadius, 0, 1.5);
    this.grade.set(
      T.contrast,
      T.saturation,
      T.warmth,
      T.tint,
      T.lift,
      T.gain,
      T.vignette,
      T.grain,
      T.highlights,
    );
    this.grade.tick(this.time);
  }

  // ------------------------------------------------------------------- loop
  private loop = (tms: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const now = tms / 1000;
    let dt = now - this.last;
    this.last = now;
    if (dt <= 0) return;
    if (dt > 0.05) dt = 0.05;
    this.time += dt;

    // ---- mood cross-fade (+ continuous automatic time-of-day cycle)
    if (this.tune.cycle) {
      const n = PALETTES.length;
      this.cycleT += dt / 42;
      if (this.cycleT >= n) this.cycleT -= n;
      const i = Math.floor(this.cycleT) % n;
      const j = (i + 1) % n;
      this.mood.set(blendPalettes(PALETTES[i], PALETTES[j], this.cycleT - Math.floor(this.cycleT)));
    }
    this.mood.update(1 - Math.exp(-dt * 1.6));
    this.applyMood();
    {
      const e = this.eff;
      this.sandC.copy(this.mood.terrainTint).multiplyScalar(this.tune.terrainLight);
      const tex = this.crystalEnv.update(
        dt,
        e.top,
        e.mid,
        e.hor,
        e.low,
        e.sunTint,
        this.mood.glow * this.tune.skyGlow,
        this.mood.stars,
        this.lightDir,
        this.sandC,
      );
      if (tex) {
        this.rider.setEnv(tex);
        this.rivalBots.setEnv(tex);
      }
      // ---- character colour (crystal skin + metal accents + sword skin)
      const T = this.tune;
      const key = `${T.crystalCustom ? T.crystalC : Math.round(T.crystalSkin)}|${Math.round(T.accentMetal)}|${Math.round(T.swordSkin)}`;
      if (key !== this.crystalKey) {
        this.crystalKey = key;
        const skin = T.crystalCustom
          ? customSkin(T.crystalC)
          : CRYSTAL_SKINS[((Math.round(T.crystalSkin) % CRYSTAL_SKINS.length) + CRYSTAL_SKINS.length) % CRYSTAL_SKINS.length];
        applyCrystalSkin(this.rider.crystal, this.rider.crystalU, skin);
        const metal = ACCENT_METALS[Math.round(T.accentMetal) % ACCENT_METALS.length];
        this.rider.gold.color.set(metal.color);
        this.rider.gold.emissive.set(metal.emissive);
        // ---- skin pedang-skate (0 = Silver Surfer: krom reflektif penuh)
        const ss = Math.round(T.swordSkin) % SWORD_SKINS.length;
        if (ss === 0) {
          // papan Silver Surfer: krom murni — pantulan langit dari env map PMREM
          const st = this.rider.steel;
          st.color.set(0xffffff);
          st.metalness = 1;
          st.roughness = 0.07;
          st.envMapIntensity = 1.8;
          st.emissive.set(0x9fb6d8);
          const gh = this.rider.goldHilt;
          gh.color.set(0xf2f7ff);
          gh.metalness = 1;
          gh.roughness = 0.13;
        } else {
          // bilah baja kebiruan + gagang emas (look asli release pertama)
          const st = this.rider.steel;
          st.color.set(0xd8e4f5);
          st.metalness = 0.92;
          st.roughness = 0.28;
          st.envMapIntensity = 0.8;
          st.emissive.set(0x285580);
          const gh = this.rider.goldHilt;
          gh.color.set(0xefca85);
          gh.metalness = 0.92;
          gh.roughness = 0.32;
        }
      }
      // ---- papan seluncur: papan surf Silver Surfer <-> pedang skate
      const bt = ((Math.round(T.boardType) % 2) + 2) % 2;
      if (bt !== this.boardCur) {
        this.boardCur = bt;
        this.rider.setBoard(bt);
      }

      // crystal sparkle respects the anti-glare controls and is reduced and capped
      this.rider.crystalU.uSpark.value = Math.min(0.25, this.tune.emissive * this.tune.glare * 0.22);
      this.rider.crystalU.uGlow.value = Math.min(0.28, 0.15 + 0.1 * Math.min(1.0, this.tune.glare));

      // pencahayaan & pendar pedang skate (dikecilkan dan disesuaikan secara proporsional)
      const swGlow = this.tune.swordGlow !== undefined ? this.tune.swordGlow : 0.22;
      const glareMul = Math.min(1.0, this.tune.glare);
      this.rider.steel.emissiveIntensity = clamp(0.12 * swGlow * this.tune.emissive * glareMul, 0, 0.35);
      this.rider.goldHilt.emissiveIntensity = clamp(0.08 * swGlow * this.tune.emissive * glareMul, 0, 0.25);
    }

    // ---- input steering (sangat responsif, nyaman, instan & tetap super smooth)
    let key = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.steerLeftHeld) key -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.steerRightHeld) key += 1;
    if (key !== 0) this.steerTarget = key;
    else if (this.pointerId !== null && this.tune.camStyle !== 1)
      this.steerTarget = clamp((this.pointerX - this.pointerStart) / 60, -1, 1);
    else this.steerTarget = 0;
    // Filter cepat 18x: belokan menggigit seketika namun transisi tetap mulus (smooth C-inf)
    this.steer += (this.steerTarget - this.steer) * (1 - Math.exp(-dt * 18 * Math.max(0.7, this.tune.turn)));

    const flowGate = this.flow > 1;
    const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    // SHIFT = boost on the ground, GRAB in the air
    this.boosting = (shift || this.boostHeld) && flowGate && this.grounded;
    // signature grab keys (Z X C V B G Y H Q), SHIFT = indy, touch = random style
    let grabKey: string | null = null;
    for (const g of GRABS) {
      if (this.keys.has(g.key)) {
        grabKey = g.id;
        break;
      }
    }
    const grabbing = !this.grounded && (shift || this.grabHeld || grabKey !== null);
    this.airInput.grabType = grabKey ?? (this.grabHeld ? this.touchGrab : 'indy');
    const front = this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.frontHeld;
    this.airInput.flip = this.grounded ? 0 : front ? -1 : this.jumpHeld && this.air.airTime > 0.16 ? 1 : 0;
    this.airInput.steer = this.steer;
    this.airInput.grab = grabbing;
    this.airJumpFlash = Math.max(0, this.airJumpFlash - dt * 2.5);

    // ---- freestyle slow-mo while rotating fast (adjustable)
    const rotating =
      !this.grounded &&
      (Math.abs(this.air.flipVel) > 2.5 || Math.abs(this.air.spinVel) > 2.5 || this.air.board.active);
    const wantSlow = rotating ? 1 - 0.45 * this.tune.slowmo : 1;
    this.timeScale += (wantSlow - this.timeScale) * (1 - Math.exp(-dt * 5));
    const sdt = dt * (this.state === 'playing' ? this.timeScale : 1);

    if (this.state === 'playing') {
      this.scanChasms();
      this.updatePlayer(sdt, dt);
      this.updateSparks(dt);
      const sp = Math.hypot(this.vel.x, this.vel.z);
      this.score += sp * dt * 1.5 * this.mult();
      this.distance += sp * dt;
      if (this.score > this.best) {
        this.best = this.score;
        safeSet('swordsea_best', String(Math.floor(this.best)));
      }
    } else {
      // ---- run over: the rider keeps falling into the abyss (camera stays at the lip)
      if (this.state === 'over') {
        this.overT += dt;
        this.vel.y -= GRAV * this.tune.gravity * dt;
        this.vel.x *= Math.exp(-dt * 0.6);
        this.vel.z *= Math.exp(-dt * 0.6);
        this.pos.addScaledVector(this.vel, dt);
        const floor = duneHeight(this.pos.x, this.pos.z) + 0.5;
        if (this.pos.y < floor) {
          this.pos.y = floor;
          this.vel.set(0, 0, 0);
        }
        this.grounded = false;
      }
      // ---- attract mode: the rider keeps cruising so the title screen is alive
      if (this.state === 'menu') {
        // cruise down the winding path, gliding over the chasms
        const lz = this.pos.z + 30;
        let dyaw = Math.atan2(pathX(lz) - this.pos.x, lz - this.pos.z) - this.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        this.yaw += dyaw * (1 - Math.exp(-dt * 0.9));
        const mx = Math.sin(this.yaw);
        const mz = Math.cos(this.yaw);
        this.vel.set(mx * 24, 0, mz * 24);
        this.pos.x += this.vel.x * dt;
        this.pos.z += this.vel.z * dt;
        this.groundY = slopeSmooth(this.pos.x, this.pos.z, surfaceRadius(this.tune.bumpFilter));
        this.pos.y = this.groundY + this.hoverH();
        this.grounded = true;
        const rate = 6 * this.tune.particles;
        this.dustAcc += rate * dt;
        while (this.dustAcc >= 1) {
          this.dustAcc -= 1;
          this.emitSand();
        }
      }
      const fx = Math.sin(this.rig.yaw);
      const fz = Math.cos(this.rig.yaw);
      this.rig.update(dt, this.grounded, this.pos.x, this.pos.z, this.pos.y, this.vel.y, this.yaw, this.spinAngle, 0, {
        rideHeight: this.tune.rideHeight,
        softness: this.tune.softness,
        bumpFilter: this.tune.bumpFilter,
        tilt: this.tune.tilt,
        tiltSmooth: this.tune.tiltSmooth,
        glide: this.tune.glide,
      });
      this.rider.animate(dt, {
        time: this.time,
        pup: this.pupBlend,
        speed: 0.35,
        steer: Math.sin(this.time * 0.22) * 0.25,
        air: false,
        flipVel: 0,
        spinVel: 0,
        boost: false,
        height: this.tune.bodyHeight,
        head: this.tune.headSize,
        sword: this.tune.swordSize,
        boardRoll: 0,
        boardYaw: 0,
        boardPitch: 0,
        boardPivotZ: 0,
        feetLift: 0,
        pose: null,
        poseW: 0,
      });
      this.rig.apply(this.rider.group, this.pos.x, this.pos.z, 0, this.grounded, { tilt: this.tune.tilt });
      for (const t of [this.trailGlow, this.trailWake, this.trailScarf, this.trailAir, this.trailSword]) t.tick(dt);
      this.rider.tail.getWorldPosition(this.t3);
      if (this.rig.clearance < this.hoverH() + 0.6) {
        this.trailGlow.push(this.t3, -fz, fx, 0.18 * this.tune.trails);
        this.trailWake.push(this.t1.set(this.pos.x, this.wakeY(), this.pos.z), -fz, fx, 0.28 * this.tune.trails);
      }
      const gh = rideHeight(this.pos.x, this.pos.z);
      this.shadow.position.set(this.pos.x, gh + 0.07, this.pos.z);
    }

    this.updateScarf(dt);
    this.updateCamera(dt);
    this.updateWhales(dt);
    this.updateWater(dt);
    this.applyGlowFx();

    this.terrain.update(this.pos.x, this.pos.z);
    this.dust.update(dt);
    this.glow.update(dt);
    this.mist.update(dt);
    this.ripples.update(dt);
    this.clouds.update(dt);
    this.motes.update(dt, this.camera.position);
    // aliran angin terasa: goresan halus lewat searah hembusan relatif
    this.windStreaks.update(dt, this.pos, this.vel, clamp((Math.hypot(this.vel.x, this.vel.z) - 16) / 68, 0, 1) * this.tune.particles);

    const sp = Math.hypot(this.vel.x, this.vel.z);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.monoliths.update(this.pos.x, this.pos.z, fx, fz, this.time);
    this.speedPads.update(this.pos.z, dt);
    this.energyCrystals.update(this.pos.z, this.time);
    this.downhillRelics.update(this.pos.z, this.time);
    this.downhillRelics.setGlow(this.tune.glare * this.tune.emissive);
    const nextGateForBots = this.downhillRelics.getNextGate(this.pos.z).gate;
    const raceInfo = this.rivalBots.update(
      dt,
      this.state,
      this.time,
      nextGateForBots,
      this.pos.z,
      sp,
      (bot, gate) => {
        this.popup(`${bot.name.toUpperCase()} MENEMBUS RELIK! ⚡`, `Gerbang #${gate.id} Tersentuh! Sinar Tetap Menyala!`, 'cyan');
        this.audio.chime(6, 0.22);
      },
      (bot, trickName) => {
        this.popup(`${bot.name.toUpperCase()}: ${trickName}! ✦`, 'Gaya Freestyle Lawan', 'cyan');
        this.audio.sparkle();
      },
    );

    if (this.state === 'playing') {
      this.rankNotifyCooldown -= dt;
      if (this.rankNotifyCooldown <= 0 && this.runT > 2.5) {
        if (raceInfo.playerRank < this.lastRaceRank) {
          // Overtook bot(s)!
          if (raceInfo.playerRank === 1) {
            this.popup('MEMIMPIN BALAPAN! 👑', 'Posisi #1 dari 7! Pertahankan garis depan!', 'gold');
          } else {
            this.popup('MENYALIP LAWAN! ✦', `Naik ke Posisi #${raceInfo.playerRank} dari 7!`, 'cyan');
          }
          this.audio.chime(6, 0.20);
          this.rankNotifyCooldown = 3.2;
        } else if (raceInfo.playerRank > this.lastRaceRank) {
          // Got overtaken!
          this.popup(`${raceInfo.leaderName.toUpperCase()} MENYALIP! ⚡`, `Posisi Turun ke #${raceInfo.playerRank} · Kejar dengan Boost & Slipstream!`, 'gold');
          this.audio.thump(0.25);
          this.rankNotifyCooldown = 4.0;
        }
      }
      this.lastRaceRank = raceInfo.playerRank;
    }

    this.biomeScenery.update(this.pos.x, this.pos.z);
    this.sky.mesh.position.copy(this.camera.position);
    this.aurora.mesh.position.copy(this.camera.position);
    this.aurora.update(this.time);
    this.vista.group.position.copy(this.camera.position);
    // clouds ride with the camera height too (the world descends forever)
    this.clouds.group.position.set(this.camera.position.x, this.camera.position.y - 40, this.camera.position.z);
    this.chasmMarkers.update(this.pos.z, this.time);

    this.audio.setSpeed(clamp(sp / 70, 0, 1), this.slipNorm, this.boosting && this.state === 'playing');

    // ---- adaptive resolution
    this.fpsAvg = mix(this.fpsAvg, 1 / dt, 0.04);
    this.frames++;
    if (this.frames % 120 === 0) {
      if (this.fpsAvg < 42 && this.resScale > 0.62) {
        this.resScale = Math.max(0.62, this.resScale - 0.16);
        this.renderer.setPixelRatio(this.basePR * this.resScale);
        this.onResize();
      } else if (this.fpsAvg > 57 && this.resScale < 1) {
        this.resScale = Math.min(1, this.resScale + 0.12);
        this.renderer.setPixelRatio(this.basePR * this.resScale);
        this.onResize();
      }
    }

    this.statTick++;
    if (this.state === 'playing') this.runT += dt;
    if (this.statTick % 4 === 0) {
      const sec = getMountainSector(this.distance);
      if (sec.name !== this.lastSectorName) {
        this.lastSectorName = sec.name;
        if (this.distance > 50) {
          this.popup(sec.name, sec.subtitle, 'gold');
        }
      }
      if (this.shieldCooldown > 0) this.shieldCooldown -= dt;

      const nextGate = this.downhillRelics.getNextGate(this.pos.z);
      let relicBearing = 0;
      if (nextGate.gate) {
        const gdx = nextGate.gate.x - this.pos.x;
        const gdz = nextGate.gate.z - this.pos.z;
        const rfx = Math.sin(this.rig.yaw);
        const rfz = Math.cos(this.rig.yaw);
        relicBearing = Math.atan2(gdx * -rfz + gdz * rfx, gdx * rfx + gdz * rfz);
      }

      this.hooks.onStats({
        score: this.score,
        best: this.best,
        combo: this.combo,
        mult: this.mult(),
        speed: sp,
        flow: this.flow,
        airborne: !this.grounded,
        distance: this.distance,
        state: this.state,
        trick: this.trickLabel,
        airTime: this.airTime,
        palette: this.mood.name,
        clearance: this.rig.clearance,
        flipDeg: (this.air.flip * 180) / Math.PI,
        spinDeg: (this.air.spin * 180) / Math.PI,
        landState: this.grounded ? 'none' : this.air.landState(this.tune.landWindow),
        timeToLand: this.grounded ? 9 : this.timeToLand,
        airJumpsLeft: this.air.airJumpsLeft,
        airJumpsMax: Math.round(this.tune.airJumps),
        chain: this.air.chain,
        chainPoints: this.air.chainPoints,
        chainTime: Math.max(0, this.air.chainTimer / 2.8),
        airFlash: this.airJumpFlash,
        autoOn: !this.grounded && this.air.autoActive,
        plan: this.grounded ? 'none' : this.air.plan,
        navOn: this.navFall !== null && this.navDist > 12,
        navDist: this.navDist,
        navBearing: this.navBearing,
        navDrop: this.navFall ? this.navFall.drop : 0,
        onWater: this.onWater,
        beamOn: this.state === 'playing' && this.beamDist > 15,
        beamDist: this.beamDist,
        beamBearing: this.beamBearing,
        gapOn: this.gapOn,
        gapDist: this.gapDist,
        gapW: this.gapW,
        jumpNow: this.gapOn && this.grounded && this.gapDist < Math.max(16, sp * 0.55),
        bestDist: this.bestDist,
        overReason: this.overReason,
        shield: this.shield,
        maxShield: this.maxShield,
        sectorName: sec.name,
        sectorSubtitle: sec.subtitle,
        altitudeDrop: Math.max(0, -this.pos.y),
        crystalsCollected: this.crystalsCollected,
        camStyle: clamp(Math.round(this.tune.camStyle), 0, 3),
        runTime: this.runT,
        relicGateOn: nextGate.gate !== null && nextGate.dist > 5 && nextGate.dist < 1600,
        relicGateIndex: nextGate.gate ? nextGate.gate.id : 0,
        relicGateDist: nextGate.dist,
        relicGateBearing: relicBearing,
        relicStreak: this.downhillRelics.streak,
        relicsPassed: this.downhillRelics.totalPassed,
        relicsMissed: this.downhillRelics.totalMissed,
        boosting: this.boosting,
        raceRank: raceInfo.playerRank,
        raceTotal: 7,
        botLeaderName: raceInfo.leaderName,
        botLeaderDist: raceInfo.leaderDist,
        jumpStyle: this.tune.jumpStyle,
      });
    }

    this.composer.render();
  };

  private slipNorm = 0;

  // ------------------------------------------------------------ chasms
  /**
   * Called right after the horizontal move, BEFORE the hover cushion runs:
   *  - crossing the far lip below its edge  -> you hit the cliff wall
   *  - sinking deep inside a chasm          -> you fell
   *  - crossing the far lip above its edge  -> cleared!
   * Returns true when the run ended.
   */
  private checkChasm(prevZ: number): boolean {
    const p = this.pos;
    const cPrev = chasmAt(prevZ, this.chA);
    if (cPrev && prevZ > cPrev.z0 && prevZ < cPrev.z1) {
      const z1 = cPrev.z1;
      const z0 = cPrev.z0;
      const id = cPrev.id;
      const farLip = slopeSmooth(p.x, z1 + 0.5, 3);
      if (p.z >= z1) {
        if (p.y < farLip + 0.15) {
          this.endRun('wall');
          return true;
        }
        if (id !== this.lastCleared) {
          this.lastCleared = id;
          const pts = Math.round((180 + cPrev.w * 14) * this.mult());
          this.score += pts;
          this.combo += 2;
          this.flow = clamp(this.flow + 10, 0, 100);
          this.popup('JURANG ✓', `${Math.round(cPrev.w)} m · +${pts}`, 'gold');
          this.audio.chime(7, 0.18);
        }
        return false;
      }
      if (p.z <= z0 && p.y < slopeSmooth(p.x, z0 - 0.5, 3) + 0.15) {
        this.endRun('wall');
        return true;
      }
      if (p.y < farLip - 14) {
        this.endRun('fall');
        return true;
      }
    }
    return false;
  }

  /** run over: fall into the abyss (or slam the wall), then show the results */
  private endRun(reason: 'fall' | 'wall') {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.overReason = reason;
    this.overT = 0;
    this.timeScale = 1;
    this.gapOn = false;
    if (reason === 'wall') {
      this.vel.x *= 0.08;
      this.vel.z *= 0.08;
      this.vel.y = Math.min(this.vel.y, -2);
      this.shake = 1.4;
      this.audio.thump(1);
      this.emitDust(this.pos, Math.round(40 * this.tune.particles), 8);
    } else {
      this.audio.whoosh(1.4);
      this.shake = 0.5;
    }
    if (this.distance > this.bestDist) {
      this.bestDist = this.distance;
      safeSet('swordsea_bestdist', String(Math.floor(this.bestDist)));
    }
    this.grounded = false;
    this.hooks.onState(this.state);
  }

  /** scan the path ahead: HUD warning + a guiding arc of sparks over each chasm */
  private scanChasms() {
    this.gapOn = false;
    const n0 = Math.floor((this.pos.z - 30) / RUN.L);
    for (let n = n0; n <= n0 + 3; n++) {
      const c = chasmOfSeg(n, this.chA);
      if (!c) continue;
      // decorate: sparks along a jump arc over the gap
      if (!this.decorated.has(c.id) && c.z0 - this.pos.z < 360 && c.z1 > this.pos.z) {
        this.decorated.add(c.id);
        const lip = baseDune(pathX(c.z0), c.z0 - 1);
        const peak = 3.2 + c.w * 0.14;
        for (let i = 0; i < 7; i++) {
          const slot = this.sparks.find((s) => !s.active);
          if (!slot) break;
          const t = i / 6;
          const z = c.z0 - 5 + (c.w + 10) * t;
          slot.x = pathX(z);
          slot.z = z;
          slot.y = lip - RUN.SLOPE * (z - c.z0) + 2 + 4 * t * (1 - t) * peak;
          slot.active = true;
          slot.phase = Math.random() * 9;
        }
      }
      if (!this.gapOn && c.z1 > this.pos.z) {
        const d = c.z0 - this.pos.z;
        if (d < 240) {
          this.gapOn = true;
          this.gapDist = Math.max(0, d);
          this.gapW = c.w;
        }
      }
    }
  }

  // ------------------------------------------------------------ scarf/slayer
  private scarfBack = new THREE.Vector3();
  private scarfAnchor = new THREE.Vector3();
  private scarfLat = new THREE.Vector3();

  private updateScarf(dt: number) {
    const T = this.tune;
    if (T.scarfColor !== this.scarfColorIdx) {
      this.scarfColorIdx = T.scarfColor;
      const hex = SCARF_COLORS[T.scarfColor % SCARF_COLORS.length].hex;
      this.scarfA.setColor(hex);
      this.scarfB.setColor(hex);
      this.scarfFront.setColor(hex);
    }
    // ---- skin: cloth or ethereal (with palette)
    const skinKey = Math.round(T.scarfSkin) * 100 + Math.round(T.scarfEthereal);
    if (skinKey !== this.scarfSkinKey) {
      this.scarfSkinKey = skinKey;
      const eth = Math.round(T.scarfSkin) === 1;
      this.scarfA.setSkin(eth, Math.round(T.scarfEthereal));
      this.scarfB.setSkin(eth, Math.round(T.scarfEthereal));
      this.scarfFront.setSkin(eth, Math.round(T.scarfEthereal));
    }
    // ---- kerah slayer melingkar di leher: warna/tampilan mengikuti mode
    {
      const skin = Math.round(T.scarfSkin);
      const hex = SCARF_COLORS[T.scarfColor % SCARF_COLORS.length].hex;
      if (skin === 1) {
        const pal = ETHEREAL_SKINS[Math.round(T.scarfEthereal) % ETHEREAL_SKINS.length];
        this.rider.setScarfLook(2, pal.core);
      } else if (T.scarfEmbroidery) {
        this.rider.setScarfLook(1, hex);
      } else {
        this.rider.setScarfLook(0, hex);
      }
    }

    // Character scarf glow reduced and clamped
    const safeScarfGlow = Math.min(0.28, T.glowFx * T.glare * 0.3);
    this.scarfA.setGlow(safeScarfGlow);
    this.scarfB.setGlow(safeScarfGlow);
    const fx = Math.sin(this.rig.yaw);
    const fz = Math.cos(this.rig.yaw);
    this.scarfBack.set(-fx, 0, -fz);
    this.scarfLat.set(fz, 0, -fx);
    this.rider.neck.getWorldPosition(this.scarfAnchor);
    // ekor panjang keluar dari BAWAH lilitan belakang: sedikit di dalam
    // permukaan torus (luar ≈ 0,087 m) → akar pita melebur dari balik kain
    this.scarfAnchor.y += 0.036;
    this.scarfAnchor.addScaledVector(this.scarfBack, 0.078);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const opts = { length: T.scarfLength, width: T.scarfWidth, flutter: T.scarfFlutter };

    const off = T.scarfTwin ? 0.1 : 0;
    this.t1.copy(this.scarfAnchor).addScaledVector(this.scarfLat, off);
    this.scarfA.update(dt, this.t1, this.scarfBack, speed, this.time, opts, this.vel);
    this.scarfB.setVisible(T.scarfTwin);
    if (T.scarfTwin) {
      this.t1.copy(this.scarfAnchor).addScaledVector(this.scarfLat, -off);
      this.scarfB.update(dt, this.t1, this.scarfBack, speed, this.time, {
        ...opts,
        length: opts.length * 0.82,
        width: opts.width * 0.9,
      }, this.vel);
    }

    // ---- UJUNG PENDEK SYAL di depan dada: keluar dari bawah lilitan depan
    // (lidah kain tertekan ke dada saat ngebut, berkibar saat pelan).
    this.rider.neck.getWorldPosition(this.t1);
    this.t1.y += 0.02;
    this.t1.addScaledVector(this.scarfBack, -0.072); // permukaan depan lilitan
    this.t2.set(-this.scarfBack.x * 0.6, -1, -this.scarfBack.z * 0.6).normalize();
    this.scarfFront.update(dt, this.t1, this.t2, speed, this.time, {
      length: 0.3 + T.scarfLength * 0.05,
      width: 0.046 + T.scarfWidth * 0.7,
      flutter: 0.75,
    }, this.vel);

    // ---- bentuk SLUGPUP: morph tubuh (a.pup) + ekor tebal dari pangkal
    // punggung. Aktif otomatis saat skin karakter = Slugpup (Rain World).
    {
      const idx = ((Math.round(T.crystalSkin) % CRYSTAL_SKINS.length) + CRYSTAL_SKINS.length) % CRYSTAL_SKINS.length;
      this.pupOn = !T.crystalCustom && /slugpup/i.test(CRYSTAL_SKINS[idx].name);
      this.pupBlend += ((this.pupOn ? 1 : 0) - this.pupBlend) * (1 - Math.exp(-dt * 6));
      this.scarfTail.setVisible(this.pupBlend > 0.03);
      if (this.scarfTail.mesh.visible) {
        this.rider.tailBone.getWorldPosition(this.t1);
        // ekor slugcat: tebal di pangkal, meruncing — panjang ikut slider slayer
        this.scarfTail.update(dt, this.t1, this.scarfBack, speed, this.time, {
          length: 2.1 + T.scarfLength * 0.22,
          width: 0.3 + T.scarfWidth * 0.15,
          flutter: 0.6,
        }, this.vel);
      }
    }

    // ---- SULAMAN EMAS ala Journey di SLAYER: diamond & chevron emas
    // berdenyut, makin gemilang saat energi FLOW penuh (ala scarf power).
    // Hanya untuk skin kain; ethereal punya gaya cahayanya sendiri.
    const emb = T.scarfEmbroidery && Math.round(T.scarfSkin) === 0;
    const embGlow = T.scarfEmbroideryGlow * (0.35 + 0.65 * clamp(this.flow / 100, 0, 1));
    this.scarfA.setEmbroidery(emb);
    this.scarfB.setEmbroidery(emb);
    this.scarfFront.setEmbroidery(emb);
    this.scarfA.setGoldGlow(embGlow);
    this.scarfB.setGoldGlow(embGlow);
    this.scarfFront.setGoldGlow(embGlow);

    // ---- ethereal: motes of light drift off the veil
    if (this.scarfA.ethereal && T.particles > 0.01) {
      const pal = ETHEREAL_SKINS[Math.round(T.scarfEthereal) % ETHEREAL_SKINS.length];
      this.sparkCol.set(Math.random() < 0.5 ? pal.edge : pal.hi);
      this.scarfSparkAcc += dt * 26 * T.particles * Math.min(1.2, T.glare + 0.2);
      while (this.scarfSparkAcc >= 1) {
        this.scarfSparkAcc -= 1;
        const src = T.scarfTwin && Math.random() < 0.4 ? this.scarfB : this.scarfA;
        src.pointAt(0.25 + Math.random() * 0.75, this.t2);
        this.glow.spawn(
          this.t2.x,
          this.t2.y,
          this.t2.z,
          (Math.random() - 0.5) * 1.6 - this.vel.x * 0.05,
          0.4 + Math.random() * 1.2,
          (Math.random() - 0.5) * 1.6 - this.vel.z * 0.05,
          0.16 + Math.random() * 0.2,
          0.6 + Math.random() * 0.6,
          this.sparkCol.r,
          this.sparkCol.g,
          this.sparkCol.b,
          0.75,
          0.4,
          1.2,
        );
      }
    }
  }

  // ---------------------------------------------------------------- whales
  private whaleRim = new THREE.Color();
  private whaleHaze = new THREE.Color();

  private updateWhales(dt: number) {
    const T = this.tune;
    // whales fade into the SAME (possibly custom) fog color as the world
    this.whaleHaze.copy(this.fog.color).lerp(this.eff.mid, 0.25);
    this.whaleRim.copy(this.eff.sunTint).multiplyScalar(0.55 + T.rim * 0.3);
    this.whales.update(
      dt,
      this.time,
      this.pos,
      this.rig.yaw,
      {
        count: Math.round(T.whales),
        size: T.whaleSize,
        height: T.whaleHeight,
        speed: T.whaleSpeed,
        glow: T.whaleGlow,
        haze: T.whaleHaze * T.haze,
      },
      this.whaleHaze,
      this.whaleRim,
      this.camera.position,
    );
    // manta rays gliding in formation
    this.mantas.update(
      dt,
      this.time,
      this.pos,
      this.rig.yaw,
      {
        count: T.mantas,
        size: T.mantaSize,
        height: T.mantaHeight,
        speed: T.mantaSpeed,
        formation: Math.round(T.mantaFormation),
        glow: T.whaleGlow,
        haze: T.whaleHaze * T.haze,
      },
      this.whaleHaze,
      this.whaleRim,
      this.camera.position,
    );
    // flying fish leaping out of the dunes beside the rider
    this.flyers.update(
      dt,
      this.time,
      this.pos,
      Math.sin(this.rig.yaw),
      Math.cos(this.rig.yaw),
      Math.hypot(this.vel.x, this.vel.z),
      { rate: T.flyingFish, size: T.flyingFishSize, glow: T.fishGlow * T.emissive * T.glare },
      (x, z) => this.surfaceY(x, z),
      (x, y, z, s) => this.fishSplash(x, y, z, s),
      (x, y, z) => this.fishSparkle(x, y, z),
      this.whaleHaze,
      Math.min(0.35, 0.07 * T.haze),
    );
    // schools of little fish escorting every whale
    this.fish.update(
      dt,
      this.time,
      this.whales,
      {
        count: T.fishCount,
        size: T.fishSize,
        glow: T.fishGlow * T.emissive * T.glare,
      },
      this.whaleHaze,
      Math.min(0.6, 0.22 * T.whaleHaze * T.haze),
    );
    if (T.whaleSong && T.whales >= 1 && this.state !== 'paused') {
      this.songTimer -= dt;
      if (this.songTimer <= 0) {
        this.audio.whaleSong();
        this.songTimer = 18 + Math.random() * 20;
      }
    }
  }

  /** a little puff of sand where a flying fish breaks the surface */
  /** height the wake ribbon is drawn at: on the water surface or on the sand */
  private wakeY() {
    return this.onWater ? this.waterY + 0.06 : this.groundY + 0.09;
  }

  // ----------------------------------------------------------------- water
  private updateWater(dt: number) {
    const T = this.tune;
    const e = this.eff;
    this.skyRefl.copy(e.hor).lerp(e.mid, 0.5);
    this.skyReflHi.copy(e.top).lerp(e.mid, 0.3);
    if (RIVERS_ON) this.river.update(
      this.time,
      this.pos,
      this.camera,
      {
        palette: T.waterPalette,
        flow: T.waterFlow,
        glint: T.waterGlint,
        foam: T.waterFoam,
        clarity: T.waterClarity,
        rainbow: T.waterRainbow,
      },
      this.skyRefl,
      this.skyReflHi,
      this.lightDir,
      e.sunTint,
      T.glare,
    );

    // ---- is the rider skimming the water?
    const wl = waterLevel(this.pos.x, this.pos.z);
    this.onWater = wl > NO_WATER && this.pos.y - wl < this.hoverH() + 1.6;
    if (this.onWater) this.waterY = wl;
    if (this.onWater && !this.wasOnWater && this.state === 'playing') {
      // entering the water: splash!
      this.waterSplash(Math.min(1.2, 0.4 + Math.hypot(this.vel.x, this.vel.z) / 80));
    }
    this.wasOnWater = this.onWater;

    // ---- waterfalls: mist, spray, roar
    let roar = 0;
    const mistK = T.waterMist * Math.max(0.2, T.particles);
    for (const f of this.river.falls) {
      const dx = f.landX - this.pos.x;
      const dz = f.landZ - this.pos.z;
      const dist = Math.hypot(dx, dz);
      roar = Math.max(roar, (1 - smoothstep(20, 170, dist)) * Math.min(1, f.drop / 9));
      if (dist > 240 || mistK <= 0.01) continue;
      // rising mist clouds at the plunge pool
      this.mistAcc += dt * (4 + f.drop * 1.6) * mistK;
      while (this.mistAcc >= 1) {
        this.mistAcc -= 1;
        const sx = (Math.random() - 0.5) * f.hw * 1.8;
        // soft, smaller puffs: many small ones read as mist, a few huge ones read as sheets
        this.mist.spawn(
          f.landX + sx,
          f.bottom + 0.3 + Math.random() * 1.5,
          f.landZ + (Math.random() - 0.2) * 6,
          (Math.random() - 0.5) * 2,
          0.8 + Math.random() * 1.8 + f.drop * 0.08,
          1 + Math.random() * 2.6,
          1.1 + Math.random() * 1.5 + f.drop * 0.05,
          1.8 + Math.random() * 1.8,
          0.96,
          0.99,
          1,
          0.2,
          0.35,
          0.5,
        );
      }
      // bright droplets thrown off the lip
      this.sprayAcc += dt * (6 + f.drop) * mistK;
      while (this.sprayAcc >= 1) {
        this.sprayAcc -= 1;
        const sx = (Math.random() - 0.5) * f.hw * 1.9;
        this.glow.spawn(
          f.lipX + sx,
          f.top - 0.2,
          f.lipZ + Math.random() * 1.5,
          (Math.random() - 0.5) * 1.2,
          0.5 + Math.random() * 1.5,
          2.5 + Math.random() * 2.5,
          0.14 + Math.random() * 0.14,
          0.7 + Math.random() * 0.5,
          0.85,
          0.95,
          1,
          0.55,
          -16,
          0.3,
        );
      }
    }
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.audio.setWater(roar, this.onWater ? 0.55 + Math.min(0.45, speed / 90) : 0);

    // ---- WATERFALL DROP: riding over a lip launches you into the air
    if (this.state === 'playing') {
      for (const f of this.river.falls) {
        if (this.prevWZ < f.lipZ && this.pos.z >= f.lipZ && Math.abs(this.pos.x - f.lipX) < f.hw + 4) {
          const fromWater = this.pos.y - f.top < this.hoverH() + 3;
          if (fromWater) {
            this.vel.y = Math.max(this.vel.y, 4 + speed * 0.12);
            if (this.grounded) {
              this.grounded = false;
              this.airTime = 0;
              this.jumpedThisAir = false; // a jump press right now still counts as a full jump
              this.air.takeoff(this.airTune());
            }
            this.popup('AIR TERJUN', `${Math.round(f.drop)} m · tekan space untuk terbang lebih tinggi`, 'cyan');
            this.audio.whoosh(1.2);
            this.audio.splash(0.8);
            this.score += Math.round(40 * f.drop * this.mult());
          }
        }
      }
    }
    this.prevWZ = this.pos.z;

    // ---- navigation: point the way to the next waterfall
    this.navTimer -= dt;
    if (this.navTimer <= 0) {
      this.navTimer = 0.25;
      const nf = nextWaterfall(this.pos.z - 25, 0, 4);
      this.navFall = nf;
    }
    if (this.navFall) {
      const f = this.navFall;
      const dx = f.lipX - this.pos.x;
      const dz = f.lipZ - this.pos.z;
      this.navDist = Math.hypot(dx, dz);
      const fx = Math.sin(this.rig.yaw);
      const fz = Math.cos(this.rig.yaw);
      // screen-right is (-fz, fx) in this world
      this.navBearing = Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz);
    }

    // ---- sinar putih: animasi pilar + panduan arah + deteksi tercapai
    this.updateBeam(dt);

    // ---- wake colour follows the surface (blends seamlessly with current sand tint)
    if (!this.onWater) {
      this.wakeSand.copy(this.mood.terrainTint).lerp(new THREE.Color(0x302520), 0.22);
    }
    this.trailWake.setColor(this.onWater ? this.wakeWater : this.wakeSand);
  }

  /** big splash + ripple ring on the water surface */
  private waterSplash(strength: number) {
    const y = this.waterY + 0.1;
    for (let i = 0; i < Math.round(26 * strength * this.tune.particles); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random();
      this.dust.spawn(
        this.pos.x + Math.cos(a) * r,
        y,
        this.pos.z + Math.sin(a) * r,
        Math.cos(a) * (2 + r * 5) * strength,
        3 + Math.random() * 6 * strength,
        Math.sin(a) * (2 + r * 5) * strength,
        0.35 + Math.random() * 0.6,
        0.6 + Math.random() * 0.6,
        0.88,
        0.97,
        1,
        0.6,
        -14,
        1.4,
      );
    }
    this.nrm.set(0, 1, 0);
    this.ripples.spawn(this.t1.set(this.pos.x, y, this.pos.z), this.nrm, 5 + strength * 5, 1.2, 0xe8fbff);
    this.audio.splash(strength);
  }

  private fishSplash(x: number, y: number, z: number, s: number) {
    const wl = waterLevel(x, z);
    if (wl > NO_WATER) {
      // flying fish breaking the river surface: white droplets
      for (let i = 0; i < Math.round(6 * s * this.tune.particles); i++) {
        this.dust.spawn(
          x + (Math.random() - 0.5),
          wl + 0.1,
          z + (Math.random() - 0.5),
          (Math.random() - 0.5) * 3,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 3,
          0.25 + Math.random() * 0.3,
          0.5 + Math.random() * 0.4,
          0.88,
          0.97,
          1,
          0.55,
          -12,
          1.2,
        );
      }
      return;
    }
    this.splashV.set(x, y, z);
    this.emitDust(this.splashV, Math.max(1, Math.round(5 * s * this.tune.particles)), 3.2 * s);
  }

  /** shimmering glint trail behind gliding flying fish */
  private fishSparkle(x: number, y: number, z: number) {
    if (this.tune.particles <= 0.01) return;
    this.glow.spawn(
      x,
      y,
      z,
      (Math.random() - 0.5) * 0.8,
      0.3 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.8,
      0.22 + Math.random() * 0.18,
      0.45 + Math.random() * 0.3,
      0.75,
      0.93,
      1,
      0.55,
      -1,
      2,
    );
  }

  /** anti-glare: additive light sources, with character & blade emissions reduced by 70% */
  private applyGlowFx() {
    const T = this.tune;
    const glare = T.glare;
    const g = T.glowFx * glare * 0.3;
    // additive particles, trails
    this.glow.setIntensity(g);
    this.trailGlow.mul = g;
    this.trailAir.mul = g;
    // Character scarf trail capped and reduced by 70%
    this.trailScarf.mul = Math.min(0.08, (T.scarfGlow ? g : 0) * 0.1);
    // Ekor pedang putih: putih bersih, sedikit dibaur warna kabut mood (non-additif = bebas silau)
    this.trailSword.setColor(this.cc.set(0xf6faff).lerp(this.eff.fog, 0.2));
    // ground ripples + floating motes
    this.ripples.mul = Math.min(0.6, (0.2 + 0.35 * glare) * 0.4);
    this.motes.setIntensity(T.motes * glare * 0.3);
    // emissive objects: sword blade reduced by 70% so it doesn't blow out character, while monoliths/sky scale freely
    const em = T.emissive * glare;
    (this.sparkMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(0.3, 1.2 * em * 0.3);
    (this.rider.blade.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(0.05, 0.18 * em * 0.3);
    this.monoliths.setGlow(em);
    // chasm-edge crystals stay readable even on anti-glare settings
    this.chasmMarkers.setGlow(0.35 + 0.45 * em);
    // sun disc in the sky
    this.sky.setDisc(T.sunDisc * glare);
  }

  // ----------------------------------------------------------------- player
  private lastGroundVy = 0;
  private timeToLand = 9;
  private jumpedThisAir = false;
  private jumpBuffer = 0;
  private prevGround = 0;
  private prevGroundInit = false;
  private groundVy = 0;
  /** smoothed ground height under the rider (the physics hovers ABOVE this) */
  private groundY = 0;

  /** hover height above the smoothed surface */
  private hoverH() {
    return Math.max(0.3, this.tune.rideHeight);
  }

  /** the smoothed surface everything rides on */
  private surfaceY(x: number, z: number): number {
    return smoothHeight(x, z, surfaceRadius(this.tune.bumpFilter));
  }

  private updatePlayer(dt: number, rawDt: number) {
    const p = this.pos;
    const v = this.vel;
    const speed = Math.hypot(v.x, v.z);
    const T = this.tune;

    // ---- heading & turning responsiveness
    // Belok responsif, lincah, tapi tetap mulus & mantap di semua kecepatan
    const turnRate = (3.4 / (1 + speed * 0.0055)) * T.turn * (this.grounded ? 1 : clamp(T.airTurn, 0.35, 1.4));
    this.yaw += -this.steer * turnRate * dt;

    // AUTO-NGEPAS ARAH JALAN YANG BENAR SAAT MAU MENDARAT:
    // Setiap kali mendekati tanah (< 0.65 detik atau clearance rendah),
    // arah hadap papan seluncur (yaw) otomatis diselaraskan mulus ke arah gerak aktual (velocity vector)
    // agar skate tidak pernah terbalik (kebalik/mundur) saat mendarat di atas pasir.
    if (!this.grounded) {
      const ttl = this.timeToLand;
      if (ttl < 0.65 || (p.y - this.groundY < this.hoverH() * 2.8 && v.y <= this.groundVy + 2)) {
        const travelSpeed = Math.hypot(v.x, v.z);
        const travelYaw = travelSpeed > 1.5 ? Math.atan2(v.x, v.z) : this.yaw;
        let dyaw = travelYaw - this.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;

        const steerCarve = this.steer !== 0 ? -this.steer * 0.22 : 0;
        const targetDiff = dyaw + steerCarve;

        const urgency = clamp(1 - ttl / 0.65, 0, 1);
        const alignRate = Math.abs(dyaw) > 1.2 ? 18 + urgency * 32 : 6 + urgency * 22;
        this.yaw += targetDiff * (1 - Math.exp(-dt * alignRate));
      }
    }

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);

    // ---- slope: gravity measured on the SMOOTHED surface (no juddering from rough contours)
    const sr = surfaceRadius(T.bumpFilter);
    duneGradient(p.x, p.z, Math.max(2.5, sr * 0.6), this.grad);
    const pace = T.speed;
    let gF = 0; // slope along the heading, > 0 = uphill
    if (this.grounded) {
      gF = this.grad.x * fx + this.grad.z * fz;
      const gLx = this.grad.x - fx * gF;
      const gLz = this.grad.z - fz * gF;
      const G = 42;
      // downhill = full acceleration (fun!), uphill = heavily reduced by the climb assist
      const along = gF > 0 ? gF * (1 - clamp(T.climb, 0, 1) * 0.92) : gF;
      // sideways slope only partly pulls you, so carving along a hillside stays controllable
      v.x -= (fx * along + gLx * 0.55) * G * dt;
      v.z -= (fz * along + gLz * 0.55) * G * dt;
    }

    // ---- thrust (+ extra hill-climb thrust that grows with steepness)
    const fwdNow = v.x * fx + v.z * fz;
    const cap = (this.boosting ? 104 : 76) * pace;

    // Check slipstream drafting behind rival bots
    const draft = this.rivalBots.checkSlipstream(p);
    let draftBoost = 0;
    if (draft.active && this.grounded) {
      draftBoost = 26;
      this.flow = Math.min(100, this.flow + dt * 25);
      if (this.slipstreamTimer <= 0) {
        this.popup(`SLIPSTREAM ⚡ DI BELAKANG ${draft.botName.toUpperCase()}!`, 'Dorongan Angin Kencang · Salip Sekarang!', 'cyan');
        this.audio.whoosh(1.25);
        this.slipstreamTimer = 3.2;
      }
    }
    if (this.slipstreamTimer > 0) this.slipstreamTimer -= dt;

    let thrust = ((this.boosting ? 44 : 20) + draftBoost) * pace * (this.grounded ? 1 : 0.1);
    if (this.grounded && gF > 0) thrust += gF * 20 * clamp(T.climb, 0, 1) * pace;
    if (fwdNow < cap) {
      v.x += fx * thrust * dt;
      v.z += fz * thrust * dt;
    }

    // ---- never stall: grounded speed never drops below the minimum, even on walls
    if (this.grounded) {
      const floorSpeed = T.minSpeed * pace;
      const f2 = v.x * fx + v.z * fz;
      if (f2 < floorSpeed) {
        const add = (floorSpeed - f2) * (1 - Math.exp(-dt * 3));
        v.x += fx * add;
        v.z += fz * add;
      }
    }
    const fwdSpeed = v.x * fx + v.z * fz;

    // ---- drag
    const dragK = this.grounded ? 0.3 + speed * 0.0042 : 0.04;
    const dmp = Math.exp(-dragK * dt);
    v.x *= dmp;
    v.z *= dmp;

    // ---- carve grip / slip
    const latX = v.x - fx * fwdSpeed;
    const latZ = v.z - fz * fwdSpeed;
    const slip = Math.hypot(latX, latZ);
    this.slipNorm = clamp(slip / 22, 0, 1);
    const grip = this.grounded ? (this.boosting ? 2.6 : 3.8) : 0.2;
    const gk = Math.exp(-grip * dt);
    v.x = fx * fwdSpeed + latX * gk;
    v.z = fz * fwdSpeed + latZ * gk;

    const prevZ = p.z;
    p.x += v.x * dt;
    p.z += v.z * dt;
    // chasm walls / falling: checked before the hover cushion can "rescue" us
    if (this.checkChasm(prevZ)) return;

    // =====================================================================
    // TRUE HOVER PHYSICS. The rider is never glued to the sand.
    //
    //  • Gravity ALWAYS acts. The vertical velocity is ALWAYS integrated.
    //  • Under the board is a one-sided air cushion: a spring that can only
    //    PUSH UP when the board is closer than the hover height, never pull
    //    down. That's why you can't be "magnetised" to the terrain.
    //  • Damping is relative to how fast the ground itself rises, so hills
    //    are followed smoothly, but when the sand falls away (crests) the
    //    cushion simply lets go and you fly.
    //  • A jump is just upward velocity. Nothing cancels it.
    // =====================================================================
    {
      const g = GRAV * T.gravity;
      const nh = this.surfaceY(p.x, p.z);
      // speed at which the smoothed ground under us rises (+) or falls (-)
      // a chasm edge is a DISCONTINUITY, not a real slope: ignore those jumps so the
      // cushion never slingshots the rider when crossing a lip
      const jumpEdge = Math.abs(nh - this.prevGround) > 4;
      const gvRaw =
        this.prevGroundInit && !jumpEdge ? (nh - this.prevGround) / Math.max(dt, 1e-4) : this.groundVy;
      this.prevGround = nh;
      this.prevGroundInit = true;
      this.groundVy += (clamp(gvRaw, -90, 90) - this.groundVy) * (1 - Math.exp(-dt * 18));
      this.lastGroundVy = this.groundVy;
      this.groundY = nh;

      const H = this.hoverH(); // equilibrium hover height
      const c = p.y - nh; // current clearance

      // ---- cushion spring (softness slider = how springy / floaty)
      const omega = 11 / Math.max(0.5, T.softness);
      const k = omega * omega;
      // cushion range sized so the equilibrium height always equals the ride-height slider
      const reach = H + (g / k) * 1.2;
      let ay = -g;
      if (!this.grounded) {
        // gravity shaping for Alto-style hang while tricking (firmer downward pull in low jump mode)
        const tricking = this.airInput.flip !== 0 || this.airInput.grab;
        const lowMul = this.tune.jumpStyle === 1 ? 1.5 : 1.0;
        ay = -g * this.air.gravityMul(v.y, this.airTune(), tricking) * lowMul;
      }
      if (c < reach) {
        // push up only; force grows as we get closer (feels like air pressure)
        const comp = reach - c;
        const push = k * comp * (0.6 + 0.4 * (comp / reach));
        const vRel = v.y - this.groundVy;
        // damp mostly while compressing, lightly when extending => crests launch naturally
        const damp = 2 * omega * (vRel < 0 ? 0.75 : 0.18);
        ay += push - damp * vRel;
      }
      v.y += ay * dt;
      v.y = clamp(v.y, -90, 90);
      p.y += v.y * dt;

      // ---- the board never touches the sand: minimum clearance
      const minC = Math.max(0.18, H * 0.3);
      if (p.y - nh < minC) {
        p.y = nh + minC;
        if (v.y < this.groundVy) v.y = this.groundVy;
      }
      const c2 = p.y - nh;

      // ---- state: hovering (on the cushion) or airborne (free flight)
      if (this.grounded) {
        const flyMargin = this.tune.jumpStyle === 1 ? 1.8 : 0.9;
        const vyMargin = this.tune.jumpStyle === 1 ? 0 : 2;
        if (c2 > reach + flyMargin && v.y > this.groundVy - vyMargin) {
          // flew off the cushion
          this.grounded = false;
          this.airTime = 0;
          this.jumpedThisAir = false; // a jump press right now still counts as a full jump
          this.air.takeoff(this.airTune());
        }
      } else {
        this.airTime += dt;
        // trajectory prediction over the terrain ahead (drives the smart landing)
        const ttl = this.predictTTL();
        this.timeToLand = ttl;
        // optional: every big jump performs an automatic freestyle
        if (T.autoTrick && !this.air.autoActive && this.air.airTime > 0.1 && ttl > 0.85) this.autoCombo();

        // ---- tricks: flip (hold), spin (A/D), grab (shift), with angular momentum
        this.air.update(dt, this.airInput, this.airTune(), ttl);
        this.spinAngle = this.air.spin;
        this.spinVel = this.air.spinVel;

        // back on the cushion while descending relative to the ground = landing
        if (c2 < H * 1.15 + 0.2 && v.y <= this.groundVy + 1 && this.air.airTime > 0.12) this.land(nh);
      }
      if (this.grounded) this.air.tickGround(dt);
    }
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;

    // ---- obstacles: rocks, megalith statues, stone arches & ruins
    this.crashCD -= dt;
    if (this.crashCD <= 0) {
      const outcome = this.monoliths.checkCollision(p, 1.3, this.nrm, v.y, this.grounded);
      if (outcome === 'bounce') {
        v.y = Math.max(v.y, 18);
        v.z = Math.max(v.z + 6, 36);
        this.shake = 0.35;
        this.audio.chime(1.2);
        this.emitDust(p, 30, 7);
        this.score += 350;
        this.combo = Math.min(40, this.combo + 5);
        this.chain++;
        this.flow = clamp(this.flow + 20, 0, 100);
        this.popup('ROCK BOUNCE ✦', '+350 PTS', 'gold');
      } else if (outcome === 'clear') {
        this.score += 150;
        this.combo = Math.min(40, this.combo + 2);
        this.audio.chime(0.8);
        this.popup('ROCK CLEAR', 'Lompatan Mulus · +150', 'cyan');
      } else if (outcome === 'statue_bounce') {
        // Massive launch off the summit head of an ancient colossal statue!
        v.y = Math.max(v.y, 25);
        v.z = Math.max(v.z + 10, 44);
        this.shake = 0.45;
        this.audio.chime(8, 0.25);
        this.audio.sparkle();
        this.score += 600;
        this.combo = Math.min(40, this.combo + 8);
        this.flow = clamp(this.flow + 30, 0, 100);
        this.emitBurst(p, 36, 1, 0.9, 0.5);
        this.popup('PATUNG MEGALIT BOUNCE! ✦', 'Lontaran Raksasa · +600 PTS', 'gold');
      } else if (outcome === 'statue_clear') {
        this.score += 500;
        this.combo = Math.min(40, this.combo + 5);
        this.audio.chime(7, 0.2);
        this.popup('MEGALITH LEAP! ✦', 'Melompati Patung Kuno · +500 PTS', 'gold');
      } else if (outcome === 'arch_glide') {
        this.score += 250;
        this.combo = Math.min(40, this.combo + 3);
        this.flow = clamp(this.flow + 15, 0, 100);
        this.audio.chime(6, 0.18);
        this.popup('GERBANG MEGALIT ✓', 'Meluncur Lewat Gerbang · +250 PTS', 'cyan');
      } else if (outcome === 'arch_leap') {
        this.score += 400;
        this.combo = Math.min(40, this.combo + 5);
        this.audio.chime(7, 0.2);
        this.popup('ARCH HOP! ✦', 'Melompati Gerbang Batu · +400 PTS', 'gold');
      } else if (outcome === 'crash') {
        const sp2 = Math.hypot(v.x, v.z);
        if (sp2 > 10) {
          if (this.shield > 1) {
            this.shield--;
            this.crashCD = 0.9;
            v.x *= 0.5;
            v.z *= 0.55;
            this.combo = 0;
            this.chain = 0;
            this.shake = 1.0;
            this.emitBurst(p, 30, 1, 0.4, 0.4);
            this.audio.thump(0.85);
            this.popup('PERISAI TERKENA! (-1)', `Sisa Perisai: ${this.shield}/${this.maxShield} · Lompat atau Mengelak!`, 'rose');
          } else if (this.shield === 1) {
            this.shield = 0;
            this.crashCD = 1.1;
            v.x *= 0.28;
            v.z *= 0.32;
            this.combo = 0;
            this.chain = 0;
            this.shake = 1.3;
            this.emitBurst(p, 42, 1, 0.25, 0.25);
            this.audio.thump(1.0);
            this.popup('PERISAI HANCUR! (0 TERSISA)', 'Kumpulkan 5 Kristal Surya untuk pulih!', 'rose');
          } else {
            this.endRun('wall');
            this.popup('TUMBANG DI RINTANGAN!', 'Perisai Habis · Hati-hati menuruni lereng!', 'rose');
          }
        }
      }
    }

    // ---- speed pads (jalur akselerasi downhill)
    if (this.speedPads.checkBoost(p)) {
      const bfx = Math.sin(this.yaw);
      const bfz = Math.cos(this.yaw);
      this.vel.x += bfx * 24;
      this.vel.z += bfz * 24;
      this.flow = 100;
      this.shake = 0.25;
      this.audio.whoosh(1.45);
      this.audio.sparkle();
      this.nrm.set(0, 1, 0);
      this.ripples.spawn(this.t1.copy(p), this.nrm, 10, 1.2, 0x4df0ff);
      this.emitBurst(p, 28, 0.3, 0.95, 1);
      this.popup('LUNCUR KILAT! ✦', 'Jalur Akselerasi Lereng Gunung', 'cyan');
    }

    // ---- energy crystals (kristal surya pelindung)
    const collected = this.energyCrystals.checkCollect(p);
    if (collected > 0) {
      this.crystalsCollected += collected;
      this.score += collected * 140 * this.mult();
      this.combo = Math.min(40, this.combo + collected);
      this.flow = clamp(this.flow + collected * 8, 0, 100);
      this.audio.chime(this.chimeStep, 0.22);
      this.chimeStep = (this.chimeStep + collected) % 11;
      this.emitBurst(p, 14 * collected, 1, 0.88, 0.32);
      if (this.crystalsCollected % 5 === 0 && this.shield < this.maxShield) {
        this.shield++;
        this.audio.sparkle();
        this.popup('PERISAI PULIH! ✦', `5 Kristal Terkumpul · Perisai: ${this.shield}/${this.maxShield}`, 'gold');
      } else {
        this.popup(`KRISTAL SURYA +${collected}`, `Total Koleksi: ${this.crystalsCollected}`, 'gold');
      }
    }

    // ---- downhill relic slalom gates
    const relicResult = this.downhillRelics.checkPass(p, dt);
    if (relicResult.outcome === 'passed') {
      const bonusScore = (250 + relicResult.streak * 50) * this.mult();
      this.score += bonusScore;
      this.combo = Math.min(40, this.combo + 4);
      this.flow = 100;
      this.vel.x += fx * 18;
      this.vel.z += fz * 18;
      this.shake = 0.2;
      this.audio.chime(Math.min(10, 3 + (relicResult.streak % 7)), 0.25);
      this.audio.sparkle();
      this.popup(`GERBANG RELIK #${relicResult.gateId}! ✦`, `Streak ×${relicResult.streak} · SPEED BOOST! +${bonusScore} PTS`, 'gold');
    } else if (relicResult.outcome === 'missed') {
      this.popup('GERBANG TERLEWAT! ✕', 'Streak terputus · Ikuti kompas relik!', 'rose');
      this.audio.thump(0.5);
    }

    // ---- flow
    if (this.boosting) this.flow = clamp(this.flow - 26 * dt, 0, 100);
    else this.flow = clamp(this.flow + (this.grounded && speed > 20 ? 2.5 * dt : -1.5 * dt), 0, 100);

    this.combo = clamp(this.combo - dt * (this.grounded && speed > 28 ? 0.25 : this.grounded ? 1.15 : 0.2), 0, 40);
    this.chainTimer -= dt;
    if (this.chainTimer <= 0 && this.chain > 0) this.chain = 0;

    // ---- hover rig + visuals (uses REAL dt so filtering never depends on slow-mo)
    this.updateRider(rawDt);

    // ---- ground fx: pasir gurun beterbangan di belakang bilah
    if (this.grounded) {
      const rate = (10 + speed * 2.1 + this.slipNorm * 46) * T.particles;
      this.dustAcc += rate * rawDt;
      while (this.dustAcc >= 1) {
        this.dustAcc -= 1;
        this.emitSand();
      }
    }

    // ---- river: the current carries you downstream + ripple rings behind you
    if (this.onWater) {
      const s = riverSlope(p.z);
      const il = 1 / Math.sqrt(1 + s * s);
      const push = 7 * T.waterCurrent;
      v.x += s * il * push * dt;
      v.z += il * push * dt;
      this.rippleT -= rawDt;
      if (this.grounded && this.rippleT <= 0) {
        this.rippleT = 0.14;
        this.nrm.set(0, 1, 0);
        this.ripples.spawn(
          this.t1.set(p.x, this.waterY + 0.05, p.z),
          this.nrm,
          2.5 + speed * 0.05,
          1.1,
          0xe8fbff,
        );
      }
    }

    const glowRate = ((this.boosting ? 70 : 0) + (!this.grounded ? 46 : 0) + Math.abs(this.spinVel) * 12) * T.particles;
    this.glowAcc += glowRate * rawDt;
    while (this.glowAcc >= 1) {
      this.glowAcc -= 1;
      this.rider.tail.getWorldPosition(this.t1);
      const hot = !this.grounded;
      this.glow.spawn(
        this.t1.x,
        this.t1.y + 0.2,
        this.t1.z,
        -v.x * 0.22 + (Math.random() - 0.5) * 4,
        1 + Math.random() * 3,
        -v.z * 0.22 + (Math.random() - 0.5) * 4,
        0.45 + Math.random() * 0.6,
        0.4 + Math.random() * 0.45,
        hot ? 0.62 : 1,
        hot ? 0.9 : 0.72,
        1,
        0.9,
        -2,
        2.4,
      );
    }

    this.trickLabel = !this.grounded ? this.air.label() : '';
  }

  // ---------------------------------------------------------------- visuals
  private updateRider(dt: number) {
    const T = this.tune;
    const leanTarget = this.grounded
      ? this.steer * (0.36 + this.slipNorm * 0.1)
      : this.steer * 0.14;

    this.rig.update(
      dt,
      this.grounded,
      this.pos.x,
      this.pos.z,
      this.pos.y,
      this.vel.y,
      this.yaw,
      this.air.spin, // spin = yaw rotation
      leanTarget,
      {
        rideHeight: T.rideHeight,
        softness: T.softness,
        bumpFilter: T.bumpFilter,
        tilt: T.tilt,
        tiltSmooth: T.tiltSmooth,
        glide: T.glide,
      },
      this.air.flip, // flip = pitch rotation around the rider's centre
      0, // grabs are now full-body poses in the rider model
    );

    const bt = this.air.board;
    this.rider.animate(dt, {
      time: this.time,
      pup: this.pupBlend,
      speed: clamp(Math.hypot(this.vel.x, this.vel.z) / 72, 0, 1),
      steer: this.steer,
      air: !this.grounded,
      flipVel: this.air.flipVel,
      spinVel: this.air.spinVel,
      boost: this.boosting,
      height: T.bodyHeight,
      head: T.headSize,
      sword: T.swordSize,
      boardRoll: bt.roll,
      boardYaw: bt.yaw,
      boardPitch: bt.pitch,
      boardPivotZ: bt.pivotZ,
      feetLift: bt.feetLift(),
      pose: this.air.poseId,
      poseW: this.air.grabW,
      timeToLand: this.timeToLand,
      airTime: this.airTime,
    });
    this.rig.apply(this.rider.group, this.pos.x, this.pos.z, this.steer, this.grounded, { tilt: T.tilt });
    this.bobT += dt;

    // ---- trails
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const fx = Math.sin(this.rig.yaw);
    const fz = Math.cos(this.rig.yaw);
    const rn = -fz;
    const sn = fx;
    for (const t of [this.trailGlow, this.trailWake, this.trailScarf, this.trailAir, this.trailSword]) t.tick(dt);

    this.rider.tail.getWorldPosition(this.t3);
    const trailW = T.trails;
    const nearGround = this.rig.clearance < this.hoverH() + 0.6;
    if (this.grounded || (nearGround && !this.grounded)) {
      this.trailGlow.push(
        this.t3,
        rn,
        sn,
        (0.14 + Math.min(0.12, speed * 0.0018) + (this.boosting ? 0.08 : 0)) * trailW,
      );
    }
    if (this.grounded && this.rig.clearance < this.hoverH() + 0.8) {
      this.trailWake.push(this.t1.set(this.pos.x, this.wakeY(), this.pos.z), rn, sn, (0.24 + Math.min(0.14, speed * 0.002)) * trailW);
    }
    this.rider.neck.getWorldPosition(this.t4);
    this.trailScarf.push(this.t4, rn * 0.5, sn * 0.5, 0.08 * trailW);
    this.trailAir.push(
      this.t4,
      rn * 0.35,
      sn * 0.35,
      (this.grounded ? 0.02 : 0.12 + Math.min(0.2, Math.abs(this.spinVel) * 0.04)) * trailW,
    );
    // Ekor putih halus di ujung pedang (seperti trail paus) — selalu mengalir,
    // pendek & tipis supaya tidak menutupi debu pasir
    this.trailSword.push(this.t3, rn, sn, (0.09 + Math.min(0.16, speed * 0.003)) * trailW);

    // ---- aura (circular light around character): reduced by 70% and hard-capped so it never blows out
    const auraMat = this.aura.material as THREE.SpriteMaterial;
    const rawTarget = this.grounded ? 0.025 + this.flow * 0.00015 : 0.035 + Math.min(0.01, Math.abs(this.spinVel) * 0.003);
    // Hard ceiling at 0.038 max, does NOT scale up when bloom or glowFx is raised
    const aTarget = Math.min(0.038, rawTarget);
    auraMat.opacity += (aTarget - auraMat.opacity) * (1 - Math.exp(-dt * 6));
    const auraScale = 4.5 + (!this.grounded ? 0.6 : 0) + Math.sin(this.bobT * 2) * 0.1;
    this.aura.scale.set(auraScale, auraScale, 1);

    // ---- soft shadow on the real sand (or on the water surface)
    const gh = rideHeight(this.pos.x, this.pos.z);
    const h = clamp(this.rig.clearance, 0, 40);
    this.shadow.position.set(this.pos.x, gh + 0.07, this.pos.z);
    this.shadow.quaternion.setFromUnitVectors(AXIS_Z, this.nrm.set(-this.rig.slopeX(), 1, -this.rig.slopeZ()).normalize());
    const sh = clamp(1 - h / 34, 0.2, 1);
    this.shadow.scale.setScalar(sh * (1 + h * 0.03));
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.36 * sh * sh * T.shadow;
  }

  private land(nh: number) {
    // HOVER landing: we do NOT snap to the sand. The air cushion catches us,
    // and the spring + damping absorb the rest (soft squash & settle).
    void nh;
    const slopeVy = this.groundVy;
    // impact is RELATIVE to the slope: landing on a matching downslope = buttery soft
    const impact = Math.max(0, slopeVy - this.vel.y);
    // keep most of the velocity so the cushion visibly compresses, only kill extreme hits
    this.vel.y = Math.max(this.vel.y, slopeVy - 14);
    // the rider bends the knees to absorb the landing
    this.rider.impulse(clamp(impact / 18, 0.15, 1.2));
    this.grounded = true;
    this.shake = 0;
    this.timeScale = 1;

    const T = this.tune;
    // Pasang arah hadap skate tepat searah gerak laju (velocity vector) saat menapak
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 2) {
      this.yaw = Math.atan2(this.vel.x, this.vel.z);
    }
    const r = this.air.land(this.airTune());
    const m = this.mult();
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const tricked = r.flips > 0 || r.spins > 0 || r.grabs > 0 || r.boardTricks > 0 || r.airJumps > 0;

    if (r.quality === 'sketchy') {
      // ---- bad landing: not a crash (it's a calm game), but it costs speed + the chain
      this.vel.x *= 0.55;
      this.vel.z *= 0.55;
      this.combo = 0;
      this.air.chain = 0;
      this.air.chainPoints = 0;
      this.air.chainTimer = 0;
      this.shake = Math.min(1.2, 0.5 + impact / 40);
      this.emitDust(this.pos, Math.round(46 * T.particles), 9);
      this.audio.thump(0.8);
      this.popup(
        r.bail === 'board' ? 'BAIL' : 'SKETCHY',
        r.bail === 'board' ? 'pedang tak tertangkap' : tricked ? 'mendarat tegak untuk skor' : 'land upright',
        'rose',
      );
    } else if (tricked || r.airTime > 0.7) {
      // ---- chain: consecutive good landings multiply each other
      const inChain = this.air.chainTimer > 0;
      this.air.chain = inChain ? this.air.chain + 1 : 1;
      this.air.chainTimer = 2.8;
      const chainMul = 1 + (this.air.chain - 1) * 0.25;
      const perfect = r.quality === 'perfect';
      const pts = Math.round((r.points + 80) * m * chainMul * (perfect ? 1.5 : 1));
      this.air.chainPoints += pts;
      this.score += pts;
      this.combo += 1 + r.flips * 2 + r.spins * 2 + r.grabs + r.boardTricks * 2 + r.airJumps;
      this.flow = clamp(this.flow + 6 + r.flips * 10 + r.spins * 8 + (perfect ? 8 : 0), 0, 100);

      const chainTxt = this.air.chain > 1 ? `  ·  chain ×${this.air.chain}` : '';
      this.popup(
        perfect ? `${r.name}  ✦` : r.name,
        `${perfect ? 'PERFECT  ' : ''}+${pts}${chainTxt}`,
        perfect ? 'gold' : 'cyan',
      );

      if (perfect) {
        // Alto-style reward: a burst of speed straight down the line
        const boost = (8 + r.flips * 3 + r.spins * 2) * T.perfectBoost;
        this.vel.x += fx * boost;
        this.vel.z += fz * boost;
        this.flow = clamp(this.flow + 6, 0, 100);
        this.audio.sparkle();
        this.nrm.set(0, 1, 0);
        this.ripples.spawn(this.t1.copy(this.pos), this.nrm, 8 + r.flips * 2, 1.1, 0xffe3a8);
      }
      if (slopeVy < -3.2) {
        // Alto-style downslope boost: smooth transition on a downward mound/slope!
        const downslopeBoost = (8 + Math.min(16, Math.abs(slopeVy) * 0.45)) * T.perfectBoost;
        this.vel.x += fx * downslopeBoost;
        this.vel.z += fz * downslopeBoost;
        this.flow = clamp(this.flow + 8, 0, 100);
        this.popup('DOWNSLOPE BOOST! ✦', 'Pendaratan Turunan Mulus', 'gold');
        this.audio.sparkle();
      }
      if (tricked) {
        this.audio.chime(Math.min(10, 2 + r.spins + r.flips * 2 + (this.air.chain - 1)), 0.2);
        this.emitBurst(this.pos, Math.round((18 + r.spins * 6 + r.flips * 8) * T.particles), 1, 0.84, 0.45);
      }
      if (this.air.chain >= 3 && this.shield < this.maxShield) {
        this.shield++;
        this.popup('PERISAI PULIH DARI FLOW! ✦', `Aliran Rantai Mulus · Perisai: ${this.shield}/${this.maxShield}`, 'gold');
      }
      this.shake = Math.max(this.shake, Math.min(0.8, 0.15 + r.flips * 0.15 + r.spins * 0.1));
    }

    if (impact > 5) {
      this.shake = Math.max(this.shake, Math.min(1, impact / 34));
      this.audio.thump(clamp(impact / 30, 0.2, 1));
      this.emitDust(this.pos, Math.floor(clamp(impact * 2 * T.particles, 6, 40)), 7);
      this.nrm.set(0, 1, 0);
      this.ripples.spawn(this.t1.copy(this.pos), this.nrm, 4 + impact * 0.22, 0.9, 0xffdfb6);
    }

    // drop whole turns from the visuals so nothing unwinds; only the residual eases out
    this.rig.wrap();
    this.rig.onLand();
    this.air.resetAngles();
    this.airTime = 0;
    this.spinAngle = 0;
    this.spinVel = 0;
    this.jumpedThisAir = false;

    // jump pressed just before touchdown -> hop straight away (combo flow)
    if (this.jumpBuffer > 0 && r.quality !== 'sketchy') {
      this.jumpBuffer = 0;
      this.jump();
    }
  }

  // ----------------------------------------------------------------- sparks
  private spawnRun() {
    const ang = this.yaw + (Math.random() - 0.5) * 1.7;
    const dist = 80 + Math.random() * 120;
    let x = this.pos.x + Math.sin(ang) * dist;
    let z = this.pos.z + Math.cos(ang) * dist;
    const curve = (Math.random() - 0.5) * 0.5;
    let made = 0;
    for (let i = 0; i < 7 && made < 7; i++) {
      const slot = this.sparks.find((s) => !s.active);
      if (!slot) break;
      slot.x = x;
      slot.z = z;
      slot.y = baseDune(x, z) + 2.3; // chasm-free height: sparks never sink into a gap
      slot.active = true;
      slot.phase = Math.random() * 9;
      made++;
      const a = ang + curve * i;
      x += Math.sin(a) * 8.5;
      z += Math.cos(a) * 8.5;
    }
  }

  private updateSparks(dt: number) {
    const p = this.pos;
    for (let i = 0; i < this.sparkCount; i++) {
      const s = this.sparks[i];
      if (!s.active) {
        this.m4.makeScale(0, 0, 0);
        this.sparkMesh.setMatrixAt(i, this.m4);
        continue;
      }
      s.phase += dt * 2.6;
      const dx = s.x - p.x;
      const dz = s.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 300) {
        s.active = false;
        continue;
      }
      if (d < 11 && d > 0.001) {
        const pull = (1 - d / 11) * 26 * dt;
        s.x -= (dx / d) * pull;
        s.z -= (dz / d) * pull;
      }
      if (d < 3.4) {
        s.active = false;
        this.collect(s);
        continue;
      }
      const sc = 1 + Math.sin(s.phase * 1.6) * 0.16;
      this.t1.set(s.x, s.y + Math.sin(s.phase) * 0.4, s.z);
      this.q.setFromEuler(new THREE.Euler(0, s.phase * 1.4, s.phase * 0.6));
      this.t2.setScalar(sc);
      this.m4.compose(this.t1, this.q, this.t2);
      this.sparkMesh.setMatrixAt(i, this.m4);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparks.every((s) => !s.active)) for (let i = 0; i < 6; i++) this.spawnRun();
  }

  private collect(s: Spark) {
    const m = this.mult();
    this.score += 160 * m;
    this.combo += 1;
    this.flow = clamp(this.flow + 6, 0, 100);
    this.chain += 1;
    this.chainTimer = 2.6;
    this.audio.chime(this.chimeStep, 0.22);
    this.chimeStep = (this.chimeStep + 1) % 11;
    this.t1.set(s.x, s.y, s.z);
    this.emitBurst(this.t1, 16, 1, 0.78, 0.36);
    this.nrm.set(0, 1, 0);
    this.ripples.spawn(this.t1.setY(duneHeight(s.x, s.z) + 0.2), this.nrm, 4.5, 0.7, 0xffd79a);
    if (this.chain % 5 === 0) {
      const bonus = 400 * m;
      this.score += bonus;
      this.popup(`CHAIN ×${this.chain}`, `+${Math.round(bonus)}`, 'gold');
      this.audio.sparkle();
    }
    let inactive = 0;
    for (const sp of this.sparks) if (!sp.active) inactive++;
    if (inactive < 8) this.spawnRun();
  }

  // --------------------------------------------------------------------- fx
  /**
   * ROOSTER TAIL GURUN: pasir beterbangan indah di belakang hover sword.
   * Tiga lapis — butir pasir yang melengkung cepat, kabut debu besar yang
   * melayang lembut, dan kilau butir halus yang tertangkap cahaya.
   */
  private emitSand() {
    this.rider.tail.getWorldPosition(this.t1);
    const v = this.vel;
    const back = 0.16 + Math.random() * 0.22;
    if (this.onWater) {
      // skimming the river: a rooster tail of glittering spray
      this.dust.spawn(
        this.t1.x + (Math.random() - 0.5) * 1.1,
        this.waterY + 0.1 + Math.random() * 0.3,
        this.t1.z + (Math.random() - 0.5) * 1.1,
        -v.x * back * 0.7 + (Math.random() - 0.5) * 4,
        2.5 + Math.random() * 5.5,
        -v.z * back * 0.7 + (Math.random() - 0.5) * 4,
        0.3 + Math.random() * 0.55,
        0.45 + Math.random() * 0.5,
        0.86,
        0.96,
        1,
        0.55,
        -15,
        1.3,
      );
      return;
    }

    const speed = Math.hypot(v.x, v.z);
    const fx = Math.sin(this.rig.yaw);
    const fz = Math.cos(this.rig.yaw);
    // semburat samping saat carving keras (sesuai arah tikungan)
    const side = -this.steer * this.slipNorm;
    const kick = 0.24 + Math.min(0.34, speed * 0.007) + this.slipNorm * 0.14;

    const roll = Math.random();
    if (roll < 0.55) {
      // 1. BUTIR PASIR HALUS di sekitar bilah: kecil, banyak, melengkung —
      //    ini "tekstur" debunya, bukan gumpalan raksasa
      const backOff = Math.random() * 2.4;
      const edge = Math.random() < 0.5 ? (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.1) : 0;
      const px = this.t1.x - fx * backOff - fz * edge + (Math.random() - 0.5) * 1.2;
      const pz = this.t1.z - fz * backOff + fx * edge + (Math.random() - 0.5) * 1.2;
      const py = this.surfaceY(px, pz) + 0.12 + Math.random() * 0.4;
      const vx = -v.x * kick + -fz * (side * speed * 0.08 + edge * 2.2) + (Math.random() - 0.5) * 4.5;
      const vz = -v.z * kick + fx * (side * speed * 0.08 + edge * 2.2) + (Math.random() - 0.5) * 4.5;
      this.dust.spawn(
        px,
        py,
        pz,
        vx * 1.15,
        2.6 + Math.random() * 4.5 + speed * 0.06,
        vz * 1.15,
        0.18 + Math.random() * 0.3,
        0.6 + Math.random() * 0.6,
        1.0,
        0.88,
        0.66,
        0.75,
        -17,
        1.0,
      );
    } else if (roll < 0.88) {
      // 2. ASAP DEBU: puff SEDANG jauh di belakang rider (1.8–7.4 m). Makin jauh
      //    dari kamera, makin kecil di layar — membentuk GARIS ASAP yang indah &
      //    natural, bukan bola-bola raksasa yang menabrak lensa.
      const backOff = 1.8 + Math.random() * 5.6;
      const edge = (Math.random() - 0.5) * (0.8 + backOff * 0.35);
      const px = this.t1.x - fx * backOff - fz * edge + (Math.random() - 0.5) * 1.6;
      const pz = this.t1.z - fz * backOff + fx * edge + (Math.random() - 0.5) * 1.6;
      const py = this.surfaceY(px, pz) + 0.25 + Math.random() * 0.8;
      const vx = -v.x * kick * 0.5 + -fz * side * speed * 0.04 + (Math.random() - 0.5) * 2.2;
      const vz = -v.z * kick * 0.5 + fx * side * speed * 0.04 + (Math.random() - 0.5) * 2.2;
      this.dust.spawn(
        px,
        py,
        pz,
        vx,
        1.0 + Math.random() * 1.8 + this.slipNorm * 1.2,
        vz,
        0.55 + Math.random() * 0.75,
        1.6 + Math.random() * 1.3,
        0.94,
        0.84,
        0.67,
        0.15 + Math.random() * 0.09,
        -1.0,
        2.4,
      );
    } else {
      // 3. kilau butir halus tertangkap cahaya matahari
      const backOff = Math.random() * 2.0;
      const px = this.t1.x - fx * backOff + (Math.random() - 0.5) * 1.4;
      const pz = this.t1.z - fz * backOff + (Math.random() - 0.5) * 1.4;
      const py = this.surfaceY(px, pz) + 0.15 + Math.random() * 0.5;
      this.dust.spawn(
        px,
        py,
        pz,
        -v.x * kick * 1.3 + (Math.random() - 0.5) * 3,
        3.5 + Math.random() * 4,
        -v.z * kick * 1.3 + (Math.random() - 0.5) * 3,
        0.14 + Math.random() * 0.18,
        0.45 + Math.random() * 0.4,
        1.0,
        0.98,
        0.9,
        0.55,
        -13,
        1.0,
      );
    }
  }

  private emitDust(at: THREE.Vector3, n: number, power: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random();
      this.dust.spawn(
        at.x + Math.cos(a) * r * 1.4,
        at.y + 0.2,
        at.z + Math.sin(a) * r * 1.4,
        Math.cos(a) * power * (0.4 + r),
        2 + Math.random() * power * 0.9,
        Math.sin(a) * power * (0.4 + r),
        0.5 + Math.random() * 1.1,
        0.6 + Math.random() * 0.8,
        0.96,
        0.85,
        0.7,
        0.48,
        -14,
        1.9,
      );
    }
  }

  private emitBurst(at: THREE.Vector3, n: number, r: number, g: number, b: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 2;
      this.glow.spawn(
        at.x,
        at.y + 0.3,
        at.z,
        Math.cos(a) * (2 + e * 7),
        2 + Math.random() * 8,
        Math.sin(a) * (2 + e * 7),
        0.28 + Math.random() * 0.4,
        0.45 + Math.random() * 0.5,
        r,
        g,
        b,
        0.7,
        -6,
        1.6,
      );
    }
  }

  // ----------------------------------------------------------------- camera
  /**
   * Sistem kamera "desired → smoothed" (3 mode — tombol 1/2/3):
   *   1. hitung posisi ideal (desired) & titik pandang ideal (look) sesuai mode
   *   2. koreksi supaya tidak tertutup terrain (avoidTerrain — dinaikkan, bukan dipotong)
   *   3. lerp camPos → desired (kPos) · lookSmooth → look (kLook), semua 1-exp(-dt·k)
   *   4. lerp FOV & roll, lalu camera.lookAt(look)
   * Karena camPos/camLook/fov/roll persisten & selalu di-lerp, ganti mode TIDAK
   * pernah cut — kamera meluncur mulus ke posisi mode baru.
   */
  private updateCamera(dt: number) {
    const T = this.tune;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const sn = clamp(speed / 72, 0, 1);

    // ===================== DRONE HEADING (kamera cerdas) =====================
    // Rider diperlakukan seperti BOLA / mobil yang diikuti drone: arah kamera
    // ditentukan dari ARAH LUNCUR bola (velocity), bukan dari arah badan rider.
    // Spin/flip freestyle tidak merubah velocity → layar TIDAK ikut muter.
    // Di darat responsif (ngikutin carving), di udara/trik extra tenang.
    const tricking =
      Math.abs(this.air.flipVel) > 2.5 || Math.abs(this.air.spinVel) > 2.5 || this.air.board.active;
    let headTgt = this.yaw;
    if (speed > 6) headTgt = Math.atan2(this.vel.x, this.vel.z);
    if (!this.camHeadingInit) {
      this.camHeading = headTgt;
      this.camHeadingInit = true;
    }
    let dh = headTgt - this.camHeading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const kHead = this.grounded ? (tricking ? 2.0 : 4.5) : 1.5;
    this.camHeading += dh * (1 - Math.exp(-dt * kHead));
    const fx = Math.sin(this.camHeading);
    const fz = Math.cos(this.camHeading);
    const mode = clamp(Math.round(T.camStyle), 0, 3);
    // set oleh cabang 'playing' di bawah
    let swayScale = 1;
    let fovOverride: number | null = null;
    let rollOverride: number | null = null;
    // the camera glides on the smoothed rail, so bumps never shake the frame
    const glideY = this.rig.cameraY(dt, 2.6 + T.camLag * 2.2);
    this.lockCooldown = Math.max(0, this.lockCooldown - dt);

    if (this.state === 'menu') {
      const a = this.time * 0.14;
      this.t2.set(this.pos.x + Math.sin(a) * 15, glideY + 5.4 + Math.sin(a * 0.7) * 1.2, this.pos.z + Math.cos(a) * 15);
      this.camPos.lerp(this.t2, 1 - Math.exp(-dt * 3));
      this.lookSmooth.lerp(this.t1.set(this.pos.x, glideY + 1.8, this.pos.z), 1 - Math.exp(-dt * 4));
      this.lockRing.visible = false;
    } else if (this.state === 'over') {
      // camera stops at the edge and watches the rider tumble into the abyss
      this.lookSmooth.lerp(this.pos, 1 - Math.exp(-dt * 4));
      this.lockRing.visible = false;
    } else {
      // ============================ PLAYING: mode 0 Klasik · 1 Sekiro · 2 Sword of the Sea · 3 Bodycam
      const px = this.pos.x;
      const py = this.pos.y;
      const pz = this.pos.z;
      const lean = this.steer; // -1..1 kemiringan rider saat belok
      const air = Math.min(this.airTime, 2.2);
      const kMul = T.camLag / 1.15; // slider "kelembutan kamera" mengalikan semua k
      const o = this.orbit;
      let kPos = 3.5;
      let kLook = 5;
      let clearance = 2.0;

      // ---- SEMUA MODE: drag/scroll memberi offset orbit sesi ini; diam > 1.6 dtk
      // → offset kembali pelan ke 0 (framing dasar per-mode dari Settings ⚙️ → Kamera).
      if (this.time - o.lastInput > 1.6) {
        o.yaw += (0 - o.yaw) * (1 - Math.exp(-dt * 1.3));
        o.pitch += (0 - o.pitch) * (1 - Math.exp(-dt * 1.3));
      }

      if (mode === 0) {
        // ---------------- KLASIK ----------------
        // polar: yaw = seberapa serong (0° = tepat di belakang), pitch = tinggi
        // mata. Default 40°/17° = framing asli samping-belakang kanan.
        kPos = 3.5;
        kLook = 5;
        swayScale = 0.6;
        const yaw = rad(T.cam0Yaw) + o.yaw;
        const pitch = clamp(rad(T.cam0Pitch) + o.pitch, -0.12, 0.85);
        const dist = (11.7 + 2.5 * sn) * T.camDist * T.cam0Dist * o.zoom;
        const rx = -fz;
        const rz = fx; // vektor kanan rider
        const dirX = -fx * Math.cos(yaw) + rx * Math.sin(yaw);
        const dirZ = -fz * Math.cos(yaw) + rz * Math.sin(yaw);
        this.t2.set(px + dirX * dist, py + 1.2 + Math.tan(pitch) * dist, pz + dirZ * dist);
        this.t3.set(px + fx * 7, py + 1.2, pz + fz * 7);
        fovOverride = 55 + (10 * sn + (this.boosting ? 4 : 0)) * (T.fov / 0.95);
        rollOverride = -0.05 * lean;
        this.lockRing.visible = false;
      } else if (mode === 1) {
        // ---------------- SEKIRO (third-person) ----------------
        // FIX top-down: pitch dasar rendah (default 2°) dan titik pandang maju
        // SEIRING jarak → zoom out sejauh apa pun framing tetap "di bahu" level,
        // bukan mengintip dari atas. Drag = orbit, scroll = zoom, lock-on kristal.
        kPos = 14;
        kLook = 16;
        clearance = 0.7;
        swayScale = 0.35;
        this.updateLockOn();
        if (this.lockTarget) {
          // yaw diarahkan ke target (frame rider) & pitch kembali level — khas
          // Sekiro: rider DAN target sama-sama masuk frame
          const lt = this.lockTarget;
          let rel = Math.atan2(lt.x - px, lt.z - pz) - this.camHeading;
          rel = Math.atan2(Math.sin(rel), Math.cos(rel));
          const yawTgt = clamp(rel * 0.6 - rad(T.cam1Yaw), -1.1, 1.1);
          o.yaw += (yawTgt - o.yaw) * (1 - Math.exp(-dt * 2.5));
          o.pitch += (0 - o.pitch) * (1 - Math.exp(-dt * 3));
        }
        const az = this.camHeading + Math.PI + rad(T.cam1Yaw) + o.yaw;
        const pitch = clamp(rad(T.cam1Pitch) + o.pitch, -0.35, 0.7);
        const dist = 4.6 * T.cam1Dist * T.camDist * o.zoom + (!this.grounded ? 0.8 : 0);
        const shoulder = 0.85; // offset ke kanan → rider di kiri frame
        const cosP = Math.cos(pitch);
        this.t2.set(
          px + Math.sin(az) * dist * cosP + Math.cos(az) * shoulder,
          py + 1.55 + Math.sin(pitch) * dist,
          pz + Math.cos(az) * dist * cosP - Math.sin(az) * shoulder,
        );
        // pandangan maju ∝ jarak: makin di-zoom out makin jauh menatap lurus
        const ahead = 2.2 + dist * 0.55;
        this.t3.set(
          px - Math.sin(az) * ahead + Math.cos(az) * shoulder * 0.55,
          py + 1.35,
          pz - Math.cos(az) * ahead - Math.sin(az) * shoulder * 0.55,
        );
        if (this.lockTarget) {
          const lt = this.lockTarget;
          this.t3.lerp(this.t4.set(lt.x, lt.y + 0.6, lt.z), 0.35);
          this.lockRing.visible = true;
          this.lockRing.position.set(lt.x, lt.y + 0.6, lt.z);
        } else this.lockRing.visible = false;
        fovOverride = (50 + 4 * sn) * (0.6 + 0.4 * (T.fov / 0.75));
        rollOverride = -0.04 * lean;
      } else if (mode === 2) {
        // ---------------- SWORD OF THE SEA (sinematik) ----------------
        // rendah & lebar; sweep organik dua sinus; rule of thirds; dutch angle
        kPos = 1.8;
        kLook = 2.6;
        swayScale = 0.9;
        const sweep = Math.sin(this.time * 0.11) * 0.75 + Math.sin(this.time * 0.037 + 1.3) * 0.45;
        const cyaw = this.camHeading + Math.PI + sweep + lean * 0.15 + rad(T.cam2Yaw) + o.yaw;
        const pitch = clamp(rad(T.cam2Pitch) + o.pitch, -0.12, 0.75);
        const dist = (15 + 5 * sn + 5 * air) * T.camDist * T.cam2Dist * o.zoom;
        const height = dist * Math.tan(pitch) + 3.2 * air;
        this.t2.set(px + Math.sin(cyaw) * dist, py + height, pz + Math.cos(cyaw) * dist);
        const lat = -1.5 * lean - 2 * Math.sin(sweep + lean * 0.25); // rider jatuh di sepertiga frame
        this.t3.set(
          px + fx * 14 + Math.cos(cyaw) * lat,
          py + 1 + 0.8 * air,
          pz + fz * 14 - Math.sin(cyaw) * lat,
        );
        fovOverride = 74 + 10 * sn * (T.fov / 0.75);
        rollOverride = -0.07 * lean + 0.015 * Math.sin(this.time * 0.17);
        this.lockRing.visible = false;
      } else {
        // ---------------- BODYCAM v1 ----------------
        // head-cam: action-cam terpasang di KEPALA rider — tinggi, sedikit
        // menunduk ke lintasan (default 15°), lensa super lebar, goyangan
        // handheld kencang. Drag = toleh sekeliling, scroll = maju/mundur,
        // slider Settings = jarak (s/d ×50), sudut & tinggi letak kamera.
        // Arah pandang memakai vektor arah (bukan tan()) → stabil sampai 90°.
        kPos = 24;
        kLook = 30;
        clearance = 0.45;
        swayScale = 0.7;
        const az = this.camHeading + Math.PI + rad(T.cam3Yaw) + o.yaw;
        const pitch = clamp(rad(T.cam3Pitch) + o.pitch, -0.6, Math.PI / 2);
        const dist = 0.85 * T.cam3Dist * o.zoom;
        const head = 1.32 + 1.18 * T.bodyHeight; // tinggi kepala mengikuti postur rider
        this.t2.set(
          px + Math.sin(az) * dist,
          py + head + Math.sin(pitch) * 1.2,
          pz + Math.cos(az) * dist,
        );
        // menatap jauh ke lintasan: pitch memutar arah pandang (15° = menunduk
        // ala head-cam, 90° = tegak lurus ke bawah)
        const ahead = 30;
        const cosP = Math.cos(pitch);
        this.t3.set(
          px + Math.sin(az) * dist - Math.sin(az) * ahead * cosP,
          py + head + Math.sin(pitch) * 1.2 - Math.sin(pitch) * ahead,
          pz + Math.cos(az) * dist - Math.cos(az) * ahead * cosP,
        );
        // lensa action-cam: sangat lebar + "napas" + micro-jitter dua lapis
        fovOverride = (100 + 9 * sn) * (0.7 + 0.3 * (T.fov / 0.75)) + Math.sin(this.time * 1.9) * 1.2;
        rollOverride = -0.1 * lean + 0.018 * Math.sin(this.time * 0.9) + 0.007 * Math.sin(this.time * 2.7 + 1.1);
        this.lockRing.visible = false;
      }

      // ---- LETAK KAMERA: offset tinggi per mode (Settings ⚙️ → Kamera →
      // "tinggi kamera"). Diterapkan sebelum clearance terrain, jadi kamera
      // tetap tidak pernah menembus bukit walau diturunkan.
      this.t2.y +=
        mode === 0 ? T.cam0Height : mode === 1 ? T.cam1Height : mode === 2 ? T.cam2Height : T.cam3Height;

      // ============================ avoidTerrain ============================
      // clearance minimal di atas terrain; sampel 3 titik garis kamera→rider
      // (30%, 55%, 80%): jika ada punggung bukit di atas garis pandang, kamera
      // DINAIKKAN need/f supaya garis bebas — bukan dipotong jaraknya.
      // Lift di-haluskan: NAIK cepat (kamera tak pernah tembus bukit), TURUN
      // pelan (landing setelah loncat tidak disertai jatuh vertikal mendadak).
      const rawY = this.t2.y;
      const g0 = smoothHeight(this.t2.x, this.t2.z, 6) + clearance;
      if (this.t2.y < g0) this.t2.y = g0;
      for (const f of [0.3, 0.55, 0.8]) {
        const lx = px + (this.t2.x - px) * f;
        const lz = pz + (this.t2.z - pz) * f;
        const ly = py + (this.t2.y - py) * f;
        const need = smoothHeight(lx, lz, 6) + clearance - ly;
        if (need > 0) this.t2.y += need / f;
      }
      const lift = this.t2.y - rawY;
      const kLift = lift > this.clearLift ? 12 : 1.6;
      this.clearLift += (lift - this.clearLift) * (1 - Math.exp(-dt * kLift));
      this.t2.y = rawY + this.clearLift;

      // ============================ lerp desired ============================
      this.camPos.lerp(this.t2, 1 - Math.exp(-dt * kPos * kMul));
      this.lookSmooth.lerp(this.t3, 1 - Math.exp(-dt * kLook * kMul));
    }
    this.camLook.lerp(this.lookSmooth, 1 - Math.exp(-dt * 14));

    // reticle lock-on: billboard menghadap kamera + denyut lembut
    if (this.lockRing.visible) {
      this.lockRing.quaternion.copy(this.camera.quaternion);
      this.lockRing.scale.setScalar(1 + Math.sin(this.time * 6) * 0.08);
    }

    // smooth sinusoidal sway (never per-frame random -> no shimmer)
    const swayAmt = (this.state === 'menu' ? 0.12 : 0.05 + sn * 0.08) * swayScale;
    const sx = Math.sin(this.time * 0.83) * swayAmt + Math.sin(this.time * 2.1) * swayAmt * 0.28;
    const sy = Math.sin(this.time * 1.27) * swayAmt * 0.7 + Math.sin(this.time * 2.7) * swayAmt * 0.22;
    const sz = Math.cos(this.time * 0.69) * swayAmt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    // shake uses a decaying amplitude + smoothed sinusoids => thump without jitter
    this.shakeAmp += (this.shake - this.shakeAmp) * (1 - Math.exp(-dt * 8));
    const shAmp = this.shakeAmp * T.shake;
    const jx = Math.sin(this.time * 34) * shAmp * 0.55 + Math.sin(this.time * 71) * shAmp * 0.18;
    const jy = Math.cos(this.time * 41) * shAmp * 0.55 + Math.sin(this.time * 63) * shAmp * 0.16;

    this.camera.position.set(this.camPos.x + sx + jx, this.camPos.y + sy + jy, this.camPos.z + sz);
    this.camera.up.copy(UP);
    this.camera.lookAt(this.camLook);

    const rollTarget =
      rollOverride ?? (this.state === 'menu' ? 0 : this.steer * 0.06 + this.slipNorm * this.steer * 0.06);
    this.camRoll += (rollTarget - this.camRoll) * (1 - Math.exp(-dt * 3.6));
    this.camera.rotateZ(this.camRoll);

    const fovTarget =
      fovOverride ?? 63 + sn * 13 * T.fov + (this.boosting ? 5 * T.fov : 0) + clamp(-this.vel.y * 0.3, -2, 5);
    this.camFov += (fovTarget - this.camFov) * (1 - Math.exp(-dt * 2.8));
    this.camera.fov = this.camFov;
    this.camera.updateProjectionMatrix();

    // base bloom + the "action" bloom, which is separately controllable
    const dyn = (sn * 0.16 + (this.boosting ? 0.14 : 0) + (!this.grounded ? 0.1 : 0)) * T.bloomDynamic;
    // master glare level scales the bloom cleanly without blinding blowout (reduced by 70%)
    const target = (this.mood.bloom * T.bloom * 0.3 + dyn * 0.3) * Math.min(1.0, T.glare);
    this.bloomPass.strength += (target - this.bloomPass.strength) * (1 - Math.exp(-dt * 4));
  }

  /**
   * Lock-on Sekiro: kandidat = kristal energi. Valid jika 6–420 m di depan rider.
   * Skor = lat²·0.5 + fwd² → mengutamakan yang lurus di depan. Target hilang saat
   * terlewati/terkoleksi → otomatis cari berikutnya.
   */
  private updateLockOn() {
    if (this.lockCooldown > 0) return;
    // DRONE RULE: lock-on kamera hanya saat menapak & tidak trik. Saat loncat /
    // freestyle kamera tetap netral menghadap arah luncur — tidak ada swing
    // mendadak ke kristal yang bikin layar "muter / nyorot ga jelas".
    const tricking =
      Math.abs(this.air.flipVel) > 2.5 || Math.abs(this.air.spinVel) > 2.5 || this.air.board.active;
    if (!this.grounded || tricking) {
      this.lockTarget = null;
      return;
    }
    const fx = Math.sin(this.camHeading);
    const fz = Math.cos(this.camHeading);
    const cur = this.lockTarget;
    if (cur && !cur.collected) {
      const ddx = cur.x - this.pos.x;
      const ddz = cur.z - this.pos.z;
      const fwd = ddx * fx + ddz * fz;
      if (fwd > -2 && fwd < 420) return; // masih valid — pertahankan
    }
    let best: typeof cur = null;
    let bestScore = Infinity;
    for (const c of this.energyCrystals.lockCandidates()) {
      if (c.collected) continue;
      const ddx = c.x - this.pos.x;
      const ddz = c.z - this.pos.z;
      const fwd = ddx * fx + ddz * fz;
      if (fwd < 6 || fwd > 420) continue;
      const lat = ddx * fz - ddz * fx;
      const score = lat * lat * 0.5 + fwd * fwd;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    this.lockTarget = best;
  }

  // ------------------------------------------------------------ sinar putih
  /**
   * Tempatkan sinar berikutnya: 380–700 m di depan arah luncur, serong acak
   * ±150 m, DENGAN validasi — titik di dalam / tepi jurang ditolak supaya
   * tujuan selalu bisa dituju dengan seluncur.
   */
  private spawnBeam() {
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    for (let i = 0; i < 16; i++) {
      const dist = 380 + Math.random() * 320;
      const lat = (Math.random() - 0.5) * 300;
      const x = this.pos.x + fx * dist - fz * lat;
      const z = this.pos.z + fz * dist + fx * lat;
      if (chasmAt(z) || chasmAt(z - 30) || chasmAt(z + 30)) continue;
      this.beamPos.set(x, duneHeight(x, z), z);
      return;
    }
    const x = this.pos.x + fx * 440;
    const z = this.pos.z + fz * 440;
    this.beamPos.set(x, duneHeight(x, z), z);
  }

  /** animasi pilar + hitung jarak/bearing + deteksi tercapai */
  private updateBeam(dt: number) {
    void dt;
    const gy = duneHeight(this.beamPos.x, this.beamPos.z);
    this.beamPos.y = gy;
    this.beamGroup.position.set(this.beamPos.x, gy, this.beamPos.z);
    // denyut lembut: inti bernapas, semburat tanah berkedip
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.1);
    this.beamCoreMat.opacity = 0.78 + 0.17 * pulse;
    this.beamGlowMat.opacity = 0.13 + 0.06 * pulse;
    (this.beamBase.material as THREE.SpriteMaterial).opacity = 0.34 + 0.16 * pulse;
    // cincin mengembang keluar berulang → menandai titik pendaratan
    const phase = (this.time * 0.55) % 1;
    const rs = 1 + phase * 1.8;
    this.beamRing.scale.setScalar(rs);
    (this.beamRing.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - phase);

    if (this.state !== 'playing') return;
    const dx = this.beamPos.x - this.pos.x;
    const dz = this.beamPos.z - this.pos.z;
    this.beamDist = Math.hypot(dx, dz);
    const fx = Math.sin(this.camHeading);
    const fz = Math.cos(this.camHeading);
    // konvensi sama dengan navigator air terjun: kanan-layar = (-fz, fx)
    this.beamBearing = Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz);
    if (this.beamDist < 15) {
      this.beamsReached++;
      const pts = Math.round(500 * this.mult());
      this.score += pts;
      this.combo += 2;
      this.flow = clamp(this.flow + 18, 0, 100);
      this.popup('SINAR TERCAPAI ✦', `+${pts} · sinar ke-${this.beamsReached}`, 'gold');
      this.audio.chime(8, 0.2);
      this.shake = Math.min(1, this.shake + 0.25);
      this.spawnBeam();
    }
  }
}


