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
AgentMode.CV_WRITER    → [generate_cv, generate_cv_latex, generate_cover_letter]  # uses settings.writing_model
AgentMode.ORCHESTRATOR → ALL_TOOLS (7 tools total)
```

Data flow: `POST /api/chat/message → session_manager.get_or_create(id) → orchestrator.set_mode() → orchestrator.chat() → yields event dicts → agent_events_to_sse() → SSE stream`

**Session-aware tools**: `tool_update_profile_summary` needs access to the session's `UserProfile`. It's registered via a closure in `Orchestrator._register_profile_tools()` — this is the pattern for any tool that needs session state.

**CV_WRITER mode specifics**: The orchestrator injects the full `cv-template.tex` LaTeX template into the system prompt at runtime (via the `_config` property). `max_tokens` is 16384 for CV_WRITER vs 4096 for other modes. Max tool-use loop iterations: 15.

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
- **Tool functions** prefixed `tool_`: `tool_search_jobs()`, `tool_generate_cv_latex()` — defined in `backend/app/tools/`, must return JSON strings
- **Tool definitions**: JSON Schema dicts (`TOOL_SEARCH_JOBS`, etc.) in `backend/app/agents/definitions.py` — kept manually in sync with Python function signatures. No auto-generation. Currently 7 tools defined.
- **Tool handler map**: `_DEFAULT_TOOL_HANDLERS` dict in `orchestrator.py` maps tool name strings → async functions. Session-aware tools are added to `self.tool_handlers` per-instance.
- Pydantic v2 models in `backend/app/models/`:
  - `JobListing` uses `serialization_alias` for camelCase JSON output + `from_reed_search()`/`from_reed_details()` factory classmethods
  - `UserProfile` uses snake_case everywhere (no aliases)
  - Agent tool results (`reed_tools.py`) serialize with `by_alias=True` → camelCase. REST route handlers (`jobs.py`) serialize **without** `by_alias` → snake_case. The frontend `JobData` interface expects camelCase.
- FastAPI routes: each file creates `router = APIRouter(prefix="/api/xxx", tags=["xxx"])`, registered in `backend/app/main.py`
- Request bodies: inline Pydantic `BaseModel` subclasses in route files (e.g. `ChatMessageRequest`, `ApplyRequest`)
- Module-level singletons: `session_manager`, `reed_client`, `settings`
- SSE event types from orchestrator: `text`, `tool_call`, `tool_result`, `done`, `error`. The `session` event is appended by the chat route handler (not the orchestrator).

## Frontend Conventions

- Single-page app in `frontend/src/app/page.tsx` — three-panel layout: `InfoPanel` (left, profile), chat (center), `JobsPanel` (right, search results)
- `"use client"` on `page.tsx`; only `layout.tsx` is a server component
- All state is local `useState` hooks — no external state library
- Path alias `@/` → `src/`
- Icons: `lucide-react` throughout (Send, Paperclip, Building2, etc.)
- Styling: Tailwind v4 utilities + `cn()` from `lib/utils.ts` (clsx + tailwind-merge). Custom animations in `globals.css` (`slide-in-left`, `slide-in-right`)
- Agent messages rendered via `react-markdown` with custom component mapping. Tool-call messages use a link-regex renderer for download buttons.
- `shadcn` CLI available as dev dep; `radix-ui` is a direct dependency
- **SSE parsing** in `handleSend()`: manual line-by-line `ReadableStream` reader. Special `tool_result` handling:
  - `update_profile_summary` → updates `profile` state (shows `InfoPanel`)
  - `search_jobs` → updates `jobs` state (shows `JobsPanel`)
  - `generate_cv_latex` → extracts `download_url` from result
  - `generate_cover_letter` → constructs download URL from `pdf_path` filename
- **CV upload** (`POST /api/chat/upload`): non-streaming `FormData` upload, returns JSON (not SSE)
- **Generate buttons**: `handleGenerateCV`/`handleGenerateCoverLetter` in `JobsPanel` call `handleSend(prompt, "cv_writer")` — mode is passed in the request body

## Two CV Generation Paths

1. **LaTeX (primary)**: `tool_generate_cv_latex(latex_body)` — LLM writes a complete `.tex` file using the `cv-template.tex` template (injected into system prompt). Compiled with `pdflatex`. The CV_WRITER system prompt explicitly prefers this path.
2. **HTML/WeasyPrint (legacy)**: `tool_generate_cv(profile_json)` — HTML template → WeasyPrint PDF + python-docx DOCX. Still available but not the preferred path.
3. **Cover letters**: `tool_generate_cover_letter(profile_json, cover_letter_text)` — always uses HTML → WeasyPrint PDF + DOCX.

## Adding a New Tool

1. Create async `tool_xxx()` in `backend/app/tools/` returning a JSON string
2. Add JSON Schema dict `TOOL_XXX` in `backend/app/agents/definitions.py`
3. Add to the appropriate tool group list (`STORY_COACH_TOOLS`, `JOB_MATCHER_TOOLS`, `CV_WRITER_TOOLS`, etc.)
4. Register in `_DEFAULT_TOOL_HANDLERS` dict in `orchestrator.py` (or in `_register_profile_tools()` if it needs session state)
5. Import the handler function in `orchestrator.py`
6. If the frontend should react to this tool's results, add handling in `page.tsx` under the `tool_result` SSE event case (look for the existing `update_profile_summary` / `search_jobs` / `generate_cv_latex` switch)

## Adding a New API Route

1. Create `backend/app/api/routes/new_route.py` with `router = APIRouter(prefix="/api/new", tags=["new"])`
2. Register in `backend/app/main.py` via `app.include_router(router)`

## Non-Obvious Gotchas

- **Auto-apply is a stub**: `applications.py` creates records but no Playwright automation is wired up
- **Tool defs are manually duplicated**: JSON schemas in `definitions.py` must match Python signatures in `tools/` — no auto-generation, easy to drift
- **Profile writes via tool only**: The Story Coach updates `session.profile` through the `update_profile_summary` tool (closure-injected). There's no other write path from the agent to the profile.
- **hooks.py unused**: Logging callbacks exist but are not wired into the orchestrator
- **GBP-only**: Reed API is UK-only; dates parsed via `dd/mm/yyyy` → `datetime` in `JobListing`
- **Alias inconsistency**: Agent tools serialize jobs as camelCase (`by_alias=True`), but REST routes in `jobs.py` serialize as snake_case (no `by_alias`). Frontend expects camelCase.
- **README is aspirational**: Describes Agent SDK subagents, WebSocket, multi-page routing — the actual implementation uses raw Anthropic API, SSE only, single-page frontend
- **LaTeX requires `pdflatex`**: The `generate_cv_latex` tool shells out to `pdflatex` (must be on PATH). It runs twice for cross-references.
- **`DeliveryPanel` component**: Exists in `frontend/src/components/` but is not imported or used yet (future loading-state UI)
- **`frontend/src/components/documents/`**: Empty directory scaffolded for future document preview components
