/** Biomes: what the ground looks like and, later, what grows and lives there. */

export enum Biome {
  DeepOcean = 0,
  Ocean = 1,
  ShallowSea = 2,
  Beach = 3,
  Grassland = 4,
  Steppe = 5,
  TemperateForest = 6,
  Rainforest = 7,
  Savanna = 8,
  Desert = 9,
  Taiga = 10,
  Tundra = 11,
  Mountains = 12,
  Ice = 13,
}

export const BIOME_COUNT = 14;

/** Stable keys for translations and tests. Index = Biome value. */
export const BIOME_KEYS = [
  'deepOcean',
  'ocean',
  'shallowSea',
  'beach',
  'grassland',
  'steppe',
  'temperateForest',
  'rainforest',
  'savanna',
  'desert',
  'taiga',
  'tundra',
  'mountains',
  'ice',
] as const;

export type BiomeKey = (typeof BIOME_KEYS)[number];

/** Natural colors (sRGB hex). Ocean entries are the sea floor seen through the water. */
export const BIOME_COLORS: readonly number[] = [
  0x0f3557, // deep ocean
  0x1b5a83, // ocean
  0x3d8ea3, // shallow sea
  0xd8c79a, // beach
  0x7fa24f, // grassland
  0xa8a364, // steppe
  0x4c7634, // temperate forest
  0x2e6a2d, // rainforest
  0xb6a75a, // savanna
  0xd6b57d, // desert
  0x3d5d3d, // taiga
  0x8b8d74, // tundra
  0x7c746b, // mountains
  0xeef2f4, // ice
];

export function isWater(biome: number): boolean {
  return biome <= Biome.ShallowSea;
}

/** How many trees grow on one triangle of this biome (0 = none). */
export const TREE_DENSITY: readonly number[] = [0, 0, 0, 0, 0.35, 0.08, 2.2, 2.6, 0.4, 0, 2.0, 0.1, 0.15, 0];

export interface ClimateInput {
  heightM: number;
  temperature: number; // annual mean, °C
  moisture: number; // 0 … 1
  nearOcean: boolean;
}

export function classifyBiome({ heightM, temperature, moisture, nearOcean }: ClimateInput): Biome {
  if (heightM < 0) {
    if (heightM > -250) return Biome.ShallowSea;
    if (heightM > -2600) return Biome.Ocean;
    return Biome.DeepOcean;
  }
  if (temperature < -9) return Biome.Ice;
  if (heightM > 2600) return Biome.Mountains;
  if (nearOcean && heightM < 18 && temperature > 2 && moisture > 0.18) return Biome.Beach;
  if (temperature < -1.5) return Biome.Tundra;
  if (temperature < 6) return moisture > 0.32 ? Biome.Taiga : Biome.Tundra;
  if (temperature < 18) {
    if (moisture > 0.5) return Biome.TemperateForest;
    if (moisture > 0.33) return Biome.Grassland;
    if (moisture > 0.22) return Biome.Steppe;
    return Biome.Desert;
  }
  if (moisture > 0.6) return Biome.Rainforest;
  if (moisture > 0.4) return Biome.Savanna;
  if (moisture > 0.33) return Biome.Steppe;
  return Biome.Desert;
}
