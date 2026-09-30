"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Difficulty = "Easy" | "Medium" | "Hard";

type DSAProblem = {
  id: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  category: string;
  description: string;
};

export default function DSAProblemsPage() {
  const [problems, setProblems] = useState<DSAProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<
    "All" | Difficulty
  >("All");

  const loadProblems = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("dsa_problem_library")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        console.error("PROBLEM LIBRARY ERROR:", error);
        setError(error.message);
        return;
      }

      setProblems((data as DSAProblem[]) || []);
    } catch (err) {
      console.error("LOAD PROBLEMS ERROR:", err);
      setError("Unable to load the DSA problem library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProblems();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadProblems]);

  const filteredProblems = problems.filter((problem) => {
    const matchesSearch =
      problem.title
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      problem.category
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesDifficulty =
      difficultyFilter === "All" ||
      problem.difficulty === difficultyFilter;

    return matchesSearch && matchesDifficulty;
  });

  const easyCount = problems.filter(
    (problem) => problem.difficulty === "Easy"
  ).length;

  const mediumCount = problems.filter(
    (problem) => problem.difficulty === "Medium"
  ).length;

  const hardCount = problems.filter(
    (problem) => problem.difficulty === "Hard"
  ).length;

  return (
    <main className="min-h-screen bg-[#060b1a] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <section className="rounded-3xl border border-slate-800 bg-linear-to-br from-[#111b31] via-[#0d1628] to-[#091121] p-6 sm:p-8">
          <p className="text-sm font-semibold tracking-wider text-blue-400">
            VERTEX DSA LIBRARY
          </p>

          <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold text-white sm:text-5xl">
                Practice DSA Problems 💻
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Choose a problem, write your solution, run it using
                the Vertex Code Playground, and improve your
                placement preparation.
              </p>
            </div>

            <Link
              href="/dsa"
              className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              ← Back to DSA Progress
            </Link>
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* STATISTICS */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-[#111a2d] p-5">
            <p className="text-sm text-slate-400">
              Total Problems
            </p>

            <p className="mt-3 text-4xl font-bold text-white">
              {problems.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="text-sm text-emerald-400">
              Easy
            </p>

            <p className="mt-3 text-4xl font-bold text-emerald-300">
              {easyCount}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <p className="text-sm text-amber-400">
              Medium
            </p>

            <p className="mt-3 text-4xl font-bold text-amber-300">
              {mediumCount}
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="text-sm text-red-400">
              Hard
            </p>

            <p className="mt-3 text-4xl font-bold text-red-300">
              {hardCount}
            </p>
          </div>
        </section>

        {/* SEARCH AND FILTER */}

        <section className="mt-6 rounded-2xl border border-slate-800 bg-[#111a2d] p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search problems or categories..."
              className="rounded-xl border border-slate-700 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
            />

            <div className="flex flex-wrap gap-2">
              {(["All", "Easy", "Medium", "Hard"] as const).map(
                (item) => (
                  <button
                    key={item}
                    onClick={() => setDifficultyFilter(item)}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      difficultyFilter === item
                        ? "bg-blue-600 text-white"
                        : "bg-[#060b1a] text-slate-400 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          </div>
        </section>

        {/* PROBLEM LIST */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-[#111a2d]">
          <div className="border-b border-slate-800 px-6 py-5">
            <h2 className="text-xl font-bold text-white">
              Available Problems
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Select a challenge and start practicing.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-slate-500">
              Loading problem library...
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="text-5xl">🔍</div>

              <h3 className="mt-4 text-lg font-semibold text-white">
                No problems found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Try changing your search or difficulty filter.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredProblems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/dsa/problems/${problem.slug}`}
                  className="group flex flex-col gap-4 px-6 py-5 transition hover:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400">
                        {problem.title}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          problem.difficulty === "Easy"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : problem.difficulty === "Medium"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {problem.difficulty}
                      </span>
                    </div>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                      {problem.description}
                    </p>

                    <p className="mt-3 text-xs font-medium uppercase tracking-wider text-blue-400">
                      {problem.category}
                    </p>
                  </div>

                  <div className="shrink-0 text-sm font-semibold text-blue-400">
                    Solve →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* FOOTER */}

        <section className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
          <h3 className="text-lg font-bold text-blue-200">
            🚀 Practice consistently
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Start with Easy problems, strengthen your fundamentals,
            then move toward Medium and Hard interview challenges.
          </p>
        </section>
      </div>
    </main>
  );
}