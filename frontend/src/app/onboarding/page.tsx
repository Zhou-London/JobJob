"use client";

import { ChatInput } from "@/components/chat/ChatInput";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { CVUploadZone } from "@/components/chat/CVUploadZone";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useChat } from "@/lib/hooks/useChat";
import { uploadCV } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export default function OnboardingPage() {
    const router = useRouter();
    const { messages, isLoading, sessionId, sendMessage } = useChat("story_coach");
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = useCallback(
        async (file: File) => {
            setIsUploading(true);
            try {
                await uploadCV(file, sessionId);
            } catch (err) {
                console.error("Upload failed:", err);
            } finally {
                setIsUploading(false);
            }
        },
        [sessionId]
    );

    const handleFinish = useCallback(() => {
        if (sessionId) {
            router.push(`/jobs?session=${sessionId}`);
        } else {
            router.push("/jobs");
        }
    }, [router, sessionId]);

    return (
        <div className="h-[calc(100vh-3.5rem)] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                <div>
                    <h1 className="font-semibold">Career Story Coach</h1>
                    <p className="text-xs text-muted-foreground">
                        Tell me your story and I&apos;ll help build your profile
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <CVUploadZone onUpload={handleUpload} isUploading={isUploading} />
                    {messages.length > 2 && (
                        <Button onClick={handleFinish} variant="default" size="sm">
                            Finish &amp; Find Jobs →
                        </Button>
                    )}
                </div>
            </div>

            {/* Chat area */}
            <ChatWindow messages={messages} isLoading={isLoading} />

            {/* Input */}
            <ChatInput
                onSend={sendMessage}
                isLoading={isLoading}
                placeholder="Tell me about your career journey..."
            />
        </div>
    );
}
