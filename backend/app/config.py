"""Application configuration — loads from .env via pydantic-settings."""

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central settings loaded from environment variables / .env file."""

    # --- API Keys ---
    anthropic_api_key: str = ""
    reed_api_key: str = ""

    # --- Agent ---
    default_model: str = "claude-sonnet-4-20250514"
    writing_model: str = "claude-sonnet-4-20250514"
    max_budget_usd: float = 5.0

    # --- Server ---
    backend_port: int = 8000
    frontend_url: str = "http://localhost:3000"
    cors_origins: list[str] = ["http://localhost:3000"]

    # --- Paths ---
    output_dir: Path = Path("output")
    upload_dir: Path = Path("uploads")

    # --- Reed API ---
    reed_api_base: str = "https://www.reed.co.uk/api/1.0"
    reed_bff_base: str = "https://api.reed.co.uk/api-bff-jobseeker-jobs"
    reed_base_url: str = "https://www.reed.co.uk"
    reed_username: str = ""
    reed_password: str = ""
    reed_cookie_header: str = ""
    reed_request_headers_file: str = ""

    model_config = {
        "env_file": "../.env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    def ensure_dirs(self) -> None:
        """Create output and upload directories if they don't exist."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
