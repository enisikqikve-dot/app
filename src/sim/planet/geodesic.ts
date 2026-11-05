/**
 * Geodesic grid: an icosahedron whose 20 faces are each split into a
 * triangular grid of `frequency` segments per edge and pushed out onto the
 * unit sphere. Every vertex is one "cell" of the planet; cells and their
 * neighbors form the net that people and animals will later walk on.
 *
 * Vertex count = 10·f² + 2, face count = 20·f².
 */

export interface GeodesicGrid {
  /** Unit vectors, xyz per cell. */
  positions: Float32Array;
  /** Three cell indices per triangle, counter-clockwise seen from outside. */
  faces: Uint32Array;
  /** CSR adjacency: neighbors of cell i are neighbors[offsets[i] … offsets[i+1]). */
  neighborOffsets: Uint32Array;
  neighbors: Uint32Array;
  cellCount: number;
}

const PHI = (1 + Math.sqrt(5)) / 2;

const ICO_VERTICES: [number, number, number][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];

const ICO_FACES: [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

export function buildGeodesicGrid(frequency: number): GeodesicGrid {
  const f = Math.max(1, Math.floor(frequency));
  const expectedCells = 10 * f * f + 2;
  const positions = new Float32Array(expectedCells * 3);
  const faces = new Uint32Array(20 * f * f * 3);
  const lookup = new Map<string, number>();
  let cellCount = 0;
  let faceCursor = 0;

  const addPoint = (x: number, y: number, z: number): number => {
    const len = Math.hypot(x, y, z);
    x /= len;
    y /= len;
    z /= len;
    const key = `${Math.round(x * 1e6)},${Math.round(y * 1e6)},${Math.round(z * 1e6)}`;
    const existing = lookup.get(key);
    if (existing !== undefined) return existing;
    const index = cellCount++;
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;
    lookup.set(key, index);
    return index;
  };

  for (const [ia, ib, ic] of ICO_FACES) {
    const a = ICO_VERTICES[ia];
    const b = ICO_VERTICES[ib];
    const c = ICO_VERTICES[ic];
    // Grid point (i, j) = a + (b - a)·i/f + (c - a)·j/f, with i + j ≤ f.
    const row: number[][] = [];
    for (let i = 0; i <= f; i++) {
      const line: number[] = [];
      for (let j = 0; j <= f - i; j++) {
        const u = i / f;
        const v = j / f;
        line.push(
          addPoint(
            a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v,
            a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v,
            a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v,
          ),
        );
      }
      row.push(line);
    }
    for (let i = 0; i < f; i++) {
      for (let j = 0; j < f - i; j++) {
        const p0 = row[i][j];
        const p1 = row[i + 1][j];
        const p2 = row[i][j + 1];
        faces[faceCursor++] = p0;
        faces[faceCursor++] = p1;
        faces[faceCursor++] = p2;
        if (j < f - i - 1) {
          const p3 = row[i + 1][j + 1];
          faces[faceCursor++] = p1;
          faces[faceCursor++] = p3;
          faces[faceCursor++] = p2;
        }
      }
    }
  }

  if (cellCount !== expectedCells) {
    throw new Error(`Geodesic grid: expected ${expectedCells} cells, got ${cellCount}`);
  }

  // Make every triangle counter-clockwise when seen from outside.
  for (let t = 0; t < faces.length; t += 3) {
    const i0 = faces[t] * 3;
    const i1 = faces[t + 1] * 3;
    const i2 = faces[t + 2] * 3;
    const ux = positions[i1] - positions[i0];
    const uy = positions[i1 + 1] - positions[i0 + 1];
    const uz = positions[i1 + 2] - positions[i0 + 2];
    const vx = positions[i2] - positions[i0];
    const vy = positions[i2 + 1] - positions[i0 + 1];
    const vz = positions[i2 + 2] - positions[i0 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const outward = nx * positions[i0] + ny * positions[i0 + 1] + nz * positions[i0 + 2];
    if (outward < 0) {
      const tmp = faces[t + 1];
      faces[t + 1] = faces[t + 2];
      faces[t + 2] = tmp;
    }
  }

  const { offsets, list } = buildAdjacency(faces, cellCount);
  return { positions, faces, neighborOffsets: offsets, neighbors: list, cellCount };
}

function buildAdjacency(faces: Uint32Array, cellCount: number): { offsets: Uint32Array; list: Uint32Array } {
  const sets: Set<number>[] = Array.from({ length: cellCount }, () => new Set<number>());
  for (let t = 0; t < faces.length; t += 3) {
    const a = faces[t];
    const b = faces[t + 1];
    const c = faces[t + 2];
    sets[a].add(b).add(c);
    sets[b].add(a).add(c);
    sets[c].add(a).add(b);
  }
  const offsets = new Uint32Array(cellCount + 1);
  let total = 0;
  for (let i = 0; i < cellCount; i++) {
    offsets[i] = total;
    total += sets[i].size;
  }
  offsets[cellCount] = total;
  const list = new Uint32Array(total);
  for (let i = 0; i < cellCount; i++) {
    let k = offsets[i];
    for (const n of sets[i]) list[k++] = n;
  }
  return { offsets, list };
}

/**
 * Finds the cell closest to a direction by walking downhill over neighbors,
 * starting from `startCell`. Fast when the start is already close, which is
 * the normal case for a moving camera or a mouse.
 */
export function nearestCell(
  grid: Pick<GeodesicGrid, 'positions' | 'neighborOffsets' | 'neighbors'>,
  x: number,
  y: number,
  z: number,
  startCell = 0,
): number {
  const { positions, neighborOffsets, neighbors } = grid;
  let best = startCell;
  let bestDot = positions[best * 3] * x + positions[best * 3 + 1] * y + positions[best * 3 + 2] * z;
  for (;;) {
    let improved = false;
    for (let k = neighborOffsets[best]; k < neighborOffsets[best + 1]; k++) {
      const n = neighbors[k];
      const d = positions[n * 3] * x + positions[n * 3 + 1] * y + positions[n * 3 + 2] * z;
      if (d > bestDot) {
        bestDot = d;
        best = n;
        improved = true;
      }
    }
    if (!improved) return best;
  }
}
