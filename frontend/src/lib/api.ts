/**
 * API client utilities for the JobJob backend.
 * Requests use relative paths so they go through Next.js rewrites
 * (see next.config.ts) which proxies /api/* → localhost:8000.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ---------- Generic helpers ----------

export async function apiFetch<T = unknown>(
    path: string,
    options?: RequestInit
): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json", ...options?.headers },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
}

// ---------- Chat / Story Coach ----------

export interface ChatEvent {
    type: "text" | "tool_call" | "tool_result" | "done" | "error" | "session";
    content?: string;
    name?: string;
    input?: Record<string, unknown>;
    result?: string;
    session_id?: string;
}

/**
 * Send a chat message and consume the SSE stream.
 * Calls `onEvent` for each parsed event.
 */
export async function sendChatMessage(
    message: string,
    sessionId: string | null,
    mode: string | null,
    onEvent: (event: ChatEvent) => void
): Promise<void> {
    const res = await fetch(`${API_BASE}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message,
            session_id: sessionId,
            mode,
        }),
    });

    if (!res.ok || !res.body) {
        throw new Error(`Chat API error: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
            if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
                const data = line.slice(6);
                try {
                    const parsed = JSON.parse(data);
                    onEvent({ ...parsed, type: currentEvent || parsed.type });
                } catch {
                    // Ignore invalid JSON lines
                }
            }
        }
    }
}

/**
 * Send a chat message and wait for the full response (non-streaming).
 */
export async function sendChatMessageSync(
    message: string,
    sessionId: string | null,
    mode?: string
): Promise<{ session_id: string; message: string }> {
    return apiFetch("/api/chat/message/sync", {
        method: "POST",
        body: JSON.stringify({ message, session_id: sessionId, mode }),
    });
}

/**
 * Upload a CV file.
 */
export async function uploadCV(
    file: File,
    sessionId: string | null
): Promise<{ session_id: string; file_path: string; message: string }> {
    const formData = new FormData();
    formData.append("file", file);
    if (sessionId) formData.append("session_id", sessionId);

    const res = await fetch(`${API_BASE}/api/chat/upload`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
}

/**
 * Get chat history for a session.
 */
export async function getChatHistory(
    sessionId: string
): Promise<{
    session_id: string;
    messages: { role: string; content: string }[];
}> {
    return apiFetch(`/api/chat/history?session_id=${sessionId}`);
}

// ---------- Jobs ----------

export interface JobListing {
    job_id: number;
    employer_name: string;
    job_title: string;
    location_name: string;
    description: string;
    salary_min: number | null;
    salary_max: number | null;
    currency: string | null;
    external_url: string | null;
    job_url: string | null;
    contract_type: string | null;
}

export async function searchJobs(params: {
    q: string;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    job_type?: string;
    limit?: number;
}): Promise<{ results: JobListing[]; count: number }> {
    const searchParams = new URLSearchParams();
    searchParams.set("q", params.q);
    if (params.location) searchParams.set("location", params.location);
    if (params.salary_min) searchParams.set("salary_min", String(params.salary_min));
    if (params.salary_max) searchParams.set("salary_max", String(params.salary_max));
    if (params.job_type) searchParams.set("job_type", params.job_type);
    if (params.limit) searchParams.set("limit", String(params.limit));

    return apiFetch(`/api/jobs/search?${searchParams}`);
}

export async function getJobDetails(jobId: number): Promise<JobListing> {
    return apiFetch(`/api/jobs/${jobId}`);
}

export async function matchJobs(
    sessionId: string,
    keywords?: string,
    location?: string
): Promise<{ session_id: string; analysis: string }> {
    return apiFetch("/api/jobs/match", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, keywords, location }),
    });
}

// ---------- Documents ----------

export async function generateDocuments(
    sessionId: string,
    jobId: number
): Promise<{ session_id: string; message: string }> {
    return apiFetch("/api/documents/generate", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, job_id: jobId }),
    });
}

export async function listDocuments(): Promise<{
    documents: {
        filename: string;
        size_bytes: number;
        type: string;
        download_url: string;
    }[];
}> {
    return apiFetch("/api/documents/list");
}

export function getDocumentDownloadUrl(filename: string): string {
    return `${API_BASE}/api/documents/${filename}/download`;
}

// ---------- Applications ----------

export async function triggerApply(params: {
    session_id: string;
    job_id: number;
    job_title?: string;
    employer_name?: string;
    dry_run?: boolean;
}): Promise<{ application_id: string; status: string; message: string }> {
    return apiFetch("/api/applications/apply", {
        method: "POST",
        body: JSON.stringify(params),
    });
}

export async function listApplications(): Promise<{
    applications: {
        id: string;
        job_id: number;
        job_title: string;
        employer_name: string;
        status: string;
        created_at: string;
        dry_run: boolean;
    }[];
    count: number;
}> {
    return apiFetch("/api/applications/");
}

// ---------- Profile ----------

export async function getProfile(
    sessionId: string
): Promise<{ session_id: string; profile: Record<string, unknown>; is_complete: boolean }> {
    return apiFetch(`/api/profile/?session_id=${sessionId}`);
}
