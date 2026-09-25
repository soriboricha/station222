from typing import Any, Literal

from pydantic import BaseModel, Field


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class RoomState(BaseModel):
    items_present: list[str] = Field(default_factory=list)
    player_inventory: list[str] = Field(default_factory=list)


class InteractRequest(BaseModel):
    player_input: str = Field(min_length=1, max_length=1000)
    conversation_history: list[HistoryMessage] = Field(default_factory=list, max_length=200)
    room_state: RoomState = Field(default_factory=RoomState)


Status = Literal["active", "defeated", "hostile"]


class GameStateUpdate(BaseModel):
    status: Status
    trigger_event: str = "none"
    items_given_to_player: list[str] = Field(default_factory=list)


class NpcResponse(BaseModel):
    npc_dialogue: str
    npc_action_description: str
    game_state_update: GameStateUpdate = Field(default_factory=lambda: GameStateUpdate(status="active"))


class NpcSummary(BaseModel):
    id: str
    name: str
    location: str
    room: str


class Spawn(BaseModel):
    room: str
    x: float
    z: float
    yaw: float


class WorldInfo(BaseModel):
    station_id: int
    station_name: str
    wall_height: float
    spawns: dict[str, Spawn]
    rooms: list[dict[str, Any]]
    walls: list[dict[str, Any]]
    npcs: list[NpcSummary]


class NpcDetail(NpcSummary):
    intro_narration: str
    opening_line: str
    opening_action: str
    room_items: list[str]
