/** A soft blue glow around the planet's edge, brighter on the day side. */
import * as THREE from 'three';
import { R } from './scale';

export interface Atmosphere {
  mesh: THREE.Mesh;
  uniforms: { uSunDir: { value: THREE.Vector3 }; uFade: { value: number } };
}

export function buildAtmosphere(): Atmosphere {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uFade: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vDirWorld;
      void main() {
        vNormalView = normalize(normalMatrix * normal);
        vDirWorld = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uFade;
      varying vec3 vNormalView;
      varying vec3 vDirWorld;
      void main() {
        float rim = pow(max(0.0, 0.78 + dot(vNormalView, vec3(0.0, 0.0, 1.0))), 5.0);
        float day = smoothstep(-0.35, 0.45, dot(vDirWorld, uSunDir));
        vec3 color = mix(vec3(0.10, 0.16, 0.32), vec3(0.42, 0.68, 1.0), day);
        gl_FragColor = vec4(color * rim * (0.12 + 0.88 * day) * uFade, 1.0);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.11, 64, 48), material);
  mesh.name = 'atmosphere';
  return { mesh, uniforms };
}
