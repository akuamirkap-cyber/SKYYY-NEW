import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// ---------------------------------------------------------------------------
// Full color-grade pass. Runs in display space (after OutputPass) so the
// numbers behave exactly like a photo editor: contrast around mid grey,
// saturation on luminance, temperature shift, lift & gain, vignette, grain.
// ---------------------------------------------------------------------------

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
    uWarmth: { value: 0 },
    uTint: { value: 0 },
    uLift: { value: 0 },
    uGain: { value: 1 },
    uVignette: { value: 0.2 },
    uGrain: { value: 0.03 },
    uHigh: { value: 0.3 },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uContrast, uSaturation, uWarmth, uTint, uLift, uGain, uVignette, uGrain, uTime, uHigh;

    // soft shoulder: everything above the knee is gently compressed
    vec3 compressHighlights(vec3 c, float amt){
      float knee = 1.0 - amt * 0.5;
      vec3 over = max(c - knee, 0.0);
      float room = 1.0 - knee;
      vec3 comp = knee + over / (1.0 + over / max(room * 0.55, 1e-3));
      return mix(c, comp, step(knee, c));
    }
    varying vec2 vUv;

    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;

      // ---- white balance: temperature (blue<->amber) + tint (green<->magenta)
      c.r += uWarmth * 0.085;
      c.b -= uWarmth * 0.085;
      c.g += uTint * 0.055;
      c.r -= uTint * 0.022;
      c.b -= uTint * 0.033;

      // ---- lift (black point) & gain (white point)
      c = c * uGain + uLift;

      // ---- contrast around mid grey, soft filmic shoulders at the extremes
      c = (c - 0.5) * uContrast + 0.5;
      c = c / (1.0 + max(c - 1.0, 0.0));

      // ---- anti-glare: tame blown-out whites
      if (uHigh > 0.001) c = compressHighlights(c, uHigh);

      // ---- saturation on Rec.709 luminance
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);

      // ---- vignette
      vec2 d = vUv - 0.5;
      c *= max(1.0 - uVignette * dot(d, d) * 2.1, 0.0);

      // ---- fine grain (animated, mostly in the shadows)
      float n = fract(sin(dot(vUv * vec2(1024.0, 768.0) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uGrain * (1.0 - l * 0.6);

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class GradePass extends ShaderPass {
  constructor() {
    super(GradeShader);
  }

  set(
    contrast: number,
    saturation: number,
    warmth: number,
    tint: number,
    lift: number,
    gain: number,
    vignette: number,
    grain: number,
    highlights = 0,
  ) {
    const u = this.uniforms;
    u.uHigh.value = highlights;
    u.uContrast.value = contrast;
    u.uSaturation.value = saturation;
    u.uWarmth.value = warmth;
    u.uTint.value = tint;
    u.uLift.value = lift;
    u.uGain.value = gain;
    u.uVignette.value = vignette;
    u.uGrain.value = grain;
  }

  tick(t: number) {
    this.uniforms.uTime.value = t;
  }
}
