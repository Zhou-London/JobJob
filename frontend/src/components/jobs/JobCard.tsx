"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { JobListing } from "@/lib/api";
import Link from "next/link";

interface JobCardProps {
    job: JobListing;
    matchScore?: number;
}

function formatSalary(min: number | null, max: number | null, currency: string | null): string {
    const c = currency || "GBP";
    const fmt = (n: number) =>
        new Intl.NumberFormat("en-GB", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    if (min) return `From ${fmt(min)}`;
    if (max) return `Up to ${fmt(max)}`;
    return "Salary not specified";
}

export function JobCard({ job, matchScore }: JobCardProps) {
    // Strip HTML tags from description for preview
    const plainDesc = job.description.replace(/<[^>]*>/g, "").slice(0, 200);

    return (
        <Link href={`/jobs/${job.job_id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-base leading-snug truncate">
                                {job.job_title}
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {job.employer_name}
                            </CardDescription>
                        </div>
                        {matchScore !== undefined && (
                            <Badge
                                variant={
                                    matchScore >= 80
                                        ? "default"
                                        : matchScore >= 60
                                            ? "secondary"
                                            : "outline"
                                }
                                className={
                                    matchScore >= 80
                                        ? "bg-green-500"
                                        : matchScore >= 60
                                            ? "bg-yellow-500"
                                            : ""
                                }
                            >
                                {matchScore}%
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2 mb-2 text-xs text-muted-foreground">
                        <span>📍 {job.location_name}</span>
                        <span>💰 {formatSalary(job.salary_min, job.salary_max, job.currency)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {plainDesc}...
                    </p>
                </CardContent>
            </Card>
        </Link>
    );
}
