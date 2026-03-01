import { Building2, MapPin, PoundSterling, ExternalLink, FileText, Briefcase, FileDown } from "lucide-react";

export interface JobData {
    jobId: number;
    employerName: string;
    jobTitle: string;
    locationName: string;
    minimumSalary?: number;
    maximumSalary?: number;
    jobDescription?: string;
    jobUrl?: string;
}

export default function JobsPanel({
    jobs,
    onGenerateCoverLetter,
    onGenerateCV,
}: {
    jobs: JobData[],
    onGenerateCoverLetter: (job: JobData) => void,
    onGenerateCV: (job: JobData) => void,
}) {
    if (!jobs || jobs.length === 0) {
        return (
            <div className="h-full bg-gray-50/50 p-6 flex flex-col items-center justify-center text-center">
                <Briefcase className="w-8 h-8 text-gray-300 mb-4" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                    Matched Jobs
                </h3>
                <p className="mt-2 text-sm text-gray-400 max-w-[200px]">
                    Ask me to search for jobs that fit your profile.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-50/50 p-6 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="mb-6 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Matched Opportunities
                </h3>
                <span className="bg-blue-100 text-blue-700 text-xs py-0.5 px-2 rounded-full font-medium">
                    {jobs.length} found
                </span>
            </div>

            <div className="space-y-4">
                {jobs.map((job) => (
                    <div
                        key={job.jobId}
                        className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group flex flex-col relative overflow-hidden"
                    >
                        {/* Edge accent */}
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="mb-3">
                            <h4 className="font-semibold text-gray-900 leading-tight mb-1.5">{job.jobTitle}</h4>
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                <span className="truncate">{job.employerName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                <span className="truncate">{job.locationName}</span>
                            </div>
                            {(job.minimumSalary || job.maximumSalary) && (
                                <div className="flex items-center gap-1.5 text-sm text-gray-600 font-medium">
                                    <PoundSterling className="w-3.5 h-3.5 text-green-600" />
                                    <span className="text-green-700">
                                        {job.minimumSalary ? `£${job.minimumSalary.toLocaleString()}` : ""}
                                        {job.minimumSalary && job.maximumSalary ? " - " : ""}
                                        {job.maximumSalary ? `£${job.maximumSalary.toLocaleString()}` : ""}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="mt-auto pt-4 border-t border-gray-100 flex flex-col gap-2">
                            <button
                                onClick={() => onGenerateCV(job)}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <FileDown className="w-4 h-4" />
                                Generate CV
                            </button>
                            <button
                                onClick={() => onGenerateCoverLetter(job)}
                                className="w-full flex items-center justify-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
                            >
                                <FileText className="w-4 h-4" />
                                Generate Cover Letter
                            </button>
                            {job.jobUrl && (
                                <a
                                    href={job.jobUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors"
                                >
                                    View on Reed
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
