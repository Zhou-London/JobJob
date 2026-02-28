"use client";

import { JobCard } from "@/components/jobs/JobCard";
import { JobFilters } from "@/components/jobs/JobFilters";
import { searchJobs, type JobListing } from "@/lib/api";
import { useCallback, useState } from "react";

export default function JobsPage() {
    const [jobs, setJobs] = useState<JobListing[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = useCallback(
        async (params: { q: string; location?: string; job_type?: string }) => {
            setIsLoading(true);
            setHasSearched(true);
            try {
                const result = await searchJobs(params);
                setJobs(result.results);
            } catch (err) {
                console.error("Search failed:", err);
                setJobs([]);
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Find Jobs</h1>
                <p className="text-muted-foreground">
                    Search for roles that match your skills and preferences
                </p>
            </div>

            <div className="mb-6">
                <JobFilters onSearch={handleSearch} isLoading={isLoading} />
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                    <div className="text-3xl mb-3">🔍</div>
                    <p>Searching for jobs...</p>
                </div>
            ) : jobs.length > 0 ? (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        {jobs.length} jobs found
                    </p>
                    {jobs.map((job) => (
                        <JobCard key={job.job_id} job={job} />
                    ))}
                </div>
            ) : hasSearched ? (
                <div className="text-center py-12 text-muted-foreground">
                    <div className="text-3xl mb-3">😕</div>
                    <p>No jobs found. Try different keywords or location.</p>
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <div className="text-3xl mb-3">🎯</div>
                    <p>Enter keywords to start searching for jobs</p>
                </div>
            )}
        </div>
    );
}
