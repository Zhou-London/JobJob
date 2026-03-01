# Copilot Instructions — JobJob

> AI-powered job application agent: Python/FastAPI backend + Next.js frontend. Collects user profile via a guided questionnaire, searches Reed API for jobs, generates tailored CVs/cover letters, and (planned) auto-applies via browser automation.

## Architecture

```
Next.js Frontend (single-page wizard) → FastAPI Backend → Anthropic Messages API (tool_use loop)
                                              ↓
                                   ┌──────────┼──────────┐
                                   ▼          ▼          ▼
                              Reed API    File I/O   Playwright MCP (stub)
```

- **Backend** (`backend/`): Python 3.12+, FastAPI, `uv` for deps. No database — all state in-memory via `SessionManager`.
- **Frontend** (`frontend/`): Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. Single-page questionnaire in `page.tsx` — no routing.
- **Communication**: Backend exposes SSE (via `sse-starlette`) and REST endpoints. Frontend does NOT yet consume the backend API — it's a standalone questionnaire UI. No proxy rewrites configured in `next.config.ts`.

## Agent System — Mode-Switching Orchestrator

`Orchestrator` in `backend/app/agents/orchestrator.py` uses Anthropic's raw `messages.create()` with manual tool dispatch — NOT the high-level Agent SDK despite README references to it. Modes are set **explicitly by API routes**, not by the AI:

```python
AgentMode.STORY_COACH  → STORY_COACH_SYSTEM_PROMPT + [parse_cv]
AgentMode.JOB_MATCHER  → JOB_MATCHER_SYSTEM_PROMPT + [search_jobs, get_job_details]
AgentMode.CV_WRITER    → CV_WRITER_SYSTEM_PROMPT   + [generate_cv, generate_cover_letter]
AgentMode.ORCHESTRATOR → ORCHESTRATOR_SYSTEM_PROMPT + ALL_TOOLS
```

Data flow: `API Route → session_manager.get_or_create(id) → orchestrator.set_mode() → orchestrator.chat() → yields event dicts → agent_events_to_sse() → SSE`

## Dev Commands

```bash
# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev   # port 3000

# Lint
cd backend && uv run ruff check .
```

Env vars: create root `.env` with `ANTHROPIC_API_KEY` and `REED_API_KEY`. Loaded by `backend/app/config.py` via pydantic-settings (`env_file = "../.env"`).

## Backend Conventions

- `from __future__ import annotations` at top of every module
- Absolute imports only: `from app.config import settings`, never relative
- **Tool functions** prefixed `tool_`: `tool_search_jobs()`, `tool_generate_cv()` — defined in `backend/app/tools/`, must return JSON strings
- **Tool definitions** are JSON Schema dicts (e.g. `TOOL_SEARCH_JOBS`) in `backend/app/agents/definitions.py` — kept manually in sync with Python function signatures
- **Tool handler map**: `TOOL_HANDLERS` dict in `orchestrator.py` maps tool name strings → async handler functions
- Pydantic v2 models in `backend/app/models/`: use `Field(description=...)`, `model_dump(mode="json")`, `@field_validator`, and `@classmethod` factories like `JobListing.from_reed_search(data)`
- FastAPI routes: each file creates `router = APIRouter(prefix="/api/xxx", tags=["xxx"])`, registered in `backend/app/main.py`
- Request bodies: defined as inline Pydantic `BaseModel` subclasses in route files (e.g. `ChatMessageRequest`, `ApplyRequest`)
- Singletons at module level: `session_manager` (SessionManager), `reed_client` (ReedClient), `settings` (Settings)
- SSE event types: `text`, `tool_call`, `tool_result`, `done`, `error`, `session`

## Frontend Conventions

- Single-page app in `frontend/src/app/page.tsx` with three phases: `landing` → `chat` (questionnaire) → `complete`
- `"use client"` directive on `page.tsx`; only `layout.tsx` is a server component
- Path alias `@/` → `src/`
- Styling: Tailwind utilities + `cn()` from `lib/utils.ts` (clsx + tailwind-merge). Custom CSS animations in `globals.css`
- Components: `InfoPanel.tsx` (left sidebar showing collected data), `DeliveryPanel.tsx` (right sidebar loading state)
- `shadcn` is available as dev dependency but no components generated yet (`components/documents/` is empty)
- Inline SVGs used for icons (arrow, microphone) — `lucide-react` is installed but unused

## Adding a New Tool

1. Create async `tool_xxx()` in `backend/app/tools/` returning a JSON string
2. Add JSON Schema dict `TOOL_XXX` in `backend/app/agents/definitions.py`
3. Add to the appropriate tool group list (`STORY_COACH_TOOLS`, `JOB_MATCHER_TOOLS`, etc.)
4. Register in `TOOL_HANDLERS` dict in `backend/app/agents/orchestrator.py`
5. Import the handler function in `orchestrator.py`

## Adding a New API Route

1. Create `backend/app/api/routes/new_route.py` with `router = APIRouter(prefix="/api/new", tags=["new"])`
2. Register in `backend/app/main.py` via `app.include_router(router)`

## Non-Obvious Gotchas

- **Frontend ↔ Backend not connected**: The frontend questionnaire collects data locally but does not POST to the backend. Integration is pending.
- **Auto-apply is a stub**: `applications.py` creates records but no Playwright automation is wired up
- **Tool defs are duplicated**: JSON schemas in `definitions.py` must match Python signatures in `tools/` — no auto-generation
- **Session state split**: `Session` holds both `Orchestrator` and `UserProfile`, but Story Coach agent has no mechanism to write back to `session.profile`
- **hooks.py unused**: Logging callbacks (`on_tool_call`, `on_tool_result`, `on_agent_mode_change`) exist but are not wired into the orchestrator
- **No auth**: Sessions are anonymous UUID-based, 24h TTL
- **GBP-only**: Reed API is UK-only; dates parsed via `dd/mm/yyyy` → `datetime` in `JobListing`
- **CV generation uses WeasyPrint**: HTML template in `document_tools.py` → PDF, plus `python-docx` for DOCX output
