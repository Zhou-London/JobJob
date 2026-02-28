"""Application routes — track and trigger auto-apply."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.application import Application, ApplicationStatus
from app.services.session_manager import session_manager

router = APIRouter(prefix="/api/applications", tags=["applications"])

# In-memory application store (hackathon scope)
_applications: dict[str, Application] = {}


class ApplyRequest(BaseModel):
    session_id: str
    job_id: int
    job_title: str = ""
    employer_name: str = ""
    dry_run: bool = True


@router.post("/apply")
async def trigger_apply(req: ApplyRequest):
    """Trigger auto-apply for a specific job.

    For the hackathon MVP, this creates an application record and returns
    instructions. Full Playwright automation would connect here.
    """
    session = session_manager.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    app = Application(
        job_id=req.job_id,
        job_title=req.job_title,
        employer_name=req.employer_name,
        status=ApplicationStatus.PENDING,
        dry_run=req.dry_run,
    )
    _applications[app.id] = app

    # In a full implementation, this would:
    # 1. Switch agent to auto-apply mode
    # 2. Launch Playwright to navigate to the application URL
    # 3. Fill forms and upload documents
    # 4. Stream progress via WebSocket

    app.status = (
        ApplicationStatus.DRY_RUN if req.dry_run else ApplicationStatus.APPLYING
    )
    app.updated_at = datetime.utcnow()

    return {
        "application_id": app.id,
        "status": app.status.value,
        "message": (
            "Application created in dry-run mode. "
            "Full Playwright automation will be connected in the next phase."
            if req.dry_run
            else "Application submitted for processing."
        ),
    }


@router.get("/")
async def list_applications(session_id: str | None = None):
    """List all tracked applications."""
    apps = list(_applications.values())
    return {
        "applications": [a.model_dump(mode="json") for a in apps],
        "count": len(apps),
    }


@router.get("/{application_id}")
async def get_application(application_id: str):
    """Get details for a specific application."""
    app = _applications.get(application_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app.model_dump(mode="json")
