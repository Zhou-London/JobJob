"""Application routes — track and trigger auto-apply."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.models.application import Application, ApplicationStatus
from app.services.session_manager import session_manager
from app.tools.request_headers import (
    load_request_headers_from_file,
    merge_headers_case_insensitive,
)
from app.tools.reed_tools import tool_apply_reed_job

router = APIRouter(prefix="/api/applications", tags=["applications"])

# In-memory application store (hackathon scope)
_applications: dict[str, Application] = {}


class ApplyRequest(BaseModel):
    session_id: str
    job_id: int
    job_title: str = ""
    employer_name: str = ""
    dry_run: bool = False
    request_headers: dict[str, str] | None = None
    request_headers_file: str | None = None


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

    if req.dry_run:
        app.status = ApplicationStatus.DRY_RUN
        app.updated_at = datetime.utcnow()
        return {
            "application_id": app.id,
            "status": app.status.value,
            "message": (
                "Application created in dry-run mode. "
                "Set dry_run=false to execute Reed apply by job ID."
            ),
        }

    app.status = ApplicationStatus.APPLYING
    app.updated_at = datetime.utcnow()

    resolved_headers = req.request_headers
    header_file = req.request_headers_file or settings.reed_request_headers_file
    if header_file:
        try:
            file_headers = load_request_headers_from_file(header_file)
        except (FileNotFoundError, ValueError) as e:
            app.status = ApplicationStatus.FAILED
            app.error_message = str(e)
            app.updated_at = datetime.utcnow()
            raise HTTPException(status_code=400, detail=str(e))

        # Explicitly supplied headers override file-derived headers.
        resolved_headers = merge_headers_case_insensitive(
            file_headers,
            req.request_headers,
        )

    try:
        apply_raw = await tool_apply_reed_job(
            job_id=req.job_id,
            request_headers_json=(
                json.dumps(resolved_headers) if resolved_headers else None
            ),
        )
        apply_result = json.loads(apply_raw)
    except Exception as e:
        app.status = ApplicationStatus.FAILED
        app.error_message = str(e)
        app.updated_at = datetime.utcnow()
        raise HTTPException(status_code=500, detail=f"Reed apply failed: {e}")

    ok = bool(apply_result.get("ok"))
    app.status = ApplicationStatus.APPLIED if ok else ApplicationStatus.FAILED
    app.error_message = None if ok else apply_result.get("message") or apply_result.get(
        "error"
    )
    app.applied_at = datetime.utcnow() if ok else None
    app.updated_at = datetime.utcnow()

    return {
        "application_id": app.id,
        "status": app.status.value,
        "message": _build_apply_message(ok=ok, apply_result=apply_result),
        "reed_result": apply_result,
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


def _build_apply_message(ok: bool, apply_result: dict[str, Any]) -> str:
    """Build a concise, user-visible result summary for apply attempts."""
    if ok:
        job_url = apply_result.get("job_url")
        response_url = apply_result.get("response_url")
        suffix = ""
        if response_url:
            suffix = f" Confirmation URL: {response_url}."
        elif job_url:
            suffix = f" Job URL: {job_url}."
        return f"Reed application submitted.{suffix}"

    detail = (
        apply_result.get("message")
        or apply_result.get("error")
        or "Reed application could not be confirmed."
    )
    return f"Reed apply failed: {detail}"
