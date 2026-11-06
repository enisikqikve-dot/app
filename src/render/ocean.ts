/**
 * The sea surface: a faceted, slightly transparent shell at sea level.
 * Sea ice grows and melts with the seasons near the poles (in the shader).
 */
import * as THREE from 'three';
import { GLSL_NOISE, R, type SeasonUniforms } from './scale';

export function buildOcean(season: SeasonUniforms, detail: number): THREE.Mesh {
  const geometry = new THREE.IcosahedronGeometry(R, detail);
  const material = new THREE.MeshStandardMaterial({
    color: 0x1f6f98,
    transparent: true,
    opacity: 0.62,
    roughness: 0.22,
    metalness: 0.05,
    flatShading: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSeason = season.uSeason;
    shader.uniforms.uGlobalTemp = season.uGlobalTemp;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSeason;
        uniform float uGlobalTemp;
        flat varying float vIce;
        ${GLSL_NOISE}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 dir = normalize(position);
          float sinLat = dir.y;
          float cosLat = sqrt(max(0.0, 1.0 - sinLat * sinLat));
          float meanT = -22.0 + 50.0 * pow(cosLat, 1.3);
          float hemi = clamp(sinLat * 8.0, -1.0, 1.0);
          float tNow = meanT + 6.0 * abs(sinLat) * hemi * uSeason + uGlobalTemp;
          tNow += (enisNoise(dir * 9.0) - 0.5) * 7.0;
          vIce = smoothstep(-2.0, -4.5, tNow);
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        flat varying float vIce;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.86, 0.90), vIce);
        diffuseColor.a = mix(diffuseColor.a, 1.0, vIce);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.85, vIce);`,
      );
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ocean';
  mesh.renderOrder = 1;
  return mesh;
}
