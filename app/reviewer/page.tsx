"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type Review = {
  id: string;
  project_id: number;
  reviewer_id: string;
  reviewer_role: "peer" | "senior";
  status: "pending" | "approved" | "rejected";
  score: number | null;
  feedback: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type ReviewDetails = {
  review: Review;
  project: {
    id: number;
    project_name: string;
    description: string;
    tech_stack: string;
    project_url: string;
    github_url: string | null;
    verification_status: string;
    verification_score: number | null;
  } | null;
};

export default function ReviewerPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedReviewId, setSelectedReviewId] =
    useState<string | null>(null);

  const [details, setDetails] =
    useState<ReviewDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");

  /*
   * LOAD ASSIGNED REVIEWS
   */
  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError("Please log in to access the reviewer dashboard.");
        return;
      }

      const response = await fetch(
        "/api/projects/review/my-reviews",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result?.error ||
            "Unable to load assigned reviews."
        );
        return;
      }

      setReviews(result.reviews || []);
    } catch (err) {
      console.error(
        "LOAD REVIEWER REVIEWS ERROR:",
        err
      );

      setError("Unable to load assigned reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * LOAD REVIEW DETAILS
   */
  const loadReviewDetails = useCallback(
    async (reviewId: string) => {
      try {
        setDetailsLoading(true);
        setError("");
        setMessage("");

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          setError("Please log in to review projects.");
          return;
        }

        const response = await fetch(
          `/api/projects/review/details?review_id=${encodeURIComponent(
            reviewId
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = await response.json();

        if (!response.ok) {
          setError(
            result?.error ||
              "Unable to load review details."
          );
          return;
        }

        setDetails(result);

        setScore(
          result?.review?.score !== null &&
            result?.review?.score !== undefined
            ? String(result.review.score)
            : ""
        );

        setFeedback(
          result?.review?.feedback || ""
        );
      } catch (err) {
        console.error(
          "LOAD REVIEW DETAILS ERROR:",
          err
        );

        setError("Unable to load review details.");
      } finally {
        setDetailsLoading(false);
      }
    },
    []
  );

  /*
   * SELECT REVIEW
   */
  const selectReview = async (reviewId: string) => {
    setSelectedReviewId(reviewId);
    await loadReviewDetails(reviewId);
  };

  /*
   * SUBMIT REVIEW
   */
  const submitReview = async (
    action:
      | "approve_peer_review"
      | "reject_peer_review"
      | "approve_senior_review"
      | "reject_senior_review"
  ) => {
    try {
      setError("");
      setMessage("");

      if (!selectedReviewId || !details) {
        setError("Please select a review first.");
        return;
      }

      if (details.review.status !== "pending") {
        setError(
          "This review has already been processed."
        );
        return;
      }

      if (!feedback.trim()) {
        setError("Please provide feedback.");
        return;
      }

      const numericScore = Number(score);

      if (
        !Number.isFinite(numericScore) ||
        numericScore < 0 ||
        numericScore > 100
      ) {
        setError(
          "Please enter a score between 0 and 100."
        );
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError("Please log in before submitting the review.");
        return;
      }

      setActionLoading(true);

      const response = await fetch(
        "/api/projects/review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action,
            review_id: selectedReviewId,
            score: numericScore,
            feedback: feedback.trim(),
          }),
        }
      );

      const result = await response.json();

      console.log(
        "VERTEX REVIEW ACTION RESPONSE:",
        result
      );

      if (!response.ok) {
        setError(
          result?.error ||
            result?.message ||
            "Unable to submit review."
        );
        return;
      }

      setMessage(
        result?.message ||
          (action.includes("approve")
            ? "Review approved successfully."
            : "Review rejected successfully.")
      );

      /*
       * Refresh reviewer list.
       */
      await loadReviews();

      /*
       * Refresh details.
       */
      await loadReviewDetails(selectedReviewId);
    } catch (err) {
      console.error(
        "SUBMIT REVIEW ERROR:",
        err
      );

      setError("Unable to submit review.");
    } finally {
      setActionLoading(false);
    }
  };

  /*
   * INITIAL LOAD
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReviews();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadReviews]);

  /*
   * STATS
   */
  const pendingCount = reviews.filter(
    (review) => review.status === "pending"
  ).length;

  const approvedCount = reviews.filter(
    (review) => review.status === "approved"
  ).length;

  const rejectedCount = reviews.filter(
    (review) => review.status === "rejected"
  ).length;

  const peerCount = reviews.filter(
    (review) => review.reviewer_role === "peer"
  ).length;

  const seniorCount = reviews.filter(
    (review) => review.reviewer_role === "senior"
  ).length;

  const isPending =
    details?.review.status === "pending";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* HEADER */}
        <div className="mb-10">
          <p className="mb-2 text-sm font-medium text-cyan-400">
            Vertex Verification Network
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Reviewer Dashboard
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Review student projects, evaluate their evidence,
            provide feedback, and move projects through the
            Vertex verification workflow.
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
            <p className="text-sm text-red-300">
              {error}
            </p>
          </div>
        )}

        {/* SUCCESS */}
        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <p className="text-sm text-emerald-300">
              {message}
            </p>
          </div>
        )}

        {/* STATS */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-white/3 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Assigned
            </p>

            <p className="mt-2 text-3xl font-bold">
              {reviews.length}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Total reviews
            </p>
          </div>

          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Pending
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-300">
              {pendingCount}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Need action
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Approved
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-300">
              {approvedCount}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Completed
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Peer
            </p>

            <p className="mt-2 text-3xl font-bold text-cyan-300">
              {peerCount}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Peer reviews
            </p>
          </div>

          <div className="rounded-3xl border border-purple-400/20 bg-purple-400/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Senior
            </p>

            <p className="mt-2 text-3xl font-bold text-purple-300">
              {seniorCount}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Senior reviews
            </p>
          </div>
        </section>

        {/* MAIN REVIEW AREA */}
        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* REVIEW LIST */}
          <div className="rounded-3xl border border-white/10 bg-white/3 p-5">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Assigned Work
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Project Reviews
                </h2>
              </div>

              <button
                onClick={() => void loadReviews()}
                disabled={loading}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "..." : "Refresh"}
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />

                <p className="mt-4 text-sm text-slate-500">
                  Loading assigned reviews...
                </p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-xl">
                  ✓
                </div>

                <h3 className="mt-4 font-semibold">
                  No reviews assigned
                </h3>

                <p className="mt-2 text-sm leading-5 text-slate-500">
                  Assigned project reviews will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => {
                  const selected =
                    selectedReviewId === review.id;

                  const roleLabel =
                    review.reviewer_role === "peer"
                      ? "Peer Review"
                      : "Senior Review";

                  return (
                    <button
                      key={review.id}
                      onClick={() =>
                        void selectReview(review.id)
                      }
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-cyan-400/40 bg-cyan-400/10"
                          : "border-white/10 bg-black/10 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Project
                          </p>

                          <p className="mt-1 truncate font-semibold text-white">
                            Project #{review.project_id}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            review.status === "pending"
                              ? "bg-amber-400/10 text-amber-300"
                              : review.status === "approved"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-red-400/10 text-red-300"
                          }`}
                        >
                          {review.status}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {roleLabel}
                        </span>

                        {review.score !== null && (
                          <span className="text-xs font-semibold text-cyan-400">
                            {review.score}/100
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* REVIEW DETAILS */}
          <div className="rounded-3xl border border-white/10 bg-white/3 p-6">
            {!selectedReviewId ? (
              <div className="flex min-h-125 items-center justify-center text-center">
                <div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/10 text-2xl">
                    👥
                  </div>

                  <h2 className="mt-5 text-xl font-semibold">
                    Select a Project Review
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Select an assigned review from the left
                    to inspect the project and submit your
                    review.
                  </p>
                </div>
              </div>
            ) : detailsLoading ? (
              <div className="flex min-h-125 items-center justify-center text-center">
                <div>
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />

                  <p className="mt-4 text-sm text-slate-500">
                    Loading project details...
                  </p>
                </div>
              </div>
            ) : !details ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
                <p className="text-sm text-red-300">
                  Unable to load this project&apos;s details.
                </p>
              </div>
            ) : (
              <div>
                {/* PROJECT HEADER */}
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-3xl font-bold tracking-tight">
                        {details.project?.project_name ||
                          `Project #${details.review.project_id}`}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          details.review.reviewer_role ===
                          "peer"
                            ? "bg-amber-400/10 text-amber-300"
                            : "bg-purple-400/10 text-purple-300"
                        }`}
                      >
                        {details.review.reviewer_role ===
                        "peer"
                          ? "Peer Review"
                          : "Senior Review"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      Review the project evidence and provide
                      an objective score and constructive
                      feedback.
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      details.review.status === "pending"
                        ? "bg-amber-400/10 text-amber-300"
                        : details.review.status ===
                          "approved"
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-red-400/10 text-red-300"
                    }`}
                  >
                    {details.review.status === "pending"
                      ? "Pending Review"
                      : details.review.status ===
                        "approved"
                      ? "Approved"
                      : "Rejected"}
                  </span>
                </div>

                {/* PROJECT INFO */}
                {details.project && (
                  <>
                    <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                          🔗
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold">
                            Project Overview
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {details.project.description}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {details.project.tech_stack
                              .split(",")
                              .map((tech) => (
                                <span
                                  key={tech}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300"
                                >
                                  {tech.trim()}
                                </span>
                              ))}
                          </div>

                          <div className="mt-5 flex flex-wrap gap-4 text-sm">
                            {details.project.project_url && (
                              <a
                                href={
                                  details.project.project_url
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 transition hover:text-cyan-300"
                              >
                                Live Project ↗
                              </a>
                            )}

                            {details.project.github_url && (
                              <a
                                href={
                                  details.project.github_url
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-300 transition hover:text-white"
                              >
                                GitHub Repository ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* VERIFICATION EVIDENCE */}
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            GitHub Evidence
                          </p>

                          <h3 className="mt-2 font-semibold">
                            Verification Status
                          </h3>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-slate-500">
                            Evidence Score
                          </p>

                          <p className="mt-1 text-2xl font-bold text-cyan-400">
                            {details.project
                              .verification_score ?? 0}
                            <span className="text-sm font-normal text-slate-500">
                              /25
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-white/3 p-4">
                          <p className="text-xs text-slate-500">
                            Verification Status
                          </p>

                          <p className="mt-1 text-sm font-medium text-white">
                            {details.project.verification_status ||
                              "pending"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/3 p-4">
                          <p className="text-xs text-slate-500">
                            Review Type
                          </p>

                          <p className="mt-1 text-sm font-medium text-white">
                            {details.review.reviewer_role ===
                            "peer"
                              ? "Peer Review"
                              : "Senior Review"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* REVIEW FORM */}
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                      ⭐
                    </div>

                    <div>
                      <h3 className="font-semibold">
                        Review Evaluation
                      </h3>

                      <p className="mt-1 text-sm leading-5 text-slate-400">
                        Evaluate the project&apos;s evidence,
                        implementation, and overall readiness.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Review Score
                    </label>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={score}
                        onChange={(e) =>
                          setScore(e.target.value)
                        }
                        disabled={!isPending || actionLoading}
                        placeholder="0 - 100"
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-20 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                      />

                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                        / 100
                      </span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Feedback
                    </label>

                    <textarea
                      value={feedback}
                      onChange={(e) =>
                        setFeedback(e.target.value)
                      }
                      disabled={!isPending || actionLoading}
                      placeholder="Provide constructive feedback about the project..."
                      rows={6}
                      className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  {isPending ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={() =>
                          void submitReview(
                            details.review
                              .reviewer_role === "peer"
                              ? "approve_peer_review"
                              : "approve_senior_review"
                          )
                        }
                        disabled={actionLoading}
                        className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading
                          ? "Submitting..."
                          : "Approve Review"}
                      </button>

                      <button
                        onClick={() =>
                          void submitReview(
                            details.review
                              .reviewer_role === "peer"
                              ? "reject_peer_review"
                              : "reject_senior_review"
                          )
                        }
                        disabled={actionLoading}
                        className="rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading
                          ? "Submitting..."
                          : "Reject Review"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-slate-400">
                        This review has already been{" "}
                        <span className="font-semibold text-white">
                          {details.review.status}
                        </span>
                        .
                      </p>

                      {details.review.reviewed_at && (
                        <p className="mt-1 text-xs text-slate-500">
                          Reviewed{" "}
                          {new Date(
                            details.review.reviewed_at
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* WORKFLOW */}
        <section className="mt-12 rounded-3xl border border-white/10 bg-white/3 p-6">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reviewer Workflow
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Project Verification Pipeline
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Vertex uses multiple verification stages to
              turn project evidence into a verified portfolio
              project.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
              <div className="text-xs font-semibold text-cyan-400">
                01
              </div>

              <h3 className="mt-3 font-semibold">
                GitHub Evidence
              </h3>

              <p className="mt-2 text-sm leading-5 text-slate-400">
                Repository activity provides evidence such as
                commits, pull requests, and contributors.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
              <div className="text-xs font-semibold text-amber-400">
                02
              </div>

              <h3 className="mt-3 font-semibold">
                Peer Review
              </h3>

              <p className="mt-2 text-sm leading-5 text-slate-400">
                A peer reviewer evaluates the project and
                provides a score and constructive feedback.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
              <div className="text-xs font-semibold text-purple-400">
                03
              </div>

              <h3 className="mt-3 font-semibold">
                Senior Review
              </h3>

              <p className="mt-2 text-sm leading-5 text-slate-400">
                After peer approval, the project can proceed
                to senior review before final verification.
              </p>
            </div>
          </div>
        </section>

        {/* REVIEWER INFO */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/3 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Reviewer Activity
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Your Review Record
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Completed reviews remain available in your
                reviewer dashboard for reference.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Rejected
                </p>

                <p className="mt-1 text-lg font-bold text-red-300">
                  {rejectedCount}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Completed
                </p>

                <p className="mt-1 text-lg font-bold text-emerald-300">
                  {approvedCount + rejectedCount}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}