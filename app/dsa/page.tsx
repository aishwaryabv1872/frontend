"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// ======================================================
// TYPES
// ======================================================

type Difficulty = "Easy" | "Medium" | "Hard";
type Language = "Python" | "C++" | "JavaScript";

type CatalogProblem = {
  id: number;
  problem_name: string;
  difficulty: Difficulty;
  description: string;
  inputFormat: string;
  outputFormat: string;
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  starterCode: {
    Python: string;
    "C++": string;
    JavaScript: string;
  };
};

type SolvedProblem = {
  id: number;
  problem_name: string;
  difficulty: Difficulty;
  solved_at: string;
};

type ExecutionResult = {
  success?: boolean;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  compileOutput?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?:
    | string
    | {
        id: number;
        description: string;
      };
  statusId?: number | null;
};

type SubmitResult = {
  success?: boolean;
  problemId?: number;
  verdict?: string;
  accepted?: boolean;
  passedTests?: number;
  totalTests?: number;
  score?: number;
  results?: {
    testCase: number;
    passed: boolean;
    status: string;
    statusId?: number;
    actualOutput?: string;
    time?: string | null;
    memory?: number | null;
    stderr?: string;
    compileOutput?: string;
    message?: string;
  }[];
};

// ======================================================
// LANGUAGE CONFIG
// ======================================================

const languageConfig: Record<
  Language,
  {
    id: number;
  }
> = {
  Python: {
    id: 71,
  },
  "C++": {
    id: 54,
  },
  JavaScript: {
    id: 63,
  },
};

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function DSAPage() {
  // ====================================================
  // PROBLEM LIBRARY
  // ====================================================

  const [problems, setProblems] = useState<CatalogProblem[]>([]);
  const [selectedProblemId, setSelectedProblemId] =
    useState<number | null>(null);

  const [problemsLoading, setProblemsLoading] = useState(true);
  const [problemsError, setProblemsError] = useState("");

  // ====================================================
  // SOLVED PROGRESS
  // ====================================================

  const [solvedProblems, setSolvedProblems] =
    useState<SolvedProblem[]>([]);

  const [progressLoading, setProgressLoading] =
    useState(true);

  // ====================================================
  // CODE PLAYGROUND
  // ====================================================

  const [language, setLanguage] =
    useState<Language>("Python");

  const [sourceCode, setSourceCode] = useState("");
  const [stdin, setStdin] = useState("");

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);

  const [executionError, setExecutionError] =
    useState("");

  const [submitResult, setSubmitResult] =
    useState<SubmitResult | null>(null);

  const [submitError, setSubmitError] =
    useState("");

  const [generalError, setGeneralError] =
    useState("");

  // ====================================================
  // SELECTED PROBLEM
  // ====================================================

  const selectedProblem = useMemo(() => {
    return (
      problems.find(
        (problem) =>
          problem.id === selectedProblemId
      ) || null
    );
  }, [problems, selectedProblemId]);

  // ====================================================
  // LOAD DATA
  // ====================================================

  useEffect(() => {
    loadProblemLibrary();
    loadSolvedProblems();
  }, []);

  // ====================================================
  // LOAD PROBLEM LIBRARY
  // ====================================================

  async function loadProblemLibrary() {
    setProblemsLoading(true);
    setProblemsError("");

    try {
      const response = await fetch(
        "/api/dsa/problems",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load DSA problems."
        );
      }

      const loadedProblems =
        (data.problems ||
          []) as CatalogProblem[];

      setProblems(loadedProblems);

      if (loadedProblems.length > 0) {
        setSelectedProblemId(
          loadedProblems[0].id
        );

        setSourceCode(
          loadedProblems[0].starterCode.Python
        );
      }
    } catch (err) {
      console.error(
        "PROBLEM LIBRARY ERROR:",
        err
      );

      setProblemsError(
        err instanceof Error
          ? err.message
          : "Unable to load DSA problems."
      );
    } finally {
      setProblemsLoading(false);
    }
  }

  // ====================================================
  // LOAD SOLVED PROBLEMS
  // ====================================================

  async function loadSolvedProblems() {
    setProgressLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSolvedProblems([]);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("dsa_problems")
        .select(
          "id, problem_name, difficulty, solved_at"
        )
        .eq("user_id", user.id)
        .order("solved_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "SOLVED PROBLEMS ERROR:",
          error
        );

        setGeneralError(error.message);
        return;
      }

      setSolvedProblems(
        (data as SolvedProblem[]) || []
      );
    } catch (err) {
      console.error(
        "LOAD SOLVED ERROR:",
        err
      );

      setGeneralError(
        "Unable to load your DSA progress."
      );
    } finally {
      setProgressLoading(false);
    }
  }

  // ====================================================
  // SELECT PROBLEM
  // ====================================================

  function selectProblem(
    problem: CatalogProblem
  ) {
    setSelectedProblemId(problem.id);

    setLanguage("Python");

    setSourceCode(
      problem.starterCode.Python
    );

    setStdin("");

    setExecutionResult(null);
    setExecutionError("");

    setSubmitResult(null);
    setSubmitError("");

    setGeneralError("");
  }

  // ====================================================
  // CHANGE LANGUAGE
  // ====================================================

  function changeLanguage(
    newLanguage: Language
  ) {
    setLanguage(newLanguage);

    if (selectedProblem) {
      setSourceCode(
        selectedProblem.starterCode[
          newLanguage
        ]
      );
    }

    setStdin("");

    setExecutionResult(null);
    setExecutionError("");

    setSubmitResult(null);
    setSubmitError("");
  }

  // ====================================================
  // RUN CODE
  // ====================================================

  async function runCode() {
  if (!sourceCode.trim()) {
    setExecutionError(
      "Please write some code before running."
    );
    return;
  }

  setRunning(true);

  setExecutionError("");
  setExecutionResult(null);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setExecutionError(
        "Your session has expired. Please log in again."
      );
      return;
    }

    const response = await fetch(
      "/api/execute-code",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          source_code:
            sourceCode,

          language_id:
            languageConfig[language].id,

          stdin,
        }),
      }
    );

    let data: {
      error?: string;
      stdout?: string;
      stderr?: string;
      compileOutput?: string;
      message?: string;
      time?: string | null;
      memory?: number | null;
      status?: string;
      statusId?: number | null;
    } = {};

    try {
      data = await response.json();
    } catch {
      setExecutionError(
        "Invalid response from code execution service."
      );
      return;
    }

    if (!response.ok) {
      setExecutionError(
        data.error ||
          "Failed to execute code."
      );
      return;
    }

    setExecutionResult(data);
  } catch (err) {
    console.error(
      "RUN CODE ERROR:",
      err instanceof Error
        ? err.name
        : "UnknownError"
    );

    setExecutionError(
      "Unable to connect to the code execution service."
    );
  } finally {
    setRunning(false);
  }
}

  // ====================================================
  // SUBMIT SOLUTION
  // ====================================================

  async function submitSolution() {
    if (!selectedProblem) {
      setSubmitError(
        "Please select a DSA problem first."
      );
      return;
    }

    if (!sourceCode.trim()) {
      setSubmitError(
        "Please write your solution first."
      );
      return;
    }

    setSubmitting(true);

    setSubmitError("");
    setSubmitResult(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setSubmitError(
          "Your session has expired. Please log in again."
        );
        return;
      }

      const response = await fetch(
        "/api/submit-dsa",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            problem_id:
              selectedProblem.id,

            source_code: sourceCode,

            language_id:
              languageConfig[language].id,
          }),
        }
      );

      const data =
        (await response.json()) as SubmitResult & {
          error?: string;
        };

      if (!response.ok) {
        setSubmitError(
          data.error ||
            "Failed to submit solution."
        );
        return;
      }

      setSubmitResult(data);

      // Automatically save accepted problem
      if (data.accepted) {
        await saveSolvedProblem(
          selectedProblem
        );
      }
    } catch (err) {
      console.error(
        "SUBMIT SOLUTION ERROR:",
        err
      );

      setSubmitError(
        "Unable to connect to the submission service."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ====================================================
  // SAVE SOLVED PROBLEM
  // ====================================================

  async function saveSolvedProblem(
    problem: CatalogProblem
  ) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSubmitError(
          "Solution accepted, but please login to save your progress."
        );
        return;
      }

      // Check if already solved
      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from("dsa_problems")
        .select("id")
        .eq("user_id", user.id)
        .eq(
          "problem_name",
          problem.problem_name
        )
        .limit(1);

      if (existingError) {
        console.error(
          "CHECK SOLVED ERROR:",
          existingError
        );
        return;
      }

      // Already solved
      if (existing && existing.length > 0) {
        await loadSolvedProblems();
        return;
      }

      const {
        error: insertError,
      } = await supabase
        .from("dsa_problems")
        .insert({
          user_id: user.id,
          problem_name:
            problem.problem_name,
          difficulty:
            problem.difficulty,
          solved_at:
            new Date().toISOString(),
        });

      if (insertError) {
        console.error(
          "SAVE SOLVED ERROR:",
          insertError
        );

        setSubmitError(
          "Solution accepted, but progress could not be saved."
        );

        return;
      }

      await loadSolvedProblems();
    } catch (err) {
      console.error(
        "SAVE SOLVED PROBLEM ERROR:",
        err
      );
    }
  }

  // ====================================================
  // DELETE SOLVED PROBLEM
  // ====================================================

  async function deleteSolvedProblem(
    id: number
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to remove this problem from your solved progress?"
      );

    if (!confirmed) {
      return;
    }

    setGeneralError("");

    try {
      const {
        error,
      } = await supabase
        .from("dsa_problems")
        .delete()
        .eq("id", id);

      if (error) {
        setGeneralError(error.message);
        return;
      }

      setSolvedProblems(
        (current) =>
          current.filter(
            (problem) =>
              problem.id !== id
          )
      );
    } catch (err) {
      console.error(
        "DELETE SOLVED ERROR:",
        err
      );

      setGeneralError(
        "Unable to delete this solved problem."
      );
    }
  }

  // ====================================================
  // SOLVED CHECK
  // ====================================================

  function isSolved(
    problemName: string
  ) {
    return solvedProblems.some(
      (problem) =>
        problem.problem_name ===
        problemName
    );
  }

  // ====================================================
  // STATISTICS
  // ====================================================

  const totalSolved =
    solvedProblems.length;

  const easyCount =
    solvedProblems.filter(
      (problem) =>
        problem.difficulty === "Easy"
    ).length;

  const mediumCount =
    solvedProblems.filter(
      (problem) =>
        problem.difficulty === "Medium"
    ).length;

  const hardCount =
    solvedProblems.filter(
      (problem) =>
        problem.difficulty === "Hard"
    ).length;

  const dsaPoints =
    easyCount +
    mediumCount * 2 +
    hardCount * 3;

  const placementContribution =
    Math.min(
      25,
      Math.round(dsaPoints / 2)
    );

  const readinessPercentage =
    Math.min(
      100,
      placementContribution * 4
    );

  function getReadinessLevel() {
    if (readinessPercentage < 25)
      return "Beginner";

    if (readinessPercentage < 50)
      return "Improving";

    if (readinessPercentage < 75)
      return "Strong";

    return "Excellent";
  }

  // ====================================================
  // EXECUTION OUTPUT
  // ====================================================

  function getExecutionOutput() {
    if (!executionResult) {
      return null;
    }

    if (
      executionResult.compile_output
    ) {
      return executionResult.compile_output;
    }

    if (
      executionResult.compileOutput
    ) {
      return executionResult.compileOutput;
    }

    if (executionResult.stderr) {
      return executionResult.stderr;
    }

    if (executionResult.stdout) {
      return executionResult.stdout;
    }

    if (executionResult.message) {
      return executionResult.message;
    }

    return "Program executed successfully with no output.";
  }

  const executionOutput =
    getExecutionOutput();

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <main className="min-h-screen bg-[#060b1a] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-linear-to-br from-[#111b31] via-[#0d1628] to-[#091121] p-6 shadow-2xl sm:p-8">

          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />

          <div className="relative">

            <p className="text-sm font-medium tracking-wider text-blue-400">
              YOUR CODING COMMAND CENTER
            </p>

            <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">

              <div>

                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
                  DSA Practice Hub 💻
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                  Solve real coding challenges,
                  run your code with Judge0,
                  submit solutions, and build
                  your placement readiness.
                </p>

              </div>

              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-6 py-4">

                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Placement Contribution
                </p>

                <p className="mt-1 text-3xl font-bold text-blue-400">
                  +{placementContribution}%
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* ERROR */}
        {(generalError ||
          problemsError) && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            {generalError ||
              problemsError}
          </div>
        )}

        {/* STATISTICS */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            title="Total Solved"
            icon="🧠"
            value={totalSolved}
            description="Problems completed"
          />

          <StatCard
            title="Easy"
            icon="🟢"
            value={easyCount}
            description="Foundation problems"
            color="emerald"
          />

          <StatCard
            title="Medium"
            icon="🟡"
            value={mediumCount}
            description="Interview-level problems"
            color="amber"
          />

          <StatCard
            title="Hard"
            icon="🔴"
            value={hardCount}
            description="Advanced problems"
            color="red"
          />

        </section>

        {/* READINESS */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-[#111a2d] p-6">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

            <div>

              <h2 className="text-lg font-semibold text-white">
                Placement Readiness
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Your DSA practice directly contributes
                to your placement preparation score.
              </p>

            </div>

            <div className="text-left sm:text-right">

              <p className="text-3xl font-bold text-blue-400">
                {readinessPercentage}%
              </p>

              <p className="text-sm text-slate-500">
                {getReadinessLevel()}
              </p>

            </div>

          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#060b1a]">

            <div
              className="h-full rounded-full bg-linear-to-r from-blue-600 to-indigo-400 transition-all duration-500"
              style={{
                width: `${readinessPercentage}%`,
              }}
            />

          </div>

          <div className="mt-3 flex justify-between text-xs text-slate-500">
            <span>Beginner</span>

            <span>
              Maximum DSA contribution: 25%
            </span>
          </div>

        </section>

        {/* PROBLEM LIBRARY */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-[#111a2d]">

          <div className="border-b border-slate-800 px-6 py-5">

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

              <div>

                <h2 className="text-xl font-bold text-white">
                  📚 DSA Problem Library
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Choose a challenge and start coding.
                </p>

              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">

                <p className="text-xs text-slate-400">
                  Available Problems
                </p>

                <p className="mt-1 text-xl font-bold text-blue-400">
                  {problems.length}
                </p>

              </div>

            </div>

          </div>

          {problemsLoading ? (

            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Loading DSA problems...
            </div>

          ) : problems.length === 0 ? (

            <div className="px-6 py-12 text-center text-slate-500">
              No DSA problems available.
            </div>

          ) : (

            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">

              {problems.map(
                (problem) => {

                  const selected =
                    selectedProblemId ===
                    problem.id;

                  const solved =
                    isSolved(
                      problem.problem_name
                    );

                  return (
                    <button
                      key={`dsa-problem-${problem.id}-${problem.problem_name}`}
                      onClick={() =>
                        selectProblem(
                          problem
                        )
                      }
                      className={`rounded-2xl border p-5 text-left transition ${
                        selected
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-800 bg-[#0a1120] hover:border-slate-600"
                      }`}
                    >

                      <div className="flex items-start justify-between gap-3">

                        <span className="text-xs font-semibold text-slate-500">
                          PROBLEM #{problem.id}
                        </span>

                        {solved && (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                            ✓ Solved
                          </span>
                        )}

                      </div>

                      <h3 className="mt-3 font-bold text-white">
                        {problem.problem_name}
                      </h3>

                      <span
                        className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                          problem.difficulty ===
                          "Easy"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : problem.difficulty ===
                              "Medium"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {problem.difficulty}
                      </span>

                    </button>
                  );
                }
              )}

            </div>

          )}

        </section>

        {/* PROBLEM STATEMENT */}
        {selectedProblem && (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-[#111a2d]">

            <div className="border-b border-slate-800 px-6 py-5">

              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    Problem #{selectedProblem.id}
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-white">
                    {selectedProblem.problem_name}
                  </h2>

                </div>

                <span
                  className={`w-fit rounded-full px-4 py-2 text-xs font-semibold ${
                    selectedProblem.difficulty ===
                    "Easy"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : selectedProblem.difficulty ===
                        "Medium"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {selectedProblem.difficulty}
                </span>

              </div>

            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-3">

              <div className="lg:col-span-2">

                <h3 className="font-semibold text-white">
                  Description
                </h3>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-400">
                  {selectedProblem.description}
                </p>

              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0a1120] p-5">

                <h3 className="font-semibold text-white">
                  Input Format
                </h3>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                  {selectedProblem.inputFormat}
                </p>

                <h3 className="mt-6 font-semibold text-white">
                  Output Format
                </h3>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                  {selectedProblem.outputFormat}
                </p>

              </div>

            </div>

            {/* EXAMPLES */}
            {selectedProblem.examples?.length >
              0 && (
              <div className="border-t border-slate-800 p-6">

                <h3 className="font-semibold text-white">
                  Examples
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">

                  {selectedProblem.examples.map(
                    (
                      example,
                      index
                    ) => (

                      <div
                        key={`dsa-example-${selectedProblem.id}-${index}-${example.input}`}
                        className="rounded-xl border border-slate-800 bg-[#0a1120] p-5"
                      >

                        <p className="text-xs font-semibold text-blue-400">
                          Example {index + 1}
                        </p>

                        <p className="mt-4 text-xs text-slate-500">
                          Input
                        </p>

                        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[#060b1a] p-3 font-mono text-sm text-slate-200">
                          {example.input}
                        </pre>

                        <p className="mt-4 text-xs text-slate-500">
                          Output
                        </p>

                        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[#060b1a] p-3 font-mono text-sm text-emerald-300">
                          {example.output}
                        </pre>

                        {example.explanation && (
                          <p className="mt-4 text-sm leading-6 text-slate-500">
                            {example.explanation}
                          </p>
                        )}

                      </div>

                    )
                  )}

                </div>

              </div>
            )}

          </section>
        )}

        {/* CODE PLAYGROUND */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-[#111a2d] shadow-xl">

          <div className="border-b border-slate-800 px-6 py-5">

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

              <div>

                <h2 className="text-xl font-bold text-white">
                  🚀 Vertex Code Playground
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Write, run, and submit your solution using Judge0.
                </p>

              </div>

              {selectedProblem && (
                <span className="rounded-xl bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400">
                  {selectedProblem.problem_name}
                </span>
              )}

            </div>

          </div>

          {/* LANGUAGE TABS */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800 px-6 py-4">

            {(Object.keys(
              languageConfig
            ) as Language[]).map(
              (item) => (

                <button
                  key={`dsa-language-${item}`}
                  onClick={() =>
                    changeLanguage(
                      item
                    )
                  }
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    language === item
                      ? "bg-blue-600 text-white"
                      : "bg-[#0a1120] text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {item}
                </button>

              )
            )}

          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-2">

            {/* EDITOR */}
            <div>

              <div className="mb-3 flex items-center justify-between">

                <label className="text-sm font-semibold text-slate-300">
                  Code Editor
                </label>

                <span className="rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                  {language}
                </span>

              </div>

              <textarea
                value={sourceCode}
                onChange={(event) =>
                  setSourceCode(
                    event.target.value
                  )
                }
                spellCheck={false}
                className="h-107.5 w-full resize-y rounded-xl border border-slate-700 bg-[#060b1a] p-5 font-mono text-sm leading-7 text-slate-200 outline-none transition focus:border-blue-500"
                placeholder="Write your solution here..."
              />

              {/* CUSTOM INPUT */}
              <div className="mt-5">

                <label className="text-sm font-semibold text-slate-300">
                  Custom Input
                </label>

                <p className="mt-1 text-xs text-slate-500">
                  Optional input for Run Code.
                </p>

                <textarea
                  value={stdin}
                  onChange={(event) =>
                    setStdin(
                      event.target.value
                    )
                  }
                  placeholder="Example: 5 7"
                  className="mt-3 h-28 w-full resize-y rounded-xl border border-slate-700 bg-[#060b1a] p-4 font-mono text-sm text-slate-200 outline-none focus:border-blue-500"
                />

              </div>

              {/* BUTTONS */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">

                <button
                  onClick={runCode}
                  disabled={
                    running ||
                    submitting ||
                    !selectedProblem
                  }
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0a1120] px-5 py-3.5 font-semibold text-white transition hover:border-blue-500 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {running ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Running...
                    </>
                  ) : (
                    "▶ Run Code"
                  )}

                </button>

                <button
                  onClick={submitSolution}
                  disabled={
                    submitting ||
                    running ||
                    !selectedProblem
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-3.5 font-semibold text-white transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Judging...
                    </>
                  ) : (
                    "🚀 Submit Solution"
                  )}

                </button>

              </div>

            </div>

            {/* RESULTS */}
            <div>

              {/* RUN RESULT */}
              <div>

                <h3 className="text-sm font-semibold text-slate-300">
                  Execution Result
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Output from the Judge0 execution engine.
                </p>

                <div className="mt-4 min-h-64 overflow-auto rounded-xl border border-slate-700 bg-[#060b1a]">

                  {executionError ? (

                    <div className="p-5">

                      <p className="font-semibold text-red-400">
                        Execution failed
                      </p>

                      <pre className="mt-4 whitespace-pre-wrap wrap-break-word font-mono text-sm leading-6 text-red-300">
                        {executionError}
                      </pre>

                    </div>

                  ) : executionOutput ? (

                    <div className="p-5">

                      <pre className="whitespace-pre-wrap wrap-break-word font-mono text-sm leading-7 text-slate-200">
                        {executionOutput}
                      </pre>

                    </div>

                  ) : (

                    <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">

                      <div className="text-4xl">
                        ⚡
                      </div>

                      <p className="mt-3 font-semibold text-slate-300">
                        Ready to execute
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        Click Run Code to test your program.
                      </p>

                    </div>

                  )}

                </div>

                {executionResult && (
                  <div className="mt-4 grid grid-cols-2 gap-3">

                    <div className="rounded-xl border border-slate-800 bg-[#0a1120] p-4">

                      <p className="text-xs text-slate-500">
                        Execution Time
                      </p>

                      <p className="mt-1 font-semibold text-slate-200">
                        {executionResult.time
                          ? `${executionResult.time}s`
                          : "N/A"}
                      </p>

                    </div>

                    <div className="rounded-xl border border-slate-800 bg-[#0a1120] p-4">

                      <p className="text-xs text-slate-500">
                        Memory
                      </p>

                      <p className="mt-1 font-semibold text-slate-200">
                        {executionResult.memory !==
                          null &&
                        executionResult.memory !==
                          undefined
                          ? `${executionResult.memory} KB`
                          : "N/A"}
                      </p>

                    </div>

                  </div>
                )}

              </div>

              {/* SUBMISSION RESULT */}
              {submitError && (
                <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">

                  <p className="font-semibold text-red-400">
                    Submission Error
                  </p>

                  <p className="mt-2 text-sm text-red-300">
                    {submitError}
                  </p>

                </div>
              )}

              {submitResult && (
                <div className="mt-5 rounded-xl border border-slate-700 bg-[#0a1120] p-5">

                  <div className="flex items-center justify-between gap-4">

                    <div>

                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Submission Verdict
                      </p>

                      <p
                        className={`mt-1 text-2xl font-bold ${
                          submitResult.accepted
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {submitResult.accepted
                          ? "Accepted ✓"
                          : submitResult.verdict ||
                            "Wrong Answer"}
                      </p>

                    </div>

                    <div className="text-right">

                      <p className="text-xs text-slate-500">
                        Score
                      </p>

                      <p className="text-2xl font-bold text-blue-400">
                        {submitResult.score ??
                          0}
                      </p>

                    </div>

                  </div>

                  <div className="mt-4 rounded-xl bg-[#060b1a] p-4">

                    <p className="text-sm font-semibold text-slate-300">
                      Tests Passed
                    </p>

                    <p className="mt-1 text-lg font-bold text-white">
                      {submitResult.passedTests ??
                        0}{" "}
                      /{" "}
                      {submitResult.totalTests ??
                        0}
                    </p>

                  </div>

                  {/* TEST CASE RESULTS */}
                  {submitResult.results &&
                    submitResult.results.length >
                      0 && (
                      <div className="mt-4 space-y-2">

                        {submitResult.results.map(
                          (result) => (

                            <div
                              key={`dsa-test-${selectedProblem?.id ?? "unknown"}-${result.testCase}`}
                              className="rounded-xl border border-slate-800 bg-[#060b1a] p-4"
                            >

                              <div className="flex items-center justify-between">

                                <span className="text-sm text-slate-300">
                                  Test Case{" "}
                                  {
                                    result.testCase
                                  }
                                </span>

                                <span
                                  className={`text-xs font-bold ${
                                    result.passed
                                      ? "text-emerald-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {result.passed
                                    ? "PASSED"
                                    : result.status}
                                </span>

                              </div>

                              {result.actualOutput && (
                                <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-slate-400">
                                  Output:{" "}
                                  {
                                    result.actualOutput
                                  }
                                </pre>
                              )}

                              {result.stderr && (
                                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-red-300">
                                  {result.stderr}
                                </pre>
                              )}

                            </div>

                          )
                        )}

                      </div>
                    )}

                  {submitResult.accepted && (
                    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">

                      <p className="font-semibold text-emerald-400">
                        🎉 Problem Solved!
                      </p>

                      <p className="mt-1 text-sm text-emerald-300/80">
                        Your solution has been
                        added to your DSA
                        progress automatically.
                      </p>

                    </div>
                  )}

                </div>
              )}

            </div>

          </div>

        </section>

        {/* SOLVED PROBLEMS */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-[#111a2d]">

          <div className="border-b border-slate-800 px-6 py-5">

            <h2 className="text-xl font-bold text-white">
              ✅ Solved Problems
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Problems accepted by the Vertex Judge0
              submission system.
            </p>

          </div>

          {progressLoading ? (

            <div className="px-6 py-14 text-center text-sm text-slate-500">
              Loading your DSA progress...
            </div>

          ) : solvedProblems.length ===
            0 ? (

            <div className="px-6 py-16 text-center">

              <div className="text-5xl">
                💻
              </div>

              <h3 className="mt-4 text-lg font-semibold text-white">
                No problems solved yet
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Submit an accepted solution to
                start building your progress.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-slate-800">

              {solvedProblems.map(
                (problem) => (

                  <div
                    key={`dsa-solved-${problem.id}-${problem.problem_name}`}
                    className="flex flex-col gap-4 px-6 py-5 transition hover:bg-slate-800/20 sm:flex-row sm:items-center sm:justify-between"
                  >

                    <div>

                      <p className="font-semibold text-white">
                        {problem.problem_name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Solved on{" "}
                        {new Date(
                          problem.solved_at
                        ).toLocaleDateString(
                          "en-IN"
                        )}
                      </p>

                    </div>

                    <div className="flex items-center gap-3">

                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          problem.difficulty ===
                          "Easy"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : problem.difficulty ===
                              "Medium"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {problem.difficulty}
                      </span>

                      <button
                        onClick={() =>
                          deleteSolvedProblem(
                            problem.id
                          )
                        }
                        className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        Delete
                      </button>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>

        {/* FOOTER */}
        <section className="mt-6 rounded-2xl border border-blue-500/20 bg-linear-to-r from-blue-950/40 to-indigo-950/20 p-6">

          <h3 className="text-lg font-bold text-blue-200">
            🚀 Keep Building Your Skills
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Easy problems give 1 point, Medium
            problems give 2 points, and Hard
            problems give 3 points toward your DSA
            readiness. Your accepted submissions are
            automatically tracked in Vertex.
          </p>

        </section>

      </div>
    </main>
  );
}

// ======================================================
// STAT CARD
// ======================================================

function StatCard({
  title,
  icon,
  value,
  description,
  color = "blue",
}: {
  title: string;
  icon: string;
  value: number;
  description: string;
  color?:
    | "blue"
    | "emerald"
    | "amber"
    | "red";
}) {
  const styles = {
    blue: {
      border: "border-slate-800",
      background: "bg-[#111a2d]",
      title: "text-slate-400",
      value: "text-white",
    },

    emerald: {
      border: "border-emerald-500/20",
      background: "bg-emerald-500/5",
      title: "text-emerald-400",
      value: "text-emerald-300",
    },

    amber: {
      border: "border-amber-500/20",
      background: "bg-amber-500/5",
      title: "text-amber-400",
      value: "text-amber-300",
    },

    red: {
      border: "border-red-500/20",
      background: "bg-red-500/5",
      title: "text-red-400",
      value: "text-red-300",
    },
  };

  const current = styles[color];

  return (
    <div
      className={`rounded-2xl border p-5 transition ${current.border} ${current.background}`}
    >

      <div className="flex items-center justify-between">

        <p
          className={`text-sm font-medium ${current.title}`}
        >
          {title}
        </p>

        <span className="text-2xl">
          {icon}
        </span>

      </div>

      <p
        className={`mt-4 text-4xl font-bold ${current.value}`}
      >
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>

    </div>
  );
}