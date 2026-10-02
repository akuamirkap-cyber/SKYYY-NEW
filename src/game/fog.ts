import * as THREE from 'three';

// ---------------------------------------------------------------------------
// ADVANCED FOG
// Three's built-in fog only has a density. We replace the fog shader chunks
// once, globally, with a richer model:
//
//   • start distance     – clear air around you, fog only further away
//   • distance density   – classic exponential-squared falloff
//   • valley / height fog – thick mist low in the dunes, thinning with altitude
//   • sun scattering     – fog glows warm when you look toward the sun
//   • max opacity        – distant hills never vanish completely (if desired)
//
// Extra uniforms are shared objects injected into every fog-enabled material,
// so changing a slider updates the whole world instantly, no recompiles.
// Materials that don't receive the uniforms fall back to safe defaults (0).
// ---------------------------------------------------------------------------

export const FOG_U = {
  uFogStart: { value: 0 },
  uFogHeightAmt: { value: 0 },
  uFogFalloff: { value: 0.06 },
  uFogBase: { value: 0 },
  uFogScatter: { value: 0 },
  uFogSunDir: { value: new THREE.Vector3(0, 0.3, 1) },
  uFogSunColor: { value: new THREE.Color('#ffd9a0') },
  uFogClear: { value: 0.15 },
  // world edge: ground melts into the fog seamlessly at the 500m horizon
  uFogEdgeA: { value: 380 },
  uFogEdgeB: { value: 500 },
};

let patched = false;

export function patchFogChunks() {
  if (patched) return;
  patched = true;
  const C = THREE.ShaderChunk as unknown as Record<string, string>;

  C.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;

  C.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  // world position from view space: w = R^T * mv + cameraPosition
  vFogWorld = transpose( mat3( viewMatrix ) ) * mvPosition.xyz + cameraPosition;
#endif`;

  C.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  uniform float uFogStart;
  uniform float uFogHeightAmt;
  uniform float uFogFalloff;
  uniform float uFogBase;
  uniform float uFogScatter;
  uniform vec3 uFogSunDir;
  uniform vec3 uFogSunColor;
  uniform float uFogClear;
  uniform float uFogEdgeA;
  uniform float uFogEdgeB;
#endif`;

  C.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  float fogD = max( vFogDepth - uFogStart, 0.0 );
  #ifdef FOG_EXP2
    float fogOD = fogDensity * fogDensity * fogD * fogD;
  #else
    float fogOD = - log( 1.0 - 0.999 * smoothstep( fogNear, fogFar, vFogDepth ) );
  #endif
  // VALLEY MIST: exponential height fog integrated along the whole view ray.
  float fogK = max( uFogFalloff, 1e-4 );
  float fogA0 = clamp( ( cameraPosition.y - uFogBase ) * fogK, -4.0, 40.0 );
  float fogA1 = clamp( ( vFogWorld.y - uFogBase ) * fogK, -4.0, 40.0 );
  float fogDA = fogA1 - fogA0;
  float fogLine = abs( fogDA ) > 1e-3 ? ( exp( - fogA0 ) - exp( - fogA1 ) ) / fogDA : exp( - fogA0 );
  fogOD += uFogHeightAmt * 0.009 * max( fogLine, 0.0 ) * fogD;
  float fogFactor = 1.0 - exp( - fogOD );
  fogFactor = min( fogFactor, 1.0 - uFogClear );
  // Seamless terrain border blend:
  // As terrain approaches the boundaries of the streaming mesh, smoothly melt into the horizon
  // so the player never sees polygon cutoffs or terrain chunk popping in the distance.
  float edgeSide = smoothstep( 220.0, 305.0, abs( vFogWorld.x - cameraPosition.x ) );
  float edgeFwd = smoothstep( 420.0, 580.0, vFogWorld.z - cameraPosition.z );
  float edgeBack = smoothstep( 70.0, 115.0, cameraPosition.z - vFogWorld.z );
  float meshBorder = max( edgeSide, max( edgeFwd, edgeBack ) );
  fogFactor = max( fogFactor, meshBorder );
  // sun scattering: subtle warm glow rather than blinding white glare
  vec3 fogDir = normalize( vFogWorld - cameraPosition );
  float fogSun = pow( max( dot( fogDir, uFogSunDir ), 0.0 ), 8.0 ) * clamp( uFogScatter, 0.0, 1.2 );
  vec3 fogCol = mix( fogColor, uFogSunColor, clamp( fogSun, 0.0, 0.55 ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
#endif`;
}

type FogMat = THREE.Material & { fog?: boolean; __fogInstalled?: boolean };

/** give every fog-enabled material in the tree the shared advanced-fog uniforms */
export function installFog(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as FogMat | FogMat[] | undefined;
    const list = Array.isArray(m) ? m : m ? [m] : [];
    for (const mat of list) {
      if (!mat || !mat.fog || mat.__fogInstalled) continue;
      mat.__fogInstalled = true;
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (sh, r) => {
        Object.assign(sh.uniforms, FOG_U);
        prev.call(mat, sh, r);
      };
      mat.needsUpdate = true;
    }
  });
}
