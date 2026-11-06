import { MAX_DEPTH_M, MAX_HEIGHT_M, type PlanetData } from '../sim/planet/generate';

/** Planet radius in scene units. All sizes in the scene are relative to this. */
export const R = 100;

/** Heights are exaggerated a lot, so mountains read as mountains on a small planet. */
const LAND_RELIEF = 3.2;
const SEA_RELIEF = 1.7;

export const MAX_SURFACE = R + 0.06 + LAND_RELIEF;
export const CLOUD_ALTITUDE = R + 4.4;

/** Radius of the visible ground (or sea floor) for a height in meters. */
export function radiusForHeight(heightM: number): number {
  if (heightM >= 0) return R + 0.06 + (heightM / MAX_HEIGHT_M) * LAND_RELIEF;
  return R - 0.12 - Math.pow(-heightM / MAX_DEPTH_M, 0.7) * SEA_RELIEF;
}

/** Radius of what the eye stands on: ground on land, the water surface at sea. */
export function walkableRadius(planet: PlanetData, cell: number): number {
  return Math.max(R, radiusForHeight(planet.heightM[cell]));
}

/** Small shared GLSL helpers. */
export const GLSL_NOISE = /* glsl */ `
  float enisHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float enisNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(enisHash(i), enisHash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(enisHash(i + vec3(0.0, 1.0, 0.0)), enisHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(enisHash(i + vec3(0.0, 0.0, 1.0)), enisHash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(enisHash(i + vec3(0.0, 1.0, 1.0)), enisHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }
`;

/** Uniforms every seasonal material shares. */
export interface SeasonUniforms {
  /** −1 … 1, +1 = middle of northern summer. */
  uSeason: { value: number };
  /** −1 … 1, the season signal shifted a quarter year: +1 spring, −1 autumn (north). */
  uSeasonCos: { value: number };
  /** °C added everywhere by ice ages, volcanic winters and heat ages. */
  uGlobalTemp: { value: number };
  /** Real seconds, for flickering fire and lava. */
  uTime: { value: number };
}

export function createSeasonUniforms(): SeasonUniforms {
  return { uSeason: { value: 0 }, uSeasonCos: { value: 1 }, uGlobalTemp: { value: 0 }, uTime: { value: 0 } };
}

/** Converts kilometers on the planet to scene units. */
export function kmToUnits(km: number, radiusKm: number): number {
  return (km / radiusKm) * R;
}
