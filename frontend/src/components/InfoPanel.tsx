export interface UserData {
  cvFileName: string;
  name: string;
  jobPosition: string;
  jobType: string;
  school: string;
  major: string;
  degree: string;
  experience: string;
  nationality: string;
  gender: string;
  story: string;
}

export default function InfoPanel({ userData }: { userData: UserData }) {
  const fields: { label: string; value: string }[] = [
    { label: "Name", value: userData.name },
    { label: "CV", value: userData.cvFileName },
    { label: "Target Job", value: userData.jobPosition },
    { label: "Job Type", value: userData.jobType },
    { label: "School", value: userData.school },
    { label: "Major", value: userData.major },
    { label: "Degree", value: userData.degree },
    { label: "Experience", value: userData.experience },
    { label: "Nationality", value: userData.nationality },
    { label: "Gender", value: userData.gender },
    { label: "Story", value: userData.story },
  ];

  const filledFields = fields.filter((f) => f.value);

  return (
    <div className="h-full bg-gray-50 p-6 overflow-y-auto">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-6">
        Your Profile
      </h3>
      <div className="space-y-4">
        {filledFields.map((field) => (
          <div key={field.label}>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {field.label}
            </p>
            <p className="mt-1 text-sm text-black break-words leading-relaxed">
              {field.value}
            </p>
          </div>
        ))}
        {filledFields.length === 0 && (
          <p className="text-sm text-gray-300 italic">No information yet</p>
        )}
      </div>
    </div>
  );
}
