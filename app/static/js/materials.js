import * as THREE from "three";

function rng(seedText) {
  let h = 2166136261;
  for (const ch of String(seedText)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pixel-art canvas texture tiled every `metersX` x `metersY` (UVs are in meters). */
function tex(width, height, metersX, metersY, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / metersX, 1 / metersY);
  return texture;
}

function noise(ctx, w, h, colors, count, size = 1, seed = "n") {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), size, size);
  }
}

function tiles(base, grout, speckles, seed) {
  return tex(16, 16, 0.5, 0.5, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, speckles, 40, 1, seed);
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(0, 0, 1, h);
  });
}

/** Wall textures cover 1 m wide x 3 m tall so they can carry a lower wainscot band. */
function wallTex(upper, lower, speckles, seed, extra) {
  return tex(16, 48, 1, 3, (ctx, w, h) => {
    ctx.fillStyle = upper;
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, speckles, 60, 1, seed);
    if (lower) {
      ctx.fillStyle = lower;
      ctx.fillRect(0, h - 16, w, 16);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, h - 17, w, 1);
    }
    extra?.(ctx, w, h);
  });
}

const FLOOR_TEXTURES = {
  tile: () => tiles("#cfc7b0", "#9c9480", ["#c4bca5", "#d8d0ba"], "tile"),
  corridor: () => tiles("#97a59d", "#6d7a73", ["#8d9b93", "#a1afa7"], "corr"),
  dark: () => tiles("#4a4038", "#2e2822", ["#433a33", "#55493f"], "dark"),
  checker: () =>
    tex(2, 2, 1, 1, (ctx) => {
      ctx.fillStyle = "#e6e2d8";
      ctx.fillRect(0, 0, 2, 2);
      ctx.fillStyle = "#3b3f44";
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillRect(1, 1, 1, 1);
    }),
  linoleum: () =>
    tex(16, 16, 1, 1, (ctx, w, h) => {
      ctx.fillStyle = "#a9c0c9";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, ["#9bb3bd", "#b8cdd5", "#8fa7b1"], 70, 1, "lino");
    }),
  carpet: () =>
    tex(16, 16, 1, 1, (ctx, w, h) => {
      ctx.fillStyle = "#7a4a4a";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, ["#6c3f40", "#865556", "#713f47"], 140, 1, "carpet");
    }),
  wood: () =>
    tex(16, 16, 1, 1, (ctx, w, h) => {
      const r = rng("wood");
      for (let i = 0; i < 4; i++) {
        const shade = 120 + Math.floor(r() * 30);
        ctx.fillStyle = `rgb(${shade + 40},${shade},${shade - 50})`;
        ctx.fillRect(0, i * 4, w, 4);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(0, i * 4, w, 1);
        ctx.fillRect(Math.floor(r() * w), i * 4, 1, 4);
      }
    }),
  padded: () =>
    tex(8, 8, 0.5, 0.5, (ctx, w, h) => {
      ctx.fillStyle = "#eef0f2";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#cfd4d9";
      ctx.fillRect(0, 0, w, 1);
      ctx.fillRect(0, 0, 1, h);
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(3, 3, 2, 2);
    }),
  grass: () =>
    tex(16, 16, 1, 1, (ctx, w, h) => {
      ctx.fillStyle = "#3e6b34";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, ["#36602e", "#4a7a3d", "#2f5628", "#557f45"], 160, 1, "grass");
    }),
};

const WALL_TEXTURES = {
  plaster: () => wallTex("#b3c2b6", "#7f9486", ["#aab9ad", "#bccbbf"], "plaster"),
  warm: () => wallTex("#d8c8a6", "#8a6a4a", ["#cfbf9d", "#e0d0ae"], "warm"),
  stained: () =>
    wallTex("#b5ab82", "#6f6448", ["#a89e76", "#9c9270", "#c2b890"], "stained", (ctx, w) => {
      ctx.fillStyle = "rgba(90,70,20,0.25)";
      ctx.fillRect(3, 4, 6, 10);
      ctx.fillRect(10, 18, 4, 7);
    }),
  exterior: () => wallTex("#b8b2a4", "#8f897c", ["#aea898", "#c2bcae"], "ext"),
  tile: () =>
    tex(16, 16, 0.5, 0.5, (ctx, w, h) => {
      ctx.fillStyle = "#e9eef0";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#b7c0c4";
      ctx.fillRect(0, 0, w, 1);
      ctx.fillRect(0, 8, w, 1);
      ctx.fillRect(0, 0, 1, h);
      ctx.fillRect(8, 0, 1, h);
    }),
  padded: () => FLOOR_TEXTURES.padded(),
  wallpaper: () =>
    wallTex("#6e1f2a", "#4a2c1c", ["#661c26", "#772431"], "paper", (ctx, w) => {
      ctx.fillStyle = "#b48a3c";
      for (let y = 2; y < 32; y += 6) for (let x = (y / 6) % 2 ? 2 : 6; x < w; x += 8) ctx.fillRect(x, y, 2, 2);
    }),
  brick: () =>
    tex(16, 16, 1, 0.5, (ctx, w, h) => {
      ctx.fillStyle = "#8c4a36";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, ["#7d4030", "#9a5540", "#824634"], 50, 1, "brick");
      ctx.fillStyle = "#b9ab98";
      ctx.fillRect(0, 0, w, 1);
      ctx.fillRect(0, 8, w, 1);
      ctx.fillRect(0, 0, 1, 8);
      ctx.fillRect(8, 8, 1, 8);
    }),
};

const floorCache = new Map();
const wallCache = new Map();

export function floorMaterial(kind) {
  if (!floorCache.has(kind)) {
    const make = FLOOR_TEXTURES[kind] || FLOOR_TEXTURES.tile;
    floorCache.set(kind, new THREE.MeshLambertMaterial({ map: make() }));
  }
  return floorCache.get(kind);
}

export function wallMaterial(style) {
  if (!wallCache.has(style)) {
    const make = WALL_TEXTURES[style] || WALL_TEXTURES.plaster;
    wallCache.set(style, new THREE.MeshLambertMaterial({ map: make() }));
  }
  return wallCache.get(style);
}

export const MATERIALS = {
  ceiling: new THREE.MeshLambertMaterial({ color: "#d7dbd4", side: THREE.DoubleSide }),
  lightPanel: new THREE.MeshBasicMaterial({ color: "#f2fff6" }),
  wallEdge: new THREE.MeshLambertMaterial({ color: "#9aa89e" }),
  glass: new THREE.MeshLambertMaterial({
    color: "#a9d8ef",
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  door: new THREE.MeshLambertMaterial({ color: "#4f6879" }),
  knob: new THREE.MeshLambertMaterial({ color: "#cfd3d6" }),
  iron: new THREE.MeshLambertMaterial({ color: "#2a2d30" }),
};

export function signTexture(text, aspect) {
  const canvas = document.createElement("canvas");
  canvas.height = 64;
  canvas.width = Math.round(64 * aspect);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1d2a33";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#8fb3c7";
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.fillStyle = "#e9f3f8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 40;
  ctx.font = `bold ${size}px monospace`;
  while (ctx.measureText(text).width > canvas.width - 16 && size > 12) {
    size -= 2;
    ctx.font = `bold ${size}px monospace`;
  }
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const PALETTES = [
  ["#1b2a2f", "#3f6f6a", "#c9b27c", "#e8dcc0", "#7a2e2e"],
  ["#2b1d33", "#6b3f7a", "#d9a441", "#f0e2c4", "#2f5d62"],
  ["#10161c", "#2e4a3a", "#88a07a", "#d6d0b0", "#a33b2a"],
  ["#3a2618", "#8c5a2b", "#e0b86a", "#f4ead2", "#3b5570"],
];

/** Small procedural paintings: strange figures, eyes, spirals. Deterministic per `art` name. */
export function artTexture(art) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  const r = rng(art);
  const px = (c, x, y, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  };

  if (art === "map") {
    canvas.width = 48;
    canvas.height = 32;
    px("#e8dcb8", 0, 0, 48, 32);
    for (let i = 0; i < 40; i++) px("#c9b98f", r() * 48, r() * 32, 2, 1);
    for (let i = 0; i < 9; i++) {
      const x = 4 + r() * 38;
      const y = 8 + r() * 18;
      for (let k = 0; k < 5; k++) px("#7a6a4a", x - k, y + k, 2 * k + 1, 1);
    }
    ctx.strokeStyle = "#c0282d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(34, 12, 5, 0, Math.PI * 2);
    ctx.stroke();
    px("#ffffff", 33, 7, 2, 2);
  } else if (art === "drowned-choir") {
    canvas.width = 48;
    canvas.height = 32;
    px("#0d1f1a", 0, 0, 48, 32);
    for (let i = 0; i < 60; i++) px(r() > 0.5 ? "#15332a" : "#0a1612", r() * 48, r() * 32, 2, 2);
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 7 + r() * 2;
      const y = 10 + r() * 8;
      px("#b9c8b8", x, y, 4, 5);
      px("#0d1f1a", x + 1, y + 1);
      px("#0d1f1a", x + 2, y + 1);
      px("#0d1f1a", x + 1, y + 3, 2, 1);
      px("#3d5a4f", x, y + 5, 4, 8);
    }
    for (let i = 0; i < 25; i++) px("#6fa89a", r() * 48, r() * 12, 1, 1);
  } else {
    const palette = PALETTES[Math.floor(r() * PALETTES.length)];
    px(palette[0], 0, 0, 32, 40);
    for (let i = 0; i < 90; i++) px(palette[1], r() * 32, r() * 40, 2, 2);
    const motif = Math.floor(r() * 3);
    if (motif === 0) {
      // A tall faceless figure
      px(palette[3], 13, 8, 6, 7);
      px(palette[2], 11, 15, 10, 18);
      px(palette[4], 14, 11, 4, 1);
    } else if (motif === 1) {
      // One enormous eye
      px(palette[3], 6, 14, 20, 10);
      px(palette[2], 12, 15, 8, 8);
      px(palette[0], 15, 17, 3, 4);
      px(palette[4], 6, 13, 20, 1);
    } else {
      // A spiral of dots
      for (let a = 0; a < 26; a += 0.35) {
        px(palette[2 + (Math.floor(a) % 3)], 16 + Math.cos(a) * a * 0.55, 20 + Math.sin(a) * a * 0.55, 2, 2);
      }
    }
    for (let i = 0; i < 12; i++) px(palette[3], r() * 32, r() * 40);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}
