"""Speech service for STATION222: Whisper speech-to-text and Kokoro text-to-speech on CPU.

Runs as its own container so a crash or overload here never takes the game server down;
the browser falls back to text chat whenever /health does not answer.
"""

import asyncio
import io
import logging
import os
import re
import time

import numpy as np
import onnxruntime as ort
import soundfile as sf
from fastapi import APIRouter, FastAPI, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

log = logging.getLogger("speech")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

MODELS_DIR = os.getenv("MODELS_DIR", "/models")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base.en")
WHISPER_THREADS = int(os.getenv("WHISPER_THREADS", "2"))
KOKORO_MODEL = os.getenv("KOKORO_MODEL", "kokoro-v1.0.onnx")
TTS_THREADS = int(os.getenv("TTS_THREADS", "2"))
MAX_AUDIO_BYTES = 3_000_000  # ~90 s of 16 kHz 16-bit mono
MAX_AUDIO_SECONDS = 30
MAX_TTS_CHARS = 400
STT_HINT = (
    "Station 2, a psychiatric ward. Mako, Saint Nastia, Mr. Northpole, Vera, the Cryptographer, "
    "Stasi, FINCA, Kyrgyzstan, Albania, South Korea, garden gate, keycard."
)

models: dict = {}
stt_lock = asyncio.Semaphore(1)
tts_lock = asyncio.Semaphore(1)


def load_models():
    from faster_whisper import WhisperModel
    from kokoro_onnx import Kokoro

    t0 = time.perf_counter()
    models["stt"] = WhisperModel(
        WHISPER_MODEL, device="cpu", compute_type="int8", cpu_threads=WHISPER_THREADS,
        download_root=os.path.join(MODELS_DIR, "whisper"),
    )
    options = ort.SessionOptions()
    options.intra_op_num_threads = TTS_THREADS
    session = ort.InferenceSession(
        os.path.join(MODELS_DIR, KOKORO_MODEL), options, providers=["CPUExecutionProvider"]
    )
    models["tts"] = Kokoro.from_session(session, os.path.join(MODELS_DIR, "voices-v1.0.bin"))
    models["tts"].create("Ready.", voice="af_heart", speed=1.0, lang="en-us")
    log.info("models ready in %.1fs (whisper=%s, kokoro=%s)", time.perf_counter() - t0, WHISPER_MODEL, KOKORO_MODEL)


app = FastAPI(title="STATION222 speech")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    asyncio.get_running_loop().run_in_executor(None, load_models)


router = APIRouter()


@router.get("/health")
async def health():
    return {"ready": "stt" in models and "tts" in models, "stt_model": WHISPER_MODEL, "tts_model": KOKORO_MODEL}


def require_ready():
    if "stt" not in models or "tts" not in models:
        raise HTTPException(503, "Speech models are still loading")


def transcribe(audio: np.ndarray) -> dict:
    segments, _ = models["stt"].transcribe(
        audio, language="en", beam_size=1, vad_filter=False,
        condition_on_previous_text=False, initial_prompt=STT_HINT,
    )
    kept = [s.text.strip() for s in segments if not (s.no_speech_prob > 0.6 and s.avg_logprob < -1.0)]
    return {"text": " ".join(t for t in kept if t)}


@router.post("/stt")
async def stt(request: Request):
    require_ready()
    body = await request.body()
    if not body or len(body) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio missing or too long")
    try:
        audio, rate = sf.read(io.BytesIO(body), dtype="float32", always_2d=True)
    except Exception:
        raise HTTPException(400, "Send 16 kHz mono WAV")
    audio = audio.mean(axis=1)
    if rate != 16000:
        raise HTTPException(400, "Send 16 kHz mono WAV")
    if len(audio) > rate * MAX_AUDIO_SECONDS:
        raise HTTPException(413, "Audio too long")

    t0 = time.perf_counter()
    async with stt_lock:
        result = await run_in_threadpool(transcribe, audio)
    result["ms"] = round((time.perf_counter() - t0) * 1000)
    log.info("stt %.1fs audio -> %dms %r", len(audio) / rate, result["ms"], result["text"][:80])
    return result


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TTS_CHARS)
    voice: str = Field(default="af_heart", max_length=120)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


def voice_style(spec: str):
    """'bf_emma' or a blend such as 'bf_emma:0.6+af_heart:0.4'."""
    tts = models["tts"]
    parts = []
    for chunk in spec.split("+"):
        name, _, weight = chunk.strip().partition(":")
        if name not in tts.voices:
            raise HTTPException(400, f"Unknown voice {name!r}")
        parts.append((name, float(weight) if weight else 1.0))
    if len(parts) == 1:
        return parts[0][0]
    total = sum(w for _, w in parts)
    return sum(tts.get_voice_style(name) * (w / total) for name, w in parts)


def synthesize(text: str, voice, speed: float) -> bytes:
    audio, rate = models["tts"].create(text, voice=voice, speed=speed, lang="en-us")
    buffer = io.BytesIO()
    sf.write(buffer, audio, rate, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


@router.post("/tts")
async def tts(req: TtsRequest):
    require_ready()
    text = re.sub(r"\s+", " ", req.text).strip()
    voice = voice_style(req.voice)
    t0 = time.perf_counter()
    async with tts_lock:
        wav = await run_in_threadpool(synthesize, text, voice, req.speed)
    ms = round((time.perf_counter() - t0) * 1000)
    log.info("tts %d chars -> %dms", len(text), ms)
    return Response(wav, media_type="audio/wav", headers={"X-Synth-Ms": str(ms)})


@router.get("/voices")
async def voices():
    require_ready()
    return sorted(models["tts"].voices)


# Coolify may or may not strip the /speech path prefix, so serve both.
app.include_router(router)
app.include_router(router, prefix="/speech")
