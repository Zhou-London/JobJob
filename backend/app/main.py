"""FastAPI application entry point."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chat, jobs, documents, applications, profile
from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="JobJob API",
    description="AI-Powered Automated Job Application Agent",
    version="0.1.0",
)

# CORS — allow the frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(chat.router)
app.include_router(jobs.router)
app.include_router(documents.router)
app.include_router(applications.router)
app.include_router(profile.router)


@app.get("/")
async def root():
    return {
        "name": "JobJob API",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
