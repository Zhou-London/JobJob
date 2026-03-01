"""Utilities for loading and sanitizing request headers from plain-text files."""

from __future__ import annotations

from pathlib import Path

_ALLOWED_EXACT = {
    "authorization",
    "cookie",
    "content-type",
    "origin",
    "priority",
    "referer",
    "user-agent",
    "accept",
    "accept-language",
    "accept-encoding",
}

_ALLOWED_PREFIXES = (
    "sec-fetch-",
    "sec-ch-",
    "x-correlation-",
)


def _is_allowed_header(name: str) -> bool:
    key = name.strip().lower()
    if key in _ALLOWED_EXACT:
        return True
    return key.startswith(_ALLOWED_PREFIXES)


def merge_headers_case_insensitive(
    base_headers: dict[str, str] | None,
    override_headers: dict[str, str] | None,
) -> dict[str, str]:
    """Merge two header dicts case-insensitively; override values win."""
    merged: dict[str, str] = dict(base_headers or {})
    if not override_headers:
        return merged

    for name, value in override_headers.items():
        lookup = name.lower()
        existing = next((k for k in merged if k.lower() == lookup), None)
        if existing is not None:
            del merged[existing]
        merged[str(name).strip()] = str(value).strip()

    return merged


def parse_headers_text(text: str) -> dict[str, str]:
    """Parse copied HTTP headers from plain text and keep auth-related headers."""
    headers: dict[str, str] = {}

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        name, value = line.split(":", 1)
        name = name.strip()
        value = value.strip()
        if not name or not value:
            continue
        if not _is_allowed_header(name):
            continue
        headers = merge_headers_case_insensitive(headers, {name: value})

    return headers


def load_request_headers_from_file(path_str: str) -> dict[str, str]:
    """Read and parse request headers from a backend-local text file."""
    path = Path(path_str).expanduser()
    if not path.is_absolute():
        # Keep relative paths scoped to backend cwd.
        path = (Path.cwd() / path).resolve()

    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Header file not found: {path}")

    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise ValueError(f"Header file is empty: {path}")

    headers = parse_headers_text(text)
    if not headers:
        raise ValueError(
            "No usable request headers found in file. "
            "Expected lines like 'Authorization: Bearer ...'."
        )
    if "Authorization" not in headers and "authorization" not in headers:
        raise ValueError(
            "Authorization header is required in header file for request-header auth."
        )

    return headers
