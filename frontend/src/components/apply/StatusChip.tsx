"use client";

import { Badge } from "@/components/ui/badge";

interface StatusChipProps {
    status: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
    pending: { label: "Pending", variant: "outline" },
    generating_docs: { label: "Generating Docs", variant: "secondary" },
    applying: { label: "Applying...", variant: "secondary", className: "animate-pulse" },
    applied: { label: "Applied", variant: "default", className: "bg-green-500" },
    failed: { label: "Failed", variant: "destructive" },
    dry_run: { label: "Dry Run", variant: "outline", className: "border-yellow-500 text-yellow-600" },
};

export function StatusChip({ status }: StatusChipProps) {
    const config = STATUS_CONFIG[status] || { label: status, variant: "outline" as const };

    return (
        <Badge variant={config.variant} className={config.className}>
            {config.label}
        </Badge>
    );
}
