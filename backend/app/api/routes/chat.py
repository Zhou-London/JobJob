"""Chat routes — story coaching and general conversation."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.agents.orchestrator import AgentMode
from app.api.streaming import agent_events_to_sse
from app.config import settings
from app.services.session_manager import session_manager

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessageRequest(BaseModel):
    message: str
    session_id: str | None = None
    mode: str | None = None  # optional mode override


class ChatMessageResponse(BaseModel):
    session_id: str
    message: str


class SessionCreateResponse(BaseModel):
    session_id: str
    created_at: str


@router.post("/session", response_model=SessionCreateResponse)
async def create_session():
    """Create a new session and return its identifier."""
    session = session_manager.create()
    return SessionCreateResponse(
        session_id=session.id,
        created_at=session.created_at.isoformat(),
    )


@router.post("/message")
async def send_message(req: ChatMessageRequest):
    """Send a message to the agent and stream back the response via SSE.

    If no session_id is provided, a new session is created.
    """
    session = session_manager.get_or_create(req.session_id)

    # Optional mode switch
    if req.mode and req.mode in (
        AgentMode.STORY_COACH,
        AgentMode.JOB_MATCHER,
        AgentMode.CV_WRITER,
        AgentMode.ORCHESTRATOR,
    ):
        session.orchestrator.set_mode(req.mode)

    events = session.orchestrator.chat(req.message)

    async def generate():
        async for sse_event in agent_events_to_sse(events):
            yield sse_event
        # Send session ID as final event
        yield {
            "event": "session",
            "data": f'{{"session_id": "{session.id}"}}',
        }

    return EventSourceResponse(generate())


@router.post("/message/sync", response_model=ChatMessageResponse)
async def send_message_sync(req: ChatMessageRequest):
    """Send a message and wait for the full response (non-streaming)."""
    session = session_manager.get_or_create(req.session_id)

    if req.mode:
        session.orchestrator.set_mode(req.mode)

    response_text = await session.orchestrator.chat_simple(req.message)

    return ChatMessageResponse(
        session_id=session.id,
        message=response_text,
    )


@router.post("/upload")
async def upload_cv(
    file: UploadFile = File(...),
    session_id: str | None = Form(None),
):
    """Upload a CV file (PDF/DOCX) for parsing.

    The file is saved to the uploads directory and the path is sent to the
    story coach agent for parsing.
    """
    session = session_manager.get_or_create(session_id)

    # Validate file type
    suffix = Path(file.filename or "file").suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Please upload PDF or DOCX.",
        )

    # Save file
    file_id = uuid.uuid4().hex[:8]
    save_path = settings.upload_dir / f"cv_{file_id}{suffix}"
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Ask the agent to parse it
    prompt = (
        f"The user has uploaded their CV. Please parse it and extract the key "
        f"information. The file is at: {save_path}"
    )
    response_text = await session.orchestrator.chat_simple(prompt)

    return {
        "session_id": session.id,
        "file_path": str(save_path),
        "message": response_text,
    }


@router.get("/history")
async def get_history(session_id: str):
    """Get the conversation history for a session."""
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Filter to just user/assistant text messages for display
    display_messages = []
    for msg in session.orchestrator.get_history():
        role = msg.get("role")
        content = msg.get("content")

        if role == "user" and isinstance(content, str):
            display_messages.append({"role": "user", "content": content})
        elif role == "assistant" and isinstance(content, list):
            text_parts = [
                block["text"]
                for block in content
                if isinstance(block, dict) and block.get("type") == "text"
            ]
            if text_parts:
                display_messages.append(
                    {
                        "role": "assistant",
                        "content": "\n".join(text_parts),
                    }
                )

    return {"session_id": session_id, "messages": display_messages}
