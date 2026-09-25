const INVENTORY_KEY = "station222:inventory";
const STATUS_LABELS = { active: "calm", hostile: "hostile", defeated: "bypassed" };

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export class Chat {
  constructor({ startingInventory, onClose }) {
    this.onClose = onClose;
    this.els = {
      root: $("chat"),
      npcName: $("chat-npc"),
      room: $("chat-room"),
      status: $("status"),
      reset: $("chat-reset"),
      close: $("chat-close"),
      sprite: $("chat-sprite"),
      spritePlaceholder: $("chat-sprite-placeholder"),
      roomItems: $("room-items"),
      inventory: $("inventory"),
      log: $("log"),
      banner: $("banner"),
      composer: $("composer"),
      input: $("input"),
      send: $("send"),
    };
    this.npc = null;
    this.state = null;
    this.busy = false;
    this.details = new Map();
    this.inventory = readJson(INVENTORY_KEY) || [...startingInventory];
    this.newItems = [];

    this.els.composer.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = this.els.input.value.trim();
      if (!text || this.busy || !this.state || this.state.status === "defeated") return;
      this.els.input.value = "";
      this.sendTurn(text);
    });
    this.els.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.els.composer.requestSubmit();
      }
    });
    this.els.close.addEventListener("click", () => this.close({ viaButton: true }));
    this.els.reset.addEventListener("click", () => this.reset());
  }

  get isOpen() {
    return !this.els.root.hidden;
  }

  storageKey() {
    return `station222:npc:${this.npc.id}`;
  }

  async open(placement) {
    this.els.root.hidden = false;
    this.els.npcName.textContent = placement.name;
    this.els.room.textContent = placement.location;
    this.els.log.replaceChildren(el("div", "entry system", "…"));
    this.setInputEnabled(false);

    try {
      if (!this.details.has(placement.id)) {
        const res = await fetch(`/api/npcs/${encodeURIComponent(placement.id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.details.set(placement.id, await res.json());
      }
    } catch (err) {
      console.error(err);
      this.els.log.replaceChildren(el("div", "entry system error", "He doesn't seem to hear you. Try again."));
      return;
    }
    if (!this.isOpen) return;

    this.npc = this.details.get(placement.id);
    this.state = this.load() || this.freshState();
    this.setupSprite();
    this.render();
    this.els.input.focus();
  }

  close({ viaButton = false } = {}) {
    if (!this.isOpen) return;
    this.els.root.hidden = true;
    this.els.input.blur();
    this.onClose?.({ viaButton });
  }

  reset() {
    if (!this.npc || this.busy) return;
    if (!confirm("Start this conversation over?")) return;
    localStorage.removeItem(this.storageKey());
    this.state = this.freshState();
    this.render();
    this.els.input.focus();
  }

  freshState() {
    const npc = this.npc;
    return {
      status: "active",
      roomItems: [...npc.room_items],
      history: [
        {
          role: "assistant",
          content: JSON.stringify({
            npc_dialogue: npc.opening_line,
            npc_action_description: npc.opening_action,
            game_state_update: { status: "active", trigger_event: "none", items_given_to_player: [] },
          }),
        },
      ],
      log: [
        { type: "narration", text: npc.intro_narration },
        { type: "npc", text: npc.opening_line, action: npc.opening_action },
      ],
    };
  }

  load() {
    const saved = readJson(this.storageKey());
    return saved && Array.isArray(saved.history) && Array.isArray(saved.log) ? saved : null;
  }

  save() {
    localStorage.setItem(this.storageKey(), JSON.stringify(this.state));
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(this.inventory));
  }

  shortName() {
    const match = this.npc.name.match(/"(.+)"/);
    return match ? match[1] : this.npc.name;
  }

  setupSprite() {
    const { sprite, spritePlaceholder } = this.els;
    sprite.onload = () => {
      sprite.hidden = false;
      spritePlaceholder.hidden = true;
    };
    sprite.onerror = () => {
      sprite.hidden = true;
      spritePlaceholder.hidden = false;
    };
    sprite.alt = this.npc.name;
    sprite.src = `/static/sprites/${this.npc.id}.png`;
  }

  renderEntry(entry) {
    if (entry.type === "npc") {
      const node = el("div", "entry npc");
      node.append(el("div", "speaker", this.shortName()));
      if (entry.action) node.append(el("div", "action", entry.action));
      node.append(el("div", "dialogue", entry.text));
      return node;
    }
    return el("div", `entry ${entry.type} ${entry.variant || ""}`.trim(), entry.text);
  }

  renderItems(list, items, highlight = []) {
    list.replaceChildren();
    if (!items.length) {
      list.append(el("li", "empty", "nothing"));
      return;
    }
    for (const item of items) list.append(el("li", highlight.includes(item) ? "new" : "", item));
  }

  setInputEnabled(enabled) {
    this.els.input.disabled = !enabled;
    this.els.send.disabled = !enabled;
  }

  render() {
    const { els, state } = this;
    els.log.replaceChildren(...state.log.map((e) => this.renderEntry(e)));
    this.renderItems(els.roomItems, state.roomItems);
    this.renderItems(els.inventory, this.inventory, this.newItems);

    els.status.dataset.status = state.status;
    els.status.textContent = STATUS_LABELS[state.status] || state.status;

    const over = state.status === "defeated";
    els.banner.hidden = state.status === "active";
    els.banner.className = `banner ${state.status}`;
    els.banner.textContent = over
      ? "ACCESS GRANTED: you got what you came for. Reset to try a different approach."
      : "He has shut down. Maybe you can talk him back down… carefully.";

    this.setInputEnabled(!over && !this.busy);
    els.log.scrollTop = els.log.scrollHeight;
  }

  showTyping() {
    const node = el("div", "entry npc typing");
    node.append(el("div", "speaker", this.shortName()), el("div", "dialogue", ""));
    this.els.log.append(node);
    this.els.log.scrollTop = this.els.log.scrollHeight;
    return node;
  }

  applyResponse(response) {
    const state = this.state;
    const update = response.game_state_update;
    state.log.push({ type: "npc", text: response.npc_dialogue, action: response.npc_action_description });
    // Keep assistant turns in the exact output schema so the model keeps producing it.
    state.history.push({ role: "assistant", content: JSON.stringify(response) });

    this.newItems = [];
    for (const item of update.items_given_to_player) {
      if (!this.inventory.includes(item)) this.inventory.push(item);
      state.roomItems = state.roomItems.filter((i) => i !== item);
      this.newItems.push(item);
      state.log.push({ type: "system", text: `Received: ${item}` });
    }

    if (update.status !== state.status) {
      if (update.status === "hostile") state.log.push({ type: "system", variant: "error", text: "He turns hostile." });
      if (update.status === "active" && state.status === "hostile") state.log.push({ type: "system", text: "He calms down, a little." });
      if (update.status === "defeated") state.log.push({ type: "system", variant: "win", text: "Secret obtained." });
    }
    state.status = update.status;
  }

  async sendTurn(text) {
    const npc = this.npc;
    const state = this.state;
    this.busy = true;
    state.log.push({ type: "player", text });
    this.render();
    const typing = this.showTyping();

    try {
      const res = await fetch(`/api/npcs/${encodeURIComponent(npc.id)}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_input: text,
          conversation_history: state.history,
          room_state: { items_present: state.roomItems, player_inventory: this.inventory },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const response = await res.json();
      state.history.push({ role: "user", content: text });
      this.applyResponse(response);
    } catch (err) {
      console.error(err);
      state.log.pop();
      this.els.input.value = text;
      state.log.push({ type: "system", variant: "error", text: "Signal lost. Your words didn't reach him; try again." });
    } finally {
      typing.remove();
      this.busy = false;
      this.save();
      if (this.npc === npc) {
        this.render();
        if (this.isOpen) this.els.input.focus();
      }
    }
  }
}
