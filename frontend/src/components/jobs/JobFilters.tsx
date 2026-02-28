"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useState } from "react";

interface JobFiltersProps {
    onSearch: (params: {
        q: string;
        location?: string;
        job_type?: string;
    }) => void;
    isLoading: boolean;
}

export function JobFilters({ onSearch, isLoading }: JobFiltersProps) {
    const [keywords, setKeywords] = useState("");
    const [location, setLocation] = useState("");

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (!keywords.trim()) return;
            onSearch({
                q: keywords.trim(),
                location: location.trim() || undefined,
            });
        },
        [keywords, location, onSearch]
    );

    return (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <Input
                placeholder="Job title, skills, or keywords..."
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="flex-1"
            />
            <Input
                placeholder="Location (e.g. London)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="sm:w-48"
            />
            <Button type="submit" disabled={!keywords.trim() || isLoading}>
                {isLoading ? "Searching..." : "Search"}
            </Button>
        </form>
    );
}
