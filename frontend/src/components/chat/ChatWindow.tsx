"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import type { Message } from "@/lib/hooks/useChat";

interface ChatWindowProps {
    messages: Message[];
    isLoading: boolean;
}

export function ChatWindow({ messages, isLoading }: ChatWindowProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <ScrollArea className="flex-1 p-4">
            <div className="max-w-2xl mx-auto space-y-4">
                {messages.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <div className="text-4xl mb-4">👋</div>
                        <h3 className="text-lg font-medium mb-2">Welcome to JobJob!</h3>
                        <p className="text-sm">
                            Tell me about your career journey — your background, skills,
                            achievements, and what you&apos;re looking for next. I&apos;ll
                            help you find and apply to the perfect roles.
                        </p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex",
                            msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                msg.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : msg.role === "system"
                                        ? "bg-destructive/10 text-destructive rounded-bl-md"
                                        : "bg-muted rounded-bl-md"
                            )}
                        >
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                    </div>
                ))}

                {isLoading && messages[messages.length - 1]?.content === "" && (
                    <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                            <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    );
}
