/** Stars, the sun disc and a small moon. */
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { R } from './scale';

export const SKY_RADIUS = 2400;
const SUN_DISTANCE = 1900;
const MOON_DISTANCE = R * 7;
/** Days for one moon orbit. */
const MOON_PERIOD_DAYS = 8;

export interface Sky {
  /** Rotates with the planet's day, so stars move together with the sun. */
  stars: THREE.Points;
  sun: THREE.Sprite;
  moon: THREE.Mesh;
  update(sunDir: THREE.Vector3, starAngle: number, dayCount: number): void;
}

function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,250,1)');
  g.addColorStop(0.12, 'rgba(255,246,220,1)');
  g.addColorStop(0.3, 'rgba(255,214,150,0.35)');
  g.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildSky(seed: number): Sky {
  const rng = new Rng(seed).fork('sky');
  const count = 3200;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  // A tilted band (a galaxy seen edge-on) holds about 40 % of the stars.
  const bandNormal = new THREE.Vector3(rng.range(-1, 1), 1, rng.range(-1, 1)).normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
    if (v.lengthSq() < 1e-4) v.set(1, 0, 0);
    v.normalize();
    if (i < count * 0.4) {
      v.addScaledVector(bandNormal, -v.dot(bandNormal) * rng.range(0.85, 1)).normalize();
    }
    pos[i * 3] = v.x * SKY_RADIUS;
    pos[i * 3 + 1] = v.y * SKY_RADIUS;
    pos[i * 3 + 2] = v.z * SKY_RADIUS;
    const warmth = rng.next();
    c.setHSL(warmth < 0.2 ? 0.08 : warmth > 0.85 ? 0.6 : 0.12, warmth < 0.2 || warmth > 0.85 ? 0.5 : 0.1, rng.range(0.55, 0.95));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false, transparent: true, fog: false }),
  );
  stars.name = 'stars';
  stars.frustumCulled = false;

  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      fog: false,
    }),
  );
  sun.scale.setScalar(260);
  sun.name = 'sun';

  const moonGeo = new THREE.IcosahedronGeometry(R * 0.09, 2);
  const mp = moonGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < mp.count; i++) {
    v.fromBufferAttribute(mp, i);
    const bump = 1 + (Math.sin(v.x * 1.7) * Math.cos(v.y * 2.3) + Math.sin(v.z * 3.1)) * 0.03;
    mp.setXYZ(i, v.x * bump, v.y * bump, v.z * bump);
  }
  moonGeo.computeVertexNormals();
  const moon = new THREE.Mesh(
    moonGeo,
    new THREE.MeshStandardMaterial({ color: 0xb9b5ad, roughness: 1, flatShading: true, fog: false }),
  );
  moon.name = 'moon';
  const moonTilt = (5 * Math.PI) / 180;
  const moonPhase = rng.range(0, Math.PI * 2);

  return {
    stars,
    sun,
    moon,
    update(sunDir, starAngle, dayCount) {
      sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
      stars.rotation.y = starAngle;
      const a = moonPhase + (dayCount / MOON_PERIOD_DAYS) * Math.PI * 2;
      moon.position.set(Math.cos(a) * MOON_DISTANCE, Math.sin(a) * Math.sin(moonTilt) * MOON_DISTANCE, -Math.sin(a) * MOON_DISTANCE);
    },
  };
}
