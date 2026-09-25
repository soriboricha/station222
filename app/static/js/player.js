import { DIM } from "./world.js";

const EYE_HEIGHT = 1.6;
const RADIUS = 0.3;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 6.2;
const JUMP_VELOCITY = 5.6;
const GRAVITY = 18;
const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.01;

export class Player {
  constructor(camera, station) {
    this.camera = camera;
    this.station = station;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vy = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;
    this.active = false;
    this.keys = new Set();
    camera.rotation.order = "YXZ";

    document.addEventListener("keydown", (e) => {
      if (this.active) this.keys.add(e.code);
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    document.addEventListener("mousemove", (e) => {
      if (!this.active) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch - e.movementY * MOUSE_SENSITIVITY));
    });
  }

  setActive(active) {
    this.active = active;
    if (!active) this.keys.clear();
  }

  spawn({ x, z, yaw }) {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.syncCamera();
  }

  update(dt) {
    const k = this.keys;
    const forward = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const strafe = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);

    if (forward || strafe) {
      const speed = k.has("ShiftLeft") || k.has("ShiftRight") ? SPRINT_SPEED : WALK_SPEED;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      let dx = -sin * forward + cos * strafe;
      let dz = -cos * forward - sin * strafe;
      const len = Math.hypot(dx, dz);
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;
      if (!this.station.blocked(this.x + dx, this.z, RADIUS)) this.x += dx;
      if (!this.station.blocked(this.x, this.z + dz, RADIUS)) this.z += dz;
    }

    if (k.has("Space") && this.onGround) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
    }
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0;
      this.onGround = true;
    }
    const maxY = DIM.height - EYE_HEIGHT - 0.15;
    if (this.y > maxY) {
      this.y = maxY;
      this.vy = Math.min(this.vy, 0);
    }

    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.set(this.x, this.y + EYE_HEIGHT, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
