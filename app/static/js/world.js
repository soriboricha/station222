import * as THREE from "three";
import { buildProp } from "./props.js";
import { floorMaterial, wallMaterial, MATERIALS, signTexture } from "./materials.js";

export const WALL_THICKNESS = 0.2;
const DOOR_HEIGHT = 2.2;
const GATE_HEIGHT = 2.4;
const DOOR_SPEED = 2.2; // fraction of the swing per second
const SIDE_PROBE = 0.3;

export function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function polygonCentroid(polygon) {
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x0, z0] = polygon[j];
    const [x1, z1] = polygon[i];
    const cross = x0 * z1 - x1 * z0;
    area += cross;
    cx += (x0 + x1) * cross;
    cz += (z0 + z1) * cross;
  }
  if (Math.abs(area) < 1e-6) return polygon[0];
  return [cx / (3 * area), cz / (3 * area)];
}

function segmentDistance(px, pz, s) {
  const vx = s.bx - s.ax;
  const vz = s.bz - s.az;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq ? Math.max(0, Math.min(1, ((px - s.ax) * vx + (pz - s.az) * vz) / lenSq)) : 0;
  return Math.hypot(px - (s.ax + vx * t), pz - (s.az + vz * t));
}

/** Box geometry whose UVs are in meters, so tiled textures keep their scale on any wall size. */
function meterBox(width, height, depth, yOffset = 0) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const x = pos.getX(i) + width / 2;
    const y = pos.getY(i) + height / 2 + yOffset;
    const z = pos.getZ(i) + depth / 2;
    if (ny > 0.5) uv.setXY(i, x, z);
    else if (nx > 0.5) uv.setXY(i, z, y);
    else uv.setXY(i, x, y);
  }
  return geometry;
}

function shapeGeometry(polygon) {
  const shape = new THREE.Shape(polygon.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function buildStation(scene, world) {
  const H = world.wall_height;
  const rooms = new Map(world.rooms.map((r) => [r.id, { ...r, centroid: polygonCentroid(r.polygon) }]));
  const segments = [];
  const boxes = [];
  const interactables = [];
  const doors = [];
  const flickerLights = [];

  const roomAt = (x, z) => {
    for (const room of rooms.values()) if (pointInPolygon(x, z, room.polygon)) return room;
    return null;
  };

  const ctx = {
    scene,
    rooms,
    addBox(minX, maxX, minZ, maxZ) {
      boxes.push({ minX, maxX, minZ, maxZ });
    },
    addInteractable(mesh, interact) {
      mesh.userData.interact = interact;
      interactables.push(mesh);
    },
    addFlickerLight(light) {
      flickerLights.push({ light, base: light.intensity, seed: Math.random() * 100 });
    },
  };

  // Floors, ceilings and room lights
  for (const room of rooms.values()) {
    const geometry = shapeGeometry(room.polygon);
    scene.add(new THREE.Mesh(geometry, floorMaterial(room.floor)));
    if (!room.outdoor) {
      const ceiling = new THREE.Mesh(geometry, MATERIALS.ceiling);
      ceiling.position.y = H;
      scene.add(ceiling);
      const [cx, cz] = room.centroid;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.8), MATERIALS.lightPanel);
      panel.position.set(cx, H - 0.02, cz);
      scene.add(panel);
    }
    if (room.light) {
      const [cx, cz] = room.centroid;
      const light = new THREE.PointLight(room.light.color, room.light.intensity, 14, 2);
      light.position.set(cx, H - 0.4, cz);
      scene.add(light);
    }
    for (const prop of room.props) buildProp(ctx, room, prop);
  }

  for (const wall of world.walls) buildWall(wall);

  function buildWall(wall) {
    const [ax, az] = wall.a;
    const [bx, bz] = wall.b;
    const length = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / length;
    const dz = (bz - az) / length;
    // Normal of the box's local +Z face after rotating by theta.
    const nx = -dz;
    const nz = dx;
    const theta = Math.atan2(-dz, dx);
    const height = wall.height;
    const at = (t) => [ax + dx * t, az + dz * t];

    const styleAt = (t, sign) => {
      if (wall.material) return wall.material;
      const [px, pz] = at(Math.max(0.05, Math.min(length - 0.05, t)));
      const room = roomAt(px + sign * nx * SIDE_PROBE, pz + sign * nz * SIDE_PROBE);
      if (!room) return "exterior";
      return room.outdoor ? "exterior" : room.wall_style;
    };
    const keyAt = (t) => `${styleAt(t, 1)}|${styleAt(t, -1)}`;

    function addPiece(s, e, y0, y1, collide) {
      if (e - s < 0.005 || y1 - y0 < 0.005) return;
      const mid = (s + e) / 2;
      const materials = [
        MATERIALS.wallEdge, MATERIALS.wallEdge, MATERIALS.wallEdge, MATERIALS.wallEdge,
        wallMaterial(styleAt(mid, 1)), wallMaterial(styleAt(mid, -1)),
      ];
      const mesh = new THREE.Mesh(meterBox(e - s, y1 - y0, WALL_THICKNESS, y0), materials);
      const [px, pz] = at(mid);
      mesh.position.set(px, (y0 + y1) / 2, pz);
      mesh.rotation.y = theta;
      scene.add(mesh);
      if (collide) {
        const [sx, sz] = at(s);
        const [ex, ez] = at(e);
        segments.push({ ax: sx, az: sz, bx: ex, bz: ez, r: WALL_THICKNESS / 2 });
      }
    }

    // Split a solid stretch wherever the rooms on either side change, so each face gets its room's style.
    function addSolid(s, e, y0 = 0, y1 = height, collide = true) {
      if (e <= s) return;
      const step = 0.25;
      let start = s;
      let prev = s;
      let key = keyAt(s);
      while (prev < e) {
        const t = Math.min(prev + step, e);
        const next = keyAt(t);
        if (next !== key) {
          let lo = prev;
          let hi = t;
          for (let i = 0; i < 8; i++) {
            const m = (lo + hi) / 2;
            if (keyAt(m) === key) lo = m;
            else hi = m;
          }
          addPiece(start, hi, y0, y1, collide);
          start = hi;
          key = next;
        }
        prev = t;
      }
      addPiece(start, e, y0, y1, collide);
    }

    const openings = [...wall.openings].sort((p, q) => p.at - q.at);
    let t = -WALL_THICKNESS / 2;
    for (const o of openings) {
      const s = o.at - o.width / 2;
      const e = o.at + o.width / 2;
      addSolid(t, s);
      buildOpening(o, s, e);
      t = e;
    }
    addSolid(t, length + WALL_THICKNESS / 2);

    function buildOpening(o, s, e) {
      if (o.kind === "open") return;
      if (o.kind === "window") {
        addSolid(s, e, 0, 0.9, false);
        addSolid(s, e, 2.2, height, false);
        const [px, pz] = at((s + e) / 2);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(e - s, 1.3), MATERIALS.glass);
        glass.position.set(px, 1.55, pz);
        glass.rotation.y = theta;
        scene.add(glass);
        const [sx, sz] = at(s);
        const [ex, ez] = at(e);
        segments.push({ ax: sx, az: sz, bx: ex, bz: ez, r: WALL_THICKNESS / 2 });
        return;
      }

      const leafHeight = o.kind === "gate" ? GATE_HEIGHT : DOOR_HEIGHT;
      addSolid(s, e, leafHeight, height, false);

      const [cx, cz] = at(o.at);
      const target = o.into ? rooms.get(o.into) : null;
      const plusInside = target ? pointInPolygon(cx + nx * 0.5, cz + nz * 0.5, target.polygon) : true;
      const swing = plusInside ? -Math.PI / 2 : Math.PI / 2;

      const double = o.kind === "double" || o.kind === "double_glass" || o.kind === "gate";
      const leafWidth = double ? o.width / 2 : o.width;
      const leaves = [];
      const door = {
        id: o.id,
        label: o.label || "door",
        locked: !!o.locked,
        kind: o.kind,
        open: false,
        progress: 0,
        leaves,
        collider: null,
        toggle() {
          if (this.locked) return false;
          this.open = !this.open;
          return true;
        },
      };

      const addLeaf = (t0, base, openRot) => {
        const group = new THREE.Group();
        const [hx, hz] = at(t0);
        group.position.set(hx, 0, hz);
        group.rotation.y = base;
        const leaf = makeLeaf(o.kind, leafWidth, leafHeight - 0.02);
        group.add(leaf);
        scene.add(group);
        leaf.traverse((child) => {
          if (child.isMesh) ctx.addInteractable(child, { type: "door", door });
        });
        leaves.push({ group, base, openRot });
      };
      addLeaf(s, theta, theta + swing);
      if (double) addLeaf(e, theta + Math.PI, theta + Math.PI - swing);

      const [sx, sz] = at(s);
      const [ex, ez] = at(e);
      door.collider = { ax: sx, az: sz, bx: ex, bz: ez, r: 0.08, enabled: true };
      segments.push(door.collider);
      doors.push(door);

      if (o.sign && o.label) addSign(o, s, e, plusInside ? -1 : 1);
    }

    function addSign(o, s, e, side) {
      const width = o.label.length <= 4 ? 0.5 : 0.95;
      const clear = (t0) =>
        t0 - width / 2 > 0 && t0 + width / 2 < length &&
        openings.every((p) => p === o || t0 + width / 2 < p.at - p.width / 2 || t0 - width / 2 > p.at + p.width / 2);
      let ts = e + 0.15 + width / 2;
      if (!clear(ts)) ts = s - 0.15 - width / 2;
      if (!clear(ts)) return;
      const [px, pz] = at(ts);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, 0.25),
        new THREE.MeshBasicMaterial({ map: signTexture(o.label, width / 0.25) }),
      );
      const fx = side * nx;
      const fz = side * nz;
      mesh.position.set(px + fx * (WALL_THICKNESS / 2 + 0.01), 1.8, pz + fz * (WALL_THICKNESS / 2 + 0.01));
      mesh.rotation.y = Math.atan2(fx, fz);
      scene.add(mesh);
    }
  }

  return {
    world,
    rooms,
    segments,
    boxes,
    interactables,
    doors,

    blocked(x, z, radius) {
      for (const s of segments) {
        if (s.enabled === false) continue;
        if (segmentDistance(x, z, s) < radius + s.r) return true;
      }
      for (const b of boxes) {
        if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) return true;
      }
      return false;
    },

    roomAt,

    update(dt, time) {
      for (const door of doors) {
        const target = door.open ? 1 : 0;
        const delta = target - door.progress;
        door.progress += Math.sign(delta) * Math.min(Math.abs(delta), DOOR_SPEED * dt);
        const eased = door.progress * door.progress * (3 - 2 * door.progress);
        for (const leaf of door.leaves) leaf.group.rotation.y = leaf.base + (leaf.openRot - leaf.base) * eased;
        door.collider.enabled = door.progress < 0.2;
      }
      for (const f of flickerLights) {
        const flicker = Math.sin(time * 23 + f.seed) * Math.sin(time * 7.3 + f.seed) > 0.85 ? 0.25 : 1;
        f.light.intensity = f.base * flicker;
      }
    },
  };
}

function makeLeaf(kind, width, height) {
  const group = new THREE.Group();
  const box = (w, h, d, x, y, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, 0);
    group.add(mesh);
    return mesh;
  };

  if (kind === "gate") {
    const bars = Math.max(3, Math.round(width / 0.14));
    for (let i = 0; i <= bars; i++) box(0.04, height, 0.04, 0.02 + (i * (width - 0.04)) / bars, height / 2, MATERIALS.iron);
    box(width, 0.06, 0.05, width / 2, 0.15, MATERIALS.iron);
    box(width, 0.06, 0.05, width / 2, height - 0.05, MATERIALS.iron);
    box(width, 0.06, 0.05, width / 2, height / 2, MATERIALS.iron);
    return group;
  }

  const material = MATERIALS.door;
  if (kind === "glass" || kind === "double_glass") {
    const frame = 0.1;
    box(width, frame, 0.06, width / 2, height - frame / 2, material);
    box(width, 0.9, 0.06, width / 2, 0.45, material);
    box(frame, height, 0.06, frame / 2, height / 2, material);
    box(frame, height, 0.06, width - frame / 2, height / 2, material);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width - 2 * frame, height - 0.9 - frame), MATERIALS.glass);
    glass.position.set(width / 2, 0.9 + (height - 0.9 - frame) / 2, 0);
    group.add(glass);
  } else {
    box(width - 0.01, height, 0.06, width / 2, height / 2, material);
  }
  for (const face of [-1, 1]) {
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), MATERIALS.knob);
    knob.position.set(width - 0.14, 1.0, face * 0.055);
    group.add(knob);
  }
  return group;
}
