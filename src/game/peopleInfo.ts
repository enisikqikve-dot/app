/**
 * What the interface shows about people: the person file (Akte), the family
 * tree and the lines of the world chronicle. Built from the living world on
 * demand; plain data, no text (the interface translates it).
 */
import { dateFromMinutes, type CalendarDate } from '../sim/clock';
import type { PlanetData } from '../sim/planet/generate';
import type { Biome } from '../sim/planet/biomes';
import { phaseOf, REVIVE_WINDOW, type Life, type LifePhase } from '../sim/life/life';
import type { MoodReasonKey } from '../sim/life/mood';
import type {
  ArchivedPerson,
  ChatKind,
  ChronicleEntry,
  ChronicleKey,
  DeathCause,
  FeelingKind,
  LogKey,
  Person,
  Sex,
} from '../sim/life/types';
import { HAIR_GREY, type Deity, type GovForm, type LawId, type PrayerNeed, type SpeciesId } from '../sim/life/types';
import { CIV_IDS, CIV_TECHS, type CivId } from '../sim/life/civtech';
import { HISTORY_FIELDS } from '../sim/life/civ';
import { INVENTION_IDS, INVENTIONS, BIT, listOf, type InventionId, type Task } from '../sim/life/inventions';

type Someone = Person | ArchivedPerson;

const isLiving = (x: Someone): x is Person => 'alive' in x;

export type Activity =
  | 'idle'
  | 'rest'
  | 'sleep'
  | 'drink'
  | 'gather'
  | 'carried'
  | 'walk.water'
  | 'walk.food'
  | 'walk.group'
  | 'walk.family'
  | 'walk.wander'
  | 'walk.safety'
  | 'walk.hunt'
  | 'walk.work'
  | 'walk.none'
  | 'eat'
  | 'hunt'
  | 'fish'
  | 'build'
  | 'heal'
  | 'teach'
  | 'tinker'
  | 'fire'
  | 'pray';

export interface PersonRef {
  id: number;
  name: string;
  sex: Sex;
  alive: boolean;
  age: number;
}

export interface RelationInfo extends PersonRef {
  opinion: number;
}

/** Whose hair color someone has (it can skip generations). */
export type AncestorKey = 'mother' | 'father' | 'grandmother' | 'grandfather' | 'greatGrandmother' | 'greatGrandfather';

export interface PersonInfo {
  id: number;
  name: string;
  sex: Sex;
  age: number;
  bornYear: number;
  diedYear: number | null;
  phase: LifePhase;
  alive: boolean;
  /** Died long ago: only the archive remains. */
  archived: boolean;
  cause: DeathCause | null;
  revivable: boolean;
  activity: Activity;
  chat: { kind: ChatKind; name: string } | null;
  food: number;
  water: number;
  sleep: number;
  health: number;
  company: number;
  sick: boolean;
  mood: number;
  moodReasons: { key: MoodReasonKey; v: number; name?: string }[];
  traits: number[];
  pregnant: boolean;
  lucky: boolean;
  leader: boolean;
  feeling: FeelingKind | null;
  band: { leader: string; size: number } | null;
  skin: 0 | 1 | 2;
  /** Hair color shown now (grey in old age). */
  hair: number;
  /** Hair color from the genes. */
  birthHair: number;
  height: 'short' | 'average' | 'tall';
  hairNote: { rel: AncestorKey; name: string } | null;
  biome: Biome;
  know: InventionId[];
  task: Task | null;
  teacher: boolean;
  /** The people (Volk) they belong to, and what they did wrong. */
  tribe: { name: string; hue: number } | null;
  crimes: number;
  /** Money (once there is money), and rich or poor compared with the neighbours. */
  wealth: number | null;
  standing: 'rich' | 'poor' | null;
  /** Rules the people (title depends on the form of government). */
  ruler: GovForm | null;
  /** The village or town they live in. */
  home: string | null;
  /** How strongly they believe (0–1), in what, and whether they lead the rites. */
  faith: number;
  belief: Deity | null;
  shaman: boolean;
  partner: PersonRef | null;
  formerPartners: PersonRef[];
  parents: PersonRef[];
  siblings: PersonRef[];
  children: PersonRef[];
  friends: RelationInfo[];
  foes: RelationInfo[];
  log: { date: CalendarDate; key: LogKey; cause?: DeathCause; other?: string; second?: string; n?: number }[];
}

export interface TreeNode extends PersonRef {
  bornYear: number;
  diedYear: number | null;
  hair: number;
}

export interface FamilyTree {
  focus: TreeNode;
  /** Father's father, father's mother, mother's father, mother's mother (null if unknown). */
  grandparents: (TreeNode | null)[];
  /** Mother and father (null if unknown). */
  parents: (TreeNode | null)[];
  siblings: TreeNode[];
  partners: TreeNode[];
  children: TreeNode[];
  grandchildren: number;
}

export type ChronicleCategory = 'people' | 'love' | 'death' | 'groups' | 'conflict' | 'civ' | 'knowledge' | 'animals' | 'faith' | 'nature';

export interface ChronicleLine {
  index: number;
  date: CalendarDate;
  key: ChronicleKey;
  a?: string;
  b?: string;
  c?: string;
  n?: number;
  s?: string;
  /** Names of the peoples the line is about. */
  tribe?: string;
  other?: string;
  winner?: string;
  /** A village or town the line is about (and where it is). */
  place?: string;
  from?: string;
  cell?: number;
  /** Sex of person a (for titles). */
  sex?: Sex;
  major: boolean;
  category: ChronicleCategory;
  /** The person to open when the line is tapped. */
  person?: number;
  /** For lines about animal species. */
  species?: { base: SpeciesId; prefix: string };
}

/** One invention in the knowledge net. */
export interface KnowledgeInfo {
  id: InventionId;
  needs: InventionId[];
  /** Living people who know it, and groups that do. */
  people: number;
  groups: number;
  status: 'known' | 'lost' | 'possible' | 'unknown';
  /** Who first had the idea, and when. */
  first?: { name: string; year: number };
}

/** A religion: what people came to believe about you. */
export interface ReligionInfo {
  id: number;
  deity: Deity;
  founder: string | null;
  founderId: number;
  foundedYear: number;
  endedYear: number | null;
  followers: number;
  shamans: number;
  holy: Biome;
  holyCell: number;
}

/** An open prayer: a group asks you for help. */
export interface PrayerInfo {
  band: number;
  leader: string;
  need: PrayerNeed;
  cell: number;
}

export interface FaithInfo {
  image: 'kind' | 'wrathful' | 'fickle' | 'distant';
  good: number;
  bad: number;
  believers: number;
  population: number;
  religions: ReligionInfo[];
  prayers: PrayerInfo[];
}

export type RelationState = 'war' | 'hostile' | 'tense' | 'neutral' | 'friendly' | 'close';

export interface TribeInfo {
  id: number;
  name: string;
  hue: number;
  population: number;
  groups: number;
  chief: string | null;
  chiefId: number;
  /** Warlike, pious, open (0–100). */
  culture: [number, number, number];
  origin: 'first' | 'split' | 'far' | 'appeared';
  parent: string | null;
  foundedYear: number;
  endedYear: number | null;
  religion: Deity | null;
  relations: { id: number; name: string; hue: number; value: number; state: RelationState; traded: boolean }[];
  gov: GovForm;
  rulerSex: 'f' | 'm';
  laws: LawId[];
  unrest: number;
  /** Everyone, counted inhabitants included. */
  total: number;
  settlements: SettlementInfo[];
  tech: CivId[];
}

export interface SettlementInfo {
  id: number;
  name: string;
  cell: number;
  people: number;
  size: 0 | 1 | 2 | 3;
  fields: number;
  price: number;
  temple: boolean;
  wall: boolean;
  foundedYear: number;
}

export interface CivTechInfo {
  id: CivId;
  needs: CivId[];
  /** Peoples who know it. */
  peoples: { name: string; hue: number }[];
  first?: { name: string; year: number; tribe: string };
}

export interface StatsInfo {
  fields: readonly string[];
  rows: number[][];
}

export interface WarInfo {
  id: number;
  a: { name: string; hue: number };
  b: { name: string; hue: number };
  reason: 'land' | 'revenge' | 'faith' | 'hunger' | 'ambition';
  startYear: number;
  endYear: number | null;
  dead: [number, number];
  battles: number;
  winner: string | null;
}

export interface PeoplesInfo {
  tribes: TribeInfo[];
  wars: WarInfo[];
}

export interface SpeciesInfo {
  id: number;
  base: SpeciesId;
  prefix: string;
  animals: number;
  herds: number;
  genes: [number, number, number];
  bornYear: number | null;
  extinctYear: number | null;
  createdByYou: boolean;
}

const CATEGORY: Record<ChronicleKey, ChronicleCategory> = {
  founders: 'people',
  newcomers: 'people',
  birth: 'people',
  twins: 'people',
  population: 'people',
  couple: 'love',
  separated: 'love',
  death: 'death',
  extinct: 'death',
  leader: 'groups',
  emigrate: 'groups',
  moved: 'groups',
  power: 'nature',
  sign: 'nature',
  invention: 'knowledge',
  lost: 'knowledge',
  species: 'animals',
  speciesGone: 'animals',
  shaman: 'faith',
  religion: 'faith',
  tribe: 'groups',
  tribeGone: 'groups',
  contact: 'groups',
  trade: 'groups',
  chief: 'groups',
  theft: 'conflict',
  murder: 'conflict',
  banished: 'conflict',
  war: 'conflict',
  battle: 'conflict',
  peace: 'conflict',
  conquered: 'conflict',
  civTech: 'civ',
  settled: 'civ',
  grew: 'civ',
  colony: 'civ',
  abandoned: 'civ',
  government: 'civ',
  ruler: 'civ',
  election: 'civ',
  revolt: 'conflict',
  law: 'civ',
  religionGone: 'faith',
  answered: 'faith',
};

export class PeopleInfo {
  constructor(
    private readonly life: Life,
    private readonly planet: PlanetData,
  ) {}

  private ref(x: Someone | undefined): PersonRef | null {
    if (!x) return null;
    return { id: x.id, name: x.name, sex: x.sex, alive: isLiving(x) && x.alive, age: Math.floor(this.life.ageOf(x)) };
  }

  private name(id: number | undefined): string | undefined {
    if (id === undefined || id < 0) return undefined;
    return this.life.anyone(id)?.name;
  }

  private siblingsOf(x: Someone): Someone[] {
    const out = new Map<number, Someone>();
    for (const pid of [x.mother, x.father]) {
      if (pid < 0) continue;
      for (const c of this.life.childrenOf(pid)) if (c.id !== x.id) out.set(c.id, c);
    }
    return [...out.values()].sort((a, b) => a.born - b.born);
  }

  /** The nearest ancestor with the same hair color as someone's genes show. */
  private hairOrigin(x: Someone): PersonInfo['hairNote'] {
    const look = x.look.hair;
    const parent = (id: number) => (id >= 0 ? this.life.anyone(id) : undefined);
    const gens: [Someone | undefined, AncestorKey][] = [];
    const m = parent(x.mother);
    const f = parent(x.father);
    gens.push([m, 'mother'], [f, 'father']);
    const grand = [m, f].flatMap((p) => (p ? [parent(p.mother), parent(p.father)] : []));
    for (const g of grand) if (g) gens.push([g, g.sex === 'f' ? 'grandmother' : 'grandfather']);
    const great = grand.flatMap((p) => (p ? [parent(p.mother), parent(p.father)] : []));
    for (const g of great) if (g) gens.push([g, g.sex === 'f' ? 'greatGrandmother' : 'greatGrandfather']);
    for (const [who, rel] of gens) if (who && who.look.hair === look) return { rel, name: who.name };
    return null;
  }

  person(x: Someone): PersonInfo {
    const life = this.life;
    const t = life.t;
    const living = isLiving(x) ? x : null;
    const alive = !!living?.alive;
    const age = Math.floor(life.ageOf(x));
    const activity: Activity = !living || !alive ? 'idle' : living.action === 'walk' ? (`walk.${living.goal}` as Activity) : (living.action as Activity);
    const mood = living && alive ? life.mood(living) : { value: 50, reasons: [] };
    const partnerId = living ? living.partner : -1;
    const parents = [x.mother, x.father].map((id) => (id >= 0 ? this.ref(life.anyone(id)) : null)).filter((r): r is PersonRef => !!r);
    const rels = living ? [...living.rels].sort((a, b) => b[1] - a[1]) : [];
    const family = new Set<number>([partnerId, x.mother, x.father, ...this.siblingsOf(x).map((s) => s.id), ...life.childrenOf(x.id).map((c) => c.id)]);
    const relInfo = (id: number, opinion: number): RelationInfo | null => {
      const r = this.ref(life.anyone(id));
      return r ? { ...r, opinion } : null;
    };
    const band = living ? life.band(living.band) : undefined;
    const leader = band ? life.anyone(band.leader) : undefined;
    const hairNow = age >= 52 ? HAIR_GREY : x.look.hair;
    const died = living ? living.died : (x as ArchivedPerson).died;
    return {
      id: x.id,
      name: x.name,
      sex: x.sex,
      age,
      bornYear: dateFromMinutes(Math.max(0, x.born)).year,
      diedYear: died !== undefined ? dateFromMinutes(died).year : null,
      phase: phaseOf(life.ageOf(x)),
      alive,
      archived: !living,
      cause: living ? (living.cause ?? null) : (x as ArchivedPerson).cause,
      revivable: !!living && !alive && died !== undefined && t - died <= REVIVE_WINDOW,
      activity,
      chat: living?.chat && alive ? { kind: living.chat.kind, name: this.name(living.chat.with) ?? '' } : null,
      food: living ? 1 - living.hunger : 0,
      water: living ? 1 - living.thirst : 0,
      sleep: living ? living.energy : 0,
      health: living ? Math.max(0, living.health) : 0,
      company: living ? 1 - living.social : 0,
      sick: !!living && living.sick > 0,
      mood: mood.value,
      moodReasons: mood.reasons.map((r) => ({ key: r.key, v: r.v, name: this.name(r.other) })),
      traits: [...x.traits],
      pregnant: !!living?.pregnant,
      lucky: living?.luck !== undefined,
      leader: !!living && alive && life.isLeader(living),
      feeling: living?.feel?.kind ?? null,
      band: alive && band && leader ? { leader: leader.name, size: life.bandSize(band.id) } : null,
      skin: x.look.skin < 0.34 ? 0 : x.look.skin < 0.67 ? 1 : 2,
      hair: hairNow,
      birthHair: x.look.hair,
      height: x.look.height < 0.96 ? 'short' : x.look.height > 1.05 ? 'tall' : 'average',
      hairNote: this.hairOrigin(x),
      biome: this.planet.biome[living ? living.cell : (x as ArchivedPerson).cell] as Biome,
      know: listOf(x.know ?? 0),
      task: living?.alive && this.life.ageOf(x) >= 14 ? (living.task ?? 'gather') : null,
      teacher: !!living?.teacher && living.teacher > t,
      tribe: this.tribeOf(x.band),
      crimes: living?.crimes ?? 0,
      wealth: living?.wealth !== undefined ? Math.round(living.wealth) : null,
      standing: living?.alive ? life.civ.standing(living) : null,
      ruler: alive && life.tribes.tribeOfBand(x.band)?.chief === x.id && life.tribes.tribeOfBand(x.band)!.gov !== undefined ? life.tribes.tribeOfBand(x.band)!.gov! : null,
      home: alive ? (life.civ.homeOf(x.band)?.name ?? null) : null,
      faith: living ? (living.faith ?? 0) : 0,
      belief: this.deityOf(x.belief),
      shaman: !!x.shaman,
      partner: partnerId >= 0 ? this.ref(life.anyone(partnerId)) : null,
      formerPartners: x.partners.filter((id) => id !== partnerId).map((id) => this.ref(life.anyone(id))).filter((r): r is PersonRef => !!r),
      parents,
      siblings: this.siblingsOf(x).map((s) => this.ref(s)!),
      children: life.childrenOf(x.id).map((c) => this.ref(c)!),
      friends: rels.filter(([id, v]) => v >= 35 && !family.has(id) && !!life.person(id)?.alive).slice(0, 5).map(([id, v]) => relInfo(id, v)).filter((r): r is RelationInfo => !!r),
      foes: rels.filter(([id, v]) => v <= -25 && !family.has(id) && !!life.person(id)?.alive).reverse().slice(0, 5).map(([id, v]) => relInfo(id, v)).filter((r): r is RelationInfo => !!r),
      log: [...x.log]
        .reverse()
        .slice(0, 16)
        .map((l) => ({
          date: dateFromMinutes(l.t),
          key: l.key,
          cause: l.cause,
          other: this.name(l.other),
          second: l.key === 'born' || l.key === 'twins' ? this.name(l.n) : undefined,
          n: l.n,
        })),
    };
  }

  private node(x: Someone): TreeNode {
    const living = isLiving(x) ? x : null;
    const died = living ? living.died : (x as ArchivedPerson).died;
    const age = this.life.ageOf(x);
    return {
      id: x.id,
      name: x.name,
      sex: x.sex,
      alive: !!living?.alive,
      age: Math.floor(age),
      bornYear: dateFromMinutes(Math.max(0, x.born)).year,
      diedYear: died !== undefined ? dateFromMinutes(died).year : null,
      hair: age >= 52 ? HAIR_GREY : x.look.hair,
    };
  }

  familyTree(id: number): FamilyTree | null {
    const life = this.life;
    const x = life.anyone(id);
    if (!x) return null;
    const get = (pid: number) => (pid >= 0 ? life.anyone(pid) : undefined);
    const mother = get(x.mother);
    const father = get(x.father);
    const gp = (p: Someone | undefined) => (p ? [get(p.father), get(p.mother)] : [undefined, undefined]);
    const children = life.childrenOf(x.id);
    let grandchildren = 0;
    for (const c of children) grandchildren += life.childrenOf(c.id).length;
    return {
      focus: this.node(x),
      grandparents: [...gp(father), ...gp(mother)].map((g) => (g ? this.node(g) : null)),
      parents: [mother ? this.node(mother) : null, father ? this.node(father) : null],
      siblings: this.siblingsOf(x).map((s) => this.node(s)),
      partners: x.partners.map((pid) => get(pid)).filter((p): p is Someone => !!p).map((p) => this.node(p)),
      children: children.map((c) => this.node(c)),
      grandchildren,
    };
  }

  chronicleLine(e: ChronicleEntry, index: number): ChronicleLine {
    const line: ChronicleLine = {
      index,
      date: dateFromMinutes(e.t),
      key: e.key,
      major: !!e.major,
      category: CATEGORY[e.key],
    };
    if (e.a !== undefined) {
      line.a = this.name(e.a);
      const who = this.life.anyone(e.a);
      if (who) line.sex = who.sex;
    }
    if (e.b !== undefined) line.b = this.name(e.b);
    if (e.c !== undefined) line.c = this.name(e.c);
    if (e.n !== undefined) line.n = e.n;
    if (e.s !== undefined) line.s = e.s;
    if (e.a !== undefined && e.key !== 'power' && e.key !== 'sign' && e.key !== 'species') line.person = e.a;
    else if (e.key === 'power' && e.s === 'revive') line.person = e.a;
    const tribes = this.life.tribes;
    if (e.x !== undefined) line.tribe = tribes.tribe(e.x)?.name;
    if (e.y !== undefined) line.other = tribes.tribe(e.y)?.name;
    if (e.key === 'peace' && e.s) line.winner = tribes.tribe(Number(e.s))?.name;
    if ((e.key === 'settled' || e.key === 'grew' || e.key === 'colony' || e.key === 'abandoned' || e.key === 'conquered') && e.n !== undefined) {
      const h = this.life.civ.settlement(e.n);
      if (h) {
        line.place = h.name;
        line.cell = h.cell;
      }
    }
    if (e.key === 'colony' && e.c !== undefined) {
      line.from = this.life.civ.settlement(e.c)?.name;
      line.c = undefined;
    }
    if ((e.key === 'religion' || e.key === 'religionGone') && e.n !== undefined) {
      const rel = this.life.faith.religion(e.n);
      if (rel) line.s = rel.deity;
    }
    if ((e.key === 'species' || e.key === 'speciesGone') && e.n !== undefined) {
      const rec = this.life.speciesRecord(e.n);
      if (rec) line.species = { base: rec.base, prefix: rec.prefix };
    }
    return line;
  }

  /** The knowledge net: what is known, lost, within reach or still unknown. */
  knowledge(): KnowledgeInfo[] {
    const life = this.life;
    const now = life.worldKnows();
    const ever = life.everKnown;
    const firsts = new Map<string, { name: string; year: number }>();
    for (const c of life.chronicle) {
      if (c.key === 'invention' && c.s && !firsts.has(c.s)) firsts.set(c.s, { name: this.name(c.a) ?? '?', year: dateFromMinutes(c.t).year });
    }
    return INVENTION_IDS.map((id) => {
      let people = 0;
      const groups = new Set<number>();
      for (const p of life.people) {
        if (p.alive && p.know & BIT[id]) {
          people++;
          groups.add(p.band);
        }
      }
      const possible = INVENTIONS[id].needs.every((n) => now & BIT[n]);
      const status: KnowledgeInfo['status'] = now & BIT[id] ? 'known' : ever & BIT[id] ? 'lost' : possible ? 'possible' : 'unknown';
      const info: KnowledgeInfo = { id, needs: [...INVENTIONS[id].needs], people, groups: groups.size, status };
      const first = firsts.get(id);
      if (first) info.first = first;
      return info;
    });
  }

  private tribeOf(bandId: number): { name: string; hue: number } | null {
    const tr = this.life.tribes.tribeOfBand(bandId);
    return tr ? { name: tr.name, hue: tr.hue } : null;
  }

  /** The peoples, how they get along, and their wars. */
  peoples(): PeoplesInfo {
    const life = this.life;
    const sys = life.tribes;
    const size = new Map<number, { people: number; groups: number }>();
    for (const b of life.bands) {
      if (b.tribe === undefined) continue;
      const s = size.get(b.tribe) ?? { people: 0, groups: 0 };
      s.people += life.members(b.id).length;
      s.groups++;
      size.set(b.tribe, s);
    }
    const stateOf = (a: number, b: number, v: number): RelationState =>
      sys.war(a, b) ? 'war' : v <= -35 ? 'hostile' : v <= -10 ? 'tense' : v < 15 ? 'neutral' : v < 45 ? 'friendly' : 'close';
    const tribes = sys.tribes
      .map((tr): TribeInfo => {
        const s = size.get(tr.id) ?? { people: 0, groups: 0 };
        const rel = tr.ended === undefined ? sys.mainBelief(tr) : -1;
        const homes = life.civ.settlements.filter((h) => h.tribe === tr.id && h.ended === undefined);
        const ruler = life.anyone(tr.chief);
        return {
          gov: tr.gov ?? 'band',
          rulerSex: ruler?.sex ?? 'm',
          laws: [...(tr.laws ?? [])],
          unrest: tr.unrest ?? 0,
          total: s.people + homes.reduce((n, h) => n + Math.floor(h.crowd), 0),
          settlements: homes.map((h) => this.settlementInfo(h)).sort((a, b) => b.people - a.people),
          tech: CIV_IDS.filter((id) => life.civ.knows(tr, id)),
          id: tr.id,
          name: tr.name,
          hue: tr.hue,
          population: s.people,
          groups: s.groups,
          chief: tr.ended === undefined ? (this.name(tr.chief) ?? null) : null,
          chiefId: tr.chief,
          culture: [tr.culture[0], tr.culture[1], tr.culture[2]],
          origin: tr.origin,
          parent: tr.parent !== undefined ? (sys.tribe(tr.parent)?.name ?? null) : null,
          foundedYear: dateFromMinutes(tr.founded).year,
          endedYear: tr.ended !== undefined ? dateFromMinutes(tr.ended).year : null,
          religion: this.deityOf(rel),
          relations: tr.rel
            .map(([id, v]) => ({ other: sys.tribe(id), v }))
            .filter((r) => r.other && r.other.ended === undefined)
            .map(({ other, v }) => ({ id: other!.id, name: other!.name, hue: other!.hue, value: Math.round(v), state: stateOf(tr.id, other!.id, v), traded: !!tr.traded?.includes(other!.id) }))
            .sort((a, b) => a.value - b.value),
        };
      })
      .sort((a, b) => (a.endedYear === null ? 0 : 1) - (b.endedYear === null ? 0 : 1) || b.population - a.population);
    const side = (id: number) => {
      const tr = sys.tribe(id);
      return { name: tr?.name ?? '?', hue: tr?.hue ?? 0 };
    };
    const wars = sys.wars
      .map((w): WarInfo => ({
        id: w.id,
        a: side(w.a),
        b: side(w.b),
        reason: w.reason,
        startYear: dateFromMinutes(w.start).year,
        endYear: w.end !== undefined ? dateFromMinutes(w.end).year : null,
        dead: [w.dead[0], w.dead[1]],
        battles: w.battles,
        winner: w.winner !== undefined ? (sys.tribe(w.winner)?.name ?? null) : null,
      }))
      .sort((a, b) => (a.endYear === null ? 0 : 1) - (b.endYear === null ? 0 : 1) || b.startYear - a.startYear);
    return { tribes, wars };
  }

  settlementInfo(h: import('../sim/life/types').Settlement): SettlementInfo {
    const civ = this.life.civ;
    return {
      id: h.id,
      name: h.name,
      cell: h.cell,
      people: civ.inhabitants(h),
      size: civ.sizeOf(h),
      fields: h.fields,
      price: h.price,
      temple: !!h.temple,
      wall: !!h.wall,
      foundedYear: dateFromMinutes(h.founded).year,
    };
  }

  /** The settlement at or next to a cell. */
  settlementNear(cell: number): SettlementInfo | null {
    const planet = this.planet;
    for (const h of this.life.civ.living()) {
      if (h.cell === cell) return this.settlementInfo(h);
      for (let k = planet.neighborOffsets[h.cell]; k < planet.neighborOffsets[h.cell + 1]; k++) if (planet.neighbors[k] === cell) return this.settlementInfo(h);
    }
    return null;
  }

  /** Knowledge of civilisation: who knows what, who found it first. */
  civTech(): CivTechInfo[] {
    const life = this.life;
    const firsts = new Map<string, { name: string; year: number; tribe: string }>();
    for (const c of life.chronicle) {
      if (c.key === 'civTech' && c.s && c.a !== undefined && !firsts.has(c.s)) firsts.set(c.s, { name: this.name(c.a) ?? '?', year: dateFromMinutes(c.t).year, tribe: life.tribes.tribe(c.x)?.name ?? '?' });
    }
    return CIV_IDS.map((id) => {
      const info: CivTechInfo = {
        id,
        needs: [...CIV_TECHS[id].needs],
        peoples: life.tribes.living().filter((tr) => life.civ.knows(tr, id)).map((tr) => ({ name: tr.name, hue: tr.hue })),
      };
      const first = firsts.get(id);
      if (first) info.first = first;
      return info;
    });
  }

  /** The yearly statistics. */
  stats(): StatsInfo {
    return { fields: HISTORY_FIELDS, rows: this.life.civ.history };
  }

  private deityOf(id: number | undefined): Deity | null {
    if (id === undefined || id < 0) return null;
    return this.life.faith.religion(id)?.deity ?? null;
  }

  /** Religions, open prayers and how people see you. */
  faith(): FaithInfo {
    const life = this.life;
    const faith = life.faith;
    const counts = new Map<number, { n: number; shamans: number }>();
    let believers = 0;
    let population = 0;
    for (const p of life.people) {
      if (!p.alive) continue;
      population++;
      if ((p.belief ?? -1) < 0) continue;
      believers++;
      const c = counts.get(p.belief!) ?? { n: 0, shamans: 0 };
      c.n++;
      if (p.shaman) c.shamans++;
      counts.set(p.belief!, c);
    }
    const religions = faith.religions
      .map((r) => {
        const c = counts.get(r.id) ?? { n: 0, shamans: 0 };
        return {
          id: r.id,
          deity: r.deity,
          founder: this.name(r.founder) ?? null,
          founderId: r.founder,
          foundedYear: dateFromMinutes(r.founded).year,
          endedYear: r.ended !== undefined ? dateFromMinutes(r.ended).year : null,
          followers: c.n,
          shamans: c.shamans,
          holy: this.planet.biome[r.holy] as Biome,
          holyCell: r.holy,
        };
      })
      .sort((a, b) => (a.endedYear === null ? 0 : 1) - (b.endedYear === null ? 0 : 1) || b.followers - a.followers);
    const prayers: PrayerInfo[] = [];
    for (const b of life.bands) {
      if (!b.prayer || life.t - b.prayer.t > 4 * 1440) continue;
      const leader = life.person(b.leader);
      prayers.push({ band: b.id, leader: leader?.name ?? '?', need: b.prayer.need, cell: b.prayer.cell });
    }
    const [good, bad] = life.raw.deeds ?? [0, 0];
    return { image: faith.godImage(), good, bad, believers, population, religions, prayers };
  }

  /** All animal species, living ones first. */
  species(): SpeciesInfo[] {
    const life = this.life;
    const count = new Map<number, { animals: number; herds: number }>();
    for (const h of life.herds) {
      const c = count.get(h.kind) ?? { animals: 0, herds: 0 };
      c.animals += h.count;
      c.herds++;
      count.set(h.kind, c);
    }
    const madeByYou = new Set<number>();
    for (const c of life.chronicle) if (c.key === 'species' && c.s === 'god' && c.n !== undefined) madeByYou.add(c.n);
    return life.species
      .map((r) => {
        const c = count.get(r.id) ?? { animals: 0, herds: 0 };
        return {
          id: r.id,
          base: r.base,
          prefix: r.prefix,
          animals: c.animals,
          herds: c.herds,
          genes: [r.genes[0], r.genes[1], r.genes[2]] as [number, number, number],
          bornYear: r.born > 0 ? dateFromMinutes(r.born).year : null,
          extinctYear: r.extinct !== undefined ? dateFromMinutes(r.extinct).year : null,
          createdByYou: madeByYou.has(r.id),
        };
      })
      .sort((a, b) => (a.extinctYear === null ? 0 : 1) - (b.extinctYear === null ? 0 : 1) || b.animals - a.animals);
  }

  /** The newest lines first. */
  chronicle(limit = 400): ChronicleLine[] {
    const all = this.life.chronicle;
    const out: ChronicleLine[] = [];
    for (let i = all.length - 1; i >= 0 && out.length < limit; i--) out.push(this.chronicleLine(all[i], i));
    return out;
  }
}
