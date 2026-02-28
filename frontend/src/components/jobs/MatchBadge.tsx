"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MatchBadgeProps {
    score: number;
    className?: string;
}

export function MatchBadge({ score, className }: MatchBadgeProps) {
    const variant =
        score >= 80
            ? "default"
            : score >= 60
                ? "secondary"
                : score >= 40
                    ? "outline"
                    : "destructive";

    const color =
        score >= 80
            ? "bg-green-500 hover:bg-green-600"
            : score >= 60
                ? "bg-yellow-500 hover:bg-yellow-600"
                : score >= 40
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "";

    return (
        <Badge
            variant={variant}
            className={cn(score >= 40 ? color : "", "text-white", className)}
        >
            {score}% match
        </Badge>
    );
}
