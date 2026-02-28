"""Reed API client — custom tools for job search and details.

These functions are used directly by the agent orchestrator as tool
implementations. They wrap the Reed REST API (https://www.reed.co.uk/api/1.0/).
"""

from __future__ import annotations

import json
from typing import Any, Optional

import httpx

from app.config import settings
from app.models.job import JobListing, JobSearchParams


class ReedClient:
    """Async client for the Reed job search API."""

    def __init__(self) -> None:
        self.base_url = settings.reed_api_base
        self.api_key = settings.reed_api_key

    def _auth(self) -> httpx.BasicAuth:
        """Reed uses HTTP Basic with the API key as username, empty password."""
        return httpx.BasicAuth(username=self.api_key, password="")

    async def search_jobs(
        self,
        keywords: str,
        location: Optional[str] = None,
        distance_miles: Optional[int] = None,
        salary_min: Optional[int] = None,
        salary_max: Optional[int] = None,
        permanent: Optional[bool] = None,
        contract: Optional[bool] = None,
        temp: Optional[bool] = None,
        full_time: Optional[bool] = None,
        part_time: Optional[bool] = None,
        results_to_take: int = 25,
        results_to_skip: int = 0,
    ) -> list[JobListing]:
        """Search for jobs on Reed. Returns a list of JobListing objects."""
        params: dict[str, Any] = {
            "keywords": keywords,
            "resultsToTake": min(results_to_take, 100),
            "resultsToSkip": results_to_skip,
        }
        if location:
            params["locationName"] = location
        if distance_miles is not None:
            params["distanceFromLocation"] = distance_miles
        if salary_min is not None:
            params["minimumSalary"] = salary_min
        if salary_max is not None:
            params["maximumSalary"] = salary_max
        if permanent is not None:
            params["permanent"] = str(permanent).lower()
        if contract is not None:
            params["contract"] = str(contract).lower()
        if temp is not None:
            params["temp"] = str(temp).lower()
        if full_time is not None:
            params["fullTime"] = str(full_time).lower()
        if part_time is not None:
            params["partTime"] = str(part_time).lower()

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/search",
                params=params,
                auth=self._auth(),
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results", data) if isinstance(data, dict) else data
        return [JobListing.from_reed_search(item) for item in results]

    async def get_job_details(self, job_id: int) -> JobListing:
        """Fetch full details for a single job by Reed job ID."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/jobs/{job_id}",
                auth=self._auth(),
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()

        return JobListing.from_reed_details(data)


# ---------------------------------------------------------------------------
# Tool functions (called by the Anthropic agent via tool_use)
# ---------------------------------------------------------------------------

reed_client = ReedClient()


async def tool_search_jobs(
    keywords: str,
    location: str | None = None,
    salary_min: int | None = None,
    salary_max: int | None = None,
    job_type: str | None = None,
    results_to_take: int = 25,
) -> str:
    """Search for jobs on Reed.co.uk.

    Args:
        keywords: Search terms (e.g. 'python developer')
        location: City or region (e.g. 'London')
        salary_min: Minimum salary filter
        salary_max: Maximum salary filter
        job_type: One of 'permanent', 'contract', 'temp' or None for all
        results_to_take: Number of results (max 100)

    Returns:
        JSON string of matching job listings.
    """
    permanent = job_type == "permanent" if job_type else None
    contract = job_type == "contract" if job_type else None
    temp = job_type == "temp" if job_type else None

    jobs = await reed_client.search_jobs(
        keywords=keywords,
        location=location,
        salary_min=salary_min,
        salary_max=salary_max,
        permanent=permanent,
        contract=contract,
        temp=temp,
        results_to_take=results_to_take,
    )
    return json.dumps([j.model_dump(mode="json") for j in jobs], indent=2)


async def tool_get_job_details(job_id: int) -> str:
    """Get full details for a specific Reed job listing.

    Args:
        job_id: The Reed job ID.

    Returns:
        JSON string of the full job details.
    """
    job = await reed_client.get_job_details(job_id)
    return job.model_dump_json(indent=2)
