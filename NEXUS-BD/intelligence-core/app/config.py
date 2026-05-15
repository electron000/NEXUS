"""
app/config.py – Centralised settings loaded from environment / .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        extra="ignore",
        protected_namespaces=()
    )

    # Server
    port: int = 8000
    production: bool = False

    # Security
    internal_api_key: str = ""
    nerve_center_origin: str = "http://localhost:4000"

    # LLM providers
    gemini_api_key: str = ""
    # Explicitly declared so it can be targeted by .env overrides
    gemini_model_name: str = "gemini-2.5-flash"

    # Feature flags
    model_path: str = "models/"


settings = Settings()