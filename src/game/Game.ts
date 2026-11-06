/**
 * Game: owns the world, the clock, the renderer and the camera, and runs the
 * frame loop. The UI talks to it only through methods and the `ui` store.
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
import { powerDef, type PowerEvent, type PowerKind } from '../sim/powers';
import { R, MAX_SURFACE, createSeasonUniforms, kmToUnits, radiusForHeight, walkableRadius, type SeasonUniforms } from '../render/scale';
import { TerrainView } from '../render/terrain';
import { TreeView } from '../render/trees';
import { buildOcean } from '../render/ocean';
import { buildAtmosphere, type Atmosphere } from '../render/atmosphere';
import { buildSky, type Sky } from '../render/sky';
import { buildClouds } from '../render/clouds';
import { AimRing, PlaceMarker } from '../render/marker';
import { GodCamera } from '../render/godCamera';
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
import { SoundEngine, type SoundName } from '../audio/sound';
import { parseSaveData, sanitizeEvents, type SaveData } from './saveData';

export type { SaveData };

const SAVE_KEY = 'enis.save.v2';
const OLD_SAVE_KEY = 'enis.save.v1';
const SPACE_COLOR = new THREE.Color(0x03050b);
const DAY_SKY_COLOR = new THREE.Color(0x8db6dc);
const DUSK_SKY_COLOR = new THREE.Color(0x2b3550);
const DUST_SKY_COLOR = new THREE.Color(0x857462);

export type PlaceCondition = 'burning' | 'burnt' | 'lava' | 'lavaRock' | 'flooded' | 'drought' | 'raining' | 'ash' | 'damaged' | 'planted';

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
}

export interface ClimateInfo {
  kind: ClimateShift['kind'] | null;
  /** °C added everywhere. */
  temperature: number;
  dust: number;
}

export interface Notice {
  key: MessageKey;
  id: number;
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
  armed: PowerKind | null;
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
  fire: FireView;
  flood: FloodView;
  clouds: THREE.Group;
  sky: Sky;
  atmosphere: Atmosphere;
  fx: FxContext;
}

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
  private world: PlanetScene | null = null;
  private spec: WorldSpec | null = null;
  private focusCell = 0;
  private pickCell = 0;
  private selectedCell: number | null = null;
  private readonly sunDir = new THREE.Vector3(1, 0.2, 0).normalize();
  private readonly realSunDir = new THREE.Vector3();
  private cloudAngle = 0;
  private lastFrame = performance.now();
  private lastUiPush = 0;
  private lastSave = 0;
  private running = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly skyColor = new THREE.Color(SPACE_COLOR);
  private resumeSpeed: SpeedIndex = 1;

  private armed: PowerKind | null = null;
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
      armed: null,
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
    for (const key of [SAVE_KEY, OLD_SAVE_KEY]) {
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

  /**
   * Starts the game. If a saved world cannot be rebuilt, it falls back to the same planet
   * without the saved events, then to a fresh planet, and finally shows the error.
   */
  async start(spec: WorldSpec, save: SaveData | null): Promise<void> {
    const attempts: (() => Promise<void>)[] = [
      () => this.createWorld(spec, save?.minutes, save?.speedIndex === 0 ? 1 : save?.speedIndex, save?.events ?? []),
      () => this.createWorld(spec),
      () => this.createWorld({ seed: randomSeed(), size: 'medium' }),
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

  snapshot(): SaveData | null {
    if (!this.spec || !this.world) return null;
    return {
      code: encodeWorldCode(this.spec),
      minutes: this.clock.minutes,
      speedIndex: this.clock.speedIndex,
      events: this.world.world.events,
    };
  }

  private save(): void {
    const data = this.snapshot();
    if (data) safeStorage.set(SAVE_KEY, JSON.stringify(data));
  }

  // ---------------------------------------------------------------- world lifecycle

  /** Builds a new planet. Runs on the next frames so the loading screen can show. */
  async createWorld(spec: WorldSpec, startMinutes?: number, speedIndex?: SpeedIndex, events: PowerEvent[] = []): Promise<void> {
    this.ui.set({ loading: true, place: null, error: null });
    this.selectedCell = null;
    this.marker.hide();
    this.arm(null);
    // Let the loading screen paint first (a timer, not requestAnimationFrame, which some viewers pause).
    await new Promise((resolve) => setTimeout(resolve, 40));

    this.disposeWorld();
    const planet = generatePlanet(spec.seed, spec.size);
    const world = new World(planet);
    events = sanitizeEvents(events, planet.cellCount);
    if (events.length > 0) world.rebuild(events);
    this.nextEventId = events.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    this.spec = spec;
    this.clock.minutes = startMinutes ?? new Clock().minutes;
    if (speedIndex !== undefined) this.clock.speedIndex = speedIndex;

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
    const ocean = buildOcean(this.season, spec.size === 'large' ? 56 : spec.size === 'medium' ? 40 : 28);
    const fire = new FireView(fx);
    const flood = new FloodView(fxRoot);
    const clouds = buildClouds(planet);
    const atmosphere = buildAtmosphere();
    const sky = buildSky(spec.seed);
    root.add(terrain.mesh, trees.group, ocean, clouds, atmosphere.mesh, fxRoot);
    this.scene.add(root, sky.stars, sky.sun, sky.moon);
    this.world = { world, overlay, root, fxRoot, terrain, trees, fire, flood, clouds, sky, atmosphere, fx };

    this.focusCell = this.pickCell = this.findStartCell(planet);
    const start = new THREE.Vector3().fromArray(planet.positions, this.focusCell * 3);
    if (startMinutes === undefined) this.clock.minutes = morningAt(this.clock.minutes, longitudeOf(start.x, start.z));
    this.cameraCtl.lookAt(start, R * 1.45);
    this.cameraCtl.targetDistance = R * 1.45;
    this.realSunDir.copy(this.computeRealSun());
    this.sunDir.copy(this.realSunDir);
    this.refreshEverything();

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
    });
    this.save();
    if (!this.running) {
      this.running = true;
      this.lastFrame = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }
  }

  /** Repaints terrain, trees and effects from scratch (after loading or rewinding). */
  private refreshEverything(): void {
    if (!this.world) return;
    const { world, overlay, terrain, trees } = this.world;
    world.computeOverlay(this.clock.minutes, overlay);
    terrain.refreshAll(overlay);
    world.changedCells.clear();
    trees.rebuild(world.planet, terrain.faceBiome, terrain.facePositions, (f) => this.faceVeg(f));
    this.treeRebuildAt = 0;
    this.applyOverlayViews(true);
    this.lastOverlayMinutes = this.clock.minutes;
    for (const view of this.ongoing.values()) view.dispose();
    this.ongoing.clear();
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
    this.marker.hide();
    this.ui.set({ place: null });
  }

  zoomBy(factor: number): void {
    this.cameraCtl.zoom(factor);
  }

  // ---------------------------------------------------------------- powers

  /** Chooses a power to aim (or null to stop). Global powers act at once. */
  arm(kind: PowerKind | null): void {
    if (kind && powerDef(kind).target === 'global') {
      this.castGlobal(kind);
      kind = null;
    }
    this.armed = kind;
    this.cameraCtl.brushMode = !!kind && powerDef(kind).target === 'brush';
    if (!kind) this.aim.hide();
    this.canvas.style.cursor = kind ? 'crosshair' : '';
    this.ui.set({ armed: kind });
  }

  private newEvent(kind: PowerKind, cell: number): PowerEvent {
    return { id: this.nextEventId++, kind, minutes: this.clock.minutes, cell, seed: randomSeed() };
  }

  private notify(key: MessageKey): void {
    this.ui.set({ notice: { key, id: ++this.noticeId } });
  }

  private play(name: SoundName, at?: THREE.Vector3): void {
    let volume = 1;
    if (at) volume = Math.max(0.2, Math.min(1, 1.35 - this.cameraCtl.camera.position.distanceTo(at) / (R * 2.4)));
    this.sound.play(name, volume);
  }

  private castGlobal(kind: PowerKind): void {
    if (!this.world) return;
    const event = this.newEvent(kind, -1);
    this.world.world.apply(event);
    this.afterEvent();
    const focusPoint = this.surfacePoint(this.world.world.planet, this.focusCell, new THREE.Vector3());
    burst(this.world.fx, kind === 'iceAge' ? 'chill' : 'heat', focusPoint, 3);
    this.play(kind === 'iceAge' ? 'chill' : 'heat');
    this.notify(kind === 'iceAge' ? 'notice.iceAge' : 'notice.heatAge');
  }

  private onTap(clientX: number, clientY: number): void {
    if (this.armed && powerDef(this.armed).target === 'point') this.castAt(clientX, clientY);
    else if (!this.armed) this.selectAt(clientX, clientY);
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

    if (kind === 'meteor') {
      this.play('whoosh', hit.point);
      const cam = this.cameraCtl.camera;
      const from = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      this.aim.hide();
      this.effects.push(
        new MeteorFx(fx, hit.point, from, cam.position.distanceTo(hit.point), () => {
          event.minutes = this.clock.minutes;
          world.apply(event);
          this.afterEvent();
          this.play('boom', hit.point);
        }),
      );
      return;
    }

    world.apply(event);
    this.afterEvent();
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
      default:
        break;
    }
  }

  private onBrush(phase: 'start' | 'move' | 'end', clientX: number, clientY: number): void {
    if (!this.world || !this.armed) return;
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
      const event = this.newEvent(this.armed, hit.cell);
      event.stamps = [];
      world.apply(event);
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
    const now = performance.now();
    if (now - this.lastHover < 40) return;
    this.lastHover = now;
    const hit = this.pickAt(clientX, clientY);
    if (!hit) {
      this.aim.hide();
      return;
    }
    this.aim.show(hit.point, kmToUnits(powerDef(this.armed).aimKm, this.world.world.planet.radiusKm));
  }

  /** After an event changed the world: repaint what changed and remember it. */
  private afterEvent(): void {
    if (!this.world) return;
    const { world, overlay, terrain } = this.world;
    world.computeOverlay(this.clock.minutes, overlay);
    if (world.changedCells.size > 0) {
      terrain.refreshCells(world.changedCells, overlay);
      world.changedCells.clear();
      this.treeRebuildAt = performance.now();
    }
    this.applyOverlayViews(false);
    this.lastOverlayMinutes = this.clock.minutes;
    this.ui.set({ eventCount: world.events.length });
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

  // ---------------------------------------------------------------- rewinding

  /** Points in time to rewind to: before each power used, and every 10 years. */
  rewindPoints(): RewindPoint[] {
    if (!this.world) return [];
    const events = this.world.world.events;
    const now = this.clock.minutes;
    const points: RewindPoint[] = events.map((e, i) => ({ minutes: Math.max(0, e.minutes - 0.01), eventCount: i, kind: e.kind }));
    for (let year = 10; (year - 1) * MINUTES_PER_YEAR <= now; year += 10) {
      const m = (year - 1) * MINUTES_PER_YEAR;
      points.push({ minutes: m, eventCount: events.filter((e) => e.minutes < m).length, kind: null });
    }
    return points.sort((a, b) => b.minutes - a.minutes).slice(0, 40);
  }

  rewindTo(point: RewindPoint): void {
    if (!this.world) return;
    for (const e of this.effects) e.dispose();
    this.effects = [];
    this.sparks.clear();
    this.smoke.clear();
    this.stroke = null;
    const kept = this.world.world.events.slice(0, point.eventCount);
    this.world.world.rebuild(kept);
    this.nextEventId = kept.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    this.clock.minutes = point.minutes;
    this.refreshEverything();
    if (this.selectedCell !== null) this.ui.set({ place: this.placeInfo(this.world.world.planet, this.selectedCell) });
    this.ui.set({ eventCount: kept.length, date: dateFromMinutes(this.clock.minutes) });
    this.save();
    this.play('chill');
    this.notify('notice.rewound');
  }

  // ---------------------------------------------------------------- internals

  private findStartCell(planet: PlanetData): number {
    // A green, temperate place near the coast makes a friendly first view.
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < planet.cellCount; i += 7) {
      const b = planet.biome[i];
      if (isWater(b)) continue;
      const lat = Math.abs(latitudeOf(planet.positions[i * 3 + 1]));
      const green = b === Biome.TemperateForest || b === Biome.Grassland || b === Biome.Rainforest || b === Biome.Savanna;
      const score = (green ? 2 : 0) - Math.abs(lat - 0.55) * 2 - Math.min(planet.coastDistance[i], 8) * 0.08 + ((i * 2654435761) % 1000) / 4000;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

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
    if (!this.world) return;
    const { world, overlay, sky, atmosphere, clouds, trees, terrain, fire } = this.world;

    this.clock.advance(dt);
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

    this.cameraCtl.update(dt);
    const cam = this.cameraCtl.camera;
    cam.updateMatrixWorld();

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

  private pushUi(): void {
    if (!this.world) return;
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
    };
    if (this.selectedCell !== null) patch.place = this.placeInfo(world.planet, this.selectedCell);
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
    this.selectedCell = hit.cell;
    this.marker.show(hit.point);
    this.ui.set({ place: this.placeInfo(this.world.world.planet, hit.cell) });
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
    if (!this.world) return;
    const { root, sky, terrain, trees, fire, flood } = this.world;
    this.scene.remove(root, sky.stars, sky.sun, sky.moon);
    terrain.dispose();
    trees.dispose();
    fire.dispose();
    flood.dispose();
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
