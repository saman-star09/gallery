import * as THREE from 'three';

const HALF_PI = Math.PI / 2;

/**
 * Six-degrees-of-freedom "zero gravity" flight: mouse-look via pointer lock,
 * WASD thrust along the view direction, Space/Shift for pure vertical
 * thrust. Velocity persists and decays slowly instead of stopping the
 * instant a key is released, so movement reads as drifting through vacuum
 * rather than walking.
 */
export class FlightControls {
  readonly camera: THREE.PerspectiveCamera;
  isLocked = false;
  onLockChange?: (locked: boolean) => void;

  private readonly domElement: HTMLElement;
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly velocity = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private readonly acceleration = 26;
  private readonly damping = 2.6;
  private readonly maxSpeed = 14;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.euler.setFromQuaternion(camera.quaternion);

    domElement.addEventListener('click', () => {
      domElement.requestPointerLock()?.catch(() => {
        // Pointer lock can be denied (missing user-activation context, an
        // embedding iframe without allow="pointer-lock", etc). Nothing to
        // recover — the lock prompt just stays visible for another try.
      });
    });
    document.addEventListener('pointerlockchange', this.handleLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('keydown', (e) => this.keys.add(e.code));
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  private handleLockChange = () => {
    this.isLocked = document.pointerLockElement === this.domElement;
    this.onLockChange?.(this.isLocked);
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isLocked) return;
    this.euler.y -= e.movementX * 0.0022;
    this.euler.x -= e.movementY * 0.0022;
    this.euler.x = Math.max(-HALF_PI, Math.min(HALF_PI, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  };

  update(dt: number): void {
    const thrust = new THREE.Vector3(
      (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
      0,
      (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0),
    );
    if (thrust.lengthSq() > 0) thrust.normalize().applyQuaternion(this.camera.quaternion);

    const vertical = (this.keys.has('Space') ? 1 : 0) - (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1 : 0);
    thrust.y += vertical;

    if (this.isLocked && thrust.lengthSq() > 0) {
      this.velocity.addScaledVector(thrust.normalize(), this.acceleration * dt);
    }

    const decay = Math.max(0, 1 - this.damping * dt);
    this.velocity.multiplyScalar(decay);
    if (this.velocity.length() > this.maxSpeed) this.velocity.setLength(this.maxSpeed);

    this.camera.position.addScaledVector(this.velocity, dt);
  }

  dispose(): void {
    document.removeEventListener('pointerlockchange', this.handleLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
  }
}
