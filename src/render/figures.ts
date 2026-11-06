/**
 * The people as small figures: legs, a body, arms with hands, a head with
 * eyes and a mouth, hair (short or long), a beard for some men, and the hat
 * and tool of their trade. Arms and legs move: walking, hammering, hoeing,
 * praying, dancing at a feast, standing with bowed heads at a funeral.
 * Everything is drawn with one instanced mesh per part.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Job } from '../sim/life/society';

const SCALE = 1.45;

function painted(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

function finish(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.scale(SCALE, SCALE, SCALE);
  g.computeVertexNormals();
  return g;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return finish(mergeGeometries(parts)!);
}

/** Joints (before scaling). */
const HIP_Y = 0.066;
const HIP_X = 0.014;
const SHOULDER_Y = 0.134;
const SHOULDER_X = 0.034;
const NECK_Y = 0.15;

const GEO = {
  torso: () => merged([painted(new THREE.CylinderGeometry(0.025, 0.033, 0.082, 8).translate(0, 0.103, 0), 0xffffff), painted(new THREE.CylinderGeometry(0.012, 0.014, 0.012, 6).translate(0, 0.149, 0), 0xffffff)]),
  leg: () => finish(painted(new THREE.CylinderGeometry(0.011, 0.009, 0.066, 6).translate(0, -0.033, 0), 0xffffff)),
  arm: () => finish(painted(new THREE.CylinderGeometry(0.0085, 0.0075, 0.058, 6).translate(0, -0.029, 0), 0xffffff)),
  hand: () => finish(painted(new THREE.IcosahedronGeometry(0.0095, 0).translate(0, -0.063, 0), 0xffffff)),
  head: () => finish(painted(new THREE.IcosahedronGeometry(0.033, 1).translate(0, 0.173, 0), 0xffffff)),
  hairShort: () => finish(painted(new THREE.SphereGeometry(0.0355, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-0.25).translate(0, 0.176, -0.003), 0xffffff)),
  hairLong: () =>
    merged([
      painted(new THREE.SphereGeometry(0.036, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-0.2).translate(0, 0.176, -0.002), 0xffffff),
      painted(new THREE.CylinderGeometry(0.03, 0.026, 0.05, 8, 1, true, Math.PI * 0.62, Math.PI * 0.76).translate(0, 0.157, -0.004), 0xffffff),
    ]),
  beard: () => finish(painted(new THREE.SphereGeometry(0.024, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 1.1, 0.8).translate(0, 0.165, 0.016), 0xffffff)),
  face: () =>
    merged([
      painted(new THREE.IcosahedronGeometry(0.0052, 0).translate(0.0115, 0.178, 0.03), 0xffffff),
      painted(new THREE.IcosahedronGeometry(0.0052, 0).translate(-0.0115, 0.178, 0.03), 0xffffff),
      painted(new THREE.BoxGeometry(0.013, 0.0032, 0.004).translate(0, 0.161, 0.031), 0xffffff),
    ]),
};

/** Hats (colours baked in). */
const HATS = {
  crown: () =>
    merged([
      painted(new THREE.CylinderGeometry(0.027, 0.028, 0.016, 10, 1, true).translate(0, 0.205, 0), 0xf2c46b),
      ...[0, 1, 2, 3, 4].map((i) => painted(new THREE.ConeGeometry(0.006, 0.014, 4).translate(Math.cos((i / 5) * Math.PI * 2) * 0.026, 0.219, Math.sin((i / 5) * Math.PI * 2) * 0.026), 0xf2c46b)),
    ]),
  helmet: () => merged([painted(new THREE.SphereGeometry(0.038, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.18, 0), 0x8d949c), painted(new THREE.BoxGeometry(0.005, 0.022, 0.006).translate(0, 0.172, 0.035), 0x8d949c)]),
  straw: () => merged([painted(new THREE.CylinderGeometry(0.062, 0.062, 0.005, 12).translate(0, 0.199, 0), 0xe2c47a), painted(new THREE.ConeGeometry(0.03, 0.03, 10).translate(0, 0.214, 0), 0xd8b866)]),
  mitre: () => merged([painted(new THREE.ConeGeometry(0.027, 0.065, 4).rotateY(Math.PI / 4).translate(0, 0.232, 0), 0xf4efe4), painted(new THREE.BoxGeometry(0.006, 0.05, 0.03).translate(0, 0.228, 0.001), 0xd9a441)]),
  feather: () => merged([painted(new THREE.TorusGeometry(0.033, 0.004, 4, 12).rotateX(Math.PI / 2).translate(0, 0.186, 0), 0x9a3b2a), painted(new THREE.BoxGeometry(0.004, 0.05, 0.014).rotateX(-0.35).translate(0, 0.215, -0.03), 0xf2f0e8)]),
};
export type HatId = keyof typeof HATS;

/** Tools, held in the right hand (coordinates of the arm, the hand at y = −0.063). */
const TOOLS = {
  spear: () => merged([painted(new THREE.CylinderGeometry(0.0028, 0.0028, 0.24, 4).translate(0, -0.045, 0.008), 0x6a4a30), painted(new THREE.ConeGeometry(0.007, 0.024, 4).translate(0, 0.087, 0.008), 0xa9a9a9)]),
  hoe: () => merged([painted(new THREE.CylinderGeometry(0.0028, 0.0028, 0.15, 4).translate(0, -0.09, 0.008), 0x6a4a30), painted(new THREE.BoxGeometry(0.02, 0.006, 0.026).translate(0, -0.163, 0.02), 0x7d7d7d)]),
  rod: () => merged([painted(new THREE.CylinderGeometry(0.0018, 0.0026, 0.2, 4).rotateX(0.9).translate(0, -0.03, 0.08), 0x8a6a40)]),
  hammer: () => merged([painted(new THREE.CylinderGeometry(0.0028, 0.0028, 0.05, 4).translate(0, -0.075, 0.01), 0x6a4a30), painted(new THREE.BoxGeometry(0.018, 0.012, 0.012).translate(0, -0.1, 0.01), 0x55585c)]),
  book: () => finish(painted(new THREE.BoxGeometry(0.024, 0.03, 0.008).translate(0, -0.07, 0.012), 0x7a2e2e)),
  bag: () => finish(painted(new THREE.BoxGeometry(0.022, 0.024, 0.014).translate(0, -0.08, 0.004), 0x8a6a48)),
  basket: () => finish(painted(new THREE.CylinderGeometry(0.016, 0.012, 0.016, 8).translate(0, -0.075, 0.008), 0xb08a50)),
  staff: () => finish(painted(new THREE.CylinderGeometry(0.003, 0.0032, 0.22, 4).translate(0, -0.03, 0.006), 0x5a4330)),
  torch: () => merged([painted(new THREE.CylinderGeometry(0.003, 0.0032, 0.07, 4).translate(0, -0.05, 0.008), 0x5a4330), painted(new THREE.ConeGeometry(0.008, 0.02, 5).translate(0, -0.006, 0.008), 0xffa23a)]),
};
export type ToolId = keyof typeof TOOLS;

const JOB_GEAR: Partial<Record<Job, { hat?: HatId; tool?: ToolId }>> = {
  hunter: { tool: 'spear' },
  soldier: { hat: 'helmet', tool: 'spear' },
  fisher: { tool: 'rod' },
  farmer: { hat: 'straw', tool: 'hoe' },
  builder: { tool: 'hammer' },
  smith: { tool: 'hammer' },
  worker: { tool: 'hammer' },
  engineer: { hat: 'helmet', tool: 'hammer' },
  healer: { tool: 'bag' },
  doctor: { tool: 'bag' },
  teacher: { tool: 'book' },
  scholar: { tool: 'book' },
  firekeeper: { tool: 'torch' },
  shaman: { hat: 'feather', tool: 'staff' },
  priest: { hat: 'mitre', tool: 'staff' },
  trader: { tool: 'bag' },
  chief: { hat: 'feather' },
  ruler: { hat: 'crown' },
  elder: { tool: 'staff' },
  gatherer: { tool: 'basket' },
};

export interface FigurePose {
  /** Where the feet are, which way the figure faces, how big it is. */
  base: THREE.Matrix4;
  action: string;
  talking: boolean;
  /** Seconds, for the movements. */
  time: number;
  id: number;
  job: Job;
  female: boolean;
  beard: boolean;
  lying: boolean;
  colors: { cloth: THREE.Color; legs: THREE.Color; skin: THREE.Color; hair: THREE.Color; face: THREE.Color };
}

type Part = 'torso' | 'leg' | 'arm' | 'hand' | 'head' | 'hairShort' | 'hairLong' | 'beard' | 'face';

export class Figures {
  readonly meshes: THREE.InstancedMesh[] = [];
  private readonly parts = {} as Record<Part, THREE.InstancedMesh>;
  private readonly hats = {} as Record<HatId, THREE.InstancedMesh>;
  private readonly tools = {} as Record<ToolId, THREE.InstancedMesh>;
  private readonly count = new Map<THREE.InstancedMesh, number>();
  private readonly m = new THREE.Matrix4();
  private readonly j = new THREE.Matrix4();
  private readonly r = new THREE.Matrix4();
  private readonly headM = new THREE.Matrix4();
  private readonly baseM = new THREE.Matrix4();
  private readonly armM = new THREE.Matrix4();
  private readonly rightM = new THREE.Matrix4();

  constructor(group: THREE.Group, max: number) {
    const mat = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
    const make = (geo: THREE.BufferGeometry, n: number, colored: boolean) => {
      const mesh = new THREE.InstancedMesh(geo, mat(), n);
      if (colored) mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      mesh.count = 0;
      mesh.frustumCulled = false;
      group.add(mesh);
      this.meshes.push(mesh);
      return mesh;
    };
    for (const k of Object.keys(GEO) as Part[]) this.parts[k] = make(GEO[k](), k === 'leg' || k === 'arm' || k === 'hand' ? max * 2 : max, true);
    for (const k of Object.keys(HATS) as HatId[]) this.hats[k] = make(HATS[k](), Math.ceil(max / 2), false);
    for (const k of Object.keys(TOOLS) as ToolId[]) this.tools[k] = make(TOOLS[k](), Math.ceil(max / 2), false);
  }

  begin(): void {
    for (const mesh of this.meshes) this.count.set(mesh, 0);
  }

  private put(mesh: THREE.InstancedMesh, matrix: THREE.Matrix4, color?: THREE.Color): void {
    const i = this.count.get(mesh) ?? 0;
    if (i >= mesh.instanceMatrix.count) return;
    mesh.setMatrixAt(i, matrix);
    if (color) mesh.setColorAt(i, color);
    this.count.set(mesh, i + 1);
  }

  /** The angles of the limbs for an action (arms forward are negative). */
  private pose(p: FigurePose): { legL: number; legR: number; armL: number; armR: number; head: number; bend: number; lift: number } {
    const t = p.time;
    const ph = t * 9 + p.id;
    const out = { legL: 0, legR: 0, armL: Math.sin(t * 1.3 + p.id) * 0.05, armR: -Math.sin(t * 1.3 + p.id) * 0.05, head: 0, bend: 0, lift: 0 };
    if (p.lying) return { legL: 0, legR: 0, armL: 0, armR: 0, head: 0, bend: 0, lift: 0 };
    switch (p.action) {
      case 'walk': {
        const s = Math.sin(ph) * 0.55;
        out.legL = s;
        out.legR = -s;
        out.armL = -s * 0.8;
        out.armR = s * 0.8;
        out.lift = Math.abs(Math.cos(ph)) * 0.006;
        break;
      }
      case 'carried':
        out.armL = -2.6 + Math.sin(t * 7) * 0.3;
        out.armR = -2.6 - Math.sin(t * 7) * 0.3;
        out.legL = Math.sin(t * 6) * 0.4;
        out.legR = -out.legL;
        break;
      case 'celebrate': {
        const s = Math.sin(t * 5 + p.id);
        out.armL = -2.3 + s * 0.6;
        out.armR = -2.3 - s * 0.6;
        out.legL = Math.max(0, s) * 0.5;
        out.legR = Math.max(0, -s) * 0.5;
        out.lift = Math.abs(Math.sin(t * 5 + p.id)) * 0.012;
        break;
      }
      case 'mourn':
        out.armL = -0.35;
        out.armR = -0.35;
        out.head = 0.4;
        break;
      case 'pray':
        out.armL = -2.2;
        out.armR = -2.2;
        out.head = -0.2;
        break;
      case 'build':
      case 'smith':
        out.armR = -1.7 + Math.sin(t * 10 + p.id) * 0.7;
        out.armL = -0.5;
        out.bend = 0.1;
        break;
      case 'farm':
        out.armR = -0.9 + Math.sin(t * 5 + p.id) * 0.45;
        out.armL = out.armR + 0.1;
        out.bend = 0.18;
        break;
      case 'gather':
        out.armR = -0.9 + Math.sin(t * 4 + p.id) * 0.3;
        out.armL = -0.8 - Math.sin(t * 4 + p.id) * 0.3;
        out.bend = 0.38;
        out.head = 0.15;
        break;
      case 'fish':
        out.armR = -1.1;
        out.armL = -0.6;
        break;
      case 'hunt':
        out.armR = -2.4 + Math.sin(t * 3 + p.id) * 0.25;
        out.armL = -0.6;
        break;
      case 'eat':
        out.armR = -1.95 + Math.sin(t * 3 + p.id) * 0.3;
        break;
      case 'heal':
      case 'tinker':
        out.armR = -1.2 + Math.sin(t * 4 + p.id) * 0.2;
        out.armL = -1.1;
        out.bend = 0.2;
        break;
      case 'study':
        out.armR = -1.1;
        out.armL = -1.0;
        out.head = 0.25;
        break;
      case 'fire':
        out.armR = -0.9 + Math.sin(t * 3 + p.id) * 0.3;
        break;
      case 'guard':
        out.armR = -0.15;
        break;
      case 'trade':
      case 'teach':
        out.armR = -0.9 + Math.sin(t * 4 + p.id) * 0.35;
        break;
      default:
        if (p.talking) out.armR = -0.8 + Math.sin(t * 4 + p.id) * 0.35;
    }
    return out;
  }

  add(p: FigurePose): void {
    const a = this.pose(p);
    const c = p.colors;
    // The whole figure, bent forward a little for some work.
    const body = this.m.copy(p.base);
    if (a.lift) body.multiply(this.r.makeTranslation(0, a.lift, 0));
    if (a.bend) body.multiply(this.r.makeTranslation(0, HIP_Y * SCALE, 0)).multiply(this.j.makeRotationX(a.bend)).multiply(this.r.makeTranslation(0, -HIP_Y * SCALE, 0));
    const base = this.baseM.copy(body);
    this.put(this.parts.torso, base, c.cloth);
    // Legs stay upright when bending.
    for (const [x, ang] of [
      [-HIP_X, a.legL],
      [HIP_X, a.legR],
    ]) {
      this.j.copy(p.base);
      if (a.lift) this.j.multiply(this.r.makeTranslation(0, a.lift, 0));
      this.j.multiply(this.r.makeTranslation(x * SCALE, HIP_Y * SCALE, 0)).multiply(this.r.makeRotationX(ang));
      this.put(this.parts.leg, this.j, c.legs);
    }
    let right: THREE.Matrix4 | null = null;
    for (const [x, ang] of [
      [-SHOULDER_X, a.armL],
      [SHOULDER_X, a.armR],
    ]) {
      const arm = this.armM.copy(base).multiply(this.r.makeTranslation(x * SCALE, SHOULDER_Y * SCALE, 0)).multiply(this.j.makeRotationX(ang)).multiply(this.r.makeRotationZ(x > 0 ? 0.12 : -0.12));
      this.put(this.parts.arm, arm, c.cloth);
      this.put(this.parts.hand, arm, c.skin);
      if (x > 0) right = this.rightM.copy(arm);
    }
    // Head (bowed or raised).
    const head = this.headM.copy(base);
    if (a.head) head.multiply(this.r.makeTranslation(0, NECK_Y * SCALE, 0)).multiply(this.j.makeRotationX(a.head)).multiply(this.r.makeTranslation(0, -NECK_Y * SCALE, 0));
    this.put(this.parts.head, head, c.skin);
    this.put(this.parts.face, head, c.face);
    const gear = p.lying ? undefined : JOB_GEAR[p.job];
    if (gear?.hat !== 'helmet' && gear?.hat !== 'mitre') this.put(p.female ? this.parts.hairLong : this.parts.hairShort, head, c.hair);
    if (p.beard) this.put(this.parts.beard, head, c.hair);
    if (gear?.hat) this.put(this.hats[gear.hat], head);
    if (gear?.tool && right) this.put(this.tools[gear.tool], right);
  }

  end(): void {
    for (const mesh of this.meshes) {
      mesh.count = this.count.get(mesh) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  setVisible(on: boolean): void {
    for (const mesh of this.meshes) mesh.visible = on;
  }
}
