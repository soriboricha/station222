import logging
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings, get_settings
from app.engine import run_turn
from app.llm import LLMClient, OpenAICompatibleClient
from app.npcs import NPCS, NpcSpec
from app.schemas import (
    InteractRequest,
    NpcDetail,
    NpcPlacement,
    NpcResponse,
    NpcSummary,
    WorldInfo,
)
from app.world import STATION

logging.basicConfig(level=logging.INFO)

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="STATION222 NPC Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

_llm_client: LLMClient | None = None


def get_llm(settings: Annotated[Settings, Depends(get_settings)]) -> LLMClient:
    global _llm_client
    if _llm_client is None:
        if not settings.llm_api_key or not settings.llm_model:
            raise HTTPException(status_code=503, detail="LLM_API_KEY and LLM_MODEL must be configured")
        _llm_client = OpenAICompatibleClient(settings)
    return _llm_client


def get_npc(npc_id: str) -> NpcSpec:
    npc = NPCS.get(npc_id)
    if npc is None:
        raise HTTPException(status_code=404, detail=f"Unknown NPC '{npc_id}'")
    return npc


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/world", response_model=WorldInfo)
async def world() -> WorldInfo:
    return WorldInfo(
        station_id=STATION.id,
        station_name=STATION.name,
        first_room=STATION.first_room,
        last_room=STATION.last_room,
        spawns=STATION.spawns,
        npcs=[
            NpcPlacement(
                id=n.id, name=n.name, location=n.location, room=n.room, room_items=list(n.room_items)
            )
            for n in NPCS.values()
        ],
    )


@app.get("/api/npcs", response_model=list[NpcSummary])
async def list_npcs() -> list[NpcSummary]:
    return [NpcSummary(id=n.id, name=n.name, location=n.location, room=n.room) for n in NPCS.values()]


@app.get("/api/npcs/{npc_id}", response_model=NpcDetail)
async def npc_detail(npc: Annotated[NpcSpec, Depends(get_npc)]) -> NpcDetail:
    return NpcDetail(
        id=npc.id,
        name=npc.name,
        location=npc.location,
        room=npc.room,
        intro_narration=npc.intro_narration,
        opening_line=npc.opening_line,
        opening_action=npc.opening_action,
        room_items=list(npc.room_items),
        starting_inventory=list(npc.starting_inventory),
    )


@app.post("/api/npcs/{npc_id}/interact", response_model=NpcResponse)
async def interact(
    npc: Annotated[NpcSpec, Depends(get_npc)],
    request: InteractRequest,
    llm: Annotated[LLMClient, Depends(get_llm)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> NpcResponse:
    return await run_turn(
        npc,
        request,
        llm,
        max_attempts=settings.max_llm_attempts,
        max_history=settings.max_history_messages,
    )
