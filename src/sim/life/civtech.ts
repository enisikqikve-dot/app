/**
 * Knowledge of a civilisation. From farming on, knowledge belongs to a whole
 * people: it is kept in customs, crafts and later in writing. Each people
 * finds it on its own (or learns it from neighbours by trade); what it needs
 * first is listed here, together with the stone-age knowledge it builds on.
 */
import { BIT, type InventionId } from './inventions';

export const CIV_IDS = [
  'farming',
  'herding',
  'weaving',
  'masonry',
  'wheel',
  'writing',
  'money',
  'bronze',
  'iron',
  'sailing',
  'science',
  'medicine',
  'navigation',
  'printing',
  'gunpowder',
  'steam',
  'electricity',
  'vaccines',
  'flight',
  'computer',
  'robots',
  'ai',
  'cyborgs',
  'cloning',
  'weather',
  'antigravity',
  'timeTravel',
] as const;
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
  weaving: { needs: ['farming'], stone: ['clothing'], rate: 0.002, settled: true },
  masonry: { needs: ['farming'], stone: ['shelter'], rate: 0.0015, settled: true },
  wheel: { needs: ['farming', 'masonry'], stone: ['tools'], rate: 0.001, settled: true },
  writing: { needs: ['farming', 'masonry'], stone: ['song'], rate: 0.0006, settled: true, minPop: 120 },
  money: { needs: ['farming'], stone: ['pottery'], rate: 0.001, settled: true, minPop: 60 },
  bronze: { needs: ['masonry', 'wheel'], stone: ['fire', 'tools'], rate: 0.001, settled: true, minPop: 150 },
  iron: { needs: ['bronze'], stone: ['fire'], rate: 0.00075, settled: true, minPop: 250 },
  sailing: { needs: ['weaving', 'wheel'], stone: ['fishing'], rate: 0.001, settled: true, minPop: 120 },
  science: { needs: ['writing', 'money', 'iron'], stone: [], rate: 0.0003, settled: true, minPop: 500 },
  medicine: { needs: ['writing', 'science'], stone: ['herbs'], rate: 0.0004, settled: true, minPop: 500 },
  navigation: { needs: ['sailing', 'science'], stone: [], rate: 0.0003, settled: true, minPop: 800 },
  printing: { needs: ['science', 'iron'], stone: [], rate: 0.0003, settled: true, minPop: 1500 },
  gunpowder: { needs: ['iron', 'science'], stone: [], rate: 0.0003, settled: true, minPop: 1500 },
  steam: { needs: ['iron', 'printing'], stone: [], rate: 0.0003, settled: true, minPop: 3000 },
  electricity: { needs: ['steam'], stone: [], rate: 0.00025, settled: true, minPop: 5000 },
  vaccines: { needs: ['medicine', 'steam'], stone: [], rate: 0.0003, settled: true, minPop: 5000 },
  flight: { needs: ['electricity'], stone: [], rate: 0.0003, settled: true, minPop: 8000 },
  computer: { needs: ['electricity'], stone: [], rate: 0.0003, settled: true, minPop: 10000 },
  robots: { needs: ['computer'], stone: [], rate: 0.0005, settled: true, minPop: 20000 },
  ai: { needs: ['computer', 'robots'], stone: [], rate: 0.0004, settled: true, minPop: 20000 },
  cyborgs: { needs: ['robots', 'vaccines'], stone: [], rate: 0.0005, settled: true, minPop: 20000 },
  cloning: { needs: ['vaccines', 'computer'], stone: [], rate: 0.0005, settled: true, minPop: 20000 },
  weather: { needs: ['flight', 'computer'], stone: [], rate: 0.0004, settled: true, minPop: 20000 },
  antigravity: { needs: ['ai', 'flight'], stone: [], rate: 0.0003, settled: true, minPop: 30000 },
  timeTravel: { needs: ['ai', 'antigravity'], stone: [], rate: 0.0002, settled: true, minPop: 30000 },
};

/** The ages of the world, each begun by any of these pieces of knowledge (in order). */
export const EPOCHS = [
  ['neolithic', ['farming']],
  ['civilization', ['writing']],
  ['bronze', ['bronze']],
  ['antiquity', ['iron']],
  ['medieval', ['medicine', 'gunpowder', 'navigation']],
  ['renaissance', ['printing']],
  ['industrial', ['steam']],
  ['modern', ['electricity']],
  ['information', ['computer']],
  ['future', ['robots', 'ai', 'cloning']],
  ['farFuture', ['antigravity', 'timeTravel']],
] as const;
export type CivEpoch = 'stone' | (typeof EPOCHS)[number][0];

/** The age a people with this knowledge lives in. */
export function epochOf(tech: number): CivEpoch {
  let out: CivEpoch = 'stone';
  for (const [epoch, ids] of EPOCHS) if (ids.some((id) => tech & CIV_BIT[id])) out = epoch;
  return out;
}

/** 0 for the Stone Age, 1 for the Neolithic … */
export function epochIndex(tech: number): number {
  let n = 0;
  EPOCHS.forEach(([, ids], i) => {
    if (ids.some((id) => tech & CIV_BIT[id])) n = i + 1;
  });
  return n;
}

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
