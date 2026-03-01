"use client";

import { useState, useRef, useEffect } from "react";
import InfoPanel, { type UserProfile } from "@/components/InfoPanel";
import JobsPanel, { type JobData } from "@/components/JobsPanel";
import { Send, Paperclip, Mic, User as UserIcon, Bot, Loader2, FileText, Sparkles, Command, Download } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h4>,
  pre: ({ children }) => (
    <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto mb-2 text-sm">{children}</pre>
  ),
  code: ({ children }) => (
    <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-[13px]">{children}</code>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-3 border-gray-300 pl-3 italic text-gray-600 mb-2">{children}</blockquote>
  ),
};

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  isToolCall?: boolean;
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<UserProfile | undefined>();
  const [jobs, setJobs] = useState<JobData[]>([]);

  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    // Focus input on load
    inputRef.current?.focus();
  }, []);

  const fetchProfile = async (sid: string) => {
    try {
      const res = await fetch(`/api/profile?session_id=${sid}`);
      if (res.ok) {
        const data = await res.json();
        // Since we don't know the exact python model yet, we adapt gracefully
        const p = data.profile || {};
        const safeProfile: UserProfile = {
          name: p.name || undefined,
          jobPosition: p.target_role || p.jobPosition || (p.job_titles ? p.job_titles[0] : undefined),
          summaryBullets: p.summary_bullets || [],
        };
        setProfile(safeProfile);
      }
    } catch (e) {
      console.error("Profile fetch error", e);
    }
  };

  const handleSend = async (overrideText?: string, mode?: string) => {
    const textToSend = overrideText || inputValue.trim();
    if (!textToSend) return;

    // Add user message to UI immediately
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          session_id: sessionId || undefined,
          mode: mode || undefined,
        }),
      });

      if (!response.body) throw new Error("No body in response");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      // Track the "active" agent text message — created lazily on first text event
      let currentAgentMsg = "";
      let activeAgentMsgId: string | null = null;
      // Queue of tool-call message IDs so tool_result can update them in-place
      const pendingToolIds: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith("event: ")) {
            const eventType = line.substring(7).trim();
            const dataLine = lines[i + 1];

            if (dataLine && dataLine.startsWith("data: ")) {
              const dataStr = dataLine.substring(6).trim();
              i++; // skip next line since we read it

              if (eventType === "text") {
                try {
                  const parsed = JSON.parse(dataStr);
                  const textContent = parsed.content ?? "";
                  if (textContent) {
                    if (!activeAgentMsgId) {
                      activeAgentMsgId = crypto.randomUUID();
                      currentAgentMsg = "";
                    }
                    currentAgentMsg += textContent;
                    // Capture values so the updater doesn't read stale mutable vars
                    const id = activeAgentMsgId;
                    const content = currentAgentMsg;
                    setMessages((prev) => {
                      const exists = prev.some(m => m.id === id);
                      if (exists) {
                        return prev.map(m => m.id === id ? { ...m, content } : m);
                      }
                      return [...prev, { id, role: "agent" as const, content }];
                    });
                  }
                } catch (e) {
                  console.error("Error parsing text event", e, dataStr);
                }
              } else if (eventType === "tool_call") {
                // Close any open text message so subsequent text starts a new bubble
                activeAgentMsgId = null;
                try {
                  const data = JSON.parse(dataStr);
                  const toolMsgId = crypto.randomUUID();
                  pendingToolIds.push(toolMsgId);
                  setMessages((prev) => [...prev, {
                    id: toolMsgId,
                    role: "agent" as const,
                    content: `Executing: ${data.name}...`,
                    isToolCall: true
                  }]);
                } catch (e) { }
              } else if (eventType === "tool_result") {
                try {
                  const data = JSON.parse(dataStr);
                  let completedMsg = `${data.name} completed.`;

                  // Update left sidebar from profile tool results
                  if (data.name === "update_profile_summary" && data.result) {
                    try {
                      const resultObj = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
                      if (resultObj.status === "ok") {
                        setProfile((prev) => ({
                          ...prev,
                          name: resultObj.name || prev?.name,
                          jobPosition: resultObj.job_position || prev?.jobPosition,
                          summaryBullets: resultObj.summary_bullets || prev?.summaryBullets || [],
                        }));
                        completedMsg = "Profile updated.";
                      }
                    } catch (e) { }
                  }

                  // Update right sidebar from job search results
                  if (data.name === "search_jobs" && data.result) {
                    try {
                      const resultObj = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
                      if (Array.isArray(resultObj) && resultObj.length > 0 && resultObj[0].jobId) {
                        setJobs(resultObj);
                        completedMsg = `Found ${resultObj.length} matched jobs.`;
                      } else if (resultObj.results && Array.isArray(resultObj.results)) {
                        setJobs(resultObj.results);
                        completedMsg = `Found ${resultObj.results.length} matched jobs.`;
                      }
                    } catch (e) { }
                  }

                  // Handle CV LaTeX generation result — show download link
                  if (data.name === "generate_cv_latex" && data.result) {
                    try {
                      const resultObj = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
                      if (resultObj.download_url) {
                        completedMsg = `CV generated successfully.`;
                        // Add a special download message
                        const downloadMsg: Message = {
                          id: Date.now() + Math.random().toString(),
                          role: "agent",
                          content: `📄 Your tailored CV is ready! [Download PDF](${resultObj.download_url})`,
                        };
                        setMessages((prev) => [...prev, downloadMsg]);
                      } else if (resultObj.error) {
                        completedMsg = `CV generation failed: ${resultObj.error}`;
                      }
                    } catch (e) { }
                  }

                  // Handle cover letter generation result — show download link
                  if (data.name === "generate_cover_letter" && data.result) {
                    try {
                      const resultObj = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
                      if (resultObj.pdf_path) {
                        const filename = resultObj.pdf_path.split('/').pop();
                        const downloadUrl = `/api/documents/${filename}/download`;
                        const downloadMsg: Message = {
                          id: Date.now() + Math.random().toString(),
                          role: "agent",
                          content: `📄 Your cover letter is ready! [Download PDF](${downloadUrl})`,
                        };
                        setMessages((prev) => [...prev, downloadMsg]);
                      }
                    } catch (e) { }
                  }

                  // Update the matching tool_call message in-place
                  const toolMsgId = pendingToolIds.shift();
                  if (toolMsgId) {
                    const msg = completedMsg;
                    setMessages((prev) => prev.map(m =>
                      m.id === toolMsgId ? { ...m, content: msg } : m
                    ));
                  }
                } catch (e) { }
              } else if (eventType === "done") {
                // "done" carries the full concatenated text — already streamed via
                // individual "text" events, so we only use it as a fallback.
                if (!activeAgentMsgId) {
                  try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.content) {
                      const fallbackId = crypto.randomUUID();
                      setMessages((prev) => [
                        ...prev,
                        { id: fallbackId, role: "agent", content: parsed.content }
                      ]);
                    }
                  } catch (e) { }
                }
              } else if (eventType === "session") {
                try {
                  const data = JSON.parse(dataStr);
                  if (data.session_id) {
                    setSessionId(data.session_id);
                    fetchProfile(data.session_id);
                  }
                } catch (e) { }
              } else if (eventType === "error") {
                try {
                  const data = JSON.parse(dataStr);
                  setMessages((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), role: "agent", content: `Error: ${data.content || data.detail || "Unknown error"}`, isToolCall: true }
                  ]);
                } catch (e) { }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleUploadCV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    // Create form data
    const formData = new FormData();
    formData.append("file", file);
    if (sessionId) {
      formData.append("session_id", sessionId);
    }

    // Add optimistic user message for file
    const uploadMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: `Uploaded: ${file.name}`
    };
    setMessages((prev) => [...prev, uploadMsg]);
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.session_id) {
          setSessionId(data.session_id);
          fetchProfile(data.session_id);
        }

        // The backend `chat.py` responds with a synchronous message text explaining it was parsed
        if (data.message) {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "agent", content: data.message }
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "agent", content: "Failed to upload CV.", isToolCall: true }
        ]);
      }
    } catch (error) {
      console.error("Upload error", error);
    } finally {
      setIsUploading(false);
      setIsTyping(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleGenerateCoverLetter = (job: JobData) => {
    const prompt = `Please generate a tailored cover letter for the job: ${job.jobTitle} at ${job.employerName}. Job Id: ${job.jobId}`;
    handleSend(prompt, "cv_writer");
  };

  const handleGenerateCV = (job: JobData) => {
    const prompt = `Please generate a tailored CV (using the LaTeX template via generate_cv_latex) for the job: ${job.jobTitle} at ${job.employerName}. Job Id: ${job.jobId}`;
    handleSend(prompt, "cv_writer");
  };

  /** Render message text, converting markdown-style [text](url) into clickable links. */
  const renderMessageContent = (content: string) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      const [, text, url] = match;
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors no-underline border border-blue-200"
        >
          <Download className="w-3.5 h-3.5" />
          {text}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    return parts.length > 0 ? parts : content;
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-white text-gray-900 font-sans">
      {/* Left Column: User Profile — slides in when profile data arrives */}
      {profile && (
        <div className="w-80 flex-shrink-0 border-r border-gray-200 slide-in-left">
          <InfoPanel profile={profile} />
        </div>
      )}

      {/* Middle Column: Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative shadow-[0_0_15px_rgba(0,0,0,0.02)] z-10">
        {/* Header */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100 bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-md">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">JobJob Assistant</h2>
              <p className="text-xs text-gray-500">Always ready to help</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto w-full p-4 custom-scrollbar flex flex-col gap-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
                <Bot className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Welcome to JobJob</h2>
              <p className="text-gray-500 mb-8 max-w-md mx-auto line-clamp-3 leading-relaxed">
                I can help you build your profile, extract info from your CV, run job searches, and draft tailored cover letters. Look around!
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => handleSend("Hi, what can you do?")}
                  className="bg-gray-50 border border-gray-200 hover:border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm transition-colors"
                >
                  &quot;Hi, what can you do?&quot;
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-50 border border-blue-200 hover:border-blue-300 text-blue-700 px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Upload CV
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.filter(m => m.role !== "agent" || m.content).map((m) => (
                <div
                  key={m.id}
                  className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "agent" && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                      <Bot className="w-4 h-4 text-blue-700" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm text-[15px] leading-relaxed relative
                      ${m.role === "user"
                        ? "bg-black text-white rounded-br-sm"
                        : m.isToolCall
                          ? "bg-gray-50 border border-gray-200 text-gray-500 rounded-bl-sm font-mono text-xs w-full sm:max-w-full italic flex items-center gap-3"
                          : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm"}
                    `}
                    style={m.role === "user" ? { whiteSpace: "pre-wrap" } : undefined}
                  >
                    {m.isToolCall && <Command className="w-3.5 h-3.5 shrink-0" />}

                    {/* Render agent text with Markdown, everything else as plain text */}
                    {m.role === "agent" && !m.isToolCall ? (
                      <div className="markdown-content">
                        <ReactMarkdown components={markdownComponents}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}

                    {/* Tool message indicator strip */}
                    {m.isToolCall && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 rounded-l-2xl" />
                    )}
                  </div>

                  {m.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center ml-3 mt-1 flex-shrink-0">
                      <UserIcon className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex w-full justify-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center mr-3 flex-shrink-0">
                    <Bot className="w-4 h-4 text-blue-700" />
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm flex items-center gap-1.5 h-[48px]">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="max-w-4xl mx-auto relative bg-gray-50 border border-gray-200 rounded-3xl p-2 flex items-end shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 focus-within:bg-white transition-all">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-3 text-gray-400 hover:text-black hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50 shrink-0"
              title="Upload CV (PDF/DOCX)"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
            </button>
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept=".pdf,.doc,.docx"
              onChange={handleUploadCV}
            />

            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask for job search, resume building, or cover letters..."
              className="flex-1 bg-transparent px-3 py-3 max-h-32 min-h-[44px] text-[15px] focus:outline-none resize-none placeholder:text-gray-400"
              rows={1}
            />

            <div className="flex gap-1.5 shrink-0 px-1 py-1">
              <button
                className="p-2.5 text-gray-400 hover:text-black hover:bg-gray-200 rounded-xl transition-all"
                title="Voice input (Not implemented natively here yet)"
              >
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isTyping}
                className="p-2.5 bg-black text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 rounded-xl transition-all shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="text-center mt-2.5">
            <p className="text-[11px] text-gray-400 font-medium tracking-wide flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              JobJob Assistant can make mistakes. Please verify important info.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Matched Jobs — slides in when jobs data arrives */}
      {jobs.length > 0 && (
        <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-gray-50/10 slide-in-right">
          <JobsPanel jobs={jobs} onGenerateCoverLetter={handleGenerateCoverLetter} onGenerateCV={handleGenerateCV} />
        </div>
      )}
    </div>
  );
}
