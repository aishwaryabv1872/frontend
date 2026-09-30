"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

type Mentor = {
  id: string;
  full_name: string;
  profile_photo_url: string | null;
  current_company: string | null;
  job_role: string | null;
};

type MentorSession = {
  id: string;
  mentor_id: string;
  student_id: string;
  scheduled_at: string;
  duration_minutes: number;
  session_type: string;
  student_message: string | null;
  status: string;
  session_price: number;
  currency: string | null;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  video_room_url: string | null;
  meeting_started_at: string | null;
  meeting_ended_at: string | null;
  mentor_notes: string | null;
  student_rating: number | null;
  student_review: string | null;
  created_at: string;
};

type SessionWithMentor = MentorSession & {
  mentor?: Mentor;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================================
// AUTHENTICATED API HELPER
// ============================================================

const getAuthHeaders = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.access_token) {
    throw new Error(
      "Your session has expired. Please log in again."
    );
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
};

export default function MentorSessionsPage() {
  const [sessions, setSessions] = useState<SessionWithMentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Please login to view your mentor sessions.");
        setSessions([]);
        return;
      }

      const { data, error: sessionError } = await supabase
        .from("mentor_sessions")
        .select("*")
        .eq("student_id", user.id)
        .order("scheduled_at", {
          ascending: false,
        });

      if (sessionError) {
        throw sessionError;
      }

      if (!data || data.length === 0) {
        setSessions([]);
        return;
      }

      const mentorIds = [
        ...new Set(
          data.map(
            (session) => session.mentor_id
          )
        ),
      ];

      const {
        data: mentors,
        error: mentorError,
      } = await supabase
        .from("mentors")
        .select(
          `
            id,
            full_name,
            profile_photo_url,
            current_company,
            job_role
          `
        )
        .in("id", mentorIds);

      if (mentorError) {
        console.error(
          "Mentor loading error:",
          mentorError
        );
      }

      const mentorMap = new Map<string, Mentor>();

      (mentors || []).forEach((mentor) => {
        mentorMap.set(mentor.id, mentor);
      });

      const combined: SessionWithMentor[] =
        data.map((session) => ({
          ...session,
          mentor: mentorMap.get(
            session.mentor_id
          ),
        }));

      setSessions(combined);
    } catch (err) {
      console.error(
        "Mentor sessions error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load mentor sessions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadSessions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSessions]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString(
      "en-IN",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  }

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString(
      "en-IN",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
    );
  }

  function formatSessionType(type: string) {
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  async function handleJoinSession(
    session: SessionWithMentor
  ) {
    try {
      setActionLoading(session.id);
      setError("");
      setSuccess("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Please login to join the session."
        );
      }

      if (
        session.payment_status !== "paid"
      ) {
        throw new Error(
          "Please complete payment before joining this session."
        );
      }

      if (session.status === "cancelled") {
        throw new Error(
          "This session has been cancelled."
        );
      }

      // Create/reuse authenticated video room
      const response = await fetch(
        "/api/mentor-sessions",
        {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            action: "create_room",
            sessionId: session.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not create the video room."
        );
      }

      if (!data.video_room_url) {
        throw new Error(
          "Video room URL was not returned."
        );
      }

      window.open(
        data.video_room_url,
        "_blank",
        "noopener,noreferrer"
      );

      // Start the meeting
      const startResponse = await fetch(
        "/api/mentor-sessions",
        {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            action: "start",
            sessionId: session.id,
          }),
        }
      );

      if (!startResponse.ok) {
        const startData =
          await startResponse.json();

        throw new Error(
          startData.error ||
            "The video room opened, but the session could not be started."
        );
      }

      setSuccess(
        "Video session opened successfully."
      );

      await loadSessions();
    } catch (err) {
      console.error(
        "Join session error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not join the session."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelSession(
    session: SessionWithMentor
  ) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this mentor session?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(session.id);
      setError("");
      setSuccess("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Please login first."
        );
      }

      const response = await fetch(
        "/api/mentor-sessions",
        {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            action: "cancel",
            sessionId: session.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not cancel the session."
        );
      }

      setSuccess(
        "Mentor session cancelled successfully."
      );

      await loadSessions();
    } catch (err) {
      console.error(
        "Cancel session error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not cancel the session."
      );
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-cyan-400"
          >
            Vertex
          </Link>

          <div className="flex items-center gap-5 text-sm">
            <Link
              href="/roadmap"
              className="text-slate-300 transition hover:text-white"
            >
              Roadmap
            </Link>

            <Link
              href="/dsa"
              className="text-slate-300 transition hover:text-white"
            >
              DSA
            </Link>

            <Link
              href="/projects"
              className="text-slate-300 transition hover:text-white"
            >
              Projects
            </Link>

            <Link
              href="/ai-tutor"
              className="text-slate-300 transition hover:text-white"
            >
              AI Tutor
            </Link>

            <Link
              href="/pods"
              className="text-slate-300 transition hover:text-white"
            >
              Pods
            </Link>

            <Link
              href="/mentor"
              className="text-slate-300 transition hover:text-white"
            >
              Mentor
            </Link>

            <Link
              href="/mentors"
              className="text-slate-300 transition hover:text-white"
            >
              Find Mentors
            </Link>

            <Link
              href="/mentor-sessions"
              className="font-semibold text-cyan-400"
            >
              My Sessions
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-400">
              Vertex Mentor Marketplace
            </p>

            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              My Mentor Sessions 🎓
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
              Manage your mentor bookings, view
              payment status, and join your
              personalized mentoring sessions.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Total Sessions
              </p>

              <p className="mt-2 text-3xl font-bold text-cyan-400">
                {sessions.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Confirmed
              </p>

              <p className="mt-2 text-3xl font-bold text-emerald-400">
                {
                  sessions.filter(
                    (session) =>
                      session.status ===
                      "confirmed"
                  ).length
                }
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Completed
              </p>

              <p className="mt-2 text-3xl font-bold text-white">
                {
                  sessions.filter(
                    (session) =>
                      session.status ===
                      "completed"
                  ).length
                }
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="font-semibold text-red-300">
              Something went wrong
            </p>

            <p className="mt-1 text-sm text-red-300/80">
              {error}
            </p>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <p className="font-semibold text-emerald-300">
              ✓ {success}
            </p>
          </div>
        )}

        {/* Section Header */}
        {!loading && sessions.length > 0 && (
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold">
                Your Sessions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                View and manage your mentor
                bookings.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={loadSessions}
                className="text-sm text-cyan-400 transition hover:text-cyan-300"
              >
                ↻ Refresh
              </button>

              <Link
                href="/mentors"
                className="text-sm text-slate-400 transition hover:text-white"
              >
                Find another mentor →
              </Link>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <div className="flex gap-4">
                  <div className="h-14 w-14 rounded-full bg-slate-800" />

                  <div className="flex-1">
                    <div className="h-5 w-1/2 rounded bg-slate-800" />

                    <div className="mt-3 h-4 w-1/3 rounded bg-slate-800" />
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="h-16 rounded bg-slate-800" />
                  <div className="h-16 rounded bg-slate-800" />
                </div>

                <div className="mt-6 h-11 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading &&
          sessions.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-3xl">
                🎓
              </div>

              <h2 className="text-xl font-semibold">
                No mentor sessions yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Book a session with a verified
                professional and get personalized
                placement guidance.
              </p>

              <Link
                href="/mentors"
                className="mt-6 inline-flex rounded-lg bg-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Find a Mentor →
              </Link>
            </div>
          )}

        {/* Session Cards */}
        {!loading &&
          sessions.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {sessions.map((session) => {
                const mentor = session.mentor;
                const isPaid =
                  session.payment_status ===
                  "paid";

                const isCancelled =
                  session.status ===
                  "cancelled";

                const isCompleted =
                  session.status ===
                  "completed";

                const isConfirmed =
                  session.status ===
                  "confirmed";

                return (
                  <article
                    key={session.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:-translate-y-1 hover:border-cyan-500/40"
                  >
                    {/* Card Top */}
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          {mentor?.profile_photo_url ? (
                            <Image
                              src={
                                mentor.profile_photo_url
                              }
                              width={56}
                              height={56}
                              alt={
                                mentor.full_name
                              }
                              className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-800"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 text-xl font-bold text-cyan-400 ring-2 ring-slate-800">
                              {mentor?.full_name
                                ?.charAt(0)
                                .toUpperCase() ||
                                "M"}
                            </div>
                          )}

                          <div>
                            <h3 className="font-bold text-white">
                              {mentor?.full_name ||
                                "Mentor"}
                            </h3>

                            <p className="mt-1 text-sm text-slate-400">
                              {mentor?.job_role ||
                                "Professional"}
                            </p>

                            {mentor?.current_company && (
                              <p className="mt-0.5 text-sm text-cyan-400">
                                {
                                  mentor.current_company
                                }
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                          ✓ Verified
                        </span>
                      </div>

                      {/* Status */}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            isConfirmed
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : isCompleted
                              ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                              : isCancelled
                              ? "border-red-500/30 bg-red-500/10 text-red-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {isConfirmed
                            ? "● Confirmed"
                            : isCompleted
                            ? "✓ Completed"
                            : isCancelled
                            ? "✕ Cancelled"
                            : "● Pending"}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            isPaid
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {isPaid
                            ? "✓ Paid"
                            : "Payment " +
                              session.payment_status}
                        </span>
                      </div>

                      {/* Session Info */}
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Date
                          </p>

                          <p className="mt-2 text-sm font-semibold text-white">
                            {formatDate(
                              session.scheduled_at
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Time
                          </p>

                          <p className="mt-2 text-sm font-semibold text-white">
                            {formatTime(
                              session.scheduled_at
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {
                              session.duration_minutes
                            }{" "}
                            minutes
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Session Type
                          </p>

                          <p className="mt-2 text-sm font-semibold text-white">
                            {formatSessionType(
                              session.session_type
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Amount
                          </p>

                          <p className="mt-2 text-lg font-bold text-white">
                            {session.currency ===
                              "INR" ||
                            !session.currency
                              ? "₹"
                              : session.currency +
                                " "}
                            {session.session_price}
                          </p>

                          <p className="mt-1 text-xs text-emerald-400">
                            {isPaid
                              ? "Payment completed"
                              : "Payment pending"}
                          </p>
                        </div>
                      </div>

                      {/* Student Message */}
                      {session.student_message && (
                        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Message to Mentor
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {
                              session.student_message
                            }
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-auto border-t border-slate-800 bg-slate-950/50 p-6">
                      {isCompleted ? (
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                          <p className="font-semibold text-cyan-300">
                            ✓ Session completed
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            Thank you for using
                            Vertex Mentor
                            Marketplace.
                          </p>

                          {session.student_rating ? (
                            <p className="mt-3 text-sm text-amber-400">
                              Your rating:{" "}
                              {"★".repeat(
                                session.student_rating
                              )}
                            </p>
                          ) : (
                            <p className="mt-3 text-xs text-slate-500">
                              Feedback and
                              ratings can be
                              added after the
                              session.
                            </p>
                          )}
                        </div>
                      ) : isCancelled ? (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                          <p className="font-semibold text-red-300">
                            Session cancelled
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            This mentor session
                            is no longer
                            available.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row">
                          {isPaid && (
                            <button
                              type="button"
                              onClick={() =>
                                handleJoinSession(
                                  session
                                )
                              }
                              disabled={
                                actionLoading ===
                                session.id
                              }
                              className="flex-1 rounded-lg bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {actionLoading ===
                              session.id
                                ? "Opening..."
                                : "🎥 Join Session →"}
                            </button>
                          )}

                          {!session.meeting_started_at && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCancelSession(
                                  session
                                )
                              }
                              disabled={
                                actionLoading ===
                                session.id
                              }
                              className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-red-500/50 hover:bg-red-500/5 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Cancel Session
                            </button>
                          )}
                        </div>
                      )}

                      <p className="mt-4 text-center text-xs text-slate-600">
                        Booking ID: {session.id}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </section>
    </main>
  );
}