import * as THREE from "three";
import { DIM } from "./world.js";

const NPC_HEIGHT = 1.8;

function placeholderTexture() {
  // Tiny pixel-art patient: replaced by /static/sprites/<npc-id>.png when that file exists.
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  const px = (color, x, y, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  px("#3b2f2a", 5, 1, 6, 2); // hair
  px("#e0b99a", 5, 3, 6, 5); // face
  px("#1b1b1b", 6, 5); px("#1b1b1b", 9, 5); // eyes
  px("#b7cfdc", 3, 8, 10, 13); // gown
  px("#9ab4c2", 3, 8, 1, 13); px("#9ab4c2", 12, 8, 1, 13);
  px("#e0b99a", 2, 11, 1, 7); px("#e0b99a", 13, 11, 1, 7); // arms
  px("#e0b99a", 5, 21, 2, 9); px("#e0b99a", 9, 21, 2, 9); // legs
  px("#dfe6ea", 4, 30, 3, 2); px("#dfe6ea", 9, 30, 3, 2); // slippers
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

export function createNpc(scene, station, placement) {
  const room = station.rooms.get(placement.room);
  if (!room) {
    console.warn(`NPC ${placement.id} placed in unknown room ${placement.room}`);
    return null;
  }
  const s = room.side;
  const x = room.x1 - DIM.wall / 2 - 1.1;
  const z = room.cz + s * 0.9;

  const material = new THREE.MeshLambertMaterial({
    map: placeholderTexture(),
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(NPC_HEIGHT / 2, NPC_HEIGHT), material);
  mesh.position.set(x, NPC_HEIGHT / 2, z);
  mesh.userData.interact = { type: "npc", npc: placement };
  scene.add(mesh);

  new THREE.TextureLoader().load(
    `/static/sprites/${placement.id}.png`,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      const aspect = texture.image.width / texture.image.height;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(NPC_HEIGHT * aspect, NPC_HEIGHT);
      material.map = texture;
      material.needsUpdate = true;
    },
    undefined,
    () => {},
  );

  station.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  station.interactables.push(mesh);
  placeRoomProps(scene, station, room, placement.room_items);

  return {
    placement,
    mesh,
    update(camera) {
      mesh.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
    },
  };
}

function terminalScreenTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#031a0c";
  ctx.fillRect(0, 0, 64, 48);
  ctx.fillStyle = "#5ef2a0";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 14; col++) {
      if (Math.random() > 0.45) ctx.fillRect(3 + col * 4, 3 + row * 5, 3, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

const PROP_BUILDERS = {
  "Old Terminal"(scene, station, room) {
    const s = room.side;
    const x1 = room.x1 - DIM.wall / 2;
    const x0 = x1 - 0.7;
    const zc = room.cz + s * 0.9;
    const desk = new THREE.MeshLambertMaterial({ color: "#5d544a" });
    const casing = new THREE.MeshLambertMaterial({ color: "#c9c3b0" });
    const box = (w, h, d, x, y, z, m) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return mesh;
    };
    box(0.7, 0.75, 1.2, (x0 + x1) / 2, 0.375, zc, desk);
    box(0.45, 0.4, 0.5, x1 - 0.3, 0.95, zc, casing);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.3),
      new THREE.MeshBasicMaterial({ map: terminalScreenTexture() }),
    );
    screen.position.set(x1 - 0.3 - 0.226, 0.97, zc);
    screen.rotation.y = -Math.PI / 2;
    scene.add(screen);
    box(0.2, 0.03, 0.45, x0 + 0.2, 0.765, zc, casing);
    station.colliders.push({ minX: x0, maxX: x1, minZ: zc - 0.6, maxZ: zc + 0.6 });

    const glow = new THREE.PointLight("#7dffb4", 2.2, 5, 2);
    glow.position.set(x1 - 0.8, 1.1, zc);
    scene.add(glow);
    station.addFlickerLight(glow);
  },

  "Rusty Key"(scene, station, room) {
    const s = room.side;
    const rust = new THREE.MeshLambertMaterial({ color: "#8b4a22" });
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12), rust);
    ring.rotation.x = Math.PI / 2;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.02), rust);
    shaft.position.x = 0.09;
    const bit = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.04), rust);
    bit.position.set(0.14, 0, 0.02);
    group.add(ring, shaft, bit);
    group.position.set(room.cx - 0.2, 0.01, room.wallZ + s * 1.6);
    group.rotation.y = 0.7;
    scene.add(group);
  },
};

function placeRoomProps(scene, station, room, items) {
  for (const item of items) PROP_BUILDERS[item]?.(scene, station, room);
}
