/**
 * The planet's ground: one flat-shaded triangle per grid face, colored by
 * biome. Snow comes and goes with the seasons in the shader, so changing
 * seasons costs nothing on the CPU.
 */
import * as THREE from 'three';
import type { PlanetData } from '../sim/planet/generate';
import { BIOME_COLORS, classifyBiome } from '../sim/planet/biomes';
import { radiusForHeight, type SeasonUniforms } from './scale';

export interface TerrainResult {
  mesh: THREE.Mesh;
  /** Biome of every face (used for tree placement). */
  faceBiome: Uint8Array;
  /** Scene-space vertex positions of every face (non-indexed, 9 floats per face). */
  facePositions: Float32Array;
}

function faceHash(i: number): number {
  let h = Math.imul(i ^ 0x5bd1e995, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function buildTerrain(planet: PlanetData, season: SeasonUniforms): TerrainResult {
  const { faces, positions, heightM, temperature, seasonAmplitude, moisture, coastDistance } = planet;
  const faceCount = faces.length / 3;
  const pos = new Float32Array(faceCount * 9);
  const col = new Float32Array(faceCount * 9);
  const climate = new Float32Array(faceCount * 12);
  const faceBiome = new Uint8Array(faceCount);
  const palette = BIOME_COLORS.map((hex) => new THREE.Color(hex)); // converted to linear
  const tmp = new THREE.Color();

  for (let f = 0; f < faceCount; f++) {
    const a = faces[f * 3];
    const b = faces[f * 3 + 1];
    const c = faces[f * 3 + 2];
    const cells = [a, b, c];

    // A face counts as land if any corner is land and it is not mostly deep.
    let landCorners = 0;
    let hSum = 0;
    for (const cell of cells) {
      if (heightM[cell] >= 0) landCorners++;
      hSum += heightM[cell];
    }
    let biome: number;
    let meanT = 0;
    let amp = 0;
    if (landCorners > 0 && hSum / 3 > -150) {
      let h = 0;
      let m = 0;
      let nearOcean = false;
      for (const cell of cells) {
        if (heightM[cell] < 0) continue;
        h += heightM[cell];
        meanT += temperature[cell];
        amp += seasonAmplitude[cell];
        m += moisture[cell];
        if (coastDistance[cell] === 0) nearOcean = true;
      }
      h /= landCorners;
      meanT /= landCorners;
      amp /= landCorners;
      m /= landCorners;
      biome = classifyBiome({ heightM: h, temperature: meanT, moisture: m, nearOcean: nearOcean && landCorners < 3 });
    } else {
      biome = classifyBiome({ heightM: hSum / 3, temperature: 0, moisture: 0, nearOcean: false });
      for (const cell of cells) {
        meanT += temperature[cell] / 3;
        amp += seasonAmplitude[cell] / 3;
      }
    }
    faceBiome[f] = biome;

    // Slight per-face brightness variation gives the low-poly ground texture.
    const jitter = faceHash(f);
    tmp.copy(palette[biome]).multiplyScalar(0.965 + jitter * 0.07);
    const isLandFace = landCorners > 0 && biome > 2 ? 1 : 0;

    for (let k = 0; k < 3; k++) {
      const cell = cells[k];
      const r = radiusForHeight(heightM[cell]);
      const o = f * 9 + k * 3;
      pos[o] = positions[cell * 3] * r;
      pos[o + 1] = positions[cell * 3 + 1] * r;
      pos[o + 2] = positions[cell * 3 + 2] * r;
      col[o] = tmp.r;
      col[o + 1] = tmp.g;
      col[o + 2] = tmp.b;
      const q = f * 12 + k * 4;
      climate[q] = meanT;
      climate[q + 1] = amp;
      climate[q + 2] = isLandFace;
      climate[q + 3] = jitter;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geometry.setAttribute('aClimate', new THREE.BufferAttribute(climate, 4));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.94,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSeason = season.uSeason;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aClimate;
        varying vec4 vClimate;
        varying float vSinLat;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vClimate = aClimate;
        vSinLat = position.y / length(position);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSeason;
        varying vec4 vClimate;
        varying float vSinLat;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float hemi = clamp(vSinLat * 8.0, -1.0, 1.0);
          float tNow = vClimate.x + vClimate.y * hemi * uSeason + (vClimate.w - 0.5) * 3.0;
          float snow = smoothstep(0.5, -2.5, tNow) * vClimate.z;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.92), snow);
        }`,
      );
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'terrain';
  return { mesh, faceBiome, facePositions: pos };
}
