/**
 * Game: owns the planet, the clock, the renderer and the camera, and runs the
 * frame loop. The UI talks to it only through methods and the `ui` store.
 */
import * as THREE from 'three';
import { Store, safeStorage } from '../core/store';
import { encodeWorldCode, type PlanetSize, type WorldSpec } from '../core/worldCode';
import {
  Clock,
  dateFromMinutes,
  localSolarHours,
  MINUTES_PER_DAY,
  seasonSignal,
  sunDeclination,
  sunLongitude,
  type CalendarDate,
  type SpeedIndex,
} from '../sim/clock';
import { currentTemperature, generatePlanet, latitudeOf, longitudeOf, type PlanetData } from '../sim/planet/generate';
import { nearestCell } from '../sim/planet/geodesic';
import { Biome, isWater } from '../sim/planet/biomes';
import { R, MAX_SURFACE, createSeasonUniforms, walkableRadius, type SeasonUniforms } from '../render/scale';
import { buildTerrain } from '../render/terrain';
import { buildOcean } from '../render/ocean';
import { buildAtmosphere, type Atmosphere } from '../render/atmosphere';
import { buildSky, type Sky } from '../render/sky';
import { buildTrees } from '../render/trees';
import { buildClouds } from '../render/clouds';
import { PlaceMarker } from '../render/marker';
import { GodCamera } from '../render/godCamera';

const SAVE_KEY = 'enis.save.v1';
const SPACE_COLOR = new THREE.Color(0x03050b);
const DAY_SKY_COLOR = new THREE.Color(0x8db6dc);
const DUSK_SKY_COLOR = new THREE.Color(0x2b3550);

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
}

export interface SaveData {
  code: string;
  minutes: number;
  speedIndex: SpeedIndex;
}

interface PlanetScene {
  planet: PlanetData;
  root: THREE.Group;
  trees: THREE.Group;
  clouds: THREE.Group;
  sky: Sky;
  atmosphere: Atmosphere;
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

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene.background = this.skyColor;
    this.scene.fog = new THREE.Fog(this.skyColor, 1e5, 2e5);
    this.scene.add(this.sunLight, this.sunLight.target, this.ambient, this.marker.group);

    this.cameraCtl = new GodCamera(canvas, {
      surfaceRadius: (dir) => this.surfaceRadius(dir),
      onTap: (x, y) => this.selectAt(x, y),
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

  static loadSave(): SaveData | null {
    try {
      const raw = safeStorage.get(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (typeof data.code !== 'string' || typeof data.minutes !== 'number') return null;
      return data;
    } catch {
      return null;
    }
  }

  snapshot(): SaveData | null {
    if (!this.spec) return null;
    return { code: encodeWorldCode(this.spec), minutes: this.clock.minutes, speedIndex: this.clock.speedIndex };
  }

  private save(): void {
    const data = this.snapshot();
    if (data) safeStorage.set(SAVE_KEY, JSON.stringify(data));
  }

  /** Builds a new planet. Runs on the next frames so the loading screen can show. */
  async createWorld(spec: WorldSpec, startMinutes?: number, speedIndex?: SpeedIndex): Promise<void> {
    this.ui.set({ loading: true, place: null });
    this.selectedCell = null;
    this.marker.hide();
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)));

    this.disposeWorld();
    const planet = generatePlanet(spec.seed, spec.size);
    this.spec = spec;
    this.clock.minutes = startMinutes ?? new Clock().minutes;
    if (speedIndex !== undefined) this.clock.speedIndex = speedIndex;

    const root = new THREE.Group();
    const terrain = buildTerrain(planet, this.season);
    const ocean = buildOcean(this.season, spec.size === 'large' ? 56 : spec.size === 'medium' ? 40 : 28);
    const trees = buildTrees(planet, terrain.faceBiome, terrain.facePositions, this.season);
    const clouds = buildClouds(planet);
    const atmosphere = buildAtmosphere();
    const sky = buildSky(spec.seed);
    root.add(terrain.mesh, trees, ocean, clouds, atmosphere.mesh);
    this.scene.add(root, sky.stars, sky.sun, sky.moon);
    this.world = { planet, root, trees, clouds, sky, atmosphere };

    this.focusCell = this.pickCell = this.findStartCell(planet);
    const start = new THREE.Vector3().fromArray(planet.positions, this.focusCell * 3);
    if (startMinutes === undefined) this.clock.minutes = morningAt(this.clock.minutes, longitudeOf(start.x, start.z));
    this.cameraCtl.lookAt(start, R * 1.45);
    this.cameraCtl.targetDistance = R * 1.45;
    this.realSunDir.copy(this.computeRealSun());
    this.sunDir.copy(this.realSunDir);

    this.ui.set({
      ready: true,
      loading: false,
      planetName: planet.name,
      worldCode: encodeWorldCode(spec),
      size: spec.size,
      radiusKm: planet.radiusKm,
      speedIndex: this.clock.speedIndex,
      timelapse: this.clock.timelapse,
    });
    this.save();
    if (!this.running) {
      this.running = true;
      this.lastFrame = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }
  }

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
  private resumeSpeed: SpeedIndex = 1;

  clearSelection(): void {
    this.selectedCell = null;
    this.marker.hide();
    this.ui.set({ place: null });
  }

  zoomBy(factor: number): void {
    this.cameraCtl.zoom(factor);
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

  private surfaceRadius(dir: THREE.Vector3): number {
    if (!this.world) return R;
    this.focusCell = nearestCell(this.world.planet, dir.x, dir.y, dir.z, this.focusCell);
    return walkableRadius(this.world.planet, this.focusCell);
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

    this.clock.advance(dt);
    const yf = this.clock.yearFraction();
    this.season.uSeason.value = seasonSignal(yf);
    this.season.uSeasonCos.value = Math.cos(2 * Math.PI * (yf - 0.125));

    this.cameraCtl.update(dt);
    const cam = this.cameraCtl.camera;
    cam.updateMatrixWorld();

    // Sun: real position, or a steady light in timelapse (days would flicker).
    this.realSunDir.copy(this.computeRealSun());
    const wanted = this.clock.timelapse ? this.computeTimelapseSun() : this.realSunDir;
    const blend = 1 - Math.exp(-dt * (this.clock.timelapse ? 3 : 4));
    this.sunDir.lerp(wanted, blend).normalize();
    this.sunLight.position.copy(this.sunDir).multiplyScalar(R * 4);
    this.sunLight.target.position.set(0, 0, 0);

    const { sky, atmosphere, clouds, trees } = this.world;
    const starAngle = this.clock.timelapse ? sky.stars.rotation.y : sunLongitude(this.clock.dayFraction());
    sky.update(this.sunDir, starAngle, this.clock.minutes / MINUTES_PER_DAY);
    atmosphere.uniforms.uSunDir.value.copy(this.sunDir);
    const camR = cam.position.length();
    atmosphere.uniforms.uFade.value = THREE.MathUtils.smoothstep(camR, R * 1.12, R * 1.5);

    // Near the ground the sky turns blue by day, with haze toward the horizon.
    const low = 1 - THREE.MathUtils.smoothstep(camR, R * 1.04, R * 1.3);
    const sunHeight = this.cameraCtl.focus.dot(this.sunDir);
    const day = THREE.MathUtils.smoothstep(sunHeight, -0.12, 0.25);
    const dusk = THREE.MathUtils.smoothstep(sunHeight, -0.3, -0.05) * (1 - day);
    this.skyColor.copy(SPACE_COLOR).lerp(DUSK_SKY_COLOR, low * dusk).lerp(DAY_SKY_COLOR, low * day);
    (sky.stars.material as THREE.PointsMaterial).opacity = 1 - low * day * 0.95;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.skyColor);
    if (low > 0.01) {
      const d = this.cameraCtl.distance;
      fog.near = d * 2.2;
      fog.far = d * 2.2 + (d * 30) / Math.max(0.15, low);
    } else {
      fog.near = 1e5;
      fog.far = 2e5;
    }

    // Clouds drift; capped so they do not spin wildly in timelapse.
    this.cloudAngle += dt * Math.min(this.clock.speed, 10) * 0.0035;
    clouds.rotation.y = this.cloudAngle;
    clouds.rotation.z = Math.sin(this.cloudAngle * 0.37) * 0.05;

    trees.visible = this.cameraCtl.distance < R * 1.6;
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

  private pushUi(): void {
    if (!this.world) return;
    const { planet } = this.world;
    const f = this.cameraCtl.focus;
    const lon = longitudeOf(f.x, f.z);
    const sunLon = sunLongitude(this.clock.dayFraction());
    const patch: Partial<UiState> = {
      date: dateFromMinutes(this.clock.minutes),
      focusHours: localSolarHours(lon, sunLon),
      focusDaylight: f.dot(this.realSunDir) > -0.05,
    };
    if (this.selectedCell !== null) patch.place = this.placeInfo(planet, this.selectedCell);
    this.ui.set(patch);
  }

  private placeInfo(planet: PlanetData, cell: number): PlaceInfo {
    const x = planet.positions[cell * 3];
    const y = planet.positions[cell * 3 + 1];
    const z = planet.positions[cell * 3 + 2];
    const lat = latitudeOf(y);
    const lon = longitudeOf(x, z);
    const hours = localSolarHours(lon, sunLongitude(this.clock.dayFraction()));
    const season = seasonSignal(this.clock.yearFraction());
    const tNow = currentTemperature(planet, cell, season, hours);
    const water = isWater(planet.biome[cell]);
    const seasonalMean = planet.temperature[cell] + planet.seasonAmplitude[cell] * Math.max(-1, Math.min(1, y * 8)) * season;
    return {
      cell,
      biome: planet.biome[cell] as Biome,
      latitude: lat,
      longitude: lon,
      heightM: planet.heightM[cell],
      meanTemperature: planet.temperature[cell],
      temperatureNow: tNow,
      moisture: planet.moisture[cell],
      localHours: hours,
      daylight: new THREE.Vector3(x, y, z).dot(this.realSunDir) > -0.05,
      frozen: water ? seasonalMean < -3.5 : seasonalMean < -1 && planet.biome[cell] !== Biome.Ice,
    };
  }

  private selectAt(clientX: number, clientY: number): void {
    if (!this.world) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.cameraCtl.camera);
    const hit = this.pickSurface(this.raycaster.ray);
    if (!hit) {
      this.clearSelection();
      return;
    }
    this.selectedCell = hit.cell;
    this.marker.show(hit.point);
    this.ui.set({ place: this.placeInfo(this.world.planet, hit.cell) });
  }

  /** Marches along the ray between the outer (mountain-top) and inner shells to find the ground. */
  private pickSurface(ray: THREE.Ray): { cell: number; point: THREE.Vector3 } | null {
    const planet = this.world!.planet;
    const outer = new THREE.Sphere(new THREE.Vector3(), MAX_SURFACE);
    const entry = new THREE.Vector3();
    if (!ray.intersectSphere(outer, entry)) return null;
    const startT = ray.origin.length() > MAX_SURFACE ? ray.origin.distanceTo(entry) : 0;
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
    for (let i = 0; i < 1200; i++) {
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
      if (h > prev && p.length() > MAX_SURFACE + 1) return null; // left the planet again
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
  }

  private disposeWorld(): void {
    if (!this.world) return;
    const { root, sky } = this.world;
    this.scene.remove(root, sky.stars, sky.sun, sky.moon);
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
