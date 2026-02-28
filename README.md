# JobJob

**AI-Powered Automated Job Application Agent** — Tell your career story, and JobJob finds matching roles, tailors your CV & cover letter, and applies for you.

Built on [Anthropic's Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python) with a FastAPI backend and Next.js frontend.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Agent System Design](#agent-system-design)
- [Project Structure](#project-structure)
- [Implementation Plan](#implementation-plan)
- [API Endpoints](#api-endpoints)
- [Key Decisions](#key-decisions)
- [Setup & Development](#setup--development)
- [Verification & Testing](#verification--testing)

---

## Overview

JobJob is a hackathon project that automates the entire job application pipeline:

1. **Story Coaching** — The user provides a paragraph about themselves. An AI agent conducts a multi-turn interview, asking guided follow-up questions to build a comprehensive career profile.
2. **CV Upload (optional)** — Users can upload an existing CV (PDF/DOCX). The agent parses it and merges the data with the story coach output.
3. **Job Search & Matching** — Jobs are fetched from the Reed API. An AI agent scores and ranks each listing against the user's profile (0–100).
4. **CV & Cover Letter Tailoring** — For each target job, an AI agent generates a tailored CV and cover letter emphasizing relevant skills and mirroring the job description's language.
5. **Auto-Apply** — A Playwright-powered AI agent navigates to the job application page, fills out forms, uploads documents, and submits — with screenshots at every step.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                         │
│  /onboarding  │  /jobs  │  /jobs/[id]  │  /applications  │ ... │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │ SSE          │ REST         │ REST         │ WebSocket
       ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI HTTP/WS Layer                         │
│  /api/chat/*  │  /api/jobs/*  │  /api/documents/*  │  /api/ws/* │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Claude Agent SDK Orchestrator                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Story Coach  │  │ Job Matcher  │  │ CV/Cover Letter Writer│  │
│  │ (Sonnet)     │  │ (Sonnet)     │  │ (Opus)                │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                 │                       │              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Auto-Applier (Sonnet)                  │   │
│  └──────────────────────────┬───────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌──────────────┐  ┌───────────────────┐  ┌───────────────────────┐
│ Reed MCP     │  │ Document MCP      │  │ Playwright MCP        │
│ (Custom)     │  │ (Custom)          │  │ (@anthropic-ai/       │
│              │  │                   │  │  mcp-server-playwright)│
│ • search_jobs│  │ • parse_cv        │  │                       │
│ • get_details│  │ • generate_cv_pdf │  │ • navigate, click,    │
│              │  │ • generate_cl_pdf │  │   fill, screenshot,   │
│              │  │                   │  │   upload, etc.         │
└──────────────┘  └───────────────────┘  └───────────────────────┘
       │                      │
       ▼                      ▼
  Reed API             File System
  (reed.co.uk)         (PDF/DOCX I/O)
```

---

## Tech Stack

### Backend (Python)

| Component           | Technology                  | Purpose                                                   |
| ------------------- | --------------------------- | --------------------------------------------------------- |
| Agent Framework     | `claude-agent-sdk`          | Agent loop, subagents, tool execution, session management |
| HTTP Server         | `fastapi` + `uvicorn`       | REST API, SSE streaming, WebSocket                        |
| Job Data            | Reed API (`httpx`)          | Job search & details                                      |
| CV Parsing          | `pdfplumber`, `python-docx` | Extract text from uploaded CVs                            |
| Document Generation | `python-docx`, `weasyprint` | Generate tailored CV & cover letter (DOCX + PDF)          |
| Browser Automation  | Playwright MCP Server       | Auto-fill & submit job applications                       |
| Config              | `python-dotenv`, `pydantic` | Environment variables & data validation                   |

### Frontend (TypeScript)

| Component   | Technology           | Purpose                          |
| ----------- | -------------------- | -------------------------------- |
| Framework   | Next.js (App Router) | Pages, routing, SSR              |
| UI Library  | React + Tailwind CSS | Component styling                |
| Components  | shadcn/ui            | Pre-built accessible components  |
| HTTP Client | `fetch` (native)     | REST, SSE, WebSocket connections |

### External Services

| Service              | Purpose                       | Auth                        |
| -------------------- | ----------------------------- | --------------------------- |
| Anthropic Claude API | All LLM tasks (via Agent SDK) | `ANTHROPIC_API_KEY`         |
| Reed API             | Job search & details          | `REED_API_KEY` (HTTP Basic) |

---

## Agent System Design

The system uses the Claude Agent SDK's native **subagent architecture**. A top-level **Orchestrator** agent coordinates four specialist subagents via the `Task` tool. Claude autonomously decides when to delegate to each specialist.

### Orchestrator

- **Role**: Coordinates the full workflow — story coaching → job matching → document generation → auto-apply
- **Tools**: `Task` (to delegate to subagents)
- **System Prompt**: "You are JobJob, an AI career assistant. You coordinate between specialists to help users find and apply for jobs."

### Subagent 1: Story Coach

- **Role**: Conducts a multi-turn career interview
- **Model**: Claude Sonnet (fast, conversational)
- **Tools**: `mcp__documents__parse_cv`
- **Output**: Structured `UserProfile` (JSON Schema)
- **Behavior**:
  - Accepts the user's initial career story paragraph
  - Asks 4–6 guided follow-up questions (achievements, skills, goals, preferences)
  - Iteratively refines the profile
  - Merges uploaded CV data if available
- **Session**: Uses `ClaudeSDKClient` for multi-turn conversation persistence

### Subagent 2: Job Matcher

- **Role**: Searches, scores, and ranks job listings
- **Model**: Claude Sonnet
- **Tools**: `mcp__reed__search_jobs`, `mcp__reed__get_job_details`
- **Output**: Ranked list of jobs with scores (0–100) and reasoning
- **Behavior**:
  - Converts user preferences into Reed API search parameters
  - Fetches listings, evaluates each against the user profile
  - Returns ranked results with match rationale

### Subagent 3: CV/Cover Letter Writer

- **Role**: Generates tailored application documents
- **Model**: Claude Opus (highest quality writing)
- **Tools**: `mcp__documents__generate_cv_pdf`, `mcp__documents__generate_cover_letter_pdf`
- **Output**: PDF and DOCX files
- **Behavior**:
  - Takes `UserProfile` + target `JobListing` as context
  - Rewrites bullet points to emphasize job-relevant skills
  - Quantifies achievements, mirrors the job description's language
  - Generates professional CV and personalized cover letter

### Subagent 4: Auto-Applier

- **Role**: Fills out and submits job applications via browser automation
- **Model**: Claude Sonnet
- **Tools**: All `mcp__playwright__*` tools (navigate, click, fill, screenshot, upload file)
- **Behavior**:
  - Navigates to the job's external application URL
  - Analyzes the page DOM to identify form fields
  - Fills fields from `UserProfile` (name, email, phone, etc.)
  - Uploads generated CV and cover letter
  - Takes screenshots at each step for audit trail
  - Supports dry-run mode (fill everything but don't submit)
  - Handles common ATS layouts: Greenhouse, Lever, Workday, generic forms

### Custom MCP Servers (In-Process)

Custom tools are registered via the `@tool` decorator and served as in-process MCP servers using `create_sdk_mcp_server()`:

**Reed MCP Server** (`name="reed"`):
- `search_jobs(keywords, location, salary_min, salary_max, job_type)` — Calls Reed API `/search`
- `get_job_details(job_id)` — Calls Reed API `/jobs/{jobId}`

**Document MCP Server** (`name="documents"`):
- `parse_cv(file_path)` — Extracts text from PDF/DOCX using `pdfplumber`/`python-docx`
- `generate_cv_pdf(profile_json, job_json)` — Generates tailored CV as PDF/DOCX
- `generate_cover_letter_pdf(profile_json, job_json)` — Generates tailored cover letter as PDF/DOCX

### Session Management

- `ClaudeSDKClient` maintains conversation state across HTTP requests
- Session IDs map to client instances in `SessionManager`
- Sessions support resume (continue conversation) and fork (branch into parallel workflows)
- Conversation history and generated artifacts (profiles, documents) are stored per session

---

## Project Structure

```
JobJob/
├── README.md
├── .env.example
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                          # FastAPI app entry point
│   │   ├── config.py                        # Settings & env vars
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user_profile.py              # UserProfile Pydantic schema
│   │   │   ├── job.py                       # JobListing schema
│   │   │   └── application.py              # Application status schema
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── definitions.py              # All AgentDefinition objects
│   │   │   ├── orchestrator.py             # Main orchestrator (ClaudeSDKClient)
│   │   │   └── hooks.py                    # PreToolUse, PostToolUse, etc.
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   ├── reed_tools.py              # @tool: search_jobs, get_job_details
│   │   │   └── document_tools.py          # @tool: parse_cv, generate_cv_pdf, etc.
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── session_manager.py         # Session ID → ClaudeSDKClient mapping
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── streaming.py               # AsyncIterator[Message] → SSE converter
│   │       └── routes/
│   │           ├── __init__.py
│   │           ├── chat.py                # /api/chat/* endpoints
│   │           ├── jobs.py                # /api/jobs/* endpoints
│   │           ├── documents.py           # /api/documents/* endpoints
│   │           ├── applications.py        # /api/applications/* endpoints
│   │           └── websocket.py           # /api/ws/* WebSocket handlers
│   └── templates/
│       ├── cv_template.html               # HTML template for CV PDF generation
│       └── cover_letter_template.html     # HTML template for cover letter PDF
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx                     # Root layout
│   │   ├── page.tsx                       # Landing page
│   │   ├── onboarding/
│   │   │   └── page.tsx                   # Story coach chat UI
│   │   ├── jobs/
│   │   │   ├── page.tsx                   # Job search & match dashboard
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Job detail + generate docs + apply
│   │   ├── applications/
│   │   │   └── page.tsx                   # Application tracker
│   │   └── profile/
│   │       └── page.tsx                   # View/edit user profile
│   ├── components/
│   │   ├── ui/                            # shadcn/ui components
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx             # Chat message list
│   │   │   ├── ChatInput.tsx              # Message input + send
│   │   │   └── CVUploadZone.tsx           # Drag-and-drop CV upload
│   │   ├── jobs/
│   │   │   ├── JobCard.tsx                # Job listing card with match score
│   │   │   ├── JobFilters.tsx             # Search filters
│   │   │   └── MatchBadge.tsx             # Color-coded score badge
│   │   ├── documents/
│   │   │   ├── DocumentPreview.tsx        # CV/Cover letter preview
│   │   │   └── DownloadButton.tsx         # PDF/DOCX download
│   │   └── apply/
│   │       ├── ApplyProgress.tsx          # Live screenshot feed
│   │       └── StatusChip.tsx             # Application status indicator
│   └── lib/
│       ├── api.ts                         # API client utilities
│       └── hooks/
│           ├── useSSE.ts                  # SSE stream hook
│           └── useWebSocket.ts            # WebSocket hook for auto-apply
└── docs/
    └── reed-api-reference.md              # Reed API quick reference
```

---

## Implementation Plan

### Phase 1 — Project Scaffolding
1. Initialize `backend/` with `pyproject.toml` and all Python dependencies
2. Initialize `frontend/` with Next.js, TypeScript, Tailwind, shadcn/ui
3. Create `.env.example` with required API keys
4. Set up basic FastAPI app and Next.js app shell

### Phase 2 — Pydantic Models & Custom MCP Tools
5. Create all Pydantic models (`UserProfile`, `JobListing`, `Application`)
6. Implement Reed API custom tools with `@tool` decorator → `create_sdk_mcp_server()`
7. Implement document tools (CV parsing, PDF/DOCX generation)

### Phase 3 — Agent Definitions
8. Define all four subagents as `AgentDefinition` objects with system prompts, tools, and model selection

### Phase 4 — Orchestrator & Session Management
9. Build the main orchestrator using `ClaudeAgentOptions` with subagents and `Task` tool
10. Implement `SessionManager` for multi-turn conversation persistence

### Phase 5 — FastAPI HTTP Layer
11. Create all API routes (REST + SSE + WebSocket)
12. Build SSE streaming utility to convert SDK messages → frontend events

### Phase 6 — Frontend
13. Build landing page and navigation
14. Build onboarding chat UI with CV upload
15. Build jobs dashboard with search, filters, and match scores
16. Build job detail page with document generation and auto-apply trigger
17. Build applications tracker with status and screenshots

### Phase 7 — Polish & Demo Readiness
18. Add SDK hooks for logging, screenshots, and permission handling
19. Add error handling, timeouts, and retry logic
20. Write comprehensive README with setup instructions and demo guide

---

## API Endpoints

### Chat (Story Coach)

| Method | Path                | Description                                                  |
| ------ | ------------------- | ------------------------------------------------------------ |
| `POST` | `/api/chat/message` | Send message to orchestrator/story coach, returns SSE stream |
| `POST` | `/api/chat/upload`  | Upload CV file for parsing                                   |

### Profile

| Method | Path           | Description                          |
| ------ | -------------- | ------------------------------------ |
| `GET`  | `/api/profile` | Get current structured `UserProfile` |
| `PUT`  | `/api/profile` | Update profile fields manually       |

### Jobs

| Method | Path               | Description                                                                                |
| ------ | ------------------ | ------------------------------------------------------------------------------------------ |
| `GET`  | `/api/jobs/search` | Search & rank jobs (query params: `q`, `location`, `salary_min`, `salary_max`, `job_type`) |
| `GET`  | `/api/jobs/{id}`   | Get full job details                                                                       |

### Documents

| Method | Path                           | Description                                   |
| ------ | ------------------------------ | --------------------------------------------- |
| `POST` | `/api/jobs/{id}/generate-docs` | Generate tailored CV + cover letter for a job |
| `GET`  | `/api/documents/{id}/download` | Download generated document (PDF or DOCX)     |

### Applications

| Method | Path                                 | Description                                    |
| ------ | ------------------------------------ | ---------------------------------------------- |
| `POST` | `/api/jobs/{id}/apply`               | Trigger auto-apply (body: `{ dry_run: bool }`) |
| `GET`  | `/api/applications`                  | List all applications with status              |
| `GET`  | `/api/applications/{id}/screenshots` | View screenshots from auto-apply               |

### WebSocket

| Path                        | Description                                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| `WS /api/ws/apply/{job_id}` | Live auto-apply progress — streams Playwright screenshots in real-time |

---

## Key Decisions

### 1. Claude Agent SDK as the Core Framework

**Decision**: Use `claude-agent-sdk` instead of LangChain, CrewAI, or a raw Anthropic API wrapper.

**Rationale**:
- Native agent loop with autonomous tool execution — no manual orchestration code
- Built-in subagent delegation via `Task` tool — Claude decides when to delegate
- `ClaudeSDKClient` provides session persistence for multi-turn conversations out of the box
- MCP ecosystem integration lets us plug in Playwright, databases, etc. without custom code
- Structured output via JSON Schema validation
- Hooks for logging, permission control, and observability

### 2. Four Subagents Under One Orchestrator

**Decision**: Story Coach, Job Matcher, CV/Cover Letter Writer, and Auto-Applier as separate `AgentDefinition` subagents.

**Rationale**:
- Each agent has a focused system prompt optimized for its task
- Different model selection per agent (Opus for writing quality, Sonnet for speed)
- Tool isolation — each agent only sees the tools it needs
- The orchestrator handles workflow sequencing; subagents focus on execution

### 3. Opus for CV Writing, Sonnet for Everything Else

**Decision**: Use Claude Opus for the CV/Cover Letter Writer subagent; Claude Sonnet for Story Coach, Job Matcher, and Auto-Applier.

**Rationale**:
- CV and cover letter quality directly impacts the user's job prospects — worth the higher cost
- Story coaching, job matching, and form filling are more mechanical tasks where Sonnet's speed and lower cost are preferable
- Can be easily reconfigured per subagent via `AgentDefinition.model`

### 4. Custom Tools via In-Process MCP Servers

**Decision**: Implement Reed API calls and document generation as custom `@tool`-decorated functions, served via `create_sdk_mcp_server()`.

**Rationale**:
- Seamless integration with the Claude Agent SDK's tool execution loop
- Tools are callable by name from any subagent (e.g., `mcp__reed__search_jobs`)
- No need for a separate tool registration mechanism
- In-process — no network overhead for custom tools

### 5. Playwright via MCP (Not Python Bindings)

**Decision**: Use `@anthropic-ai/mcp-server-playwright` for browser automation instead of raw Playwright Python bindings.

**Rationale**:
- The Auto-Applier subagent gets browser control as native MCP tools (navigate, click, fill, screenshot, upload)
- Claude can autonomously decide which browser actions to take based on page analysis
- No need to write brittle selectors or page-specific automation scripts
- Claude analyzes the DOM and adapts to any ATS layout

### 6. Python Backend + Next.js Frontend (Split Architecture)

**Decision**: FastAPI (Python) backend for all AI/automation logic; Next.js (TypeScript) frontend for the UI.

**Rationale**:
- Python has the richest ecosystem for AI agent frameworks, PDF manipulation, and document generation
- Next.js provides a polished, responsive UI with SSR, routing, and excellent developer experience
- FastAPI serves as a thin HTTP bridge — all intelligence lives in the agent layer
- Clear separation of concerns; either layer can be replaced independently

### 7. Reed API as Primary Job Source

**Decision**: Use Reed's API (`reed.co.uk/api/1.0/`) for job search and details.

**Rationale**:
- Free API with straightforward HTTP Basic auth
- Good coverage of UK job market (extensible to other sources later)
- Returns external application URLs (`externalUrl`) which Playwright can navigate to
- Note: Reed API is read-only (no apply endpoint) — auto-apply must go through external sites

### 8. Both CV Modes (Upload + Generate from Scratch)

**Decision**: Support both uploading an existing CV (PDF/DOCX) and generating one entirely from the Story Coach interview.

**Rationale**:
- Users with existing CVs get faster onboarding (upload → parse → merge with story data)
- Users without CVs (career changers, graduates) can build one from scratch via guided interview
- Both flows converge into the same `UserProfile` Pydantic schema
- The CV/Cover Letter Writer subagent works from `UserProfile` regardless of source

### 9. SSE for Chat, WebSocket for Auto-Apply

**Decision**: Use Server-Sent Events (SSE) for chat/story coaching streams; WebSocket for live auto-apply screenshot feeds.

**Rationale**:
- SSE is simpler and sufficient for unidirectional text streaming (agent → frontend)
- WebSocket is necessary for auto-apply where we need bidirectional communication (screenshot streams + user can cancel/pause) and binary data (screenshots)
- Avoids over-engineering: not everything needs a WebSocket

---

## Setup & Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or pnpm
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))
- Reed API key ([reed.co.uk/developers](https://www.reed.co.uk/developers))

### Environment Variables

```bash
cp .env.example .env
# Edit .env with your keys:
# ANTHROPIC_API_KEY=sk-ant-...
# REED_API_KEY=...
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Install Playwright browsers (for auto-apply)
npx -y @anthropic-ai/mcp-server-playwright install

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## Verification & Testing

| Test Case                | Steps                                                         | Expected Result                                                                                |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Story Coach**          | Send a paragraph to `/api/chat/message`                       | Agent asks 4–6 follow-up questions, then returns a complete `UserProfile`                      |
| **CV Upload**            | Upload a PDF/DOCX to `/api/chat/upload`                       | Text is extracted, profile fields are populated                                                |
| **Job Search**           | `GET /api/jobs/search?q=python+developer&location=London`     | Reed results returned with match scores (0–100)                                                |
| **Document Gen**         | `POST /api/jobs/{id}/generate-docs`                           | Tailored CV + cover letter PDFs generated, reference job-specific requirements                 |
| **Auto-Apply (dry run)** | `POST /api/jobs/{id}/apply` with `dry_run: true`              | Playwright navigates to application page, fills fields, takes screenshots, does **not** submit |
| **End-to-end**           | Onboarding → search → select job → generate docs → auto-apply | Full pipeline completes, application tracked with status + screenshots                         |

---

## License

MIT