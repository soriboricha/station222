import logging
import re

from openai import OpenAIError
from pydantic import ValidationError

from app.llm import LLMClient
from app.npcs import NpcSpec
from app.prompt import build_messages
from app.schemas import GameStateUpdate, InteractRequest, NpcResponse

logger = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def extract_json(raw: str) -> str:
    text = _FENCE_RE.sub("", raw.strip())
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end < start:
        return text
    return text[start : end + 1]


def secret_revealed(npc: NpcSpec, dialogue: str) -> bool:
    return re.search(rf"(?<!\d){re.escape(npc.secret_token)}(?!\d)", dialogue) is not None


def enforce_rules(npc: NpcSpec, request: InteractRequest, response: NpcResponse) -> NpcResponse:
    """The LLM proposes a state change; the server decides what is actually allowed."""
    update = response.game_state_update
    status = update.status
    trigger = update.trigger_event if update.trigger_event in npc.allowed_trigger_events else "none"

    if secret_revealed(npc, response.npc_dialogue):
        status, trigger = "defeated", "revealed_secret"
    elif status == "defeated":
        logger.warning("LLM claimed defeat for %s without revealing the secret; downgrading", npc.id)
        status = "active"
        if trigger == "revealed_secret":
            trigger = "none"

    if status == "hostile" and trigger == "none":
        trigger = "turned_hostile"

    allowed_items = set(npc.giveable_items) | set(request.room_state.items_present)
    owned = set(request.room_state.player_inventory)
    items: list[str] = []
    for item in update.items_given_to_player:
        if item in allowed_items and item not in owned and item not in items:
            items.append(item)

    if items and trigger == "none":
        trigger = "gave_item"
    elif not items and trigger == "gave_item":
        trigger = "none"

    return response.model_copy(
        update={
            "game_state_update": GameStateUpdate(
                status=status, trigger_event=trigger, items_given_to_player=items
            )
        }
    )


def fallback_response(npc: NpcSpec) -> NpcResponse:
    return NpcResponse(
        npc_dialogue=npc.fallback_dialogue,
        npc_action_description=npc.fallback_action,
        game_state_update=GameStateUpdate(status="active", trigger_event="none"),
    )


async def run_turn(
    npc: NpcSpec,
    request: InteractRequest,
    llm: LLMClient,
    *,
    max_attempts: int,
    max_history: int,
) -> NpcResponse:
    messages = build_messages(npc, request, max_history)
    for attempt in range(1, max_attempts + 1):
        try:
            raw = await llm.complete(messages)
        except OpenAIError:
            logger.exception("LLM call failed for %s (attempt %d)", npc.id, attempt)
            continue
        try:
            parsed = NpcResponse.model_validate_json(extract_json(raw))
        except ValidationError as exc:
            logger.warning("Invalid LLM output for %s (attempt %d): %s", npc.id, attempt, exc)
            continue
        return enforce_rules(npc, request, parsed)
    return fallback_response(npc)
