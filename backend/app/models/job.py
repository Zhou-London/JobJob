"""Job listing schemas — Reed API response models and matching types."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobType(str, Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    TEMP = "temp"


class JobListing(BaseModel):
    """A single job listing from the Reed API."""

    job_id: int = Field(description="Reed job ID")
    employer_name: str = ""
    employer_id: Optional[int] = None
    job_title: str = ""
    location_name: str = ""
    description: str = Field(
        default="", description="Short description (search) or full HTML (details)"
    )
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    currency: Optional[str] = "GBP"
    salary_type: Optional[str] = Field(
        default=None, description="e.g. per annum, per day"
    )
    contract_type: Optional[str] = None
    job_type: Optional[str] = None
    full_time: Optional[bool] = None
    part_time: Optional[bool] = None
    expiration_date: Optional[datetime] = None
    external_url: Optional[str] = Field(
        default=None, description="Direct application URL"
    )
    job_url: Optional[str] = Field(default=None, description="Reed listing URL")
    date_posted: Optional[datetime] = None

    @classmethod
    def from_reed_search(cls, data: dict) -> "JobListing":
        """Parse a job from Reed search results."""
        return cls(
            job_id=data.get("jobId", 0),
            employer_name=data.get("employerName", ""),
            employer_id=data.get("employerId"),
            job_title=data.get("jobTitle", ""),
            location_name=data.get("locationName", ""),
            description=data.get("jobDescription", ""),
            salary_min=data.get("minimumSalary"),
            salary_max=data.get("maximumSalary"),
            currency=data.get("currency", "GBP"),
            date_posted=data.get("date"),
            job_url=data.get("jobUrl"),
            external_url=data.get("externalUrl"),
        )

    @classmethod
    def from_reed_details(cls, data: dict) -> "JobListing":
        """Parse a job from Reed job details endpoint."""
        return cls(
            job_id=data.get("jobId", 0),
            employer_name=data.get("employerName", ""),
            employer_id=data.get("employerId"),
            job_title=data.get("jobTitle", ""),
            location_name=data.get("locationName", ""),
            description=data.get("jobDescription", ""),
            salary_min=data.get("yearlyMinimumSalary") or data.get("minimumSalary"),
            salary_max=data.get("yearlyMaximumSalary") or data.get("maximumSalary"),
            currency=data.get("currency", "GBP"),
            salary_type=data.get("salaryType"),
            contract_type=data.get("contractType"),
            job_type=data.get("jobType"),
            expiration_date=data.get("expirationDate"),
            external_url=data.get("externalUrl"),
            job_url=data.get("jobUrl"),
            date_posted=data.get("datePosted"),
        )


class JobSearchParams(BaseModel):
    """Parameters for searching jobs via Reed API."""

    keywords: str = Field(description="Search keywords")
    location: Optional[str] = Field(default=None, description="Location name")
    distance_from_location: Optional[int] = Field(
        default=None, description="Distance in miles from location"
    )
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    permanent: Optional[bool] = None
    contract: Optional[bool] = None
    temp: Optional[bool] = None
    full_time: Optional[bool] = None
    part_time: Optional[bool] = None
    results_to_take: int = Field(default=25, ge=1, le=100)
    results_to_skip: int = Field(default=0, ge=0)


class RankedJob(BaseModel):
    """A job listing with an AI-generated match score."""

    job: JobListing
    score: int = Field(ge=0, le=100, description="Match score 0-100")
    reasoning: str = Field(default="", description="Why this score was given")
