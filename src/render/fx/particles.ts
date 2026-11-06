/**
 * A simple CPU particle system drawn as round point sprites.
 * Gravity pulls toward the planet's center (it is a planet, after all).
 */
import * as THREE from 'three';

export interface ParticleSpawn {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds. */
  life: number;
  size: number;
  /** Size at the end of life. */
  endSize?: number;
  color: THREE.Color;
  endColor?: THREE.Color;
  alpha?: number;
  /** Units/s² toward the planet center (negative = rises). */
  gravity?: number;
  /** Velocity damping per second (0 = none). */
  drag?: number;
}

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly capacity: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size0: Float32Array;
  private readonly size1: Float32Array;
  private readonly c0: Float32Array;
  private readonly c1: Float32Array;
  private readonly alpha0: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private cursor = 0;
  private alive = 0;

  constructor(capacity: number, additive: boolean) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 4);
    this.size = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.c0 = new Float32Array(capacity * 3);
    this.c1 = new Float32Array(capacity * 3);
    this.alpha0 = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute vec4 aColor;
        attribute float aSize;
        uniform float uScale;
        varying vec4 vColor;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d) * 4.0;
          if (r > 1.0) discard;
          float a = vColor.a * (1.0 - r) * (1.0 - r);
          gl_FragColor = vec4(vColor.rgb, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }

  /** Point size scale: depends on the screen height. */
  setViewportHeight(px: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = px * 1.2;
  }

  spawn(s: ParticleSpawn): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    if (this.life[i] <= 0) this.alive++;
    this.pos[i * 3] = s.x;
    this.pos[i * 3 + 1] = s.y;
    this.pos[i * 3 + 2] = s.z;
    this.vel[i * 3] = s.vx;
    this.vel[i * 3 + 1] = s.vy;
    this.vel[i * 3 + 2] = s.vz;
    this.life[i] = s.life;
    this.maxLife[i] = s.life;
    this.size0[i] = s.size;
    this.size1[i] = s.endSize ?? s.size;
    const end = s.endColor ?? s.color;
    this.c0[i * 3] = s.color.r;
    this.c0[i * 3 + 1] = s.color.g;
    this.c0[i * 3 + 2] = s.color.b;
    this.c1[i * 3] = end.r;
    this.c1[i * 3 + 1] = end.g;
    this.c1[i * 3 + 2] = end.b;
    this.alpha0[i] = s.alpha ?? 1;
    this.gravity[i] = s.gravity ?? 0;
    this.drag[i] = s.drag ?? 0;
  }

  get active(): number {
    return this.alive;
  }

  clear(): void {
    this.life.fill(0);
    this.size.fill(0);
    this.alive = 0;
    (this.points.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number): void {
    if (this.alive === 0) return;
    let alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        this.col[i * 4 + 3] = 0;
        continue;
      }
      alive++;
      const o = i * 3;
      const x = this.pos[o];
      const y = this.pos[o + 1];
      const z = this.pos[o + 2];
      const g = this.gravity[i];
      if (g !== 0) {
        const len = Math.hypot(x, y, z) || 1;
        this.vel[o] -= (x / len) * g * dt;
        this.vel[o + 1] -= (y / len) * g * dt;
        this.vel[o + 2] -= (z / len) * g * dt;
      }
      const damp = Math.exp(-this.drag[i] * dt);
      this.vel[o] *= damp;
      this.vel[o + 1] *= damp;
      this.vel[o + 2] *= damp;
      this.pos[o] = x + this.vel[o] * dt;
      this.pos[o + 1] = y + this.vel[o + 1] * dt;
      this.pos[o + 2] = z + this.vel[o + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      this.col[i * 4] = this.c0[o] + (this.c1[o] - this.c0[o]) * t;
      this.col[i * 4 + 1] = this.c0[o + 1] + (this.c1[o + 1] - this.c0[o + 1]) * t;
      this.col[i * 4 + 2] = this.c0[o + 2] + (this.c1[o + 2] - this.c0[o + 2]) * t;
      // Fade in quickly, fade out slowly.
      this.col[i * 4 + 3] = this.alpha0[i] * Math.min(1, t * 8) * (1 - t * t);
    }
    this.alive = alive;
    const g = this.points.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
