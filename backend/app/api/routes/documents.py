"""Document routes — generate and download tailored CVs and cover letters."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.agents.orchestrator import AgentMode
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

    response = await session.orchestrator.chat_simple(prompt)

    return {"session_id": session.id, "message": response}


@router.get("/{filename}/download")
async def download_document(filename: str):
    """Download a generated document by filename."""
    # Look in output directory
    from app.config import settings

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
    from app.config import settings

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
