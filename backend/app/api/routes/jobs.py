"""Job routes — search, details, and matching."""

from __future__ import annotations

import json
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.agents.orchestrator import AgentMode
from app.services.session_manager import session_manager
from app.tools.reed_tools import reed_client

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/search")
async def search_jobs(
    q: str = Query(..., description="Search keywords"),
    location: Optional[str] = Query(None),
    salary_min: Optional[int] = Query(None),
    salary_max: Optional[int] = Query(None),
    job_type: Optional[str] = Query(None, pattern="^(permanent|contract|temp)$"),
    limit: int = Query(25, ge=1, le=100),
    skip: int = Query(0, ge=0),
    easy_apply_only: bool = Query(False),
):
    """Search for jobs on Reed. Returns raw job listings."""
    permanent = job_type == "permanent" if job_type else None
    contract = job_type == "contract" if job_type else None
    temp = job_type == "temp" if job_type else None

    jobs = await reed_client.search_jobs(
        keywords=q,
        location=location,
        salary_min=salary_min,
        salary_max=salary_max,
        permanent=permanent,
        contract=contract,
        temp=temp,
        easy_apply=easy_apply_only if easy_apply_only else None,
        results_to_take=limit,
        results_to_skip=skip,
    )
    if easy_apply_only:
        jobs = [j for j in jobs if _is_easy_apply_job(j.external_url, j.job_url, j.easy_apply)]
    return {"results": [j.model_dump(mode="json") for j in jobs], "count": len(jobs)}


def _is_easy_apply_job(
    external_url: str | None,
    job_url: str | None,
    easy_apply: bool | None,
) -> bool:
    """Best-effort Easy Apply detection.

    Prioritizes explicit API signal, otherwise accepts jobs that remain on Reed
    and do not provide an external application URL.
    """
    if easy_apply is True:
        return True
    if easy_apply is False:
        return False
    if external_url:
        return False
    if not job_url:
        return False
    parsed = urlparse(job_url)
    return "reed.co.uk" in parsed.netloc


@router.get("/{job_id}")
async def get_job_details(job_id: int):
    """Get full details for a specific job from Reed."""
    try:
        job = await reed_client.get_job_details(job_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    return job.model_dump(mode="json")


class MatchRequest(BaseModel):
    session_id: str
    keywords: str | None = None
    location: str | None = None


@router.post("/match")
async def match_jobs(req: MatchRequest):
    """Search for jobs and rank them against the user's profile using AI.

    Switches the agent to job_matcher mode, performs the search and ranking,
    and returns the agent's analysis.
    """
    session = session_manager.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.orchestrator.set_mode(AgentMode.JOB_MATCHER)

    prompt_parts = ["Please search for and rank jobs that match my profile."]
    if req.keywords:
        prompt_parts.append(f"Keywords: {req.keywords}")
    if req.location:
        prompt_parts.append(f"Location: {req.location}")

    response = await session.orchestrator.chat_simple(" ".join(prompt_parts))

    return {"session_id": session.id, "analysis": response}
