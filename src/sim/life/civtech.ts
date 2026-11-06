/**
 * Knowledge of a civilisation. From farming on, knowledge belongs to a whole
 * people: it is kept in customs, crafts and later in writing. Each people
 * finds it on its own (or learns it from neighbours by trade); what it needs
 * first is listed here, together with the stone-age knowledge it builds on.
 */
import { BIT, type InventionId } from './inventions';

export const CIV_IDS = ['farming', 'herding', 'weaving', 'masonry', 'wheel', 'writing', 'money'] as const;
export type CivId = (typeof CIV_IDS)[number];

export const CIV_BIT: Record<CivId, number> = Object.fromEntries(CIV_IDS.map((id, i) => [id, 1 << i])) as Record<CivId, number>;

export interface CivTechDef {
  /** Civilisation knowledge needed first. */
  needs: CivId[];
  /** Stone-age knowledge the people must have. */
  stone: InventionId[];
  /** Chance per year for a people of about 60. */
  rate: number;
  /** Only peoples living in villages find it. */
  settled?: boolean;
  /** Only peoples at least this large find it. */
  minPop?: number;
}

export const CIV_TECHS: Record<CivId, CivTechDef> = {
  farming: { needs: [], stone: ['tools', 'fire', 'pottery'], rate: 0.025 },
  herding: { needs: [], stone: ['spear', 'shelter'], rate: 0.012 },
  weaving: { needs: ['farming'], stone: ['clothing'], rate: 0.04, settled: true },
  masonry: { needs: ['farming'], stone: ['shelter'], rate: 0.035, settled: true },
  wheel: { needs: ['farming', 'masonry'], stone: ['tools'], rate: 0.02, settled: true },
  writing: { needs: ['farming', 'masonry'], stone: ['song'], rate: 0.015, settled: true, minPop: 120 },
  money: { needs: ['farming'], stone: ['pottery'], rate: 0.02, settled: true, minPop: 60 },
};

export function civList(mask: number): CivId[] {
  return CIV_IDS.filter((id) => mask & CIV_BIT[id]);
}

/** Civilisation knowledge a people with this knowledge could find next. */
export function civReady(tech: number, stone: number): CivId[] {
  return CIV_IDS.filter((id) => {
    if (tech & CIV_BIT[id]) return false;
    const def = CIV_TECHS[id];
    return def.needs.every((n) => tech & CIV_BIT[n]) && def.stone.every((s) => stone & BIT[s]);
  });
}
