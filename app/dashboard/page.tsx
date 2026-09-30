
"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string | null;
  college_name: string | null;
  branch: string | null;
  year_of_study: number | null;
  cgpa: number | null;
  graduation_year: number | null;
};

type CareerGoal = {
  primary_goal: string;
  target_role: string;
};

type DSAProblem = {
  difficulty: "Easy" | "Medium" | "Hard";
};

type AptitudeAttempt = {
  question_id: number;
  category: string;
  is_correct: boolean;
};

type ReadinessCategory = {
  key: string;
  name: string;
  score: number;
  maxScore: number;
  level: "strong" | "developing" | "needs_attention";
};

type ReadinessPriority = {
  area: string;
  key: string;
  score: number;
  maxScore: number;
  percentage: number;
  priority: "high" | "medium" | "maintenance";
  action: string;
};

type ReadinessIntelligence = {
  readiness: {
    percentage: number;
    totalScore: number;
    maxScore: number;
  };
  profile: {
    name: string;
    branch: string;
    college: string;
    cgpa: number;
    careerGoal: string;
    targetRole: string;
  };
  progress: {
    skillsCount: number;
    dsaCount: number;
    projectsCount: number;
    aptitudeAttempted: number;
    aptitudeCorrect: number;
    aptitudeAccuracy: number;
  };
  scores: {
    cgpa: number;
    skills: number;
    dsa: number;
    projects: number;
    aptitude: number;
  };
  dsa: {
    easy: number;
    medium: number;
    hard: number;
    totalSolved: number;
  };
  categories: ReadinessCategory[];
  strongestArea: {
    key: string;
    name: string;
    score: number;
    maxScore: number;
  };
  weakestArea: {
    key: string;
    name: string;
    score: number;
    maxScore: number;
  };
  strengths: string[];
  gaps: string[];
  priorities: ReadinessPriority[];
  nextAction: string;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [careerGoal, setCareerGoal] = useState<CareerGoal | null>(null);
  const [skillsCount, setSkillsCount] = useState(0);
  const [dsaProblems, setDsaProblems] = useState<DSAProblem[]>([]);
  const [projectsCount, setProjectsCount] = useState(0);
  const [aptitudeAttempts, setAptitudeAttempts] = useState<AptitudeAttempt[]>([]);
  const [readinessIntelligence, setReadinessIntelligence] =
    useState<ReadinessIntelligence | null>(null);
  const [intelligenceError, setIntelligenceError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setMessage("");
      setIntelligenceError("");

      try {
        // CURRENT USER
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (isMounted) {
            setMessage("Please log in to view your dashboard.");
            setLoading(false);
          }
          return;
        }

        // PROFILE
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "full_name, college_name, branch, year_of_study, cgpa, graduation_year"
          )
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw new Error(profileError.message);

        // CAREER GOAL
        const {
          data: goalData,
          error: goalError,
        } = await supabase
          .from("career_goals")
          .select("primary_goal, target_role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (goalError) throw new Error(goalError.message);

        // SKILLS
        const {
          count: skillsCountData,
          error: skillsError,
        } = await supabase
          .from("student_skills")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (skillsError) throw new Error(skillsError.message);

        // DSA
        const {
          data: dsaData,
          error: dsaError,
        } = await supabase
          .from("dsa_problems")
          .select("difficulty")
          .eq("user_id", user.id);

        if (dsaError) throw new Error(dsaError.message);

        // PROJECTS
        const {
          count: projectCount,
          error: projectsError,
        } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (projectsError) throw new Error(projectsError.message);

        // APTITUDE
        const {
          data: aptitudeData,
          error: aptitudeError,
        } = await supabase
          .from("aptitude_attempts")
          .select("question_id, category, is_correct")
          .eq("user_id", user.id);

        if (aptitudeError) throw new Error(aptitudeError.message);

        if (!isMounted) return;

        // SAVE DASHBOARD DATA
        setProfile(profileData as Profile | null);
        setCareerGoal(goalData as CareerGoal | null);
        setSkillsCount(skillsCountData ?? 0);
        setDsaProblems((dsaData as DSAProblem[]) || []);
        setProjectsCount(projectCount ?? 0);
        setAptitudeAttempts((aptitudeData as AptitudeAttempt[]) || []);

        // PHASE 9: FETCH READINESS INTELLIGENCE
        // Failure here does not prevent the existing dashboard from loading.
        try {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) {
            throw new Error(sessionError.message);
          }

          if (!session?.access_token) {
            throw new Error("Your session has expired. Please sign in again.");
          }

          const response = await fetch("/api/readiness-intelligence", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
          });

          const intelligenceData = await response.json();

          if (!response.ok || !intelligenceData?.success) {
            throw new Error(
              intelligenceData?.error ||
                "Unable to load readiness intelligence."
            );
          }

          if (isMounted) {
            setReadinessIntelligence(
              intelligenceData as ReadinessIntelligence
            );
          }
        } catch (error) {
          console.error("Readiness Intelligence fetch failed:", error);

          if (isMounted) {
            setIntelligenceError(
              error instanceof Error
                ? error.message
                : "Readiness Intelligence is temporarily unavailable."
            );
          }
        }
      } catch (error) {
        console.error("Dashboard loading failed:", error);

        if (isMounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load your dashboard."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  // CGPA SCORE
  const cgpaScore = profile?.cgpa
    ? Math.min((profile.cgpa / 10) * 20, 20)
    : 0;

  // SKILLS SCORE
  const skillsScore = Math.min(skillsCount * 3, 30);

  // DSA STATISTICS
  const totalDsaSolved = dsaProblems.length;

  const easyCount = dsaProblems.filter(
    (problem) => problem.difficulty === "Easy"
  ).length;

  const mediumCount = dsaProblems.filter(
    (problem) => problem.difficulty === "Medium"
  ).length;

  const hardCount = dsaProblems.filter(
    (problem) => problem.difficulty === "Hard"
  ).length;

  const dsaPoints =
    easyCount + mediumCount * 2 + hardCount * 3;

  const dsaScore = Math.min(Math.round(dsaPoints / 2), 25);

  // PROJECT SCORE
  const projectsScore = Math.min(projectsCount * 8, 25);

  // APTITUDE STATISTICS
  const aptitudeAttempted = aptitudeAttempts.length;

  const aptitudeCorrect = aptitudeAttempts.filter(
    (attempt) => attempt.is_correct
  ).length;

  const aptitudeAccuracy =
    aptitudeAttempted > 0
      ? Math.round((aptitudeCorrect / aptitudeAttempted) * 100)
      : 0;

  const aptitudeScore = Math.min(
    Math.round(aptitudeAccuracy / 10),
    10
  );

  // APTITUDE CATEGORIES
  const quantitativeAttempts = aptitudeAttempts.filter(
    (attempt) =>
      attempt.category.toLowerCase() === "quantitative"
  );

  const logicalAttempts = aptitudeAttempts.filter(
    (attempt) =>
      attempt.category.toLowerCase() === "logical"
  );

  const verbalAttempts = aptitudeAttempts.filter(
    (attempt) =>
      attempt.category.toLowerCase() === "verbal"
  );

  const getCategoryAccuracy = (attempts: AptitudeAttempt[]) => {
    if (attempts.length === 0) return 0;

    const correct = attempts.filter(
      (attempt) => attempt.is_correct
    ).length;

    return Math.round((correct / attempts.length) * 100);
  };

  const quantitativeAccuracy =
    getCategoryAccuracy(quantitativeAttempts);

  const logicalAccuracy =
    getCategoryAccuracy(logicalAttempts);

  const verbalAccuracy =
    getCategoryAccuracy(verbalAttempts);

  // TOTAL PLACEMENT READINESS: MAXIMUM 110 POINTS
  const totalScore =
    cgpaScore +
    skillsScore +
    dsaScore +
    projectsScore +
    aptitudeScore;

  const placementReadiness = Math.min(
    Math.round((totalScore / 110) * 100),
    100
  );

  // LOADING SCREEN
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <div className="flex min-h-[80vh] items-center justify-center">
          <p className="text-slate-400">
            Loading your dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 py-12">
        {/* ERROR */}
        {message && (
          <div className="mb-6 rounded-lg bg-red-950 p-4 text-red-300">
            {message}
          </div>
        )}

        {/* HEADER */}
        <h1 className="text-4xl font-bold text-blue-500">
          Welcome back
          {profile?.full_name ? `, ${profile.full_name}` : ""} 👋
        </h1>

        <p className="mt-3 text-slate-400">
          Track your placement readiness, skills, DSA progress,
          aptitude, and projects from one place.
        </p>

        {/* PROFILE */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Your Profile</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-400">College</p>
              <p className="mt-1 font-medium">
                {profile?.college_name ?? "Not added"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Branch</p>
              <p className="mt-1 font-medium">
                {profile?.branch ?? "Not added"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Year of Study</p>
              <p className="mt-1 font-medium">
                {profile?.year_of_study
                  ? `${profile.year_of_study} Year`
                  : "Not added"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">CGPA</p>
              <p className="mt-1 font-medium">
                {profile?.cgpa ?? "Not added"}
              </p>
            </div>
          </div>
        </div>

        {/* DASHBOARD CARDS */}
        <div className="mt-8 grid gap-6 md:grid-cols-5">
          {/* CAREER */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Career Goal</h2>
            <p className="mt-3 text-2xl font-bold text-blue-500">
              {careerGoal?.primary_goal ?? "Not added"}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Target: {careerGoal?.target_role ?? "Not added"}
            </p>
          </div>

          {/* SKILLS */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Skills</h2>
            <p className="mt-3 text-4xl font-bold text-blue-500">
              {skillsCount}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Skills selected
            </p>
          </div>

          {/* DSA */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">DSA Progress 💻</h2>
            <p className="mt-3 text-4xl font-bold text-blue-500">
              {totalDsaSolved}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Problems solved
            </p>
            <div className="mt-4 flex gap-3 text-xs">
              <span className="text-emerald-400">
                Easy {easyCount}
              </span>
              <span className="text-amber-400">
                Medium {mediumCount}
              </span>
              <span className="text-red-400">
                Hard {hardCount}
              </span>
            </div>
            <a
              href="/dsa"
              className="mt-5 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              View DSA Progress →
            </a>
          </div>

          {/* PROJECTS */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Projects 🚀</h2>
            <p className="mt-3 text-4xl font-bold text-blue-500">
              {projectsCount}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Projects added
            </p>
            <p className="mt-4 text-sm text-slate-400">
              Score:{" "}
              <span className="font-semibold text-blue-400">
                {projectsScore} / 25
              </span>
            </p>
            <a
              href="/projects"
              className="mt-4 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              View Projects →
            </a>
          </div>

          {/* APTITUDE */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Aptitude 🧠</h2>
            <p className="mt-3 text-4xl font-bold text-blue-500">
              {aptitudeAccuracy}%
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Accuracy
            </p>
            <div className="mt-4 flex gap-3 text-xs">
              <span className="text-emerald-400">
                ✓ {aptitudeCorrect}
              </span>
              <span className="text-slate-400">
                / {aptitudeAttempted}
              </span>
            </div>
            <a
              href="/aptitude"
              className="mt-5 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Practice Aptitude →
            </a>
          </div>
        </div>

        {/* APTITUDE PROGRESS */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                🧠 Aptitude Progress
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Track your aptitude preparation and accuracy.
              </p>
            </div>
            <a
              href="/aptitude"
              className="text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Practice Now →
            </a>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                name: "Quantitative",
                accuracy: quantitativeAccuracy,
                attempted: quantitativeAttempts.length,
              },
              {
                name: "Logical Reasoning",
                accuracy: logicalAccuracy,
                attempted: logicalAttempts.length,
              },
              {
                name: "Verbal Ability",
                accuracy: verbalAccuracy,
                attempted: verbalAttempts.length,
              },
            ].map((category) => (
              <div
                key={category.name}
                className="rounded-lg border border-slate-800 bg-slate-950 p-5"
              >
                <p className="text-sm text-slate-400">
                  {category.name}
                </p>
                <p className="mt-2 text-3xl font-bold text-blue-500">
                  {category.accuracy}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {category.attempted} attempted
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${category.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-blue-900 bg-blue-950/20 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Overall Aptitude</p>
                <p className="mt-1 text-sm text-slate-400">
                  {aptitudeAttempted} questions attempted
                </p>
              </div>
              <p className="text-3xl font-bold text-blue-400">
                {aptitudeScore} / 10
              </p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${(aptitudeScore / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* PLACEMENT READINESS */}
        <div className="mt-8 rounded-xl border border-blue-900 bg-slate-900 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Placement Readiness
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Your overall preparation score
              </p>
            </div>
            <p className="text-5xl font-bold text-blue-500">
              {placementReadiness}%
            </p>
          </div>
          <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-700"
              style={{ width: `${placementReadiness}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {Math.round(totalScore)} / 110 points
          </p>
        </div>

        {/* PHASE 9: READINESS INTELLIGENCE */}
        <div className="mt-8 rounded-xl border border-violet-900/60 bg-slate-900 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                🧠 Readiness Intelligence
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                An analysis of your preparation using your current
                academic, skills, DSA, project, and aptitude data.
              </p>
            </div>

            {readinessIntelligence && (
              <div className="rounded-xl border border-violet-800 bg-violet-950/30 px-5 py-3 text-center">
                <p className="text-sm text-slate-400">
                  Readiness Score
                </p>
                <p className="text-3xl font-bold text-violet-400">
                  {readinessIntelligence.readiness.percentage}%
                </p>
                <p className="text-xs text-slate-500">
                  {readinessIntelligence.readiness.totalScore}/
                  {readinessIntelligence.readiness.maxScore} points
                </p>
              </div>
            )}
          </div>

          {!readinessIntelligence ? (
            <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-5">
              <p className="text-sm text-slate-400">
                {intelligenceError
                  ? `Readiness Intelligence could not be loaded: ${intelligenceError}`
                  : "Readiness Intelligence is currently unavailable."}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 rounded-lg border border-violet-700 px-4 py-2 text-sm font-medium text-violet-300 transition hover:bg-violet-950"
              >
                Refresh Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* PROFILE CONTEXT */}
              <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm text-slate-400">
                  Personalized career context
                </p>
                <p className="mt-1 font-semibold text-white">
                  {readinessIntelligence.profile.targetRole ||
                    readinessIntelligence.profile.careerGoal ||
                    "Career goal not added"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {readinessIntelligence.profile.branch ||
                    "Branch not added"}
                  {" · "}
                  {readinessIntelligence.profile.college ||
                    "College not added"}
                </p>
              </div>

              {/* STRONGEST AND FOCUS AREAS */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-5">
                  <p className="text-sm font-medium text-emerald-400">
                    💪 Strongest Area
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {readinessIntelligence.strongestArea.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {readinessIntelligence.strongestArea.score}/
                    {readinessIntelligence.strongestArea.maxScore} points
                  </p>
                </div>

                <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-5">
                  <p className="text-sm font-medium text-amber-400">
                    🎯 Main Focus Area
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {readinessIntelligence.weakestArea.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {readinessIntelligence.weakestArea.score}/
                    {readinessIntelligence.weakestArea.maxScore} points
                  </p>
                </div>
              </div>

              {/* CATEGORY ANALYSIS */}
              <div className="mt-6">
                <h3 className="font-semibold text-white">
                  Category Analysis
                </h3>
                <div className="mt-4 space-y-4">
                  {readinessIntelligence.categories.map((category) => {
                    const percentage =
                      category.maxScore > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (category.score / category.maxScore) * 100
                            )
                          )
                        : 0;

                    return (
                      <div key={category.key}>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-slate-200">
                            {category.name}
                          </span>
                          <span className="text-slate-400">
                            {category.score}/{category.maxScore} ·{" "}
                            {percentage}%
                          </span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-violet-500 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs capitalize text-slate-500">
                          {category.level.replace(/_/g, " ")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STRENGTHS */}
              <div className="mt-6">
                <h3 className="font-semibold text-white">
                  ✅ Your Strengths
                </h3>
                {readinessIntelligence.strengths.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {readinessIntelligence.strengths.map(
                      (strength, index) => (
                        <div
                          key={`strength-${index}`}
                          className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 p-3 text-sm text-slate-300"
                        >
                          {strength}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">
                    Keep building your profile to identify strengths.
                  </p>
                )}
              </div>

              {/* GAPS */}
              <div className="mt-6">
                <h3 className="font-semibold text-white">
                  📌 Areas to Improve
                </h3>
                {readinessIntelligence.gaps.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {readinessIntelligence.gaps.map((gap, index) => (
                      <div
                        key={`gap-${index}`}
                        className="rounded-lg border border-amber-900/40 bg-amber-950/10 p-3 text-sm text-slate-300"
                      >
                        {gap}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">
                    No major gaps were identified by the current scoring
                    rules.
                  </p>
                )}
              </div>

              {/* PRIORITIES */}
              <div className="mt-6">
                <h3 className="font-semibold text-white">
                  🚀 Recommended Priorities
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {readinessIntelligence.priorities.map(
                    (item, index) => (
                      <div
                        key={item.key}
                        className="rounded-lg border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-medium text-white">
                            {index + 1}. {item.area}
                          </h4>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              item.priority === "high"
                                ? "bg-red-950 text-red-300"
                                : item.priority === "medium"
                                  ? "bg-amber-950 text-amber-300"
                                  : "bg-emerald-950 text-emerald-300"
                            }`}
                          >
                            {item.priority === "high"
                              ? "High priority"
                              : item.priority === "medium"
                                ? "Medium priority"
                                : "Maintain"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          {item.action}
                        </p>
                        <p className="mt-3 text-xs text-slate-500">
                          Progress: {item.score}/{item.maxScore} points ·{" "}
                          {item.percentage}%
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* NEXT ACTION */}
              <div className="mt-6 rounded-xl border border-violet-800/70 bg-violet-950/20 p-5">
                <p className="text-sm font-semibold text-violet-300">
                  🎯 Your Next Action
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  {readinessIntelligence.nextAction}
                </p>
              </div>
            </>
          )}
        </div>

        {/* READINESS BREAKDOWN */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">
            Readiness Breakdown
          </h2>

          <div className="mt-6 space-y-6">
            {[
              {
                name: "CGPA",
                score: cgpaScore,
                max: 20,
                note: "",
              },
              {
                name: "Skills",
                score: skillsScore,
                max: 30,
                note: "",
              },
              {
                name: "DSA Progress",
                score: dsaScore,
                max: 25,
                note: "",
              },
              {
                name: "Projects",
                score: projectsScore,
                max: 25,
                note: `${projectsCount} project${projectsCount === 1 ? "" : "s"} added`,
              },
              {
                name: "Aptitude",
                score: aptitudeScore,
                max: 10,
                note: `${aptitudeAttempted} question${aptitudeAttempted === 1 ? "" : "s"} attempted${
                  aptitudeAttempted > 0
                    ? ` · ${aptitudeAccuracy}% accuracy`
                    : ""
                }`,
              },
            ].map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span>
                    {Math.round(item.score)} / {item.max}
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (item.score / item.max) * 100
                      )}%`,
                    }}
                  />
                </div>
                {item.note && (
                  <p className="mt-2 text-xs text-slate-500">
                    {item.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SMART PLACEMENT RECOMMENDATIONS */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <h2 className="text-xl font-semibold">
              🎯 Smart Placement Recommendations
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Vertex analyzes your current progress and recommends
              what you should focus on next.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {/* DSA */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💻</div>
                <div>
                  <h3 className="font-semibold">DSA Preparation</h3>
                  {totalDsaSolved < 5 ? (
                    <>
                      <p className="mt-2 text-sm text-slate-400">
                        You have solved {totalDsaSolved} problem
                        {totalDsaSolved === 1 ? "" : "s"}. Try solving{" "}
                        {5 - totalDsaSolved} more to reach your first
                        DSA milestone.
                      </p>
                      <a
                        href="/dsa"
                        className="mt-3 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
                      >
                        Practice DSA →
                      </a>
                    </>
                  ) : totalDsaSolved < 20 ? (
                    <>
                      <p className="mt-2 text-sm text-slate-400">
                        Good start! Keep solving DSA problems and focus
                        on Medium-level questions.
                      </p>
                      <a
                        href="/dsa"
                        className="mt-3 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
                      >
                        Continue DSA →
                      </a>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-400">
                      ✓ Strong DSA progress. Keep practicing consistently.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* APTITUDE */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🧠</div>
                <div>
                  <h3 className="font-semibold">
                    Aptitude Preparation
                  </h3>
                  {aptitudeAttempted === 0 ? (
                    <>
                      <p className="mt-2 text-sm text-slate-400">
                        You haven&apos;t attempted any aptitude questions
                        yet. Start practicing to improve your readiness.
                      </p>
                      <a
                        href="/aptitude"
                        className="mt-3 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
                      >
                        Start Aptitude →
                      </a>
                    </>
                  ) : aptitudeAccuracy < 60 ? (
                    <>
                      <p className="mt-2 text-sm text-slate-400">
                        Your current accuracy is {aptitudeAccuracy}%.
                        Practice more questions to strengthen your aptitude.
                      </p>
                      <a
                        href="/aptitude"
                        className="mt-3 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
                      >
                        Practice Aptitude →
                      </a>
                    </>
                  ) : aptitudeAccuracy < 80 ? (
                    <>
                      <p className="mt-2 text-sm text-slate-400">
                        Good progress at {aptitudeAccuracy}% accuracy.
                        Keep practicing to reach 80%+.
                      </p>
                      <a
                        href="/aptitude"
                        className="mt-3 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
                      >
                        Continue Aptitude →
                      </a>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-400">
                      ✓ Excellent aptitude performance. Keep practicing
                      consistently.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SKILLS */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🛠️</div>
                <div>
                  <h3 className="font-semibold">Technical Skills</h3>
                  {skillsCount < 5 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      You currently have {skillsCount} skill
                      {skillsCount === 1 ? "" : "s"}. Add more relevant
                      technical skills to strengthen your profile.
                    </p>
                  ) : skillsCount < 10 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Good foundation. Add more skills related to your
                      target role.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-400">
                      ✓ Your technical skill profile is looking strong.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* PROJECTS */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🚀</div>
                <div>
                  <h3 className="font-semibold">Projects</h3>
                  {projectsCount === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Add your first project to start building your
                      placement portfolio.
                    </p>
                  ) : projectsCount === 1 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Great start! Add one more project to strengthen
                      your portfolio.
                    </p>
                  ) : projectsCount < 3 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Good portfolio. Consider adding another strong
                      project with real-world impact.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-400">
                      ✓ Your project portfolio is strong.
                    </p>
                  )}
                  <a
                    href="/projects"
                    className="mt-3 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
                  >
                    Manage Projects →
                  </a>
                </div>
              </div>
            </div>

            {/* NEXT PRIORITY */}
            <div className="rounded-lg border border-blue-900 bg-blue-950/20 p-5">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🎯</div>
                <div>
                  <h3 className="font-semibold text-blue-400">
                    Your Next Priority
                  </h3>
                  {dsaScore < 10 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Focus on{" "}
                      <span className="font-semibold text-white">DSA</span>{" "}
                      first. Build problem-solving practice consistently.
                    </p>
                  ) : aptitudeScore < 6 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Focus on{" "}
                      <span className="font-semibold text-white">
                        Aptitude
                      </span>{" "}
                      next. Improve accuracy through regular practice.
                    </p>
                  ) : projectsScore < 16 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Focus on{" "}
                      <span className="font-semibold text-white">
                        Projects
                      </span>
                      . Build another meaningful project and document
                      its technologies and impact.
                    </p>
                  ) : skillsScore < 15 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Focus on{" "}
                      <span className="font-semibold text-white">
                        Technical Skills
                      </span>{" "}
                      related to your target role.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-400">
                      ✓ You&apos;re building a strong placement profile.
                      Keep improving all areas consistently.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <a
            href="/dsa"
            className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-700"
          >
            <h2 className="text-lg font-semibold">
              💻 Practice DSA
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Solve more problems and improve your DSA score.
            </p>
            <p className="mt-4 text-sm font-medium text-blue-400">
              Go to DSA →
            </p>
          </a>

          <a
            href="/aptitude"
            className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-700"
          >
            <h2 className="text-lg font-semibold">
              🧠 Practice Aptitude
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Improve quantitative, logical and verbal reasoning.
            </p>
            <p className="mt-4 text-sm font-medium text-blue-400">
              Go to Aptitude →
            </p>
          </a>

          <a
            href="/projects"
            className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-700"
          >
            <h2 className="text-lg font-semibold">
              🚀 Manage Projects
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Add projects and build your placement portfolio.
            </p>
            <p className="mt-4 text-sm font-medium text-blue-400">
              Go to Projects →
            </p>
          </a>
        </div>
      </section>
    </main>
  );
}