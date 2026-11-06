/**
 * Signs in the sky, only to marvel at: a rainbow, a column of light, a comet.
 */
import * as THREE from 'three';
import { glowTexture, type Effect, type FxContext } from './effects';

let beamTex: THREE.Texture | null = null;

/** Opaque at the bottom, fading to nothing at the top (used as an alpha map). */
function beamTexture(): THREE.Texture {
  if (beamTex) return beamTex;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgb(255,255,255)');
  g.addColorStop(0.4, 'rgb(110,110,110)');
  g.addColorStop(1, 'rgb(0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  beamTex = new THREE.CanvasTexture(canvas);
  beamTex.colorSpace = THREE.SRGBColorSpace;
  return beamTex;
}

const RAINBOW = [0xe0503c, 0xf0903a, 0xf2d24a, 0x6cc25a, 0x4a9ad8, 0x5a5cc0, 0x8a5ab8];

export class SkySignFx implements Effect {
  private readonly group = new THREE.Group();
  private readonly materials: (THREE.Material & { opacity: number })[] = [];
  private readonly base: number[] = [];
  private t = 0;
  private readonly duration: number;
  private readonly fadeIn: number;
  private readonly fadeOut: number;
  private comet: { head: THREE.Sprite; tail: THREE.Sprite[]; from: THREE.Vector3; to: THREE.Vector3 } | null = null;

  constructor(
    private readonly ctx: FxContext,
    at: THREE.Vector3,
    variant: number,
    camera: THREE.Camera,
  ) {
    const up = at.clone().normalize();
    // Horizontal directions as seen from the camera.
    const toCam = camera.position.clone().sub(at);
    toCam.addScaledVector(up, -toCam.dot(up));
    if (toCam.lengthSq() < 1e-6) toCam.set(up.z, 0, -up.x);
    toCam.normalize();
    const right = new THREE.Vector3().crossVectors(up, toCam).normalize();
    const camDist = camera.position.distanceTo(at);
    const size = THREE.MathUtils.clamp(camDist * 0.45, 3, 40);

    if (variant === 0) {
      this.duration = 14;
      this.fadeIn = 2.5;
      this.fadeOut = 4;
      this.rainbow(at, up, right, toCam, size);
    } else if (variant === 1) {
      this.duration = 9;
      this.fadeIn = 0.6;
      this.fadeOut = 3;
      this.column(at, up, size);
    } else {
      this.duration = 15;
      this.fadeIn = 1.5;
      this.fadeOut = 3;
      this.makeComet(camera, size);
    }
    ctx.root.add(this.group);
  }

  private track<M extends THREE.Material & { opacity: number }>(m: M, opacity: number): M {
    this.materials.push(m);
    this.base.push(opacity);
    m.opacity = 0;
    return m;
  }

  private rainbow(at: THREE.Vector3, up: THREE.Vector3, right: THREE.Vector3, toCam: THREE.Vector3, size: number): void {
    const radius = size;
    const band = radius * 0.035;
    const arc = new THREE.Group();
    RAINBOW.forEach((color, i) => {
      const g = new THREE.TorusGeometry(radius - i * band, band * 0.55, 4, 72, Math.PI);
      const m = this.track(new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }), 0.32);
      arc.add(new THREE.Mesh(g, m));
    });
    // Torus lies in its local XY plane: x → right, y → up, z → toward the camera.
    const basis = new THREE.Matrix4().makeBasis(right, up, toCam);
    arc.quaternion.setFromRotationMatrix(basis);
    // A little behind the place, so it stands over the land.
    arc.position.copy(at).addScaledVector(toCam, -radius * 0.35).addScaledVector(up, -radius * 0.05);
    this.group.add(arc);
  }

  private column(at: THREE.Vector3, up: THREE.Vector3, size: number): void {
    const h = size * 2.4;
    const g = new THREE.CylinderGeometry(size * 0.022, size * 0.04, h, 24, 1, true);
    g.translate(0, h / 2, 0);
    const m = this.track(
      new THREE.MeshBasicMaterial({ color: 0xfff1cc, alphaMap: beamTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }),
      0.7,
    );
    const mesh = new THREE.Mesh(g, m);
    mesh.position.copy(at);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    this.group.add(mesh);
    const glow = new THREE.Sprite(
      this.track(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe2a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 0.6),
    );
    glow.position.copy(at).addScaledVector(up, size * 0.05);
    glow.scale.setScalar(size * 0.35);
    this.group.add(glow);
  }

  /** The comet crosses the upper part of the view, in front of everything. */
  private makeComet(camera: THREE.Camera, size: number): void {
    const cam = camera.position.clone();
    const d = size * 1.4;
    // Through the upper part of the screen, from left to right.
    const onScreen = (x: number, y: number) => new THREE.Vector3(x, y, 0.5).unproject(camera).sub(cam).normalize().multiplyScalar(d).add(cam);
    const from = onScreen(-1.15, 0.42);
    const to = onScreen(1.15, 0.22);
    const sprite = (color: number, opacity: number, scale: number) => {
      const s = new THREE.Sprite(
        this.track(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }), opacity),
      );
      s.scale.setScalar(scale);
      s.renderOrder = 20;
      this.group.add(s);
      return s;
    };
    const head = sprite(0xffffff, 1, d * 0.1);
    const tail: THREE.Sprite[] = [];
    for (let i = 1; i <= 18; i++) {
      const k = i / 18;
      tail.push(sprite(0xc8dcff, 0.75 * (1 - k), d * (0.085 - 0.05 * k)));
    }
    this.comet = { head, tail, from, to };
  }

  update(dt: number): boolean {
    this.t += dt;
    const t = this.t;
    const fade = Math.min(1, t / this.fadeIn) * Math.min(1, Math.max(0, (this.duration - t) / this.fadeOut));
    this.materials.forEach((m, i) => (m.opacity = this.base[i] * fade));
    if (this.comet) {
      const { head, tail, from, to } = this.comet;
      const k = Math.min(1, t / this.duration);
      head.position.lerpVectors(from, to, k);
      const dir = to.clone().sub(from).normalize();
      const spacing = from.distanceTo(to) * 0.016;
      tail.forEach((s, i) => s.position.copy(head.position).addScaledVector(dir, -(i + 1) * spacing));
    }
    return t < this.duration;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.group.removeFromParent();
    void this.ctx;
  }
}
