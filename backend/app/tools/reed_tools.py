"""Reed API client — custom tools for job search and details.

These functions are used directly by the agent orchestrator as tool
implementations. They wrap the Reed REST API (https://www.reed.co.uk/api/1.0/).
"""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from pathlib import Path
from urllib.parse import urljoin, urlparse
from typing import Any, Optional

import httpx

from app.config import settings
from app.models.job import JobListing


class ReedClient:
    """Async client for the Reed job search API."""

    def __init__(self) -> None:
        self.base_url = settings.reed_api_base
        self.web_base_url = settings.reed_base_url.rstrip("/")
        self.api_key = settings.reed_api_key
        self._web_client: httpx.AsyncClient | None = None

    def _auth(self) -> httpx.BasicAuth:
        """Reed uses HTTP Basic with the API key as username, empty password."""
        return httpx.BasicAuth(username=self.api_key, password="")

    async def _get_web_client(self) -> httpx.AsyncClient:
        """Return a persistent web client so login cookies are reused."""
        if self._web_client is None:
            self._web_client = httpx.AsyncClient(
                base_url=self.web_base_url,
                follow_redirects=True,
                timeout=30.0,
                headers={"User-Agent": "JobJob/0.1 (+https://github.com)"},
            )
        return self._web_client

    @staticmethod
    def _parse_cookie_header(cookie_header: str) -> dict[str, str]:
        """Parse a Cookie header string into key/value pairs."""
        cookies: dict[str, str] = {}
        for part in cookie_header.split(";"):
            chunk = part.strip()
            if not chunk or "=" not in chunk:
                continue
            name, value = chunk.split("=", 1)
            name = name.strip()
            value = value.strip()
            if name:
                cookies[name] = value
        return cookies

    async def apply_configured_cookies(self) -> dict[str, Any]:
        """Load REED_COOKIE_HEADER cookies into the web client."""
        cookie_header = settings.reed_cookie_header.strip()
        if not cookie_header:
            return {"ok": False, "message": "REED_COOKIE_HEADER is empty.", "added": 0}

        cookies = self._parse_cookie_header(cookie_header)
        if not cookies:
            return {
                "ok": False,
                "message": "REED_COOKIE_HEADER could not be parsed.",
                "added": 0,
            }

        client = await self._get_web_client()
        for name, value in cookies.items():
            client.cookies.set(
                name,
                value,
                domain=".reed.co.uk",
                path="/",
            )
        return {"ok": True, "message": "Configured cookies applied.", "added": len(cookies)}

    @staticmethod
    def _extract_hidden_inputs(html: str) -> dict[str, str]:
        """Extract hidden form input fields from HTML."""
        hidden_inputs: dict[str, str] = {}
        pattern = re.compile(
            r'<input[^>]+type=["\']hidden["\'][^>]*>',
            re.IGNORECASE,
        )
        name_pattern = re.compile(r'name=["\']([^"\']+)["\']', re.IGNORECASE)
        value_pattern = re.compile(r'value=["\']([^"\']*)["\']', re.IGNORECASE)

        for match in pattern.finditer(html):
            tag = match.group(0)
            name_match = name_pattern.search(tag)
            if not name_match:
                continue
            value_match = value_pattern.search(tag)
            hidden_inputs[name_match.group(1)] = (
                value_match.group(1) if value_match else ""
            )
        return hidden_inputs

    @staticmethod
    def _extract_apply_form(html: str) -> tuple[str | None, dict[str, str]]:
        """Extract first apply form action URL and hidden inputs from page HTML."""
        form_match = re.search(
            r"<form[^>]+action=[\"']([^\"']+)[\"'][^>]*>(.*?)</form>",
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not form_match:
            return None, {}
        action = form_match.group(1)
        form_html = form_match.group(2)
        return action, ReedClient._extract_hidden_inputs(form_html)

    @staticmethod
    def _is_reed_url(url: str | None) -> bool:
        if not url:
            return False
        parsed = urlparse(url)
        return "reed.co.uk" in parsed.netloc

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
        easy_apply: Optional[bool] = None,
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
        if easy_apply is not None:
            params["easyApply"] = str(easy_apply).lower()

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

    async def login(self, username: str, password: str) -> dict[str, Any]:
        """Log into Reed with Selenium and persist session cookies to httpx."""
        if not username or not password:
            raise ValueError("Reed username and password are required.")

        result = await asyncio.to_thread(self._login_with_selenium, username, password)

        raw_cookies = result.pop("_cookies", [])
        if raw_cookies:
            client = await self._get_web_client()
            for cookie in raw_cookies:
                name = cookie.get("name")
                value = cookie.get("value")
                if not name or value is None:
                    continue
                client.cookies.set(
                    name,
                    value,
                    domain=cookie.get("domain"),
                    path=cookie.get("path", "/"),
                )
            result["cookie_count"] = len(client.cookies)
        else:
            result["cookie_count"] = 0

        return result

    def _login_with_selenium(self, username: str, password: str) -> dict[str, Any]:
        """Run browser-based Reed login and return cookies/metadata."""
        try:
            from selenium import webdriver
            from selenium.common.exceptions import TimeoutException
            from selenium.webdriver.common.by import By
            from selenium.webdriver.common.keys import Keys
            from selenium.webdriver.support import expected_conditions as EC
            from selenium.webdriver.support.ui import WebDriverWait
        except Exception as e:
            return {
                "ok": False,
                "message": "Selenium is not available in the backend environment.",
                "error": str(e),
            }

        def _save_screenshot(driver: Any, label: str) -> str | None:
            """Save a login screenshot for diagnostics."""
            try:
                settings.output_dir.mkdir(parents=True, exist_ok=True)
                path = Path(settings.output_dir) / f"reed_login_{label}_{uuid.uuid4().hex[:8]}.png"
                driver.save_screenshot(str(path))
                return str(path)
            except Exception:
                return None

        def _extract_auth_error(driver: Any) -> str | None:
            """Extract any visible auth/login error from the current page."""
            selectors = [
                "[role='alert']",
                ".error",
                ".error-message",
                ".alert-danger",
                "[data-testid*='error']",
                "[id*='error' i]",
                "[class*='error' i]",
                ".auth0-global-message",
                ".auth0-lock-error-msg",
            ]
            for selector in selectors:
                for el in driver.find_elements(By.CSS_SELECTOR, selector):
                    try:
                        if el.is_displayed():
                            text = (el.text or "").strip()
                            if text:
                                return text
                    except Exception:
                        continue

            body = (driver.page_source or "").lower()
            for marker in [
                "incorrect email address or password",
                "invalid email or password",
                "wrong email or password",
                "too many attempts",
                "verify your email",
                "captcha",
                "multi-factor",
            ]:
                if marker in body:
                    return marker
            return None

        def _find_visible(driver: Any, selectors: list[str]) -> Any | None:
            for selector in selectors:
                for el in driver.find_elements(By.CSS_SELECTOR, selector):
                    try:
                        if el.is_displayed() and el.is_enabled():
                            return el
                    except Exception:
                        continue
            return None

        def _attempt(headless: bool) -> dict[str, Any]:
            driver = None
            options = webdriver.ChromeOptions()
            if headless:
                options.add_argument("--headless=new")
            options.add_argument("--window-size=1440,900")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument(
                "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )

            try:
                driver = webdriver.Chrome(options=options)
                wait = WebDriverWait(driver, 30)

                login_url = f"{self.web_base_url}/account/signin"
                driver.get(login_url)

                if "请稍候" in (driver.title or "") or "just a moment" in (
                    driver.title or ""
                ).lower():
                    screenshot_path = _save_screenshot(driver, "challenge")
                    return {
                        "ok": False,
                        "message": "Reed anti-bot challenge page was shown.",
                        "url": driver.current_url,
                        "title": driver.title,
                        "auth_error": _extract_auth_error(driver),
                        "screenshot_path": screenshot_path,
                        "_cookies": driver.get_cookies() or [],
                    }

                wait.until(
                    lambda d: len(
                        d.find_elements(
                            By.CSS_SELECTOR,
                            "#signin_email, input[type='email'], input[name='email']",
                        )
                    )
                    > 0
                )

                email_input = _find_visible(
                    driver,
                    [
                        "#signin_email",
                        "input[name='signin_email']",
                        "input[type='email']",
                        "input[name='email']",
                        "input[id*='email' i]",
                    ],
                )
                password_input = _find_visible(
                    driver,
                    [
                        "#signin_password",
                        "input[name='signin_password']",
                        "input[type='password']",
                        "input[name='password']",
                        "input[id*='password' i]",
                    ],
                )
                if email_input is None or password_input is None:
                    screenshot_path = _save_screenshot(driver, "missing_fields")
                    return {
                        "ok": False,
                        "message": "Could not find visible email/password fields on Reed login page.",
                        "url": driver.current_url,
                        "title": driver.title,
                        "auth_error": _extract_auth_error(driver),
                        "screenshot_path": screenshot_path,
                        "_cookies": driver.get_cookies() or [],
                    }

                try:
                    email_input.clear()
                    email_input.send_keys(username)
                except Exception:
                    driver.execute_script(
                        "arguments[0].value = arguments[1];"
                        "arguments[0].dispatchEvent(new Event('input',{bubbles:true}));"
                        "arguments[0].dispatchEvent(new Event('change',{bubbles:true}));",
                        email_input,
                        username,
                    )

                try:
                    password_input.clear()
                    password_input.send_keys(password)
                except Exception:
                    driver.execute_script(
                        "arguments[0].value = arguments[1];"
                        "arguments[0].dispatchEvent(new Event('input',{bubbles:true}));"
                        "arguments[0].dispatchEvent(new Event('change',{bubbles:true}));",
                        password_input,
                        password,
                    )

                submit = _find_visible(
                    driver,
                    ["button[type='submit']", "input[type='submit']"],
                )
                if submit is not None:
                    try:
                        submit.click()
                    except Exception:
                        driver.execute_script("arguments[0].click();", submit)
                else:
                    password_input.send_keys(Keys.ENTER)

                try:
                    wait.until(lambda d: "signin" not in d.current_url.lower())
                except TimeoutException:
                    pass

                final_url = driver.current_url
                body = (driver.page_source or "").lower()
                auth_error = _extract_auth_error(driver)
                has_invalid_credentials = (
                    "incorrect email address or password" in body
                    or "invalid email or password" in body
                    or "wrong email or password" in body
                    or bool(auth_error)
                )
                logged_in = not has_invalid_credentials and (
                    ("signin" not in final_url.lower() and "login" not in final_url.lower())
                    or "sign out" in body
                    or "logout" in body
                    or "my account" in body
                )

                cookies = driver.get_cookies() or []
                screenshot_path = None if logged_in else _save_screenshot(driver, "failed")
                return {
                    "ok": bool(logged_in),
                    "url": final_url,
                    "title": driver.title,
                    "message": (
                        "Logged in to Reed account via Selenium."
                        if logged_in
                        else "Browser login completed, but success could not be confirmed."
                    ),
                    "auth_error": auth_error,
                    "screenshot_path": screenshot_path,
                    "_cookies": cookies,
                }
            except Exception as e:
                screenshot_path = None
                auth_error = None
                url = None
                title = None
                if driver is not None:
                    screenshot_path = _save_screenshot(driver, "exception")
                    auth_error = _extract_auth_error(driver)
                    url = driver.current_url
                    title = driver.title
                return {
                    "ok": False,
                    "message": "Selenium Reed login failed.",
                    "error": str(e),
                    "url": url,
                    "title": title,
                    "auth_error": auth_error,
                    "screenshot_path": screenshot_path,
                    "_cookies": [],
                }
            finally:
                if driver is not None:
                    try:
                        driver.quit()
                    except Exception:
                        pass

        # Reed blocks headless sessions frequently; fallback to non-headless.
        headless_result = _attempt(headless=True)
        if headless_result.get("ok"):
            return headless_result
        if "anti-bot challenge" not in str(headless_result.get("message", "")).lower():
            return headless_result

        headed_result = _attempt(headless=False)
        if headed_result.get("ok"):
            return headed_result

        # Preserve first failure details but indicate fallback was attempted.
        headed_result["message"] = (
            f"{headed_result.get('message', 'Selenium Reed login failed.')} "
            "(Headless and non-headless attempts were both tried.)"
        )
        return headed_result

    async def apply_by_job_id(
        self,
        job_id: int,
        application_fields: dict[str, str] | None = None,
        request_headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Apply to a job by Reed job ID using the logged-in web session.

        This performs a best-effort form submission:
        - fetch job details via Reed API
        - open Reed job listing page
        - locate first HTML form and submit hidden fields + provided fields
        """
        job = await self.get_job_details(job_id)

        apply_target = job.job_url or job.external_url
        if not apply_target:
            raise RuntimeError("No application URL found for this Reed job.")
        if not self._is_reed_url(apply_target):
            return {
                "ok": False,
                "job_id": job_id,
                "message": (
                    "This role uses an external application URL. "
                    "Automatic Reed account apply is not available."
                ),
                "external_url": apply_target,
            }

        client = await self._get_web_client()
        page_resp = await client.get(apply_target, headers=request_headers)
        page_resp.raise_for_status()

        form_action, hidden_inputs = self._extract_apply_form(page_resp.text)
        if not form_action:
            return {
                "ok": False,
                "job_id": job_id,
                "message": (
                    "No apply form found on the Reed job page. "
                    "The listing may require a multi-step or external flow."
                ),
                "job_url": apply_target,
            }

        submit_url = urljoin(str(page_resp.url), form_action)
        payload = dict(hidden_inputs)
        if application_fields:
            payload.update(application_fields)

        submit_resp = await client.post(
            submit_url,
            data=payload,
            headers=request_headers,
        )
        submit_resp.raise_for_status()
        body = submit_resp.text.lower()

        success_markers = (
            "thank you",
            "application submitted",
            "application received",
            "applied successfully",
        )
        applied = any(marker in body for marker in success_markers)
        if not applied:
            # Fallback heuristic when there is a redirect away from apply URL.
            applied = "apply" not in str(submit_resp.url).lower()

        return {
            "ok": applied,
            "job_id": job_id,
            "job_title": job.job_title,
            "employer_name": job.employer_name,
            "job_url": apply_target,
            "submit_url": submit_url,
            "response_url": str(submit_resp.url),
            "message": (
                "Application submission request sent."
                if applied
                else "Form submitted, but successful application could not be confirmed."
            ),
        }


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
    easy_apply_only: bool = False,
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
        easy_apply=easy_apply_only if easy_apply_only else None,
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


async def tool_reed_login(
    username: str | None = None,
    password: str | None = None,
) -> str:
    """Log in to Reed using provided or configured account credentials.

    Args:
        username: Reed account username/email. Falls back to REED_USERNAME.
        password: Reed account password. Falls back to REED_PASSWORD.

    Returns:
        JSON with login status and metadata.
    """
    resolved_username = username or settings.reed_username
    resolved_password = password or settings.reed_password

    if not resolved_username or not resolved_password:
        return json.dumps(
            {
                "ok": False,
                "error": (
                    "Missing Reed credentials. Provide username/password or set "
                    "REED_USERNAME and REED_PASSWORD."
                ),
            }
        )

    result = await reed_client.login(resolved_username, resolved_password)
    return json.dumps(result, indent=2)


async def tool_apply_reed_job(
    job_id: int,
    application_fields_json: str | None = None,
    request_headers_json: str | None = None,
) -> str:
    """Apply to a Reed listing by job ID using an authenticated web session.

    Args:
        job_id: Reed job ID to apply for.
        application_fields_json: Optional JSON object string of extra form fields.

    Returns:
        JSON with apply status and URLs used.
    """
    fields: dict[str, str] | None = None
    if application_fields_json:
        try:
            parsed = json.loads(application_fields_json)
            if not isinstance(parsed, dict):
                return json.dumps(
                    {
                        "ok": False,
                        "error": "application_fields_json must be a JSON object.",
                    }
                )
            fields = {str(k): str(v) for k, v in parsed.items()}
        except json.JSONDecodeError as e:
            return json.dumps({"ok": False, "error": f"Invalid JSON: {e}"})

    request_headers: dict[str, str] | None = None
    if request_headers_json:
        try:
            parsed_headers = json.loads(request_headers_json)
            if not isinstance(parsed_headers, dict):
                return json.dumps(
                    {
                        "ok": False,
                        "error": "request_headers_json must be a JSON object.",
                    }
                )
            request_headers = {str(k): str(v) for k, v in parsed_headers.items()}
        except json.JSONDecodeError as e:
            return json.dumps({"ok": False, "error": f"Invalid headers JSON: {e}"})

    auth_attempts: list[dict[str, Any]] = []

    # 1) Try configured cookie first (if present).
    cookie_result = await reed_client.apply_configured_cookies()
    auth_attempts.append({"method": "configured_cookie", **cookie_result})
    if cookie_result.get("ok"):
        try:
            result = await reed_client.apply_by_job_id(
                job_id=job_id,
                application_fields=fields,
                request_headers=request_headers,
            )
            result["auth_method"] = "configured_cookie"
            result["auth_attempts"] = auth_attempts
            return json.dumps(result, indent=2)
        except Exception as e:
            auth_attempts.append(
                {
                    "method": "configured_cookie_apply",
                    "ok": False,
                    "error": str(e),
                }
            )

    # 2) Fallback to Selenium login with configured credentials.
    login_result = await reed_client.login(
        settings.reed_username,
        settings.reed_password,
    )
    auth_attempts.append({"method": "selenium_login", **login_result})
    if not login_result.get("ok"):
        return json.dumps(
            {
                "ok": False,
                "error": "Failed to authenticate via configured cookie and credentials.",
                "auth_attempts": auth_attempts,
            },
            indent=2,
        )

    result = await reed_client.apply_by_job_id(
        job_id=job_id,
        application_fields=fields,
        request_headers=request_headers,
    )
    result["auth_method"] = "selenium_login"
    result["auth_attempts"] = auth_attempts
    return json.dumps(result, indent=2)
