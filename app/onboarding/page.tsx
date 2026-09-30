"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();

  const [collegeName, setCollegeName] = useState("");
  const [branch, setBranch] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [graduationYear, setGraduationYear] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Please log in before continuing.");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name ?? "",
        college_name: collegeName,
        branch,
        year_of_study: Number(yearOfStudy),
        cgpa: Number(cgpa),
        graduation_year: Number(graduationYear),
      });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/onboarding/academic");
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="text-4xl font-bold">
          Tell us about yourself
        </h1>

        <p className="mt-3 text-slate-400">
          This information helps Vertex personalize your
          placement readiness journey.
        </p>

        <form
          onSubmit={handleContinue}
          className="mt-8 space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-8"
        >
          <div>
            <label className="mb-2 block font-medium">
              College Name
            </label>

            <input
              type="text"
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              placeholder="Enter your college name"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Branch
            </label>

            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Example: Computer Science"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Year of Study
            </label>

            <select
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="">Select your year</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block font-medium">
              CGPA
            </label>

            <input
              type="number"
              value={cgpa}
              onChange={(e) => setCgpa(e.target.value)}
              placeholder="Example: 8.5"
              min="0"
              max="10"
              step="0.01"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Graduation Year
            </label>

            <input
              type="number"
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value)}
              placeholder="Example: 2027"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          {message && (
            <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}