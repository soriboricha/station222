import logging
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.engine import run_turn
from app.llm import LLMClient, OpenAICompatibleClient
from app.npcs import NPCS
from app.schemas import InteractRequest, NpcResponse, NpcSummary

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="STATION222 NPC Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_llm_client: LLMClient | None = None


def get_llm(settings: Annotated[Settings, Depends(get_settings)]) -> LLMClient:
    global _llm_client
    if _llm_client is None:
        if not settings.llm_api_key or not settings.llm_model:
            raise HTTPException(status_code=503, detail="LLM_API_KEY and LLM_MODEL must be configured")
        _llm_client = OpenAICompatibleClient(settings)
    return _llm_client


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/npcs", response_model=list[NpcSummary])
async def list_npcs() -> list[NpcSummary]:
    return [NpcSummary(id=n.id, name=n.name, location=n.location) for n in NPCS.values()]


@app.post("/api/npcs/{npc_id}/interact", response_model=NpcResponse)
async def interact(
    npc_id: str,
    request: InteractRequest,
    llm: Annotated[LLMClient, Depends(get_llm)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> NpcResponse:
    npc = NPCS.get(npc_id)
    if npc is None:
        raise HTTPException(status_code=404, detail=f"Unknown NPC '{npc_id}'")
    return await run_turn(
        npc,
        request,
        llm,
        max_attempts=settings.max_llm_attempts,
        max_history=settings.max_history_messages,
    )
