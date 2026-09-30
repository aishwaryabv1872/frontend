"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const skillOptions = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Python",
  "Java",
  "C++",
  "SQL",
  "HTML",
  "CSS",
  "Data Structures",
  "Machine Learning",
];

export default function SkillsPage() {
  const router = useRouter();

  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((currentSkills) =>
      currentSkills.includes(skill)
        ? currentSkills.filter((item) => item !== skill)
        : [...currentSkills, skill]
    );
  };

  const handleFinish = async () => {
    if (selectedSkills.length === 0) {
      setMessage("Please select at least one skill.");
      return;
    }

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

    // Remove old skills for this user
    const { error: deleteError } = await supabase
      .from("student_skills")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      setMessage(deleteError.message);
      setLoading(false);
      return;
    }

    // Prepare selected skills for insertion
    const skillsToInsert = selectedSkills.map((skill) => ({
      user_id: user.id,
      skill_name: skill,
    }));

    // Save selected skills
    const { error: insertError } = await supabase
      .from("student_skills")
      .insert(skillsToInsert);

    if (insertError) {
      setMessage(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-500">
            Step 3 of 3
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            What skills do you have?
          </h1>

          <p className="mt-3 text-slate-400">
            Select the skills you already know.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="flex flex-wrap gap-3">
            {skillOptions.map((skill) => {
              const isSelected = selectedSkills.includes(skill);

              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  disabled={loading}
                  className={`rounded-lg border px-4 py-2 transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:border-blue-500"
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Selected: {selectedSkills.length} skill(s)
          </p>

          {message && (
            <p className="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-300">
              {message}
            </p>
          )}

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => router.push("/onboarding/goals")}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              Back
            </button>

            <button
              type="button"
              onClick={handleFinish}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Finish Setup"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}