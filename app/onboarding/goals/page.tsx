"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function GoalsPage() {
  const router = useRouter();

  const [goal, setGoal] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!goal || !targetRole) {
      setMessage("Please select your career goal and target role.");
      return;
    }

    setLoading(true);
    setMessage("");

    // Get the currently logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Please log in before continuing.");
      setLoading(false);
      return;
    }

    // Check whether the user already has career goals
    const { data: existingGoal, error: checkError } = await supabase
      .from("career_goals")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      setMessage(checkError.message);
      setLoading(false);
      return;
    }

    let error;

    if (existingGoal) {
      // Update existing career goal
      const { error: updateError } = await supabase
        .from("career_goals")
        .update({
          primary_goal: goal,
          target_role: targetRole,
        })
        .eq("id", existingGoal.id)
        .eq("user_id", user.id);

      error = updateError;
    } else {
      // Insert new career goal
      const { error: insertError } = await supabase
        .from("career_goals")
        .insert({
          user_id: user.id,
          primary_goal: goal,
          target_role: targetRole,
        });

      error = insertError;
    }

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    // Move to the Skills page
    router.push("/onboarding/skills");
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-500">
            Step 2 of 3
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            What are your career goals?
          </h1>

          <p className="mt-3 text-slate-400">
            Tell us about the career you want to prepare for.
          </p>
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div>
            <label className="mb-3 block font-medium">
              Primary Career Goal
            </label>

            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500"
            >
              <option value="">Select your goal</option>
              <option value="Placement">Get a Placement</option>
              <option value="Internship">Get an Internship</option>
              <option value="Higher Studies">Prepare for Higher Studies</option>
              <option value="Entrepreneurship">Build a Startup</option>
            </select>
          </div>

          <div>
            <label className="mb-3 block font-medium">
              Target Job Role
            </label>

            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500"
            >
              <option value="">Select your target role</option>
              <option value="Software Engineer">
                Software Engineer
              </option>
              <option value="Frontend Developer">
                Frontend Developer
              </option>
              <option value="Backend Developer">
                Backend Developer
              </option>
              <option value="Full Stack Developer">
                Full Stack Developer
              </option>
              <option value="Data Analyst">
                Data Analyst
              </option>
              <option value="Data Scientist">
                Data Scientist
              </option>
              <option value="AI/ML Engineer">
                AI/ML Engineer
              </option>
              <option value="Other">Other</option>
            </select>
          </div>

          {message && (
            <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
              {message}
            </p>
          )}

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={() => router.push("/onboarding/academic")}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-6 py-3 font-semibold transition hover:bg-slate-800 disabled:opacity-60"
            >
              Back
            </button>

            <button
              type="button"
              onClick={handleContinue}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Continue to Skills"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}