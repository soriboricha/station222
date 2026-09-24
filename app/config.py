from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_api_key: str = ""
    llm_model: str = ""
    # Leave empty for OpenAI; set for any OpenAI-compatible provider (OpenRouter, Mistral, Ollama, vLLM, ...).
    llm_base_url: str | None = None
    llm_temperature: float = 0.8
    llm_timeout_seconds: float = 30.0

    max_llm_attempts: int = 3
    max_history_messages: int = 30
    cors_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
