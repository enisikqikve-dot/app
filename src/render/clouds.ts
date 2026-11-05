/**
 * Low-poly clouds: clusters of puffs, more of them over wet regions and the
 * sea, drifting around the planet.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';
import type { PlanetData } from '../sim/planet/generate';
import { CLOUD_ALTITUDE } from './scale';

export function buildClouds(planet: PlanetData): THREE.Group {
  const rng = new Rng(planet.seed).fork('clouds');
  const clusterCount = Math.round(planet.cellCount / 420);
  const parts: THREE.BufferGeometry[] = [];
  const center = new THREE.Vector3();
  const tangentA = new THREE.Vector3();
  const tangentB = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const helper = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  let placed = 0;
  let attempts = 0;
  while (placed < clusterCount && attempts < clusterCount * 20) {
    attempts++;
    const cell = rng.int(0, planet.cellCount - 1);
    const wetness = planet.heightM[cell] < 0 ? 0.55 : planet.moisture[cell];
    if (!rng.chance(0.15 + wetness * 0.85)) continue;
    placed++;

    center.fromArray(planet.positions, cell * 3);
    helper.set(Math.abs(center.y) < 0.9 ? 0 : 1, Math.abs(center.y) < 0.9 ? 1 : 0, 0);
    tangentA.crossVectors(center, helper).normalize();
    tangentB.crossVectors(center, tangentA).normalize();
    const puffs = rng.int(5, 11);
    const spread = rng.range(2.6, 5.2);
    const altitude = CLOUD_ALTITUDE + rng.range(-0.3, 0.6);
    for (let k = 0; k < puffs; k++) {
      offset
        .copy(tangentA)
        .multiplyScalar(rng.range(-spread, spread))
        .addScaledVector(tangentB, rng.range(-spread, spread) * 0.6);
      const pos = center.clone().multiplyScalar(altitude).add(offset);
      pos.setLength(altitude + rng.range(-0.2, 0.3));
      const size = rng.range(1.1, 2.3) * (1 - (Math.abs(offset.length()) / (spread * 2.2)) * 0.55);
      q.setFromUnitVectors(yAxis, pos.clone().normalize());
      s.set(size * rng.range(1.1, 1.6), size * 0.42, size);
      m.compose(pos, q, s);
      const puff = new THREE.IcosahedronGeometry(1, 1);
      puff.deleteAttribute('uv');
      puff.applyMatrix4(m);
      parts.push(puff);
    }
  }

  const geometry = mergeGeometries(parts, false)!;
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: 0xf4f6f8,
    emissive: 0x1a2230,
    flatShading: true,
    roughness: 1,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  // Clouds right in front of the camera fade out, so they never block the view.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCamDist;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCamDist = -mvPosition.z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCamDist;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= smoothstep(8.0, 40.0, vCamDist);\n#include <opaque_fragment>');
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  mesh.name = 'clouds';
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
