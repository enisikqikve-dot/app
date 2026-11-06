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
import { R } from './scale';

const MAX_HOUSES = 2400;
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
const HOUSE_COLORS = [0xd2b48c, 0xc9a77c, 0xdcc39b, 0xbf9d72, 0xe0cba6].map((c) => new THREE.Color(c));

export class TownView {
  readonly group = new THREE.Group();
  private readonly houses: THREE.InstancedMesh;
  private readonly fields: THREE.InstancedMesh;
  private readonly temples: THREE.InstancedMesh;
  private readonly walls: THREE.InstancedMesh;
  private readonly lights: THREE.Points;
  private readonly lightPos = new Float32Array(MAX_LIGHTS * 3);
  private signature = '';
  private lastBuild = 0;
  private readonly kmPerUnit: number;
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
    const mat = (rough: number) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: rough });
    this.houses = new THREE.InstancedMesh(houseGeometry(), mat(0.95), MAX_HOUSES);
    this.fields = new THREE.InstancedMesh(fieldGeometry(), mat(1), MAX_FIELDS);
    this.temples = new THREE.InstancedMesh(templeGeometry(), mat(0.9), MAX_TEMPLES);
    this.walls = new THREE.InstancedMesh(wallGeometry(), mat(0.95), MAX_WALLS);
    this.houses.setColorAt(0, WALL_COLOR);
    this.fields.setColorAt(0, WALL_COLOR);
    for (const mesh of [this.houses, this.fields, this.temples, this.walls]) {
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
    const sig = towns.map((s) => `${s.id}:${houseCount(life.civ.inhabitants(s))}:${Math.min(36, s.fields)}:${s.temple ? 1 : 0}${s.wall ? 1 : 0}`).join('|');
    if (sig !== this.signature || nowMs - this.lastBuild > 4000) {
      this.signature = sig;
      this.lastBuild = nowMs;
      this.build(life, towns);
    }
    this.houses.visible = this.fields.visible = this.temples.visible = this.walls.visible = near;
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

  private build(life: Life, towns: Settlement[]): void {
    const kmu = this.kmPerUnit;
    let h = 0;
    let f = 0;
    let tp = 0;
    let wl = 0;
    for (const s of towns) {
      const people = life.civ.inhabitants(s);
      const count = houseCount(people);
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
        this.houses.setMatrixAt(h, m);
        this.houses.setColorAt(h, HOUSE_COLORS[Math.floor(hash(s.id * 13 + i) * HOUSE_COLORS.length)]);
        h++;
        made++;
      }
      if (s.temple && tp < MAX_TEMPLES) {
        const m = this.place(s.cell, [0, 0], seed, 1.4);
        if (m) this.temples.setMatrixAt(tp++, m);
      }
      if (s.wall) {
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
      [this.houses, h],
      [this.fields, f],
      [this.temples, tp],
      [this.walls, wl],
    ] as const) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
