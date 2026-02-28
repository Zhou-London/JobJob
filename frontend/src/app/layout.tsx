import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobJob — AI Job Application Agent",
  description:
    "Tell your career story, find matching roles, and auto-apply with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
            <Link href="/" className="font-bold text-lg">
              🚀 JobJob
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/onboarding"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Onboarding
              </Link>
              <Link
                href="/jobs"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Jobs
              </Link>
              <Link
                href="/applications"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Applications
              </Link>
              <Link
                href="/profile"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Profile
              </Link>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
