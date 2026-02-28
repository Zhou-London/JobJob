#!/usr/bin/env python3
"""Fetch job data from the Reed Jobseeker API.

Setup:
  export REED_API_KEY="your_api_key"

Examples:
  python reed_job_data.py --keywords "python developer" --location "London"
  python reed_job_data.py --keywords "data engineer" --results-to-take 5 --include-details
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


BASE_URL = "https://www.reed.co.uk/api/1.0"


def _build_auth_header(api_key: str) -> str:
    token = base64.b64encode(f"{api_key}:".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def _request_json(url: str, api_key: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": _build_auth_header(api_key),
            "Accept": "application/json",
            "User-Agent": "reed-jobseeker-client/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read().decode("utf-8")
            return json.loads(data)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        message = f"HTTP {error.code} for {url}"
        if body:
            message += f": {body}"
        raise RuntimeError(message) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Failed to reach Reed API: {error}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Reed API returned non-JSON response: {error}") from error


def search_jobs(api_key: str, params: dict[str, Any]) -> dict[str, Any]:
    clean_params = {k: v for k, v in params.items() if v is not None}
    query = urllib.parse.urlencode(clean_params)
    url = f"{BASE_URL}/search"
    if query:
        url = f"{url}?{query}"
    return _request_json(url, api_key)


def get_job_details(api_key: str, job_id: int) -> dict[str, Any]:
    url = f"{BASE_URL}/jobs/{job_id}"
    return _request_json(url, api_key)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch jobs from Reed Jobseeker API.")
    parser.add_argument("--keywords", help="Search keywords, e.g. 'python developer'.")
    parser.add_argument("--location", dest="location_name", help="Location name, e.g. London.")
    parser.add_argument("--distance", dest="distance_from_location", type=int, help="Distance in miles.")
    parser.add_argument("--minimum-salary", type=int)
    parser.add_argument("--maximum-salary", type=int)
    parser.add_argument("--full-time", action="store_true")
    parser.add_argument("--part-time", action="store_true")
    parser.add_argument("--permanent", action="store_true")
    parser.add_argument("--contract", action="store_true")
    parser.add_argument("--temp", action="store_true")
    parser.add_argument("--results-to-take", type=int, default=10)
    parser.add_argument("--results-to-skip", type=int, default=0)
    parser.add_argument(
        "--include-details",
        action="store_true",
        help="Fetch /jobs/{id} details for each result in the search list.",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("REED_API_KEY"),
        help="Reed API key. Defaults to REED_API_KEY environment variable.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.api_key:
        print("Missing API key. Set REED_API_KEY or pass --api-key.", file=sys.stderr)
        return 2

    params = {
        "keywords": args.keywords,
        "locationName": args.location_name,
        "distanceFromLocation": args.distance_from_location,
        "minimumSalary": args.minimum_salary,
        "maximumSalary": args.maximum_salary,
        "fullTime": str(args.full_time).lower() if args.full_time else None,
        "partTime": str(args.part_time).lower() if args.part_time else None,
        "permanent": str(args.permanent).lower() if args.permanent else None,
        "contract": str(args.contract).lower() if args.contract else None,
        "temp": str(args.temp).lower() if args.temp else None,
        "resultsToTake": args.results_to_take,
        "resultsToSkip": args.results_to_skip,
    }

    try:
        search_response = search_jobs(args.api_key, params)
        if args.include_details:
            results = search_response.get("results", [])
            details = []
            for job in results:
                job_id = job.get("jobId")
                if isinstance(job_id, int):
                    details.append(get_job_details(args.api_key, job_id))
            search_response["jobDetails"] = details
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1

    print(json.dumps(search_response, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
