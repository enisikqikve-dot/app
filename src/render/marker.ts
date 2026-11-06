/** A golden ring that marks the selected place. */
import * as THREE from 'three';

export class PlaceMarker {
  readonly group = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private readonly beam: THREE.Mesh;
  private time = 0;

  constructor() {
    const material = new THREE.MeshBasicMaterial({
      color: 0xf4c46a,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 48).rotateX(-Math.PI / 2), material);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true).translate(0, 0.5, 0),
      material.clone(),
    );
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.55;
    this.group.add(this.ring, this.beam);
    this.group.visible = false;
    this.group.renderOrder = 3;
  }

  show(point: THREE.Vector3): void {
    this.group.position.copy(point);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), point.clone().normalize());
    this.group.visible = true;
    this.time = 0;
  }

  /** Follows something that moves, without restarting the pulse. */
  moveTo(point: THREE.Vector3): void {
    this.group.position.copy(point);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), point.clone().normalize());
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  /** Keeps the marker a readable size at every zoom level. */
  update(dt: number, cameraDistance: number): void {
    if (!this.group.visible) return;
    this.time += dt;
    const base = Math.min(6, Math.max(0.25, cameraDistance * 0.035));
    const pulse = 1 + Math.sin(this.time * 3) * 0.08;
    this.ring.scale.setScalar(base * pulse);
    this.beam.scale.set(base * 0.6, base * 4, base * 0.6);
  }
}

/** A thin white ring that shows where (and how big) a power will hit. */
export class AimRing {
  readonly mesh: THREE.Mesh;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    );
    this.mesh.visible = false;
    this.mesh.renderOrder = 7;
  }

  show(point: THREE.Vector3, radiusUnits: number): void {
    const n = point.clone().normalize();
    this.mesh.position.copy(point).addScaledVector(n, 0.15);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    this.mesh.scale.setScalar(Math.max(0.4, radiusUnits));
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }
}
