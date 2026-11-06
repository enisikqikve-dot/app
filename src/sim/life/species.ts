/** Animal species: where they like to live, how big their herds get, what they eat. */
import { Biome } from '../planet/biomes';
import type { SpeciesId } from './types';

export interface Species {
  id: SpeciesId;
  predator: boolean;
  /** How well the species does in a biome (0 = cannot live there). */
  habitat: Partial<Record<Biome, number>>;
  /** Animals are happiest below this temperature (mammoths) or above it. */
  maxTemp?: number;
  minTemp?: number;
  startCount: [number, number];
  maxCount: number;
  /** Walking speed in km per hour. */
  speed: number;
  /** Food eaten per animal per 2 hours (share of a cell's food). */
  appetite: number;
}

export const SPECIES: Record<SpeciesId, Species> = {
  deer: {
    id: 'deer',
    predator: false,
    habitat: { [Biome.TemperateForest]: 1, [Biome.Taiga]: 0.7, [Biome.Grassland]: 0.8, [Biome.Rainforest]: 0.5, [Biome.Savanna]: 0.4, [Biome.Steppe]: 0.3 },
    minTemp: -6,
    startCount: [8, 18],
    maxCount: 30,
    speed: 4,
    appetite: 0.0016,
  },
  bison: {
    id: 'bison',
    predator: false,
    habitat: { [Biome.Grassland]: 1, [Biome.Steppe]: 1, [Biome.Savanna]: 0.9, [Biome.TemperateForest]: 0.3 },
    minTemp: -4,
    startCount: [10, 24],
    maxCount: 45,
    speed: 4,
    appetite: 0.0022,
  },
  mammoth: {
    id: 'mammoth',
    predator: false,
    habitat: { [Biome.Tundra]: 1, [Biome.Taiga]: 0.6, [Biome.Steppe]: 0.6, [Biome.Grassland]: 0.3 },
    maxTemp: 9,
    startCount: [4, 9],
    maxCount: 14,
    speed: 3,
    appetite: 0.0028,
  },
  wolf: {
    id: 'wolf',
    predator: true,
    habitat: {
      [Biome.TemperateForest]: 1,
      [Biome.Taiga]: 1,
      [Biome.Grassland]: 0.8,
      [Biome.Steppe]: 0.8,
      [Biome.Tundra]: 0.7,
      [Biome.Savanna]: 0.5,
      [Biome.Rainforest]: 0.4,
      [Biome.Mountains]: 0.3,
    },
    startCount: [4, 8],
    maxCount: 12,
    speed: 6,
    appetite: 0,
  },
};

export const SPECIES_IDS: SpeciesId[] = ['deer', 'bison', 'mammoth', 'wolf'];

/** How good a place is for a species (0 = unlivable). */
export function habitatScore(species: Species, biome: number, temperature: number): number {
  let h = species.habitat[biome as Biome] ?? 0;
  if (species.maxTemp !== undefined && temperature > species.maxTemp) h *= Math.max(0, 1 - (temperature - species.maxTemp) / 8);
  if (species.minTemp !== undefined && temperature < species.minTemp) h *= Math.max(0, 1 - (species.minTemp - temperature) / 8);
  return h;
}
