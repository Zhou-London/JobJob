"use client";

import { StatusChip } from "@/components/apply/StatusChip";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { listApplications } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

interface Application {
    id: string;
    job_id: number;
    job_title: string;
    employer_name: string;
    status: string;
    created_at: string;
    dry_run: boolean;
}

export default function ApplicationsPage() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchApplications = useCallback(async () => {
        try {
            const result = await listApplications();
            setApplications(result.applications);
        } catch (err) {
            console.error("Failed to fetch applications:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Applications</h1>
                <p className="text-muted-foreground">
                    Track the status of your job applications
                </p>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                    Loading applications...
                </div>
            ) : applications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <div className="text-3xl mb-3">📋</div>
                    <p>No applications yet. Find a job and apply!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {applications.map((app) => (
                        <Card key={app.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">
                                            {app.job_title || `Job #${app.job_id}`}
                                        </CardTitle>
                                        <CardDescription>{app.employer_name}</CardDescription>
                                    </div>
                                    <StatusChip status={app.status} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>
                                        Applied:{" "}
                                        {new Date(app.created_at).toLocaleDateString("en-GB", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </span>
                                    {app.dry_run && <span>🧪 Dry run</span>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
