"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Mentor = {
  id: string;
  user_id: string;
  full_name: string;
  college: string | null;
  branch: string | null;
  graduation_year: number | null;
  current_company: string | null;
  job_role: string | null;
  bio: string | null;
  skills: string[] | null;
  years_experience: number | null;
  target_roles: string[] | null;
  company_tiers: string[] | null;
  linkedin_url: string | null;
  github_url: string | null;
  verification_status: string;
  verification_note: string | null;
  session_price: number | null;
  currency: string | null;
  is_available: boolean;
  average_rating: number | null;
  total_reviews: number;
  total_sessions: number;
  created_at: string;
};

type Verification = {
  id: string;
  mentor_id: string;
  document_type: string;
  document_url: string;
  submitted_at: string;
  reviewed_at: string | null;
  status: string;
  reviewer_note: string | null;
  mentors: Mentor | Mentor[] | null;
};

function getMentor(
  mentors: Verification["mentors"]
): Mentor | null {
  if (!mentors) return null;

  if (Array.isArray(mentors)) {
    return mentors[0] ?? null;
  }

  return mentors;
}

function formatDocumentType(type: string) {
  const labels: Record<string, string> = {
    college_id: "College ID",
    graduation_proof: "Graduation Proof",
    employment_proof: "Employment Proof",
    linkedin: "LinkedIn Profile",
    other: "Other",
  };

  return labels[type] ?? type;
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

export default function AdminMentorsPage() {
  const [verifications, setVerifications] = useState<
    Verification[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [rejectingId, setRejectingId] =
    useState<string | null>(null);

  const [rejectionReason, setRejectionReason] =
    useState("");

  // ============================================================
  // LOAD VERIFICATIONS
  // ============================================================

  const loadVerifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/mentors",
        {
          method: "GET",
          headers: await getAuthHeaders(),
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to load verification requests."
        );
      }

      setVerifications(result.verifications ?? []);
    } catch (err) {
      console.error(
        "Admin mentor loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load verification requests."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadVerifications();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadVerifications]);

  // ============================================================
  // APPROVE MENTOR
  // ============================================================

  const approveMentor = async (
    verification: Verification
  ) => {
    const mentor = getMentor(
      verification.mentors
    );

    if (!mentor) {
      setError("Mentor information is missing.");
      return;
    }

    const confirmed = window.confirm(
      `Approve ${mentor.full_name} as a verified Vertex mentor?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(verification.id);
      setError("");
      setSuccess("");

      const response = await fetch(
        "/api/admin/mentors",
        {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            verificationId: verification.id,
            mentorId: mentor.id,
            action: "approve",
            reviewerNote:
              "Verification approved by Vertex verification team.",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to approve mentor."
        );
      }

      setSuccess(
        `${mentor.full_name} has been approved successfully.`
      );

      setVerifications((current) =>
        current.filter(
          (item) => item.id !== verification.id
        )
      );
    } catch (err) {
      console.error(
        "Mentor approval error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to approve mentor."
      );
    } finally {
      setProcessingId(null);
    }
  };

  // ============================================================
  // REJECT MENTOR
  // ============================================================

  const rejectMentor = async (
    verification: Verification
  ) => {
    const mentor = getMentor(
      verification.mentors
    );

    if (!mentor) {
      setError("Mentor information is missing.");
      return;
    }

    if (!rejectionReason.trim()) {
      setError(
        "Please enter a rejection reason."
      );
      return;
    }

    try {
      setProcessingId(verification.id);
      setError("");
      setSuccess("");

      const response = await fetch(
        "/api/admin/mentors",
        {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            verificationId: verification.id,
            mentorId: mentor.id,
            action: "reject",
            reviewerNote:
              rejectionReason.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to reject mentor."
        );
      }

      setSuccess(
        `${mentor.full_name}'s verification has been rejected.`
      );

      setVerifications((current) =>
        current.filter(
          (item) => item.id !== verification.id
        )
      );

      setRejectingId(null);
      setRejectionReason("");
    } catch (err) {
      console.error(
        "Mentor rejection error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to reject mentor."
      );
    } finally {
      setProcessingId(null);
    }
  };

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
              href="/admin/mentors"
              className="font-semibold text-cyan-400"
            >
              Admin
            </Link>
          </div>
        </div>
      </nav>

      {/* Page */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <Link
            href="/mentor"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Mentor Area
          </Link>

          <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-cyan-400">
                Vertex Administration
              </p>

              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Mentor Verification
              </h1>

              <p className="mt-3 max-w-2xl text-slate-400">
                Review mentor verification submissions
                and approve or reject professional
                profiles before they appear in the
                student marketplace.
              </p>
            </div>

            <button
              type="button"
              onClick={loadVerifications}
              disabled={loading}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Refreshing..."
                : "↻ Refresh Requests"}
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">
            <strong>Success:</strong> {success}
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Pending Requests
            </p>

            <p className="mt-2 text-3xl font-bold text-white">
              {verifications.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Review Queue
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-400">
              {verifications.length > 0
                ? "Active"
                : "Clear"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Verification System
            </p>

            <p className="mt-2 text-3xl font-bold text-cyan-400">
              Online
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />

            <p className="text-slate-400">
              Loading verification requests...
            </p>
          </div>
        )}

        {/* Empty */}
        {!loading &&
          verifications.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-3xl">
                ✓
              </div>

              <h2 className="text-xl font-semibold">
                No Pending Verifications
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                All mentor verification requests have
                been reviewed. New submissions will
                appear here.
              </p>
            </div>
          )}

        {/* Verification Cards */}
        {!loading &&
          verifications.length > 0 && (
            <div className="space-y-6">
              {verifications.map((verification) => {
                const mentor = getMentor(
                  verification.mentors
                );

                if (!mentor) {
                  return (
                    <div
                      key={verification.id}
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6"
                    >
                      Mentor information could not be
                      loaded for this verification.
                    </div>
                  );
                }

                const isProcessing =
                  processingId ===
                  verification.id;

                const isRejecting =
                  rejectingId ===
                  verification.id;

                return (
                  <article
                    key={verification.id}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
                  >
                    {/* Card Header */}
                    <div className="border-b border-slate-800 bg-slate-900/80 px-6 py-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl font-bold">
                              {mentor.full_name}
                            </h2>

                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                              Pending Review
                            </span>
                          </div>

                          <p className="mt-2 text-slate-400">
                            {mentor.job_role ||
                              "Professional"}{" "}
                            {mentor.current_company
                              ? `• ${mentor.current_company}`
                              : ""}
                          </p>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="text-xs uppercase tracking-wider text-slate-500">
                            Submitted
                          </p>

                          <p className="mt-1 text-sm text-slate-300">
                            {formatDate(
                              verification.submitted_at
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Profile */}
                    <div className="grid gap-6 p-6 lg:grid-cols-3">
                      {/* Mentor details */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                        <h3 className="mb-4 font-semibold text-cyan-400">
                          👤 Mentor Profile
                        </h3>

                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-slate-500">
                              College
                            </p>

                            <p className="mt-1 text-slate-200">
                              {mentor.college ||
                                "Not provided"}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Branch
                            </p>

                            <p className="mt-1 text-slate-200">
                              {mentor.branch ||
                                "Not provided"}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Graduation Year
                            </p>

                            <p className="mt-1 text-slate-200">
                              {mentor.graduation_year ||
                                "Not provided"}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Experience
                            </p>

                            <p className="mt-1 text-slate-200">
                              {mentor.years_experience ??
                                0}{" "}
                              year
                              {mentor.years_experience ===
                              1
                                ? ""
                                : "s"}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Job Role
                            </p>

                            <p className="mt-1 text-slate-200">
                              {mentor.job_role ||
                                "Not provided"}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Company
                            </p>

                            <p className="mt-1 text-slate-200">
                              {mentor.current_company ||
                                "Not provided"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Professional details */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                        <h3 className="mb-4 font-semibold text-cyan-400">
                          💼 Professional Details
                        </h3>

                        <div className="space-y-4 text-sm">
                          <div>
                            <p className="text-slate-500">
                              Skills
                            </p>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {mentor.skills &&
                              mentor.skills.length >
                                0 ? (
                                mentor.skills.map(
                                  (skill) => (
                                    <span
                                      key={skill}
                                      className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300"
                                    >
                                      {skill}
                                    </span>
                                  )
                                )
                              ) : (
                                <span className="text-slate-400">
                                  Not provided
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Target Roles
                            </p>

                            <p className="mt-1 text-slate-200">
                              {mentor.target_roles &&
                              mentor.target_roles
                                .length > 0
                                ? mentor.target_roles.join(
                                    ", "
                                  )
                                : "Not provided"}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Company Tiers
                            </p>

                            <p className="mt-1 text-slate-200">
                              {mentor.company_tiers &&
                              mentor.company_tiers
                                .length > 0
                                ? mentor.company_tiers.join(
                                    ", "
                                  )
                                : "Not provided"}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Mentor Bio
                            </p>

                            <p className="mt-1 leading-6 text-slate-300">
                              {mentor.bio ||
                                "No bio provided."}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            {mentor.linkedin_url && (
                              <a
                                href={
                                  mentor.linkedin_url
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300"
                              >
                                LinkedIn →
                              </a>
                            )}

                            {mentor.github_url && (
                              <a
                                href={
                                  mentor.github_url
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300"
                              >
                                GitHub →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Verification */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                        <h3 className="mb-4 font-semibold text-cyan-400">
                          🛡️ Verification
                        </h3>

                        <div className="space-y-4 text-sm">
                          <div>
                            <p className="text-slate-500">
                              Verification Type
                            </p>

                            <p className="mt-1 font-medium text-white">
                              {formatDocumentType(
                                verification.document_type
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Submitted Document
                            </p>

                            <a
                              href={
                                verification.document_url
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20"
                            >
                              View submitted document →
                            </a>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Mentor&apos;s Note
                            </p>

                            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900 p-3 leading-6 text-slate-300">
                              {mentor.verification_note ||
                                "No additional note provided."}
                            </div>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Current Status
                            </p>

                            <span className="mt-2 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                              {verification.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Reject form */}
                    {isRejecting && (
                      <div className="border-t border-slate-800 bg-red-500/5 px-6 py-5">
                        <h3 className="font-semibold text-red-300">
                          Reject Verification
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          Provide a reason that can be
                          used to explain why the
                          verification was rejected.
                        </p>

                        <textarea
                          value={rejectionReason}
                          onChange={(event) =>
                            setRejectionReason(
                              event.target.value
                            )
                          }
                          rows={4}
                          placeholder="Example: The submitted employment document could not be verified."
                          className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-red-500"
                        />

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              rejectMentor(
                                verification
                              )
                            }
                            disabled={isProcessing}
                            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing
                              ? "Rejecting..."
                              : "Confirm Rejection"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionReason("");
                              setError("");
                            }}
                            disabled={isProcessing}
                            className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {!isRejecting && (
                      <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900/60 px-6 py-5 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(
                              verification.id
                            );
                            setRejectionReason("");
                            setError("");
                          }}
                          disabled={isProcessing}
                          className="rounded-lg border border-red-500/40 bg-red-500/10 px-6 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ✕ Reject Mentor
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            approveMentor(
                              verification
                            )
                          }
                          disabled={isProcessing}
                          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing
                            ? "Processing..."
                            : "✓ Approve Mentor"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
      </section>
    </main>
  );
}