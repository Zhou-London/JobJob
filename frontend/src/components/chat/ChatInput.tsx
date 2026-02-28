"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCallback, useRef, useState } from "react";

interface ChatInputProps {
    onSend: (message: string) => void;
    isLoading: boolean;
    placeholder?: string;
}

export function ChatInput({
    onSend,
    isLoading,
    placeholder = "Tell me about your career journey...",
}: ChatInputProps) {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = useCallback(() => {
        if (!value.trim() || isLoading) return;
        onSend(value.trim());
        setValue("");
        textareaRef.current?.focus();
    }, [value, isLoading, onSend]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    return (
        <div className="border-t bg-background p-4">
            <div className="max-w-2xl mx-auto flex gap-2">
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={isLoading}
                    rows={2}
                    className="resize-none min-h-[60px]"
                />
                <Button
                    onClick={handleSend}
                    disabled={!value.trim() || isLoading}
                    size="lg"
                    className="self-end"
                >
                    {isLoading ? "..." : "Send"}
                </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
                Press Enter to send, Shift+Enter for a new line
            </p>
        </div>
    );
}
