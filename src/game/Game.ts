/**
 * Game: owns the world, the living beings, the clock, the renderer and the
 * camera, and runs the frame loop. The UI talks to it only through methods
 * and the `ui` store.
 *
 * Time model: the clock runs smoothly; the living world follows in fixed
 * steps (TICK). Every power is applied at a step boundary, with a snapshot of
 * the living world taken just before, so rewinding can restore that snapshot
 * and replay exactly.
 */
import * as THREE from 'three';
import { Store, safeStorage } from '../core/store';
import { randomSeed } from '../core/rng';
import { encodeWorldCode, type PlanetSize, type WorldSpec } from '../core/worldCode';
import type { MessageKey } from '../i18n';
import {
  Clock,
  dateFromMinutes,
  localSolarHours,
  MINUTES_PER_DAY,
  MINUTES_PER_YEAR,
  seasonSignal,
  sunDeclination,
  sunLongitude,
  type CalendarDate,
  type SpeedIndex,
} from '../sim/clock';
import { currentTemperature, generatePlanet, latitudeOf, longitudeOf, type PlanetData } from '../sim/planet/generate';
import { nearestCell } from '../sim/planet/geodesic';
import { Biome, isWater } from '../sim/planet/biomes';
import { Overlay, World, type ClimateShift } from '../sim/world';
import { POWER_OPTIONS, powerDef, type PowerEvent, type PowerKind } from '../sim/powers';
import { Life, REVIVE_WINDOW, TICK, type EventOutcome } from '../sim/life/life';
import type { ChronicleKey, SpeciesId } from '../sim/life/types';
import { CIV_BIT } from '../sim/life/civtech';
import { PeopleInfo, type ChronicleLine, type CivTechInfo, type FaithInfo, type PeoplesInfo, type SettlementInfo, type StatsInfo, type FamilyTree, type KnowledgeInfo, type PersonInfo, type SpeciesInfo } from './peopleInfo';
import { BIT } from '../sim/life/inventions';
import { R, MAX_SURFACE, createSeasonUniforms, kmToUnits, radiusForHeight, walkableRadius, type SeasonUniforms } from '../render/scale';
import { TerrainView } from '../render/terrain';
import { TreeView } from '../render/trees';
import { buildRivers } from '../render/rivers';
import { buildOcean } from '../render/ocean';
import { buildAtmosphere, type Atmosphere } from '../render/atmosphere';
import { buildSky, type Sky } from '../render/sky';
import { buildClouds } from '../render/clouds';
import { AimRing, PlaceMarker } from '../render/marker';
import { GodCamera } from '../render/godCamera';
import { LifeView } from '../render/lifeView';
import { TownView } from '../render/towns';
import { BubbleLayer, bubbleSymbol, type BubbleItem } from '../render/bubbles';
import { ParticleSystem } from '../render/fx/particles';
import {
  burst,
  EruptionView,
  FireView,
  FloodView,
  LightningFx,
  MeteorFx,
  RainView,
  StormView,
  WaveView,
  type Effect,
  type FxContext,
  type OngoingView,
} from '../render/fx/effects';
import { SkySignFx } from '../render/fx/signs';
import { SoundEngine, type SoundName } from '../audio/sound';
import { isLifeData, parseSaveData, sanitizeEvents, type LifeSnapshot, type SaveData } from './saveData';

export type { SaveData };
export type { Activity, ChronicleLine, CivTechInfo, FaithInfo, PeoplesInfo, SettlementInfo, StatsInfo, FamilyTree, KnowledgeInfo, PersonInfo, SpeciesInfo } from './peopleInfo';

/** A snapshot of the living world kept in memory as compact text. */
interface MemSnapshot {
  t: number;
  eventCount: number;
  json: string;
  periodic: boolean;
}

/** Chronicle lines that also pop up as a message (if important). */
const NEWSWORTHY = new Set<ChronicleKey>(['birth', 'twins', 'population', 'emigrate', 'moved', 'extinct', 'leader', 'invention', 'lost', 'species', 'speciesGone', 'religion', 'religionGone', 'answered', 'tribe', 'tribeGone', 'contact', 'murder', 'war', 'battle', 'peace', 'conquered']);

/** A running time skip. */
interface SkipRun {
  eventId: number;
  from: number;
  to: number;
  pop: number;
  births: number;
  deaths: number;
  chronicle: number;
  stop: boolean;
}

export interface SkipProgress {
  years: number;
  /** 0 … 1 */
  done: number;
  /** Calendar year now. */
  year: number;
}

/** What happened during a time skip. */
export interface SkipSummary {
  years: number;
  popBefore: number;
  popAfter: number;
  births: number;
  deaths: number;
  lines: ChronicleLine[];
  stopped: boolean;
}

const SAVE_KEY = 'enis.save.v3';
const OLD_SAVE_KEYS = ['enis.save.v2', 'enis.save.v1'];
const SPACE_COLOR = new THREE.Color(0x03050b);
const DAY_SKY_COLOR = new THREE.Color(0x8db6dc);
const DUSK_SKY_COLOR = new THREE.Color(0x2b3550);
const DUST_SKY_COLOR = new THREE.Color(0x857462);
const DAY = MINUTES_PER_DAY;
const YEAR = MINUTES_PER_YEAR;
/** At most this many simulation steps per frame (the clock waits if the simulation falls behind). */
const MAX_TICKS_PER_FRAME = 900;

export type PlaceCondition =
  | 'burning'
  | 'burnt'
  | 'lava'
  | 'lavaRock'
  | 'flooded'
  | 'drought'
  | 'raining'
  | 'ash'
  | 'damaged'
  | 'planted'
  | 'blessed'
  | 'plague';

/** The age the world is in (from what people know). */
export type Epoch = 'none' | 'paleolithic' | 'mesolithic' | 'neolithic' | 'civilization';

export interface PlaceInfo {
  cell: number;
  biome: Biome;
  latitude: number;
  longitude: number;
  heightM: number;
  meanTemperature: number;
  temperatureNow: number;
  moisture: number;
  localHours: number;
  daylight: boolean;
  /** Sea ice right now (water) or snow cover (land). */
  frozen: boolean;
  conditions: PlaceCondition[];
  /** 0 none, 1 river, 2 lake, 3 spring. */
  fresh: number;
  /** Food right now, 0 … ~1.6. */
  food: number;
  /** A village or town here. */
  settlement: SettlementInfo | null;
}

export interface HerdInfo {
  id: number;
  species: SpeciesId;
  /** Name part of an evolved species ('' for the original one). */
  prefix: string;
  genes: [number, number, number];
  count: number;
  activity: 'grazing' | 'moving' | 'hunting' | 'hungry' | 'roaming';
  biome: Biome;
}

export interface ClimateInfo {
  kind: ClimateShift['kind'] | null;
  /** °C added everywhere. */
  temperature: number;
  dust: number;
}

export interface Notice {
  id: number;
  key?: MessageKey;
  params?: Record<string, string | number>;
  /** A line of the chronicle, shown as it reads there. */
  line?: ChronicleLine;
}

export interface RewindPoint {
  minutes: number;
  /** How many events stay after rewinding. */
  eventCount: number;
  /** The event this point comes right before, or null for a decade mark. */
  kind: PowerKind | null;
}

export interface UiState {
  ready: boolean;
  loading: boolean;
  planetName: string;
  worldCode: string;
  size: PlanetSize;
  radiusKm: number;
  date: CalendarDate;
  speedIndex: SpeedIndex;
  timelapse: boolean;
  focusHours: number;
  focusDaylight: boolean;
  place: PlaceInfo | null;
  person: PersonInfo | null;
  herd: HerdInfo | null;
  following: boolean;
  population: number;
  armed: PowerKind | null;
  /** The chosen option of the armed power (number of people, species). */
  armedOption: number | null;
  /** The invisible hand: first pick a person, then a place. */
  carryStep: 'pick' | 'place' | 'pick2' | null;
  /** Grows with each line of the chronicle (so open views refresh). */
  chronicleCount: number;
  skip: SkipProgress | null;
  skipSummary: SkipSummary | null;
  epoch: Epoch;
  climate: ClimateInfo;
  eventCount: number;
  soundOn: boolean;
  notice: Notice | null;
  /** Set when the planet could not be built. */
  error: string | null;
}

interface PlanetScene {
  world: World;
  overlay: Overlay;
  root: THREE.Group;
  fxRoot: THREE.Group;
  terrain: TerrainView;
  trees: TreeView;
  rivers: THREE.Mesh;
  lifeView: LifeView;
  towns: TownView;
  fire: FireView;
  flood: FloodView;
  clouds: THREE.Group;
  sky: Sky;
  atmosphere: Atmosphere;
  fx: FxContext;
}

type Selection = { kind: 'person' | 'herd'; id: number } | null;

/** The same day, but at 9:30 local time at the given longitude, so a new planet starts in daylight. */
function morningAt(minutes: number, longitude: number): number {
  const dayStart = Math.floor(minutes / MINUTES_PER_DAY) * MINUTES_PER_DAY;
  // localHours = 12 + (lon − sunLon)·24/2π and sunLon = π − 2π·dayFraction
  const sunLon = longitude - ((9.5 - 12) / 24) * 2 * Math.PI;
  let dayFraction = (Math.PI - sunLon) / (2 * Math.PI);
  dayFraction = ((dayFraction % 1) + 1) % 1;
  return dayStart + dayFraction * MINUTES_PER_DAY;
}

export class Game {
  readonly ui: Store<UiState>;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly cameraCtl: GodCamera;
  private readonly clock = new Clock();
  private readonly season: SeasonUniforms = createSeasonUniforms();
  private readonly sunLight = new THREE.DirectionalLight(0xfff4e6, 3.1);
  private readonly ambient = new THREE.AmbientLight(0x6f84b8, 0.32);
  private readonly marker = new PlaceMarker();
  private readonly aim = new AimRing();
  private readonly sparks = new ParticleSystem(5000, true);
  private readonly smoke = new ParticleSystem(3500, false);
  private readonly sound = new SoundEngine();
  private readonly bubbles: BubbleLayer;
  private world: PlanetScene | null = null;
  private life: Life | null = null;
  private snapshots: MemSnapshot[] = [];
  private info: PeopleInfo | null = null;
  private seenChronicle = 0;
  /** When the last prayer was shown as a message (game minutes). */
  private lastPrayerNotice = -Infinity;
  private seenPrayers = new Map<number, number>();
  private spec: WorldSpec | null = null;
  private focusCell = 0;
  private pickCell = 0;
  private selectedCell: number | null = null;
  /** Seconds left to glide the view onto a fresh selection (phones, where a sheet covers the lower half). */
  private centering = 0;
  private selection: Selection = null;
  private following = false;
  private readonly sunDir = new THREE.Vector3(1, 0.2, 0).normalize();
  private readonly realSunDir = new THREE.Vector3();
  private cloudAngle = 0;
  private lastFrame = performance.now();
  private lastUiPush = 0;
  private lastSave = 0;
  private lastSnapshotReal = 0;
  private running = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly skyColor = new THREE.Color(SPACE_COLOR);
  private resumeSpeed: SpeedIndex = 1;

  private armed: PowerKind | null = null;
  private armedOption: number | null = null;
  private carryTarget: number | null = null;
  /** Whispered love: the person who is to love someone. */
  private pairFirst: number | null = null;
  private skipRun: SkipRun | null = null;
  private lastSkipUi = 0;
  private effects: Effect[] = [];
  private ongoing = new Map<number, OngoingView>();
  private lastOverlayMinutes = -1;
  private lastOverlayReal = 0;
  private treeRebuildAt = 0;
  private stroke: { event: PowerEvent; lastCell: number; lastTime: number } | null = null;
  private lastHover = 0;
  private nextEventId = 1;
  private noticeId = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene.background = this.skyColor;
    this.scene.fog = new THREE.Fog(this.skyColor, 1e5, 2e5);
    this.scene.add(this.sunLight, this.sunLight.target, this.ambient, this.marker.group, this.aim.mesh, this.sparks.points, this.smoke.points);
    this.bubbles = new BubbleLayer(canvas.parentElement ?? document.body);

    this.cameraCtl = new GodCamera(canvas, {
      surfaceRadius: (dir) => this.surfaceRadius(dir),
      onTap: (x, y) => this.onTap(x, y),
      onBrush: (phase, x, y) => this.onBrush(phase, x, y),
      onHover: (x, y) => this.onHover(x, y),
    });

    this.ui = new Store<UiState>({
      ready: false,
      loading: true,
      planetName: '',
      worldCode: '',
      size: 'medium',
      radiusKm: 0,
      date: this.clock.date(),
      speedIndex: this.clock.speedIndex,
      timelapse: false,
      focusHours: 12,
      focusDaylight: true,
      place: null,
      person: null,
      herd: null,
      following: false,
      population: 0,
      armed: null,
      armedOption: null,
      carryStep: null,
      chronicleCount: 0,
      skip: null,
      skipSummary: null,
      epoch: 'none',
      climate: { kind: null, temperature: 0, dust: 0 },
      eventCount: 0,
      soundOn: this.sound.enabled,
      notice: null,
      error: null,
    });

    const resize = () => this.resize();
    window.addEventListener('resize', resize);
    new ResizeObserver(resize).observe(canvas);
    this.resize();

    const persist = () => this.save();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persist();
    });
    window.addEventListener('pagehide', persist);
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      }
    });
  }

  // ---------------------------------------------------------------- saving

  static loadSave(): SaveData | null {
    for (const key of [SAVE_KEY, ...OLD_SAVE_KEYS]) {
      try {
        const raw = safeStorage.get(key);
        if (!raw) continue;
        const data = parseSaveData(JSON.parse(raw));
        if (data) return data;
      } catch {
        /* try the next one */
      }
    }
    return null;
  }

  snapshot(): SaveData | null {
    if (!this.spec || !this.world || !this.life) return null;
    return {
      code: encodeWorldCode(this.spec),
      minutes: this.clock.minutes,
      speedIndex: this.clock.speedIndex,
      events: this.world.world.events,
      life: this.life.serialize(),
      snaps: this.persistentSnapshots(),
    };
  }

  /** A few snapshots survive a reload: the latest ones and one older one. */
  private persistentSnapshots(): LifeSnapshot[] {
    const all = this.snapshots;
    const keep = all.length <= 4 ? all : [all[0], ...all.slice(-3)];
    return keep.map((s) => ({ t: s.t, eventCount: s.eventCount, periodic: s.periodic, data: JSON.parse(s.json) }));
  }

  private save(): void {
    const data = this.snapshot();
    if (!data) return;
    try {
      safeStorage.set(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage full or unavailable */
    }
  }

  /**
   * Starts the game. If a saved world cannot be rebuilt, it falls back to the same planet
   * without the saved events, then to a fresh planet, and finally shows the error.
   */
  async start(spec: WorldSpec, save: SaveData | null): Promise<void> {
    const attempts: (() => Promise<void>)[] = [
      () => this.createWorld(spec, save),
      () => this.createWorld(spec, null),
      () => this.createWorld({ seed: randomSeed(), size: 'medium' }, null),
    ];
    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        await attempt();
        return;
      } catch (err) {
        lastError = err;
        console.error('eNis: could not build the planet', err);
      }
    }
    this.ui.set({ loading: false, error: lastError instanceof Error ? lastError.message : String(lastError) });
  }

  // ---------------------------------------------------------------- world lifecycle

  /** Builds a planet (new, or from a save). Runs on the next frames so the loading screen can show. */
  async createWorld(spec: WorldSpec, save: SaveData | null): Promise<void> {
    this.ui.set({ loading: true, place: null, person: null, herd: null, error: null });
    this.selectedCell = null;
    this.selection = null;
    this.following = false;
    this.marker.hide();
    this.arm(null);
    // Let the loading screen paint first (a timer, not requestAnimationFrame, which some viewers pause).
    await new Promise((resolve) => setTimeout(resolve, 40));

    this.disposeWorld();
    const planet = generatePlanet(spec.seed, spec.size);
    const world = new World(planet);
    const events = sanitizeEvents(save?.events ?? [], planet.cellCount);
    if (events.length > 0) world.rebuild(events);
    this.nextEventId = events.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    this.spec = spec;
    if (save?.speedIndex !== undefined) this.clock.speedIndex = save.speedIndex === 0 ? 1 : save.speedIndex;

    // The living world: from the save, or new.
    let life: Life;
    let minutes: number;
    if (save?.life && isLifeData(save.life)) {
      life = Life.restore(save.life);
      minutes = Math.max(save.minutes, life.t);
      this.snapshots = (save.snaps ?? [])
        .filter((s) => s.eventCount <= events.length && s.t <= life.t)
        .map((s) => ({ t: s.t, eventCount: s.eventCount, periodic: s.periodic, json: JSON.stringify(s.data) }));
    } else {
      const home = Life.findHome(world);
      minutes = save ? save.minutes : morningAt(new Clock().minutes, longitudeOf(planet.positions[home * 3], planet.positions[home * 3 + 2]));
      life = Life.create(world, minutes);
      this.snapshots = [];
    }
    this.life = life;
    this.skipRun = null;
    if (life.skipping) this.cutSkips(world, life.t);
    this.info = new PeopleInfo(life, planet);
    this.seenChronicle = life.chronicle.length;
    this.lastPrayerNotice = -Infinity;
    this.clock.minutes = minutes;

    const root = new THREE.Group();
    const fxRoot = new THREE.Group();
    const terrain = new TerrainView(world, this.season);
    const overlay = new Overlay(planet.cellCount);
    const fx: FxContext = {
      root: fxRoot,
      sparks: this.sparks,
      smoke: this.smoke,
      shake: (s, t) => this.cameraCtl.shake(s, t),
      surfacePoint: (cell, out = new THREE.Vector3()) => this.surfacePoint(planet, cell, out),
      kmToUnits: (km) => kmToUnits(km, planet.radiusKm),
    };
    const trees = new TreeView(this.season);
    const rivers = buildRivers(planet);
    const lifeView = new LifeView(planet, terrain);
    const towns = new TownView(planet, terrain);
    const ocean = buildOcean(this.season, spec.size === 'large' ? 56 : spec.size === 'medium' ? 40 : 28);
    const fire = new FireView(fx);
    const flood = new FloodView(fxRoot);
    const clouds = buildClouds(planet);
    const atmosphere = buildAtmosphere();
    const sky = buildSky(spec.seed);
    root.add(terrain.mesh, rivers, trees.group, lifeView.group, towns.group, ocean, clouds, atmosphere.mesh, fxRoot);
    this.scene.add(root, sky.stars, sky.sun, sky.moon);
    this.world = { world, overlay, root, fxRoot, terrain, trees, rivers, lifeView, towns, fire, flood, clouds, sky, atmosphere, fx };

    // Look at the people (or the home they would have).
    const first = life.people.find((p) => p.alive) ?? life.people[0];
    this.focusCell = this.pickCell = first ? first.cell : Life.findHome(world);
    const start = new THREE.Vector3().fromArray(planet.positions, this.focusCell * 3);
    this.cameraCtl.lookAt(start, R * 0.55);
    this.cameraCtl.targetDistance = R * 0.55;
    this.realSunDir.copy(this.computeRealSun());
    this.sunDir.copy(this.realSunDir);
    this.refreshEverything();
    if (this.snapshots.length === 0) this.takeSnapshot(true);

    this.ui.set({
      ready: true,
      loading: false,
      planetName: planet.name,
      worldCode: encodeWorldCode(spec),
      size: spec.size,
      radiusKm: planet.radiusKm,
      speedIndex: this.clock.speedIndex,
      timelapse: this.clock.timelapse,
      eventCount: world.events.length,
      population: life.totalPopulation(),
      chronicleCount: life.chronicle.length,
    });
    this.save();
    if (!this.running) {
      this.running = true;
      this.lastFrame = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }
  }

  /** Repaints terrain, rivers, trees and effects from scratch (after loading or rewinding). */
  private refreshEverything(): void {
    if (!this.world) return;
    const { world, overlay, terrain, trees, lifeView } = this.world;
    world.computeOverlay(this.clock.minutes, overlay);
    terrain.refreshAll(overlay);
    world.changedCells.clear();
    trees.rebuild(world.planet, terrain.faceBiome, terrain.facePositions, (f) => this.faceVeg(f));
    this.rebuildRivers();
    this.treeRebuildAt = 0;
    this.applyOverlayViews(true);
    this.lastOverlayMinutes = this.clock.minutes;
    for (const view of this.ongoing.values()) view.dispose();
    this.ongoing.clear();
    lifeView.reset();
    this.world.towns.reset();
    this.bubbles.clear();
  }

  private rebuildRivers(): void {
    if (!this.world) return;
    const { root, world } = this.world;
    const old = this.world.rivers;
    const rivers = buildRivers(world.planet);
    root.remove(old);
    old.geometry.dispose();
    (old.material as THREE.Material).dispose();
    root.add(rivers);
    this.world.rivers = rivers;
  }

  // ---------------------------------------------------------------- time

  setSpeed(index: SpeedIndex): void {
    this.clock.speedIndex = index;
    this.ui.set({ speedIndex: index, timelapse: this.clock.timelapse });
  }

  togglePause(): void {
    if (this.clock.paused) this.setSpeed(this.resumeSpeed);
    else {
      this.resumeSpeed = this.clock.speedIndex;
      this.setSpeed(0);
    }
  }

  setSound(on: boolean): void {
    this.sound.setEnabled(on);
    this.ui.set({ soundOn: on });
  }

  clearSelection(): void {
    this.selectedCell = null;
    this.selection = null;
    this.following = false;
    this.marker.hide();
    this.ui.set({ place: null, person: null, herd: null, following: false });
  }

  zoomBy(factor: number): void {
    this.cameraCtl.zoom(factor);
  }

  /** The camera keeps the selected person in view until the player moves it. */
  follow(on: boolean): void {
    this.following = on && this.selection?.kind === 'person';
    if (this.following) {
      this.cameraCtl.targetDistance = Math.min(this.cameraCtl.targetDistance, 11);
      this.cameraCtl.userPanned = false;
    }
    this.ui.set({ following: this.following });
  }

  // ---------------------------------------------------------------- powers

  /** Chooses a power to aim (or null to stop). Global powers act at once. */
  arm(kind: PowerKind | null): void {
    if (kind && powerDef(kind).target === 'global') {
      this.castGlobal(kind);
      kind = null;
    }
    this.armed = kind;
    this.carryTarget = null;
    this.pairFirst = null;
    const options = kind ? POWER_OPTIONS[kind] : undefined;
    this.armedOption = options ? options[0] : null;
    this.cameraCtl.brushMode = !!kind && powerDef(kind).target === 'brush';
    if (!kind) this.aim.hide();
    this.canvas.style.cursor = kind ? 'crosshair' : '';
    const target = kind ? powerDef(kind).target : null;
    this.ui.set({ armed: kind, armedOption: this.armedOption, carryStep: target === 'carry' || target === 'pair' ? 'pick' : null });
  }

  setArmedOption(value: number): void {
    this.armedOption = value;
    this.ui.set({ armedOption: value });
  }

  private newEvent(kind: PowerKind, cell: number): PowerEvent {
    return { id: this.nextEventId++, kind, minutes: this.life?.t ?? this.clock.minutes, cell, seed: randomSeed() };
  }

  private notify(key: MessageKey, params?: Record<string, string | number>): void {
    this.ui.set({ notice: { key, params, id: ++this.noticeId } });
  }

  private play(name: SoundName, at?: THREE.Vector3): void {
    let volume = 1;
    if (at) volume = Math.max(0.2, Math.min(1, 1.35 - this.cameraCtl.camera.position.distanceTo(at) / (R * 2.4)));
    this.sound.play(name, volume);
  }

  /** Applies a power to the land and the living, at the current simulation step. */
  private commit(event: PowerEvent): EventOutcome {
    if (!this.world || !this.life) return {};
    this.takeSnapshot(false);
    event.minutes = this.life.t;
    this.world.world.apply(event);
    const outcome = this.life.applyEvent(event, this.world.world);
    this.afterEvent();
    return outcome;
  }

  private castGlobal(kind: PowerKind): void {
    if (!this.world) return;
    this.commit(this.newEvent(kind, -1));
    const focusPoint = this.surfacePoint(this.world.world.planet, this.focusCell, new THREE.Vector3());
    burst(this.world.fx, kind === 'iceAge' ? 'chill' : 'heat', focusPoint, 3);
    this.play(kind === 'iceAge' ? 'chill' : 'heat');
    this.notify(kind === 'iceAge' ? 'notice.iceAge' : 'notice.heatAge');
  }

  private onTap(clientX: number, clientY: number): void {
    if (this.skipRun) return;
    if (!this.armed) {
      const entity = this.pickEntity(clientX, clientY, () => true);
      if (entity) this.selectEntity(entity.kind, entity.id);
      else this.selectAt(clientX, clientY);
      return;
    }
    const def = powerDef(this.armed);
    if (def.target === 'point') this.castAt(clientX, clientY);
    else if (def.target === 'person' || def.target === 'dead') this.castOnPerson(clientX, clientY, def.target === 'dead');
    else if (def.target === 'carry') this.carry(clientX, clientY);
    else if (def.target === 'pair') this.pair(clientX, clientY);
  }

  private castAt(clientX: number, clientY: number): void {
    if (!this.world || !this.armed) return;
    const hit = this.pickAt(clientX, clientY);
    if (!hit) return;
    const kind = this.armed;
    const { world, fx } = this.world;
    if (powerDef(kind).catastrophe && this.clock.speedIndex >= 3) {
      this.setSpeed(1);
      this.notify('notice.slowedDown');
    }
    const event = this.newEvent(kind, hit.cell);
    if (this.armedOption !== null) event.extra = this.armedOption;

    if (kind === 'meteor') {
      this.play('whoosh', hit.point);
      const cam = this.cameraCtl.camera;
      const from = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      this.aim.hide();
      this.effects.push(
        new MeteorFx(fx, hit.point, from, cam.position.distanceTo(hit.point), () => {
          this.commit(event);
          this.play('boom', hit.point);
        }),
      );
      return;
    }

    this.commit(event);
    this.aim.hide();
    const at = this.surfacePoint(world.planet, hit.cell, new THREE.Vector3());
    switch (kind) {
      case 'lightning':
        this.effects.push(new LightningFx(fx, at));
        this.play('thunder', at);
        if (world.scars.some((s) => s.eventId === event.id)) this.play('crackle', at);
        break;
      case 'fire':
        burst(fx, 'dust', at, 1);
        this.play('crackle', at);
        break;
      case 'rain':
        this.play('rain', at);
        break;
      case 'drought':
        burst(fx, 'heat', at, 2);
        this.play('dry', at);
        break;
      case 'storm':
        this.play('wind', at);
        break;
      case 'quake': {
        this.cameraCtl.shake(1.2, 3.2);
        this.play('rumble', at);
        const rift = world.scars.find((s) => s.eventId === event.id && s.kind === 'quake');
        const cells = rift ? Array.from(rift.cells).filter((_, i) => rift.strength[i] > 0.6) : [hit.cell];
        for (let i = 0; i < Math.min(30, cells.length); i++) {
          burst(fx, 'dust', this.surfacePoint(world.planet, cells[Math.floor((i / 30) * cells.length)], new THREE.Vector3()), 1.5);
        }
        break;
      }
      case 'volcano':
        burst(fx, 'eruption', at);
        this.play('roar', at);
        break;
      case 'tsunami': {
        const wave = world.scars.find((s) => s.eventId === event.id && s.kind === 'flood');
        burst(fx, 'splash', wave ? this.surfacePoint(world.planet, wave.center, new THREE.Vector3()) : at);
        this.play('wave', at);
        break;
      }
      case 'harvest':
        // The blessing covers a wide land; seen from close by, keep the shower within view.
        burst(fx, 'gold', at, Math.min(4, Math.max(1.2, this.cameraCtl.distance / 7)));
        this.play('chime', at);
        break;
      case 'heal':
        burst(fx, 'heal', at, 2.5);
        this.play('chime', at);
        break;
      case 'plague':
        burst(fx, 'plague', at, 3);
        this.play('dry', at);
        break;
      case 'createPeople':
        burst(fx, 'spirit', at, 1);
        this.play('chime', at);
        break;
      case 'spawnAnimals':
        burst(fx, 'sparkle', at, 1);
        this.play('thud', at);
        break;
      case 'sign':
        this.effects.push(new SkySignFx(fx, at, event.extra ?? 0, this.cameraCtl.camera));
        this.play('chime', at);
        break;
      default:
        break;
    }
  }

  private castOnPerson(clientX: number, clientY: number, dead: boolean): void {
    if (!this.world || !this.life || !this.armed) return;
    const t = this.life.t;
    const entity = this.pickEntity(clientX, clientY, (e) => {
      if (e.kind !== 'person') return false;
      const p = this.life!.person(e.id);
      if (!p) return false;
      return dead ? !p.alive && p.died !== undefined && t - p.died <= REVIVE_WINDOW : p.alive;
    });
    if (!entity) {
      this.notify(dead ? 'notice.notRevivable' : 'notice.noPerson');
      return;
    }
    this.castOn(this.armed, entity.id);
  }

  /**
   * Uses a power on one person (from tapping them, or from their file).
   * Powers aimed at a place act where the person stands.
   */
  castOn(kind: PowerKind, id: number): void {
    if (!this.world || !this.life || this.skipRun) return;
    const p = this.life.person(id);
    if (!p) return;
    const def = powerDef(kind);
    if (def.target === 'pair') {
      if (!p.alive) return;
      const block = this.life.check(kind, p);
      if (block) {
        this.notify(`notice.block.${block}` as MessageKey, { name: p.name });
        return;
      }
      if (this.armed !== kind) this.arm(kind);
      this.pairFirst = p.id;
      this.selectEntity('person', p.id);
      this.ui.set({ carryStep: 'pick2' });
      return;
    }
    const at = (this.world.lifeView.shownPosition(p.id) ?? this.surfacePoint(this.world.world.planet, p.cell, new THREE.Vector3())).clone();
    if (def.target === 'point' || def.target === 'global') {
      const event = this.newEvent(kind, p.cell);
      const options = POWER_OPTIONS[kind];
      if (options) event.extra = this.armed === kind && this.armedOption !== null ? this.armedOption : options[0];
      this.commit(event);
      if (kind === 'sign') this.effects.push(new SkySignFx(this.world.fx, at, event.extra ?? 0, this.cameraCtl.camera));
      else burst(this.world.fx, kind === 'harvest' ? 'gold' : kind === 'plague' ? 'plague' : 'heal', at, 1.5);
      this.play(kind === 'plague' ? 'dry' : 'chime', at);
      return;
    }
    if (def.target === 'dead' ? p.alive : !p.alive) return;
    const block = this.life.check(kind, p);
    if (block) {
      this.notify(`notice.block.${block}` as MessageKey, { name: p.name });
      return;
    }
    const event = this.newEvent(kind, p.cell);
    event.target = p.id;
    const outcome = this.commit(event);
    this.afterPersonPower(kind, p.name, at, outcome);
    this.selectEntity('person', p.id);
  }

  /** Effects and messages after a power aimed at a person. */
  private afterPersonPower(kind: PowerKind, name: string, at: THREE.Vector3, outcome: EventOutcome): void {
    if (!this.world) return;
    const fx = this.world.fx;
    if (kind === 'revive') {
      burst(fx, 'spirit', at, 2);
      this.play('chime', at);
    } else if (kind === 'smite') {
      burst(fx, 'heal', at, 0.6);
      this.play('chill', at);
    } else if (kind === 'luck') {
      burst(fx, 'gold', at, 0.5);
      this.play('chime', at);
      this.notify('notice.luck', { name });
    } else if (kind === 'fertility') {
      burst(fx, 'heal', at, 0.6);
      this.play('chime', at);
      this.notify('notice.fertility', { name });
    } else if (powerDef(kind).category === 'whisper') {
      // Whispers are invisible to the people; you see a faint shimmer.
      burst(fx, 'whisper', at, 0.5);
      if (outcome.result === 'accepted') this.notify(`notice.whisper.${kind}` as MessageKey, { name, ...(outcome.invention ? { invention: outcome.invention } : {}) });
      else if (outcome.result === 'noPlace') this.notify('notice.whisper.noPlace', { name });
      else this.notify('notice.whisper.resisted', { name });
    }
  }

  /** Whispered love: first the one who loves, then the one to be loved. */
  private pair(clientX: number, clientY: number): void {
    if (!this.world || !this.life || !this.armed) return;
    const entity = this.pickEntity(clientX, clientY, (e) => e.kind === 'person' && !!this.life!.person(e.id)?.alive);
    if (!entity) {
      this.notify('notice.noPerson');
      return;
    }
    if (this.pairFirst === null) {
      this.castOn(this.armed, entity.id);
      return;
    }
    const lover = this.life.person(this.pairFirst);
    const beloved = this.life.person(entity.id);
    if (!lover?.alive || !beloved?.alive) return;
    const block = this.life.check(this.armed, lover, beloved);
    if (block) {
      this.notify(`notice.block.${block}` as MessageKey, { name: lover.name });
      return;
    }
    const event = this.newEvent(this.armed, lover.cell);
    event.target = lover.id;
    event.other = beloved.id;
    const at = (this.world.lifeView.shownPosition(lover.id) ?? entity.pos).clone();
    const outcome = this.commit(event);
    burst(this.world.fx, 'whisper', at, 0.5);
    burst(this.world.fx, 'whisper', entity.pos.clone(), 0.4);
    if (outcome.result === 'accepted') this.notify('notice.whisper.wLove', { name: lover.name, other: beloved.name });
    else this.notify('notice.whisper.resisted', { name: lover.name });
    this.pairFirst = null;
    this.selectEntity('person', lover.id);
    this.ui.set({ carryStep: 'pick' });
  }

  private carry(clientX: number, clientY: number): void {
    if (!this.world || !this.life) return;
    if (this.carryTarget === null) {
      const entity = this.pickEntity(clientX, clientY, (e) => e.kind === 'person' && !!this.life!.person(e.id)?.alive);
      if (!entity) {
        this.notify('notice.noPerson');
        return;
      }
      this.carryTarget = entity.id;
      this.selectEntity('person', entity.id);
      this.ui.set({ carryStep: 'place' });
      return;
    }
    const hit = this.pickAt(clientX, clientY);
    if (!hit) return;
    const person = this.life.person(this.carryTarget);
    const from = person ? this.world.lifeView.shownPosition(person.id)?.clone() : undefined;
    const event = this.newEvent('move', hit.cell);
    event.target = this.carryTarget;
    this.commit(event);
    if (from) burst(this.world.fx, 'spirit', from, 1);
    burst(this.world.fx, 'spirit', hit.point, 1);
    this.play('chime', hit.point);
    this.carryTarget = null;
    this.ui.set({ carryStep: 'pick' });
  }

  private onBrush(phase: 'start' | 'move' | 'end', clientX: number, clientY: number): void {
    if (!this.world || !this.armed || this.skipRun) return;
    const { world, fx } = this.world;
    if (phase === 'end') {
      if (this.stroke) {
        this.stroke = null;
        this.treeRebuildAt = performance.now();
        this.ui.set({ eventCount: world.events.length });
        this.save();
      }
      return;
    }
    const now = performance.now();
    if (phase === 'move' && this.stroke && now - this.stroke.lastTime < 16) return;
    const hit = this.pickAt(clientX, clientY);
    if (!hit) return;
    const def = powerDef(this.armed);
    const planet = world.planet;
    this.aim.show(hit.point, kmToUnits(def.aimKm, planet.radiusKm));
    if (!this.stroke) {
      // Time stands still while you shape the land (so replays see the same land).
      const event = this.newEvent(this.armed, hit.cell);
      event.stamps = [];
      this.commit(event);
      this.stroke = { event, lastCell: -1, lastTime: 0 };
    }
    const s = this.stroke;
    s.lastTime = now;
    const spacing = def.aimKm * 0.45;
    // Stamp evenly along the drag, even when the pointer moves fast.
    const targets: number[] = [];
    if (s.lastCell < 0) targets.push(hit.cell);
    else {
      const dist = world.kmBetween(s.lastCell, hit.cell);
      const steps = Math.min(40, Math.floor(dist / spacing));
      const a = new THREE.Vector3().fromArray(planet.positions, s.lastCell * 3);
      const b = new THREE.Vector3().fromArray(planet.positions, hit.cell * 3);
      let cell = s.lastCell;
      for (let k = 1; k <= steps; k++) {
        const v = a.clone().lerp(b, (k * spacing) / dist).normalize();
        cell = nearestCell(planet, v.x, v.y, v.z, cell);
        targets.push(cell);
      }
    }
    if (targets.length === 0) return;
    for (const cell of targets) world.addStamp(s.event, cell);
    s.lastCell = targets[targets.length - 1];
    this.afterBrushStamp();
    const under = planet.heightM[hit.cell] < 0;
    burst(fx, this.armed === 'forest' ? 'sparkle' : under ? 'splash' : 'dust', hit.point, this.armed === 'forest' ? 1 : under ? 0.3 : 2);
    this.play(this.armed === 'forest' ? 'chime' : 'thud', hit.point);
  }

  private onHover(clientX: number, clientY: number): void {
    if (!this.world || !this.armed) return;
    const def = powerDef(this.armed);
    if (def.aimKm <= 0 && !(def.target === 'carry' && this.carryTarget !== null)) return;
    const now = performance.now();
    if (now - this.lastHover < 40) return;
    this.lastHover = now;
    const hit = this.pickAt(clientX, clientY);
    if (!hit) {
      this.aim.hide();
      return;
    }
    this.aim.show(hit.point, kmToUnits(Math.max(def.aimKm, 30), this.world.world.planet.radiusKm));
  }

  /** After an event changed the world: repaint what changed and remember it. */
  private afterEvent(): void {
    if (!this.world || !this.life) return;
    const { world, overlay, terrain } = this.world;
    world.computeOverlay(this.clock.minutes, overlay);
    if (world.changedCells.size > 0) {
      terrain.refreshCells(world.changedCells, overlay);
      world.changedCells.clear();
      this.treeRebuildAt = performance.now();
    }
    this.applyOverlayViews(false);
    this.lastOverlayMinutes = this.clock.minutes;
    this.ui.set({ eventCount: world.events.length, population: this.life.totalPopulation() });
    this.save();
  }

  private afterBrushStamp(): void {
    if (!this.world) return;
    const { world, overlay, terrain } = this.world;
    if (world.changedCells.size > 0) {
      terrain.refreshCells(world.changedCells, overlay);
      world.changedCells.clear();
      this.treeRebuildAt = performance.now() + 350;
    }
  }

  private faceVeg(f: number): number {
    if (!this.world) return 1;
    const { overlay } = this.world;
    const faces = this.world.world.planet.faces;
    return (overlay.veg[faces[f * 3]] + overlay.veg[faces[f * 3 + 1]] + overlay.veg[faces[f * 3 + 2]]) / 3;
  }

  /** Pushes the overlay to terrain colors, trees, flames and flood water. */
  private applyOverlayViews(full: boolean): void {
    if (!this.world) return;
    const { overlay, terrain, trees, fire, flood, world } = this.world;
    terrain.applyOverlay(overlay);
    trees.updateFaces(terrain.facesOf(overlay.changed), (f) => this.faceVeg(f));
    const burning: number[] = [];
    const wetCells: number[] = [];
    for (const c of overlay.touched) {
      if (overlay.burning[c]) burning.push(c);
      if (overlay.water[c] > 0.02) wetCells.push(c);
    }
    fire.setBurning(burning);
    const faces = world.planet.faces;
    const waterOf = (f: number) => Math.max(overlay.water[faces[f * 3]], overlay.water[faces[f * 3 + 1]], overlay.water[faces[f * 3 + 2]]);
    const floodFaces = terrain.facesOf(wetCells).filter((f) => terrain.faceBiome[f] > Biome.ShallowSea && waterOf(f) > 0.02);
    if (floodFaces.length > 0 || full || this.hadFlood) flood.update(terrain.facePositions, floodFaces, waterOf);
    this.hadFlood = floodFaces.length > 0;
  }
  private hadFlood = false;

  // ---------------------------------------------------------------- snapshots and rewinding

  private takeSnapshot(periodic: boolean): void {
    if (!this.world || !this.life) return;
    const t = this.life.t;
    const eventCount = this.world.world.events.length;
    const last = this.snapshots[this.snapshots.length - 1];
    if (last && last.t === t && last.eventCount === eventCount) return;
    this.snapshots.push({ t, eventCount, json: this.life.snapshotJson(), periodic });
    this.pruneSnapshots();
  }

  /** Keeps many recent snapshots and fewer old ones (one per year, then one per decade). */
  private pruneSnapshots(): void {
    if (!this.life) return;
    const now = this.life.t;
    const out: MemSnapshot[] = [];
    let lastYear = -1;
    let lastDecade = -1;
    for (const s of this.snapshots) {
      const age = now - s.t;
      if (!s.periodic || age <= 25 * DAY) {
        out.push(s);
        continue;
      }
      const year = Math.floor(s.t / YEAR);
      if (age <= 40 * YEAR) {
        if (year !== lastYear) {
          out.push(s);
          lastYear = year;
        }
        continue;
      }
      const decade = Math.floor(year / 10);
      if (decade !== lastDecade) {
        out.push(s);
        lastDecade = decade;
      }
    }
    // At most 60 snapshots taken before powers.
    const powerSnaps = out.filter((s) => !s.periodic);
    const drop = new Set(powerSnaps.slice(0, Math.max(0, powerSnaps.length - 60)));
    this.snapshots = out.filter((s) => !drop.has(s));
  }

  private findSnapshot(p: { minutes: number; eventCount: number }): MemSnapshot | null {
    let best: MemSnapshot | null = null;
    for (const s of this.snapshots) {
      if (s.t <= p.minutes && s.eventCount <= p.eventCount && (!best || s.t >= best.t)) best = s;
    }
    return best;
  }

  /** Points in time to rewind to: before each power used, and every 10 years. */
  rewindPoints(): RewindPoint[] {
    if (!this.world) return [];
    const events = this.world.world.events;
    const now = this.clock.minutes;
    const points: RewindPoint[] = events.map((e, i) => ({ minutes: e.minutes, eventCount: i, kind: e.kind }));
    for (let year = 10; (year - 1) * MINUTES_PER_YEAR <= now; year += 10) {
      const m = (year - 1) * MINUTES_PER_YEAR;
      points.push({ minutes: m, eventCount: events.filter((e) => e.minutes < m).length, kind: null });
    }
    return points
      .filter((p) => this.findSnapshot(p) !== null)
      .sort((a, b) => b.minutes - a.minutes || b.eventCount - a.eventCount)
      .slice(0, 40);
  }

  rewindTo(point: RewindPoint): void {
    if (!this.world || !this.life || this.skipRun) return;
    const snap = this.findSnapshot(point);
    if (!snap) return;
    for (const e of this.effects) e.dispose();
    this.effects = [];
    this.sparks.clear();
    this.smoke.clear();
    this.stroke = null;
    const { world } = this.world;
    const kept = world.events.slice(0, point.eventCount).map((e) => ({ ...e, stamps: e.stamps ? [...e.stamps] : undefined }));
    // Back to the snapshot, then replay the powers used after it.
    world.rebuild(kept.slice(0, snap.eventCount));
    const life = Life.restore(snap.json, { archive: this.life.archive, chronicle: this.life.chronicle, history: this.life.civ.history });
    for (let i = snap.eventCount; i < kept.length; i++) {
      const e = kept[i];
      life.advanceTo(e.minutes, world);
      world.apply(e);
      life.applyEvent(e, world);
    }
    life.advanceTo(point.minutes, world);
    this.life = life;
    // A time skip that was running at that point ends there.
    this.cutSkips(world, point.minutes);
    this.info = new PeopleInfo(life, world.planet);
    this.seenChronicle = life.chronicle.length;
    this.lastPrayerNotice = -Infinity;
    this.snapshots = this.snapshots.filter((s) => s.t <= point.minutes && s.eventCount <= point.eventCount);
    this.nextEventId = kept.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    this.clock.minutes = Math.max(point.minutes, life.t);
    if (this.selection?.kind === 'herd' && !life.herd(this.selection.id)) this.clearSelection();
    if (this.selection?.kind === 'person' && !life.anyone(this.selection.id)) this.clearSelection();
    this.refreshEverything();
    if (this.selectedCell !== null) this.ui.set({ place: this.placeInfo(this.world.world.planet, this.selectedCell) });
    this.ui.set({ eventCount: kept.length, date: dateFromMinutes(this.clock.minutes), population: life.totalPopulation(), chronicleCount: life.chronicle.length });
    this.save();
    this.play('chill');
    this.notify('notice.rewound');
  }

  // ---------------------------------------------------------------- time skip

  /** Jumps years ahead: the living world is computed in larger steps, without waiting for the clock. */
  timeSkip(years: number): void {
    if (!this.world || !this.life || this.skipRun) return;
    this.arm(null);
    this.following = false;
    const life = this.life;
    const event = this.newEvent('timeSkip', -1);
    event.extra = Math.round(years * MINUTES_PER_YEAR);
    const pop = life.totalPopulation();
    const births = life.births;
    const deaths = life.deaths;
    const chronicle = life.chronicle.length;
    this.commit(event);
    this.skipRun = { eventId: event.id, from: life.t, to: life.t + event.extra, pop, births, deaths, chronicle, stop: false };
    this.ui.set({ skip: { years, done: 0, year: dateFromMinutes(life.t).year }, skipSummary: null, following: false });
  }

  stopSkip(): void {
    if (this.skipRun) this.skipRun.stop = true;
  }

  closeSkipSummary(): void {
    this.ui.set({ skipSummary: null });
  }

  /** A slice of the time skip per frame, with a snapshot at every decade mark (for rewinding). */
  private runSkip(now: number): void {
    const run = this.skipRun!;
    const life = this.life!;
    const world = this.world!.world;
    // Most of each frame goes to the simulation; the picture updates a few times a second.
    const until = performance.now() + 45;
    while (performance.now() < until && life.t < run.to && !run.stop) {
      const year = life.t / MINUTES_PER_YEAR;
      const mark = (Math.floor((year + 1) / 10) * 10 + 9) * MINUTES_PER_YEAR;
      const target = Math.min(run.to, mark);
      life.advanceTo(target, world, 300);
      if (life.t === mark) this.takeSnapshot(true);
      if (life.population() === 0) run.stop = true;
    }
    this.clock.minutes = Math.max(this.clock.minutes, life.t);
    if (life.t >= run.to || run.stop) {
      this.finishSkip();
      return;
    }
    if (now - this.lastSkipUi > 150) {
      this.lastSkipUi = now;
      const years = (run.to - run.from) / MINUTES_PER_YEAR;
      this.ui.set({
        skip: { years, done: (life.t - run.from) / (run.to - run.from), year: dateFromMinutes(life.t).year },
        population: life.totalPopulation(),
        date: dateFromMinutes(life.t),
      });
    }
  }

  private finishSkip(): void {
    const run = this.skipRun;
    if (!run || !this.world || !this.life) return;
    this.skipRun = null;
    const life = this.life;
    const { world } = this.world;
    if (life.t < run.to) this.cutSkips(world, life.t);
    this.clock.minutes = life.t;
    this.takeSnapshot(true);
    const lines: ChronicleLine[] = [];
    if (this.info) {
      for (let i = life.chronicle.length - 1; i >= run.chronicle && lines.length < 12; i--) {
        const e = life.chronicle[i];
        if (e.major || e.key === 'invention' || e.key === 'species') lines.push(this.info.chronicleLine(e, i));
      }
    }
    const summary: SkipSummary = {
      years: Math.round((life.t - run.from) / MINUTES_PER_YEAR),
      popBefore: run.pop,
      popAfter: life.totalPopulation(),
      births: life.births - run.births,
      deaths: life.deaths - run.deaths,
      lines,
      stopped: life.t < run.to,
    };
    this.seenChronicle = life.chronicle.length;
    this.lastPrayerNotice = -Infinity;
    this.refreshEverything();
    this.ui.set({
      skip: null,
      skipSummary: summary,
      population: life.totalPopulation(),
      date: dateFromMinutes(life.t),
      chronicleCount: life.chronicle.length,
    });
    this.save();
    this.play('chime');
  }

  /** Time skips end at `t` (stopped early, rewound into, or reloaded during one). */
  private cutSkips(world: World, t: number): void {
    for (const e of world.events) {
      if (e.kind === 'timeSkip' && e.minutes + (e.extra ?? 0) > t) e.extra = Math.max(0, t - e.minutes);
    }
    this.life?.endSkip();
  }

  // ---------------------------------------------------------------- selection

  /** Opens someone's file: a living person on the planet, or someone from the archive. */
  selectPerson(id: number): void {
    if (!this.life?.anyone(id)) return;
    if (this.life.person(id)) {
      this.selectEntity('person', id);
      return;
    }
    this.selectedCell = null;
    this.selection = { kind: 'person', id };
    this.following = false;
    this.marker.hide();
    this.pushUi();
  }

  familyTree(id: number): FamilyTree | null {
    return this.info?.familyTree(id) ?? null;
  }

  chronicleLines(limit?: number): ChronicleLine[] {
    return this.info?.chronicle(limit) ?? [];
  }

  knowledge(): KnowledgeInfo[] {
    return this.info?.knowledge() ?? [];
  }

  speciesList(): SpeciesInfo[] {
    return this.info?.species() ?? [];
  }

  /** Turns the view to a place on the planet (a holy place, a praying group). */
  showCell(cell: number): void {
    if (!this.world) return;
    const p = new THREE.Vector3().fromArray(this.world.world.planet.positions, cell * 3);
    this.cameraCtl.lookAt(p, Math.min(this.cameraCtl.targetDistance, R * 0.35));
  }

  civTech(): CivTechInfo[] {
    return this.info?.civTech() ?? [];
  }

  stats(): StatsInfo {
    return this.info?.stats() ?? { fields: [], rows: [] };
  }

  peoples(): PeoplesInfo {
    return this.info?.peoples() ?? { tribes: [], wars: [] };
  }

  faithInfo(): FaithInfo {
    return this.info?.faith() ?? { image: 'distant', good: 0, bad: 0, believers: 0, population: 0, religions: [], prayers: [] };
  }

  /** A group prays to you: tell the player now and then, so they can answer. */
  private announcePrayers(life: Life): void {
    for (const b of life.bands) {
      const p = b.prayer;
      if (!p || this.seenPrayers.get(b.id) === p.t) continue;
      this.seenPrayers.set(b.id, p.t);
      if (life.t - p.t > DAY || life.t - this.lastPrayerNotice < 6 * DAY) continue;
      this.lastPrayerNotice = life.t;
      const leader = life.person(b.leader);
      this.notify(`notice.prayer.${p.need}` as MessageKey, { name: leader?.name ?? '?' });
    }
  }

  /** New lines in the chronicle; important ones pop up as a message. */
  private announceChronicle(life: Life): void {
    const all = life.chronicle;
    if (all.length === this.seenChronicle) return;
    for (let i = this.seenChronicle; i < all.length; i++) {
      const e = all[i];
      const followed = this.selection?.kind === 'person' && e.key === 'death' && e.a === this.selection.id;
      if (!followed && !(e.major && NEWSWORTHY.has(e.key)) && !(e.key === 'extinct')) continue;
      if (this.info) this.ui.set({ notice: { id: ++this.noticeId, line: this.info.chronicleLine(e, i) } });
    }
    this.seenChronicle = all.length;
    this.ui.set({ chronicleCount: all.length });
  }

  private selectEntity(kind: 'person' | 'herd', id: number): void {
    this.selectedCell = null;
    this.selection = { kind, id };
    if (this.following && kind !== 'person') this.following = false;
    this.centering = this.narrow() ? 0.9 : 0;
    this.pushUi();
  }

  /** The person or herd drawn closest to a screen point (within a finger's width). */
  private pickEntity(clientX: number, clientY: number, accept: (e: { kind: 'person' | 'herd'; id: number }) => boolean): { kind: 'person' | 'herd'; id: number; pos: THREE.Vector3 } | null {
    if (!this.world) return null;
    const rect = this.canvas.getBoundingClientRect();
    const cam = this.cameraCtl.camera;
    const v = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    let best: { kind: 'person' | 'herd'; id: number; pos: THREE.Vector3 } | null = null;
    let bestScore = 38;
    for (const e of this.world.lifeView.tappable) {
      if (!accept(e)) continue;
      toCam.subVectors(cam.position, e.pos);
      if (toCam.dot(v.copy(e.pos).normalize()) < -0.2 * toCam.length()) continue;
      v.copy(e.pos).addScaledVector(e.pos.clone().normalize(), 0.15).project(cam);
      if (v.z > 1) continue;
      const x = rect.left + ((v.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - v.y) / 2) * rect.height;
      const score = Math.hypot(x - clientX, y - clientY) - (e.kind === 'person' ? 10 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { kind: e.kind, id: e.id, pos: e.pos };
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- internals

  private surfacePoint(planet: PlanetData, cell: number, out: THREE.Vector3): THREE.Vector3 {
    const r = Math.max(R, radiusForHeight(planet.heightM[cell]));
    return out.fromArray(planet.positions, cell * 3).multiplyScalar(r);
  }

  private surfaceRadius(dir: THREE.Vector3): number {
    if (!this.world) return R;
    const planet = this.world.world.planet;
    this.focusCell = nearestCell(planet, dir.x, dir.y, dir.z, this.focusCell);
    return walkableRadius(planet, this.focusCell);
  }

  private computeRealSun(): THREE.Vector3 {
    const dec = sunDeclination(this.clock.yearFraction());
    const lon = sunLongitude(this.clock.dayFraction());
    return new THREE.Vector3(Math.cos(dec) * Math.cos(lon), Math.sin(dec), -Math.cos(dec) * Math.sin(lon));
  }

  /** In timelapse the light comes from over the viewer's shoulder, so the view stays lit. */
  private computeTimelapseSun(): THREE.Vector3 {
    const cam = this.cameraCtl.camera;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const back = cam.position.clone().normalize();
    return back.multiplyScalar(0.85).addScaledVector(right, -0.45).addScaledVector(up, 0.5).normalize();
  }

  private frame(now: number): void {
    if (!this.running) return;
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (!this.world || !this.life) return;
    const { world, overlay, sky, atmosphere, clouds, trees, terrain, fire, lifeView } = this.world;
    const life = this.life;

    if (this.skipRun) {
      this.runSkip(now);
    } else {
      // Time: the clock moves (not while shaping the land), the living world follows step by step.
      if (!this.stroke) this.clock.advance(dt);
      life.advanceTo(this.clock.minutes, world, MAX_TICKS_PER_FRAME);
      if (this.clock.minutes - life.t > TICK * 3) this.clock.minutes = life.t + TICK;
      if (life.t - (this.snapshots[this.snapshots.length - 1]?.t ?? -Infinity) >= 2 * DAY && now - this.lastSnapshotReal > 1200) {
        this.lastSnapshotReal = now;
        this.takeSnapshot(true);
      }
      this.announceChronicle(life);
      this.announcePrayers(life);
    }

    const t = this.clock.minutes;
    const yf = this.clock.yearFraction();
    this.season.uSeason.value = seasonSignal(yf);
    this.season.uSeasonCos.value = Math.cos(2 * Math.PI * (yf - 0.125));
    this.season.uTime.value = now / 1000;
    this.season.uGlobalTemp.value = world.globalTemperature(t);
    const dust = world.dust(t);

    // Effects of the powers: refresh a few times per second while time moves.
    if (world.scars.length > 0 && t !== this.lastOverlayMinutes && (Math.abs(t - this.lastOverlayMinutes) > 20 || now - this.lastOverlayReal > 250)) {
      world.computeOverlay(t, overlay);
      this.applyOverlayViews(false);
      this.lastOverlayMinutes = t;
      this.lastOverlayReal = now;
    }
    if (this.treeRebuildAt > 0 && now >= this.treeRebuildAt && !this.stroke) {
      this.treeRebuildAt = 0;
      trees.rebuild(world.planet, terrain.faceBiome, terrain.facePositions, (f) => this.faceVeg(f));
      this.rebuildRivers();
    }
    this.syncOngoing(dt, t, now / 1000);
    this.effects = this.effects.filter((e) => {
      const alive = e.update(dt);
      if (!alive) e.dispose();
      return alive;
    });
    this.sparks.update(dt);
    this.smoke.update(dt);
    fire.update(dt);

    // Following a person.
    if (this.following && this.selection?.kind === 'person') {
      if (this.cameraCtl.userPanned) {
        this.following = false;
        this.ui.set({ following: false });
      } else {
        const pos = lifeView.shownPosition(this.selection.id);
        if (pos) this.cameraCtl.moveFocusToward(pos, 1 - Math.exp(-dt * 4));
      }
    }
    // Phones: the panel covers the lower half, so lift the picture and glide onto what was tapped.
    const sheet = this.selection !== null || this.selectedCell !== null;
    this.cameraCtl.viewShiftTarget = sheet && this.narrow() ? 0.25 : 0;
    if (this.centering > 0) {
      this.centering = this.cameraCtl.userPanned || !sheet ? 0 : this.centering - dt;
      const target =
        this.selection !== null
          ? lifeView.shownPosition(this.selection.id)
          : this.selectedCell !== null
            ? this.world.fx.surfacePoint(this.selectedCell)
            : null;
      if (target && !this.following) this.cameraCtl.moveFocusToward(target, 1 - Math.exp(-dt * 6));
    }
    this.cameraCtl.userPanned = false;
    this.cameraCtl.update(dt);
    const cam = this.cameraCtl.camera;
    cam.updateMatrixWorld();

    lifeView.update(dt, life, now / 1000, t, cam, this.cameraCtl.distance, this.cameraCtl.focus);
    this.world.towns.update(life, this.cameraCtl.distance < 70, this.cameraCtl.distance, this.realSunDir, t, now);
    this.updateMarkerAndBubbles();

    // Sun: real position, or a steady light in timelapse (days would flicker). Dust dims it.
    this.realSunDir.copy(this.computeRealSun());
    const wanted = this.clock.timelapse ? this.computeTimelapseSun() : this.realSunDir;
    const blend = 1 - Math.exp(-dt * (this.clock.timelapse ? 3 : 4));
    this.sunDir.lerp(wanted, blend).normalize();
    this.sunLight.position.copy(this.sunDir).multiplyScalar(R * 4);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.intensity = 3.1 * (1 - 0.6 * dust);
    this.sunLight.color.setHex(0xfff4e6).lerp(DUST_SKY_COLOR, dust * 0.5);

    const starAngle = this.clock.timelapse ? sky.stars.rotation.y : sunLongitude(this.clock.dayFraction());
    sky.update(this.sunDir, starAngle, t / MINUTES_PER_DAY);
    atmosphere.uniforms.uSunDir.value.copy(this.sunDir);
    const camR = cam.position.length();
    atmosphere.uniforms.uFade.value = THREE.MathUtils.smoothstep(camR, R * 1.12, R * 1.5) * (1 - dust * 0.5);

    // Near the ground the sky turns blue by day, with haze toward the horizon.
    const low = 1 - THREE.MathUtils.smoothstep(camR, R * 1.04, R * 1.3);
    const sunHeight = this.cameraCtl.focus.dot(this.sunDir);
    const day = THREE.MathUtils.smoothstep(sunHeight, -0.12, 0.25);
    const dusk = THREE.MathUtils.smoothstep(sunHeight, -0.3, -0.05) * (1 - day);
    this.skyColor.copy(SPACE_COLOR).lerp(DUSK_SKY_COLOR, low * dusk).lerp(DAY_SKY_COLOR, low * day).lerp(DUST_SKY_COLOR, low * day * dust * 0.8);
    (sky.stars.material as THREE.PointsMaterial).opacity = 1 - low * day * 0.95;
    // A little moonlight close to the ground, so people stay visible at night.
    this.ambient.intensity = 0.32 + 0.45 * low * (1 - day);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.skyColor);
    if (low > 0.01) {
      const d = this.cameraCtl.distance;
      fog.near = d * 2.2 * (1 - dust * 0.5);
      fog.far = d * 2.2 + (d * 30 * (1 - dust * 0.6)) / Math.max(0.15, low);
    } else {
      fog.near = 1e5;
      fog.far = 2e5;
    }

    // Clouds drift; capped so they do not spin wildly in timelapse.
    this.cloudAngle += dt * Math.min(this.clock.speed, 10) * 0.0035;
    clouds.rotation.y = this.cloudAngle;
    clouds.rotation.z = Math.sin(this.cloudAngle * 0.37) * 0.05;

    trees.group.visible = this.cameraCtl.distance < R * 1.6;
    this.marker.update(dt, this.cameraCtl.distance);

    this.renderer.render(this.scene, cam);

    if (now - this.lastUiPush > 200) {
      this.lastUiPush = now;
      this.pushUi();
    }
    if (now - this.lastSave > 10000) {
      this.lastSave = now;
      this.save();
    }
  }

  private updateMarkerAndBubbles(): void {
    if (!this.world || !this.life) return;
    const { lifeView } = this.world;
    const items: BubbleItem[] = [];
    const selectedId = this.selection?.id;
    for (const e of lifeView.tappable) {
      if (e.kind !== 'person') continue;
      const p = this.life.person(e.id);
      if (!p) continue;
      const selected = this.selection?.kind === 'person' && selectedId === p.id;
      items.push({ id: p.id, pos: e.pos, symbol: bubbleSymbol(p, this.life.t), label: selected ? p.name : undefined, selected });
    }
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.bubbles.update(items, this.cameraCtl.camera, w, h, this.cameraCtl.distance);
    if (this.selection) {
      const pos = lifeView.shownPosition(this.selection.id);
      if (pos) this.marker.moveTo(pos);
      else this.marker.hide();
    }
  }

  /** Keeps rain clouds, storms, waves and eruptions on screen while their scars are active. */
  private syncOngoing(dt: number, t: number, seconds: number): void {
    if (!this.world) return;
    const { world, fx } = this.world;
    const visible = world.visibleScars(t);
    const keep = new Set<number>();
    for (const scar of visible) {
      keep.add(scar.id);
      let view = this.ongoing.get(scar.id);
      if (!view) {
        const center = this.surfacePoint(world.planet, scar.center, new THREE.Vector3());
        const units = kmToUnits(scar.radiusKm, world.planet.radiusKm);
        if (scar.kind === 'rain') view = new RainView(fx, center, units, scar.active);
        else if (scar.kind === 'storm' && scar.path && scar.speedKmPerMin) view = new StormView(fx, scar.path, units, scar.speedKmPerMin, world.stormDuration(scar));
        else if (scar.kind === 'flood' && scar.speedKmPerMin) view = new WaveView(fx, center, scar.radiusKm, scar.speedKmPerMin, world.planet.radiusKm);
        else if (scar.kind === 'eruption') view = new EruptionView(fx, center, scar.active);
        if (!view) continue;
        this.ongoing.set(scar.id, view);
      }
      view.update(this.clock.paused ? 0 : dt, t - scar.start, seconds);
    }
    for (const [id, view] of this.ongoing) {
      if (!keep.has(id)) {
        view.dispose();
        this.ongoing.delete(id);
      }
    }
  }

  /** The age the most advanced people live in. */
  private epochNow(): Epoch {
    if (!this.life || this.life.population() === 0) return 'none';
    const tech = this.life.tribes.living().reduce((m, tr) => m | (tr.tech ?? 0), 0);
    if (tech & CIV_BIT.writing) return 'civilization';
    if (tech & CIV_BIT.farming) return 'neolithic';
    const k = this.life.worldKnows();
    return k & BIT.bow && k & BIT.fishing ? 'mesolithic' : 'paleolithic';
  }

  private pushUi(): void {
    if (!this.world || !this.life) return;
    const { world } = this.world;
    const f = this.cameraCtl.focus;
    const lon = longitudeOf(f.x, f.z);
    const sunLon = sunLongitude(this.clock.dayFraction());
    const t = this.clock.minutes;
    const patch: Partial<UiState> = {
      date: dateFromMinutes(t),
      focusHours: localSolarHours(lon, sunLon),
      focusDaylight: f.dot(this.realSunDir) > -0.05,
      climate: { kind: world.climateLabel(t), temperature: world.globalTemperature(t), dust: world.dust(t) },
      population: this.life.totalPopulation(),
      epoch: this.epochNow(),
    };
    if (this.selectedCell !== null) patch.place = this.placeInfo(world.planet, this.selectedCell);
    if (this.selection?.kind === 'person') {
      const p = this.life.anyone(this.selection.id);
      patch.person = p && this.info ? this.info.person(p) : null;
      patch.herd = null;
      patch.place = null;
    } else if (this.selection?.kind === 'herd') {
      const h = this.life.herd(this.selection.id);
      patch.herd = h
        ? {
            id: h.id,
            species: h.species,
            prefix: this.life.speciesRecord(h.kind)?.prefix ?? '',
            genes: [h.genes[0], h.genes[1], h.genes[2]],
            count: h.count,
            activity: h.species === 'wolf' ? (h.prey >= 0 && h.hunger > 0.3 ? 'hunting' : 'roaming') : h.hunger > 0.7 ? 'hungry' : h.next >= 0 ? 'moving' : 'grazing',
            biome: world.planet.biome[h.cell] as Biome,
          }
        : null;
      if (!h) this.selection = null;
      patch.person = null;
      patch.place = null;
    } else {
      patch.person = null;
      patch.herd = null;
    }
    this.ui.set(patch);
  }

  private placeInfo(planet: PlanetData, cell: number): PlaceInfo {
    const world = this.world!.world;
    const t = this.clock.minutes;
    const x = planet.positions[cell * 3];
    const y = planet.positions[cell * 3 + 1];
    const z = planet.positions[cell * 3 + 2];
    const lat = latitudeOf(y);
    const lon = longitudeOf(x, z);
    const hours = localSolarHours(lon, sunLongitude(this.clock.dayFraction()));
    const season = seasonSignal(this.clock.yearFraction());
    const global = world.globalTemperature(t);
    const tNow = currentTemperature(planet, cell, season, hours) + global;
    const water = isWater(planet.biome[cell]);
    const seasonalMean = planet.temperature[cell] + planet.seasonAmplitude[cell] * Math.max(-1, Math.min(1, y * 8)) * season + global;
    const st = world.cellState(cell, t);
    const conditions: PlaceCondition[] = [];
    if (st.burning) conditions.push('burning');
    else if (st.burnt) conditions.push('burnt');
    if (st.lavaHeat > 0.05) conditions.push('lava');
    else if (st.lavaRock) conditions.push('lavaRock');
    if (st.water > 0.02) conditions.push('flooded');
    if (st.raining) conditions.push('raining');
    if (st.dry > 0.2) conditions.push('drought');
    if (st.ash > 0.2) conditions.push('ash');
    if (st.veg < 0.6 && !st.burnt && !st.burning && !st.lavaRock && st.lavaHeat <= 0.05) conditions.push('damaged');
    if (world.isPlanted(cell)) conditions.push('planted');
    if (st.bounty > 0.1) conditions.push('blessed');
    if (st.plague) conditions.push('plague');
    return {
      cell,
      biome: planet.biome[cell] as Biome,
      latitude: lat,
      longitude: lon,
      heightM: planet.heightM[cell],
      meanTemperature: planet.temperature[cell] + global,
      temperatureNow: tNow,
      moisture: planet.moisture[cell],
      localHours: hours,
      daylight: new THREE.Vector3(x, y, z).dot(this.realSunDir) > -0.05,
      frozen: water ? seasonalMean < -3.5 : seasonalMean < -1 && planet.biome[cell] !== Biome.Ice,
      conditions,
      fresh: planet.fresh[cell],
      food: this.life ? this.life.foodAt(world, cell, this.life.t) : 0,
      settlement: this.info?.settlementNear(cell) ?? null,
    };
  }

  private pickAt(clientX: number, clientY: number): { cell: number; point: THREE.Vector3 } | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.cameraCtl.camera);
    return this.pickSurface(this.raycaster.ray);
  }

  private selectAt(clientX: number, clientY: number): void {
    if (!this.world) return;
    const hit = this.pickAt(clientX, clientY);
    if (!hit) {
      this.clearSelection();
      return;
    }
    this.selection = null;
    this.following = false;
    this.selectedCell = hit.cell;
    this.marker.show(hit.point);
    this.centering = this.narrow() ? 0.9 : 0;
    this.ui.set({ place: this.placeInfo(this.world.world.planet, hit.cell), person: null, herd: null, following: false });
  }

  /** Marches along the ray between the outer (mountain-top) and inner shells to find the ground. */
  private pickSurface(ray: THREE.Ray): { cell: number; point: THREE.Vector3 } | null {
    const planet = this.world!.world.planet;
    const outer = new THREE.Sphere(new THREE.Vector3(), MAX_SURFACE + 2);
    const entry = new THREE.Vector3();
    if (!ray.intersectSphere(outer, entry)) return null;
    const startT = ray.origin.length() > MAX_SURFACE + 2 ? ray.origin.distanceTo(entry) : 0;
    const p = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const groundAt = (t: number) => {
      ray.at(t, p);
      dir.copy(p).normalize();
      this.pickCell = nearestCell(planet, dir.x, dir.y, dir.z, this.pickCell);
      return p.length() - walkableRadius(planet, this.pickCell);
    };
    const step = 0.08;
    let t = startT;
    let prev = groundAt(t);
    for (let i = 0; i < 1400; i++) {
      const next = t + step;
      const h = groundAt(next);
      if (h <= 0) {
        let lo = t;
        let hi = next;
        for (let k = 0; k < 10; k++) {
          const mid = (lo + hi) / 2;
          if (groundAt(mid) > 0) lo = mid;
          else hi = mid;
        }
        groundAt(hi);
        return { cell: this.pickCell, point: p.clone() };
      }
      if (h > prev && p.length() > MAX_SURFACE + 3) return null; // left the planet again
      prev = h;
      t = next;
    }
    return null;
  }

  private narrow(): boolean {
    return (this.canvas.clientWidth || window.innerWidth) < 640;
  }

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cameraCtl.setViewport(w, h);
    this.sparks.setViewportHeight(h);
    this.smoke.setViewportHeight(h);
  }

  private disposeWorld(): void {
    for (const e of this.effects) e.dispose();
    this.effects = [];
    for (const view of this.ongoing.values()) view.dispose();
    this.ongoing.clear();
    this.sparks.clear();
    this.smoke.clear();
    this.bubbles.clear();
    if (!this.world) return;
    const { root, sky, terrain, trees, fire, flood, lifeView } = this.world;
    this.scene.remove(root, sky.stars, sky.sun, sky.moon);
    terrain.dispose();
    trees.dispose();
    fire.dispose();
    flood.dispose();
    lifeView.dispose();
    this.world.towns.dispose();
    const disposeObject = (obj: THREE.Object3D) => {
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) {
          (mat as THREE.SpriteMaterial).map?.dispose();
          mat.dispose();
        }
      });
    };
    disposeObject(root);
    disposeObject(sky.stars);
    disposeObject(sky.sun);
    disposeObject(sky.moon);
    this.world = null;
  }
}
