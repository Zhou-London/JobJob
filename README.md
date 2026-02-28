# JobJob

Simple JSON database for job postings.

## Feature implemented

- Stores all jobs in a **single JSON file** (`jobs_database.json` by default)
- Core method: `add(job_data)`
- Validates required fields and salary range
- Auto-creates the JSON database file if missing

## Required job keys

- `Job title`
- `Job description`
- `Apply link`
- `lowest salary`
- `highest salary`
- `Location`

## Additional keys included

- `Company`
- `Employment type`
- `Currency`
- `Remote`
- `Posted date`
- `Source`
- `Tags`
- `Notes`
- `id`
- `created_at`
- `updated_at`

## Usage

```python
from job_json_database import JobJSONDatabase

db = JobJSONDatabase("jobs_database.json")

job = db.add(
    {
        "Job title": "Backend Engineer",
        "Job description": "Build APIs and data pipelines.",
        "Apply link": "https://example.com/jobs/123",
        "lowest salary": 100000,
        "highest salary": 150000,
        "Location": "New York, NY",
        "Company": "Acme Corp",
        "Employment type": "Full-time",
        "Remote": True,
        "Tags": ["python", "api"],
    }
)

print(job["id"])
```
