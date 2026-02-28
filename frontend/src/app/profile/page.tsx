"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/api";
import { useCallback, useState } from "react";

export default function ProfilePage() {
    const [sessionId, setSessionId] = useState("");
    const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLoadProfile = useCallback(async () => {
        if (!sessionId.trim()) return;
        setIsLoading(true);
        try {
            const result = await getProfile(sessionId);
            setProfile(result.profile);
            setIsComplete(result.is_complete);
        } catch (err) {
            console.error("Failed to load profile:", err);
            setProfile(null);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    const renderValue = (value: unknown): string => {
        if (value === null || value === undefined || value === "") return "—";
        if (Array.isArray(value)) {
            if (value.length === 0) return "—";
            if (typeof value[0] === "object") return JSON.stringify(value, null, 2);
            return value.join(", ");
        }
        if (typeof value === "object") return JSON.stringify(value, null, 2);
        return String(value);
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Your Profile</h1>
                <p className="text-muted-foreground">
                    View the career profile built during onboarding
                </p>
            </div>

            <div className="mb-6 flex gap-3">
                <Input
                    placeholder="Enter your session ID"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="max-w-md"
                />
                <Button onClick={handleLoadProfile} disabled={!sessionId.trim() || isLoading}>
                    {isLoading ? "Loading..." : "Load Profile"}
                </Button>
            </div>

            {profile ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm text-muted-foreground">Profile status:</span>
                        <Badge variant={isComplete ? "default" : "outline"}>
                            {isComplete ? "✅ Complete" : "⚠️ Incomplete"}
                        </Badge>
                    </div>

                    {Object.entries(profile).map(([key, value]) => {
                        // Skip internal fields
                        if (key === "raw_story") return null;

                        const label = key
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase());

                        return (
                            <Card key={key}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">{label}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                                        {renderValue(value)}
                                    </pre>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <div className="text-3xl mb-3">👤</div>
                    <p>Complete the onboarding chat to build your profile.</p>
                    <p className="text-xs mt-2">
                        Your session ID will be shown during the chat.
                    </p>
                </div>
            )}
        </div>
    );
}
