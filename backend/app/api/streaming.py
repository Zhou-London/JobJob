"""SSE streaming utility — converts agent events to Server-Sent Events."""

from __future__ import annotations

import json
from typing import Any, AsyncIterator


async def agent_events_to_sse(
    events: AsyncIterator[dict[str, Any]],
) -> AsyncIterator[dict[str, str]]:
    """Convert orchestrator events into SSE-formatted dicts.

    Yields dicts compatible with sse-starlette's EventSourceResponse:
      {"event": "...", "data": "..."}
    """
    async for event in events:
        event_type = event.get("type", "unknown")
        yield {
            "event": event_type,
            "data": json.dumps(event),
        }
