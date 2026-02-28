"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getJobDetails, generateDocuments, triggerApply, type JobListing } from "@/lib/api";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function JobDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const jobId = Number(params.id);
    const sessionId = searchParams.get("session");

    const [job, setJob] = useState<JobListing | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [genResult, setGenResult] = useState<string | null>(null);
    const [applyResult, setApplyResult] = useState<string | null>(null);

    useEffect(() => {
        if (!jobId) return;
        setIsLoading(true);
        getJobDetails(jobId)
            .then(setJob)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [jobId]);

    const handleGenerateDocs = useCallback(async () => {
        if (!sessionId) {
            alert("Please complete onboarding first to generate tailored documents.");
            return;
        }
        setIsGenerating(true);
        try {
            const result = await generateDocuments(sessionId, jobId);
            setGenResult(result.message);
        } catch (err) {
            setGenResult(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
        } finally {
            setIsGenerating(false);
        }
    }, [sessionId, jobId]);

    const handleApply = useCallback(
        async (dryRun: boolean) => {
            if (!sessionId) {
                alert("Please complete onboarding first.");
                return;
            }
            setIsApplying(true);
            try {
                const result = await triggerApply({
                    session_id: sessionId,
                    job_id: jobId,
                    job_title: job?.job_title || "",
                    employer_name: job?.employer_name || "",
                    dry_run: dryRun,
                });
                setApplyResult(result.message);
            } catch (err) {
                setApplyResult(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
            } finally {
                setIsApplying(false);
            }
        },
        [sessionId, jobId, job]
    );

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8 text-center text-muted-foreground">
                Loading job details...
            </div>
        );
    }

    if (!job) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8 text-center text-muted-foreground">
                Job not found
            </div>
        );
    }

    const formatSalary = () => {
        const fmt = (n: number) =>
            new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: job.currency || "GBP",
                maximumFractionDigits: 0,
            }).format(n);

        if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
        if (job.salary_min) return `From ${fmt(job.salary_min)}`;
        if (job.salary_max) return `Up to ${fmt(job.salary_max)}`;
        return "Not specified";
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold">{job.job_title}</h1>
                <p className="text-lg text-muted-foreground mt-1">
                    {job.employer_name}
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                    <Badge variant="secondary">📍 {job.location_name}</Badge>
                    <Badge variant="secondary">💰 {formatSalary()}</Badge>
                    {job.contract_type && (
                        <Badge variant="outline">{job.contract_type}</Badge>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Job description */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Job Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div
                                className="prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: job.description }}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Actions sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Actions</CardTitle>
                            <CardDescription>
                                Generate tailored documents and apply
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button
                                className="w-full"
                                onClick={handleGenerateDocs}
                                disabled={isGenerating}
                            >
                                {isGenerating ? "Generating..." : "📝 Generate CV & Cover Letter"}
                            </Button>

                            <Separator />

                            <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => handleApply(true)}
                                disabled={isApplying}
                            >
                                {isApplying ? "Processing..." : "🧪 Dry Run Apply"}
                            </Button>

                            <Button
                                className="w-full"
                                variant="default"
                                onClick={() => handleApply(false)}
                                disabled={isApplying}
                            >
                                {isApplying ? "Applying..." : "🚀 Auto-Apply"}
                            </Button>

                            {job.external_url && (
                                <>
                                    <Separator />
                                    <a
                                        href={job.external_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Button className="w-full" variant="ghost">
                                            🔗 View External Listing
                                        </Button>
                                    </a>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Results */}
                    {genResult && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Document Generation</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm whitespace-pre-wrap">{genResult}</p>
                            </CardContent>
                        </Card>
                    )}

                    {applyResult && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Application Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm whitespace-pre-wrap">{applyResult}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
