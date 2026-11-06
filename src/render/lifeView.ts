/**
 * People, animals and graves on the planet.
 *
 * People are minimal pawn figures (no faces, as planned): body in clothing
 * color, head in skin color, a hair cap. Sleeping and dead people lie down.
 * Animals are drawn only for herds near the camera, a few per herd.
 * Far away, golden dots show where people are.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlanetData } from '../sim/planet/generate';
import { nearestCell } from '../sim/planet/geodesic';
import type { Life } from '../sim/life/life';
import { REVIVE_WINDOW } from '../sim/life/life';
import type { Herd, Person, SpeciesId } from '../sim/life/types';
import { CLOTH_COLORS, HAIR_COLORS, HAIR_GREY } from '../sim/life/types';
import { MINUTES_PER_YEAR } from '../sim/clock';
import { SPECIES_IDS } from '../sim/life/species';
import type { TerrainView } from './terrain';
import { R } from './scale';

const PERSON_SCALE = 1.45;
const MAX_PEOPLE = 360;
const MAX_GRAVES = 400;
/** Graves stay visible for this long. */
const GRAVE_YEARS = 12;

/** Children are drawn smaller: a baby is about 45 % of an adult. */
function ageScale(age: number): number {
  if (age >= 17) return 1;
  if (age < 3) return 0.45 + age * 0.04;
  return 0.57 + ((age - 3) / 14) * 0.43;
}
const MAX_ANIMALS = 900;
const SKIN_LIGHT = new THREE.Color(0xf0caa6);
const SKIN_DARK = new THREE.Color(0x4f3220);
const DEAD = new THREE.Color(0x77736e);
const Y = new THREE.Vector3(0, 1, 0);
const basis = new THREE.Matrix4();
const east = new THREE.Vector3();
const south = new THREE.Vector3();
const spin = new THREE.Quaternion();

/** Stands an object upright at `up`, its front (+z) turned `yaw` radians from north toward east. */
function orient(up: THREE.Vector3, yaw: number, out: THREE.Quaternion): THREE.Quaternion {
  east.set(up.z, 0, -up.x);
  if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
  east.normalize();
  // A right-handed frame: x = east, y = up, z = east × up (= south).
  south.crossVectors(east, up);
  basis.makeBasis(east, up, south);
  out.setFromRotationMatrix(basis);
  // Turning by π − yaw points +z at north·cos(yaw) + east·sin(yaw).
  return out.multiply(spin.setFromAxisAngle(Y, Math.PI - yaw));
}

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Direction (unit vector) of something moving between two cells, shifted by a spot in km. */
export function entityDir(planet: PlanetData, cell: number, next: number, progress: number, spot: [number, number] | null, out: THREE.Vector3): THREE.Vector3 {
  out.fromArray(planet.positions, cell * 3);
  if (next >= 0 && progress > 0) {
    const nx = planet.positions[next * 3];
    const ny = planet.positions[next * 3 + 1];
    const nz = planet.positions[next * 3 + 2];
    out.set(out.x + (nx - out.x) * progress, out.y + (ny - out.y) * progress, out.z + (nz - out.z) * progress).normalize();
  }
  if (spot) {
    // East and north at this point.
    let ex = out.z;
    let ez = -out.x;
    const len = Math.hypot(ex, ez) || 1;
    ex /= len;
    ez /= len;
    const nx = out.y * ez;
    const ny = out.z * ex - out.x * ez;
    const nz = -out.y * ex;
    const k = 1 / planet.radiusKm;
    out.x += (ex * spot[0] + nx * spot[1]) * k;
    out.y += ny * spot[1] * k;
    out.z += (ez * spot[0] + nz * spot[1]) * k;
    out.normalize();
  }
  return out;
}

function personGeometries(): { body: THREE.BufferGeometry; head: THREE.BufferGeometry; hair: THREE.BufferGeometry } {
  const body = new THREE.CylinderGeometry(0.032, 0.056, 0.15, 7).translate(0, 0.075, 0);
  const head = new THREE.IcosahedronGeometry(0.042, 1).translate(0, 0.19, 0);
  const hair = new THREE.SphereGeometry(0.046, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.193, 0);
  for (const g of [body, head, hair]) g.scale(PERSON_SCALE, PERSON_SCALE, PERSON_SCALE);
  return { body, head, hair };
}

/** A simple four-legged animal, oriented along +z. Colors are baked in (body, legs, tusks). */
function animalGeometry(species: SpeciesId): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, hex: number) => {
    const geo = g.index ? g.toNonIndexed() : g;
    const c = new THREE.Color(hex);
    const n = geo.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.deleteAttribute('uv');
    parts.push(geo);
  };
  const legs = (w: number, l: number, h: number, hex: number) => {
    for (const [x, z] of [
      [w, l],
      [-w, l],
      [w, -l],
      [-w, -l],
    ]) {
      paint(new THREE.BoxGeometry(0.018, h, 0.018).translate(x, h / 2, z), hex);
    }
  };
  if (species === 'deer') {
    paint(new THREE.BoxGeometry(0.06, 0.055, 0.14).translate(0, 0.1, 0), 0x8f5d34);
    paint(new THREE.BoxGeometry(0.035, 0.04, 0.05).translate(0, 0.16, 0.08), 0x8f5d34);
    paint(new THREE.ConeGeometry(0.008, 0.05, 4).translate(0.012, 0.2, 0.08), 0xd9c8a8);
    paint(new THREE.ConeGeometry(0.008, 0.05, 4).translate(-0.012, 0.2, 0.08), 0xd9c8a8);
    legs(0.02, 0.05, 0.075, 0x5f3d22);
  } else if (species === 'bison') {
    paint(new THREE.BoxGeometry(0.085, 0.08, 0.16).translate(0, 0.1, 0), 0x4c3424);
    paint(new THREE.BoxGeometry(0.095, 0.09, 0.07).translate(0, 0.115, 0.05), 0x3a271a);
    paint(new THREE.BoxGeometry(0.05, 0.05, 0.05).translate(0, 0.09, 0.105), 0x2e2016);
    legs(0.028, 0.055, 0.06, 0x2e2016);
  } else if (species === 'mammoth') {
    paint(new THREE.BoxGeometry(0.13, 0.12, 0.2).translate(0, 0.15, 0), 0x6e4a2f);
    paint(new THREE.BoxGeometry(0.09, 0.09, 0.07).translate(0, 0.2, 0.12), 0x6e4a2f);
    paint(new THREE.CylinderGeometry(0.012, 0.016, 0.1, 5).translate(0, 0.12, 0.16), 0x5a3b25);
    paint(new THREE.ConeGeometry(0.01, 0.09, 4).rotateX(Math.PI / 2.6).translate(0.03, 0.15, 0.18), 0xf0ead8);
    paint(new THREE.ConeGeometry(0.01, 0.09, 4).rotateX(Math.PI / 2.6).translate(-0.03, 0.15, 0.18), 0xf0ead8);
    legs(0.045, 0.07, 0.09, 0x553823);
  } else {
    paint(new THREE.BoxGeometry(0.045, 0.045, 0.12).translate(0, 0.075, 0), 0x7e8085);
    paint(new THREE.BoxGeometry(0.035, 0.035, 0.05).translate(0, 0.1, 0.075), 0x8b8d92);
    paint(new THREE.ConeGeometry(0.008, 0.02, 4).translate(0.01, 0.125, 0.07), 0x6d6f74);
    paint(new THREE.ConeGeometry(0.008, 0.02, 4).translate(-0.01, 0.125, 0.07), 0x6d6f74);
    paint(new THREE.BoxGeometry(0.012, 0.012, 0.06).rotateX(-0.6).translate(0, 0.09, -0.08), 0x6d6f74);
    legs(0.016, 0.04, 0.055, 0x5d5f63);
  }
  const g = mergeGeometries(parts)!;
  g.scale(2.1, 2.1, 2.1);
  g.computeVertexNormals();
  return g;
}

function dotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.35, 'rgba(242,196,107,0.95)');
  g.addColorStop(1, 'rgba(242,196,107,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface ScreenEntity {
  kind: 'person' | 'herd';
  id: number;
  alive: boolean;
  pos: THREE.Vector3;
}

export class LifeView {
  readonly group = new THREE.Group();
  private readonly body: THREE.InstancedMesh;
  private readonly head: THREE.InstancedMesh;
  private readonly hair: THREE.InstancedMesh;
  private readonly graves: THREE.InstancedMesh;
  private readonly animals: Record<SpeciesId, THREE.InstancedMesh>;
  private readonly dots: THREE.Points;
  private readonly dotPositions: Float32Array;
  private readonly shown = new Map<number, THREE.Vector3>();
  private readonly entities: ScreenEntity[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor(
    private readonly planet: PlanetData,
    private readonly terrain: TerrainView,
  ) {
    const geo = personGeometries();
    const mat = () => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85 });
    this.body = new THREE.InstancedMesh(geo.body, mat(), MAX_PEOPLE);
    this.head = new THREE.InstancedMesh(geo.head, mat(), MAX_PEOPLE);
    this.hair = new THREE.InstancedMesh(geo.hair, mat(), MAX_PEOPLE);
    const stones = mergeGeometries([
      new THREE.DodecahedronGeometry(0.05, 0).translate(0, 0.03, 0),
      new THREE.DodecahedronGeometry(0.035, 0).translate(0.045, 0.02, 0.02),
      new THREE.DodecahedronGeometry(0.03, 0).translate(-0.035, 0.02, -0.03),
      new THREE.DodecahedronGeometry(0.03, 0).translate(0.005, 0.08, 0.005),
    ].map((g) => (g.index ? g.toNonIndexed() : g)))!;
    stones.scale(1.6, 1.6, 1.6);
    stones.computeVertexNormals();
    this.graves = new THREE.InstancedMesh(stones, new THREE.MeshStandardMaterial({ color: 0x8d8a84, flatShading: true, roughness: 1 }), MAX_GRAVES);
    this.animals = {} as Record<SpeciesId, THREE.InstancedMesh>;
    for (const sp of SPECIES_IDS) {
      const mesh = new THREE.InstancedMesh(animalGeometry(sp), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), MAX_ANIMALS);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.animals[sp] = mesh;
      this.group.add(mesh);
    }
    for (const mesh of [this.body, this.head, this.hair, this.graves]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    this.dotPositions = new Float32Array(MAX_PEOPLE * 3);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(this.dotPositions, 3).setUsage(THREE.DynamicDrawUsage));
    dg.setDrawRange(0, 0);
    this.dots = new THREE.Points(
      dg,
      new THREE.PointsMaterial({ map: dotTexture(), size: 14, sizeAttenuation: false, transparent: true, depthWrite: false, color: 0xffffff, fog: false }),
    );
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 8;
    this.group.add(this.dots);
    this.group.name = 'life';
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

  /** Forget smoothed positions (after rewinding), so nobody slides across the planet. */
  reset(): void {
    this.shown.clear();
  }

  /** Where something is drawn right now (for following, bubbles and tapping). */
  shownPosition(id: number): THREE.Vector3 | undefined {
    return this.shown.get(id);
  }

  /** Everything that can be tapped. */
  get tappable(): readonly ScreenEntity[] {
    return this.entities;
  }

  private ground(dir: THREE.Vector3, cell: number, out: THREE.Vector3): THREE.Vector3 {
    const c = nearestCell(this.planet, dir.x, dir.y, dir.z, cell);
    return this.terrain.groundAt(dir, c, out);
  }

  private smoothTo(id: number, target: THREE.Vector3, dt: number): THREE.Vector3 {
    let p = this.shown.get(id);
    if (!p) {
      p = target.clone();
      this.shown.set(id, p);
      return p;
    }
    if (p.distanceToSquared(target) > 9) p.copy(target);
    else p.lerp(target, 1 - Math.exp(-dt * 6));
    return p;
  }

  update(dt: number, life: Life, now: number, gameMinutes: number, camera: THREE.PerspectiveCamera, cameraDistance: number, focus: THREE.Vector3): void {
    const planet = this.planet;
    this.entities.length = 0;
    const seen = new Set<number>();
    let n = 0;
    let graves = 0;
    let dots = 0;
    const near = cameraDistance < 70;

    const grave = (cell: number, spot: [number, number]) => {
      if (graves >= MAX_GRAVES || !near) return;
      entityDir(planet, cell, -1, 0, spot, this.v);
      this.ground(this.v, cell, this.w);
      this.q.setFromUnitVectors(Y, this.v);
      this.m.compose(this.w, this.q, this.s.setScalar(1));
      this.graves.setMatrixAt(graves++, this.m);
    };
    // Graves of those who died in the last years (newest first).
    const archive = life.archive;
    for (let i = archive.length - 1; i >= 0 && graves < MAX_GRAVES && near; i--) {
      const a = archive[i];
      if (gameMinutes - a.died > GRAVE_YEARS * MINUTES_PER_YEAR) break;
      grave(a.cell, a.spot);
    }

    for (const p of life.people) {
      const recent = !p.alive && p.died !== undefined && gameMinutes - p.died < REVIVE_WINDOW;
      if (!p.alive && !recent) {
        grave(p.cell, p.spot);
        continue;
      }
      if (n >= MAX_PEOPLE) break;
      seen.add(p.id);
      const target = this.personTarget(p, gameMinutes, this.w);
      const pos = this.smoothTo(p.id, target, dt);
      const up = this.v.copy(pos).normalize();
      this.entities.push({ kind: 'person', id: p.id, alive: p.alive, pos });
      if (p.alive && dots < MAX_PEOPLE) {
        this.dotPositions.set([pos.x + up.x * 0.7, pos.y + up.y * 0.7, pos.z + up.z * 0.7], dots * 3);
        dots++;
      }
      if (!near) continue;

      // Pose.
      const lying = !p.alive || p.action === 'sleep';
      orient(up, this.facing(p), this.q);
      const age = ((p.died ?? gameMinutes) - p.born) / MINUTES_PER_YEAR;
      const draw = this.s.setScalar(p.look.height * ageScale(age));
      const at = this.w.copy(pos);
      if (lying) {
        this.q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        this.q.multiply(this.q2);
        at.addScaledVector(up, 0.05);
      } else if (p.action === 'walk') {
        at.addScaledVector(up, Math.abs(Math.sin(now * 9 + p.id)) * 0.025);
      }
      this.m.compose(at, this.q, draw);
      this.body.setMatrixAt(n, this.m);
      this.head.setMatrixAt(n, this.m);
      this.hair.setMatrixAt(n, this.m);
      if (p.alive) {
        this.body.setColorAt(n, this.c.setHex(CLOTH_COLORS[p.look.clothes] ?? CLOTH_COLORS[0]));
        this.head.setColorAt(n, this.c.copy(SKIN_LIGHT).lerp(SKIN_DARK, p.look.skin));
        this.hair.setColorAt(n, this.c.setHex(HAIR_COLORS[age >= 52 ? HAIR_GREY : p.look.hair] ?? HAIR_COLORS[0]));
      } else {
        this.body.setColorAt(n, DEAD);
        this.head.setColorAt(n, DEAD);
        this.hair.setColorAt(n, DEAD);
      }
      n++;
    }
    for (const mesh of [this.body, this.head, this.hair]) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.graves.count = graves;
    this.graves.instanceMatrix.needsUpdate = true;

    // Dots for the overview.
    const dotAlpha = THREE.MathUtils.smoothstep(cameraDistance, 14, 30);
    const dotMat = this.dots.material as THREE.PointsMaterial;
    dotMat.opacity = dotAlpha;
    this.dots.visible = dotAlpha > 0.01;
    this.dots.geometry.setDrawRange(0, dots);
    (this.dots.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    dotMat.size = 10 + 6 * (0.5 + 0.5 * Math.sin(now * 3));

    this.updateAnimals(dt, life, now, camera, cameraDistance, focus, seen);

    // Forget people and herds that are gone.
    for (const id of [...this.shown.keys()]) if (!seen.has(id)) this.shown.delete(id);
  }

  private personTarget(p: Person, gameMinutes: number, out: THREE.Vector3): THREE.Vector3 {
    const planet = this.planet;
    if (p.alive && p.action === 'carried' && p.carriedFrom !== undefined && p.carriedAt !== undefined) {
      // Carried by the invisible hand: an arc through the air.
      const k = Math.min(1, Math.max(0, (gameMinutes - p.carriedAt) / 120));
      const a = new THREE.Vector3().fromArray(planet.positions, p.carriedFrom * 3);
      const b = new THREE.Vector3().fromArray(planet.positions, p.cell * 3);
      const dir = a.lerp(b, k).normalize();
      this.ground(dir, k < 0.5 ? p.carriedFrom : p.cell, out);
      return out.addScaledVector(dir, Math.sin(k * Math.PI) * 6);
    }
    const progress = p.alive && p.action === 'walk' ? p.progress : 0;
    entityDir(planet, p.cell, p.alive ? p.next : -1, progress, p.spot, this.v);
    return this.ground(this.v, p.cell, out);
  }

  private facing(p: Person): number {
    if (p.alive && p.action === 'walk' && p.next >= 0) {
      // Rough heading: compare the walk direction with local north.
      const a = new THREE.Vector3().fromArray(this.planet.positions, p.cell * 3);
      const b = new THREE.Vector3().fromArray(this.planet.positions, p.next * 3).sub(a);
      const e = new THREE.Vector3(a.z, 0, -a.x).normalize();
      const nn = new THREE.Vector3().crossVectors(a, e);
      return Math.atan2(b.dot(e), b.dot(nn));
    }
    return hash(p.id) * Math.PI * 2;
  }

  private updateAnimals(dt: number, life: Life, now: number, camera: THREE.PerspectiveCamera, cameraDistance: number, focus: THREE.Vector3, seen: Set<number>): void {
    const counts: Record<SpeciesId, number> = { deer: 0, bison: 0, mammoth: 0, wolf: 0 };
    if (cameraDistance < 48) {
      const reach = Math.cos(Math.min(1.2, (cameraDistance * 1.3) / R));
      const tangentA = new THREE.Vector3();
      const tangentB = new THREE.Vector3();
      const dir = new THREE.Vector3();
      const place = new THREE.Vector3();
      for (const h of life.herds) {
        entityDir(this.planet, h.cell, h.next, h.progress, null, dir);
        if (dir.dot(focus) < reach) continue;
        const target = this.ground(dir, h.cell, new THREE.Vector3());
        const center = this.smoothTo(h.id, target, dt);
        seen.add(h.id);
        this.entities.push({ kind: 'herd', id: h.id, alive: true, pos: center });
        const up = dir.copy(center).normalize();
        tangentA.set(up.z, 0, -up.x).normalize();
        tangentB.crossVectors(up, tangentA);
        const shownCount = Math.min(h.count, h.species === 'mammoth' ? 5 : 8);
        const spread = 0.35 + 0.06 * Math.sqrt(h.count);
        const heading = this.herdHeading(h, up, tangentA, tangentB);
        for (let i = 0; i < shownCount; i++) {
          const mesh = this.animals[h.species];
          const k = counts[h.species];
          if (k >= MAX_ANIMALS) break;
          const r = spread * Math.sqrt(hash(h.id * 31 + i));
          const a = hash(h.id * 17 + i * 7) * Math.PI * 2;
          place.copy(center).addScaledVector(tangentA, Math.cos(a) * r).addScaledVector(tangentB, Math.sin(a) * r);
          const pdir = place.normalize();
          this.ground(pdir, h.cell, this.w);
          const yaw = heading ?? hash(h.id + i * 13) * Math.PI * 2 + Math.sin(now * 0.4 + i) * 0.4;
          orient(pdir, yaw, this.q);
          this.m.compose(this.w, this.q, this.s.setScalar(0.85 + hash(h.id * 3 + i) * 0.3));
          mesh.setMatrixAt(k, this.m);
          counts[h.species]++;
        }
      }
    }
    for (const sp of SPECIES_IDS) {
      this.animals[sp].count = counts[sp];
      this.animals[sp].instanceMatrix.needsUpdate = true;
    }
    void camera;
  }

  private herdHeading(h: Herd, up: THREE.Vector3, east: THREE.Vector3, north: THREE.Vector3): number | null {
    if (h.next < 0) return null;
    const b = new THREE.Vector3().fromArray(this.planet.positions, h.next * 3).sub(up);
    return Math.atan2(b.dot(east), b.dot(north));
  }
}
