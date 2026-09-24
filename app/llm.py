from typing import Protocol

from openai import AsyncOpenAI

from app.config import Settings


class LLMClient(Protocol):
    async def complete(self, messages: list[dict[str, str]]) -> str: ...


class OpenAICompatibleClient:
    def __init__(self, settings: Settings):
        self._client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url or None,
            timeout=settings.llm_timeout_seconds,
        )
        self._model = settings.llm_model
        self._temperature = settings.llm_temperature

    async def complete(self, messages: list[dict[str, str]]) -> str:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=self._temperature,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content or ""
