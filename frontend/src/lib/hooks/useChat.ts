"use client";

import { useCallback, useRef, useState } from "react";
import { ChatEvent, sendChatMessage } from "../api";

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
}

export function useChat(initialMode: string = "story_coach") {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [mode, setMode] = useState(initialMode);
    const idCounter = useRef(0);

    const nextId = () => {
        idCounter.current += 1;
        return `msg-${idCounter.current}`;
    };

    const sendMessage = useCallback(
        async (text: string) => {
            if (!text.trim() || isLoading) return;

            // Add user message
            const userMsg: Message = {
                id: nextId(),
                role: "user",
                content: text,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMsg]);
            setIsLoading(true);

            // Prepare assistant message placeholder
            const assistantId = nextId();
            setMessages((prev) => [
                ...prev,
                {
                    id: assistantId,
                    role: "assistant",
                    content: "",
                    timestamp: new Date(),
                },
            ]);

            try {
                await sendChatMessage(text, sessionId, mode, (event: ChatEvent) => {
                    if (event.type === "text" || event.type === "done") {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? { ...m, content: event.content || "" }
                                    : m
                            )
                        );
                    } else if (event.type === "session") {
                        const data = event as unknown as { session_id?: string };
                        if (data.session_id) {
                            setSessionId(data.session_id);
                        }
                    } else if (event.type === "error") {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? {
                                        ...m,
                                        content: `Error: ${event.content || "Unknown error"}`,
                                        role: "system" as const,
                                    }
                                    : m
                            )
                        );
                    }
                });
            } catch (err) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? {
                                ...m,
                                content: `Connection error: ${err instanceof Error ? err.message : "Unknown"}`,
                                role: "system" as const,
                            }
                            : m
                    )
                );
            } finally {
                setIsLoading(false);
            }
        },
        [isLoading, sessionId, mode]
    );

    const clearMessages = useCallback(() => {
        setMessages([]);
        setSessionId(null);
    }, []);

    return {
        messages,
        isLoading,
        sessionId,
        mode,
        setMode,
        sendMessage,
        clearMessages,
    };
}
