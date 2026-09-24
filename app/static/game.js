const NPC_ID = new URLSearchParams(location.search).get("npc") || "patient-404";
const STORAGE_KEY = `station222:${NPC_ID}`;

const $ = (id) => document.getElementById(id);
const els = {
  location: $("location"),
  status: $("status"),
  restart: $("restart"),
  sprite: $("npc-sprite"),
  spritePlaceholder: $("sprite-placeholder"),
  npcName: $("npc-name"),
  roomItems: $("room-items"),
  inventory: $("inventory"),
  log: $("log"),
  banner: $("banner"),
  composer: $("composer"),
  input: $("input"),
  send: $("send"),
};

const STATUS_LABELS = { active: "calm", hostile: "hostile", defeated: "bypassed" };

let npc = null;
let state = null;
let busy = false;

function freshState() {
  return {
    status: "active",
    roomItems: [...npc.room_items],
    inventory: [...npc.starting_inventory],
    newItems: [],
    history: [
      {
        role: "assistant",
        content: JSON.stringify({
          npc_dialogue: npc.opening_line,
          npc_action_description: npc.opening_action,
        }),
      },
    ],
    log: [
      { type: "narration", text: npc.intro_narration },
      { type: "npc", text: npc.opening_line, action: npc.opening_action },
    ],
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.history) && Array.isArray(saved.log)) return saved;
  } catch {}
  return null;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEntry(entry) {
  if (entry.type === "npc") {
    const node = el("div", "entry npc");
    node.append(el("div", "speaker", shortName()));
    if (entry.action) node.append(el("div", "action", entry.action));
    node.append(el("div", "dialogue", entry.text));
    return node;
  }
  return el("div", `entry ${entry.type} ${entry.variant || ""}`.trim(), entry.text);
}

function shortName() {
  const match = npc.name.match(/"(.+)"/);
  return match ? match[1] : npc.name;
}

function renderItems(list, items, highlight = []) {
  list.replaceChildren();
  if (!items.length) {
    list.append(el("li", "empty", "nothing"));
    return;
  }
  for (const item of items) list.append(el("li", highlight.includes(item) ? "new" : "", item));
}

function render() {
  els.log.replaceChildren(...state.log.map(renderEntry));
  renderItems(els.roomItems, state.roomItems);
  renderItems(els.inventory, state.inventory, state.newItems);

  els.status.dataset.status = state.status;
  els.status.textContent = STATUS_LABELS[state.status] || state.status;

  const over = state.status === "defeated";
  els.banner.hidden = state.status === "active";
  els.banner.className = `banner ${state.status}`;
  els.banner.textContent = over
    ? "ACCESS GRANTED: you got what you came for. Restart to try a different approach."
    : "He has shut down. Maybe you can talk him back down… carefully.";

  els.input.disabled = over || busy;
  els.send.disabled = over || busy;
  scrollToBottom();
}

function scrollToBottom() {
  els.log.scrollTop = els.log.scrollHeight;
}

function showTyping() {
  const node = el("div", "entry npc typing");
  node.append(el("div", "speaker", shortName()), el("div", "dialogue", ""));
  els.log.append(node);
  scrollToBottom();
  return node;
}

function applyResponse(response) {
  const update = response.game_state_update;
  state.log.push({ type: "npc", text: response.npc_dialogue, action: response.npc_action_description });
  state.history.push({
    role: "assistant",
    content: JSON.stringify({
      npc_dialogue: response.npc_dialogue,
      npc_action_description: response.npc_action_description,
    }),
  });

  state.newItems = [];
  for (const item of update.items_given_to_player) {
    if (!state.inventory.includes(item)) state.inventory.push(item);
    state.roomItems = state.roomItems.filter((i) => i !== item);
    state.newItems.push(item);
    state.log.push({ type: "system", text: `Received: ${item}` });
  }

  if (update.status !== state.status) {
    if (update.status === "hostile") state.log.push({ type: "system", variant: "error", text: "He turns hostile." });
    if (update.status === "active" && state.status === "hostile") state.log.push({ type: "system", text: "He calms down, a little." });
    if (update.status === "defeated") state.log.push({ type: "system", variant: "win", text: "Secret obtained." });
  }
  state.status = update.status;
}

async function sendTurn(text) {
  busy = true;
  state.log.push({ type: "player", text });
  render();
  const typing = showTyping();

  try {
    const res = await fetch(`/api/npcs/${encodeURIComponent(NPC_ID)}/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_input: text,
        conversation_history: state.history,
        room_state: { items_present: state.roomItems, player_inventory: state.inventory },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const response = await res.json();
    state.history.push({ role: "user", content: text });
    applyResponse(response);
  } catch (err) {
    console.error(err);
    state.log.pop();
    els.input.value = text;
    state.log.push({ type: "system", variant: "error", text: "Signal lost. Your words didn't reach him; try again." });
  } finally {
    typing.remove();
    busy = false;
    save();
    render();
    els.input.focus();
  }
}

function setupSprite() {
  els.sprite.onload = () => {
    els.sprite.hidden = false;
    els.spritePlaceholder.hidden = true;
  };
  els.sprite.onerror = () => {
    els.sprite.hidden = true;
    els.spritePlaceholder.hidden = false;
  };
  els.sprite.alt = npc.name;
  els.sprite.src = `/static/sprites/${npc.id}.png`;
}

async function init() {
  try {
    const res = await fetch(`/api/npcs/${encodeURIComponent(NPC_ID)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    npc = await res.json();
  } catch (err) {
    console.error(err);
    els.location.textContent = "Connection failed";
    els.log.append(el("div", "entry system error", "Could not reach the facility. Reload to try again."));
    els.input.disabled = els.send.disabled = true;
    return;
  }

  document.title = `STATION222 · ${npc.location}`;
  els.location.textContent = npc.location;
  els.npcName.textContent = npc.name;
  setupSprite();

  state = load() || freshState();
  render();
  els.input.focus();
}

els.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.input.value.trim();
  if (!text || busy || state.status === "defeated") return;
  els.input.value = "";
  sendTurn(text);
});

els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.composer.requestSubmit();
  }
});

els.restart.addEventListener("click", () => {
  if (!npc || busy) return;
  if (!confirm("Start this encounter over? The conversation will be lost.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = freshState();
  render();
  els.input.focus();
});

init();
