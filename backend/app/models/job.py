"""Job listing schemas — Reed API response models and matching types."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _parse_reed_date(value: str | datetime | None) -> datetime | None:
    """Parse dates from Reed API which uses dd/mm/yyyy format."""
    if value is None or isinstance(value, datetime):
        return value
    if isinstance(value, str):
        for fmt in ("%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
    return None


class JobType(str, Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    TEMP = "temp"


class JobListing(BaseModel):
    """A single job listing from the Reed API."""

    model_config = ConfigDict(populate_by_name=True)

    job_id: int = Field(description="Reed job ID", serialization_alias="jobId")
    employer_name: str = Field(default="", serialization_alias="employerName")
    employer_id: Optional[int] = Field(default=None, serialization_alias="employerId")
    job_title: str = Field(default="", serialization_alias="jobTitle")
    location_name: str = Field(default="", serialization_alias="locationName")
    description: str = Field(
        default="",
        description="Short description (search) or full HTML (details)",
        serialization_alias="jobDescription",
    )
    salary_min: Optional[float] = Field(
        default=None, serialization_alias="minimumSalary"
    )
    salary_max: Optional[float] = Field(
        default=None, serialization_alias="maximumSalary"
    )
    currency: Optional[str] = "GBP"
    salary_type: Optional[str] = Field(
        default=None,
        description="e.g. per annum, per day",
        serialization_alias="salaryType",
    )
    contract_type: Optional[str] = Field(
        default=None, serialization_alias="contractType"
    )
    job_type: Optional[str] = Field(default=None, serialization_alias="jobType")
    full_time: Optional[bool] = Field(default=None, serialization_alias="fullTime")
    part_time: Optional[bool] = Field(default=None, serialization_alias="partTime")
    expiration_date: Optional[datetime] = Field(
        default=None, serialization_alias="expirationDate"
    )
    external_url: Optional[str] = Field(
        default=None,
        description="Direct application URL",
        serialization_alias="externalUrl",
    )
    job_url: Optional[str] = Field(
        default=None, description="Reed listing URL", serialization_alias="jobUrl"
    )
    easy_apply: Optional[bool] = Field(
        default=None,
        description="Whether Reed marks this listing as Easy Apply.",
    )
    date_posted: Optional[datetime] = Field(
        default=None, serialization_alias="datePosted"
    )

    @field_validator("date_posted", "expiration_date", mode="before")
    @classmethod
    def _parse_dates(cls, v: str | datetime | None) -> datetime | None:
        return _parse_reed_date(v)

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
            easy_apply=data.get("easyApply"),
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
            easy_apply=data.get("easyApply"),
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
