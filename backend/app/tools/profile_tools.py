"""Profile tools — session-aware tools for updating the user profile."""

from __future__ import annotations

import json
import logging

from app.models.user_profile import UserProfile

logger = logging.getLogger(__name__)


async def tool_update_profile_summary(
    summary_bullets: list[str],
    *,
    name: str | None = None,
    job_position: str | None = None,
    profile: UserProfile,
) -> str:
    """Save profile headline fields and bullet points into the session's UserProfile.

    Args:
        summary_bullets: Concise bullet strings from the Story Coach.
        name: The user's full name (optional, set when first learned).
        job_position: The user's target role / desired job title (optional).
        profile: The session's UserProfile instance (injected by the orchestrator).

    Returns:
        JSON confirmation string including the saved values so the frontend
        can update the sidebar immediately from the SSE event.
    """
    if name:
        profile.name = name
    if job_position:
        # Store in preferences.target_roles as well for job matching
        if job_position not in profile.preferences.target_roles:
            profile.preferences.target_roles.insert(0, job_position)
    profile.summary_bullets = summary_bullets

    logger.info(
        "Profile updated — name=%s, job_position=%s, bullets=%d",
        name,
        job_position,
        len(summary_bullets),
    )
    return json.dumps(
        {
            "status": "ok",
            "name": profile.name or None,
            "job_position": job_position
            or (
                profile.preferences.target_roles[0]
                if profile.preferences.target_roles
                else None
            ),
            "summary_bullets": summary_bullets,
        },
    )
