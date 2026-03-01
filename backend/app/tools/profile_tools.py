"""Profile tools — session-aware tools for updating the user profile."""

from __future__ import annotations

import json
import logging

from app.models.user_profile import UserProfile

logger = logging.getLogger(__name__)


async def tool_update_profile_summary(
    summary_bullets: list[str],
    *,
    profile: UserProfile,
) -> str:
    """Save summarised bullet points into the session's UserProfile.

    Args:
        summary_bullets: Concise bullet strings from the Story Coach.
        profile: The session's UserProfile instance (injected by the orchestrator).

    Returns:
        JSON confirmation string.
    """
    profile.summary_bullets = summary_bullets
    logger.info("Profile summary_bullets updated (%d bullets)", len(summary_bullets))
    return json.dumps(
        {"status": "ok", "bullets_saved": len(summary_bullets)},
    )
