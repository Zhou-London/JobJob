import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          🚀 JobJob
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          Tell your career story. We&apos;ll find matching roles, tailor your
          CV &amp; cover letter, and apply — all automatically.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/onboarding">
            <Button size="lg" className="text-base px-8">
              Get Started
            </Button>
          </Link>
          <Link href="/jobs">
            <Button size="lg" variant="outline" className="text-base px-8">
              Browse Jobs
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12">
          <div className="space-y-2">
            <div className="text-3xl">💬</div>
            <h3 className="font-semibold">Tell Your Story</h3>
            <p className="text-sm text-muted-foreground">
              Our AI coach interviews you to build a comprehensive career
              profile.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">🎯</div>
            <h3 className="font-semibold">Smart Matching</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered job matching scores and ranks roles against your
              profile.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">📝</div>
            <h3 className="font-semibold">Auto-Apply</h3>
            <p className="text-sm text-muted-foreground">
              Tailored CVs and cover letters, submitted automatically via
              browser automation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
