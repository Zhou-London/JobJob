"""Document routes — generate and download tailored CVs and cover letters."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.agents.orchestrator import AgentMode
from app.config import settings
from app.services.session_manager import session_manager

router = APIRouter(prefix="/api/documents", tags=["documents"])


class GenerateDocsRequest(BaseModel):
    session_id: str
    job_id: int


@router.post("/generate")
async def generate_documents(req: GenerateDocsRequest):
    """Generate a tailored CV and cover letter for a specific job.

    Switches the agent to cv_writer mode. The agent will:
    1. Get the full job details
    2. Tailor the CV content for the job
    3. Write a cover letter
    4. Call the generation tools to create PDF/DOCX files
    """
    session = session_manager.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.orchestrator.set_mode(AgentMode.CV_WRITER)

    prompt = (
        f"Please generate a tailored CV and cover letter for job ID {req.job_id}. "
        f"First get the full job details using get_job_details, then tailor my "
        f"profile for this specific role and generate both documents."
    )

    output_dir = settings.output_dir
    before = {
        f.name
        for f in output_dir.iterdir()
        if f.is_file() and f.suffix.lower() in (".pdf", ".docx")
    }

    response = await session.orchestrator.chat_simple(prompt)

    after_files = [
        f
        for f in output_dir.iterdir()
        if f.is_file() and f.suffix.lower() in (".pdf", ".docx")
    ]
    after = {f.name for f in after_files}
    new_files = sorted(after - before)

    if not new_files:
        excerpt = response.replace("\n", " ").strip()
        if len(excerpt) > 240:
            excerpt = f"{excerpt[:240]}..."
        raise HTTPException(
            status_code=500,
            detail=(
                "Document generation completed but no files were created. "
                f"Agent response: {excerpt}"
            ),
        )

    docs = []
    for f in after_files:
        if f.name in new_files:
            docs.append(
                {
                    "filename": f.name,
                    "size_bytes": f.stat().st_size,
                    "type": f.suffix.lower().lstrip("."),
                    "download_url": f"/api/documents/{f.name}/download",
                }
            )

    return {"session_id": session.id, "message": response, "documents": docs}


@router.get("/{filename}/download")
async def download_document(filename: str):
    """Download a generated document by filename."""
    file_path = settings.output_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")

    # Determine media type
    suffix = file_path.suffix.lower()
    media_types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    media_type = media_types.get(suffix, "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type,
    )


@router.get("/list")
async def list_documents():
    """List all generated documents."""
    output_dir = settings.output_dir
    if not output_dir.exists():
        return {"documents": []}

    files = []
    for f in sorted(output_dir.iterdir()):
        if f.is_file() and f.suffix.lower() in (".pdf", ".docx"):
            files.append(
                {
                    "filename": f.name,
                    "size_bytes": f.stat().st_size,
                    "type": f.suffix.lower().lstrip("."),
                    "download_url": f"/api/documents/{f.name}/download",
                }
            )

    return {"documents": files}
