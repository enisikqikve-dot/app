/**
 * The god camera: always looks at a point on the planet ("focus").
 *
 * - Drag (mouse or one finger) turns the planet under you.
 * - Wheel or pinch zooms from orbit down to the tree tops; close up the view
 *   tilts toward the horizon by itself.
 * - Right mouse button or a two-finger twist turns and tilts the view.
 *
 * Orientation is kept as a focus normal plus a "forward" tangent that is
 * carried along when the focus moves, so there is no gimbal trouble at the poles.
 */
import * as THREE from 'three';
import { R } from './scale';

export const MIN_DISTANCE = 5;
export const MAX_DISTANCE = R * 4.2;
const MAX_AUTO_TILT = 1.12;
const MAX_TILT = 1.4;
const TAP_SLOP_PX = 7;
const TAP_MAX_MS = 450;

interface PointerInfo {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
  button: number;
  type: string;
}

export interface GodCameraOptions {
  /** Radius of the ground (or water) in a direction. */
  surfaceRadius: (dir: THREE.Vector3) => number;
  /** Called on a tap/click that was not a drag. */
  onTap: (clientX: number, clientY: number) => void;
  /** Called when the user starts interacting (e.g. to hide hints). */
  onInteract?: () => void;
  /** Brush tools: drag with the primary pointer paints instead of turning the planet. */
  onBrush?: (phase: 'start' | 'move' | 'end', clientX: number, clientY: number) => void;
  /** Mouse moves without buttons (for a brush preview). */
  onHover?: (clientX: number, clientY: number) => void;
}

export class GodCamera {
  readonly camera: THREE.PerspectiveCamera;
  readonly focus = new THREE.Vector3(0, 0, 1);
  readonly forward = new THREE.Vector3(0, 1, 0);
  distance = R * 2.6;
  targetDistance = R * 2.6;
  tiltOffset = 0;
  /** While true, a one-pointer drag goes to `onBrush` instead of panning. */
  brushMode = false;
  /** Set whenever the player moves the view (so following a person can stop). */
  userPanned = false;
  /** Moves the picture up by this share of the screen height, to leave room for a bottom sheet on phones. */
  viewShiftTarget = 0;
  private viewShift = 0;
  private viewW = 1;
  private viewH = 1;

  private readonly dom: HTMLElement;
  private brushing = false;
  private shakeStrength = 0;
  private shakeTime = 0;
  private shakeTotal = 0;
  private readonly opts: GodCameraOptions;
  private readonly pointers = new Map<number, PointerInfo>();
  private readonly keys = new Set<string>();
  private gestureWasMulti = false;
  private readonly inertia = new THREE.Vector2();
  private lastMoveTime = 0;
  private surface = R;
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpV2 = new THREE.Vector3();
  private readonly cleanup: (() => void)[] = [];

  constructor(dom: HTMLElement, opts: GodCameraOptions) {
    this.dom = dom;
    this.opts = opts;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 4000);
    this.bindEvents();
  }

  dispose(): void {
    for (const off of this.cleanup) off();
  }

  /** Points the camera at a direction, looking north. */
  lookAt(dir: THREE.Vector3, distance?: number): void {
    this.focus.copy(dir).normalize();
    const north = new THREE.Vector3(0, 1, 0);
    this.forward.copy(north).addScaledVector(this.focus, -north.dot(this.focus));
    if (this.forward.lengthSq() < 1e-6) this.forward.set(1, 0, 0).addScaledVector(this.focus, -this.focus.x);
    this.forward.normalize();
    if (distance !== undefined) this.distance = this.targetDistance = distance;
    this.surface = this.opts.surfaceRadius(this.focus);
  }

  /** Current tilt in radians (0 = looking straight down). */
  get tilt(): number {
    const t = Math.log(this.distance / MIN_DISTANCE) / Math.log((R * 0.9) / MIN_DISTANCE);
    const auto = MAX_AUTO_TILT * Math.pow(1 - Math.min(1, Math.max(0, t)), 1.5);
    return Math.min(MAX_TILT, Math.max(0, auto + this.tiltOffset));
  }

  setViewport(width: number, height: number): void {
    this.viewW = Math.max(1, width);
    this.viewH = Math.max(1, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Turns the planet so the focus moves a fraction `k` (0 … 1) of the way toward `dir`. */
  moveFocusToward(dir: THREE.Vector3, k: number): void {
    const target = this.tmpV.copy(dir).normalize();
    const angle = this.focus.angleTo(target) * Math.min(1, Math.max(0, k));
    if (angle < 1e-7) return;
    const axis = this.tmpV2.crossVectors(this.focus, target);
    if (axis.lengthSq() < 1e-12) return;
    axis.normalize();
    this.tmpQ.setFromAxisAngle(axis, angle);
    this.focus.applyQuaternion(this.tmpQ).normalize();
    this.forward.applyQuaternion(this.tmpQ);
    this.reorthogonalize();
  }

  /** Moves the focus over the surface by screen pixels. */
  pan(dxPx: number, dyPx: number): void {
    this.userPanned = true;
    const viewHeight = this.dom.clientHeight || 1;
    const unitsPerPx = (2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / viewHeight;
    const k = unitsPerPx / Math.max(R, this.surface);
    const right = this.tmpV.crossVectors(this.forward, this.focus);
    // The point the finger holds should stay under the finger.
    const move = this.tmpV2.copy(right).multiplyScalar(-dxPx * k).addScaledVector(this.forward, dyPx * k);
    const angle = move.length();
    if (angle < 1e-9) return;
    move.divideScalar(angle);
    const axis = move.crossVectors(this.focus, move).normalize();
    this.tmpQ.setFromAxisAngle(axis, angle);
    this.focus.applyQuaternion(this.tmpQ).normalize();
    this.forward.applyQuaternion(this.tmpQ);
    this.reorthogonalize();
  }

  turn(angle: number): void {
    this.tmpQ.setFromAxisAngle(this.focus, angle);
    this.forward.applyQuaternion(this.tmpQ);
    this.reorthogonalize();
  }

  /** Shakes the camera, e.g. for earthquakes and impacts. */
  shake(strength: number, seconds: number): void {
    if (strength >= this.shakeStrength * (this.shakeTime / Math.max(0.001, this.shakeTotal))) {
      this.shakeStrength = strength;
      this.shakeTime = this.shakeTotal = seconds;
    }
  }

  zoom(factor: number): void {
    this.targetDistance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, this.targetDistance * factor));
  }

  update(dt: number): void {
    // Keyboard
    const speed = 700 * dt;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.pan(0, speed);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.pan(0, -speed);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.pan(speed, 0);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.pan(-speed, 0);
    if (this.keys.has('KeyQ')) this.turn(1.6 * dt);
    if (this.keys.has('KeyE')) this.turn(-1.6 * dt);
    if (this.keys.has('KeyR')) this.tiltOffset = Math.min(MAX_TILT, this.tiltOffset + 1.2 * dt);
    if (this.keys.has('KeyF')) this.tiltOffset = Math.max(-MAX_AUTO_TILT, this.tiltOffset - 1.2 * dt);
    if (this.keys.has('Equal') || this.keys.has('NumpadAdd') || this.keys.has('BracketRight')) this.zoom(Math.exp(-1.6 * dt));
    if (this.keys.has('Minus') || this.keys.has('NumpadSubtract') || this.keys.has('Slash')) this.zoom(Math.exp(1.6 * dt));

    // Fling after a drag
    if (this.pointers.size === 0 && this.inertia.lengthSq() > 1) {
      this.pan(this.inertia.x * dt, this.inertia.y * dt);
      this.inertia.multiplyScalar(Math.exp(-dt * 5));
    }

    this.shakeTime = Math.max(0, this.shakeTime - dt);

    // Smooth zoom and ground height
    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-dt * 9));
    const wantSurface = this.opts.surfaceRadius(this.focus);
    this.surface += (wantSurface - this.surface) * (1 - Math.exp(-dt * 6));
    this.viewShift += (this.viewShiftTarget - this.viewShift) * (1 - Math.exp(-dt * 6));

    this.applyToCamera();
  }

  private applyToCamera(): void {
    const tilt = this.tilt;
    const target = this.tmpV.copy(this.focus).multiplyScalar(this.surface);
    const pos = this.camera.position
      .copy(target)
      .addScaledVector(this.focus, this.distance * Math.cos(tilt))
      .addScaledVector(this.forward, -this.distance * Math.sin(tilt));

    // Never dip below the ground near mountains.
    const dir = this.tmpV2.copy(pos).normalize();
    const ground = this.opts.surfaceRadius(dir) + 0.25 + this.distance * 0.02;
    if (pos.length() < ground) pos.setLength(ground);

    this.camera.up.copy(this.focus).multiplyScalar(Math.sin(tilt)).addScaledVector(this.forward, Math.cos(tilt));
    this.camera.lookAt(target);
    if (this.shakeTime > 0) {
      const k = this.shakeStrength * (this.shakeTime / this.shakeTotal) * (0.08 + this.distance * 0.006);
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k;
      this.camera.position.z += (Math.random() - 0.5) * k;
    }
    this.camera.near = Math.max(0.02, this.distance * 0.012);
    this.camera.far = pos.length() + 2600;
    if (Math.abs(this.viewShift) > 0.002) this.camera.setViewOffset(this.viewW, this.viewH, 0, this.viewShift * this.viewH, this.viewW, this.viewH);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private reorthogonalize(): void {
    this.forward.addScaledVector(this.focus, -this.forward.dot(this.focus)).normalize();
  }

  private bindEvents(): void {
    const el = this.dom;
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn as EventListener, options);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, options));
    };

    on(el, 'contextmenu', (e) => e.preventDefault());

    on(el, 'pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        startTime: performance.now(),
        button: e.button,
        type: e.pointerType,
      });
      if (this.pointers.size > 1) {
        this.gestureWasMulti = true;
        if (this.brushing) {
          this.brushing = false;
          this.opts.onBrush?.('end', e.clientX, e.clientY);
        }
      } else if (this.brushMode && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        this.brushing = true;
        this.opts.onBrush?.('start', e.clientX, e.clientY);
      }
      this.inertia.set(0, 0);
      this.opts.onInteract?.();
    });

    on(el, 'pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse') this.opts.onHover?.(e.clientX, e.clientY);
        return;
      }
      if (this.brushing && this.pointers.size === 1) {
        p.x = e.clientX;
        p.y = e.clientY;
        this.opts.onBrush?.('move', e.clientX, e.clientY);
        return;
      }
      const now = performance.now();
      if (this.pointers.size === 1) {
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        const rotateMode = p.button === 2 || p.button === 1 || (p.button === 0 && (e.shiftKey || e.ctrlKey || e.altKey));
        if (rotateMode) {
          this.turn(-dx * 0.006);
          this.tiltOffset = Math.min(MAX_TILT, Math.max(-MAX_AUTO_TILT, this.tiltOffset - dy * 0.005));
        } else {
          this.pan(dx, dy);
          const dtMove = Math.max(1, now - this.lastMoveTime) / 1000;
          this.inertia.set(dx / dtMove, dy / dtMove).clampLength(0, 2500);
        }
        this.lastMoveTime = now;
        p.x = e.clientX;
        p.y = e.clientY;
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const before = { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
        p.x = e.clientX;
        p.y = e.clientY;
        const after = { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
        if (before.d > 10 && after.d > 10) this.zoom(before.d / after.d);
        let dAng = after.ang - before.ang;
        if (dAng > Math.PI) dAng -= Math.PI * 2;
        if (dAng < -Math.PI) dAng += Math.PI * 2;
        this.turn(dAng);
        this.pan(after.mx - before.mx, after.my - before.my);
        this.inertia.set(0, 0);
      }
    });

    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (this.brushing) {
        this.brushing = false;
        this.opts.onBrush?.('end', e.clientX, e.clientY);
        if (this.pointers.size === 0) this.gestureWasMulti = false;
        return;
      }
      const moved = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      const quick = performance.now() - p.startTime < TAP_MAX_MS;
      if (!this.gestureWasMulti && moved < TAP_SLOP_PX && quick && p.button === 0 && e.type === 'pointerup') {
        this.inertia.set(0, 0);
        this.opts.onTap(e.clientX, e.clientY);
      }
      if (performance.now() - this.lastMoveTime > 80) this.inertia.set(0, 0);
      if (this.pointers.size === 0) this.gestureWasMulti = false;
    };
    on(el, 'pointerup', end);
    on(el, 'pointercancel', end);

    on(
      el,
      'wheel',
      (e) => {
        e.preventDefault();
        const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this.zoom(Math.exp(Math.max(-1, Math.min(1, delta * 0.0015))));
        this.opts.onInteract?.();
      },
      { passive: false },
    );

    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    on(window, 'keydown', (e) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey) return;
      this.keys.add(e.code);
    });
    on(window, 'keyup', (e) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
  }
}
