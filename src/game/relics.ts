import * as THREE from 'three';
import { duneHeight, pathX } from './noise';

export interface RelicGateItem {
  id: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  width: number;
  height: number;
  cleared: boolean;
  missed: boolean;
}

export type RelicPassOutcome = 'passed' | 'missed' | 'none';

export interface RelicPassResult {
  outcome: RelicPassOutcome;
  gateId: number;
  streak: number;
  dist: number;
}

export class DownhillRelics {
  group = new THREE.Group();
  gates: RelicGateItem[] = [];

  // Instanced meshes for performance
  private posts: THREE.InstancedMesh;
  private postCaps: THREE.InstancedMesh;
  private relicCores: THREE.InstancedMesh;
  private relicRings: THREE.InstancedMesh;
  private beams: THREE.InstancedMesh;
  private energyVeils: THREE.InstancedMesh;

  private postMat: THREE.MeshStandardMaterial;
  private capMat: THREE.MeshStandardMaterial;
  private coreMat: THREE.MeshStandardMaterial;
  private ringMat: THREE.MeshStandardMaterial;
  private beamMat: THREE.MeshBasicMaterial;
  private veilMat: THREE.MeshBasicMaterial;

  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);

  private readonly maxGates = 24;
  private lastSpawnZ = 0;
  private gateCounter = 0;

  // Streak & progress
  streak = 0;
  totalPassed = 0;
  totalMissed = 0;
  lastMissedTime = 0;

  constructor() {
    // 1. Pillar geometry: tapered obelisk columns marking gate edges (2x larger: 16m high)
    const postGeo = new THREE.CylinderGeometry(0.7, 1.3, 16.0, 8);
    postGeo.translate(0, 8.0, 0);
    this.postMat = new THREE.MeshStandardMaterial({
      color: 0x8a7762,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
      emissive: new THREE.Color(0x382814),
      emissiveIntensity: 0.4,
    });
    // 2 posts per gate
    this.posts = new THREE.InstancedMesh(postGeo, this.postMat, this.maxGates * 2);
    this.posts.frustumCulled = false;

    // 2. Post Caps: glowing sun stones atop each pillar (2x larger)
    const capGeo = new THREE.OctahedronGeometry(1.3, 0);
    this.capMat = new THREE.MeshStandardMaterial({
      color: 0xffe894,
      emissive: new THREE.Color(0xffb834),
      emissiveIntensity: 2.8,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.postCaps = new THREE.InstancedMesh(capGeo, this.capMat, this.maxGates * 2);
    this.postCaps.frustumCulled = false;

    // 3. Central Sun Relic Core: floating radiant star crystal (2x larger)
    const coreGeo = new THREE.OctahedronGeometry(2.4, 0);
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0xfff6c2,
      emissive: new THREE.Color(0xffca45),
      emissiveIntensity: 3.2,
      roughness: 0.1,
      metalness: 0.2,
    });
    this.relicCores = new THREE.InstancedMesh(coreGeo, this.coreMat, this.maxGates);
    this.relicCores.frustumCulled = false;

    // 4. Solar Ring around Relic Core (2x larger)
    const ringGeo = new THREE.TorusGeometry(3.6, 0.24, 8, 24);
    this.ringMat = new THREE.MeshStandardMaterial({
      color: 0xffd970,
      emissive: new THREE.Color(0xffaa20),
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0.3,
    });
    this.relicRings = new THREE.InstancedMesh(ringGeo, this.ringMat, this.maxGates);
    this.relicRings.frustumCulled = false;

    // 5. Sky Light Beacon shooting up into the sky from the relic gate (2x grander)
    const beamGeo = new THREE.CylinderGeometry(0.8, 2.5, 260, 8, 1, true);
    beamGeo.translate(0, 130, 0);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe082,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.beams = new THREE.InstancedMesh(beamGeo, this.beamMat, this.maxGates);
    this.beams.frustumCulled = false;

    // 6. Translucent energy curtain between pillars
    const veilGeo = new THREE.PlaneGeometry(1, 1);
    this.veilMat = new THREE.MeshBasicMaterial({
      color: 0xffd269,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.energyVeils = new THREE.InstancedMesh(veilGeo, this.veilMat, this.maxGates);
    this.energyVeils.frustumCulled = false;

    this.group.add(this.posts, this.postCaps, this.relicCores, this.relicRings, this.beams, this.energyVeils);

    // Initialize all to invisible
    for (let i = 0; i < this.maxGates * 2; i++) {
      this.posts.setMatrixAt(i, this.zero);
      this.postCaps.setMatrixAt(i, this.zero);
    }
    for (let i = 0; i < this.maxGates; i++) {
      this.relicCores.setMatrixAt(i, this.zero);
      this.relicRings.setMatrixAt(i, this.zero);
      this.beams.setMatrixAt(i, this.zero);
      this.energyVeils.setMatrixAt(i, this.zero);
    }
  }

  setGlow(v: number) {
    this.capMat.emissiveIntensity = 2.8 * v;
    this.coreMat.emissiveIntensity = 3.2 * v;
    this.ringMat.emissiveIntensity = 2.5 * v;
    this.beamMat.opacity = Math.min(0.48, 0.32 * v);
    this.veilMat.opacity = Math.min(0.35, 0.20 * v);
  }

  /** Reset all gates when starting a new run */
  reset(playerZ: number) {
    this.gates = [];
    this.lastSpawnZ = playerZ + 400;
    this.gateCounter = 0;
    this.streak = 0;
    this.totalPassed = 0;
    this.totalMissed = 0;
    this.lastMissedTime = 0;

    // Pre-spawn initial sequence of downhill gates
    for (let i = 0; i < this.maxGates; i++) {
      this.spawnNextGate();
    }
  }

  private spawnNextGate() {
    this.gateCounter++;
    // Downhill spacing: significantly increased to 750-1100m for rare, epic downhill milestone monuments
    const spacing = 750 + ((this.gateCounter * 73) % 350);
    const z = this.lastSpawnZ + spacing;
    this.lastSpawnZ = z;

    // Slalom lateral weave: gentle, flowing sweeping curves down the dunes
    const weave = Math.sin(this.gateCounter * 1.1) * 20;
    const x = pathX(z) + weave;
    const y = duneHeight(x, z);

    // Orientation: tangent along the approach & exit glide trajectory
    // Taking points before and after gives the true tangent angle, so the gate is perfectly perpendicular to the player's approach!
    const zBefore = z - 30;
    const xBefore = pathX(zBefore) + Math.sin((this.gateCounter - 0.05) * 1.1) * 20;
    const zAfter = z + 30;
    const xAfter = pathX(zAfter) + Math.sin((this.gateCounter + 0.05) * 1.1) * 20;
    const dx = xAfter - xBefore;
    const dz = zAfter - zBefore;
    const rot = Math.atan2(dx, dz);

    const gate: RelicGateItem = {
      id: this.gateCounter,
      x,
      y,
      z,
      rot,
      width: 22.0, // 2x larger gate entrance (22m wide)
      height: 14.5, // 2x larger height (14.5m tall)
      cleared: false,
      missed: false,
    };

    if (this.gates.length >= this.maxGates) {
      this.gates.shift();
    }
    this.gates.push(gate);
  }

  /**
   * Check if player passes through a relic gate, or misses one ("GABOLEH TERLEWAT")!
   */
  checkPass(p: THREE.Vector3, dt: number): RelicPassResult {
    void dt;
    for (const g of this.gates) {
      if (g.cleared || g.missed) continue;

      const dx = p.x - g.x;
      const dz = p.z - g.z;

      // Project onto gate local axes:
      // Gate forward is (Math.sin(g.rot), Math.cos(g.rot))
      // Gate lateral is (Math.cos(g.rot), -Math.sin(g.rot))
      const fwd = dx * Math.sin(g.rot) + dz * Math.cos(g.rot);
      const lat = dx * Math.cos(g.rot) - dz * Math.sin(g.rot);
      const halfW = g.width * 0.5 + 2.5;

      // 1. PASSED THROUGH GATE
      if (Math.abs(fwd) < 5.5 && Math.abs(lat) <= halfW) {
        // Vertical check: generous clearance from sand surface up to top of arch
        if (p.y >= g.y - 1.5 && p.y <= g.y + g.height + 6.0) {
          g.cleared = true;
          this.streak++;
          this.totalPassed++;
          return {
            outcome: 'passed',
            gateId: g.id,
            streak: this.streak,
            dist: Math.hypot(dx, dz),
          };
        }
      }

      // 2. MISSED GATE
      // Player has passed the gate in the forward downhill direction without entering
      if (fwd > 7.5 && Math.abs(lat) > halfW) {
        g.missed = true;
        this.streak = 0;
        this.totalMissed++;
        this.lastMissedTime = 1.8;
        return {
          outcome: 'missed',
          gateId: g.id,
          streak: 0,
          dist: Math.hypot(dx, dz),
        };
      }
    }

    return { outcome: 'none', gateId: 0, streak: this.streak, dist: 0 };
  }

  /**
   * Find the next upcoming unpassed gate ahead of player for the HUD compass & indicator
   */
  getNextGate(pz: number): { gate: RelicGateItem | null; dist: number; dx: number; dz: number } {
    for (const g of this.gates) {
      if (!g.cleared && !g.missed && g.z >= pz - 8) {
        const dz = g.z - pz;
        return { gate: g, dist: dz, dx: g.x, dz: g.z };
      }
    }
    return { gate: null, dist: 0, dx: 0, dz: 0 };
  }

  /**
   * Update gate positions, animations, and render instances
   */
  update(pz: number, time: number) {
    // If player approaches end of spawned gates, spawn more downhill
    while (this.lastSpawnZ < pz + 2800) {
      this.spawnNextGate();
    }

    // Write instance matrices
    for (let i = 0; i < this.maxGates; i++) {
      const g = this.gates[i];
      if (!g || g.z < pz - 80) {
        this.posts.setMatrixAt(i * 2, this.zero);
        this.posts.setMatrixAt(i * 2 + 1, this.zero);
        this.postCaps.setMatrixAt(i * 2, this.zero);
        this.postCaps.setMatrixAt(i * 2 + 1, this.zero);
        this.relicCores.setMatrixAt(i, this.zero);
        this.relicRings.setMatrixAt(i, this.zero);
        this.beams.setMatrixAt(i, this.zero);
        this.energyVeils.setMatrixAt(i, this.zero);
        continue;
      }

      const gy = duneHeight(g.x, g.z);
      g.y = gy;
      const cosR = Math.cos(g.rot);
      const sinR = Math.sin(g.rot);
      const halfW = g.width * 0.5;

      // Left and right pillars
      const lx = g.x - cosR * halfW;
      const lz = g.z + sinR * halfW;
      const ly = duneHeight(lx, lz);

      const rx = g.x + cosR * halfW;
      const rz = g.z - sinR * halfW;
      const ry = duneHeight(rx, rz);

      // Left Pillar
      this.v.set(lx, ly, lz);
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), g.rot);
      this.sc.set(1, 1, 1);
      this.m4.compose(this.v, this.q, this.sc);
      this.posts.setMatrixAt(i * 2, this.m4);

      // Left Cap
      this.v.set(lx, ly + 16.2, lz);
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), time * 1.8 + i);
      this.sc.setScalar(g.cleared ? 0.4 : 1.0);
      this.m4.compose(this.v, this.q, this.sc);
      this.postCaps.setMatrixAt(i * 2, this.m4);

      // Right Pillar
      this.v.set(rx, ry, rz);
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), g.rot);
      this.sc.set(1, 1, 1);
      this.m4.compose(this.v, this.q, this.sc);
      this.posts.setMatrixAt(i * 2 + 1, this.m4);

      // Right Cap
      this.v.set(rx, ry + 16.2, rz);
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), time * 1.8 + i + 1);
      this.sc.setScalar(g.cleared ? 0.4 : 1.0);
      this.m4.compose(this.v, this.q, this.sc);
      this.postCaps.setMatrixAt(i * 2 + 1, this.m4);

      // Sky light beacon: SELALU MENYALA MENEMBUS LANGIT (bahkan jika relic ditabrak/cleared, sinar tetap nyala!)
      this.v.set(g.x, gy, g.z);
      this.q.identity();
      this.sc.set(g.cleared ? 1.5 : 1.0, 1.0, g.cleared ? 1.5 : 1.0);
      this.m4.compose(this.v, this.q, this.sc);
      this.beams.setMatrixAt(i, this.m4);

      if (g.cleared) {
        // Hide core and veil once cleared, while the sky light beam STAYS ON!
        this.relicCores.setMatrixAt(i, this.zero);
        this.relicRings.setMatrixAt(i, this.zero);
        this.energyVeils.setMatrixAt(i, this.zero);
      } else {
        const bob = Math.sin(time * 2.4 + i * 1.5) * 0.6;
        const coreY = gy + 8.4 + bob;

        // Central Sun Relic Core
        this.v.set(g.x, coreY, g.z);
        this.q.setFromEuler(new THREE.Euler(time * 1.2, time * 1.6 + i, time * 0.7));
        this.sc.setScalar(g.missed ? 0.6 : 1.1);
        this.m4.compose(this.v, this.q, this.sc);
        this.relicCores.setMatrixAt(i, this.m4);

        // Solar Ring
        this.q.setFromEuler(new THREE.Euler(Math.PI * 0.5 + Math.sin(time * 1.5) * 0.2, g.rot + time * 1.8, 0));
        this.sc.setScalar(1.0 + Math.sin(time * 3.0 + i) * 0.08);
        this.m4.compose(this.v, this.q, this.sc);
        this.relicRings.setMatrixAt(i, this.m4);

        // Energy Veil (Gate light curtain)
        this.v.set(g.x, gy + 7.5, g.z);
        this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), g.rot);
        this.sc.set(g.width, 15.0, 1);
        this.m4.compose(this.v, this.q, this.sc);
        this.energyVeils.setMatrixAt(i, this.m4);
      }
    }

    this.posts.instanceMatrix.needsUpdate = true;
    this.postCaps.instanceMatrix.needsUpdate = true;
    this.relicCores.instanceMatrix.needsUpdate = true;
    this.relicRings.instanceMatrix.needsUpdate = true;
    this.beams.instanceMatrix.needsUpdate = true;
    this.energyVeils.instanceMatrix.needsUpdate = true;
  }
}
