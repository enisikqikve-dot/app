/** Rivers as thin ribbons along the edges between cells, wider downstream. */
import * as THREE from 'three';
import type { PlanetData } from '../sim/planet/generate';
import { FRESH_LAKE, FRESH_RIVER, RIVER_FLOW } from '../sim/planet/rivers';
import { radiusForHeight } from './scale';

export function buildRivers(planet: PlanetData): THREE.Mesh {
  const { flowTo, flow, fresh, positions, heightM } = planet;
  const pos: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const lift = 0.05;

  for (let c = 0; c < planet.cellCount; c++) {
    if (fresh[c] !== FRESH_RIVER) continue;
    const d = flowTo[c];
    if (d < 0) continue;
    a.fromArray(positions, c * 3).multiplyScalar(radiusForHeight(heightM[c]) + lift);
    b.fromArray(positions, d * 3);
    if (heightM[d] < 0) {
      // Into the sea: stop at the coast (half way, at sea level).
      b.multiplyScalar(radiusForHeight(0) + lift).lerp(a, 0.45);
    } else {
      b.multiplyScalar(radiusForHeight(heightM[d]) + lift);
    }
    const widthA = Math.min(0.42, 0.09 + 0.06 * Math.log2(flow[c] / RIVER_FLOW + 1));
    const widthB = fresh[d] === FRESH_RIVER || fresh[d] === FRESH_LAKE ? Math.min(0.42, 0.09 + 0.06 * Math.log2(flow[d] / RIVER_FLOW + 1)) : widthA;
    up.copy(a).add(b).normalize();
    side.subVectors(b, a).cross(up).normalize();
    const a1 = a.clone().addScaledVector(side, widthA / 2);
    const a2 = a.clone().addScaledVector(side, -widthA / 2);
    const b1 = b.clone().addScaledVector(side, widthB / 2);
    const b2 = b.clone().addScaledVector(side, -widthB / 2);
    pos.push(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z, b1.x, b1.y, b1.z);
    pos.push(a2.x, a2.y, a2.z, b2.x, b2.y, b2.z, b1.x, b1.y, b1.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x3f86b5,
      roughness: 0.25,
      metalness: 0.05,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  mesh.name = 'rivers';
  mesh.renderOrder = 1;
  return mesh;
}
