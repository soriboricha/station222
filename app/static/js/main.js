import * as THREE from "three";
import { Chat } from "./chat.js";
import { createNpc } from "./npc.js";
import { Player } from "./player.js";
import { buildStation } from "./world.js";

// ?slot=player2 spawns as the second player; ?room=<number> overrides the spawn room (for testing).
const params = new URLSearchParams(location.search);
const PLAYER_SLOT = params.get("slot") || "player1";
const ROOM_OVERRIDE = Number(params.get("room")) || null;
const STARTING_INVENTORY = ["Doctor Badge"];
const INTERACT_RANGE = 2.6;

const els = {
  viewport: document.getElementById("viewport"),
  location: document.getElementById("hud-location"),
  prompt: document.getElementById("hud-prompt"),
  overlay: document.getElementById("overlay"),
  overlaySub: document.getElementById("overlay-sub"),
  overlayBtn: document.getElementById("overlay-btn"),
};

async function main() {
  let world;
  try {
    const res = await fetch("/api/world");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    world = await res.json();
  } catch (err) {
    console.error(err);
    els.overlaySub.textContent = "Could not reach the facility. Reload to try again.";
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  els.viewport.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b0f0d");
  scene.fog = new THREE.Fog("#0b0f0d", 8, 34);
  scene.add(new THREE.HemisphereLight("#eef7f0", "#3a3f3a", 1.6));

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 100);

  const station = buildStation(scene, world);
  const npcs = world.npcs.map((placement) => createNpc(scene, station, placement)).filter(Boolean);

  const player = new Player(camera, station);
  const spawnRoom = station.rooms.has(ROOM_OVERRIDE) ? ROOM_OVERRIDE : world.spawns[PLAYER_SLOT] ?? world.spawns.player1;
  player.spawn(station.spawnPoint(spawnRoom));

  const canvas = renderer.domElement;
  const lockPointer = () => {
    const result = canvas.requestPointerLock?.();
    result?.catch?.(() => showOverlay("Click to resume"));
  };

  const chat = new Chat({
    startingInventory: STARTING_INVENTORY,
    onClose: ({ viaButton }) => {
      if (viaButton) lockPointer();
      else showOverlay("Click to resume");
    },
  });

  function showOverlay(text) {
    els.overlaySub.textContent = text;
    els.overlayBtn.textContent = "Resume";
    els.overlay.hidden = false;
  }

  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    player.setActive(locked);
    if (locked) els.overlay.hidden = true;
    else if (!chat.isOpen) showOverlay("Paused");
  });

  els.overlayBtn.addEventListener("click", lockPointer);
  els.overlaySub.textContent = `You wake up in ${world.station_name}, Room ${spawnRoom}.`;
  els.overlayBtn.disabled = false;

  const raycaster = new THREE.Raycaster();
  raycaster.far = INTERACT_RANGE;
  const center = new THREE.Vector2(0, 0);
  let target = null;

  function findTarget() {
    raycaster.setFromCamera(center, camera);
    const hit = raycaster.intersectObjects(station.interactables, false)[0];
    return hit?.object.userData.interact ?? null;
  }

  function promptFor(t) {
    if (!t) return "";
    if (t.type === "door") return `[E] ${t.door.open ? "Close" : "Open"} door ${t.door.room}`;
    if (t.type === "npc") return `[E] Talk to ${t.npc.name}`;
    return "";
  }

  document.addEventListener("keydown", (event) => {
    if (chat.isOpen) {
      if (event.key === "Escape") chat.close();
      return;
    }
    if (!player.active || event.code !== "KeyE" || !target) return;
    if (target.type === "door") target.door.toggle();
    if (target.type === "npc") {
      chat.open(target.npc);
      document.exitPointerLock();
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let lastLocation = "";
  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    if (player.active) player.update(dt);
    station.update(dt, time);
    for (const npc of npcs) npc.update(camera);

    target = player.active ? findTarget() : null;
    const prompt = promptFor(target);
    els.prompt.hidden = !prompt;
    els.prompt.textContent = prompt;

    const room = station.roomAt(player.x, player.z);
    const location = `${world.station_name} · ${room ? `Room ${room}` : "Corridor"}`;
    if (location !== lastLocation) {
      els.location.textContent = location;
      lastLocation = location;
    }

    renderer.render(scene, camera);
  });
}

main();
