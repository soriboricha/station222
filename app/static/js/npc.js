import * as THREE from "three";

/**
 * Placeholder pixel-art per NPC, replaced by /static/sprites/<npc-id>.png when that file exists.
 * `height` is the sprite's height in meters, `baseY` lifts it (e.g. onto a wheelchair seat).
 */
const LOOKS = {
  "patient-404": {
    height: 1.8,
    size: [16, 32],
    draw(px) {
      px("#3b2f2a", 5, 1, 6, 2);
      px("#e0b99a", 5, 3, 6, 5);
      px("#1b1b1b", 6, 5); px("#1b1b1b", 9, 5);
      px("#b7cfdc", 3, 8, 10, 13);
      px("#9ab4c2", 3, 8, 1, 13); px("#9ab4c2", 12, 8, 1, 13);
      px("#e0b99a", 2, 11, 1, 7); px("#e0b99a", 13, 11, 1, 7);
      px("#e0b99a", 5, 21, 2, 9); px("#e0b99a", 9, 21, 2, 9);
      px("#dfe6ea", 4, 30, 3, 2); px("#dfe6ea", 9, 30, 3, 2);
    },
  },
  vera: {
    height: 1.68,
    size: [18, 32],
    draw(px) {
      px("#b0672e", 5, 0, 8, 3); px("#b0672e", 4, 2, 2, 6); px("#b0672e", 12, 2, 2, 6); // curly hair
      px("#e8c2a0", 6, 3, 6, 5);
      px("#1b1b1b", 7, 5); px("#1b1b1b", 10, 5);
      px("#b33a3a", 8, 7, 2, 1); // lipstick grin
      px("#d6a64a", 5, 8, 8, 12); // mustard cardigan
      px("#8f3b5c", 7, 8, 4, 12);
      // Arms held straight out in front: seen from the front, forearms and hands at chest height.
      px("#d6a64a", 2, 10, 3, 3); px("#d6a64a", 13, 10, 3, 3);
      px("#e8c2a0", 1, 10, 2, 3); px("#e8c2a0", 15, 10, 2, 3);
      px("#4a4f6b", 6, 20, 6, 3);
      px("#e8c2a0", 6, 23, 2, 7); px("#e8c2a0", 10, 23, 2, 7);
      px("#5a2e2e", 5, 30, 3, 2); px("#5a2e2e", 10, 30, 3, 2);
    },
  },
  "saint-nastia": {
    height: 1.85,
    size: [22, 34],
    draw(px) {
      px("#2a9d8f", 9, 0, 1, 3); px("#e9c46a", 11, 0, 1, 3); px("#e76f51", 13, 1, 1, 2); // feathers
      px("#d4af37", 7, 3, 8, 2); // headdress band
      px("#f1d0b5", 8, 5, 6, 5);
      px("#1b1b1b", 9, 7); px("#1b1b1b", 12, 7);
      px("#b3122e", 10, 9, 2, 1);
      px("#d4af37", 8, 10, 6, 1); // necklace
      px("#b3122e", 6, 11, 10, 8); // bodice
      px("#d4af37", 10, 11, 2, 8);
      px("#f1d0b5", 4, 12, 2, 6); px("#f1d0b5", 16, 12, 2, 6);
      px("#6a1b9a", 3, 12, 1, 2); px("#6a1b9a", 18, 12, 1, 2); // puffed sleeves
      px("#b3122e", 3, 19, 16, 13); // wide skirt
      px("#d4af37", 3, 23, 16, 1); px("#2a9d8f", 3, 27, 16, 1); px("#d4af37", 3, 31, 16, 1);
      px("#e9c46a", 5, 20, 2, 2); px("#e9c46a", 14, 25, 2, 2); px("#2a9d8f", 9, 28, 2, 2);
      px("#3b0a14", 7, 32, 3, 2); px("#3b0a14", 12, 32, 3, 2);
    },
  },
  "mr-northpole": {
    height: 1.25,
    baseY: 0.32,
    size: [16, 24],
    draw(px) {
      px("#dcdcdc", 5, 0, 6, 2); // white hair
      px("#d9b08c", 5, 2, 6, 5);
      px("#1b1b1b", 6, 4); px("#1b1b1b", 9, 4);
      px("#7a2a2a", 6, 6, 4, 1); // shouting mouth
      px("#4a5240", 3, 7, 10, 7); // grey-green jacket
      px("#b9a36a", 4, 8, 1, 1); px("#b9a36a", 11, 8, 1, 1); // insignia
      px("#d9b08c", 1, 8, 2, 5); px("#d9b08c", 13, 5, 2, 5); // one fist raised
      px("#6d4c3d", 2, 14, 12, 5); // wool blanket on knees
      px("#8a6552", 2, 16, 12, 1);
      px("#2b2b2b", 4, 19, 3, 5); px("#2b2b2b", 9, 19, 3, 5);
    },
  },
  mako: {
    height: 1.9,
    size: [24, 32],
    draw(px) {
      px("#3a2b22", 8, 0, 8, 2);
      px("#d7a98a", 7, 2, 10, 7);
      px("#1b1b1b", 9, 5); px("#1b1b1b", 14, 5);
      px("#b77a64", 10, 7, 4, 1);
      px("#9fb4c7", 3, 9, 18, 13); // big patient gown
      px("#8aa0b3", 3, 9, 2, 13); px("#8aa0b3", 19, 9, 2, 13);
      px("#d7a98a", 1, 11, 2, 8); px("#d7a98a", 21, 11, 2, 8);
      px("#2f7fd0", 10, 13, 4, 2); px("#2f7fd0", 9, 12, 2, 1); px("#2f7fd0", 14, 14, 1, 1); // blue whale toy
      px("#6c7f91", 5, 22, 6, 8); px("#6c7f91", 13, 22, 6, 8);
      px("#e3e8ec", 4, 30, 7, 2); px("#e3e8ec", 13, 30, 7, 2);
    },
  },
};

function placeholderTexture(look) {
  const [w, h] = look.size;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  look.draw((color, x, y, pw = 1, ph = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, pw, ph);
  });
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
  const [x, z] = room.npc_spot || room.centroid;
  const look = LOOKS[placement.id] || LOOKS["patient-404"];
  const height = look.height;
  const baseY = look.baseY || 0;
  const aspect = look.size[0] / look.size[1];

  const material = new THREE.MeshLambertMaterial({
    map: placeholderTexture(look),
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), material);
  mesh.position.set(x, baseY + height / 2, z);
  mesh.userData.interact = { type: "npc", npc: placement };
  scene.add(mesh);

  new THREE.TextureLoader().load(
    `/static/sprites/${placement.id}.png`,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      const ratio = texture.image.width / texture.image.height;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(height * ratio, height);
      material.map = texture;
      material.needsUpdate = true;
    },
    undefined,
    () => {},
  );

  station.boxes.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  station.interactables.push(mesh);

  return {
    placement,
    mesh,
    update(camera) {
      mesh.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
    },
  };
}
