# Repository Guidelines

## Project Structure & Module Organization
This repository has three main apps:
- `backend/`: FastAPI service and agent orchestration logic (`app/api`, `app/agents`, `app/tools`, `app/models`).
- `frontend/`: Next.js App Router UI (`src/app`, `src/components`, `src/lib`).
- `static/`: Vite + React prototype UI.

Shared configuration lives at the repo root (`.env.example`, `README.md`). Keep new backend features modular: route in `app/api/routes`, data model in `app/models`, tool/agent behavior in `app/tools` or `app/agents`.

## Build, Test, and Development Commands
- Backend setup: `cd backend && uv sync`
- Run backend: `uv run uvicorn app.main:app --reload --port 8000`
- Backend checks: `uv run ruff check app` and `uv run pytest`
- Frontend setup: `cd frontend && npm install`
- Run frontend: `npm run dev` (http://localhost:3000)
- Frontend quality: `npm run lint`, `npm run build`
- Static app (optional): `cd static && npm install && npm run dev`

Use `.env.example` to create local env vars: `cp .env.example .env`.

## Coding Style & Naming Conventions
- Python: 4-space indentation, type hints, `snake_case` for functions/modules, `PascalCase` for Pydantic models.
- TypeScript/React: follow ESLint (`frontend/eslint.config.mjs`, `static/eslint.config.js`), components in `PascalCase`, utility modules in `camelCase`/`kebab-case` consistent with nearby files.
- Keep API route files focused by domain (`chat.py`, `jobs.py`, `documents.py`).

## Testing Guidelines
Automated tests are not fully established yet; add tests with every behavior change:
- Backend tests under `backend/tests/` using `pytest` and `pytest-asyncio`.
- Prefer endpoint tests for `app/api/routes/*` and unit tests for agent/tool logic.
- Name tests clearly (e.g., `test_jobs_search_returns_ranked_matches`).

No enforced coverage threshold currently; prioritize critical flows (chat, document generation, job search, apply).

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects (e.g., `fix session and output file bugs`, `Refactor the frontend.`). Follow that pattern:
- Keep subject concise and action-oriented.
- Group related changes per commit.

PRs should include:
- What changed and why.
- Linked issue/task (if available).
- Validation steps run (commands and results).
- UI screenshots/GIFs for `frontend/` or `static/` changes.

## Security & Configuration Tips
- Never commit secrets; keep keys only in `.env`.
- Required keys include `ANTHROPIC_API_KEY` and `REED_API_KEY`.
- Review generated documents/uploads before sharing external artifacts.
