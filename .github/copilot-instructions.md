# Copilot Instructions — JobJob

> AI-powered job application agent: Python/FastAPI backend + Next.js frontend. Conducts a career-story interview, searches Reed API for jobs, generates tailored CVs/cover letters, and (planned) auto-applies via browser automation.

## Architecture

```
Next.js Frontend (page.tsx) ──/api/*──► next.config.ts rewrites ──► FastAPI Backend :8000
                                                                          │
                                              Anthropic Messages API (tool_use loop)
                                                          │
                                               ┌──────────┼──────────┐
                                               ▼          ▼          ▼
                                          Reed API    File I/O   Playwright (stub)
```

- **Backend** (`backend/`): Python 3.12+, FastAPI, `uv` for deps. No database — all state in-memory via `SessionManager` (24h TTL, UUID sessions, no auth).
- **Frontend** (`frontend/`): Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. Single-page chat UI in `page.tsx` — no routing.
- **Communication**: Frontend proxies `/api/*` to backend via `next.config.ts` rewrites. Backend streams responses via SSE (`sse-starlette`). Frontend parses SSE events to update chat, profile sidebar (`InfoPanel`), and jobs sidebar (`JobsPanel`) in real-time.

## Agent System — Mode-Switching Orchestrator

`Orchestrator` in `backend/app/agents/orchestrator.py` uses Anthropic's raw `messages.create()` with manual tool dispatch (NOT the Agent SDK despite README). Modes are set **explicitly by API routes**, not by the AI:

```python
AgentMode.STORY_COACH  → [parse_cv, update_profile_summary, search_jobs, get_job_details]
AgentMode.JOB_MATCHER  → [search_jobs, get_job_details]
AgentMode.CV_WRITER    → [generate_cv, generate_cover_letter]  # uses settings.writing_model
AgentMode.ORCHESTRATOR → ALL_TOOLS
```

Data flow: `POST /api/chat/message → session_manager.get_or_create(id) → orchestrator.set_mode() → orchestrator.chat() → yields event dicts → agent_events_to_sse() → SSE stream`

**Session-aware tools**: `tool_update_profile_summary` needs access to the session's `UserProfile`. It's registered via a closure in `Orchestrator._register_profile_tools()` — this is the pattern for any tool that needs session state.

## Dev Commands

```bash
# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev   # port 3000

# Lint
cd backend && uv run ruff check .
```

Env vars: create root `.env` with `ANTHROPIC_API_KEY` and `REED_API_KEY`. Loaded by `backend/app/config.py` via pydantic-settings (`env_file = "../.env"`). Both models default to `claude-sonnet-4-20250514` (`default_model` and `writing_model`).

## Backend Conventions

- `from __future__ import annotations` at top of every module
- Absolute imports only: `from app.config import settings`, never relative
- **Tool functions** prefixed `tool_`: `tool_search_jobs()`, `tool_generate_cv()` — defined in `backend/app/tools/`, must return JSON strings
- **Tool definitions**: JSON Schema dicts (`TOOL_SEARCH_JOBS`, etc.) in `backend/app/agents/definitions.py` — kept manually in sync with Python function signatures. No auto-generation.
- **Tool handler map**: `_DEFAULT_TOOL_HANDLERS` dict in `orchestrator.py` maps tool name strings → async functions. Session-aware tools are added to `self.tool_handlers` per-instance.
- Pydantic v2 models in `backend/app/models/`: use `Field(description=...)`, `model_dump(mode="json")`, `serialization_alias` for camelCase JSON output, `@field_validator`, and `@classmethod` factories like `JobListing.from_reed_search(data)`
- FastAPI routes: each file creates `router = APIRouter(prefix="/api/xxx", tags=["xxx"])`, registered in `backend/app/main.py`
- Request bodies: inline Pydantic `BaseModel` subclasses in route files (e.g. `ChatMessageRequest`, `ApplyRequest`)
- Module-level singletons: `session_manager`, `reed_client`, `settings`
- SSE event types: `text`, `tool_call`, `tool_result`, `done`, `error`, `session`

## Frontend Conventions

- Single-page app in `frontend/src/app/page.tsx` — three-panel layout: `InfoPanel` (left, profile), chat (center), `JobsPanel` (right, search results)
- `"use client"` on `page.tsx`; only `layout.tsx` is a server component
- Path alias `@/` → `src/`
- Icons: `lucide-react` throughout (Send, Paperclip, Building2, etc.)
- Styling: Tailwind v4 utilities + `cn()` from `lib/utils.ts` (clsx + tailwind-merge). Custom animations in `globals.css`
- SSE parsing in `handleSend()`: reads `event:` / `data:` lines from the stream, dispatches by event type. `update_profile_summary` results update `InfoPanel`; `search_jobs` results populate `JobsPanel`.
- `shadcn` is a dev dependency (CLI available) but no components generated yet

## Adding a New Tool

1. Create async `tool_xxx()` in `backend/app/tools/` returning a JSON string
2. Add JSON Schema dict `TOOL_XXX` in `backend/app/agents/definitions.py`
3. Add to the appropriate tool group list (`STORY_COACH_TOOLS`, `JOB_MATCHER_TOOLS`, etc.)
4. Register in `_DEFAULT_TOOL_HANDLERS` dict in `orchestrator.py` (or in `_register_profile_tools()` if it needs session state)
5. Import the handler function in `orchestrator.py`
6. If the frontend should react to this tool's results, add handling in `page.tsx` under the `tool_result` SSE event case

## Adding a New API Route

1. Create `backend/app/api/routes/new_route.py` with `router = APIRouter(prefix="/api/new", tags=["new"])`
2. Register in `backend/app/main.py` via `app.include_router(router)`

## Non-Obvious Gotchas

- **Auto-apply is a stub**: `applications.py` creates records but no Playwright automation is wired up
- **Tool defs are manually duplicated**: JSON schemas in `definitions.py` must match Python signatures in `tools/` — no auto-generation, easy to drift
- **Profile writes via tool only**: The Story Coach updates `session.profile` through the `update_profile_summary` tool (closure-injected). There's no other write path from the agent to the profile.
- **hooks.py unused**: Logging callbacks exist but are not wired into the orchestrator
- **GBP-only**: Reed API is UK-only; dates parsed via `dd/mm/yyyy` → `datetime` in `JobListing`
- **CV generation uses WeasyPrint**: HTML template in `document_tools.py` → PDF, plus `python-docx` for DOCX output
- **README is aspirational**: Describes Agent SDK subagents, WebSocket, multi-page routing — the actual implementation uses raw Anthropic API, SSE only, single-page frontend
