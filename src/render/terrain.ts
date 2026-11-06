/**
 * The planet's ground: one flat-shaded triangle per grid face, colored by
 * biome. Snow comes and goes with the seasons in the shader.
 *
 * The ground can change: heights (craters, volcanoes, lifted land) are
 * rewritten for the affected faces only, and effects like burnt land, lava,
 * ash or floods tint the faces from the world's overlay. Glowing lava and
 * fire use a per-vertex glow value in the shader.
 */
import * as THREE from 'three';
import type { World, Overlay } from '../sim/world';
import { plantedBiome } from '../sim/world';
import { BIOME_COLORS, Biome, classifyBiome, isWater } from '../sim/planet/biomes';
import { radiusForHeight, type SeasonUniforms } from './scale';

function faceHash(i: number): number {
  let h = Math.imul(i ^ 0x5bd1e995, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const PALETTE = BIOME_COLORS.map((hex) => new THREE.Color(hex)); // linear
const TINT_DRY = new THREE.Color(0xa08048);
const TINT_GREEN = new THREE.Color(0x4f9a3a);
const TINT_WET = new THREE.Color(0x2c3a33);
const TINT_ASH = new THREE.Color(0x7a7874);
const TINT_CHAR = new THREE.Color(0x1a1512);
const TINT_LAVA_ROCK = new THREE.Color(0x2b2522);
const TINT_CLEARED = new THREE.Color(0x8a9a52);
const LAKE = new THREE.Color(0x3a7fac);

const FOREST_BIOMES = new Set<number>([Biome.TemperateForest, Biome.Rainforest, Biome.Taiga]);

export class TerrainView {
  readonly mesh: THREE.Mesh;
  /** Biome of every face (used for tree placement). */
  readonly faceBiome: Uint8Array;
  /** Scene-space vertex positions of every face (non-indexed, 9 floats per face). */
  readonly facePositions: Float32Array;
  readonly faceCount: number;
  /** Faces around every cell (CSR). */
  readonly cellFaceOffsets: Uint32Array;
  readonly cellFaces: Uint32Array;

  private readonly world: World;
  private readonly geometry: THREE.BufferGeometry;
  private readonly baseColor: Float32Array;
  private readonly col: Float32Array;
  private readonly nor: Float32Array;
  private readonly climate: Float32Array;
  private readonly glow: Float32Array;
  private readonly tmp = new THREE.Color();
  private readonly mark: Uint32Array;
  private stamp = 1;

  constructor(world: World, season: SeasonUniforms) {
    this.world = world;
    const { faces, cellCount } = world.planet;
    const faceCount = faces.length / 3;
    this.faceCount = faceCount;
    this.facePositions = new Float32Array(faceCount * 9);
    this.col = new Float32Array(faceCount * 9);
    this.nor = new Float32Array(faceCount * 9);
    this.climate = new Float32Array(faceCount * 12);
    this.glow = new Float32Array(faceCount * 3);
    this.baseColor = new Float32Array(faceCount * 3);
    this.faceBiome = new Uint8Array(faceCount);
    this.mark = new Uint32Array(faceCount);

    // Cell → faces lookup.
    const counts = new Uint32Array(cellCount + 1);
    for (let i = 0; i < faces.length; i++) counts[faces[i] + 1]++;
    for (let i = 0; i < cellCount; i++) counts[i + 1] += counts[i];
    this.cellFaceOffsets = counts.slice();
    this.cellFaces = new Uint32Array(faces.length);
    const cursor = counts.slice();
    for (let f = 0; f < faceCount; f++) {
      for (let k = 0; k < 3; k++) this.cellFaces[cursor[faces[f * 3 + k]]++] = f;
    }

    for (let f = 0; f < faceCount; f++) this.writeFace(f, null);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.facePositions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geometry.setAttribute('aClimate', new THREE.BufferAttribute(this.climate, 4));
    geometry.setAttribute('aGlow', new THREE.BufferAttribute(this.glow, 1));
    geometry.computeBoundingSphere();
    this.geometry = geometry;

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.94, metalness: 0 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSeason = season.uSeason;
      shader.uniforms.uGlobalTemp = season.uGlobalTemp;
      shader.uniforms.uTime = season.uTime;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec4 aClimate;
          attribute float aGlow;
          varying vec4 vClimate;
          varying float vGlow;
          varying float vSinLat;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vClimate = aClimate;
          vGlow = aGlow;
          vSinLat = position.y / length(position);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uSeason;
          uniform float uGlobalTemp;
          uniform float uTime;
          varying vec4 vClimate;
          varying float vGlow;
          varying float vSinLat;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            float hemi = clamp(vSinLat * 8.0, -1.0, 1.0);
            float tNow = vClimate.x + vClimate.y * hemi * uSeason + uGlobalTemp + (vClimate.w - 0.5) * 3.0;
            float snow = smoothstep(0.5, -2.5, tNow) * vClimate.z * (1.0 - clamp(vGlow * 3.0, 0.0, 1.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.92), snow);
          }`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            float flicker = 0.82 + 0.18 * sin(uTime * 7.0 + vClimate.w * 40.0) * sin(uTime * 3.1 + vClimate.w * 17.0);
            totalEmissiveRadiance += vec3(1.0, 0.27, 0.035) * vGlow * vGlow * 1.7 * flicker;
          }`,
        );
    };

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'terrain';
  }

  dispose(): void {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  /** Rewrites every face (after loading or rewinding). */
  refreshAll(overlay: Overlay | null): void {
    for (let f = 0; f < this.faceCount; f++) this.writeFace(f, overlay);
    this.flagAll();
  }

  /** Rewrites the faces around changed cells (heights, biomes, forests). */
  refreshCells(cells: Iterable<number>, overlay: Overlay | null): void {
    const faces = this.facesOf(cells);
    for (const f of faces) this.writeFace(f, overlay);
    if (faces.length > 0) this.flagAll();
  }

  /** Repaints the faces whose overlay (fire, lava, ash …) changed. */
  applyOverlay(overlay: Overlay): void {
    const faces = this.facesOf(overlay.changed);
    for (const f of faces) this.paintFace(f, overlay);
    if (faces.length > 0) {
      (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
      (this.geometry.getAttribute('aGlow') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  /**
   * Exact point on the ground in a direction (the triangle around `cell` hit by a ray
   * from the planet's center). Falls back to the cell's own height.
   */
  groundAt(dir: THREE.Vector3, cell: number, out: THREE.Vector3): THREE.Vector3 {
    const pos = this.facePositions;
    for (let k = this.cellFaceOffsets[cell]; k < this.cellFaceOffsets[cell + 1]; k++) {
      const o = this.cellFaces[k] * 9;
      // Möller–Trumbore from the origin along dir.
      const e1x = pos[o + 3] - pos[o];
      const e1y = pos[o + 4] - pos[o + 1];
      const e1z = pos[o + 5] - pos[o + 2];
      const e2x = pos[o + 6] - pos[o];
      const e2y = pos[o + 7] - pos[o + 1];
      const e2z = pos[o + 8] - pos[o + 2];
      const px = dir.y * e2z - dir.z * e2y;
      const py = dir.z * e2x - dir.x * e2z;
      const pz = dir.x * e2y - dir.y * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-9) continue;
      const inv = 1 / det;
      const tx = -pos[o];
      const ty = -pos[o + 1];
      const tz = -pos[o + 2];
      const u = (tx * px + ty * py + tz * pz) * inv;
      if (u < -1e-4 || u > 1.0001) continue;
      const qx = ty * e1z - tz * e1y;
      const qy = tz * e1x - tx * e1z;
      const qz = tx * e1y - ty * e1x;
      const v = (dir.x * qx + dir.y * qy + dir.z * qz) * inv;
      if (v < -1e-4 || u + v > 1.0001) continue;
      const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (dist > 0) return out.copy(dir).multiplyScalar(dist);
    }
    return out.copy(dir).multiplyScalar(radiusForHeight(this.world.planet.heightM[cell]));
  }

  facesOf(cells: Iterable<number>): number[] {
    this.stamp++;
    const out: number[] = [];
    for (const c of cells) {
      for (let k = this.cellFaceOffsets[c]; k < this.cellFaceOffsets[c + 1]; k++) {
        const f = this.cellFaces[k];
        if (this.mark[f] !== this.stamp) {
          this.mark[f] = this.stamp;
          out.push(f);
        }
      }
    }
    return out;
  }

  private flagAll(): void {
    for (const name of ['position', 'normal', 'color', 'aClimate', 'aGlow']) {
      (this.geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    }
    this.geometry.computeBoundingSphere();
  }

  /** Geometry, biome and base color of one face. */
  private writeFace(f: number, overlay: Overlay | null): void {
    const p = this.world.planet;
    const { faces, positions, heightM, temperature, seasonAmplitude, moisture, coastDistance } = p;
    const cells = [faces[f * 3], faces[f * 3 + 1], faces[f * 3 + 2]];

    // A face counts as land if any corner is land and it is not mostly deep.
    let landCorners = 0;
    let hSum = 0;
    let planted = 0;
    for (const cell of cells) {
      if (heightM[cell] >= 0) landCorners++;
      hSum += heightM[cell];
      planted += this.world.planted[cell];
    }
    let biome: number;
    let meanT = 0;
    let amp = 0;
    if (landCorners > 0 && hSum / 3 > -150) {
      let h = 0;
      let m = 0;
      let nearOcean = false;
      for (const cell of cells) {
        if (heightM[cell] < 0) continue;
        h += heightM[cell];
        meanT += temperature[cell];
        amp += seasonAmplitude[cell];
        m += moisture[cell];
        if (coastDistance[cell] === 0) nearOcean = true;
      }
      h /= landCorners;
      meanT /= landCorners;
      amp /= landCorners;
      m /= landCorners;
      biome = classifyBiome({ heightM: h, temperature: meanT, moisture: m, nearOcean: nearOcean && landCorners < 3 });
      if (planted >= 2 && !isWater(biome) && biome !== Biome.Ice && biome !== Biome.Mountains) biome = plantedBiome(meanT);
    } else {
      biome = classifyBiome({ heightM: hSum / 3, temperature: 0, moisture: 0, nearOcean: false });
      for (const cell of cells) {
        meanT += temperature[cell] / 3;
        amp += seasonAmplitude[cell] / 3;
      }
    }
    this.faceBiome[f] = biome;

    // Slight per-face brightness variation gives the low-poly ground texture.
    const jitter = faceHash(f);
    this.tmp.copy(PALETTE[biome]).multiplyScalar(0.965 + jitter * 0.07);
    this.baseColor[f * 3] = this.tmp.r;
    this.baseColor[f * 3 + 1] = this.tmp.g;
    this.baseColor[f * 3 + 2] = this.tmp.b;
    const isLandFace = landCorners > 0 && biome > Biome.ShallowSea ? 1 : 0;

    const pos = this.facePositions;
    for (let k = 0; k < 3; k++) {
      const cell = cells[k];
      const r = radiusForHeight(heightM[cell]);
      const o = f * 9 + k * 3;
      pos[o] = positions[cell * 3] * r;
      pos[o + 1] = positions[cell * 3 + 1] * r;
      pos[o + 2] = positions[cell * 3 + 2] * r;
      const q = f * 12 + k * 4;
      this.climate[q] = meanT;
      this.climate[q + 1] = amp;
      this.climate[q + 2] = isLandFace;
      this.climate[q + 3] = jitter;
    }
    // Face normal (flat shading also derives it in the shader; this keeps lighting stable).
    const o = f * 9;
    const ux = pos[o + 3] - pos[o];
    const uy = pos[o + 4] - pos[o + 1];
    const uz = pos[o + 5] - pos[o + 2];
    const vx = pos[o + 6] - pos[o];
    const vy = pos[o + 7] - pos[o + 1];
    const vz = pos[o + 8] - pos[o + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (let k = 0; k < 3; k++) {
      this.nor[o + k * 3] = nx;
      this.nor[o + k * 3 + 1] = ny;
      this.nor[o + k * 3 + 2] = nz;
    }
    this.paintFace(f, overlay);
  }

  /** Final color and glow of one face: base color plus the effects on its corners. */
  private paintFace(f: number, ov: Overlay | null): void {
    const c = this.tmp.setRGB(this.baseColor[f * 3], this.baseColor[f * 3 + 1], this.baseColor[f * 3 + 2]);
    let glow = 0;
    const planet = this.world.planet;
    if (planet.fresh[planet.faces[f * 3]] === 2 || planet.fresh[planet.faces[f * 3 + 1]] === 2 || planet.fresh[planet.faces[f * 3 + 2]] === 2) {
      if (this.faceBiome[f] > Biome.ShallowSea) c.lerp(LAKE, 0.8);
    }
    if (ov) {
      const faces = planet.faces;
      let char = 0;
      let wet = 0;
      let dry = 0;
      let green = 0;
      let ash = 0;
      let veg = 0;
      for (let k = 0; k < 3; k++) {
        const cell = faces[f * 3 + k];
        glow = Math.max(glow, ov.glow[cell]);
        char += ov.char[cell] / 3;
        wet += ov.wet[cell] / 3;
        dry += ov.dry[cell] / 3;
        green += ov.green[cell] / 3;
        ash += ov.ash[cell] / 3;
        veg += ov.veg[cell] / 3;
      }
      const land = this.faceBiome[f] > Biome.ShallowSea;
      if (land) {
        if (FOREST_BIOMES.has(this.faceBiome[f]) && veg < 0.98) c.lerp(TINT_CLEARED, (1 - veg) * 0.55);
        if (green > 0) c.lerp(TINT_GREEN, green * 0.35);
        if (dry > 0) c.lerp(TINT_DRY, dry * 0.55);
        if (wet > 0) c.lerp(TINT_WET, wet * 0.5);
        if (ash > 0) c.lerp(TINT_ASH, ash * 0.75);
      }
      if (char > 0) c.lerp(glow > 0.05 ? TINT_CHAR : char > 0.95 ? TINT_CHAR : TINT_LAVA_ROCK, Math.min(1, char));
    }
    for (let k = 0; k < 3; k++) {
      const o = f * 9 + k * 3;
      this.col[o] = c.r;
      this.col[o + 1] = c.g;
      this.col[o + 2] = c.b;
      this.glow[f * 3 + k] = glow;
    }
  }
}
