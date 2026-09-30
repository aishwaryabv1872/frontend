"use client";

import { useRouter } from "next/navigation";

export default function AcademicPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">
          Academic Information
        </h1>

        <p className="mt-3 text-slate-400">
          Tell us more about your academic background.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <h2 className="text-xl font-semibold">
            Academic Profile
          </h2>

          <p className="mt-3 text-slate-400">
            Your academic information will help Vertex understand
            your placement readiness.
          </p>

          <button
            onClick={() => router.push("/onboarding/goals")}
            className="mt-8 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700"
          >
            Continue to Goals
          </button>
        </div>
      </div>
    </main>
  );
}