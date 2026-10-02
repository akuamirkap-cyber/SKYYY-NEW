import * as THREE from 'three';
import { buildRider, type Rider } from './model';
import { TrailRibbon } from './fx';
import { HoverRig } from './hover';
import { duneGradient, pathX, slopeSmooth } from './noise';
import { clamp } from './noise';
import type { RelicGateItem } from './relics';

export interface BotConfig {
  id: number;
  name: string;
  side: 'left' | 'right';
  slot: number;
  startOffset: number; // Lateral offset in meters at start line
  colorHex: number;
  colorStr: string;
  scarfHex: string;
  tier: 'pro' | 'balanced' | 'wildcard';
  tierLabel: string;
  maxSpeed: number; // Cruising top speed
  boostBonus: number; // Extra speed while boosting
  agility: number;
  boostChance: number;
  overtakeAggression: number;
  laneOffset: number;
}

export const BOT_CONFIGS: BotConfig[] = [
  // 3 BOT DI KIRI KITA
  {
    id: 0,
    name: 'Zephyr',
    side: 'left',
    slot: 1,
    startOffset: -6.5,
    colorHex: 0x38e8ff,
    colorStr: '#38e8ff',
    scarfHex: '#38e8ff',
    tier: 'balanced',
    tierLabel: 'Tactical Balance',
    maxSpeed: 55,
    boostBonus: 10,
    agility: 1.15,
    boostChance: 0.60,
    overtakeAggression: 0.70,
    laneOffset: -4.5,
  },
  {
    id: 1,
    name: 'Vortex',
    side: 'left',
    slot: 2,
    startOffset: -13.0,
    colorHex: 0xb572ff,
    colorStr: '#b572ff',
    scarfHex: '#b572ff',
    tier: 'wildcard',
    tierLabel: 'Freestyle Wildcard',
    maxSpeed: 51,
    boostBonus: 12,
    agility: 1.05,
    boostChance: 0.50,
    overtakeAggression: 0.60,
    laneOffset: -8.0,
  },
  {
    id: 2,
    name: 'Aero',
    side: 'left',
    slot: 3,
    startOffset: -19.5,
    colorHex: 0x3df0a2,
    colorStr: '#3df0a2',
    scarfHex: '#3df0a2',
    tier: 'pro',
    tierLabel: 'Elite Pro',
    maxSpeed: 60,
    boostBonus: 13,
    agility: 1.25,
    boostChance: 0.80,
    overtakeAggression: 0.90,
    laneOffset: -2.5,
  },
  // 3 BOT DI KANAN KITA
  {
    id: 3,
    name: 'Solaris',
    side: 'right',
    slot: 1,
    startOffset: 6.5,
    colorHex: 0xffb32e,
    colorStr: '#ffb32e',
    scarfHex: '#ffb32e',
    tier: 'balanced',
    tierLabel: 'Tactical Balance',
    maxSpeed: 54,
    boostBonus: 10,
    agility: 1.10,
    boostChance: 0.55,
    overtakeAggression: 0.65,
    laneOffset: 4.5,
  },
  {
    id: 4,
    name: 'Ignis',
    side: 'right',
    slot: 2,
    startOffset: 13.0,
    colorHex: 0xff405e,
    colorStr: '#ff405e',
    scarfHex: '#ff405e',
    tier: 'pro',
    tierLabel: 'Elite Pro',
    maxSpeed: 62,
    boostBonus: 14,
    agility: 1.35,
    boostChance: 0.85,
    overtakeAggression: 0.95,
    laneOffset: 2.0,
  },
  {
    id: 5,
    name: 'Phantom',
    side: 'right',
    slot: 3,
    startOffset: 19.5,
    colorHex: 0xe8f0ff,
    colorStr: '#e8f0ff',
    scarfHex: '#e8f0ff',
    tier: 'wildcard',
    tierLabel: 'Freestyle Wildcard',
    maxSpeed: 50,
    boostBonus: 10,
    agility: 1.00,
    boostChance: 0.45,
    overtakeAggression: 0.55,
    laneOffset: 8.0,
  },
];

const BOT_TRICKS = [
  { name: 'METHOD AIR', pose: 'method', roll: 0, yaw: 0, pitch: 0, flip: 0, spin: 0.8 },
  { name: 'KICKFLIP INDY', pose: 'indy', roll: -1, yaw: 0, pitch: 0, flip: 0, spin: 0 },
  { name: 'SUPERMAN', pose: 'superman', roll: 0, yaw: 0, pitch: 0, flip: -0.6, spin: 0 },
  { name: 'TREFLIP MELON', pose: 'melon', roll: -1, yaw: 1, pitch: 0, flip: 0, spin: 0.5 },
  { name: 'CHRIST AIR', pose: 'christ', roll: 0, yaw: 0, pitch: 0, flip: 0.4, spin: 0 },
  { name: 'STALEFISH 360', pose: 'stalefish', roll: 0, yaw: 0, pitch: 0, flip: 0, spin: 1 },
  { name: 'HEELFLIP JAPAN', pose: 'japan', roll: 1, yaw: 0, pitch: 0, flip: 0, spin: -0.5 },
  { name: 'SHUVIT TAIL', pose: 'tail', roll: 0, yaw: 1, pitch: 0, flip: 0, spin: 0 },
];

export interface BotState {
  cfg: BotConfig;
  rider: Rider;
  rig: HoverRig;
  trailGlow: TrailRibbon;
  trailSword: TrailRibbon;
  trailScarf: TrailRibbon;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  grounded: boolean;
  airTime: number;
  spin: number;
  flip: number;
  steer: number;
  isBoosting: boolean;
  boostTimer: number;
  boostCooldown: number;
  jumpCooldown: number;
  distance: number;
  // Freestyle state
  trickActive: boolean;
  trickTimer: number;
  trickDuration: number;
  trickPose: string | null;
  poseWeight: number;
  boardRoll: number;
  boardYaw: number;
  boardPitch: number;
  crouchSpring: number;
}

export class RivalBotsManager {
  group = new THREE.Group();
  bots: BotState[] = [];
  private grad = { x: 0, z: 0 };
  private hoverH = 0.6;
  private tTail = new THREE.Vector3();
  private tNeck = new THREE.Vector3();

  constructor() {
    for (const cfg of BOT_CONFIGS) {
      const rider = buildRider();
      // Papan Surf Silver Surfer: elipsoid krom mengkilap cermin (bukan pedang)
      rider.setBoard(0);
      rider.steel.roughness = 0.08;
      rider.steel.metalness = 0.96;
      rider.steel.color.setHex(0xeaf2ff);

      // Custom crystal & scarf look
      rider.crystal.color.setHex(cfg.colorHex);
      rider.crystal.emissive.setHex(cfg.colorHex);
      rider.crystal.emissiveIntensity = 0.65;
      rider.steel.emissive.setHex(cfg.colorHex);
      rider.steel.emissiveIntensity = 0.35;
      rider.setScarfLook(0, cfg.scarfHex);

      const rig = new HoverRig();

      // Trail ekor lengkap persis seperti milik player:
      // 1. Trail pendar energi di bawah papan seluncur (trailGlow)
      const trailGlow = new TrailRibbon(90, 0.28, cfg.colorHex, 0.85, true, 0.45);
      // 2. Trail ekor bilah ujung papan Silver Surfer (trailSword)
      const trailSword = new TrailRibbon(80, 0.16, 0xffffff, 0.75, true, 0.6);
      // 3. Trail selendang/scarf mengalir di leher (trailScarf)
      const trailScarf = new TrailRibbon(70, 0.11, cfg.colorHex, 0.8, true, 0.35);

      this.group.add(rider.group);
      this.group.add(trailGlow.mesh);
      this.group.add(trailSword.mesh);
      this.group.add(trailScarf.mesh);

      this.bots.push({
        cfg,
        rider,
        rig,
        trailGlow,
        trailSword,
        trailScarf,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        yaw: 0,
        grounded: true,
        airTime: 0,
        spin: 0,
        flip: 0,
        steer: 0,
        isBoosting: false,
        boostTimer: 0,
        boostCooldown: 3 + Math.random() * 5,
        jumpCooldown: 2 + Math.random() * 4,
        distance: 0,
        trickActive: false,
        trickTimer: 0,
        trickDuration: 0.8,
        trickPose: null,
        poseWeight: 0,
        boardRoll: 0,
        boardYaw: 0,
        boardPitch: 0,
        crouchSpring: 0,
      });
    }
  }

  setEnv(tex: THREE.Texture) {
    for (const b of this.bots) {
      b.rider.setEnv(tex);
    }
  }

  /**
   * Reset the 6 rival bots at the starting line alongside the player
   * 3 bots on the left, 3 bots on the right
   */
  reset(startX: number, startZ: number, startYaw: number) {
    const fx = Math.sin(startYaw);
    const fz = Math.cos(startYaw);
    const rx = -fz;
    const rz = fx;

    for (const b of this.bots) {
      const bx = startX + rx * b.cfg.startOffset;
      const bz = startZ + rz * b.cfg.startOffset;
      const gy = slopeSmooth(bx, bz, 6);
      const by = gy + this.hoverH;

      b.pos.set(bx, by, bz);
      b.vel.set(fx * 20, 0, fz * 20);
      b.yaw = startYaw;
      b.grounded = true;
      b.airTime = 0;
      b.spin = 0;
      b.flip = 0;
      b.steer = 0;
      b.isBoosting = false;
      b.boostTimer = 0;
      b.boostCooldown = 4 + Math.random() * 6;
      b.jumpCooldown = 2.5 + Math.random() * 4;
      b.distance = 0;
      b.trickActive = false;
      b.trickTimer = 0;
      b.trickDuration = 0.8;
      b.trickPose = null;
      b.poseWeight = 0;
      b.boardRoll = 0;
      b.boardYaw = 0;
      b.boardPitch = 0;
      b.crouchSpring = 0;

      b.rig.reset(bx, bz, startYaw);
      b.trailGlow.reset(b.pos, -fz, fx, 0.28);
      b.trailSword.reset(b.pos, -fz, fx, 0.16);
      b.trailScarf.reset(b.pos, -fz, fx, 0.11);

      // Initial idle stance on Silver Surfer board
      b.rider.animate(0.016, {
        time: 0,
        speed: 0.2,
        steer: 0,
        air: false,
        flipVel: 0,
        spinVel: 0,
        boost: false,
        height: 0.74,
        head: 1.08,
        sword: 0.64,
        pup: 0,
        boardRoll: 0,
        boardYaw: 0,
        boardPitch: 0,
        boardPivotZ: 0,
        feetLift: 0,
        pose: null,
        poseW: 0,
      });
      b.rig.apply(b.rider.group, bx, bz, 0, true, { tilt: 1 });
    }
  }

  /**
   * Update all 6 bots with lifelike sand-surfing physics, natural carving, Silver Surfer boards, and trail streamers
   */
  update(
    dt: number,
    state: string,
    time: number,
    nextGate: RelicGateItem | null,
    playerZ: number,
    playerSpeed: number = 46,
    onBotPassGate?: (bot: BotConfig, gate: RelicGateItem) => void,
    onBotFreestyle?: (bot: BotConfig, trickName: string) => void,
  ): { playerRank: number; leaderName: string; leaderDist: number } {
    const isPlaying = state === 'playing';

    for (const b of this.bots) {
      if (!isPlaying) {
        // Menu / paused: stay poised in stance at start line
        b.rider.animate(dt, {
          time,
          speed: 0.15,
          steer: Math.sin(time * 0.8 + b.cfg.id) * 0.12,
          air: false,
          flipVel: 0,
          spinVel: 0,
          boost: false,
          height: 0.74,
          head: 1.08,
          sword: 0.64,
          pup: 0,
          boardRoll: 0,
          boardYaw: 0,
          boardPitch: 0,
          boardPivotZ: 0,
          feetLift: 0,
          pose: null,
          poseW: 0,
        });
        b.rig.apply(b.rider.group, b.pos.x, b.pos.z, 0, true, { tilt: 1 });
        continue;
      }

      // 1. Natural Carving Path & Target Aiming
      // Pro bots carve tight racing lines; Wildcards carve wide and playful
      const carveAmplitude = b.cfg.tier === 'pro' ? 2.0 : b.cfg.tier === 'balanced' ? 3.2 : 4.6;
      const naturalCarve = Math.sin(time * 1.5 + b.cfg.id * 1.4) * (carveAmplitude * b.cfg.agility);
      let targetX = pathX(b.pos.z + 70) + naturalCarve;
      let targetZ = b.pos.z + 70;

      if (nextGate && !nextGate.cleared && nextGate.z > b.pos.z - 10) {
        // Pro bots aim dead-center into the relic gate; others spread out across lanes
        const laneMul = b.cfg.tier === 'pro' ? 0.35 : 1.0;
        targetX = nextGate.x + b.cfg.laneOffset * laneMul + naturalCarve * 0.35;
        targetZ = nextGate.z;
      }

      const desiredYaw = Math.atan2(targetX - b.pos.x, targetZ - b.pos.z);
      let dyaw = desiredYaw - b.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;

      // Natural, smooth steering with banking
      const steerRate = (b.cfg.tier === 'pro' ? 6.2 : 5.0) * b.cfg.agility;
      b.yaw += dyaw * (1 - Math.exp(-dt * steerRate));
      b.steer += (clamp(dyaw * 2.5, -1, 1) - b.steer) * (1 - Math.exp(-dt * 10));

      const fx = Math.sin(b.yaw);
      const fz = Math.cos(b.yaw);

      // 2. Downhill Acceleration & Tier-Based Racing AI
      duneGradient(b.pos.x, b.pos.z, 8, this.grad);
      const gF = this.grad.x * fx + this.grad.z * fz; // < 0 is downhill
      if (b.grounded && gF < 0) {
        const downhillPush = b.cfg.tier === 'pro' ? 34 : b.cfg.tier === 'balanced' ? 28 : 24;
        b.vel.x -= fx * gF * downhillPush * dt;
        b.vel.z -= fz * gF * downhillPush * dt;
      }

      const distFromPlayer = b.pos.z - playerZ;

      // Smart Boosting / Overtake Trigger:
      b.boostCooldown -= dt;
      if (b.boostCooldown <= 0 && b.grounded && gF < -0.02) {
        let wantBoost = false;

        if (distFromPlayer < 0 && distFromPlayer > -35) {
          // Bot is BEHIND player: high chance to boost and overtake!
          wantBoost = Math.random() < b.cfg.boostChance;
        } else if (distFromPlayer >= 0 && distFromPlayer < 24) {
          // Bot is leading by a little bit: pro bots actively defend their lead by boosting!
          wantBoost = b.cfg.tier === 'pro' && Math.random() < 0.45;
        }

        if (wantBoost) {
          b.isBoosting = true;
          b.boostTimer = 1.3 + Math.random() * 0.7;
          b.boostCooldown = (b.cfg.tier === 'pro' ? 5.5 : 8) + Math.random() * 6;
        }
      }

      if (b.isBoosting) {
        b.boostTimer -= dt;
        if (b.boostTimer <= 0) b.isBoosting = false;
      }

      // Calculate Target Speed:
      let targetTopSpeed = b.cfg.maxSpeed;
      if (b.isBoosting) targetTopSpeed += b.cfg.boostBonus;

      // DYNAMIC RACE COMPETITIVENESS:
      if (distFromPlayer > 0) {
        // Bot is AHEAD of player:
        if (b.cfg.tier === 'pro') {
          // Pro bots keep a fast competitive pace (56 - 64 m/s).
          // They only ease off if their lead exceeds 32m so the player can always catch them!
          if (distFromPlayer > 32) {
            const leadPenalty = clamp((distFromPlayer - 32) * 0.04, 0, 0.35);
            targetTopSpeed *= (1 - leadPenalty);
          }
        } else if (b.cfg.tier === 'balanced') {
          // Balanced bots maintain 50 - 55 m/s, easing off if lead exceeds 22m
          if (distFromPlayer > 22) {
            const leadPenalty = clamp((distFromPlayer - 22) * 0.045, 0, 0.40);
            targetTopSpeed *= (1 - leadPenalty);
          }
        } else {
          // Wildcard bots ease off if lead exceeds 14m
          if (distFromPlayer > 14) {
            const leadPenalty = clamp((distFromPlayer - 14) * 0.05, 0, 0.45);
            targetTopSpeed *= (1 - leadPenalty);
          }
        }
      } else {
        // Bot is BEHIND player:
        // Pro bots push hard to overtake!
        if (b.cfg.tier === 'pro') {
          if (distFromPlayer > -30) {
            // Right on player's tail: surge forward with speed matching or exceeding player!
            targetTopSpeed = Math.max(targetTopSpeed, playerSpeed + 3.5);
          } else {
            // Far behind: strong catch-up
            const catchup = clamp((-distFromPlayer - 30) * 0.03, 0, 0.35);
            targetTopSpeed *= (1 + catchup);
          }
        } else if (b.cfg.tier === 'balanced') {
          if (distFromPlayer > -25) {
            targetTopSpeed = Math.max(targetTopSpeed, playerSpeed + 0.5);
          } else {
            const catchup = clamp((-distFromPlayer - 25) * 0.025, 0, 0.28);
            targetTopSpeed *= (1 + catchup);
          }
        } else {
          // Wildcard catch-up
          if (distFromPlayer < -25) {
            const catchup = clamp((-distFromPlayer - 25) * 0.02, 0, 0.22);
            targetTopSpeed *= (1 + catchup);
          }
        }
      }

      const currentSpeed = Math.hypot(b.vel.x, b.vel.z);

      if (currentSpeed < targetTopSpeed) {
        const accel = (b.isBoosting ? 34 : 16) * dt;
        b.vel.x += fx * accel;
        b.vel.z += fz * accel;
      } else {
        const dmp = Math.exp(-0.40 * dt);
        b.vel.x *= dmp;
        b.vel.z *= dmp;
      }

      // Lateral carve friction (skate grip)
      const fwdSpeed = b.vel.x * fx + b.vel.z * fz;
      const latX = b.vel.x - fx * fwdSpeed;
      const latZ = b.vel.z - fz * fwdSpeed;
      const grip = b.grounded ? 3.6 : 0.45;
      const gk = Math.exp(-grip * dt);
      b.vel.x = fx * fwdSpeed + latX * gk;
      b.vel.z = fz * fwdSpeed + latZ * gk;

      // 3. Movement
      b.pos.x += b.vel.x * dt;
      b.pos.z += b.vel.z * dt;
      b.distance += fwdSpeed * dt;

      // 4. Natural Jumps & Terrain Physics
      const groundY = slopeSmooth(b.pos.x, b.pos.z, 6);
      const targetHoverY = groundY + this.hoverH;

      // Active freestyle jumps by bots on mound or open dunes
      b.jumpCooldown -= dt;
      if (b.grounded && b.jumpCooldown <= 0 && currentSpeed > 40) {
        b.jumpCooldown = 4.5 + Math.random() * 5.0;
        b.vel.y = 12.0 + Math.random() * 5.5;
        b.grounded = false;
        b.crouchSpring = 0.7;
      }

      if (b.pos.y <= targetHoverY + 0.15 && b.vel.y <= 1.0) {
        if (!b.grounded) {
          b.grounded = true;
          b.trickActive = false;
          b.poseWeight = 0;
          b.trickPose = null;
          b.crouchSpring = 0.5;
        }
        b.pos.y = targetHoverY;
        b.vel.y = 0;
        b.airTime = 0;
      } else {
        if (b.grounded) {
          b.grounded = false;
          b.airTime = 0;
        }
        b.airTime += dt;
        b.vel.y -= 38 * dt;
        b.pos.y += b.vel.y * dt;

        // Start a freestyle trick if not active
        if (!b.trickActive && b.airTime > 0.08) {
          b.trickActive = true;
          const tr = BOT_TRICKS[Math.floor(Math.random() * BOT_TRICKS.length)];
          b.trickPose = tr.pose;
          b.trickDuration = 0.9 + Math.random() * 0.4;
          b.trickTimer = 0;
          b.poseWeight = 0;

          if (Math.abs(b.pos.z - playerZ) < 35) {
            onBotFreestyle?.(b.cfg, tr.name);
          }
        }
      }

      // 5. Procedural Freestyle Animations
      if (b.trickActive && !b.grounded) {
        b.trickTimer += dt;
        const progress = clamp(b.trickTimer / b.trickDuration, 0, 1);
        b.poseWeight = progress < 0.3 ? progress / 0.3 : progress < 0.75 ? 1.0 : (1.0 - progress) / 0.25;

        b.boardRoll += dt * 5.5;
        b.boardYaw += dt * 3.0;
        b.spin += dt * 2.4;
        b.flip += dt * 1.2;
      } else {
        b.poseWeight = Math.max(0, b.poseWeight - dt * 7);
        b.boardRoll *= Math.exp(-dt * 12);
        b.boardYaw *= Math.exp(-dt * 12);
        b.boardPitch *= Math.exp(-dt * 12);
        b.spin *= Math.exp(-dt * 8);
        b.flip *= Math.exp(-dt * 8);
      }

      b.crouchSpring *= Math.exp(-dt * 6);

      // Check crossing relic gate
      if (nextGate && !nextGate.cleared) {
        const gdx = b.pos.x - nextGate.x;
        const gdz = b.pos.z - nextGate.z;
        const distToGate = Math.hypot(gdx, gdz);
        if (distToGate < nextGate.width * 0.5 + 2.0 && Math.abs(gdz) < 5.0) {
          nextGate.cleared = true;
          onBotPassGate?.(b.cfg, nextGate);
        }
      }

      // 6. Visuals & Posing
      b.rider.animate(dt, {
        time,
        speed: clamp(currentSpeed / 70, 0, 1),
        steer: b.steer,
        air: !b.grounded,
        flipVel: !b.grounded ? b.flip : 0,
        spinVel: !b.grounded ? b.spin : 0,
        boost: b.isBoosting,
        height: 0.74 - b.crouchSpring * 0.12,
        head: 1.08,
        sword: 0.64,
        pup: 0,
        boardRoll: b.boardRoll + b.steer * 0.22,
        boardYaw: b.boardYaw,
        boardPitch: b.boardPitch,
        boardPivotZ: 0,
        feetLift: b.poseWeight > 0.1 ? 0.35 * b.poseWeight : 0,
        pose: b.trickPose,
        poseW: b.poseWeight,
      });

      b.rig.update(
        dt,
        b.grounded,
        b.pos.x,
        b.pos.z,
        b.pos.y,
        b.vel.y,
        b.yaw,
        b.spin,
        b.steer * 0.35,
        {
          rideHeight: 0.65,
          softness: 0.5,
          bumpFilter: 6,
          tilt: 0.8,
          tiltSmooth: 0.7,
          glide: 0.85,
        },
      );
      b.rig.apply(b.rider.group, b.pos.x, b.pos.z, b.steer, b.grounded, { tilt: 0.8 });

      // 7. TRAIL EKOR KAYA & DINAMIS PERSIS SEPERTI MILIK PLAYER
      b.trailGlow.tick(dt);
      b.trailSword.tick(dt);
      b.trailScarf.tick(dt);

      b.rider.tail.getWorldPosition(this.tTail);
      b.rider.neck.getWorldPosition(this.tNeck);

      const rn = -fz;
      const sn = fx;
      const speed = currentSpeed;
      const nearGround = b.grounded || b.pos.y < groundY + 1.5;

      if (nearGround) {
        // Ekor pendar cahaya dari bagian belakang papan Silver Surfer
        b.trailGlow.push(
          this.tTail,
          rn,
          sn,
          b.isBoosting ? 0.38 : (0.16 + Math.min(0.12, speed * 0.002)),
        );
        // Ekor putih tajam di ujung papan krom Silver Surfer
        b.trailSword.push(
          this.tTail,
          rn,
          sn,
          (0.10 + Math.min(0.14, speed * 0.0025)),
        );
      }

      // Ekor selendang yang melambai di belakang leher bot
      b.trailScarf.push(this.tNeck, rn * 0.5, sn * 0.5, 0.09);
    }

    // Rank calculation: player vs the 6 rival bots based on downhill distance along Z
    let playerRank = 1;
    let leaderName = 'Kamu';
    let maxZ = playerZ;

    for (const b of this.bots) {
      if (b.pos.z > playerZ) {
        playerRank++;
      }
      if (b.pos.z > maxZ) {
        maxZ = b.pos.z;
        leaderName = b.cfg.name;
      }
    }

    return {
      playerRank,
      leaderName,
      leaderDist: Math.max(0, maxZ - playerZ),
    };
  }

  /**
   * Check if the player is drafting directly behind any rival bot
   * Returns active state and bot name for slipstream drafting speed boost
   */
  checkSlipstream(playerPos: THREE.Vector3): { active: boolean; botName: string } {
    for (const b of this.bots) {
      const dz = b.pos.z - playerPos.z;
      const dx = Math.abs(b.pos.x - playerPos.x);
      // In front of player between 2.0m and 28m, and within 3.6m laterally
      if (dz > 2.0 && dz < 28 && dx < 3.6) {
        return { active: true, botName: b.cfg.name };
      }
    }
    return { active: false, botName: '' };
  }

  dispose() {
    for (const b of this.bots) {
      b.trailGlow.mesh.geometry.dispose();
      (b.trailGlow.mesh.material as THREE.Material).dispose();
      b.trailSword.mesh.geometry.dispose();
      (b.trailSword.mesh.material as THREE.Material).dispose();
      b.trailScarf.mesh.geometry.dispose();
      (b.trailScarf.mesh.material as THREE.Material).dispose();
    }
  }
}
