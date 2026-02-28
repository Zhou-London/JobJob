"""SDK hooks — logging and observability callbacks for the agent loop."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def on_tool_call(name: str, input_data: Any) -> None:
    """Called before a tool is executed."""
    logger.info(
        f"[Tool Call] {name} — input keys: {list(input_data.keys()) if isinstance(input_data, dict) else '?'}"
    )


def on_tool_result(name: str, result: str) -> None:
    """Called after a tool returns a result."""
    preview = result[:200] + "…" if len(result) > 200 else result
    logger.info(f"[Tool Result] {name} — {preview}")


def on_agent_mode_change(old_mode: str, new_mode: str) -> None:
    """Called when the orchestrator switches mode."""
    logger.info(f"[Mode Change] {old_mode} → {new_mode}")
