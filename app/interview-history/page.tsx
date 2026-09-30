
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type InterviewSession = {
  id: string;
  role: string;
  difficulty: string;
  mode: string;
  total_questions: number;
  answered_questions: number;
  total_score: number;
  percentage: number;
  strengths: string | null;
  weaknesses: string | null;
  improvement_plan: string | null;
  created_at: string;
};

type InterviewAnswer = {
  id: string;
  session_id: string;
  question_number: number;
  question: string;
  answer: string;
  score: number;
  feedback: string | null;
  created_at: string;
};

export default function InterviewHistoryPage() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [selectedSession, setSelectedSession] =
    useState<InterviewSession | null>(null);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [error, setError] = useState("");

  async function loadSessions() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in to view your interview history.");
        setLoading(false);
        return;
      }

      const { data, error: sessionError } = await supabase
        .from("ai_interview_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (sessionError) {
        throw sessionError;
      }

      setSessions((data || []) as InterviewSession[]);
    } catch (err) {
      console.error("Load Interview History Error:", err);
      setError("Unable to load interview history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const fetchSessions = async () => {
      await loadSessions();
    };
    fetchSessions();
  }, []);

  async function viewReport(session: InterviewSession) {
    try {
      setSelectedSession(session);
      setAnswers([]);
      setLoadingAnswers(true);
      setError("");

      const { data, error: answerError } = await supabase
        .from("ai_interview_answers")
        .select("*")
        .eq("session_id", session.id)
        .order("question_number", { ascending: true });

      if (answerError) {
        throw answerError;
      }

      setAnswers((data || []) as InterviewAnswer[]);
    } catch (err) {
      console.error("Load Interview Answers Error:", err);
      setError("Unable to load the interview report.");
    } finally {
      setLoadingAnswers(false);
    }
  }

  function closeReport() {
    setSelectedSession(null);
    setAnswers([]);
  }

  async function deleteInterview(sessionId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this interview?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const { error: answerError } = await supabase
        .from("ai_interview_answers")
        .delete()
        .eq("session_id", sessionId);

      if (answerError) {
        throw answerError;
      }

      const { error: sessionError } = await supabase
        .from("ai_interview_sessions")
        .delete()
        .eq("id", sessionId);

      if (sessionError) {
        throw sessionError;
      }

      setSessions((current) =>
        current.filter((session) => session.id !== sessionId)
      );

      if (selectedSession?.id === sessionId) {
        closeReport();
      }
    } catch (err) {
      console.error("Delete Interview Error:", err);
      setError("Unable to delete this interview.");
    }
  }

  const bestScore = useMemo(() => {
    if (sessions.length === 0) {
      return 0;
    }

    return Math.max(
      ...sessions.map((session) => Number(session.percentage || 0))
    );
  }, [sessions]);

  const averageScore = useMemo(() => {
    if (sessions.length === 0) {
      return 0;
    }

    const total = sessions.reduce(
      (sum, session) => sum + Number(session.percentage || 0),
      0
    );

    return Math.round(total / sessions.length);
  }, [sessions]);

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getScoreClass(score: number) {
    if (score >= 80) {
      return "text-green-400";
    }

    if (score >= 60) {
      return "text-yellow-400";
    }

    return "text-red-400";
  }

  function splitItems(value: string | null) {
    if (!value) {
      return [];
    }

    return value
      .split(/\n| - |•/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />

        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-6">
          <div className="text-center">
            <div className="mb-4 text-5xl">🎤</div>
            <p className="text-lg text-slate-300">
              Loading your interview history...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (selectedSession) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />

        <div className="mx-auto max-w-6xl px-6 py-10">
          <button
            onClick={closeReport}
            className="mb-6 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            ← Back to Interview History
          </button>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="mb-2 text-4xl">🎤</div>

                <h1 className="text-3xl font-bold">
                  {selectedSession.role}
                </h1>

                <p className="mt-2 text-slate-400">
                  {selectedSession.difficulty} • {selectedSession.mode}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {formatDate(selectedSession.created_at)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-6 text-center">
                <p className="text-sm text-slate-400">Overall Score</p>

                <p
                  className={
                    "mt-1 text-5xl font-bold " +
                    getScoreClass(Number(selectedSession.percentage))
                  }
                >
                  {Number(selectedSession.percentage)}%
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {Number(selectedSession.total_score)}/100
                </p>
              </div>
            </div>
          </section>

          {loadingAnswers ? (
            <div className="py-16 text-center text-slate-400">
              Loading your answers...
            </div>
          ) : (
            <>
              <section className="mt-6 grid gap-4 md:grid-cols-3">
                <StatCard
                  title="Questions"
                  value={String(selectedSession.total_questions)}
                  icon="📝"
                />

                <StatCard
                  title="Average Score"
                  value={
                    (
                      Number(selectedSession.total_score) /
                      Math.max(Number(selectedSession.total_questions), 1)
                    ).toFixed(1) + "/10"
                  }
                  icon="📊"
                />

                <StatCard
                  title="Answered"
                  value={String(selectedSession.answered_questions)}
                  icon="✅"
                />
              </section>

              <div className="mt-8 grid gap-6 lg:grid-cols-3">
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <h2 className="mb-4 text-xl font-bold">
                    💪 Strengths
                  </h2>

                  {splitItems(selectedSession.strengths).length > 0 ? (
                    <ul className="space-y-3">
                      {splitItems(selectedSession.strengths).map(
                        (item, index) => (
                          <li
                            key={index}
                            className="rounded-lg bg-slate-950 p-3 text-sm leading-6 text-slate-300"
                          >
                            ✓ {item}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No strengths recorded.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <h2 className="mb-4 text-xl font-bold">
                    ⚠️ Areas to Improve
                  </h2>

                  {splitItems(selectedSession.weaknesses).length > 0 ? (
                    <ul className="space-y-3">
                      {splitItems(selectedSession.weaknesses).map(
                        (item, index) => (
                          <li
                            key={index}
                            className="rounded-lg bg-slate-950 p-3 text-sm leading-6 text-slate-300"
                          >
                            • {item}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No weaknesses recorded.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <h2 className="mb-4 text-xl font-bold">
                    🚀 Improvement Plan
                  </h2>

                  {splitItems(selectedSession.improvement_plan).length >
                  0 ? (
                    <ol className="space-y-3">
                      {splitItems(selectedSession.improvement_plan).map(
                        (item, index) => (
                          <li
                            key={index}
                            className="rounded-lg bg-slate-950 p-3 text-sm leading-6 text-slate-300"
                          >
                            <span className="mr-2 font-bold text-blue-400">
                              {index + 1}.
                            </span>
                            {item}
                          </li>
                        )
                      )}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No improvement plan recorded.
                    </p>
                  )}
                </section>
              </div>

              <section className="mt-8">
                <h2 className="mb-4 text-2xl font-bold">
                  📝 Question-by-Question Performance
                </h2>

                <div className="space-y-5">
                  {answers.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row">
                        <div>
                          <p className="text-sm font-semibold text-blue-400">
                            QUESTION {item.question_number}
                          </p>

                          <h3 className="mt-2 text-lg font-semibold">
                            {item.question}
                          </h3>
                        </div>

                        <div
                          className={
                            "text-2xl font-bold " +
                            getScoreClass(
                              Number(item.score) * 10
                            )
                          }
                        >
                          {Number(item.score)}/10
                        </div>
                      </div>

                      <div className="mt-5">
                        <p className="mb-2 text-sm font-semibold text-slate-400">
                          YOUR ANSWER
                        </p>

                        <div className="rounded-xl bg-slate-950 p-4 text-sm leading-7 text-slate-300">
                          {item.answer}
                        </div>
                      </div>

                      {item.feedback && (
                        <div className="mt-5">
                          <p className="mb-2 text-sm font-semibold text-slate-400">
                            AI FEEDBACK
                          </p>

                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-7 text-slate-300 whitespace-pre-wrap">
                            {item.feedback}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-8">
          <div className="mb-3 text-5xl">🎤</div>

          <h1 className="text-4xl font-bold">
            Interview History
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Review your previous AI interviews, track your scores,
            and identify areas where you can improve.
          </p>
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {sessions.length > 0 && (
          <section className="mb-8 grid gap-4 md:grid-cols-3">
            <StatCard
              title="Total Interviews"
              value={String(sessions.length)}
              icon="🎤"
            />

            <StatCard
              title="Best Score"
              value={bestScore + "%"}
              icon="🏆"
            />

            <StatCard
              title="Average Score"
              value={averageScore + "%"}
              icon="📊"
            />
          </section>
        )}

        {sessions.length === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="text-6xl">🎤</div>

            <h2 className="mt-5 text-2xl font-bold">
              No Interviews Yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-slate-400">
              Complete your first AI interview to start building
              your interview history.
            </p>

            <Link
              href="/ai-interview"
              className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
            >
              Start AI Interview
            </Link>
          </section>
        ) : (
          <section className="space-y-5">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-700"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-2xl">
                      🎤
                    </div>

                    <div>
                      <h2 className="text-xl font-bold">
                        {session.role}
                      </h2>

                      <p className="mt-1 text-sm text-slate-400">
                        {session.difficulty} • {session.mode}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        {formatDate(session.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:flex lg:items-center">
                    <div className="text-center">
                      <p className="text-xs text-slate-500">
                        Score
                      </p>

                      <p
                        className={
                          "mt-1 text-2xl font-bold " +
                          getScoreClass(
                            Number(session.percentage)
                          )
                        }
                      >
                        {Number(session.percentage)}%
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-slate-500">
                        Questions
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {session.answered_questions}/
                        {session.total_questions}
                      </p>
                    </div>

                    <div className="col-span-2 flex gap-2 sm:col-span-1">
                      <button
                        onClick={() => viewReport(session)}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold transition hover:bg-blue-500"
                      >
                        View Report
                      </button>

                      <button
                        onClick={() =>
                          deleteInterview(session.id)
                        }
                        className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-950"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Link
            href="/ai-interview"
            className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-blue-500"
          >
            <div className="text-2xl">🎤</div>
            <h3 className="mt-3 font-bold">New Interview</h3>
            <p className="mt-1 text-sm text-slate-400">
              Practice another interview.
            </p>
          </Link>

          <Link
            href="/ai-placement"
            className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-blue-500"
          >
            <div className="text-2xl">🎯</div>
            <h3 className="mt-3 font-bold">AI Placement</h3>
            <p className="mt-1 text-sm text-slate-400">
              Check your placement readiness.
            </p>
          </Link>

          <Link
            href="/dsa"
            className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-blue-500"
          >
            <div className="text-2xl">💻</div>
            <h3 className="mt-3 font-bold">Practice DSA</h3>
            <p className="mt-1 text-sm text-slate-400">
              Improve your coding skills.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight"
        >
          Vertex
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-slate-400 md:flex">
          <Link
            href="/roadmap"
            className="transition hover:text-white"
          >
            Roadmap
          </Link>

          <Link
            href="/dsa"
            className="transition hover:text-white"
          >
            DSA
          </Link>

          <Link
            href="/projects"
            className="transition hover:text-white"
          >
            Projects
          </Link>

          <Link
            href="/ai-tutor"
            className="transition hover:text-white"
          >
            🤖 AI Tutor
          </Link>

          <Link
            href="/ai-placement"
            className="transition hover:text-white"
          >
            🎯 AI Placement
          </Link>

          <Link
            href="/ai-interview"
            className="transition hover:text-white"
          >
            🎤 AI Interview
          </Link>
        </nav>
      </div>
    </header>
  );
}

function StatCard({
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

      <p className="mt-3 text-sm text-slate-400">
        {title}
      </p>

      <p className="mt-1 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}
