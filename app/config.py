"""Application configuration utilities."""
from functools import lru_cache
from typing import List

from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Central application settings loaded from environment variables."""

    app_name: str = Field("Stock Indicator Dashboard", description="Display name for the UI")
    update_timezone: str = Field("UTC", description="Timezone used for scheduler")
    allowed_origins: List[str] = Field(default_factory=lambda: ["*"])
    default_update_interval: int = Field(
        300,
        description="Default refresh interval for charts in seconds when not specified by the chart itself.",
    )

    class Config:
        env_prefix = "SID_"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()
