/**
 * Visual effects for the divine powers.
 *
 * One-shot effects (a lightning bolt, a meteor's flight and impact) play in
 * real time when a power is used. Ongoing views (rain, storms, waves, an
 * erupting volcano) are driven by the world's scars, so they also appear
 * correctly after rewinding.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { R } from '../scale';
import { ParticleSystem } from './particles';

export interface FxContext {
  root: THREE.Group;
  sparks: ParticleSystem;
  smoke: ParticleSystem;
  shake: (strength: number, seconds: number) => void;
  /** Point on the ground or water surface of a cell. */
  surfacePoint: (cell: number, out?: THREE.Vector3) => THREE.Vector3;
  kmToUnits: (km: number) => number;
}

export interface Effect {
  /** Returns false when finished. */
  update(dt: number): boolean;
  dispose(): void;
}

const ORANGE = new THREE.Color(0xffa040);
const RED = new THREE.Color(0xc0300c);
const YELLOW = new THREE.Color(0xfff0b0);
const SMOKE_DARK = new THREE.Color(0x2c2a29);
const SMOKE_GREY = new THREE.Color(0x77736d);
const DUST = new THREE.Color(0x8f7a5c);
const WHITE = new THREE.Color(0xffffff);

function randomUnit(out = new THREE.Vector3()): THREE.Vector3 {
  out.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  if (out.lengthSq() < 1e-4) out.set(1, 0, 0);
  return out.normalize();
}

/** Two tangent vectors perpendicular to n. */
function tangents(n: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const helper = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const a = new THREE.Vector3().crossVectors(n, helper).normalize();
  const b = new THREE.Vector3().crossVectors(n, a).normalize();
  return [a, b];
}

let glowTex: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.2, 'rgba(255,200,120,0.85)');
  g.addColorStop(0.5, 'rgba(255,120,40,0.3)');
  g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(canvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

function glowSprite(color: number, scale: number): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }),
  );
  sprite.scale.setScalar(scale);
  return sprite;
}

function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
  obj.removeFromParent();
}

/** A cylinder from a to b. */
function segment(a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 5, 1, true);
  geo.translate(0, len / 2, 0);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  geo.translate(a.x, a.y, a.z);
  geo.deleteAttribute('uv');
  return geo;
}

// ------------------------------------------------------------------ one-shot effects

export class LightningFx implements Effect {
  private readonly group = new THREE.Group();
  private readonly light: THREE.PointLight;
  private readonly materials: THREE.MeshBasicMaterial[] = [];
  private t = 0;

  constructor(ctx: FxContext, target: THREE.Vector3) {
    const n = target.clone().normalize();
    const [ta, tb] = tangents(n);
    const top = target.clone().addScaledVector(n, 15).addScaledVector(ta, (Math.random() - 0.5) * 5).addScaledVector(tb, (Math.random() - 0.5) * 5);
    const main = this.jagged(top, target, 14, 1.3, ta, tb);
    const parts: THREE.BufferGeometry[] = [];
    const glowParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < main.length - 1; i++) {
      parts.push(segment(main[i], main[i + 1], 0.07));
      glowParts.push(segment(main[i], main[i + 1], 0.28));
    }
    for (let b = 0; b < 3; b++) {
      const from = main[2 + Math.floor(Math.random() * 7)];
      const away = from.clone().addScaledVector(ta, (Math.random() - 0.5) * 9).addScaledVector(tb, (Math.random() - 0.5) * 9).addScaledVector(n, -Math.random() * 5);
      const branch = this.jagged(from, away, 6, 0.8, ta, tb);
      for (let i = 0; i < branch.length - 1; i++) parts.push(segment(branch[i], branch[i + 1], 0.035));
    }
    const core = new THREE.MeshBasicMaterial({ color: 0xf2f6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    const halo = new THREE.MeshBasicMaterial({ color: 0x6f8fff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    this.materials.push(core, halo);
    this.group.add(new THREE.Mesh(mergeGeometries(parts)!, core), new THREE.Mesh(mergeGeometries(glowParts)!, halo));
    this.light = new THREE.PointLight(0xcfdcff, 0, 45, 1);
    this.light.position.copy(target).addScaledVector(n, 4);
    this.group.add(this.light);
    ctx.root.add(this.group);

    for (let i = 0; i < 40; i++) {
      const v = randomUnit().addScaledVector(n, 1.2).normalize().multiplyScalar(2 + Math.random() * 5);
      ctx.sparks.spawn({ x: target.x, y: target.y, z: target.z, vx: v.x, vy: v.y, vz: v.z, life: 0.4 + Math.random() * 0.5, size: 0.35, endSize: 0.05, color: YELLOW, endColor: ORANGE, gravity: 9, drag: 1.5 });
    }
  }

  private jagged(a: THREE.Vector3, b: THREE.Vector3, steps: number, spread: number, ta: THREE.Vector3, tb: THREE.Vector3): THREE.Vector3[] {
    const pts = [a.clone()];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const p = a.clone().lerp(b, t);
      const s = spread * (1 - t * 0.6);
      p.addScaledVector(ta, (Math.random() - 0.5) * 2 * s).addScaledVector(tb, (Math.random() - 0.5) * 2 * s);
      pts.push(p);
    }
    pts.push(b.clone());
    return pts;
  }

  update(dt: number): boolean {
    this.t += dt;
    const t = this.t;
    const on = t < 0.09 || (t > 0.13 && t < 0.42);
    const fade = t < 0.13 ? 1 : Math.max(0, 1 - (t - 0.13) / 0.32);
    this.materials[0].opacity = on ? fade : 0;
    this.materials[1].opacity = on ? 0.35 * fade : 0;
    this.light.intensity = on ? 90 * fade : 0;
    return t < 0.6;
  }

  dispose(): void {
    disposeTree(this.group);
  }
}

export class MeteorFx implements Effect {
  private readonly group = new THREE.Group();
  private readonly ball: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  private readonly start: THREE.Vector3;
  private readonly target: THREE.Vector3;
  private readonly n: THREE.Vector3;
  private t = 0;
  private impacted = false;
  private flash: THREE.Mesh | null = null;
  private ring: THREE.Mesh | null = null;
  private light: THREE.PointLight | null = null;
  private readonly duration = 2.8;

  /** `from`: the camera's up direction (it falls in from the top of the screen); `viewDistance`: camera distance. */
  constructor(private readonly ctx: FxContext, target: THREE.Vector3, from: THREE.Vector3, viewDistance: number, private readonly onImpact: () => void) {
    this.target = target.clone();
    this.n = target.clone().normalize();
    const side = from.clone().addScaledVector(this.n, -from.dot(this.n)).normalize();
    const d = Math.min(R * 1.2, viewDistance);
    // Start between the camera and the ground, near the top edge of the view.
    this.start = target.clone().addScaledVector(this.n, d * 0.6).addScaledVector(side, d * 0.14);
    this.ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 1),
      new THREE.MeshBasicMaterial({ color: 0xfff1c8, toneMapped: false, fog: false }),
    );
    this.glow = glowSprite(0xffb060, 9);
    this.group.add(this.ball, this.glow);
    this.group.position.copy(this.start);
    ctx.root.add(this.group);
  }

  update(dt: number): boolean {
    this.t += dt;
    const ctx = this.ctx;
    if (!this.impacted) {
      const k = Math.min(1, this.t / this.duration);
      const eased = k * k * (1.6 - 0.6 * k);
      this.group.position.lerpVectors(this.start, this.target, eased);
      const p = this.group.position;
      this.glow.scale.setScalar(7 + Math.sin(this.t * 30) * 0.8 + k * 6);
      // Burning trail.
      for (let i = 0; i < 4; i++) {
        const j = randomUnit().multiplyScalar(0.5);
        ctx.sparks.spawn({ x: p.x + j.x, y: p.y + j.y, z: p.z + j.z, vx: j.x, vy: j.y, vz: j.z, life: 0.5 + Math.random() * 0.4, size: 1.6, endSize: 0.2, color: YELLOW, endColor: RED, drag: 2 });
      }
      if (Math.random() < 0.6) {
        ctx.smoke.spawn({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, life: 2.5, size: 1.4, endSize: 4, color: SMOKE_GREY, endColor: SMOKE_DARK, alpha: 0.5, drag: 1 });
      }
      if (k >= 1) this.impact();
      return true;
    }
    const age = this.t - this.duration;
    if (this.flash) {
      const f = Math.min(1, age / 0.7);
      this.flash.scale.setScalar(1 + f * 16);
      (this.flash.material as THREE.MeshBasicMaterial).opacity = (1 - f) ** 1.5;
    }
    if (this.ring) {
      const f = Math.min(1, age / 3.2);
      const s = 1 + f * 34;
      this.ring.scale.set(s, s, s);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - f);
    }
    if (this.light) this.light.intensity = Math.max(0, 500 * (1 - age / 1.2));
    return age < 3.4;
  }

  private impact(): void {
    this.impacted = true;
    this.onImpact();
    const ctx = this.ctx;
    const p = this.target;
    const n = this.n;
    this.ball.visible = false;
    this.glow.visible = false;
    this.group.position.copy(p);

    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }),
    );
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1, 72).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd8a8, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, fog: false }),
    );
    this.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    this.ring.position.addScaledVector(n, 0.4);
    this.light = new THREE.PointLight(0xffc080, 500, 90, 1);
    this.light.position.addScaledVector(n, 6);
    this.group.add(this.flash, this.ring, this.light);

    const v = new THREE.Vector3();
    for (let i = 0; i < 260; i++) {
      randomUnit(v).addScaledVector(n, 1.1).normalize().multiplyScalar(4 + Math.random() * 14);
      ctx.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: 0.8 + Math.random() * 1.4, size: 0.9, endSize: 0.15, color: YELLOW, endColor: RED, gravity: 12, drag: 0.6 });
    }
    for (let i = 0; i < 90; i++) {
      randomUnit(v).addScaledVector(n, 0.8).normalize().multiplyScalar(2 + Math.random() * 7);
      ctx.smoke.spawn({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: 5 + Math.random() * 5, size: 2.5, endSize: 9, color: DUST, endColor: SMOKE_DARK, alpha: 0.8, gravity: -0.6, drag: 1.1 });
    }
    ctx.shake(1.6, 2.4);
  }

  dispose(): void {
    disposeTree(this.group);
  }
}

/** Short bursts made only of particles (eruption start, quake dust, splashes, sparkles). */
export type BurstKind = 'eruption' | 'dust' | 'splash' | 'sparkle' | 'chill' | 'heat' | 'gold' | 'heal' | 'plague' | 'spirit' | 'whisper';

export function burst(ctx: FxContext, kind: BurstKind, p: THREE.Vector3, scale = 1): void {
  const n = p.clone().normalize();
  const v = new THREE.Vector3();
  if (kind === 'eruption') {
    for (let i = 0; i < 280; i++) {
      randomUnit(v).multiplyScalar(0.35).add(n).normalize().multiplyScalar(8 + Math.random() * 12);
      ctx.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: 1.2 + Math.random() * 1.6, size: 0.8, endSize: 0.2, color: YELLOW, endColor: RED, gravity: 11, drag: 0.3 });
    }
    for (let i = 0; i < 70; i++) {
      randomUnit(v).multiplyScalar(0.4).add(n).normalize().multiplyScalar(3 + Math.random() * 4);
      ctx.smoke.spawn({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: 6 + Math.random() * 4, size: 2.5, endSize: 10, color: SMOKE_DARK, endColor: SMOKE_GREY, alpha: 0.9, gravity: -0.8, drag: 0.7 });
    }
    ctx.shake(0.9, 1.8);
  } else if (kind === 'dust') {
    for (let i = 0; i < 10 * scale; i++) {
      randomUnit(v).multiplyScalar(0.8).add(n).normalize().multiplyScalar(1 + Math.random() * 2.5);
      ctx.smoke.spawn({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: 2.5 + Math.random() * 2.5, size: 1.2, endSize: 4, color: DUST, endColor: SMOKE_GREY, alpha: 0.7, gravity: -0.2, drag: 1.4 });
    }
  } else if (kind === 'splash') {
    for (let i = 0; i < 180 * scale; i++) {
      randomUnit(v).multiplyScalar(0.6).add(n).normalize().multiplyScalar(4 + Math.random() * 8);
      ctx.smoke.spawn({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: 1.4 + Math.random() * 1.2, size: 0.8, endSize: 2.2, color: WHITE, endColor: new THREE.Color(0xbfd8e4), alpha: 0.9, gravity: 10, drag: 0.5 });
    }
  } else if (kind === 'plague') {
    for (let i = 0; i < 60 * scale; i++) {
      randomUnit(v).multiplyScalar(0.9).add(n).normalize().multiplyScalar(0.6 + Math.random() * 1.6);
      const j = randomUnit().multiplyScalar(Math.random() * 3 * scale);
      ctx.smoke.spawn({ x: p.x + j.x, y: p.y + j.y, z: p.z + j.z, vx: v.x, vy: v.y, vz: v.z, life: 4 + Math.random() * 4, size: 1.5, endSize: 5, color: new THREE.Color(0x9fb24a), endColor: new THREE.Color(0x4f5a2a), alpha: 0.55, gravity: -0.15, drag: 1.2 });
    }
  } else if (kind === 'whisper') {
    // A faint shimmer around the head: only the god sees it.
    for (let i = 0; i < 26 * scale; i++) {
      const [ta, tb] = tangents(n);
      const a = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 0.35;
      const q = p.clone().addScaledVector(n, 0.35 + Math.random() * 0.3).addScaledVector(ta, Math.cos(a) * r).addScaledVector(tb, Math.sin(a) * r);
      v.copy(ta).multiplyScalar(-Math.sin(a) * 0.6).addScaledVector(tb, Math.cos(a) * 0.6).addScaledVector(n, 0.25);
      ctx.sparks.spawn({ x: q.x, y: q.y, z: q.z, vx: v.x, vy: v.y, vz: v.z, life: 1 + Math.random() * 0.8, size: 0.09, endSize: 0.01, color: new THREE.Color(0xdde8ff), endColor: new THREE.Color(0x9fb4ff), drag: 1 });
    }
  } else if (kind === 'spirit') {
    // A column of light: revival, the invisible hand.
    for (let i = 0; i < 90 * scale; i++) {
      const j = randomUnit().multiplyScalar(0.25 * scale);
      v.copy(n).multiplyScalar(2 + Math.random() * 7);
      ctx.sparks.spawn({ x: p.x + j.x, y: p.y + j.y, z: p.z + j.z, vx: v.x, vy: v.y, vz: v.z, life: 1 + Math.random() * 1.5, size: 0.5, endSize: 0.05, color: WHITE, endColor: new THREE.Color(0xffe2a0), drag: 0.5 });
    }
  } else if (kind === 'sparkle' || kind === 'chill' || kind === 'heat' || kind === 'gold' || kind === 'heal') {
    const color =
      kind === 'sparkle'
        ? new THREE.Color(0x9cff7a)
        : kind === 'chill'
          ? new THREE.Color(0xbfe6ff)
          : kind === 'gold'
            ? new THREE.Color(0xffd36a)
            : kind === 'heal'
              ? new THREE.Color(0xf4fff0)
              : new THREE.Color(0xffc070);
    const start = color.clone().lerp(WHITE, kind === 'chill' || kind === 'heal' ? 0.6 : 0.3);
    for (let i = 0; i < 50 * scale; i++) {
      const [ta, tb] = tangents(n);
      const r = Math.random() * 4 * scale;
      const a = Math.random() * Math.PI * 2;
      const q = p.clone().addScaledVector(ta, Math.cos(a) * r).addScaledVector(tb, Math.sin(a) * r);
      v.copy(n).multiplyScalar(1 + Math.random() * 2.5);
      ctx.sparks.spawn({ x: q.x, y: q.y, z: q.z, vx: v.x, vy: v.y, vz: v.z, life: 1.2 + Math.random() * 1.3, size: 0.24 * Math.sqrt(scale), endSize: 0.04, color: start, endColor: color, drag: 0.8 });
    }
  }
}

// ------------------------------------------------------------------ ongoing views

export interface OngoingView {
  /** age: game minutes since the scar started; active: game minutes it lasts. */
  update(dt: number, age: number, time: number): void;
  dispose(): void;
}

function cloudCluster(radius: number, puffs: number, color: number, opacity: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < puffs; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const size = (0.9 + Math.random() * 1.2) * Math.max(1, radius * 0.18);
    m.compose(new THREE.Vector3(Math.cos(a) * r, Math.random() * 0.6, Math.sin(a) * r), q, new THREE.Vector3(size * 1.3, size * 0.5, size));
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.deleteAttribute('uv');
    g.applyMatrix4(m);
    parts.push(g);
  }
  const geo = mergeGeometries(parts)!;
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, transparent: true, opacity, depthWrite: false }));
}

function rainLines(radius: number, count: number, height: number): THREE.LineSegments {
  const pos = new Float32Array(count * 6);
  const seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    pos.set([x, 0, z, x, 0.55, z], i * 6);
    const s = Math.random();
    seed[i * 2] = s;
    seed[i * 2 + 1] = s;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHeight: { value: height }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uHeight;
      void main() {
        vec3 p = position;
        p.y += uHeight - mod(uTime * 9.0 + aSeed * uHeight * 3.0, uHeight);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      void main() { gl_FragColor = vec4(0.78, 0.84, 0.92, uOpacity); }
    `,
    transparent: true,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return lines;
}

export class RainView implements OngoingView {
  private readonly group = new THREE.Group();
  private readonly cloud: THREE.Mesh;
  private readonly rain: THREE.LineSegments;

  constructor(ctx: FxContext, center: THREE.Vector3, radiusUnits: number, private readonly active: number) {
    const n = center.clone().normalize();
    this.group.position.copy(n).multiplyScalar(R + 0.1);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    this.cloud = cloudCluster(radiusUnits * 0.75, 16, 0x6b7380, 0);
    this.cloud.position.y = 5.2;
    this.rain = rainLines(radiusUnits * 0.7, 900, 5);
    this.group.add(this.cloud, this.rain);
    ctx.root.add(this.group);
  }

  update(_dt: number, age: number, time: number): void {
    const fade = Math.min(1, age / 90) * (1 - Math.max(0, (age - (this.active - 180)) / 180));
    (this.cloud.material as THREE.MeshStandardMaterial).opacity = 0.88 * fade;
    const mat = this.rain.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = time;
    mat.uniforms.uOpacity.value = 0.55 * fade;
  }

  dispose(): void {
    disposeTree(this.group);
  }
}

export class StormView implements OngoingView {
  private readonly group = new THREE.Group();
  private readonly spiral: THREE.Mesh;
  private readonly rain: THREE.LineSegments;
  private readonly pos = new THREE.Vector3();

  constructor(
    private readonly ctx: FxContext,
    private readonly path: number[],
    radiusUnits: number,
    private readonly speedKmPerMin: number,
    private readonly duration: number,
  ) {
    const parts: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let arm = 0; arm < 3; arm++) {
      for (let i = 0; i < 34; i++) {
        const t = i / 34;
        const r = radiusUnits * (0.12 + 0.88 * t);
        const a = (arm / 3) * Math.PI * 2 + t * 4.2;
        const size = 0.6 + (1 - t) * 1.1 + Math.random() * 0.5;
        m.compose(new THREE.Vector3(Math.cos(a) * r, Math.random() * 0.5, Math.sin(a) * r), q, new THREE.Vector3(size * 1.4, size * 0.5, size));
        const g = new THREE.IcosahedronGeometry(1, 1);
        g.deleteAttribute('uv');
        g.applyMatrix4(m);
        parts.push(g);
      }
    }
    const geo = mergeGeometries(parts)!;
    geo.computeVertexNormals();
    this.spiral = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc9ced6, flatShading: true, roughness: 1, transparent: true, opacity: 0, depthWrite: false }));
    this.spiral.position.y = 5;
    this.rain = rainLines(radiusUnits * 0.8, 1200, 5);
    this.group.add(this.spiral, this.rain);
    ctx.root.add(this.group);
  }

  update(dt: number, age: number, time: number): void {
    const along = (age * this.speedKmPerMin) / 40;
    const i = Math.min(this.path.length - 1, Math.floor(along));
    const j = Math.min(this.path.length - 1, i + 1);
    const f = along - Math.floor(along);
    const a = this.ctx.surfacePoint(this.path[i]);
    const b = this.ctx.surfacePoint(this.path[j]);
    this.pos.copy(a).lerp(b, Math.min(1, f)).normalize();
    this.group.position.copy(this.pos).multiplyScalar(R + 0.1);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.pos);
    this.spiral.rotation.y -= dt * 0.8;
    const fade = Math.min(1, age / 120) * (1 - Math.max(0, (age - this.duration) / 300));
    (this.spiral.material as THREE.MeshStandardMaterial).opacity = 0.9 * fade;
    const mat = this.rain.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = time;
    mat.uniforms.uOpacity.value = 0.5 * fade;
  }

  dispose(): void {
    disposeTree(this.group);
  }
}

export class WaveView implements OngoingView {
  private readonly mesh: THREE.Mesh;
  private readonly segments = 96;
  private readonly center: THREE.Vector3;
  private readonly ta: THREE.Vector3;
  private readonly tb: THREE.Vector3;

  constructor(
    ctx: FxContext,
    center: THREE.Vector3,
    private readonly radiusKm: number,
    private readonly speedKmPerMin: number,
    private readonly planetRadiusKm: number,
  ) {
    this.center = center.clone().normalize();
    [this.ta, this.tb] = tangents(this.center);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.segments + 1) * 2 * 3), 3));
    const index: number[] = [];
    for (let i = 0; i < this.segments; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    ctx.root.add(this.mesh);
  }

  update(_dt: number, age: number): void {
    const front = Math.min(this.radiusKm, age * this.speedKmPerMin);
    const outer = front / this.planetRadiusKm;
    const inner = Math.max(0, (front - Math.min(55, front * 0.3)) / this.planetRadiusKm);
    const pos = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    for (let i = 0; i <= this.segments; i++) {
      const phi = (i / this.segments) * Math.PI * 2;
      for (let k = 0; k < 2; k++) {
        const th = k === 0 ? inner : outer;
        p.copy(this.center)
          .multiplyScalar(Math.cos(th))
          .addScaledVector(this.ta, Math.sin(th) * Math.cos(phi))
          .addScaledVector(this.tb, Math.sin(th) * Math.sin(phi))
          .multiplyScalar(R + 0.1 + (k === 1 ? 0.14 : 0));
        pos.setXYZ(i * 2 + k, p.x, p.y, p.z);
      }
    }
    pos.needsUpdate = true;
    const progress = front / this.radiusKm;
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * Math.min(1, age / 3) * (1 - progress ** 3);
  }

  dispose(): void {
    disposeTree(this.mesh);
  }
}

export class EruptionView implements OngoingView {
  private readonly light: THREE.PointLight;
  private readonly summit: THREE.Vector3;
  private readonly n: THREE.Vector3;
  private carry = 0;

  constructor(private readonly ctx: FxContext, summit: THREE.Vector3, private readonly active: number) {
    this.summit = summit.clone();
    this.n = summit.clone().normalize();
    this.light = new THREE.PointLight(0xff6a20, 0, 30, 1);
    this.light.position.copy(summit).addScaledVector(this.n, 2);
    ctx.root.add(this.light);
  }

  update(dt: number, age: number, time: number): void {
    const strength = Math.max(0, 1 - age / this.active);
    this.light.intensity = 40 * strength * (0.75 + 0.25 * Math.sin(time * 9));
    this.carry += dt * 26 * strength;
    const v = new THREE.Vector3();
    const p = this.summit;
    while (this.carry >= 1) {
      this.carry -= 1;
      randomUnit(v).multiplyScalar(0.25).add(this.n).normalize().multiplyScalar(2.5 + Math.random() * 2);
      this.ctx.smoke.spawn({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: 7 + Math.random() * 4, size: 2, endSize: 8, color: SMOKE_DARK, endColor: SMOKE_GREY, alpha: 0.85, gravity: -0.5, drag: 0.5 });
      if (Math.random() < 0.7) {
        randomUnit(v).multiplyScalar(0.3).add(this.n).normalize().multiplyScalar(5 + Math.random() * 6);
        this.ctx.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: 1 + Math.random(), size: 0.6, endSize: 0.15, color: YELLOW, endColor: RED, gravity: 10, drag: 0.3 });
      }
    }
  }

  dispose(): void {
    this.light.removeFromParent();
    this.light.dispose();
  }
}

// ------------------------------------------------------------------ fire and flood, from the overlay

export class FireView {
  private readonly capacity = 2500;
  private base: THREE.Vector3[] = [];
  private flameCarry = 0;
  private smokeCarry = 0;

  constructor(private readonly ctx: FxContext) {}

  setBurning(cells: number[]): void {
    const pick = cells.length > this.capacity ? cells.filter((_, i) => i % Math.ceil(cells.length / this.capacity) === 0) : cells;
    this.base = pick.map((c) => this.ctx.surfacePoint(c).clone());
  }

  /** Flames are short-lived rising sparks; they keep flickering while the game is paused. */
  update(dt: number): void {
    if (this.base.length === 0) return;
    const n = new THREE.Vector3();
    const [ta, tb] = tangents(this.base[0].clone().normalize());
    this.flameCarry += dt * Math.min(420, 30 + this.base.length * 7);
    while (this.flameCarry >= 1) {
      this.flameCarry -= 1;
      const p = this.base[Math.floor(Math.random() * this.base.length)];
      n.copy(p).normalize();
      const jx = (Math.random() - 0.5) * 1.1;
      const jy = (Math.random() - 0.5) * 1.1;
      const up = 1.4 + Math.random() * 1.6;
      this.ctx.sparks.spawn({
        x: p.x + ta.x * jx + tb.x * jy + n.x * 0.1,
        y: p.y + ta.y * jx + tb.y * jy + n.y * 0.1,
        z: p.z + ta.z * jx + tb.z * jy + n.z * 0.1,
        vx: n.x * up,
        vy: n.y * up,
        vz: n.z * up,
        life: 0.45 + Math.random() * 0.5,
        size: 0.9 + Math.random() * 0.8,
        endSize: 0.15,
        color: YELLOW,
        endColor: RED,
        alpha: 0.9,
        drag: 1.2,
      });
    }
    this.smokeCarry += dt * Math.min(40, this.base.length * 0.6);
    while (this.smokeCarry >= 1) {
      this.smokeCarry -= 1;
      const p = this.base[Math.floor(Math.random() * this.base.length)];
      n.copy(p).normalize();
      this.ctx.smoke.spawn({ x: p.x + n.x, y: p.y + n.y, z: p.z + n.z, vx: n.x * 1.5, vy: n.y * 1.5, vz: n.z * 1.5, life: 4 + Math.random() * 3, size: 1, endSize: 4.5, color: SMOKE_GREY, endColor: SMOKE_DARK, alpha: 0.55, gravity: -0.3, drag: 0.6 });
    }
  }

  dispose(): void {
    this.base = [];
  }
}

export class FloodView {
  readonly mesh: THREE.Mesh;
  private readonly capacity = 12000;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;

  constructor(root: THREE.Group) {
    this.pos = new Float32Array(this.capacity * 9);
    this.col = new Float32Array(this.capacity * 12);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.25, flatShading: true, depthWrite: false }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    root.add(this.mesh);
  }

  /** faces: flooded faces with their water level (0 … 1). */
  update(facePositions: Float32Array, faces: number[], level: (face: number) => number): void {
    const count = Math.min(this.capacity, faces.length);
    const p = new THREE.Vector3();
    const color = new THREE.Color(0x3a7f9c);
    for (let i = 0; i < count; i++) {
      const f = faces[i];
      const w = level(f);
      for (let k = 0; k < 3; k++) {
        p.fromArray(facePositions, f * 9 + k * 3);
        const len = p.length();
        p.multiplyScalar((len + 0.05 + w * 0.3) / len);
        this.pos.set([p.x, p.y, p.z], i * 9 + k * 3);
        this.col.set([color.r, color.g, color.b, 0.35 + w * 0.5], i * 12 + k * 4);
      }
    }
    const geo = this.mesh.geometry;
    geo.setDrawRange(0, count * 3);
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    geo.computeVertexNormals();
  }

  dispose(): void {
    disposeTree(this.mesh);
  }
}
