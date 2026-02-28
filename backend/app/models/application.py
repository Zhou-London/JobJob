"""Application tracking schema."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ApplicationStatus(str, Enum):
    PENDING = "pending"
    GENERATING_DOCS = "generating_docs"
    APPLYING = "applying"
    APPLIED = "applied"
    FAILED = "failed"
    DRY_RUN = "dry_run"


class Application(BaseModel):
    """Tracks a single job application through the pipeline."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: int = Field(description="Reed job ID")
    job_title: str = ""
    employer_name: str = ""
    status: ApplicationStatus = ApplicationStatus.PENDING
    cv_path: Optional[str] = Field(default=None, description="Path to generated CV")
    cover_letter_path: Optional[str] = Field(
        default=None, description="Path to generated cover letter"
    )
    screenshots: list[str] = Field(
        default_factory=list,
        description="Paths to screenshots taken during auto-apply",
    )
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    applied_at: Optional[datetime] = None
    dry_run: bool = False
