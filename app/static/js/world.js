import * as THREE from "three";

export const DIM = {
  roomWidth: 4,
  roomDepth: 5,
  corridorHalf: 1.5,
  height: 3,
  wall: 0.2,
  doorWidth: 1.2,
  doorHeight: 2.2,
};

const DOOR_SPEED = 4; // radians per second

function canvasTexture(size, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

function tileTexture(repeatX, repeatY) {
  return canvasTexture(32, (ctx, s) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const shade = 225 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(Math.floor(Math.random() * s), Math.floor(Math.random() * s), 2, 2);
    }
    ctx.fillStyle = "#9a9a9a";
    ctx.fillRect(0, 0, s, 1);
    ctx.fillRect(0, 0, 1, s);
  }, repeatX, repeatY);
}

function signTexture(text, sub) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1d2a33";
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = "#8fb3c7";
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = "#e9f3f8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 64px monospace";
  ctx.fillText(text, 128, sub ? 56 : 66);
  if (sub) {
    ctx.font = "20px monospace";
    ctx.fillStyle = "#8fb3c7";
    ctx.fillText(sub, 128, 100);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Builds a straight station corridor along +X with patient rooms on both sides.
 * Rooms alternate sides by number: first_room, first_room+2, ... on the south side (-Z),
 * first_room+1, first_room+3, ... on the north side (+Z).
 */
export function buildStation(scene, world) {
  const { roomWidth: W, roomDepth: D, corridorHalf: C, height: H, wall: T, doorWidth: DW, doorHeight: DH } = DIM;
  const perSide = Math.ceil((world.last_room - world.first_room + 1) / 2);
  const length = perSide * W;

  const colliders = [];
  const interactables = [];
  const doors = [];
  const flickerLights = [];
  const rooms = new Map();

  for (let number = world.first_room; number <= world.last_room; number++) {
    const offset = number - world.first_room;
    const index = Math.floor(offset / 2);
    const side = offset % 2 === 0 ? -1 : 1;
    const x0 = index * W;
    rooms.set(number, {
      number,
      index,
      side,
      x0,
      x1: x0 + W,
      cx: x0 + W / 2,
      cz: side * (C + D / 2),
      wallZ: side * C,
      backZ: side * (C + D),
    });
  }

  const mats = {
    wall: new THREE.MeshLambertMaterial({ color: "#aebdb2" }),
    roomFloor: new THREE.MeshLambertMaterial({ color: "#c9c1ab", map: tileTexture(length, 2 * (C + D)) }),
    corridorFloor: new THREE.MeshLambertMaterial({ color: "#8e9c95", map: tileTexture(length, 2 * C) }),
    ceiling: new THREE.MeshLambertMaterial({ color: "#d7dbd4" }),
    door: new THREE.MeshLambertMaterial({ color: "#4f6879" }),
    knob: new THREE.MeshLambertMaterial({ color: "#cfd3d6" }),
    bedFrame: new THREE.MeshLambertMaterial({ color: "#8a959b" }),
    mattress: new THREE.MeshLambertMaterial({ color: "#e4e8ea" }),
    pillow: new THREE.MeshLambertMaterial({ color: "#ffffff" }),
    blanket: new THREE.MeshLambertMaterial({ color: "#7e9fb3" }),
    lightPanel: new THREE.MeshBasicMaterial({ color: "#f2fff6" }),
  };

  function addBox(x0, x1, y0, y1, z0, z1, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    scene.add(mesh);
    if (collide) colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    return mesh;
  }

  function addPlane(width, depth, x, y, z, material, facingDown = false) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = facingDown ? Math.PI / 2 : -Math.PI / 2;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }

  // Floors and ceiling
  addPlane(length, 2 * (C + D), length / 2, 0, 0, mats.roomFloor);
  addPlane(length, 2 * C, length / 2, 0.002, 0, mats.corridorFloor);
  addPlane(length, 2 * (C + D), length / 2, H, 0, mats.ceiling, true);

  for (const side of [-1, 1]) {
    const wallZ = side * C;
    const zA = wallZ - T / 2;
    const zB = wallZ + T / 2;

    // Corridor wall with a doorway per room
    for (let index = 0; index < perSide; index++) {
      const number = world.first_room + index * 2 + (side === 1 ? 1 : 0);
      const x0 = index * W;
      const x1 = x0 + W;
      if (!rooms.has(number)) {
        addBox(x0, x1, 0, H, zA, zB, mats.wall);
        continue;
      }
      const cx = x0 + W / 2;
      const dx0 = cx - DW / 2;
      const dx1 = cx + DW / 2;
      addBox(x0, dx0, 0, H, zA, zB, mats.wall);
      addBox(dx1, x1, 0, H, zA, zB, mats.wall);
      addBox(dx0, dx1, DH, H, zA, zB, mats.wall, false);
      addDoor(rooms.get(number), dx0, wallZ);
      addSign(String(number), cx + DW / 2 + 0.45, 1.75, wallZ - side * (T / 2 + 0.01), side);
    }

    // Walls between rooms and the back wall
    const backZ = side * (C + D);
    for (let index = 0; index <= perSide; index++) {
      const x = index * W;
      addBox(x - T / 2, x + T / 2, 0, H, Math.min(wallZ, backZ), Math.max(wallZ, backZ), mats.wall);
    }
    addBox(-T / 2, length + T / 2, 0, H, backZ - T / 2, backZ + T / 2, mats.wall);
  }

  // Corridor end caps with station signs
  addBox(-T / 2 - 0.2, 0, 0, H, -C, C, mats.wall);
  addBox(length, length + T / 2 + 0.2, 0, H, -C, C, mats.wall);
  addSign(world.station_name.toUpperCase(), 0.01, 1.9, 0, 0, Math.PI / 2, 1.6, `${world.first_room}–${world.last_room}`);
  addSign(world.station_name.toUpperCase(), length - 0.01, 1.9, 0, 0, -Math.PI / 2, 1.6, `${world.first_room}–${world.last_room}`);

  // Corridor lights
  for (let x = 2; x < length; x += 4) {
    addBox(x - 0.5, x + 0.5, H - 0.03, H, -0.25, 0.25, mats.lightPanel, false);
  }
  for (let x = 4; x < length; x += 8) {
    const light = new THREE.PointLight("#e4fff0", 9, 11, 2);
    light.position.set(x, H - 0.3, 0);
    scene.add(light);
  }

  // Room furniture
  for (const room of rooms.values()) {
    const s = room.side;
    const innerBack = room.backZ - s * (T / 2);
    const bedX0 = room.x0 + T / 2 + 0.25;
    const bedX1 = bedX0 + 1.0;
    const bedZ0 = innerBack - s * 2.1;
    const zMin = Math.min(bedZ0, innerBack);
    const zMax = Math.max(bedZ0, innerBack);
    addBox(bedX0, bedX1, 0, 0.45, zMin, zMax, mats.bedFrame);
    addBox(bedX0 + 0.05, bedX1 - 0.05, 0.45, 0.6, zMin + 0.05, zMax - 0.05, mats.mattress, false);
    const blanketFar = innerBack - s * 0.6;
    addBox(bedX0 + 0.04, bedX1 - 0.04, 0.6, 0.64, Math.min(bedZ0, blanketFar) + 0.05, Math.max(bedZ0, blanketFar) - 0.05, mats.blanket, false);
    const pillowNear = innerBack - s * 0.5;
    addBox(bedX0 + 0.15, bedX1 - 0.15, 0.6, 0.72, Math.min(pillowNear, innerBack - s * 0.1), Math.max(pillowNear, innerBack - s * 0.1), mats.pillow, false);
    addBox(room.cx - 0.4, room.cx + 0.4, H - 0.03, H, room.cz - 0.4, room.cz + 0.4, mats.lightPanel, false);
  }

  function addDoor(room, hingeX, wallZ) {
    const group = new THREE.Group();
    group.position.set(hingeX, 0, wallZ);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(DW - 0.02, DH - 0.02, 0.06), mats.door);
    leaf.position.set(DW / 2, DH / 2, 0);
    group.add(leaf);
    for (const face of [-1, 1]) {
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), mats.knob);
      knob.position.set(DW - 0.15, 1.0, face * 0.06);
      group.add(knob);
    }
    scene.add(group);

    const collider = { minX: hingeX, maxX: hingeX + DW, minZ: wallZ - 0.08, maxZ: wallZ + 0.08, enabled: true };
    colliders.push(collider);

    const door = {
      room: room.number,
      group,
      collider,
      open: false,
      angle: 0,
      // Swing into the room: north rooms are +Z, south rooms -Z.
      openAngle: room.side === 1 ? -Math.PI / 2 : Math.PI / 2,
      toggle() {
        this.open = !this.open;
      },
    };
    leaf.userData.interact = { type: "door", door };
    interactables.push(leaf);
    doors.push(door);
  }

  function addSign(text, x, y, z, side, rotationY, width = 0.5, sub) {
    const w = width;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 2),
      new THREE.MeshBasicMaterial({ map: signTexture(text, sub) }),
    );
    mesh.position.set(x, y, z);
    // Plane faces +Z by default; corridor side of a north wall faces -Z.
    mesh.rotation.y = rotationY ?? (side === 1 ? Math.PI : 0);
    scene.add(mesh);
  }

  return {
    rooms,
    length,
    colliders,
    interactables,
    doors,
    flickerLights,

    addFlickerLight(light) {
      flickerLights.push({ light, base: light.intensity });
    },

    blocked(x, z, radius) {
      for (const b of colliders) {
        if (b.enabled === false) continue;
        if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) return true;
      }
      return false;
    },

    roomAt(x, z) {
      if (Math.abs(z) <= C || x < 0 || x > length) return null;
      const index = Math.floor(x / W);
      const number = world.first_room + index * 2 + (z > 0 ? 1 : 0);
      return rooms.has(number) ? number : null;
    },

    spawnPoint(number) {
      const room = rooms.get(number);
      if (!room) throw new Error(`Room ${number} does not exist in ${world.station_name}`);
      // Stand mid-room, facing the door (camera looks down -Z at yaw 0).
      return { x: room.cx + 0.2, z: room.cz - room.side * 0.4, yaw: room.side === 1 ? 0 : Math.PI };
    },

    update(dt, time) {
      for (const door of doors) {
        const target = door.open ? door.openAngle : 0;
        const delta = target - door.angle;
        const step = Math.sign(delta) * Math.min(Math.abs(delta), DOOR_SPEED * dt);
        door.angle += step;
        door.group.rotation.y = door.angle;
        door.collider.enabled = Math.abs(door.angle) < 0.35;
      }
      for (const f of flickerLights) {
        const flicker = Math.sin(time * 23) * Math.sin(time * 7.3) > 0.85 ? 0.25 : 1;
        f.light.intensity = f.base * flicker;
      }
    },
  };
}
