"""User profile schema — the central data model built by the Story Coach."""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class WorkStyle(str, Enum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    ANY = "any"


class JobType(str, Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    TEMP = "temp"
    ANY = "any"


class Experience(BaseModel):
    """A single work experience entry."""

    title: str = Field(description="Job title")
    company: str = Field(description="Company or organisation name")
    location: Optional[str] = Field(default=None, description="City / region")
    start_date: Optional[date] = None
    end_date: Optional[date] = Field(
        default=None, description="None means current role"
    )
    description: str = Field(
        default="", description="Summary of responsibilities and achievements"
    )
    highlights: list[str] = Field(
        default_factory=list,
        description="Bullet-point achievements (quantified where possible)",
    )


class Education(BaseModel):
    """A single education entry."""

    institution: str
    degree: str = Field(description="e.g. BSc Computer Science")
    location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    grade: Optional[str] = Field(default=None, description="e.g. First Class Honours")
    highlights: list[str] = Field(default_factory=list)


class JobPreferences(BaseModel):
    """What the user is looking for in their next role."""

    target_roles: list[str] = Field(
        default_factory=list,
        description="Role titles the user is targeting",
    )
    locations: list[str] = Field(
        default_factory=list,
        description="Preferred locations / cities",
    )
    salary_min: Optional[int] = Field(
        default=None, description="Minimum acceptable salary (GBP/year)"
    )
    salary_max: Optional[int] = Field(
        default=None, description="Ideal salary (GBP/year)"
    )
    work_style: WorkStyle = WorkStyle.ANY
    job_type: JobType = JobType.ANY
    industries: list[str] = Field(
        default_factory=list,
        description="Preferred industries / sectors",
    )
    willing_to_relocate: bool = False


class UserProfile(BaseModel):
    """Complete user profile assembled by the Story Coach and/or CV parser."""

    # --- Identity ---
    name: str = ""
    email: str = ""
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None

    # --- Professional summary ---
    summary: str = Field(
        default="",
        description="2-3 sentence professional summary",
    )

    # --- Skills ---
    technical_skills: list[str] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)

    # --- Experience & Education ---
    experience: list[Experience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)

    # --- Extras ---
    certifications: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)

    # --- Preferences ---
    preferences: JobPreferences = Field(default_factory=JobPreferences)

    # --- Raw story (kept for LLM context) ---
    raw_story: str = Field(
        default="",
        description="The user's original career story paragraph(s)",
    )

    def is_complete(self) -> bool:
        """Heuristic check: does the profile have enough data to generate a CV?"""
        return bool(
            self.name
            and self.summary
            and (self.experience or self.education)
            and self.technical_skills
        )
