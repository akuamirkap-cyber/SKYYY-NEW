import * as THREE from 'three';

// ---------------------------------------------------------------------------
// GPU friendly particle pool (single draw call) -------------------------------
// ---------------------------------------------------------------------------
export class Particles {
  points: THREE.Points;
  private cap: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private aSize: THREE.BufferAttribute;
  private aAlpha: THREE.BufferAttribute;
  private aColor: THREE.BufferAttribute;
  private baseSize: Float32Array;
  private baseAlpha: Float32Array;
  private cursor = 0;
  private uIntensity = { value: 1 };

  setIntensity(v: number) {
    this.uIntensity.value = v;
  }

  constructor(cap: number, additive: boolean) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.baseSize = new Float32Array(cap);
    this.baseAlpha = new Float32Array(cap);

    const size = new Float32Array(cap);
    const alpha = new Float32Array(cap);
    const color = new Float32Array(cap * 3);

    const geo = new THREE.BufferGeometry();
    const pAttr = new THREE.BufferAttribute(this.pos, 3);
    pAttr.setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(size, 1);
    this.aAlpha = new THREE.BufferAttribute(alpha, 1);
    this.aColor = new THREE.BufferAttribute(color, 3);
    this.aSize.setUsage(THREE.DynamicDrawUsage);
    this.aAlpha.setUsage(THREE.DynamicDrawUsage);
    this.aColor.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pAttr);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aColor', this.aColor);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: makeGlowTexture() }, uIntensity: this.uIntensity },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vA; varying vec3 vC;
        void main(){
          vA = aAlpha; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // cap ukuran di layar: partikel dekat kamera tidak membengkak jadi blob raksasa
          gl_PointSize = min(aSize * (420.0 / max(0.001, -mv.z)), 110.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uIntensity;
        varying float vA; varying vec3 vC;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d) * 4.0;
          float a = smoothstep(1.0, 0.1, r) * vA * uIntensity;
          if (a < 0.004) discard;
          ${additive ? 'gl_FragColor = vec4(vC * a, a);' : 'gl_FragColor = vec4(vC, a);'}
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    life: number,
    r: number,
    g: number,
    b: number,
    alpha: number,
    grav: number,
    drag: number,
  ) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    const o = i * 3;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.vel[o] = vx;
    this.vel[o + 1] = vy;
    this.vel[o + 2] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.baseSize[i] = size;
    this.baseAlpha[i] = alpha;
    (this.aColor.array as Float32Array)[o] = r;
    (this.aColor.array as Float32Array)[o + 1] = g;
    (this.aColor.array as Float32Array)[o + 2] = b;
  }

  update(dt: number) {
    const n = this.cap;
    const size = this.aSize.array as Float32Array;
    const alpha = this.aAlpha.array as Float32Array;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) {
        if (alpha[i] !== 0) {
          alpha[i] = 0;
          size[i] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.max[i]);
      const o = i * 3;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[o] *= k;
      this.vel[o + 2] *= k;
      this.vel[o + 1] = this.vel[o + 1] * k + this.grav[i] * dt;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      const g = t * t;
      size[i] = this.baseSize[i] * (0.5 + (1 - t) * 1.6);
      alpha[i] = this.baseAlpha[i] * g;
    }
    this.aSize.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aColor.needsUpdate = true;
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Expanding ground rings -----------------------------------------------------
// ---------------------------------------------------------------------------
export class Ripples {
  group: THREE.Group = new THREE.Group();
  private pool: THREE.Mesh[] = [];
  private life: number[] = [];
  private maxLife: number[] = [];
  private grow: number[] = [];
  /** brightness multiplier (anti-glare) */
  mul = 1;

  constructor(count = 16) {
    const geo = new THREE.RingGeometry(0.72, 1, 44);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe9c8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.group.add(m);
      this.pool.push(m);
      this.life.push(0);
      this.maxLife.push(1);
      this.grow.push(1);
    }
  }

  spawn(p: THREE.Vector3, n: THREE.Vector3, size: number, dur: number, color = 0xffe9c8) {
    let idx = -1;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.life[i] <= 0) {
        idx = i;
        break;
      }
    }
    if (idx < 0) idx = 0;
    const m = this.pool[idx];
    m.visible = true;
    m.position.copy(p).addScaledVector(n, 0.08);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    m.scale.setScalar(size * 0.25);
    (m.material as THREE.MeshBasicMaterial).color.setHex(color);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.life[idx] = dur;
    this.maxLife[idx] = dur;
    this.grow[idx] = size;
  }

  update(dt: number) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i] / this.maxLife[i]);
      const m = this.pool[i];
      m.scale.setScalar(0.25 * this.grow[i] + t * this.grow[i]);
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - t) * (1 - t) * 0.85 * this.mul;
      if (this.life[i] <= 0) m.visible = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Glowing ribbon trail -------------------------------------------------------
// ---------------------------------------------------------------------------
export class TrailRibbon {
  mesh: THREE.Mesh;
  private n: number;
  private cx: Float32Array;
  private cy: Float32Array;
  private cz: Float32Array;
  private sx: Float32Array;
  private sz: Float32Array;
  private w: Float32Array;
  private age: Float32Array;
  private posA: THREE.BufferAttribute;
  private alpA: THREE.BufferAttribute;
  private pos: Float32Array;
  private alp: Float32Array;
  private lifetime: number;

  private intensity = 0.9;
  /** runtime multiplier (used by the anti-glare "glow fx" slider) */
  mul = 1;
  private uColor = { value: new THREE.Vector3(1, 1, 1) };

  setColor(c: THREE.Color) {
    this.uColor.value.set(c.r, c.g, c.b);
  }

  constructor(n = 200, width = 0.5, color = 0xffd9a0, lifetime = 1.1, additive = true, intensity = 0.9) {
    this.n = n;
    this.lifetime = lifetime;
    this.intensity = intensity;
    this.cx = new Float32Array(n);
    this.cy = new Float32Array(n);
    this.cz = new Float32Array(n);
    this.sx = new Float32Array(n);
    this.sz = new Float32Array(n);
    this.w = new Float32Array(n);
    this.age = new Float32Array(n);
    this.w.fill(width);
    this.pos = new Float32Array(n * 2 * 3);
    this.alp = new Float32Array(n * 2);

    const uvs = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      uvs[i * 2] = 0.0;
      uvs[i * 2 + 1] = 1.0;
    }

    const idx = new Uint32Array((n - 1) * 6);
    let k = 0;
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      idx[k++] = a;
      idx[k++] = a + 1;
      idx[k++] = a + 2;
      idx[k++] = a + 1;
      idx[k++] = a + 3;
      idx[k++] = a + 2;
    }
    const geo = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(this.pos, 3);
    this.alpA = new THREE.BufferAttribute(this.alp, 1);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    this.alpA.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posA);
    geo.setAttribute('aAlpha', this.alpA);
    geo.setAttribute('aU', new THREE.BufferAttribute(uvs, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const col = new THREE.Color(color);
    this.uColor.value.set(col.r, col.g, col.b);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: this.uColor },
      vertexShader: `
        attribute float aAlpha; attribute float aU; varying float vA; varying float vU;
        void main(){ vA = aAlpha; vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uColor; varying float vA; varying float vU;
        void main(){
          float edge = clamp(1.0 - pow(abs(vU - 0.5) * 2.0, 2.0), 0.0, 1.0);
          float a = vA * edge;
          if (a < 0.003) discard;
          ${additive ? 'gl_FragColor = vec4(uColor * a * 0.72, a);' : 'gl_FragColor = vec4(uColor, a);'}
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  reset(p: THREE.Vector3, sideX: number, sideZ: number, width: number) {
    for (let i = 0; i < this.n; i++) {
      this.cx[i] = p.x;
      this.cy[i] = p.y;
      this.cz[i] = p.z;
      this.sx[i] = sideX;
      this.sz[i] = sideZ;
      this.w[i] = width;
      this.age[i] = this.lifetime;
    }
    this.write();
  }

  push(p: THREE.Vector3, sideX: number, sideZ: number, width: number) {
    const n = this.n;
    this.cx.copyWithin(1, 0, n - 1);
    this.cy.copyWithin(1, 0, n - 1);
    this.cz.copyWithin(1, 0, n - 1);
    this.sx.copyWithin(1, 0, n - 1);
    this.sz.copyWithin(1, 0, n - 1);
    this.w.copyWithin(1, 0, n - 1);
    this.age.copyWithin(1, 0, n - 1);
    this.cx[0] = p.x;
    this.cy[0] = p.y;
    this.cz[0] = p.z;
    this.sx[0] = sideX;
    this.sz[0] = sideZ;
    this.w[0] = width;
    this.age[0] = 0;
    this.write();
  }

  private write() {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      const t = 1 - Math.min(1, this.age[i] / this.lifetime);
      // Aerodynamic taper from the sword to the trailing tip
      const taper = Math.min(1, Math.sqrt(Math.max(0, t)) * 1.05);
      const hw = this.w[i] * taper;
      this.pos[o] = this.cx[i] - this.sx[i] * hw;
      this.pos[o + 1] = this.cy[i];
      this.pos[o + 2] = this.cz[i] - this.sz[i] * hw;
      this.pos[o + 3] = this.cx[i] + this.sx[i] * hw;
      this.pos[o + 4] = this.cy[i];
      this.pos[o + 5] = this.cz[i] + this.sz[i] * hw;
      const a = t * t * this.intensity * this.mul;
      this.alp[i * 2] = a;
      this.alp[i * 2 + 1] = a;
    }
    this.posA.needsUpdate = true;
    this.alpA.needsUpdate = true;
  }

  tick(dt: number) {
    for (let i = 0; i < this.n; i++) this.age[i] += dt;
  }
}

// ---------------------------------------------------------------------------
// WIND STREAKS — aliran angin yang terasa: garis-garis halus lewat di sekitar
// rider searah hembusan (kebalikan kecepatan), makin kencang makin terlihat.
// Additive lembut, tidak pernah menua jadi "noise" — meluruh saat pelan.
// ---------------------------------------------------------------------------
export class WindStreaks {
  lines: THREE.LineSegments;
  private n: number;
  private pts: THREE.Vector3[] = [];
  private posA: THREE.BufferAttribute;
  private colA: THREE.BufferAttribute;
  private seeds: number[] = [];
  private flow = new THREE.Vector3(0, 0, 1);
  private tmp = new THREE.Vector3();
  private box = 44;
  private intensity = 0;

  constructor(count = 46) {
    this.n = count;
    const pos = new Float32Array(count * 2 * 3);
    const col = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i++) {
      this.pts.push(new THREE.Vector3());
      this.seeds.push(Math.random() * 100);
      this.respawn(i, new THREE.Vector3());
    }
    const geo = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(pos, 3);
    this.colA = new THREE.BufferAttribute(col, 3);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    this.colA.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posA);
    geo.setAttribute('color', this.colA);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.lines = new THREE.LineSegments(geo, mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 6;
  }

  private respawn(i: number, center: THREE.Vector3) {
    const s = this.seeds[i];
    const r = 6 + (s % 1) * (this.box * 0.5);
    const a = s * 2.399;
    this.pts[i].set(
      center.x + Math.cos(a) * r,
      center.y + (Math.sin(s * 7.3) * 0.5 + 0.15) * this.box * 0.42,
      center.z + Math.sin(a) * r,
    );
  }

  /**
   * @param intensity 0..1 — dari kecepatan rider; 0 = memudar penuh (tak tampak)
   */
  update(dt: number, center: THREE.Vector3, vel: THREE.Vector3, intensity: number) {
    this.intensity += (Math.max(0, Math.min(1, intensity)) - this.intensity) * (1 - Math.exp(-dt * 3));
    const spd = vel.length();
    if (spd > 0.4) this.flow.copy(vel).multiplyScalar(1 / spd);
    else this.flow.lerp(this.tmp.set(0, 0, 1), 1 - Math.exp(-dt * 2)).normalize();
    this.lines.visible = this.intensity > 0.02;
    if (!this.lines.visible) return;

    const pos = this.posA.array as Float32Array;
    const col = this.colA.array as Float32Array;
    // panjang goresan & kecepatan aliran mengikuti angin sembunyi
    const len = 0.9 + Math.min(spd, 90) * 0.035;
    const adv = (5 + Math.min(spd, 90) * 0.75) * dt;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[i];
      // mengalir melawan arah gerak (angin relatif lewat dari depan)
      p.addScaledVector(this.flow, -adv);
      // drift lateral lembut — aliran tidak kaku
      const s = this.seeds[i];
      p.x += Math.sin(s + p.z * 0.05) * dt * 0.7;
      p.y += Math.cos(s * 1.3 + p.z * 0.04) * dt * 0.5;
      // bila tertinggal di luar kotak di sekitar rider → daur ulang ke depan
      this.tmp.subVectors(p, center);
      if (Math.abs(this.tmp.x) > this.box || Math.abs(this.tmp.z) > this.box || Math.abs(this.tmp.y) > this.box * 0.6) {
        this.respawn(i, center);
        p.addScaledVector(this.flow, 8 + Math.random() * 14); // muncul dari depan
        continue;
      }
      const k = i * 6;
      pos[k] = p.x;
      pos[k + 1] = p.y;
      pos[k + 2] = p.z;
      const ex = p.x + this.flow.x * len;
      const ey = p.y + this.flow.y * len;
      const ez = p.z + this.flow.z * len;
      pos[k + 3] = ex;
      pos[k + 4] = ey;
      pos[k + 5] = ez;
      // keceruan: pangkal lebih terang, ujung memudar (pseudo-alpha via warna)
      const b = this.intensity * (0.1 + 0.16 * (0.5 + 0.5 * Math.sin(s * 3.1 + i)));
      col[k] = b;
      col[k + 1] = b * 1.04;
      col[k + 2] = b * 1.12;
      col[k + 3] = b * 0.25;
      col[k + 4] = b * 0.27;
      col[k + 5] = b * 0.32;
    }
    this.posA.needsUpdate = true;
    this.colA.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Ambient floating motes (world wrapped, zero CPU) --------------------------
// ---------------------------------------------------------------------------
export class Motes {
  points: THREE.Points;
  private uTime = { value: 0 };
  private uCenter = { value: new THREE.Vector3() };
  private uMul = { value: 1 };

  setIntensity(v: number) {
    this.uMul.value = v;
    this.points.visible = v > 0.01;
  }
  constructor(count = 260, box = 95) {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * box;
      pos[i * 3 + 1] = Math.random() * box * 0.55;
      pos[i * 3 + 2] = Math.random() * box;
      size[i] = 0.25 + Math.random() * 0.75;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.uTime,
        uCenter: this.uCenter,
        uMul: this.uMul,
        uBox: { value: box },
        uHeight: { value: box * 0.55 },
      },
      vertexShader: `
        uniform float uTime; uniform vec3 uCenter; uniform float uBox; uniform float uHeight;
        attribute float aSize; varying float vA;
        void main(){
          vec3 org = uCenter - vec3(uBox*0.5, 0.0, uBox*0.5);
          vec3 rel = mod(position + vec3(uTime*1.4, uTime*0.7, uTime*0.9), vec3(uBox, uHeight, uBox));
          vec3 wp = org + rel;
          vec4 mv = modelViewMatrix * vec4(wp, 1.0);
          float fade = 1.0 - smoothstep(0.62, 1.0, max(abs(rel.x/uBox - 0.5), abs(rel.z/uBox - 0.5)) * 2.0);
          vA = fade * 0.55;
          gl_PointSize = aSize * (300.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uMul;
        varying float vA;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(1.0, 0.1, dot(d,d)*4.0) * vA * uMul;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vec3(1.0, 0.94, 0.82) * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.matrixAutoUpdate = false;
  }

  update(dt: number, center: THREE.Vector3) {
    this.uTime.value += dt;
    this.uCenter.value.copy(center);
  }
}

// ---------------------------------------------------------------------------
// Canvas textures ------------------------------------------------------------
// ---------------------------------------------------------------------------
export function makeGlowTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSoftDiscTexture(): THREE.Texture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  return t;
}
