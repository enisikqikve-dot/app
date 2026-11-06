/**
 * Data of the living world: people, animal herds, food, groups and history.
 * All plain JSON, so it can be saved and snapshotted.
 */

export type Sex = 'f' | 'm';

export type ActionKind = 'idle' | 'walk' | 'gather' | 'drink' | 'sleep' | 'rest' | 'carried' | 'eat' | 'hunt' | 'fish' | 'build' | 'heal' | 'teach' | 'tinker' | 'fire' | 'pray' | 'farm';

/** Why a person is walking somewhere. */
export type Goal = 'water' | 'food' | 'group' | 'family' | 'wander' | 'safety' | 'hunt' | 'work' | 'none';

export type DeathCause =
  | 'hunger'
  | 'thirst'
  | 'cold'
  | 'sickness'
  | 'fire'
  | 'lava'
  | 'flood'
  | 'impact'
  | 'lightning'
  | 'god'
  | 'storm'
  | 'quake'
  | 'age'
  | 'childbirth'
  | 'fight'
  | 'hunt'
  | 'war'
  | 'murder';

/** Character traits, each 0 … 100 (stored in this order in `Person.traits`). */
export const TRAITS = ['curious', 'diligent', 'brave', 'kind', 'aggressive', 'clever', 'pious', 'ambitious'] as const;
export type TraitId = (typeof TRAITS)[number];
export const T_CURIOUS = 0;
export const T_DILIGENT = 1;
export const T_BRAVE = 2;
export const T_KIND = 3;
export const T_AGGRESSIVE = 4;
export const T_CLEVER = 5;
export const T_PIOUS = 6;
export const T_AMBITIOUS = 7;

export type LogKey =
  | 'created'
  | 'born'
  | 'starving'
  | 'parched'
  | 'freezing'
  | 'fledFire'
  | 'fledFlood'
  | 'sick'
  | 'recovered'
  | 'healed'
  | 'carried'
  | 'revived'
  | 'died'
  | 'partner'
  | 'separated'
  | 'childBorn'
  | 'twins'
  | 'grief'
  | 'leader'
  | 'emigrated'
  | 'resisted'
  | 'lucky'
  | 'blessedChild'
  | 'sawSign'
  | 'fight'
  | 'madePeace'
  | 'inLove'
  | 'brave'
  | 'afraid'
  | 'angry'
  | 'forgave'
  | 'comforted'
  | 'invented'
  | 'learned'
  | 'hunted'
  | 'teacher'
  | 'shaman'
  | 'converted'
  | 'prayed'
  | 'answered'
  | 'stole'
  | 'caught'
  | 'murdered'
  | 'banished'
  | 'traded'
  | 'chief'
  | 'battle'
  | 'newPeople'
  | 'civInvented'
  | 'settled'
  | 'ruler'
  | 'elected'
  | 'inherited'
  | 'built'
  | 'cyborg'
  | 'cloned'
  | 'arrived';

export interface LogEntry {
  t: number;
  key: LogKey;
  cause?: DeathCause;
  /** Another person the entry is about (partner, child, the dead …). */
  other?: number;
  /** A number (how many went along, which sky sign …). */
  n?: number;
}

/** Things that lift or weigh on someone's mood for a while. */
export type MoodKey =
  | 'grief'
  | 'newborn'
  | 'partner'
  | 'separated'
  | 'quarrel'
  | 'sign'
  | 'miracle'
  | 'comfort'
  | 'courage'
  | 'fear'
  | 'anger'
  | 'forgive'
  | 'peace'
  | 'luck'
  | 'fled'
  | 'invented'
  | 'song'
  | 'hut'
  | 'faith'
  | 'answered'
  | 'rite'
  | 'trade'
  | 'war'
  | 'victory'
  | 'defeat'
  | 'robbed'
  | 'rich'
  | 'poor';

export interface Moodlet {
  key: MoodKey;
  /** Points added to the mood (−50 … +50). */
  v: number;
  until: number;
  other?: number;
}

/** What two people are doing together right now (shown as a bubble). */
export type ChatKind = 'talk' | 'flirt' | 'love' | 'quarrel' | 'play' | 'comfort';

export interface Chat {
  kind: ChatKind;
  with: number;
  until: number;
}

/** A strong feeling, usually whispered by you. */
export type FeelingKind = 'courage' | 'fear' | 'anger';

export interface Feeling {
  kind: FeelingKind;
  until: number;
}

/** Appearance (minimal figures: colors and size only). */
export interface Look {
  /** 0 (light) … 1 (dark). */
  skin: number;
  /** Index into HAIR_COLORS: the color the genes show. */
  hair: number;
  /** Body height factor, about 0.9 … 1.1. */
  height: number;
  /** Index into CLOTH_COLORS. */
  clothes: number;
  /** Two hair alleles (one from each parent); the lower number wins. */
  genes: [number, number];
}

export interface Person {
  id: number;
  name: string;
  sex: Sex;
  /** Game minute of birth. */
  born: number;
  look: Look;
  /** Curiosity, diligence, courage, kindness, aggression, cleverness, piety, ambition (0 … 100). */
  traits: number[];
  /** Parents (−1 if unknown, e.g. made by you). */
  mother: number;
  father: number;
  /** Current partner or −1. */
  partner: number;
  /** Everyone this person was ever a couple with. */
  partners: number[];
  /** The group this person lives with. */
  band: number;
  /** Opinions of others: [person id, −100 … +100]. */
  rels: [number, number][];
  moods: Moodlet[];
  /** Loneliness, 0 (fine) … 1 (very lonely). */
  social: number;
  pregnant?: { father: number; due: number };
  lastBirth?: number;
  /** Blessed with luck until then. */
  luck?: number;
  feel?: Feeling;
  /** Marvelling at a sky sign until then. */
  awe?: number;
  chat?: Chat;
  /** Wants to lead (a whispered intention) until then. */
  lead?: number;
  /** A faraway place this person leads the group to. */
  dest?: number;
  /** What this person knows (bit mask of inventions). */
  know: number;
  /** The work this person does for the group (chosen each day). */
  task?: import('./inventions').Task;
  /** A whispered teacher until then. */
  teacher?: number;
  /** The herd being hunted, or the person being healed or taught. */
  aim?: number;
  /** How strongly this person believes in something higher (0 … 1). */
  faith?: number;
  /** The religion this person follows, or −1. */
  belief?: number;
  /** Leads the group's prayers and rites. */
  shaman?: boolean;
  /** Crimes others found out about (theft 1, murder 3). */
  crimes?: number;
  /** Money and goods (once there is money). */
  wealth?: number;
  /** Not a human: a robot or a being of artificial intelligence. */
  kind?: 'robot' | 'ai';
  /** Part machine. */
  cyborg?: boolean;
  /** Cloned from this person. */
  cloneOf?: number;
  /** Came from the future in a time machine. */
  traveler?: boolean;

  /** Cell the person is in (or leaving). */
  cell: number;
  /** Cell the person walks to, or −1. */
  next: number;
  /** 0 … 1 along the way from `cell` to `next`. */
  progress: number;
  /** Cells after `next`. */
  path: number[];
  goal: Goal;
  action: ActionKind;
  actionUntil: number;
  /** Needs, 0 (fine) … 1 (desperate). */
  hunger: number;
  thirst: number;
  /** 1 = rested, 0 = exhausted. */
  energy: number;
  /** 1 = healthy, 0 = dead. */
  health: number;
  /** Minutes of sickness left (0 = healthy). */
  sick: number;
  immune: boolean;
  /** Spot inside the cell, km east/north of the center. */
  spot: [number, number];
  /** While carried by the invisible hand: where from and when. */
  carriedFrom?: number;
  carriedAt?: number;
  alive: boolean;
  died?: number;
  cause?: DeathCause;
  /** What last hurt the person (becomes the cause of death). */
  hurtBy?: DeathCause;
  log: LogEntry[];
  /** Bit flags so warnings are logged once per episode. */
  flags: number;
}

/** Someone who died a while ago: kept for the family tree and the chronicle. Never changes. */
export interface ArchivedPerson {
  id: number;
  name: string;
  sex: Sex;
  born: number;
  died: number;
  cause: DeathCause;
  mother: number;
  father: number;
  partners: number[];
  look: Look;
  traits: number[];
  band: number;
  cell: number;
  spot: [number, number];
  log: LogEntry[];
  /** What this person knew. */
  know: number;
  /** The religion this person followed, and whether they led its rites. */
  belief?: number;
  shaman?: boolean;
}

/** A group of people who live and move together. */
export interface Band {
  id: number;
  leader: number;
  founded: number;
  /** Shared food (meat, fish), in portions of a full meal. */
  food: number;
  /** What the group has seen of you, per kind of deity (sky, healer, wrath, harvest, ancestors). */
  seen?: number[];
  /** Where the group saw its greatest miracle. */
  holy?: number;
  holyGain?: number;
  /** An open prayer: what for, when and where. */
  prayer?: { need: PrayerNeed; t: number; cell: number };
  /** The group has had a shaman before. */
  hadShaman?: boolean;
  /** The people (Volk) the group belongs to. */
  tribe?: number;
  /** The village or town the group lives in. */
  home?: number;
}

/** A village, town or city. Most inhabitants are counted, a few are people you can follow. */
export interface Settlement {
  id: number;
  name: string;
  cell: number;
  tribe: number;
  /** The group of people you can see and follow there. */
  band: number;
  founded: number;
  /** Inhabitants besides the people you can follow (counted, not simulated one by one). */
  crowd: number;
  /** Farmland around it. */
  fields: number;
  /** Price of food on the market (100 = normal). */
  price: number;
  /** Largest size it reached: 0 village, 1 town, 2 city, 3 metropolis. */
  grew: number;
  /** Things built with taxes: a temple and a wall. */
  temple?: boolean;
  wall?: boolean;
  /** Blessed harvest until then. */
  blessed?: number;
  /** Counted robots living and working there. */
  robots?: number;
  /** Floats in the sky; has a weather machine; has a time machine. */
  flying?: boolean;
  weatherMachine?: boolean;
  timeMachine?: boolean;
  ended?: number;
}

export type GovForm = 'band' | 'elders' | 'monarchy' | 'theocracy' | 'republic' | 'democracy' | 'dictatorship' | 'ai';
export const GOV_FORMS: GovForm[] = ['band', 'elders', 'monarchy', 'theocracy', 'republic', 'democracy', 'dictatorship', 'ai'];
export type LawId = 'theft' | 'murder' | 'tax' | 'faith' | 'peace' | 'equality' | 'market';

/** A people: groups that share an origin, a name and a culture. */
export interface Tribe {
  id: number;
  name: string;
  founded: number;
  /** Colour of its clothes and banners (0 … 1). */
  hue: number;
  /** How it came to be, and the people it split from. */
  origin: 'first' | 'split' | 'far' | 'appeared' | 'machines';
  parent?: number;
  /** The leader of its largest group. */
  chief: number;
  /** Culture 0 … 100: warlike, pious, open. */
  culture: [number, number, number];
  /** Relations to other peoples it has met (−100 … 100): [tribe, value]. */
  rel: [number, number][];
  /** Peoples it has traded with. */
  traded?: number[];
  /** A murder or defeat it wants to avenge: [tribe, until]. */
  grudge?: [number, number];
  ended?: number;
  /** What the people knows as a civilisation (bit mask, see civtech.ts). */
  tech?: number;
  /** Stone-age knowledge written down (with writing it is never lost). */
  lore?: number;
  /** How it is governed, since when, and its laws. */
  gov?: GovForm;
  govSince?: number;
  laws?: LawId[];
  /** The ruling family (monarchy): the founder of the dynasty. */
  dynasty?: number;
  nextElection?: number;
  /** Taxes collected. */
  treasury?: number;
  /** Discontent 0 … 1. */
  unrest?: number;
}

export type WarReason = 'land' | 'revenge' | 'faith' | 'hunger' | 'ambition';

export interface War {
  id: number;
  /** The people that started it, and the other one. */
  a: number;
  b: number;
  reason: WarReason;
  start: number;
  end?: number;
  /** The fallen on each side. */
  dead: [number, number];
  battles: number;
  winner?: number;
}

export type Deity = 'sky' | 'healer' | 'wrath' | 'harvest' | 'ancestors';
export const DEITIES: Deity[] = ['sky', 'healer', 'wrath', 'harvest', 'ancestors'];
export type PrayerNeed = 'rain' | 'food' | 'health';

/** A religion: what people came to believe about you. */
export interface Religion {
  id: number;
  deity: Deity;
  founder: number;
  founded: number;
  /** The holy place (cell). */
  holy: number;
  ended?: number;
}

/** Something people built: a hut or a fireplace. */
export interface Structure {
  id: number;
  kind: 'hut' | 'fire' | 'shrine';
  cell: number;
  spot: [number, number];
  band: number;
  /** 0 … 1 while being built. */
  built: number;
  /** Last time someone used it (abandoned places fall apart). */
  used: number;
}

/** An animal species: the four first ones, and new ones that evolve or that you create. */
export interface SpeciesRecord {
  id: number;
  base: SpeciesId;
  /** Name part from the genes ('' for the original species). */
  prefix: string;
  /** Size, fur, speed (0 … 1, 0.5 = like the ancestors) when the species appeared. */
  genes: [number, number, number];
  born: number;
  extinct?: number;
  parent?: number;
}

export type ChronicleKey =
  | 'founders'
  | 'newcomers'
  | 'birth'
  | 'twins'
  | 'couple'
  | 'separated'
  | 'death'
  | 'leader'
  | 'emigrate'
  | 'moved'
  | 'power'
  | 'sign'
  | 'population'
  | 'extinct'
  | 'invention'
  | 'lost'
  | 'species'
  | 'speciesGone'
  | 'shaman'
  | 'religion'
  | 'religionGone'
  | 'answered'
  | 'tribe'
  | 'tribeGone'
  | 'contact'
  | 'trade'
  | 'chief'
  | 'theft'
  | 'murder'
  | 'banished'
  | 'war'
  | 'battle'
  | 'peace'
  | 'conquered'
  | 'civTech'
  | 'settled'
  | 'grew'
  | 'colony'
  | 'abandoned'
  | 'government'
  | 'ruler'
  | 'election'
  | 'revolt'
  | 'law'
  | 'overseas'
  | 'epoch'
  | 'machine'
  | 'clone'
  | 'flyingCity'
  | 'weatherShield'
  | 'timeTraveler'
  | 'godFound'
  | 'uprising';

/** One line in the world chronicle. */
export interface ChronicleEntry {
  t: number;
  key: ChronicleKey;
  /** People the line is about. */
  a?: number;
  b?: number;
  c?: number;
  n?: number;
  /** A power kind or a cause of death. */
  s?: string;
  /** Peoples the line is about. */
  x?: number;
  y?: number;
  /** Important lines are highlighted. */
  major?: 1;
}

export type SpeciesId = 'deer' | 'bison' | 'mammoth' | 'wolf';

export interface Herd {
  id: number;
  species: SpeciesId;
  count: number;
  cell: number;
  next: number;
  progress: number;
  hunger: number;
  /** Year of the last births (once per spring). */
  bornYear: number;
  /** Prey the pack is chasing (wolves). */
  prey: number;
  /** Size, fur, speed (0 … 1, 0.5 = like the ancestors). */
  genes: [number, number, number];
  /** The species record. */
  kind: number;
  /** Last time hunters chased this herd (wolves or people). */
  fear?: number;
}

/** Food used up in a cell; it grows back toward the cell's capacity over time. */
export interface FoodEntry {
  level: number;
  at: number;
}

export interface LifeData {
  /** 4 since milestone 4 (older data is upgraded when loaded). */
  version: number;
  /** Simulation time (game minutes, a multiple of the tick). */
  t: number;
  /** State of the random generator. */
  rng: number;
  nextId: number;
  people: Person[];
  herds: Herd[];
  /** [cell, level, at] for cells where food was eaten. */
  food: [number, number, number][];
  bands: Band[];
  /** Append-only: people who died a while ago. */
  archive: ArchivedPerson[];
  /** Append-only: the world chronicle. */
  chronicle: ChronicleEntry[];
  /**
   * Snapshots leave the two append-only lists out (they only grow, so the
   * current lists hold them) and store how long they were.
   */
  archiveCount?: number;
  chronicleCount?: number;
  /** Highest population milestone written to the chronicle. */
  popRecord: number;
  /** Children born on the planet so far. */
  births?: number;
  /** Deaths so far. */
  deaths?: number;
  /** Huts and fireplaces. */
  structures: Structure[];
  /** All animal species that ever lived. */
  species: SpeciesRecord[];
  /** Everything anyone ever knew (to tell discoveries from rediscoveries). */
  everKnown: number;
  /** Time skip: coarse steps until then. */
  coarseUntil?: number;
  /** Everything people ever believed in. */
  religions?: Religion[];
  /** All peoples that ever lived, and their wars. */
  tribes?: Tribe[];
  wars?: War[];
  /** Villages, towns and cities. */
  settlements?: Settlement[];
  /** The latest age any people has reached (index into EPOCHS + 1). */
  epochRecord?: number;
  /** The people found out that you exist (with time machines). */
  godFound?: boolean;
  /** When the first people appeared (to rebuild the world from a code). */
  start?: number;
  /** Append-only: one row of numbers per year (see HISTORY_FIELDS). */
  history?: number[][];
  historyCount?: number;
  /** Your deeds as people see them: [kind, cruel]. */
  deeds?: [number, number];
}

/** Hair colors; the first six are genes (lower = dominant), the last is grey hair of old age. */
export const HAIR_COLORS = [0x1c1612, 0x3b2618, 0x6b4425, 0x8c4a2a, 0xc9a26b, 0xa8401f, 0x9a9a96];
export const HAIR_GREY = 6;
export const CLOTH_COLORS = [0x7a5a3a, 0x8b6b45, 0x6d4f33, 0x9a7b52, 0x5e4630];
