
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string | null;
  cgpa: number | null;
};

type CareerGoal = {
  primary_goal: string | null;
  target_role: string | null;
};

type DSAProblem = {
  difficulty: "Easy" | "Medium" | "Hard";
};

type SavedPlan = {
  id: string;
  recommendation: string;
  created_at: string;
};

export default function AIPlacementPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [message, setMessage] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [careerGoal, setCareerGoal] = useState<CareerGoal | null>(null);

  const [skillsCount, setSkillsCount] = useState(0);
  const [dsaProblems, setDsaProblems] = useState<DSAProblem[]>([]);
  const [projectsCount, setProjectsCount] = useState(0);

  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [showSavedPlans, setShowSavedPlans] = useState(false);

  // =====================================================
  // LOAD SAVED AI PLANS
  // =====================================================

  const loadSavedPlans = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("ai_placement_plans")
        .select("id, recommendation, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Load Placement Plans Error:", error);
        return;
      }

      setSavedPlans((data as SavedPlan[]) ?? []);
    } catch (error) {
      console.error("Saved plans error:", error);
    }
  };

  // =====================================================
  // LOAD USER DATA
  // =====================================================

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setMessage(
            "Please log in to use the AI Placement Assistant."
          );
          setLoading(false);
          return;
        }

        // -------------------------------------------------
        // PROFILE
        // -------------------------------------------------

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("full_name, cgpa")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        // -------------------------------------------------
        // CAREER GOAL
        // -------------------------------------------------

        const {
          data: goalData,
          error: goalError,
        } = await supabase
          .from("career_goals")
          .select("primary_goal, target_role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (goalError) {
          throw goalError;
        }

        // -------------------------------------------------
        // SKILLS
        // -------------------------------------------------

        const {
          count: skillsCountData,
          error: skillsError,
        } = await supabase
          .from("student_skills")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id);

        if (skillsError) {
          throw skillsError;
        }

        // -------------------------------------------------
        // DSA
        // -------------------------------------------------

        const {
          data: dsaData,
          error: dsaError,
        } = await supabase
          .from("dsa_problems")
          .select("difficulty")
          .eq("user_id", user.id);

        if (dsaError) {
          throw dsaError;
        }

        // -------------------------------------------------
        // PROJECTS
        // -------------------------------------------------

        const {
          count: projectsCountData,
          error: projectsError,
        } = await supabase
          .from("projects")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id);

        if (projectsError) {
          throw projectsError;
        }

        // -------------------------------------------------
        // SET STATE
        // -------------------------------------------------

        setProfile(profileData);
        setCareerGoal(goalData);
        setSkillsCount(skillsCountData ?? 0);
        setDsaProblems((dsaData as DSAProblem[]) ?? []);
        setProjectsCount(projectsCountData ?? 0);

        // -------------------------------------------------
        // LOAD SAVED PLANS
        // -------------------------------------------------

        await loadSavedPlans(user.id);

        setLoading(false);
      } catch (error) {
        console.error("Load AI Placement Error:", error);

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load placement data."
        );

        setLoading(false);
      }
    };

    loadData();
  }, []);

  // =====================================================
  // CALCULATE READINESS SCORE
  // =====================================================

  const cgpaScore = profile?.cgpa
    ? Math.min((profile.cgpa / 10) * 20, 20)
    : 0;

  const skillsScore = Math.min(skillsCount * 3, 30);

  const easyCount = dsaProblems.filter(
    (problem) => problem.difficulty === "Easy"
  ).length;

  const mediumCount = dsaProblems.filter(
    (problem) => problem.difficulty === "Medium"
  ).length;

  const hardCount = dsaProblems.filter(
    (problem) => problem.difficulty === "Hard"
  ).length;

  const totalDsaSolved = dsaProblems.length;

  const dsaPoints =
    easyCount +
    mediumCount * 2 +
    hardCount * 3;

  const dsaScore = Math.min(
    Math.round(dsaPoints / 2),
    25
  );

  const projectsScore = Math.min(
    projectsCount * 8,
    25
  );

  const placementReadiness = Math.min(
    Math.round(
      cgpaScore +
        skillsScore +
        dsaScore +
        projectsScore
    ),
    100
  );

  // =====================================================
  // SMART INSIGHTS
  // =====================================================

  const smartInsights = useMemo(() => {
    const areas = [
      {
        name: "CGPA",
        score: cgpaScore,
        max: 20,
      },
      {
        name: "Skills",
        score: skillsScore,
        max: 30,
      },
      {
        name: "DSA",
        score: dsaScore,
        max: 25,
      },
      {
        name: "Projects",
        score: projectsScore,
        max: 25,
      },
    ];

    const weakest = [...areas].sort((a, b) => {
      return (
        a.score / a.max -
        b.score / b.max
      );
    })[0];

    const strongest = [...areas].sort((a, b) => {
      return (
        b.score / b.max -
        a.score / a.max
      );
    })[0];

    let weakestMessage = "";

    if (weakest.name === "DSA") {
      weakestMessage =
        "DSA is currently your biggest gap. You have solved " +
        totalDsaSolved +
        " problem" +
        (totalDsaSolved === 1 ? "" : "s") +
        ". Start with Arrays, Strings, Searching, Sorting, and Hashing before moving to advanced topics.";
    } else if (weakest.name === "Skills") {
      weakestMessage =
        "Your technical skill score is currently " +
        skillsScore +
        "/30. Add practical skills related to your target role and use them in projects.";
    } else if (weakest.name === "Projects") {
      weakestMessage =
        "Projects are currently your biggest gap at " +
        projectsScore +
        "/25. Build at least one strong project that directly matches your target role.";
    } else {
      weakestMessage =
        "Your CGPA contributes " +
        Math.round(cgpaScore) +
        "/20 to readiness. Maintain your academic performance while improving technical preparation.";
    }

    const strongestMessage =
      strongest.name +
      " is currently your strongest readiness area at " +
      Math.round(strongest.score) +
      "/" +
      strongest.max +
      ".";

    let nextAction = "";

    if (weakest.name === "DSA") {
      nextAction =
        "Solve 2 DSA problems every day and gradually increase Medium-level problems.";
    } else if (weakest.name === "Skills") {
      nextAction =
        "Add the most important technical skills required for your target role and practice them through projects.";
    } else if (weakest.name === "Projects") {
      nextAction =
        "Build and deploy one recruiter-focused project related to your target role.";
    } else {
      nextAction =
        "Maintain your CGPA while putting more effort into technical preparation.";
    }

    return {
      weakest,
      strongest,
      weakestMessage,
      strongestMessage,
      nextAction,
    };
  }, [
    cgpaScore,
    skillsScore,
    dsaScore,
    projectsScore,
    totalDsaSolved,
  ]);

  // =====================================================
  // GENERATE AI PLACEMENT PLAN
  // =====================================================

  const generateRecommendation = async () => {
    try {
      setGenerating(true);
      setMessage("");
      setRecommendation("");

     const {
  data: { session },
} = await supabase.auth.getSession();

if (!session?.access_token) {
  setGenerating(false);
  setMessage("Your session has expired. Please log in again.");
  return;
}

const response = await fetch(
  "/api/ai-placement",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
          body: JSON.stringify({
            profile,
            careerGoal,

            skillsCount,

            totalDsaSolved,
            easyCount,
            mediumCount,
            hardCount,

            projectsCount,

            placementReadiness,

            cgpaScore,
            skillsScore,
            dsaScore,
            projectsScore,

            strongestArea:
              smartInsights.strongest.name,

            weakestArea:
              smartInsights.weakest.name,
          }),
        }
      );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        const text =
          await response.text();

        console.error(
          "AI Placement returned non-JSON:",
          text
        );

        throw new Error(
          "AI Placement API returned an invalid response. Check your terminal."
        );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to generate AI placement plan."
        );
      }

      const generatedRecommendation =
        data?.recommendation ||
        data?.answer ||
        data?.text ||
        "";

      if (
        typeof generatedRecommendation !==
          "string" ||
        !generatedRecommendation.trim()
      ) {
        throw new Error(
          "AI returned an empty placement plan."
        );
      }

      // -------------------------------------------------
      // SHOW RECOMMENDATION
      // -------------------------------------------------

      setRecommendation(
        generatedRecommendation
      );

      // -------------------------------------------------
      // SAVE TO SUPABASE
      // -------------------------------------------------

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (user) {
        const {
          error: saveError,
        } = await supabase
          .from("ai_placement_plans")
          .insert({
            user_id: user.id,
            recommendation:
              generatedRecommendation,
          });

        if (saveError) {
          console.error(
            "Save Placement Plan Error:",
            saveError
          );
        } else {
          await loadSavedPlans(
            user.id
          );
        }
      }
    } catch (error) {
      console.error(
        "AI Placement Error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate AI recommendation."
      );
    } finally {
      setGenerating(false);
    }
  };

  // =====================================================
  // LOADING SCREEN
  // =====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />

        <div className="flex min-h-[80vh] items-center justify-center">
          <p className="text-slate-400">
            Loading your placement profile...
          </p>
        </div>
      </main>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <section className="mx-auto max-w-5xl px-6 py-12">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="text-center">
          <div className="text-5xl">
            🤖
          </div>

          <h1 className="mt-4 text-4xl font-bold text-blue-500">
            AI Placement Assistant
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Vertex analyzes your actual placement
            progress and creates personalized
            recommendations for your career.
          </p>
        </div>

        {/* =================================================
            ERROR MESSAGE
        ================================================= */}

        {message && (
          <div className="mt-8 rounded-lg border border-red-900 bg-red-950 p-4 text-red-300">
            {message}
          </div>
        )}

        {/* =================================================
            READINESS SCORE
        ================================================= */}

        <div className="mt-10 rounded-xl border border-blue-900 bg-slate-900 p-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-xl font-semibold">
                Your Placement Readiness
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Based on your current Vertex profile.
              </p>
            </div>

            <div className="text-5xl font-bold text-blue-500">
              {placementReadiness}%
            </div>

          </div>

          <div className="mt-6 h-4 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-700"
              style={{
                width:
                  placementReadiness +
                  "%",
              }}
            />
          </div>

        </div>

        {/* =================================================
            SCORE CARDS
        ================================================= */}

        <div className="mt-8 grid gap-4 md:grid-cols-4">

          {/* CGPA */}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              CGPA
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-500">
              {profile?.cgpa ?? "N/A"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {Math.round(cgpaScore)} / 20
            </p>
          </div>

          {/* SKILLS */}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Skills
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-500">
              {skillsCount}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {skillsScore} / 30
            </p>
          </div>

          {/* DSA */}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              DSA
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-500">
              {totalDsaSolved}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {dsaScore} / 25
            </p>
          </div>

          {/* PROJECTS */}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Projects
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-500">
              {projectsCount}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {projectsScore} / 25
            </p>
          </div>

        </div>

        {/* =================================================
            SMART INSIGHTS
        ================================================= */}

        <div className="mt-8 rounded-xl border border-amber-900 bg-slate-900 p-6">

          <div className="flex items-center gap-3">

            <span className="text-3xl">
              💡
            </span>

            <div>
              <h2 className="text-xl font-semibold text-amber-400">
                Smart Insights
              </h2>

              <p className="text-sm text-slate-400">
                Automatically generated from your
                readiness scores.
              </p>
            </div>

          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            {/* STRONGEST */}

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">

              <p className="text-sm text-slate-500">
                Strongest Area
              </p>

              <p className="mt-2 text-xl font-bold text-green-400">
                {smartInsights.strongest.name}
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {smartInsights.strongestMessage}
              </p>

            </div>

            {/* BIGGEST GAP */}

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">

              <p className="text-sm text-slate-500">
                Biggest Gap
              </p>

              <p className="mt-2 text-xl font-bold text-red-400">
                {smartInsights.weakest.name}
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {smartInsights.weakestMessage}
              </p>

            </div>

            {/* NEXT ACTION */}

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">

              <p className="text-sm text-slate-500">
                Next Action
              </p>

              <p className="mt-2 text-xl font-bold text-blue-400">
                Focus Now
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {smartInsights.nextAction}
              </p>

            </div>

          </div>
        </div>

        {/* =================================================
            CAREER FOCUS
        ================================================= */}

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">

          <h2 className="text-xl font-semibold">
            🎯 Career Focus
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">

            <div>
              <p className="text-sm text-slate-400">
                Career Goal
              </p>

              <p className="mt-1 text-lg font-semibold text-blue-400">
                {careerGoal?.primary_goal ??
                  "Not specified"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">
                Target Role
              </p>

              <p className="mt-1 text-lg font-semibold text-blue-400">
                {careerGoal?.target_role ??
                  "Not specified"}
              </p>
            </div>

          </div>
        </div>

        {/* =================================================
            GENERATE PLAN
        ================================================= */}

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">

          <div className="text-4xl">
            ✨
          </div>

          <h2 className="mt-3 text-2xl font-bold">
            Get Your Personalized Plan
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
            Vertex AI will analyze your current
            progress, readiness scores, career goal,
            and target role.
          </p>

          <button
            onClick={
              generateRecommendation
            }
            disabled={generating}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating
              ? "🤖 Analyzing your profile..."
              : "✨ Generate My Placement Plan"}
          </button>

        </div>

        {/* =================================================
            AI RECOMMENDATION
        ================================================= */}

        {recommendation && (
          <div className="mt-8 rounded-xl border border-blue-900 bg-slate-900 p-6">

            <div className="flex items-center gap-3">

              <span className="text-3xl">
                🤖
              </span>

              <h2 className="text-xl font-semibold text-blue-400">
                Vertex AI Recommendation
              </h2>

            </div>

            <div className="mt-6 whitespace-pre-wrap leading-7 text-slate-300">
              {recommendation}
            </div>

          </div>
        )}

        {/* =================================================
            SAVED PLANS
        ================================================= */}

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-xl font-semibold">
                📚 Saved Placement Plans
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Your previously generated AI recommendations.
              </p>

            </div>

            <button
              onClick={() =>
                setShowSavedPlans(
                  !showSavedPlans
                )
              }
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold transition hover:border-blue-600"
            >
              {showSavedPlans
                ? "Hide Plans"
                : "View Plans"}
            </button>

          </div>

          {showSavedPlans && (
            <div className="mt-6 space-y-4">

              {savedPlans.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No saved placement plans yet.
                </p>
              ) : (
                savedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-5"
                  >

                    <p className="text-xs text-slate-500">
                      {new Date(
                        plan.created_at
                      ).toLocaleString()}
                    </p>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {plan.recommendation}
                    </p>

                  </div>
                ))
              )}

            </div>
          )}

        </div>

        {/* =================================================
            QUICK ACTIONS
        ================================================= */}

        <div className="mt-8 grid gap-4 md:grid-cols-3">

          <Link
            href="/dsa"
            className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-blue-700"
          >

            <div className="text-2xl">
              💻
            </div>

            <h3 className="mt-3 font-semibold">
              Practice DSA
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Improve your problem-solving score.
            </p>

          </Link>

          <Link
            href="/profile"
            className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-blue-700"
          >

            <div className="text-2xl">
              🛠️
            </div>

            <h3 className="mt-3 font-semibold">
              Improve Skills
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Add technical skills to your profile.
            </p>

          </Link>

          <Link
            href="/projects"
            className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-blue-700"
          >

            <div className="text-2xl">
              🚀
            </div>

            <h3 className="mt-3 font-semibold">
              Build Projects
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Strengthen your project portfolio.
            </p>

          </Link>

        </div>

      </section>
    </main>
  );
}
