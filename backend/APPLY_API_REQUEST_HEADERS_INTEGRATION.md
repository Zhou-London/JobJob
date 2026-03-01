# Apply API Request-Headers Integration

This document explains how frontend/backend can integrate the new apply flow that loads Reed auth headers from a backend file.

## Background

`POST /api/applications/apply` now supports file-based request header loading for Reed apply auth.

This is for copied header text like:

```text
Authorization: Bearer eyJ...
Content-Type: application/json
Origin: https://www.reed.co.uk
Referer: https://www.reed.co.uk/
Sec-Fetch-Site: same-site
User-Agent: Mozilla/5.0 ...
x-correlation-id: ...
x-correlation-session-id: ...
```

## API Contract

Endpoint: `POST /api/applications/apply`

Request body fields (new + existing):

- `session_id: string` (required)
- `job_id: number` (required)
- `job_title: string` (optional)
- `employer_name: string` (optional)
- `dry_run: boolean` (optional, default `false`)
- `request_headers: Record<string, string>` (optional)
- `request_headers_file: string` (optional, new)

## Header Source Priority

Backend resolves headers in this order:

1. Load headers from `request_headers_file` (if request provides it), otherwise from env `REED_REQUEST_HEADERS_FILE` (if configured).
2. Merge `request_headers` from request body on top (case-insensitive).  
   This means explicit request headers override file headers.

## Supported Header Names

Parser keeps auth/apply-relevant headers only:

- Exact: `Authorization`, `Cookie`, `Content-Type`, `Origin`, `Priority`, `Referer`, `User-Agent`, `Accept`, `Accept-Language`, `Accept-Encoding`
- Prefixes: `sec-fetch-*`, `sec-ch-*`, `x-correlation-*`

Ignored example: `Content-Length` (auto-managed by HTTP client).

## Configuration (Recommended)

Set this in backend `.env`:

```env
REED_REQUEST_HEADERS_FILE=/absolute/or/relative/path/to/reed_headers.txt
```

With this set, frontend does not need to send `request_headers_file` each time.

## Frontend Integration Options

### Option A: Backend default file (simplest)

Frontend keeps current payload:

```json
{
  "session_id": "xxx",
  "job_id": 56457799,
  "job_title": "Python Developer",
  "employer_name": "E-Solutions IT Services UK Ltd",
  "dry_run": false
}
```

Backend reads `REED_REQUEST_HEADERS_FILE` automatically.

### Option B: Per-request file path

Frontend sends file path in request:

```json
{
  "session_id": "xxx",
  "job_id": 56457799,
  "job_title": "Python Developer",
  "employer_name": "E-Solutions IT Services UK Ltd",
  "dry_run": false,
  "request_headers_file": "/path/to/reed_headers.txt"
}
```

Use only paths readable by backend runtime environment.

### Option C: Direct headers (existing behavior)

Frontend can still send `request_headers` directly.

## Error Handling

`400 Bad Request` returned for header-file issues:

- Header file not found
- Header file empty
- No usable headers parsed
- Missing `Authorization` in parsed headers

`200 OK` with `status: "failed"` can still happen when Reed rejects apply:

- `401 Unauthorized` (token expired/invalid)
- `409` already applied
- `400` required screening questions not answered
- External apply URL (not internal Reed apply)

## Quick Smoke Test

1. Put copied headers into file (one `Key: Value` per line).
2. Configure `REED_REQUEST_HEADERS_FILE` or pass `request_headers_file`.
3. Call `POST /api/applications/apply`.
4. Check response:
   - `reed_result.auth_method` should be `request_headers`
   - Success requires `reed_result.ok = true` and non-null `reed_result.application_id`.

## Security Notes

- Do not commit real bearer tokens/header files.
- Treat header files as secrets.
- Rotate token/header file when Reed starts returning `401`.
