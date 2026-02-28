# Copilot Instructions — JobJob

> AI-powered job application agent: Python/FastAPI backend + Next.js frontend. Interviews users, searches Reed API for jobs, generates tailored CVs/cover letters, and auto-applies via browser automation.

## Architecture

```
Next.js Frontend (SSE/REST) → FastAPI Backend → Anthropic Messages API (tool_use loop)
                                     ↓
                          ┌──────────┼──────────┐
                          ▼          ▼          ▼
                     Reed API    File I/O   Playwright MCP
```

- **Backend** (`backend/`): Python 3.12+, FastAPI, `uv` for deps. No database — all state in-memory.
- **Frontend** (`frontend/`): Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui.
- **Communication**: SSE for chat streaming, REST for CRUD. Frontend proxies `/api/*` → `localhost:8000` via `next.config.ts` rewrites.

## Agent System — Mode-Switching Orchestrator

A single `Orchestrator` class in `backend/app/agents/orchestrator.py` manages conversation via Anthropic's raw `messages.create()` API with manual tool dispatch — NOT the high-level Agent SDK. Modes are set **explicitly by API routes**, not by the AI:

```python
AgentMode.STORY_COACH  → STORY_COACH_SYSTEM_PROMPT + [parse_cv]
AgentMode.JOB_MATCHER  → JOB_MATCHER_SYSTEM_PROMPT + [search_jobs, get_job_details]
AgentMode.CV_WRITER    → CV_WRITER_SYSTEM_PROMPT   + [generate_cv, generate_cover_letter]
AgentMode.ORCHESTRATOR → ORCHESTRATOR_SYSTEM_PROMPT + ALL_TOOLS
```

Data flow: `API Route → session_manager.get_or_create(id) → orchestrator.set_mode() → orchestrator.chat() → yields events → SSE`

## Dev Commands

```bash
# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev   # port 3000

# Lint
cd backend && uv run ruff check .
```

## Backend Conventions

- `from __future__ import annotations` at top of every module
- Absolute imports only: `from app.config import settings`, never relative
- **Tool functions** prefixed `tool_`: `tool_search_jobs()`, `tool_generate_cv()`
- **Tool definitions** are JSON Schema dicts in `definitions.py` AND Python functions in `tools/` — keep in sync manually
- Pydantic v2: `Field(description=...)`, `model_dump(mode="json")`, `model_validate_json()`
- FastAPI routes: each file creates `router = APIRouter(prefix="/api/xxx", tags=["xxx"])`, registered in `main.py`
- Request bodies defined as inline Pydantic models in route files
- Singletons at module level: `session_manager`, `reed_client`, `settings`
- SSE via `sse-starlette`. Event types: `text`, `tool_call`, `tool_result`, `done`, `error`, `session`

## Frontend Conventions

- All interactive pages/components use `"use client"` directive; only root `layout.tsx` and landing `page.tsx` are server components
- Path alias `@/` → `src/`: `import { Button } from "@/components/ui/button"`
- Props interface named `ComponentNameProps`, defined above component
- API client in `lib/api.ts`: `apiFetch<T>()` wrapper, SSE parsed manually via `ReadableStream`
- Chat state via `useChat` hook — SSE events **overwrite** (not append) message content
- Styling: Tailwind utilities + `cn()` (clsx + tailwind-merge), emojis as icons, shadcn/ui Cards as containers

## Adding a New Tool

1. Create async `tool_xxx()` in `backend/app/tools/` returning JSON string
2. Add JSON Schema dict `TOOL_XXX` in `backend/app/agents/definitions.py`
3. Add to appropriate tool group list (`STORY_COACH_TOOLS`, `JOB_MATCHER_TOOLS`, etc.)
4. Register in `TOOL_HANDLERS` dict in `backend/app/agents/orchestrator.py`

## Adding a New API Route

1. Create `backend/app/api/routes/new_route.py` with `router = APIRouter(prefix="/api/new", tags=["new"])`
2. Register in `backend/app/main.py` via `app.include_router()`
3. Add client functions + types in `frontend/src/lib/api.ts`

## Adding a Frontend Component

1. Create `PascalCase.tsx` in appropriate `frontend/src/components/` subdirectory
2. Use `"use client"`, define `ComponentNameProps` interface, use shadcn primitives + `cn()`

## Non-Obvious Gotchas

- **Auto-apply is a stub**: `applications.py` creates records but no Playwright integration yet
- **Tool defs are duplicated**: JSON schemas in `definitions.py` must match Python signatures in `tools/`
- **Session state split**: `Session` holds `Orchestrator` + `UserProfile`, but Story Coach doesn't auto-update profile
- **Dual API paths**: Frontend uses proxy rewrites AND `api.ts` has hardcoded `API_BASE` URL
- **No auth**: Sessions are anonymous UUID-based
- **GBP-only**: Reed API is UK-only; salary formatting uses `en-GB` locale
- **HTML injection**: Job detail page renders Reed HTML via `dangerouslySetInnerHTML` unsanitised
- **Env vars**: Loaded from root `.env` by `backend/app/config.py` via pydantic-settings; required: `ANTHROPIC_API_KEY`, `REED_API_KEY`
