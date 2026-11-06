/**
 * Villages, towns and cities: houses spiral out from the centre as the place
 * grows, fields ring it (green in spring, golden in late summer, bare in
 * winter), a stepped temple stands in the middle, a wall guards it in times
 * of war. At night, seen from afar, the towns glow.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlanetData } from '../sim/planet/generate';
import { nearestCell } from '../sim/planet/geodesic';
import type { Life } from '../sim/life/life';
import type { Settlement } from '../sim/life/types';
import { MINUTES_PER_YEAR } from '../sim/clock';
import type { TerrainView } from './terrain';
import { entityDir } from './lifeView';
import { epochIndex } from '../sim/life/civtech';
import { styleFor } from './styles';
import { R } from './scale';

const MAX_HOUSES = 2400;
const MAX_SHIPS = 80;

const MAX_FIELDS = 1400;
const MAX_TEMPLES = 60;
const MAX_WALLS = 1600;
const MAX_LIGHTS = 64;
const Y = new THREE.Vector3(0, 1, 0);

function painted(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

/** A mud-brick house with a flat roof and a dark door (front = +z). */
function houseGeometry(): THREE.BufferGeometry {
  const g = mergeGeometries([
    painted(new THREE.BoxGeometry(0.24, 0.15, 0.2).translate(0, 0.075, 0), 0xffffff),
    painted(new THREE.BoxGeometry(0.27, 0.025, 0.23).translate(0, 0.16, 0), 0x9a7650),
    painted(new THREE.BoxGeometry(0.05, 0.08, 0.01).translate(0.04, 0.04, 0.101), 0x3a2a1c),
  ])!;
  g.computeVertexNormals();
  return g;
}

/** A field with rows of crops (tinted by the season). */
function fieldGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) parts.push(painted(new THREE.BoxGeometry(0.52, 0.018, 0.075).translate(0, 0.009, -0.18 + i * 0.09), i % 2 ? 0xd9d9d9 : 0xffffff));
  parts.push(painted(new THREE.BoxGeometry(0.56, 0.006, 0.46).translate(0, 0.003, 0), 0x6b5236));
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

/** A stepped temple with a golden shrine on top. */
function templeGeometry(): THREE.BufferGeometry {
  const g = mergeGeometries([
    painted(new THREE.BoxGeometry(0.6, 0.12, 0.6).translate(0, 0.06, 0), 0xd8c08f),
    painted(new THREE.BoxGeometry(0.42, 0.12, 0.42).translate(0, 0.18, 0), 0xcdb381),
    painted(new THREE.BoxGeometry(0.26, 0.12, 0.26).translate(0, 0.3, 0), 0xc2a673),
    painted(new THREE.BoxGeometry(0.1, 0.08, 0.1).translate(0, 0.4, 0), 0xf2c46b),
  ])!;
  g.computeVertexNormals();
  return g;
}

function wallGeometry(): THREE.BufferGeometry {
  const g = mergeGeometries([
    painted(new THREE.BoxGeometry(0.42, 0.13, 0.06).translate(0, 0.065, 0), 0xa89272),
    painted(new THREE.BoxGeometry(0.08, 0.04, 0.07).translate(-0.14, 0.15, 0), 0x9c8667),
    painted(new THREE.BoxGeometry(0.08, 0.04, 0.07).translate(0.14, 0.15, 0), 0x9c8667),
  ])!;
  g.computeVertexNormals();
  return g;
}

/** A triangular roof along x (a prism lying on its side). */
function gable(w: number, d: number, h: number, y: number, color: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(1, 1, w, 3, 1);
  g.rotateZ(Math.PI / 2);
  g.rotateX(Math.PI / 6 + Math.PI);
  g.scale(1, h / 1.5, d / 1.732);
  g.translate(0, y + h / 3, 0);
  return painted(g, color);
}

/** Antiquity and the Bronze Age: stone walls under a red tiled roof. */
function stoneHouseGeometry(): THREE.BufferGeometry {
  const g = mergeGeometries([
    painted(new THREE.BoxGeometry(0.26, 0.15, 0.2).translate(0, 0.075, 0), 0xffffff),
    gable(0.29, 0.24, 0.09, 0.15, 0xb5523b),
    painted(new THREE.BoxGeometry(0.05, 0.08, 0.01).translate(0, 0.04, 0.101), 0x3a2a1c),
  ])!;
  g.computeVertexNormals();
  return g;
}

/** The Middle Ages: tall half-timbered houses with steep roofs. */
function timberHouseGeometry(): THREE.BufferGeometry {
  const parts = [
    painted(new THREE.BoxGeometry(0.22, 0.24, 0.2).translate(0, 0.12, 0), 0xffffff),
    gable(0.25, 0.24, 0.16, 0.24, 0x4a3b33),
    painted(new THREE.BoxGeometry(0.23, 0.015, 0.21).translate(0, 0.12, 0), 0x3b2a1f),
    painted(new THREE.BoxGeometry(0.015, 0.24, 0.205).translate(-0.1, 0.12, 0), 0x3b2a1f),
    painted(new THREE.BoxGeometry(0.015, 0.24, 0.205).translate(0.1, 0.12, 0), 0x3b2a1f),
    painted(new THREE.BoxGeometry(0.05, 0.09, 0.01).translate(0, 0.045, 0.101), 0x2a1d14),
  ];
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

/** The industrial age: brick blocks; every few a factory with a chimney. */
function brickHouseGeometry(): THREE.BufferGeometry {
  const g = mergeGeometries([
    painted(new THREE.BoxGeometry(0.26, 0.26, 0.22).translate(0, 0.13, 0), 0xffffff),
    painted(new THREE.BoxGeometry(0.28, 0.02, 0.24).translate(0, 0.27, 0), 0x3a3a3e),
    painted(new THREE.BoxGeometry(0.2, 0.025, 0.01).translate(0, 0.19, 0.111), 0xf3d58a),
    painted(new THREE.BoxGeometry(0.2, 0.025, 0.01).translate(0, 0.1, 0.111), 0xf3d58a),
    painted(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 6).translate(0.08, 0.33, -0.05), 0x5a3a30),
  ])!;
  g.computeVertexNormals();
  return g;
}

/** The modern age: towers with rows of windows (stretched upward per building). */
function towerGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [painted(new THREE.BoxGeometry(0.22, 0.5, 0.22).translate(0, 0.25, 0), 0xffffff)];
  for (let i = 0; i < 6; i++) {
    const y = 0.05 + i * 0.075;
    parts.push(painted(new THREE.BoxGeometry(0.225, 0.025, 0.225).translate(0, y, 0), 0x9ec4e8));
  }
  parts.push(painted(new THREE.BoxGeometry(0.23, 0.02, 0.23).translate(0, 0.5, 0), 0x55606e));
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

/** A columned temple (antiquity). */
function columnTempleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [painted(new THREE.BoxGeometry(0.62, 0.05, 0.4).translate(0, 0.025, 0), 0xe8e2d4)];
  for (let i = 0; i < 6; i++) for (const z of [-0.15, 0.15]) parts.push(painted(new THREE.CylinderGeometry(0.022, 0.025, 0.22, 7).translate(-0.25 + i * 0.1, 0.16, z), 0xf2eee4));
  parts.push(painted(new THREE.BoxGeometry(0.64, 0.04, 0.42).translate(0, 0.29, 0), 0xe8e2d4));
  parts.push(gable(0.64, 0.42, 0.1, 0.31, 0xd8d0bf));
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

/** A church with a tall tower (Middle Ages onward). */
function cathedralGeometry(): THREE.BufferGeometry {
  const g = mergeGeometries([
    painted(new THREE.BoxGeometry(0.5, 0.26, 0.24).translate(0.06, 0.13, 0), 0xcfc6b4),
    gable(0.52, 0.27, 0.16, 0.26, 0x5a5048),
    painted(new THREE.BoxGeometry(0.14, 0.56, 0.14).translate(-0.24, 0.28, 0), 0xc6bca8),
    painted(new THREE.ConeGeometry(0.11, 0.26, 4).rotateY(Math.PI / 4).translate(-0.24, 0.69, 0), 0x4e5a52),
    painted(new THREE.BoxGeometry(0.08, 0.12, 0.01).translate(0.3, 0.14, 0.121), 0x6a7aa8),
  ])!;
  g.computeVertexNormals();
  return g;
}

/** A sailing ship (front = +z). */
function shipGeometry(): THREE.BufferGeometry {
  const hull = new THREE.CylinderGeometry(0.06, 0.035, 0.36, 6, 1);
  hull.rotateX(Math.PI / 2);
  hull.scale(1, 0.55, 1);
  const g = mergeGeometries([
    painted(hull.translate(0, 0.03, 0), 0x6a4a30),
    painted(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4).translate(0, 0.18, 0), 0x4a3424),
    painted(new THREE.BoxGeometry(0.005, 0.18, 0.16).translate(0, 0.2, 0), 0xf4efe2),
  ])!;
  g.computeVertexNormals();
  return g;
}

function glowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,236,190,1)');
  g.addColorStop(0.25, 'rgba(255,196,110,0.75)');
  g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const east = new THREE.Vector3();
const south = new THREE.Vector3();
const basis = new THREE.Matrix4();
const spin = new THREE.Quaternion();
function orient(up: THREE.Vector3, yaw: number, out: THREE.Quaternion): THREE.Quaternion {
  east.set(up.z, 0, -up.x);
  if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
  east.normalize();
  south.crossVectors(east, up);
  basis.makeBasis(east, up, south);
  out.setFromRotationMatrix(basis);
  return out.multiply(spin.setFromAxisAngle(Y, Math.PI - yaw));
}

/** How many houses a place of this size shows. */
export function houseCount(people: number): number {
  return Math.min(60, 3 + Math.ceil(Math.sqrt(people) * 1.4));
}

const WALL_COLOR = new THREE.Color(0xffffff);
/** Wall colours of the houses of each style. */
const STYLE_COLORS = [
  [0xd2b48c, 0xc9a77c, 0xdcc39b, 0xbf9d72, 0xe0cba6],
  [0xeae2d0, 0xe2d6bc, 0xf0e8d8, 0xd8ccb2, 0xece4d2],
  [0xf2ecdc, 0xe9e0c8, 0xf5f0e4, 0xe0d4b8, 0xefe6d0],
  [0xa0503c, 0x8e4634, 0xb05c44, 0x7e4232, 0x9a5a48],
  [0xb8c4d0, 0xa8b4c2, 0xc8d2dc, 0x98a6b6, 0xd0d8e0],
].map((list) => list.map((c) => new THREE.Color(c)));

export class TownView {
  readonly group = new THREE.Group();
  /** One mesh per building style. */
  private readonly styles: THREE.InstancedMesh[];
  private readonly ships: THREE.InstancedMesh;
  /** Where ships sail: [water direction, outward direction, phase]. */
  private shipLanes: { base: THREE.Vector3; out: THREE.Vector3; phase: number; cell: number }[] = [];
  private readonly columnTemples: THREE.InstancedMesh;
  private readonly cathedrals: THREE.InstancedMesh;
  private houses: THREE.InstancedMesh;
  private readonly fields: THREE.InstancedMesh;
  private readonly temples: THREE.InstancedMesh;
  private readonly walls: THREE.InstancedMesh;
  private readonly lights: THREE.Points;
  private readonly lightPos = new Float32Array(MAX_LIGHTS * 3);
  private signature = '';
  private lastBuild = 0;
  private readonly kmPerUnit: number;
  /** Angular size of a cell (radians). */
  private readonly cellAngle: number;
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly m = new THREE.Matrix4();
  private readonly c = new THREE.Color();
  /** Where each place's fields are, to tint them by season without laying them out again. */
  private fieldCount = 0;

  constructor(
    private readonly planet: PlanetData,
    private readonly terrain: TerrainView,
  ) {
    this.kmPerUnit = planet.radiusKm / R;
    this.cellAngle = Math.sqrt((4 * Math.PI) / planet.cellCount);
    const mat = (rough: number) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: rough });
    this.styles = [houseGeometry(), stoneHouseGeometry(), timberHouseGeometry(), brickHouseGeometry(), towerGeometry()].map((g) => {
      const m = new THREE.InstancedMesh(g, mat(0.9), MAX_HOUSES);
      m.setColorAt(0, WALL_COLOR);
      return m;
    });
    this.houses = this.styles[0];
    this.ships = new THREE.InstancedMesh(shipGeometry(), mat(0.8), MAX_SHIPS);
    this.columnTemples = new THREE.InstancedMesh(columnTempleGeometry(), mat(0.85), MAX_TEMPLES);
    this.cathedrals = new THREE.InstancedMesh(cathedralGeometry(), mat(0.85), MAX_TEMPLES);
    this.fields = new THREE.InstancedMesh(fieldGeometry(), mat(1), MAX_FIELDS);
    this.temples = new THREE.InstancedMesh(templeGeometry(), mat(0.9), MAX_TEMPLES);
    this.walls = new THREE.InstancedMesh(wallGeometry(), mat(0.95), MAX_WALLS);
    this.fields.setColorAt(0, WALL_COLOR);
    for (const mesh of [...this.styles, this.fields, this.temples, this.columnTemples, this.cathedrals, this.walls, this.ships]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.lightPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.lights = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ map: glowTexture(), size: 3, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    this.lights.frustumCulled = false;
    this.group.add(this.lights);
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = (m as { material?: THREE.Material }).material;
      if (mat) {
        (mat as THREE.PointsMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.group.removeFromParent();
  }

  /** Forget the layout (after rewinding or reshaping the land). */
  reset(): void {
    this.signature = '';
  }

  /** A matrix standing something on the ground at a spot near a cell (null over water). */
  private place(cell: number, spotKm: [number, number], yaw: number, scale: number | THREE.Vector3): THREE.Matrix4 | null {
    entityDir(this.planet, cell, -1, 0, spotKm, this.v);
    const c = nearestCell(this.planet, this.v.x, this.v.y, this.v.z, cell);
    if (this.planet.heightM[c] < 0) return null;
    this.terrain.groundAt(this.v, c, this.w);
    orient(this.v, yaw, this.q);
    if (typeof scale === 'number') this.s.setScalar(scale);
    else this.s.copy(scale);
    return this.m.compose(this.w, this.q, this.s);
  }

  update(life: Life, near: boolean, cameraDistance: number, sunDir: THREE.Vector3, gameMinutes: number, nowMs: number): void {
    const towns = life.civ.living();
    const sig = towns.map((s) => `${s.id}:${houseCount(life.civ.inhabitants(s))}:${Math.min(36, s.fields)}:${s.temple ? 1 : 0}${s.wall ? 1 : 0}:${this.ageOf(life, s)}`).join('|');
    if (sig !== this.signature || nowMs - this.lastBuild > 4000) {
      this.signature = sig;
      this.lastBuild = nowMs;
      this.build(life, towns);
    }
    for (const m of [...this.styles, this.fields, this.temples, this.columnTemples, this.cathedrals, this.walls, this.ships]) m.visible = near;
    // Ships sail out and back along their lanes.
    const tsec = nowMs / 1000;
    let k = 0;
    for (const lane of this.shipLanes) {
      if (k >= MAX_SHIPS) break;
      const u = 0.5 + 0.5 * Math.sin(tsec * 0.05 + lane.phase);
      this.v.copy(lane.base).addScaledVector(lane.out, (0.3 + u * 1.6) * this.cellAngle).normalize();
      this.w.copy(this.v).multiplyScalar(R * 1.0005);
      const heading = Math.cos(tsec * 0.05 + lane.phase) >= 0 ? 0 : Math.PI;
      orient(this.v, Math.atan2(lane.out.dot(this.east(this.v)), lane.out.dot(this.north(this.v))) + heading, this.q);
      this.ships.setMatrixAt(k++, this.m.compose(this.w, this.q, this.s.setScalar(1.3)));
    }
    this.ships.count = k;
    this.ships.instanceMatrix.needsUpdate = true;
    // Fields follow the seasons.
    const yf = (gameMinutes % MINUTES_PER_YEAR) / MINUTES_PER_YEAR;
    const tint = yf < 0.25 ? this.c.setRGB(0.55, 0.78, 0.35) : yf < 0.5 ? this.c.setRGB(0.62, 0.74, 0.3) : yf < 0.75 ? this.c.setRGB(0.92, 0.78, 0.36) : this.c.setRGB(0.6, 0.5, 0.36);
    for (let i = 0; i < this.fieldCount; i++) this.fields.setColorAt(i, tint);
    if (this.fields.instanceColor) this.fields.instanceColor.needsUpdate = true;
    // Lights of the towns on the night side.
    let n = 0;
    for (const s of towns) {
      if (n >= MAX_LIGHTS) break;
      this.v.fromArray(this.planet.positions, s.cell * 3);
      if (this.v.dot(sunDir) > -0.05) continue;
      const people = life.civ.inhabitants(s);
      if (people < 12) continue;
      this.v.multiplyScalar(R * 1.012);
      this.lightPos.set([this.v.x, this.v.y, this.v.z], n * 3);
      n++;
    }
    const geo = this.lights.geometry;
    geo.setDrawRange(0, n);
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.lights.material as THREE.PointsMaterial).size = Math.max(1.2, Math.min(5, cameraDistance / 60));
    this.lights.visible = n > 0;
  }

  private houseColor(style: number, n: number): THREE.Color {
    const list = STYLE_COLORS[style];
    return list[Math.floor(hash(n) * list.length)];
  }

  private ageOf(life: Life, s: Settlement): number {
    return epochIndex(life.tribes.tribe(s.tribe)?.tech ?? 0);
  }

  private readonly e1 = new THREE.Vector3();
  private readonly n1 = new THREE.Vector3();
  private east(up: THREE.Vector3): THREE.Vector3 {
    return this.e1.set(up.z, 0, -up.x).normalize();
  }
  private north(up: THREE.Vector3): THREE.Vector3 {
    return this.n1.crossVectors(up, this.east(up)).normalize();
  }

  private build(life: Life, towns: Settlement[]): void {
    const kmu = this.kmPerUnit;
    const counts = [0, 0, 0, 0, 0];
    let ct = 0;
    let cc = 0;
    this.shipLanes = [];
    let h = 0;
    let f = 0;
    let tp = 0;
    let wl = 0;
    for (const s of towns) {
      const people = life.civ.inhabitants(s);
      const count = houseCount(people);
      const age = this.ageOf(life, s);
      const style = styleFor(age);
      this.houses = this.styles[style];
      h = counts[style];
      // Ships for seafaring peoples, sailing from the shore.
      const tribe = life.tribes.tribe(s.tribe);
      if (tribe && life.civ.knows(tribe, 'sailing')) {
        const planet = this.planet;
        for (let k = planet.neighborOffsets[s.cell]; k < planet.neighborOffsets[s.cell + 1]; k++) {
          const n = planet.neighbors[k];
          if (planet.heightM[n] >= 0) continue;
          const base = new THREE.Vector3().fromArray(planet.positions, n * 3);
          const center = new THREE.Vector3().fromArray(planet.positions, s.cell * 3);
          const out = base.clone().sub(center);
          out.addScaledVector(base, -out.dot(base)).normalize();
          const ships = life.civ.knows(tribe, 'steam') ? 3 : life.civ.knows(tribe, 'navigation') ? 2 : 1;
          for (let i = 0; i < ships; i++) this.shipLanes.push({ base, out, phase: hash(s.id * 31 + i) * 20, cell: n });
          break;
        }
      }
      const seed = hash(s.id) * Math.PI * 2;
      const step = 0.4 * kmu;
      let outer = 0;
      // Houses spiral outward (on land only: by the sea the spiral simply goes on further).
      for (let i = 0, made = 0; made < count && i < count * 3 && h < MAX_HOUSES; i++) {
        const r = step * Math.sqrt(i + (s.temple ? 2.5 : 0.6));
        const a = seed + i * 2.39996;
        const m = this.place(s.cell, [Math.cos(a) * r, Math.sin(a) * r], a + Math.PI + (hash(s.id + i) - 0.5) * 0.6, 1.25 + hash(s.id * 7 + i) * 0.25);
        if (!m) continue;
        outer = Math.max(outer, r);
        if (style === 4) {
          // Towers: taller near the centre and in bigger cities.
          const tall = (0.4 + Math.max(0, Math.min(4, Math.log10(Math.max(10, people)) - 2)) * (1.2 - i / count) + hash(s.id * 5 + i) * 0.5) * (age >= 9 ? 1.3 : 1);
          m.multiply(new THREE.Matrix4().makeScale(1, Math.max(0.5, tall), 1));
        }
        this.houses.setMatrixAt(h, m);
        this.houses.setColorAt(h, this.houseColor(style, s.id * 13 + i));
        h++;
        made++;
      }
      counts[style] = h;
      if (s.temple) {
        const m = this.place(s.cell, [0, 0], seed, 1.4);
        if (m && style === 0 && tp < MAX_TEMPLES) this.temples.setMatrixAt(tp++, m);
        else if (m && style === 1 && ct < MAX_TEMPLES) this.columnTemples.setMatrixAt(ct++, m);
        else if (m && style >= 2 && cc < MAX_TEMPLES) this.cathedrals.setMatrixAt(cc++, m);
      }
      if (s.wall && style <= 2) {
        const r = outer + 0.35 * kmu;
        const segs = Math.max(8, Math.ceil((2 * Math.PI * r) / (0.5 * kmu)));
        for (let i = 0; i < segs && wl < MAX_WALLS; i++) {
          const a = (i / segs) * Math.PI * 2;
          const m = this.place(s.cell, [Math.cos(a) * r, Math.sin(a) * r], a + Math.PI / 2, 1.25);
          if (m) this.walls.setMatrixAt(wl++, m);
        }
      }
      const fields = Math.min(36, s.fields);
      const ring = outer + 0.75 * kmu;
      for (let i = 0, made = 0; made < fields && i < fields * 3 && f < MAX_FIELDS; i++) {
        const row = Math.floor(i / 12);
        const r = ring + row * 0.7 * kmu;
        const a = seed + 0.4 + (i % 12) * ((Math.PI * 2) / 12) + row * 0.26;
        const m = this.place(s.cell, [Math.cos(a) * r, Math.sin(a) * r], a, 1.1 + hash(s.id * 3 + i) * 0.3);
        if (!m) continue;
        this.fields.setMatrixAt(f++, m);
        made++;
      }
    }
    this.fieldCount = f;
    for (const [mesh, count] of [
      ...this.styles.map((m, i) => [m, counts[i]] as const),
      [this.fields, f],
      [this.temples, tp],
      [this.columnTemples, ct],
      [this.cathedrals, cc],
      [this.walls, wl],
    ] as const) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
