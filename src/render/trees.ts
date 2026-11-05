/**
 * Forests as instanced low-poly trees: conifers, broadleaf trees and big
 * tropical trees. Broadleaf trees turn orange in autumn; all of them catch
 * snow in winter (both in the shader).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';
import type { PlanetData } from '../sim/planet/generate';
import { Biome, TREE_DENSITY } from '../sim/planet/biomes';
import type { SeasonUniforms } from './scale';

const MAX_TREES = 60000;

type TreeKind = 'conifer' | 'broadleaf' | 'tropical';

const KIND_BY_BIOME: Partial<Record<Biome, TreeKind>> = {
  [Biome.Taiga]: 'conifer',
  [Biome.Tundra]: 'conifer',
  [Biome.Mountains]: 'conifer',
  [Biome.TemperateForest]: 'broadleaf',
  [Biome.Grassland]: 'broadleaf',
  [Biome.Steppe]: 'broadleaf',
  [Biome.Rainforest]: 'tropical',
  [Biome.Savanna]: 'tropical',
};

const CROWN_COLORS: Record<TreeKind, number[]> = {
  conifer: [0x2f4f33, 0x34573a, 0x29462f],
  broadleaf: [0x4d7a2f, 0x5a8634, 0x456f2b, 0x60873a],
  tropical: [0x2c6a2a, 0x347a2f, 0x2a5f26],
};

function coloredPart(geo: THREE.BufferGeometry, hex: number, crown: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const count = g.getAttribute('position').count;
  const color = new THREE.Color(hex);
  const colors = new Float32Array(count * 3);
  const crownAttr = new Float32Array(count).fill(crown);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('aCrown', new THREE.BufferAttribute(crownAttr, 1));
  g.deleteAttribute('uv');
  return g;
}

function treeGeometry(kind: TreeKind): THREE.BufferGeometry {
  const trunkColor = 0x6b4a32;
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'conifer') {
    parts.push(coloredPart(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 5).translate(0, 0.08, 0), trunkColor, 0));
    parts.push(coloredPart(new THREE.ConeGeometry(0.17, 0.36, 6).translate(0, 0.3, 0), 0xffffff, 1));
    parts.push(coloredPart(new THREE.ConeGeometry(0.12, 0.26, 6).translate(0, 0.5, 0), 0xffffff, 1));
  } else if (kind === 'broadleaf') {
    parts.push(coloredPart(new THREE.CylinderGeometry(0.03, 0.045, 0.22, 5).translate(0, 0.11, 0), trunkColor, 0));
    parts.push(coloredPart(new THREE.IcosahedronGeometry(0.17, 0).scale(1, 0.9, 1).translate(0, 0.34, 0), 0xffffff, 1));
  } else {
    parts.push(coloredPart(new THREE.CylinderGeometry(0.035, 0.05, 0.34, 5).translate(0, 0.17, 0), trunkColor, 0));
    parts.push(coloredPart(new THREE.IcosahedronGeometry(0.22, 0).scale(1.25, 0.6, 1.25).translate(0, 0.42, 0), 0xffffff, 1));
  }
  const merged = mergeGeometries(parts, false)!;
  merged.computeVertexNormals();
  return merged;
}

function treeMaterial(season: SeasonUniforms, autumn: boolean): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  // Three.js caches shader programs by the onBeforeCompile source text, which is the
  // same for every tree kind; this key keeps the autumn and evergreen variants apart.
  material.customProgramCacheKey = () => (autumn ? 'enis-tree-autumn' : 'enis-tree-evergreen');
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSeason = season.uSeason;
    shader.uniforms.uSeasonCos = season.uSeasonCos;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aCrown;
        attribute vec3 aTreeClimate;
        uniform float uSeason;
        uniform float uSeasonCos;
        varying float vSnow;
        varying float vAutumn;
        varying float vCrown;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 base = vec3(instanceMatrix[3]);
          float sinLat = base.y / length(base);
          float hemi = clamp(sinLat * 8.0, -1.0, 1.0);
          float tNow = aTreeClimate.x + aTreeClimate.y * hemi * uSeason + (aTreeClimate.z - 0.5) * 3.0;
          float upness = clamp(normal.y * 1.4, 0.0, 1.0);
          vSnow = smoothstep(0.5, -2.5, tNow) * aCrown * (0.35 + 0.65 * upness);
          vAutumn = ${autumn ? 'clamp(-uSeasonCos * hemi * 1.4, 0.0, 1.0) * smoothstep(4.0, 9.0, aTreeClimate.x) * smoothstep(19.0, 15.0, aTreeClimate.x)' : '0.0'};
          vCrown = aCrown;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vSnow;
        varying float vAutumn;
        varying float vCrown;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.26, 0.05), vAutumn * vCrown * 0.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.92), vSnow);`,
      );
  };
  return material;
}

interface Placement {
  matrix: THREE.Matrix4;
  color: THREE.Color;
  climate: [number, number, number];
}

export function buildTrees(
  planet: PlanetData,
  faceBiome: Uint8Array,
  facePositions: Float32Array,
  season: SeasonUniforms,
): THREE.Group {
  const rng = new Rng(planet.seed).fork('trees');
  const { faces, heightM, temperature, seasonAmplitude } = planet;
  const byKind: Record<TreeKind, Placement[]> = { conifer: [], broadleaf: [], tropical: [] };

  // First pass: how many trees would the forests want?
  let wanted = 0;
  for (let f = 0; f < faceBiome.length; f++) wanted += TREE_DENSITY[faceBiome[f]] ?? 0;
  const thin = Math.min(1, MAX_TREES / Math.max(1, wanted));

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (let f = 0; f < faceBiome.length; f++) {
    const biome = faceBiome[f] as Biome;
    const kind = KIND_BY_BIOME[biome];
    const density = (TREE_DENSITY[biome] ?? 0) * thin;
    if (!kind || density <= 0) continue;
    const cells = [faces[f * 3], faces[f * 3 + 1], faces[f * 3 + 2]];
    if (cells.some((cell) => heightM[cell] < 0)) continue; // no trees in the water

    let n = Math.floor(density);
    if (rng.chance(density - n)) n++;
    if (n === 0) continue;

    a.fromArray(facePositions, f * 9);
    b.fromArray(facePositions, f * 9 + 3);
    c.fromArray(facePositions, f * 9 + 6);
    const meanT = (temperature[cells[0]] + temperature[cells[1]] + temperature[cells[2]]) / 3;
    const amp = (seasonAmplitude[cells[0]] + seasonAmplitude[cells[1]] + seasonAmplitude[cells[2]]) / 3;
    const palette = CROWN_COLORS[kind];

    for (let k = 0; k < n; k++) {
      let u = rng.next();
      let v = rng.next();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      p.copy(a).addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
      up.copy(p).normalize();
      q.setFromUnitVectors(yAxis, up);
      spin.setFromAxisAngle(yAxis, rng.range(0, Math.PI * 2));
      q.multiply(spin);
      const s = rng.range(0.75, 1.35) * (kind === 'tropical' && biome === Biome.Savanna ? 1.2 : 1);
      scale.set(s, s * rng.range(0.9, 1.15), s);
      const color = new THREE.Color(rng.pick(palette)).multiplyScalar(rng.range(0.85, 1.12));
      byKind[kind].push({
        matrix: new THREE.Matrix4().compose(p, q, scale),
        color,
        climate: [meanT, amp, rng.next()],
      });
    }
  }

  const group = new THREE.Group();
  group.name = 'trees';
  for (const kind of Object.keys(byKind) as TreeKind[]) {
    const list = byKind[kind];
    if (list.length === 0) continue;
    const geometry = treeGeometry(kind);
    const climate = new Float32Array(list.length * 3);
    list.forEach((t, i) => climate.set(t.climate, i * 3));
    geometry.setAttribute('aTreeClimate', new THREE.InstancedBufferAttribute(climate, 3));
    const mesh = new THREE.InstancedMesh(geometry, treeMaterial(season, kind === 'broadleaf'), list.length);
    list.forEach((t, i) => {
      mesh.setMatrixAt(i, t.matrix);
      mesh.setColorAt(i, t.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = `trees-${kind}`;
    group.add(mesh);
  }
  return group;
}
