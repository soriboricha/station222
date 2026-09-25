import * as THREE from "three";
import { artTexture } from "./materials.js";

const materialCache = new Map();
function mat(color) {
  if (!materialCache.has(color)) materialCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return materialCache.get(color);
}

function makeRng(seed) {
  let s = Math.floor(seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const BOOK_COLORS = ["#7a2e2e", "#2f4f6f", "#6b5a2a", "#3f6b3a", "#8c6a3f", "#4a3b5c", "#a0522d", "#2e3a3f", "#b89b5e"];

/** Prop-local helper: +Z is the prop's front, -Z its back (against the wall). */
class Builder {
  constructor(ctx, prop) {
    this.ctx = ctx;
    this.prop = prop;
    this.group = new THREE.Group();
    this.group.position.set(prop.x, 0, prop.z);
    this.group.rotation.y = prop.rot || 0;
    ctx.scene.add(this.group);
  }

  box(w, h, d, x, y, z, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === "string" ? mat(color) : color);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }

  cylinder(r, h, x, y, z, color, segments = 10) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), typeof color === "string" ? mat(color) : color);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }

  /** Blocks a w x d rectangle (prop-local, centred at ox/oz) for player collision. */
  solid(w, d, ox = 0, oz = 0) {
    const rot = this.prop.rot || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) {
      const x = this.prop.x + (lx + ox) * cos + (lz + oz) * sin;
      const z = this.prop.z - (lx + ox) * sin + (lz + oz) * cos;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    this.ctx.addBox(minX, maxX, minZ, maxZ);
  }

  light(color, intensity, distance, x, y, z, flicker = false) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    this.group.add(light);
    if (flicker) this.ctx.addFlickerLight(light);
    return light;
  }
}

function chair(b, x, z, facing, color = "#6d6258") {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), mat(color));
  seat.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.04), mat(color));
  back.position.set(0, 0.7, -0.19);
  g.add(seat, back);
  for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.03), mat("#3a3a3a"));
    leg.position.set(lx, 0.225, lz);
    g.add(leg);
  }
  b.group.add(g);
}

function books(b, x, y, z, width, maxHeight, depth, rng) {
  let cursor = x - width / 2;
  while (cursor < x + width / 2 - 0.03) {
    const w = 0.025 + rng() * 0.035;
    const h = maxHeight * (0.65 + rng() * 0.35);
    b.box(w, h, depth * (0.8 + rng() * 0.2), cursor + w / 2, y + h / 2, z, BOOK_COLORS[Math.floor(rng() * BOOK_COLORS.length)]);
    cursor += w + 0.004;
  }
}

const BUILDERS = {
  bed(b) {
    b.box(1.0, 0.4, 2.1, 0, 0.2, 0, "#8a959b");
    b.box(0.92, 0.14, 2.0, 0, 0.47, 0.02, "#e4e8ea");
    b.box(0.95, 0.05, 1.3, 0, 0.56, 0.35, "#7e9fb3");
    b.box(0.6, 0.12, 0.35, 0, 0.6, -0.78, "#ffffff");
    b.box(1.0, 0.95, 0.06, 0, 0.475, -1.03, "#6d7a80");
    b.solid(1.0, 2.1);
  },

  counter(b, p) {
    const w = p.w || 2;
    b.box(w, 0.88, 0.7, 0, 0.44, 0, "#c7cbd1");
    b.box(w + 0.02, 0.04, 0.72, 0, 0.9, 0, "#e9e5da");
    if (!p.island) b.box(w, 0.6, 0.35, 0, 1.75, -0.17, "#c7cbd1");
    b.solid(w, 0.7);
  },

  stove(b) {
    b.box(0.8, 0.9, 0.7, 0, 0.45, 0, "#3c3f44");
    for (const [x, z] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) b.cylinder(0.1, 0.02, x, 0.91, z, "#161616");
    b.box(0.8, 0.5, 0.3, 0, 1.8, -0.2, "#9aa0a6");
    b.solid(0.8, 0.7);
  },

  fridge(b) {
    b.box(0.9, 1.9, 0.7, 0, 0.95, 0, "#e8ecef");
    b.box(0.9, 0.02, 0.01, 0, 1.3, 0.351, "#b5bbc0");
    b.box(0.03, 0.4, 0.03, 0.35, 1.0, 0.37, "#9aa0a6");
    b.solid(0.9, 0.7);
  },

  dining_table(b) {
    b.box(1.8, 0.05, 0.9, 0, 0.74, 0, "#a0835f");
    for (const [x, z] of [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]]) b.box(0.06, 0.72, 0.06, x, 0.36, z, "#6b5638");
    for (const x of [-0.55, 0, 0.55]) {
      chair(b, x, -0.72, 0);
      chair(b, x, 0.72, Math.PI);
    }
    b.solid(1.8, 0.9);
  },

  floor_mattress(b) {
    b.box(1.1, 0.2, 2.0, 0, 0.1, 0, "#eef1f4");
    b.box(0.6, 0.08, 0.3, 0, 0.24, -0.75, "#ffffff");
  },

  painting(b, p) {
    const w = p.w || 1;
    const h = p.h || 1;
    const frame = p.art === "map" ? "#6b4a2b" : "#8a6a2a";
    b.box(w + 0.1, h + 0.1, 0.04, 0, 1.6, 0, frame);
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: artTexture(p.art) }));
    canvas.position.set(0, 1.6, 0.021);
    b.group.add(canvas);
  },

  desk(b) {
    b.box(1.4, 0.05, 0.7, 0, 0.74, 0, "#8b7355");
    for (const [x, z] of [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]]) b.box(0.05, 0.72, 0.05, x, 0.36, z, "#4a4a4a");
    b.box(0.5, 0.32, 0.04, -0.2, 1.0, -0.2, "#222");
    b.box(0.06, 0.12, 0.06, -0.2, 0.82, -0.2, "#333");
    b.box(0.3, 0.02, 0.4, 0.35, 0.78, 0.05, "#f2f2f2");
    chair(b, 0, 0.6, Math.PI, "#3f4a5a");
    b.solid(1.4, 0.7);
  },

  cabinet(b) {
    b.box(0.8, 1.9, 0.5, 0, 0.95, 0, "#b8c2c8");
    b.box(0.01, 1.8, 0.01, 0, 0.95, 0.251, "#8a949a");
    b.box(0.03, 0.15, 0.03, -0.06, 1.0, 0.27, "#6f777d");
    b.box(0.03, 0.15, 0.03, 0.06, 1.0, 0.27, "#6f777d");
    b.solid(0.8, 0.5);
  },

  water_cooler(b) {
    b.box(0.35, 1.0, 0.35, 0, 0.5, 0, "#e6e9ec");
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.4, 10),
      new THREE.MeshLambertMaterial({ color: "#7fb6e0", transparent: true, opacity: 0.6 }),
    );
    bottle.position.y = 1.2;
    b.group.add(bottle);
    b.solid(0.35, 0.35);
  },

  tv(b) {
    b.box(1.4, 0.8, 0.08, 0, 1.7, 0, "#111111");
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), new THREE.MeshBasicMaterial({ color: "#1e3446" }));
    screen.position.set(0, 1.7, 0.041);
    b.group.add(screen);
  },

  sofa(b) {
    b.box(1.9, 0.42, 0.85, 0, 0.21, 0, "#5b6e8c");
    b.box(1.9, 0.5, 0.2, 0, 0.67, -0.33, "#52637e");
    b.box(0.18, 0.25, 0.85, -0.86, 0.55, 0, "#52637e");
    b.box(0.18, 0.25, 0.85, 0.86, 0.55, 0, "#52637e");
    b.solid(1.9, 0.85);
  },

  coffee_table(b) {
    b.box(1.0, 0.05, 0.6, 0, 0.4, 0, "#7a5c3e");
    b.box(0.9, 0.38, 0.5, 0, 0.19, 0, "#6a4f35");
    b.solid(1.0, 0.6);
  },

  armchair(b) {
    b.box(0.85, 0.42, 0.8, 0, 0.21, 0, "#8c5a4a");
    b.box(0.85, 0.5, 0.18, 0, 0.67, -0.31, "#7d4f41");
    b.solid(0.85, 0.8);
  },

  ping_pong(b) {
    b.box(2.74, 0.04, 1.52, 0, 0.76, 0, "#1f5f8b");
    b.box(2.74, 0.005, 0.02, 0, 0.782, 0, "#ffffff");
    b.box(0.02, 0.15, 1.6, 0, 0.855, 0, "#f0f0f0");
    for (const [x, z] of [[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]]) b.box(0.05, 0.74, 0.05, x, 0.37, z, "#333");
    b.solid(2.74, 1.52);
  },

  plant(b) {
    b.cylinder(0.22, 0.45, 0, 0.225, 0, "#9b5a3c");
    b.box(0.5, 0.5, 0.5, 0, 0.8, 0, "#3f7a3a");
    b.box(0.3, 0.35, 0.3, 0.05, 1.15, -0.05, "#4c8a44");
    b.solid(0.5, 0.5);
  },

  big_plant(b) {
    b.cylinder(0.3, 0.5, 0, 0.25, 0, "#8c4f33");
    b.box(0.08, 1.0, 0.08, 0, 1.0, 0, "#5b4030");
    b.box(0.9, 0.7, 0.9, 0, 1.5, 0, "#3a6b34");
    b.box(0.6, 0.5, 0.6, 0.1, 2.0, -0.05, "#467c3e");
    b.solid(0.6, 0.6);
  },

  chair_circle(b, p) {
    const n = p.n || 8;
    const r = p.r || 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      chair(b, Math.sin(a) * r, Math.cos(a) * r, a + Math.PI, "#7a6a5a");
    }
  },

  whiteboard(b) {
    b.box(1.9, 1.2, 0.03, 0, 1.5, 0, "#8a9095");
    b.box(1.8, 1.1, 0.01, 0, 1.5, 0.02, "#f7f7f5");
    const r = makeRng(3);
    for (let i = 0; i < 7; i++) {
      b.box(0.3 + r() * 0.6, 0.02, 0.005, -0.5 + r() * 1.0, 1.2 + r() * 0.6, 0.027, ["#2255aa", "#aa2222", "#228844"][i % 3]);
    }
  },

  bookshelf(b, p) {
    const rng = makeRng(p.x * 7 + p.z);
    b.box(1.2, 2.2, 0.35, 0, 1.1, 0, "#5a3d26");
    for (let i = 0; i < 5; i++) {
      const y = 0.08 + i * 0.43;
      b.box(1.14, 0.03, 0.3, 0, y, 0.02, "#6e4a2f");
      books(b, 0, y + 0.015, 0.03, 1.08, 0.34, 0.24, rng);
    }
    b.solid(1.2, 0.35);
  },

  book_pile(b, p) {
    const rng = makeRng(p.x * 13 + p.z * 3);
    const stacks = 2 + Math.floor(rng() * 2);
    for (let s = 0; s < stacks; s++) {
      let y = 0;
      const sx = (s - (stacks - 1) / 2) * 0.32;
      const count = 5 + Math.floor(rng() * 10);
      for (let i = 0; i < count; i++) {
        const h = 0.04 + rng() * 0.04;
        const book = b.box(0.22 + rng() * 0.08, h, 0.16 + rng() * 0.06, sx, y + h / 2, 0, BOOK_COLORS[Math.floor(rng() * BOOK_COLORS.length)]);
        book.rotation.y = (rng() - 0.5) * 0.5;
        y += h;
      }
    }
  },

  gramophone(b) {
    b.box(0.4, 0.2, 0.4, 0, 0.1, 0, "#5a3d26");
    b.cylinder(0.16, 0.02, 0, 0.21, 0, "#1a1a1a", 16);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 12, 1, true), mat("#b8913a"));
    horn.material.side = THREE.DoubleSide;
    horn.position.set(0.05, 0.5, -0.05);
    horn.rotation.z = Math.PI / 3;
    b.group.add(horn);
    b.solid(0.45, 0.45);
  },

  bench(b, p) {
    const w = p.w || 1.6;
    b.box(w, 0.06, 0.4, 0, 0.45, 0, "#6a5a48");
    b.box(w, 0.4, 0.05, 0, 0.75, -0.2, "#5d4f3f");
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) b.box(0.05, 0.45, 0.35, x, 0.225, 0, "#3a3a3a");
    b.solid(w, 0.45);
  },

  ashtray(b) {
    b.cylinder(0.04, 0.7, 0, 0.35, 0, "#777777");
    b.cylinder(0.18, 0.05, 0, 0.72, 0, "#8a8a8a", 14);
    b.cylinder(0.15, 0.02, 0, 0.75, 0, "#3b3b3b", 14);
    b.solid(0.3, 0.3);
  },

  wheelchair(b) {
    b.box(0.5, 0.06, 0.45, 0, 0.5, 0, "#2d2d33");
    b.box(0.5, 0.5, 0.05, 0, 0.8, -0.22, "#2d2d33");
    for (const x of [-0.29, 0.29]) {
      const wheel = b.cylinder(0.3, 0.04, x, 0.3, -0.05, "#9aa3a8", 16);
      wheel.rotation.z = Math.PI / 2;
      b.box(0.04, 0.04, 0.35, x, 0.62, 0.02, "#9aa3a8");
    }
    for (const x of [-0.2, 0.2]) b.cylinder(0.07, 0.04, x, 0.07, 0.25, "#333333").rotation.z = Math.PI / 2;
    b.box(0.45, 0.03, 0.12, 0, 0.12, 0.33, "#9aa3a8");
    b.solid(0.7, 0.75);
  },

  radio(b) {
    b.box(0.45, 0.55, 0.4, 0, 0.275, 0, "#8b7355");
    b.box(0.3, 0.18, 0.12, 0, 0.64, 0, "#6b4f36");
    b.box(0.1, 0.1, 0.01, -0.07, 0.64, 0.061, "#d9c9a0");
    b.box(0.02, 0.25, 0.02, 0.12, 0.85, -0.03, "#999999");
    b.solid(0.45, 0.4);
  },

  terminal(b) {
    b.box(1.2, 0.75, 0.7, 0, 0.375, 0, "#5d544a");
    b.box(0.5, 0.42, 0.5, 0, 0.96, -0.08, "#c9c3b0");
    const screenTexture = (() => {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 24;
      const g = canvas.getContext("2d");
      g.fillStyle = "#031a0c";
      g.fillRect(0, 0, 32, 24);
      g.fillStyle = "#5ef2a0";
      const r = makeRng(7);
      for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) if (r() > 0.4) g.fillRect(2 + col * 4, 2 + row * 4, 3, 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      return texture;
    })();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: screenTexture }));
    screen.position.set(0, 0.98, 0.171);
    b.group.add(screen);
    b.box(0.45, 0.03, 0.18, 0, 0.765, 0.22, "#bdb7a4");
    b.light("#7dffb4", 2.2, 5, 0, 1.1, 0.8, true);
    b.solid(1.2, 0.7);
  },

  rusty_key(b) {
    const rust = mat("#8b4a22");
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12), rust);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.012;
    b.group.add(ring);
    b.box(0.12, 0.015, 0.02, 0.09, 0.01, 0, rust);
    b.box(0.02, 0.015, 0.04, 0.14, 0.01, 0.02, rust);
    b.group.rotation.y += 0.7;
  },

  keypad(b) {
    b.box(0.16, 0.24, 0.05, 0, 1.3, 0, "#1c1f22");
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({ color: "#ff3b3b" }));
    led.position.set(0.05, 1.39, 0.026);
    b.group.add(led);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) b.box(0.03, 0.03, 0.01, -0.04 + col * 0.04, 1.33 - row * 0.045, 0.028, "#6d7378");
    b.light("#ff4040", 0.6, 2.5, 0, 1.35, 0.3);
  },

  path(b, p) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.w || 1, p.d || 1), mat("#8d8472"));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.006;
    b.group.add(mesh);
  },

  tree(b, p) {
    const rng = makeRng(p.x * 3 + p.z * 5);
    b.box(0.35, 1.8, 0.35, 0, 0.9, 0, "#5b4030");
    const green = ["#3f6b3a", "#4a7a41", "#35602f"];
    b.box(2.4, 1.4, 2.4, 0, 2.4, 0, green[Math.floor(rng() * 3)]);
    b.box(1.6, 0.9, 1.6, (rng() - 0.5) * 0.4, 3.5, (rng() - 0.5) * 0.4, green[Math.floor(rng() * 3)]);
    b.solid(0.4, 0.4);
  },

  garden_bench(b) {
    b.box(1.6, 0.06, 0.45, 0, 0.45, 0, "#4f5d3a");
    b.box(1.6, 0.35, 0.05, 0, 0.72, -0.22, "#4f5d3a");
    for (const x of [-0.7, 0.7]) b.box(0.05, 0.45, 0.4, x, 0.225, 0, "#222222");
    b.solid(1.6, 0.5);
  },

  lamp(b) {
    b.cylinder(0.05, 2.7, 0, 1.35, 0, "#2b2f33");
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: "#ffe9b0" }));
    head.position.y = 2.8;
    b.group.add(head);
    b.light("#ffdca0", 7, 13, 0, 2.6, 0);
    b.solid(0.2, 0.2);
  },

  bush(b) {
    b.box(1.2, 0.9, 1.2, 0, 0.45, 0, "#3a6634");
    b.box(0.7, 0.4, 0.7, 0.1, 1.05, 0.05, "#447539");
    b.solid(1.0, 1.0);
  },
};

export function buildProp(ctx, room, prop) {
  const build = BUILDERS[prop.type];
  if (!build) {
    console.warn(`Unknown prop type "${prop.type}" in ${room.id}`);
    return;
  }
  build(new Builder(ctx, prop), prop);
}
