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
    # Comma-separated, e.g. "https://a.example.com,https://b.example.com".
    cors_origins: str = "*"
    # Base URL of the speech container (speech/), e.g. "http://speech:8000". Only needed when the
    # reverse proxy does not already route /speech to it; the game server then forwards /speech/*.
    speech_url: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
