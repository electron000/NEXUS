"""
app/config.py – Centralised settings loaded from environment / .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Server
    port: int = 8000
    production: bool = False

    # Security
    internal_api_key: str = ""
    nerve_center_origin: str = "http://localhost:3001"

    # LLM providers (at least one recommended for semantic scoring)
    openai_api_key: str = ""
    gemini_api_key: str = ""

    # Feature flags
    use_pytrends: bool = True          # disable in CI / sandboxed envs
    model_path: str = "models/"        # directory for persisted XGBoost models


settings = Settings()
