import { User, Briefcase, List, Sparkles } from "lucide-react";

export interface UserProfile {
  name?: string;
  jobPosition?: string;
  summaryBullets?: string[];
}

export default function InfoPanel({ profile }: { profile?: UserProfile }) {
  if (!profile) {
    return (
      <div className="h-full bg-gray-50/50 p-6 overflow-y-auto flex flex-col items-center justify-center text-center">
        <Sparkles className="w-8 h-8 text-gray-300 mb-4" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Your Profile
        </h3>
        <p className="mt-2 text-sm text-gray-400 max-w-[200px]">
          Start a conversation to build your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50/50 p-6 overflow-y-auto custom-scrollbar flex flex-col">
      <div className="mb-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
          <User className="w-4 h-4" />
          Candidate Profile
        </h3>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            Name
          </p>
          <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
            <p className="text-sm font-medium text-gray-900 break-words">
              {profile.name || <span className="text-gray-300 italic">Not provided</span>}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            Desired Role
          </p>
          <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
            <p className="text-sm font-medium text-gray-900 break-words">
              {profile.jobPosition || <span className="text-gray-300 italic">Not provided</span>}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <List className="w-3.5 h-3.5" />
            Summary
          </p>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            {profile.summaryBullets && profile.summaryBullets.length > 0 ? (
              <ul className="space-y-2.5">
                {profile.summaryBullets.map((bullet, idx) => (
                  <li key={idx} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span className="flex-1">{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-300 italic text-center py-2">
                Your extracted experiences will appear here
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
