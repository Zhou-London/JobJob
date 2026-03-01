"""Orchestrator — manages the agent loop via the Anthropic messages API.

This module uses the Anthropic Python SDK directly with the messages API
and tool_use pattern to implement a multi-turn, tool-calling agent loop.
The orchestrator delegates to specialised "modes" (story coaching, job
matching, CV writing, auto-apply) by switching system prompts and tool sets.
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any, AsyncIterator

import anthropic

from app.agents.definitions import (
    ALL_TOOLS,
    CV_WRITER_SYSTEM_PROMPT,
    CV_WRITER_TOOLS,
    JOB_MATCHER_SYSTEM_PROMPT,
    JOB_MATCHER_TOOLS,
    ORCHESTRATOR_SYSTEM_PROMPT,
    STORY_COACH_SYSTEM_PROMPT,
    STORY_COACH_TOOLS,
)
from app.config import settings
from app.tools.document_tools import (
    tool_generate_cover_letter,
    tool_generate_cv,
    tool_parse_cv,
)
from app.tools.profile_tools import tool_update_profile_summary
from app.tools.reed_tools import tool_get_job_details, tool_search_jobs

if TYPE_CHECKING:
    from app.models.user_profile import UserProfile

logger = logging.getLogger(__name__)

# Map tool names → handler functions (stateless defaults)
_DEFAULT_TOOL_HANDLERS: dict[str, Any] = {
    "search_jobs": tool_search_jobs,
    "get_job_details": tool_get_job_details,
    "parse_cv": tool_parse_cv,
    "generate_cv": tool_generate_cv,
    "generate_cover_letter": tool_generate_cover_letter,
}


class AgentMode:
    """Defines which system prompt and tools to use for a given agent mode."""

    STORY_COACH = "story_coach"
    JOB_MATCHER = "job_matcher"
    CV_WRITER = "cv_writer"
    ORCHESTRATOR = "orchestrator"


MODE_CONFIG: dict[str, dict[str, Any]] = {
    AgentMode.ORCHESTRATOR: {
        "system": ORCHESTRATOR_SYSTEM_PROMPT,
        "tools": ALL_TOOLS,
        "model": settings.default_model,
    },
    AgentMode.STORY_COACH: {
        "system": STORY_COACH_SYSTEM_PROMPT,
        "tools": STORY_COACH_TOOLS,
        "model": settings.default_model,
    },
    AgentMode.JOB_MATCHER: {
        "system": JOB_MATCHER_SYSTEM_PROMPT,
        "tools": JOB_MATCHER_TOOLS,
        "model": settings.default_model,
    },
    AgentMode.CV_WRITER: {
        "system": CV_WRITER_SYSTEM_PROMPT,
        "tools": CV_WRITER_TOOLS,
        "model": settings.writing_model,
    },
}


class Orchestrator:
    """Manages the agentic conversation loop.

    Maintains message history per session and runs tool-use loops
    until the agent produces a final text response.
    """

    def __init__(
        self,
        mode: str = AgentMode.STORY_COACH,
        profile: "UserProfile | None" = None,
    ) -> None:
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.mode = mode
        self.messages: list[dict[str, Any]] = []
        self.profile_json: str | None = None  # latest serialised UserProfile
        self.profile: UserProfile | None = profile  # type: ignore[assignment]

        # Instance-level handler map so session-aware tools can be registered
        self.tool_handlers: dict[str, Any] = dict(_DEFAULT_TOOL_HANDLERS)
        if self.profile is not None:
            self._register_profile_tools()

    @property
    def _config(self) -> dict[str, Any]:
        return MODE_CONFIG[self.mode]

    def set_mode(self, mode: str) -> None:
        """Switch agent mode (changes system prompt and available tools)."""
        if mode not in MODE_CONFIG:
            raise ValueError(f"Unknown mode: {mode}")
        self.mode = mode

    # ------------------------------------------------------------------
    # Session-aware tool registration
    # ------------------------------------------------------------------

    def _register_profile_tools(self) -> None:
        """Register tools that need access to the session's UserProfile."""
        profile = self.profile

        async def _handle_update_profile_summary(**kwargs: Any) -> str:
            return await tool_update_profile_summary(**kwargs, profile=profile)  # type: ignore[arg-type]

        self.tool_handlers["update_profile_summary"] = _handle_update_profile_summary

    async def chat(self, user_message: str) -> AsyncIterator[dict[str, Any]]:
        """Send a user message and yield events from the agent loop.

        Yields dicts with:
          {"type": "text", "content": "..."}          — text chunks
          {"type": "tool_call", "name": "...", ...}   — tool invocations
          {"type": "tool_result", "name": "...", ...} — tool results
          {"type": "done", "content": "..."}          — final text response
          {"type": "error", "content": "..."}         — errors
        """
        self.messages.append({"role": "user", "content": user_message})

        max_iterations = 15  # safety limit for tool-use loops
        for _ in range(max_iterations):
            try:
                response = await self.client.messages.create(
                    model=self._config["model"],
                    max_tokens=4096,
                    system=self._config["system"],
                    tools=self._config["tools"],
                    messages=self.messages,
                )
            except Exception as e:
                logger.exception("Anthropic API error")
                yield {"type": "error", "content": str(e)}
                return

            # Build the assistant message content
            assistant_content: list[dict[str, Any]] = []
            text_parts: list[str] = []
            tool_uses: list[dict[str, Any]] = []

            for block in response.content:
                if block.type == "text":
                    text_parts.append(block.text)
                    assistant_content.append({"type": "text", "text": block.text})
                    yield {"type": "text", "content": block.text}
                elif block.type == "tool_use":
                    tool_uses.append(
                        {
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        }
                    )
                    assistant_content.append(
                        {
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        }
                    )
                    yield {
                        "type": "tool_call",
                        "name": block.name,
                        "input": block.input,
                    }

            # Add the assistant message to history
            self.messages.append({"role": "assistant", "content": assistant_content})

            # If no tool calls, we're done
            if not tool_uses:
                final_text = "\n".join(text_parts)
                yield {"type": "done", "content": final_text}
                return

            # Execute tool calls and add results
            tool_results: list[dict[str, Any]] = []
            for tool_call in tool_uses:
                handler = self.tool_handlers.get(tool_call["name"])
                if handler is None:
                    result = json.dumps({"error": f"Unknown tool: {tool_call['name']}"})
                else:
                    try:
                        result = await handler(**tool_call["input"])
                    except Exception as e:
                        logger.exception(f"Tool {tool_call['name']} failed")
                        result = json.dumps({"error": str(e)})

                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_call["id"],
                        "content": result,
                    }
                )
                yield {
                    "type": "tool_result",
                    "name": tool_call["name"],
                    "result": result,
                }

            self.messages.append({"role": "user", "content": tool_results})

        # If we hit the iteration limit
        yield {
            "type": "error",
            "content": "Agent loop exceeded maximum iterations.",
        }

    async def chat_simple(self, user_message: str) -> str:
        """Convenience: run the full agent loop and return the final text."""
        final_text = ""
        async for event in self.chat(user_message):
            if event["type"] == "done":
                final_text = event["content"]
            elif event["type"] == "error":
                raise RuntimeError(event["content"])
        return final_text

    def get_history(self) -> list[dict[str, Any]]:
        """Return the conversation history (for debugging/display)."""
        return self.messages.copy()

    def clear_history(self) -> None:
        """Reset conversation history."""
        self.messages.clear()
