"""Session manager — maps session IDs to Orchestrator instances.

Provides in-memory session storage for the hackathon. In production this
would use Redis or a database for persistence.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from app.agents.orchestrator import AgentMode, Orchestrator
from app.models.user_profile import UserProfile


class Session:
    """A single user session wrapping an Orchestrator instance."""

    def __init__(self, session_id: str | None = None) -> None:
        self.id = session_id or str(uuid.uuid4())
        self.orchestrator = Orchestrator(mode=AgentMode.STORY_COACH)
        self.profile: UserProfile = UserProfile()
        self.created_at = datetime.utcnow()
        self.last_active = datetime.utcnow()

    def touch(self) -> None:
        """Update the last-active timestamp."""
        self.last_active = datetime.utcnow()

    def is_expired(self, ttl_hours: int = 24) -> bool:
        """Check if the session has been inactive too long."""
        return datetime.utcnow() - self.last_active > timedelta(hours=ttl_hours)


class SessionManager:
    """In-memory session store. Thread-safe enough for a hackathon demo."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def create(self, session_id: str | None = None) -> Session:
        """Create a new session and return it."""
        session = Session(session_id)
        self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> Optional[Session]:
        """Retrieve a session by ID, or None if not found / expired."""
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if session.is_expired():
            self._sessions.pop(session_id, None)
            return None
        session.touch()
        return session

    def get_or_create(self, session_id: str | None = None) -> Session:
        """Get an existing session or create a new one."""
        if session_id:
            existing = self.get(session_id)
            if existing:
                return existing
        return self.create(session_id)

    def delete(self, session_id: str) -> None:
        """Remove a session."""
        self._sessions.pop(session_id, None)

    def cleanup_expired(self) -> int:
        """Remove all expired sessions. Returns the count removed."""
        expired = [sid for sid, s in self._sessions.items() if s.is_expired()]
        for sid in expired:
            del self._sessions[sid]
        return len(expired)

    @property
    def count(self) -> int:
        return len(self._sessions)


# Global singleton
session_manager = SessionManager()
