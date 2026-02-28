"""Profile routes — view and edit the user profile."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.user_profile import UserProfile
from app.services.session_manager import session_manager

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/")
async def get_profile(session_id: str):
    """Get the current user profile for a session."""
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session.id,
        "profile": session.profile.model_dump(mode="json"),
        "is_complete": session.profile.is_complete(),
    }


@router.put("/")
async def update_profile(session_id: str, profile: UserProfile):
    """Update the user profile for a session."""
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.profile = profile
    return {
        "session_id": session.id,
        "profile": session.profile.model_dump(mode="json"),
        "is_complete": session.profile.is_complete(),
    }
