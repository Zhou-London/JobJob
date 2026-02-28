"""Simple JSON-file database for job postings.

This module stores all job records in a single JSON file and exposes a core
`add` method for appending new jobs.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


class JobJSONDatabase:
    """Maintain job postings in a single JSON file."""

    REQUIRED_KEYS = {
        "Job title",
        "Job description",
        "Apply link",
        "lowest salary",
        "highest salary",
        "Location",
    }

    OPTIONAL_DEFAULTS = {
        "Company": "",
        "Employment type": "",
        "Currency": "USD",
        "Remote": False,
        "Posted date": "",
        "Source": "",
        "Tags": [],
        "Notes": "",
    }

    def __init__(self, file_path: str = "jobs_database.json") -> None:
        self.file_path = Path(file_path)
        self._ensure_db_file()

    def _ensure_db_file(self) -> None:
        if self.file_path.exists():
            return

        initial_data = {
            "jobs": [],
            "meta": {
                "version": 1,
                "created_at": self._now_iso(),
                "updated_at": self._now_iso(),
                "record_count": 0,
            },
        }
        self._write_db(initial_data)

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _read_db(self) -> Dict[str, Any]:
        with self.file_path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if "jobs" not in data or not isinstance(data["jobs"], list):
            raise ValueError("Invalid database format: expected key 'jobs' as a list.")

        if "meta" not in data or not isinstance(data["meta"], dict):
            data["meta"] = {}

        return data

    def _write_db(self, data: Dict[str, Any]) -> None:
        with self.file_path.open("w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, ensure_ascii=False)
            file.write("\n")

    def _validate_required(self, job_data: Dict[str, Any]) -> None:
        missing = [key for key in self.REQUIRED_KEYS if key not in job_data]
        if missing:
            raise ValueError(f"Missing required fields: {', '.join(sorted(missing))}")

        for key in self.REQUIRED_KEYS:
            value = job_data[key]
            if value is None or (isinstance(value, str) and not value.strip()):
                raise ValueError(f"Field '{key}' cannot be empty.")

    @staticmethod
    def _normalize_salary(value: Any, field_name: str) -> float:
        try:
            salary = float(value)
        except (TypeError, ValueError) as error:
            raise ValueError(f"Field '{field_name}' must be numeric.") from error

        if salary < 0:
            raise ValueError(f"Field '{field_name}' cannot be negative.")

        return salary

    def add(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Add one job record to the JSON database.

        Args:
            job_data: Dictionary containing job information.

        Returns:
            The saved job record.
        """
        if not isinstance(job_data, dict):
            raise ValueError("job_data must be a dictionary.")

        self._validate_required(job_data)

        lowest_salary = self._normalize_salary(job_data["lowest salary"], "lowest salary")
        highest_salary = self._normalize_salary(job_data["highest salary"], "highest salary")
        if lowest_salary > highest_salary:
            raise ValueError("'lowest salary' cannot be greater than 'highest salary'.")

        db = self._read_db()

        record = {
            "id": str(uuid.uuid4()),
            "created_at": self._now_iso(),
            "updated_at": self._now_iso(),
            "Job title": str(job_data["Job title"]).strip(),
            "Job description": str(job_data["Job description"]).strip(),
            "Apply link": str(job_data["Apply link"]).strip(),
            "lowest salary": lowest_salary,
            "highest salary": highest_salary,
            "Location": str(job_data["Location"]).strip(),
        }

        for key, default_value in self.OPTIONAL_DEFAULTS.items():
            value = job_data.get(key, default_value)
            if key == "Tags" and value is None:
                value = []
            record[key] = value

        db["jobs"].append(record)
        db["meta"]["updated_at"] = self._now_iso()
        db["meta"]["record_count"] = len(db["jobs"])

        self._write_db(db)
        return record


if __name__ == "__main__":
    database = JobJSONDatabase()
    sample = {
        "Job title": "Software Engineer",
        "Job description": "Build and maintain backend services.",
        "Apply link": "https://example.com/apply",
        "lowest salary": 90000,
        "highest salary": 130000,
        "Location": "San Francisco, CA",
        "Company": "Example Inc.",
        "Employment type": "Full-time",
        "Remote": True,
        "Tags": ["python", "backend"],
        "Source": "Company Website",
    }

    added = database.add(sample)
    print(f"Added job with id: {added['id']}")
