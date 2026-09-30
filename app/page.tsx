
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type StudentProfile = {
  college: string;
  branch: string;
  semester: number;
  target_role: string;
  company_tier: string;
  skill_level: string;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  const [dsaCount, setDsaCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [skillCount, setSkillCount] = useState(0);
  const [interviewScore, setInterviewScore] = useState(0);

  async function loadDashboard() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Student";

      setUserName(name);

      // --------------------------------------------------
      // STUDENT PROFILE
      // --------------------------------------------------

      const { data: profileData } = await supabase
        .from("student_profiles")
        .select(
          "college, branch, semester, target_role, company_tier, skill_level"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as StudentProfile);
      }

      // --------------------------------------------------
      // DSA COUNT
      // --------------------------------------------------

      const { count: dsa } = await supabase
        .from("dsa_problems")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("user_id", user.id);

      setDsaCount(dsa ?? 0);

      // --------------------------------------------------
      // PROJECT COUNT
      // --------------------------------------------------

      const { count: projects } = await supabase
        .from("projects")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("user_id", user.id);

      setProjectCount(projects ?? 0);

      // --------------------------------------------------
      // SKILL COUNT
      // --------------------------------------------------

      const { count: skills } = await supabase
        .from("student_skills")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("user_id", user.id);

      setSkillCount(skills ?? 0);

      // --------------------------------------------------
      // AI INTERVIEW SCORE
      // --------------------------------------------------

      const { data: interviews } = await supabase
        .from("ai_interview_sessions")
        .select("percentage")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

      if (interviews && interviews.length > 0) {
        setInterviewScore(Number(interviews[0].percentage) || 0);
      }
    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // --------------------------------------------------
  // PROFILE COMPLETION
  // --------------------------------------------------

  const profileComplete = profile !== null;

  // --------------------------------------------------
  // ROADMAP PROGRESS
  // --------------------------------------------------

  const roadmapSteps = [
    profileComplete,
    skillCount >= 5,
    dsaCount >= 5,
    projectCount >= 1,
    interviewScore >= 70,
  ];

  const completedSteps = roadmapSteps.filter(Boolean).length;

  const roadmapProgress = Math.round(
    (completedSteps / roadmapSteps.length) * 100
  );

  // --------------------------------------------------
  // OVERALL READINESS
  // --------------------------------------------------

  const dsaProgress = Math.min((dsaCount / 50) * 100, 100);
  const projectProgress = Math.min((projectCount / 2) * 100, 100);
  const skillProgress = Math.min((skillCount / 10) * 100, 100);

  const readiness = Math.round(
    profileComplete
      ? dsaProgress * 0.25 +
          projectProgress * 0.2 +
          skillProgress * 0.2 +
          interviewScore * 0.25 +
          roadmapProgress * 0.1
      : 0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />

        <div className="flex min-h-[calc(100vh-73px)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
            <p className="mt-4 text-slate-400">
              Loading your Vertex dashboard...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // NO PROFILE
  // --------------------------------------------------

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />

        <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-5xl flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-2 text-sm text-blue-300">
            🚀 Welcome to Vertex
          </div>

          <h1 className="text-4xl font-bold sm:text-6xl">
            Welcome, {userName}! 👋
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
            Build your personalized path from classroom learning to
            placement readiness.
          </p>

          <Link
            href="/profile"
            className="mt-8 rounded-xl bg-blue-600 px-7 py-3 font-semibold transition hover:bg-blue-700"
          >
            Create Your Career Profile →
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* ------------------------------------------------ */}
        {/* HEADER */}
        {/* ------------------------------------------------ */}

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-medium text-blue-400">
                YOUR CAREER COMMAND CENTER
              </p>

              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                Welcome back, {userName}! 👋
              </h1>

              <p className="mt-3 max-w-2xl text-slate-400">
                Track your journey from curriculum to skills, projects,
                interviews, and placement readiness.
              </p>
            </div>

            <Link
              href="/roadmap"
              className="rounded-xl bg-blue-600 px-6 py-3 text-center font-semibold transition hover:bg-blue-700"
            >
              View My Roadmap →
            </Link>
          </div>
        </section>

        {/* ------------------------------------------------ */}
        {/* PROFILE */}
        {/* ------------------------------------------------ */}

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Your Career Profile</h2>

            <Link
              href="/profile"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Edit Profile
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard
              title="College"
              value={profile.college}
              icon="🎓"
            />

            <InfoCard
              title="Branch"
              value={profile.branch}
              icon="💻"
            />

            <InfoCard
              title="Semester"
              value={`Semester ${profile.semester}`}
              icon="📚"
            />

            <InfoCard
              title="Target Role"
              value={profile.target_role}
              icon="🎯"
            />

            <InfoCard
              title="Company Tier"
              value={profile.company_tier}
              icon="🏢"
            />

            <InfoCard
              title="Skill Level"
              value={profile.skill_level}
              icon="⚡"
            />
          </div>
        </section>

        {/* ------------------------------------------------ */}
        {/* READINESS */}
        {/* ------------------------------------------------ */}

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">
            Placement Readiness
          </h2>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
            <div className="flex flex-col items-center gap-8 md:flex-row">
              <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full border-8 border-blue-500/30">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-400">
                    {readiness}%
                  </div>

                  <div className="text-xs text-slate-500">
                    READY
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-2xl font-bold">
                  {readiness >= 80
                    ? "Excellent progress! 🔥"
                    : readiness >= 60
                    ? "You're getting placement ready! 🚀"
                    : readiness >= 40
                    ? "Good start — keep building! 💪"
                    : "Let's start your placement journey! 🎯"}
                </h3>

                <p className="mt-2 text-slate-400">
                  Your score combines your DSA practice, technical
                  skills, projects, AI interview performance, and
                  roadmap progress.
                </p>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${readiness}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ */}
        {/* STATS */}
        {/* ------------------------------------------------ */}

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">
            Your Progress
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="DSA Problems"
              value={dsaCount}
              subtitle="Target: 50"
              icon="🧠"
              href="/dsa"
            />

            <StatCard
              title="Technical Skills"
              value={skillCount}
              subtitle="Target: 10"
              icon="⚙️"
              href="/profile"
            />

            <StatCard
              title="Projects"
              value={projectCount}
              subtitle="Target: 2"
              icon="🚀"
              href="/projects"
            />

            <StatCard
              title="AI Interview"
              value={`${interviewScore}%`}
              subtitle="Latest score"
              icon="🎤"
              href="/ai-interview"
            />
          </div>
        </section>

        {/* ------------------------------------------------ */}
        {/* ROADMAP */}
        {/* ------------------------------------------------ */}

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Career Roadmap
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Personalized for your target role.
              </p>
            </div>

            <Link
              href="/roadmap"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Open Roadmap →
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                Roadmap Progress
              </span>

              <span className="font-bold text-blue-400">
                {roadmapProgress}%
              </span>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${roadmapProgress}%` }}
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <RoadmapItem
                title="Profile"
                complete={profileComplete}
              />

              <RoadmapItem
                title="Skills"
                complete={skillCount >= 5}
              />

              <RoadmapItem
                title="DSA"
                complete={dsaCount >= 5}
              />

              <RoadmapItem
                title="Projects"
                complete={projectCount >= 1}
              />

              <RoadmapItem
                title="AI Interview"
                complete={interviewScore >= 70}
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ */}
        {/* QUICK ACTIONS */}
        {/* ------------------------------------------------ */}

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">
            Continue Your Preparation
          </h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <ActionCard
              href="/roadmap"
              icon="🗺️"
              title="My Roadmap"
              description="Follow your personalized placement plan."
            />

            <ActionCard
              href="/dsa"
              icon="🧠"
              title="Practice DSA"
              description="Improve your problem-solving skills."
            />

            <ActionCard
              href="/projects"
              icon="🚀"
              title="Build Projects"
              description="Create projects that strengthen your profile."
            />

            <ActionCard
              href="/ai-interview"
              icon="🎤"
              title="AI Mock Interview"
              description="Practice real interview questions with AI."
            />
          </div>
        </section>

        {/* ------------------------------------------------ */}
        {/* CAREER MESSAGE */}
        {/* ------------------------------------------------ */}

        <section className="mt-10 rounded-3xl border border-blue-500/20 bg-blue-500/5 p-8 text-center">
          <h2 className="text-2xl font-bold">
            Curriculum → Skills → Practice → Projects → Interviews
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Vertex is designed to turn your college learning into
            measurable placement preparation.
          </p>
        </section>
      </div>
    </main>
  );
}

/* ======================================================
   INFO CARD
====================================================== */

function InfoCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="text-2xl">{icon}</div>

      <p className="mt-3 text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-1 font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}

/* ======================================================
   STAT CARD
====================================================== */

function StatCard({
  title,
  value,
  subtitle,
  icon,
  href,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-blue-500/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>

        <span className="text-slate-600 transition group-hover:text-blue-400">
          →
        </span>
      </div>

      <p className="mt-5 text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-1 text-3xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-600">
        {subtitle}
      </p>
    </Link>
  );
}

/* ======================================================
   ROADMAP ITEM
====================================================== */

function RoadmapItem({
  title,
  complete,
}: {
  title: string;
  complete: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        complete
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-slate-800 bg-slate-950"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            complete
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-slate-800 text-slate-500"
          }`}
        >
          {complete ? "✓" : "○"}
        </div>

        <div>
          <p className="font-medium">{title}</p>

          <p className="text-xs text-slate-500">
            {complete ? "Completed" : "Not started"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   ACTION CARD
====================================================== */

function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-blue-500/40"
    >
      <div className="text-3xl">{icon}</div>

      <h3 className="mt-4 font-bold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {description}
      </p>
    </Link>
  );
}
