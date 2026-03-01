# JobJob

**AI-Powered Automated Job Application Agent** — Tell your career story, and JobJob finds matching roles, tailors your CV & cover letter, and applies for you.

Built with [Anthropic's Agent SDK](https://docs.anthropic.com/en/docs/agents) using a FastAPI backend and Next.js frontend.

---

## Overview

JobJob automates the job application pipeline:

1. **Story Coaching** — An AI agent conducts a multi-turn career interview, asking guided follow-up questions to build a comprehensive professional profile.
2. **CV Upload (optional)** — Upload an existing CV (PDF/DOCX). The agent parses it and merges the data with the interview output.
3. **Job Search & Matching** — Jobs are fetched from the Reed API. The agent searches and presents the best matches based on the user's profile.
4. **CV & Cover Letter Tailoring** — For each target job, the agent generates a tailored CV (via LaTeX) and cover letter emphasizing relevant skills and mirroring the job description's language.
5. **Auto-Apply** _(planned)_ — A Playwright-powered agent will navigate to application pages, fill forms, upload documents, and submit.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              Next.js Frontend (single-page chat UI)              │
│  InfoPanel (profile) │ Chat (center) │ JobsPanel (search results)│
└──────────┬───────────────────────────────────────────────────────┘
           │ /api/* (proxied via next.config.ts)
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (:8000)                        │
│  /api/chat/*  │  /api/jobs/*  │  /api/documents/*  │  /api/profile│
└──────────┬───────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│            Anthropic Agent SDK Orchestrator                       │
│                                                                   │
│  Mode-based tool dispatch via messages API + tool_use loop        │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Story Coach  │  │ Job Matcher  │  │ CV/Cover Letter Writer   │  │
│  │ (Sonnet)     │  │ (Sonnet)     │  │ (Sonnet / configurable)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │               │
│    7 tools: search_jobs, get_job_details, parse_cv,               │
│    generate_cv, generate_cv_latex, generate_cover_letter,         │
│    update_profile_summary                                         │
└─────────┼─────────────────┼────────────────────────┼──────────────┘
          │                 │                        │
          ▼                 ▼                        ▼
     Reed API          File System            pdflatex / WeasyPrint
    (reed.co.uk)       (PDF/DOCX I/O)         (CV compilation)
```

### Communication

- Frontend proxies `/api/*` → backend via `next.config.ts` rewrites
- Backend streams agent responses via **SSE** (`sse-starlette`)
- Frontend parses SSE events to update chat, profile sidebar, and jobs sidebar in real-time
- SSE event types: `text`, `tool_call`, `tool_result`, `done`, `error`, `session`

---

## Tech Stack

### Backend (Python)

| Component           | Technology                  | Purpose                                        |
| ------------------- | --------------------------- | ---------------------------------------------- |
| Agent Framework     | Anthropic Agent SDK         | Agent loop, tool execution, mode orchestration |
| HTTP Server         | FastAPI + Uvicorn           | REST API, SSE streaming                        |
| Job Data            | Reed API (`httpx`)          | Job search & details                           |
| CV Parsing          | `pdfplumber`, `python-docx` | Extract text from uploaded CVs                 |
| CV Generation       | `pdflatex` (primary)        | LaTeX template → professional PDF              |
| Document Generation | `weasyprint`, `python-docx` | HTML → PDF/DOCX for cover letters & legacy CVs |
| Config              | `pydantic-settings`         | Environment variables & validation             |

### Frontend (TypeScript)

| Component   | Technology                 | Purpose                   |
| ----------- | -------------------------- | ------------------------- |
| Framework   | Next.js 16 (App Router)    | Single-page application   |
| UI          | React 19 + Tailwind CSS v4 | Component styling         |
| Markdown    | `react-markdown`           | Agent message rendering   |
| Icons       | `lucide-react`             | UI iconography            |
| HTTP Client | `fetch` (native)           | REST + SSE stream reading |

### External Services

| Service              | Purpose              | Auth                        |
| -------------------- | -------------------- | --------------------------- |
| Anthropic Claude API | All LLM tasks        | `ANTHROPIC_API_KEY`         |
| Reed API             | Job search & details | `REED_API_KEY` (HTTP Basic) |

---

## Agent System Design

The system uses the Anthropic Agent SDK with a **mode-switching orchestrator** pattern. A single `Orchestrator` manages the conversation loop using `messages.create()` with tool_use, switching between modes that control the system prompt and available tools.

### Agent Modes

| Mode           | Tools                                                                  | Model           |
| -------------- | ---------------------------------------------------------------------- | --------------- |
| `story_coach`  | `parse_cv`, `update_profile_summary`, `search_jobs`, `get_job_details` | `default_model` |
| `job_matcher`  | `search_jobs`, `get_job_details`                                       | `default_model` |
| `cv_writer`    | `generate_cv`, `generate_cv_latex`, `generate_cover_letter`            | `writing_model` |
| `orchestrator` | All 7 tools                                                            | `default_model` |

Modes are set **explicitly by API routes** (not by the AI). For example, the frontend sends `mode: "cv_writer"` in the request body when the user clicks "Generate CV".

### Session Management

- `SessionManager` maintains in-memory sessions (24h TTL, UUID-based, no auth)
- Each session holds an `Orchestrator` instance with conversation history and a `UserProfile`
- No database — all state is ephemeral

### Tools (7 total)

| Tool                     | Purpose                                   | Returns                 |
| ------------------------ | ----------------------------------------- | ----------------------- |
| `search_jobs`            | Search Reed API for job listings          | JSON array (camelCase)  |
| `get_job_details`        | Get full job description from Reed        | JSON object (camelCase) |
| `parse_cv`               | Extract text from uploaded PDF/DOCX       | Raw text                |
| `update_profile_summary` | Update user profile sidebar in real-time  | Status JSON             |
| `generate_cv_latex`      | Compile LaTeX CV to PDF (primary CV path) | `{download_url, ...}`   |
| `generate_cv`            | Generate CV via HTML/WeasyPrint (legacy)  | `{pdf_path, docx_path}` |
| `generate_cover_letter`  | Generate cover letter as PDF + DOCX       | `{pdf_path, docx_path}` |

---

## Project Structure

```
JobJob/
├── .env                                    # ANTHROPIC_API_KEY, REED_API_KEY
├── .github/
│   └── copilot-instructions.md             # AI coding agent instructions
├── cv-template.tex                         # LaTeX CV template (injected into CV_WRITER prompt)
├── README.md
├── backend/
│   ├── pyproject.toml                      # Python deps (uv)
│   ├── app/
│   │   ├── main.py                         # FastAPI app entry point
│   │   ├── config.py                       # Settings via pydantic-settings
│   │   ├── models/
│   │   │   ├── user_profile.py             # UserProfile (snake_case, no aliases)
│   │   │   ├── job.py                      # JobListing (camelCase serialization_alias)
│   │   │   └── application.py              # Application status (stub)
│   │   ├── agents/
│   │   │   ├── definitions.py              # System prompts + tool JSON schemas (7 tools)
│   │   │   ├── orchestrator.py             # Mode-switching orchestrator (tool_use loop)
│   │   │   └── hooks.py                    # Logging callbacks (not wired up)
│   │   ├── tools/
│   │   │   ├── reed_tools.py               # search_jobs, get_job_details
│   │   │   ├── document_tools.py           # parse_cv, generate_cv, generate_cv_latex, generate_cover_letter
│   │   │   └── profile_tools.py            # update_profile_summary
│   │   ├── services/
│   │   │   └── session_manager.py          # In-memory session store (24h TTL)
│   │   └── api/
│   │       ├── streaming.py                # Event dict → SSE converter
│   │       └── routes/
│   │           ├── chat.py                 # /api/chat/* (SSE streaming + upload)
│   │           ├── jobs.py                 # /api/jobs/* (direct Reed API)
│   │           ├── documents.py            # /api/documents/* (generate + download)
│   │           ├── profile.py              # /api/profile (get/update profile)
│   │           └── applications.py         # /api/applications/* (stub)
│   ├── output/                             # Generated CVs and cover letters
│   ├── uploads/                            # Uploaded CV files
│   └── templates/                          # HTML templates (legacy CV generation)
├── frontend/
│   ├── package.json
│   ├── next.config.ts                      # API proxy: /api/* → localhost:8000
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                  # Root layout (server component)
│   │   │   ├── page.tsx                    # Single-page chat UI (client component)
│   │   │   └── globals.css                 # Tailwind + custom animations
│   │   ├── components/
│   │   │   ├── InfoPanel.tsx               # Profile sidebar (left)
│   │   │   ├── JobsPanel.tsx               # Job results sidebar (right)
│   │   │   └── DeliveryPanel.tsx           # Loading state UI (not yet used)
│   │   └── lib/
│   │       └── utils.ts                    # cn() helper (clsx + tailwind-merge)
```

---

## API Endpoints

### Chat

| Method | Path                     | Description                              |
| ------ | ------------------------ | ---------------------------------------- |
| `POST` | `/api/chat/message`      | Send message → SSE stream response       |
| `POST` | `/api/chat/message/sync` | Send message → JSON response (no stream) |
| `POST` | `/api/chat/upload`       | Upload CV file → JSON response           |
| `GET`  | `/api/chat/history`      | Get conversation history                 |

### Profile

| Method | Path           | Description               |
| ------ | -------------- | ------------------------- |
| `GET`  | `/api/profile` | Get current `UserProfile` |
| `PUT`  | `/api/profile` | Replace profile           |

### Jobs

| Method | Path               | Description               |
| ------ | ------------------ | ------------------------- |
| `GET`  | `/api/jobs/search` | Search Reed API directly  |
| `GET`  | `/api/jobs/{id}`   | Get full job details      |
| `POST` | `/api/jobs/match`  | Agent-driven job matching |

### Documents

| Method | Path                                 | Description                  |
| ------ | ------------------------------------ | ---------------------------- |
| `POST` | `/api/documents/generate`            | Generate docs via agent      |
| `GET`  | `/api/documents/{filename}/download` | Download generated file      |
| `GET`  | `/api/documents/list`                | List all generated documents |

### Applications _(stub)_

| Method | Path                      | Description               |
| ------ | ------------------------- | ------------------------- |
| `POST` | `/api/applications/apply` | Create application record |
| `GET`  | `/api/applications`       | List applications         |

---

## Setup & Development

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 18+
- `pdflatex` (for LaTeX CV generation — install via TeX Live or MacTeX)
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))
- Reed API key ([reed.co.uk/developers](https://www.reed.co.uk/developers))

### Environment Variables

Create a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-...
REED_API_KEY=...
```

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### Linting

```bash
cd backend && uv run ruff check .
```

---

## License

MIT