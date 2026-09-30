"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

// ======================================================
// TYPES
// ======================================================

type StudentProfile = {
  university: string;
  college: string;
  branch: string;
  semester: number;
  target_role: string;
  company_tier: string;
  skill_level: string;
};

type RoadmapProfile = {
  college: string | null;
  branch: string | null;
  semester: number | string | null;
  semester_number: number | string | null;
  target_role: string | null;
  company_tier: string | null;
  skill_level: string | null;
  universities:
    | { name: string }
    | { name: string }[]
    | null;
  colleges:
    | { name: string; city: string }
    | { name: string; city: string }[]
    | null;
  academic_programs:
    | { name: string; degree: string }
    | { name: string; degree: string }[]
    | null;
};

type RoadmapItem = {
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  progress: string;
  href: string;
};

type CareerStage = {
  title: string;
  description: string;
  icon: string;
  href: string;
};

type AIWeek = {
  week: number;
  title: string;
  goal: string;
  topics: string[];
  tasks: string[];
  dsa: string[];
  project: string;
  priority: "High" | "Medium" | "Low";
};

type AIResponse = {
  summary: string;
  readiness_focus: string;
  weeks: AIWeek[];
};

// ======================================================
// SUPABASE LOCAL TYPE FIX
// ======================================================

type SupabaseQueryResult = {
  data: unknown;
  error: { message: string } | null;
  count: number | null;
};

type SupabaseQuery = PromiseLike<SupabaseQueryResult> & {
  select(
    columns?: string,
    options?: { count?: "exact"; head?: boolean }
  ): SupabaseQuery;
  eq(column: string, value: string): SupabaseQuery;
  maybeSingle(): SupabaseQuery;
};

const db = supabase as unknown as {
  from(table: string): SupabaseQuery;
};

// ======================================================
// ROLE BASED ROADMAP
// ======================================================

const roleRoadmaps: Record<string, CareerStage[]> = {
  "Full Stack Developer": [
    {
      title: "Master Programming Fundamentals",
      description:
        "Strengthen JavaScript, TypeScript, programming fundamentals and problem-solving.",
      icon: "💻",
      href: "/dsa",
    },
    {
      title: "Frontend Development",
      description:
        "Learn HTML, CSS, JavaScript, React and modern frontend development.",
      icon: "🎨",
      href: "/projects",
    },
    {
      title: "Backend Development",
      description:
        "Learn APIs, authentication, server-side development and backend architecture.",
      icon: "⚙️",
      href: "/projects",
    },
    {
      title: "Databases & SQL",
      description:
        "Understand relational databases, SQL queries, schema design and database integration.",
      icon: "🗄️",
      href: "/projects",
    },
    {
      title: "Build a Full-Stack Project",
      description:
        "Build and deploy a meaningful project demonstrating frontend, backend and database skills.",
      icon: "🚀",
      href: "/projects",
    },
    {
      title: "DSA Interview Preparation",
      description:
        "Practice arrays, strings, linked lists, stacks, queues, trees, graphs and algorithms.",
      icon: "🧠",
      href: "/dsa",
    },
    {
      title: "Resume & Portfolio",
      description:
        "Create a role-focused resume and showcase your strongest projects and technical skills.",
      icon: "📄",
      href: "/profile",
    },
    {
      title: "AI Mock Interviews",
      description:
        "Practice technical and behavioral questions and improve your interview performance.",
      icon: "🎤",
      href: "/ai-interview",
    },
  ],

  "Frontend Developer": [
    {
      title: "HTML & CSS",
      description:
        "Build strong fundamentals in semantic HTML, CSS, responsive design and accessibility.",
      icon: "🎨",
      href: "/projects",
    },
    {
      title: "JavaScript & TypeScript",
      description:
        "Master modern JavaScript, TypeScript, ES6+, asynchronous programming and DOM concepts.",
      icon: "⚡",
      href: "/dsa",
    },
    {
      title: "React & Next.js",
      description:
        "Build component-based applications using React, Next.js, hooks and modern patterns.",
      icon: "⚛️",
      href: "/projects",
    },
    {
      title: "Frontend APIs",
      description:
        "Learn REST APIs, authentication, API integration, loading states and error handling.",
      icon: "🔌",
      href: "/projects",
    },
    {
      title: "Build Frontend Projects",
      description:
        "Create responsive real-world projects that demonstrate your frontend development skills.",
      icon: "🚀",
      href: "/projects",
    },
    {
      title: "DSA Preparation",
      description:
        "Develop problem-solving skills with structured Data Structures and Algorithms practice.",
      icon: "🧠",
      href: "/dsa",
    },
    {
      title: "Resume & Portfolio",
      description:
        "Showcase your best frontend projects, skills and measurable achievements.",
      icon: "📄",
      href: "/profile",
    },
    {
      title: "AI Mock Interviews",
      description:
        "Practice frontend and behavioral interview questions before placement drives.",
      icon: "🎤",
      href: "/ai-interview",
    },
  ],

  "Backend Developer": [
    {
      title: "Programming Fundamentals",
      description:
        "Strengthen programming, object-oriented concepts and problem-solving fundamentals.",
      icon: "💻",
      href: "/dsa",
    },
    {
      title: "Backend Language",
      description:
        "Develop strong skills in Node.js, Java, Python or another backend programming ecosystem.",
      icon: "⚙️",
      href: "/projects",
    },
    {
      title: "REST APIs",
      description:
        "Learn HTTP, REST architecture, authentication, validation and API design.",
      icon: "🔌",
      href: "/projects",
    },
    {
      title: "Databases",
      description:
        "Master SQL, database design, relationships, indexing and practical data management.",
      icon: "🗄️",
      href: "/projects",
    },
    {
      title: "Backend Project",
      description:
        "Build and deploy an API-driven backend project with authentication and database integration.",
      icon: "🚀",
      href: "/projects",
    },
    {
      title: "DSA Preparation",
      description:
        "Practice core DSA topics and common software engineering interview patterns.",
      icon: "🧠",
      href: "/dsa",
    },
    {
      title: "Resume & Portfolio",
      description:
        "Highlight backend projects, APIs, databases and measurable technical achievements.",
      icon: "📄",
      href: "/profile",
    },
    {
      title: "AI Mock Interviews",
      description:
        "Practice backend, system design and behavioral interview questions.",
      icon: "🎤",
      href: "/ai-interview",
    },
  ],

  "Software Engineer": [
    {
      title: "Programming Fundamentals",
      description:
        "Build strong programming, object-oriented programming and problem-solving fundamentals.",
      icon: "💻",
      href: "/dsa",
    },
    {
      title: "Data Structures",
      description:
        "Master arrays, strings, linked lists, stacks, queues, trees, heaps and graphs.",
      icon: "🌳",
      href: "/dsa",
    },
    {
      title: "Algorithms",
      description:
        "Practice sorting, searching, recursion, dynamic programming and graph algorithms.",
      icon: "🧠",
      href: "/dsa",
    },
    {
      title: "Software Development",
      description:
        "Learn APIs, databases, Git, testing, debugging and modern software development practices.",
      icon: "⚙️",
      href: "/projects",
    },
    {
      title: "Build Strong Projects",
      description:
        "Create projects that demonstrate engineering ability and practical problem solving.",
      icon: "🚀",
      href: "/projects",
    },
    {
      title: "Resume & Portfolio",
      description:
        "Create a focused software engineering resume with measurable achievements.",
      icon: "📄",
      href: "/profile",
    },
    {
      title: "AI Mock Interviews",
      description:
        "Practice technical, coding and behavioral interview questions.",
      icon: "🎤",
      href: "/ai-interview",
    },
    {
      title: "Placement Readiness",
      description:
        "Review your overall preparation and identify the final gaps before applying.",
      icon: "🏆",
      href: "/ai-placement",
    },
  ],

  "Data Analyst": [
    {
      title: "Excel & Data Fundamentals",
      description:
        "Learn spreadsheets, data cleaning, formulas, pivot tables and basic analysis.",
      icon: "📊",
      href: "/projects",
    },
    {
      title: "SQL",
      description:
        "Master SQL queries, joins, aggregations, subqueries and analytical functions.",
      icon: "🗄️",
      href: "/projects",
    },
    {
      title: "Python for Data Analysis",
      description:
        "Learn Python and libraries commonly used for data analysis and manipulation.",
      icon: "🐍",
      href: "/projects",
    },
    {
      title: "Data Visualization",
      description:
        "Create meaningful dashboards and visualizations to communicate insights.",
      icon: "📈",
      href: "/projects",
    },
    {
      title: "Build Data Projects",
      description:
        "Create practical analytics projects using real-world datasets.",
      icon: "🚀",
      href: "/projects",
    },
    {
      title: "Aptitude & Problem Solving",
      description:
        "Strengthen quantitative reasoning and analytical thinking for placement tests.",
      icon: "🧠",
      href: "/dsa",
    },
    {
      title: "Resume & Portfolio",
      description:
        "Showcase your dashboards, analytics projects and measurable business insights.",
      icon: "📄",
      href: "/profile",
    },
    {
      title: "AI Mock Interviews",
      description:
        "Practice SQL, analytics and behavioral interview questions.",
      icon: "🎤",
      href: "/ai-interview",
    },
  ],

  "Data Scientist": [
    {
      title: "Python Programming",
      description:
        "Build strong Python programming and problem-solving skills.",
      icon: "🐍",
      href: "/dsa",
    },
    {
      title: "Statistics & Mathematics",
      description:
        "Learn probability, statistics, linear algebra and mathematical foundations.",
      icon: "📐",
      href: "/dsa",
    },
    {
      title: "SQL & Data Handling",
      description:
        "Master SQL and techniques for collecting, cleaning and preparing data.",
      icon: "🗄️",
      href: "/projects",
    },
    {
      title: "Machine Learning",
      description:
        "Learn supervised learning, unsupervised learning, model evaluation and feature engineering.",
      icon: "🤖",
      href: "/projects",
    },
    {
      title: "Data Science Projects",
      description:
        "Build end-to-end projects demonstrating your machine learning and analytical skills.",
      icon: "🚀",
      href: "/projects",
    },
    {
      title: "DSA & Problem Solving",
      description:
        "Maintain strong algorithmic thinking for technical interviews.",
      icon: "🧠",
      href: "/dsa",
    },
    {
      title: "Resume & Portfolio",
      description:
        "Present your strongest data science projects, skills and measurable results.",
      icon: "📄",
      href: "/profile",
    },
    {
      title: "AI Mock Interviews",
      description:
        "Practice machine learning, statistics and behavioral interview questions.",
      icon: "🎤",
      href: "/ai-interview",
    },
  ],
};

const defaultRoadmap: CareerStage[] = [
  {
    title: "Build Programming Fundamentals",
    description:
      "Strengthen programming concepts, problem solving and computer science fundamentals.",
    icon: "💻",
    href: "/dsa",
  },
  {
    title: "Build Technical Skills",
    description:
      "Develop the technical skills required for your target career.",
    icon: "🛠️",
    href: "/projects",
  },
  {
    title: "Practice DSA",
    description:
      "Solve Data Structures and Algorithms problems consistently.",
    icon: "🧠",
    href: "/dsa",
  },
  {
    title: "Build Projects",
    description:
      "Create meaningful projects that demonstrate your technical abilities.",
    icon: "🚀",
    href: "/projects",
  },
  {
    title: "Prepare Your Resume",
    description:
      "Create a professional resume focused on your target role.",
    icon: "📄",
    href: "/profile",
  },
  {
    title: "Practice AI Interviews",
    description:
      "Practice technical and behavioral interview questions.",
    icon: "🎤",
    href: "/ai-interview",
  },
  {
    title: "Check Placement Readiness",
    description:
      "Evaluate your preparation and identify your remaining gaps.",
    icon: "🏆",
    href: "/ai-placement",
  },
];

// ======================================================
// HELPERS
// ======================================================

function getSingleRelation<T>(
  relation: T | T[] | null | undefined
): T | null {
  if (!relation) return null;

  return Array.isArray(relation)
    ? relation[0] ?? null
    : relation;
}

// ======================================================
// PAGE
// ======================================================

export default function RoadmapPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [studentProfile, setStudentProfile] =
    useState<StudentProfile | null>(null);

  const [dsaCount, setDsaCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [skillsCount, setSkillsCount] = useState(0);

  const [aiRoadmap, setAiRoadmap] =
    useState<AIResponse | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // ====================================================
  // LOAD DATA
  // ====================================================

  useEffect(() => {
    const loadRoadmap = async () => {
      try {
        setLoading(true);
        setMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setMessage(
            "Please log in to view your personalized roadmap."
          );
          return;
        }

        // ----------------------------------------------
        // PROFILE
        // ----------------------------------------------

        const { data, error: profileError } = await db
          .from("student_profiles")
          .select(`
            college,
            branch,
            semester,
            semester_number,
            target_role,
            company_tier,
            skill_level,
            universities (
              name
            ),
            colleges (
              name,
              city
            ),
            academic_programs (
              name,
              degree
            )
          `)
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            "PROFILE ERROR:",
            profileError
          );

          setMessage(profileError.message);
          return;
        }

        if (!data) {
          setMessage(
            "Please complete your Career Profile before viewing your personalized roadmap."
          );
          return;
        }

        const profile = data as RoadmapProfile;

        const university = getSingleRelation(
          profile.universities
        );

        const college = getSingleRelation(
          profile.colleges
        );

        const academicProgram = getSingleRelation(
          profile.academic_programs
        );

        setStudentProfile({
          university:
            university?.name ??
            "University not selected",

          college:
            college?.name ??
            profile.college ??
            "College not selected",

          branch:
            academicProgram?.name ??
            profile.branch ??
            "Branch not selected",

          semester: Number(
            profile.semester_number ??
              profile.semester ??
              0
          ),

          target_role:
            profile.target_role ??
            "Career Role",

          company_tier:
            profile.company_tier ??
            "Not selected",

          skill_level:
            profile.skill_level ??
            "Beginner",
        });

        // ----------------------------------------------
        // DSA
        // ----------------------------------------------

        const {
          count: dsaCountData,
          error: dsaError,
        } = await db
          .from("dsa_problems")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id);

        if (dsaError) {
          console.error(
            "DSA COUNT ERROR:",
            dsaError
          );
        } else {
          setDsaCount(dsaCountData ?? 0);
        }

        // ----------------------------------------------
        // PROJECTS
        // ----------------------------------------------

        const {
          count: projectCount,
          error: projectError,
        } = await db
          .from("projects")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id);

        if (projectError) {
          console.error(
            "PROJECT COUNT ERROR:",
            projectError
          );
        } else {
          setProjectsCount(
            projectCount ?? 0
          );
        }

        // ----------------------------------------------
        // SKILLS
        // ----------------------------------------------

        const {
          count: skillsCountData,
          error: skillsError,
        } = await db
          .from("student_skills")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id);

        if (skillsError) {
          console.error(
            "SKILLS COUNT ERROR:",
            skillsError
          );
        } else {
          setSkillsCount(
            skillsCountData ?? 0
          );
        }
      } catch (error) {
        console.error(
          "ROADMAP ERROR:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "Something went wrong while loading your roadmap."
        );
      } finally {
        setLoading(false);
      }
    };

    loadRoadmap();
  }, []);

  // ====================================================
  // GENERATE AI ROADMAP
  // ====================================================

  const generateAIRoadmap = async () => {
    if (!studentProfile) return;

    try {
      setAiLoading(true);
      setAiError("");

      const {
  data: { session },
} = await supabase.auth.getSession();

if (!session?.access_token) {
  throw new Error(
    "Your session has expired. Please log in again."
  );
}

const response = await fetch("/api/ai-roadmap", {
  method: "POST",

  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },

  body: JSON.stringify({
    profile: studentProfile,
    progress: {
      dsa: dsaCount,
      projects: projectsCount,
      skills: skillsCount,
    },
  }),
});

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to generate AI roadmap."
        );
      }

      setAiRoadmap(result);
    } catch (error) {
      console.error(
        "AI ROADMAP ERROR:",
        error
      );

      setAiError(
        error instanceof Error
          ? error.message
          : "Unable to generate AI roadmap."
      );
    } finally {
      setAiLoading(false);
    }
  };

  // ====================================================
  // STATIC ROADMAP
  // ====================================================

  const careerStages = useMemo(() => {
    if (!studentProfile) {
      return defaultRoadmap;
    }

    return (
      roleRoadmaps[
        studentProfile.target_role
      ] ?? defaultRoadmap
    );
  }, [studentProfile]);

  // ====================================================
  // PROGRESS
  // ====================================================

  const roadmapItems: RoadmapItem[] =
    useMemo(() => {
      return careerStages.map(
        (stage) => {
          let completed = false;
          let progress = "Not started";

          const title =
            stage.title.toLowerCase();

          if (
            title.includes("dsa") ||
            title.includes("data structures") ||
            title.includes("algorithms") ||
            title.includes("problem solving") ||
            title.includes("aptitude")
          ) {
            completed = dsaCount >= 5;

            progress =
              dsaCount >= 5
                ? `${dsaCount} problems solved`
                : `${dsaCount}/5 problems`;
          } else if (
            title.includes("project")
          ) {
            completed =
              projectsCount >= 1;

            progress =
              projectsCount >= 1
                ? `${projectsCount} project${
                    projectsCount > 1
                      ? "s"
                      : ""
                  } added`
                : "Add your first project";
          } else if (
            title.includes("skill") ||
            title.includes("programming")
          ) {
            completed =
              skillsCount >= 5;

            progress =
              skillsCount >= 5
                ? `${skillsCount} skills added`
                : `${skillsCount}/5 skills`;
          }

          return {
            ...stage,
            completed,
            progress,
          };
        }
      );
    }, [
      careerStages,
      dsaCount,
      projectsCount,
      skillsCount,
    ]);

  const completedCount =
    roadmapItems.filter(
      (item) => item.completed
    ).length;

  const roadmapProgress =
    roadmapItems.length > 0
      ? Math.round(
          (completedCount /
            roadmapItems.length) *
            100
        )
      : 0;

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />

        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="text-4xl">
              🗺️
            </div>

            <p className="mt-4 text-slate-400">
              Building your personalized roadmap...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ====================================================
  // PAGE
  // ====================================================

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 py-12">

        {/* HEADER */}

        <div>
          <p className="text-sm font-semibold tracking-wide text-blue-400">
            VERTEX PERSONALIZED ROADMAP
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Your Career Journey 🗺️
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Your roadmap is built around your academic background,
            target role, skill level and placement goal.
          </p>
        </div>

        {/* ERROR */}

        {message && (
          <div className="mt-8 rounded-xl border border-red-900 bg-red-950/40 p-6">
            <p className="text-red-300">
              {message}
            </p>

            <Link
              href="/profile"
              className="mt-4 inline-block font-medium text-blue-400 hover:text-blue-300"
            >
              Complete Career Profile →
            </Link>
          </div>
        )}

        {/* PROFILE */}

        {studentProfile && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

              {[
                ["College", studentProfile.college],
                ["Branch", studentProfile.branch],
                [
                  "Semester",
                  `Semester ${studentProfile.semester}`,
                ],
                [
                  "Target Role",
                  studentProfile.target_role,
                ],
                [
                  "Company Tier",
                  studentProfile.company_tier,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                >
                  <p className="text-xs uppercase text-slate-500">
                    {label}
                  </p>

                  <p
                    className={`mt-2 font-semibold ${
                      label === "Target Role"
                        ? "text-blue-400"
                        : ""
                    }`}
                  >
                    {value}
                  </p>
                </div>
              ))}

            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase text-slate-500">
                University
              </p>

              <p className="mt-2 font-semibold">
                {studentProfile.university}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-blue-900 bg-blue-950/20 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <p className="text-sm text-slate-400">
                    Current Skill Level
                  </p>

                  <p className="mt-1 text-lg font-semibold">
                    {studentProfile.skill_level}
                  </p>
                </div>

                <Link
                  href="/profile"
                  className="text-sm font-medium text-blue-400 hover:text-blue-300"
                >
                  Update Profile →
                </Link>

              </div>
            </div>
          </>
        )}

        {/* PROGRESS */}

        {studentProfile && (
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-xl font-semibold">
                  Roadmap Progress
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {completedCount} of{" "}
                  {roadmapItems.length} stages completed
                </p>
              </div>

              <div className="text-4xl font-bold text-blue-500">
                {roadmapProgress}%
              </div>

            </div>

            <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-800">

              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-700"
                style={{
                  width: `${roadmapProgress}%`,
                }}
              />

            </div>

          </div>
        )}

        {/* AI ROADMAP ENGINE */}

        {studentProfile && (
          <div className="mt-8 rounded-2xl border border-blue-900 bg-linear-to-br from-blue-950/40 to-slate-900 p-6">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    🤖
                  </span>

                  <h2 className="text-2xl font-bold">
                    AI Roadmap Engine
                  </h2>
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Generate a personalized week-by-week preparation
                  plan using your profile, current progress and target role.
                </p>
              </div>

              <button
                onClick={generateAIRoadmap}
                disabled={aiLoading}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aiLoading
                  ? "Generating..."
                  : "Generate AI Roadmap ✨"}
              </button>

            </div>

            {aiError && (
              <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 p-4">
                <p className="text-sm text-red-300">
                  {aiError}
                </p>
              </div>
            )}

            {aiRoadmap && (
              <div className="mt-8">

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                  <p className="text-sm font-semibold text-blue-400">
                    AI Assessment
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {aiRoadmap.summary}
                  </p>

                  <div className="mt-4 rounded-lg border border-blue-900 bg-blue-950/30 p-4">
                    <p className="text-xs uppercase text-slate-500">
                      Current Priority
                    </p>

                    <p className="mt-1 font-semibold text-white">
                      {aiRoadmap.readiness_focus}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-5">

                  {aiRoadmap.weeks.map(
                    (week) => (
                      <div
                        key={week.week}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 p-6"
                      >

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                          <div>
                            <p className="text-sm font-semibold text-blue-400">
                              WEEK {week.week}
                            </p>

                            <h3 className="mt-1 text-xl font-bold">
                              {week.title}
                            </h3>
                          </div>

                          <span
                            className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                              week.priority === "High"
                                ? "bg-red-950 text-red-300"
                                : week.priority === "Medium"
                                ? "bg-yellow-950 text-yellow-300"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {week.priority} Priority
                          </span>

                        </div>

                        <p className="mt-4 text-sm leading-6 text-slate-400">
                          {week.goal}
                        </p>

                        <div className="mt-5 grid gap-5 md:grid-cols-2">

                          <div>
                            <h4 className="font-semibold">
                              📚 Topics
                            </h4>

                            <ul className="mt-2 space-y-2 text-sm text-slate-400">
                              {week.topics.map(
                                (topic, index) => (
                                  <li key={index}>
                                    • {topic}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-semibold">
                              ✅ Tasks
                            </h4>

                            <ul className="mt-2 space-y-2 text-sm text-slate-400">
                              {week.tasks.map(
                                (task, index) => (
                                  <li key={index}>
                                    • {task}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-semibold">
                              🧠 DSA
                            </h4>

                            <ul className="mt-2 space-y-2 text-sm text-slate-400">
                              {week.dsa.map(
                                (problem, index) => (
                                  <li key={index}>
                                    • {problem}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-semibold">
                              🚀 Project
                            </h4>

                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {week.project}
                            </p>
                          </div>

                        </div>

                      </div>
                    )
                  )}

                </div>
              </div>
            )}

          </div>
        )}

        {/* STATIC ROADMAP */}

        {studentProfile && (
          <div className="mt-8">

            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Your {studentProfile.target_role} Roadmap
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Complete these stages to move from classroom
                learning toward placement readiness.
              </p>
            </div>

            <div className="space-y-4">

              {roadmapItems.map(
                (item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className={`rounded-xl border p-6 transition ${
                      item.completed
                        ? "border-emerald-900 bg-emerald-950/20"
                        : "border-slate-800 bg-slate-900"
                    }`}
                  >

                    <div className="flex gap-4">

                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                          item.completed
                            ? "bg-emerald-900 text-emerald-300"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {item.completed
                          ? "✓"
                          : index + 1}
                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                          <h3 className="text-lg font-semibold">
                            {item.icon}{" "}
                            {item.title}
                          </h3>

                          <span
                            className={`text-sm font-medium ${
                              item.completed
                                ? "text-emerald-400"
                                : "text-slate-500"
                            }`}
                          >
                            {item.progress}
                          </span>

                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {item.description}
                        </p>

                        <div className="mt-4">

                          <Link
                            href={item.href}
                            className="inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
                          >
                            {item.completed
                              ? "Review →"
                              : "Start this stage →"}
                          </Link>

                        </div>

                      </div>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>
        )}

        {/* STATS */}

        {studentProfile && (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
              <div className="text-3xl">
                🧠
              </div>

              <p className="mt-3 text-2xl font-bold">
                {dsaCount}
              </p>

              <p className="text-sm text-slate-400">
                DSA Problems
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
              <div className="text-3xl">
                🛠️
              </div>

              <p className="mt-3 text-2xl font-bold">
                {skillsCount}
              </p>

              <p className="text-sm text-slate-400">
                Technical Skills
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
              <div className="text-3xl">
                🚀
              </div>

              <p className="mt-3 text-2xl font-bold">
                {projectsCount}
              </p>

              <p className="text-sm text-slate-400">
                Projects
              </p>
            </div>

          </div>
        )}

        {/* CTA */}

        {studentProfile && (
          <div className="mt-8 rounded-xl border border-blue-900 bg-blue-950/20 p-8 text-center">

            <div className="text-4xl">
              🚀
            </div>

            <h2 className="mt-3 text-2xl font-bold">
              Keep Building Your Career
            </h2>

            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Your classroom knowledge becomes valuable when you
              turn it into skills, practice, projects and interview
              performance.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">

              <Link
                href="/dsa"
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500"
              >
                Practice DSA
              </Link>

              <Link
                href="/projects"
                className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-800"
              >
                Build Projects
              </Link>

              <Link
                href="/ai-interview"
                className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-800"
              >
                AI Interview
              </Link>

            </div>

          </div>
        )}

      </section>
    </main>
  );
}