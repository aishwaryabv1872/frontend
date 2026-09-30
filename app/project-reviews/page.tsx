"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

/*
 * ============================================================
 * TEST REVIEWER
 * ============================================================
 *
 * This is the Vertex test peer-review account we created.
 *
 * reviewer@gmail.com
 * 52ec5af2-011c-4b0f-a441-77225d66be5c
 *
 * Later this can be replaced with a real reviewer assignment
 * system.
 * ============================================================
 */

const DEMO_PEER_REVIEWER_ID =
  "52ec5af2-011c-4b0f-a441-77225d66be5c";

type ReviewRole = "peer" | "senior";

type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected";

type Project = {
  id: number;
  user_id: string;
  project_name: string;
  description: string | null;
  tech_stack: string | null;
  verification_status: string;
  verification_score: number | null;
  github_owner: string | null;
  github_repo: string | null;
  github_url: string | null;
  created_at: string;
};

type Review = {
  id: string;
  project_id: number;
  reviewer_id: string;
  reviewer_role: ReviewRole;
  status: ReviewStatus;
  score: number | null;
  feedback: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type ReviewApiResponse = {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  review?: Review;
  project_status?: string;
  next_step?: string;
};

function getStatusLabel(
  status: ReviewStatus
) {
  switch (status) {
    case "approved":
      return "Approved";

    case "rejected":
      return "Rejected";

    default:
      return "Pending";
  }
}

function getRoleLabel(
  role: ReviewRole
) {
  return role === "peer"
    ? "Peer Review"
    : "Senior Review";
}

function formatDate(
  date: string
) {
  return new Date(date).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

export default function ProjectReviewsPage() {
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [currentUserEmail, setCurrentUserEmail] =
    useState<string | null>(null);

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState<string | null>(null);

  const [pageError, setPageError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  /*
   * Review form state
   */

  const [selectedProjectId, setSelectedProjectId] =
    useState<string>("");

  const [selectedReviewerId, setSelectedReviewerId] =
    useState(
      DEMO_PEER_REVIEWER_ID
    );

  const [reviewScores, setReviewScores] =
    useState<Record<string, string>>({});

  const [reviewFeedback, setReviewFeedback] =
    useState<Record<string, string>>({});

  /*
   * ==========================================================
   * LOAD CURRENT USER
   * ==========================================================
   */

  const loadCurrentUser =
    useCallback(async () => {
      const {
        data,
        error,
      } =
        await supabase.auth.getUser();

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (!data.user) {
        throw new Error(
          "You are not logged in."
        );
      }

      setCurrentUserId(
        data.user.id
      );

      setCurrentUserEmail(
        data.user.email ?? null
      );

      return data.user;
    }, []);

  /*
   * ==========================================================
   * LOAD OWNER PROJECTS
   * ==========================================================
   */

  const loadProjects =
    useCallback(
      async (
        userId: string
      ) => {
        const {
          data,
          error,
        } =
          await supabase
            .from("projects")
            .select(
              `
                id,
                user_id,
                project_name,
                description,
                tech_stack,
                verification_status,
                verification_score,
                github_owner,
                github_repo,
                github_url,
                created_at
              `
            )
            .eq(
              "user_id",
              userId
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            );

        if (error) {
          throw new Error(
            `Unable to load projects: ${error.message}`
          );
        }

        setProjects(
          (data ?? []) as Project[]
        );
      },
      []
    );

  /*
   * ==========================================================
   * LOAD REVIEWS
   * ==========================================================
   *
   * RLS lets:
   * - project owners see reviews for their projects
   * - reviewers see their assigned reviews
   *
   * So we query the review table directly for the logged-in
   * user. The OR condition is intentionally done as two
   * queries because Supabase PostgREST ownership logic can
   * otherwise become harder to reason about.
   * ==========================================================
   */

  const loadReviews =
    useCallback(
      async (
        userId: string
      ) => {
        const {
          data: reviewerReviews,
          error: reviewerError,
        } =
          await supabase
            .from("project_reviews")
            .select(
              `
                id,
                project_id,
                reviewer_id,
                reviewer_role,
                status,
                score,
                feedback,
                reviewed_at,
                created_at
              `
            )
            .eq(
              "reviewer_id",
              userId
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            );

        if (reviewerError) {
          throw new Error(
            `Unable to load assigned reviews: ${reviewerError.message}`
          );
        }

        const ownerProjects =
          projects;

        /*
         * Find reviews belonging to projects owned
         * by the current user.
         */

        let ownerReviews: Review[] =
          [];

        if (
          ownerProjects.length >
          0
        ) {
          const projectIds =
            ownerProjects.map(
              (project) =>
                project.id
            );

          const {
            data,
            error,
          } =
            await supabase
              .from("project_reviews")
              .select(
                `
                  id,
                  project_id,
                  reviewer_id,
                  reviewer_role,
                  status,
                  score,
                  feedback,
                  reviewed_at,
                  created_at
                `
              )
              .in(
                "project_id",
                projectIds
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              );

          if (error) {
            throw new Error(
              `Unable to load project reviews: ${error.message}`
            );
          }

          ownerReviews =
            (data ?? []) as Review[];
        }

        const combined =
          [
            ...(reviewerReviews ??
              []),
            ...ownerReviews,
          ] as Review[];

        /*
         * Remove duplicate reviews.
         */

        const unique =
          Array.from(
            new Map(
              combined.map(
                (review) => [
                  review.id,
                  review,
                ]
              )
            ).values()
          );

        setReviews(
          unique
        );
      },
      [projects]
    );

  /*
   * ==========================================================
   * INITIAL LOAD
   * ==========================================================
   */

  useEffect(() => {
    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoading(true);
            setPageError(null);

            const user =
              await loadCurrentUser();

            await loadProjects(
              user.id
            );
          } catch (error) {
            console.error(
              "Project review page load error:",
              error
            );

            setPageError(
              error instanceof Error
                ? error.message
                : "Unable to load project reviews."
            );
          } finally {
            setLoading(false);
          }
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    loadCurrentUser,
    loadProjects,
  ]);

  /*
   * Load reviews after projects have loaded.
   */

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const timer =
      window.setTimeout(
        async () => {
          try {
            await loadReviews(
              currentUserId
            );
          } catch (error) {
            console.error(
              "Review loading error:",
              error
            );

            setPageError(
              error instanceof Error
                ? error.message
                : "Unable to load reviews."
            );
          }
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    currentUserId,
    loadReviews,
  ]);

  /*
   * ==========================================================
   * REFRESH EVERYTHING
   * ==========================================================
   */

  const refreshPage =
    useCallback(async () => {
      try {
        setLoading(true);
        setPageError(null);

        const user =
          await loadCurrentUser();

        await loadProjects(
          user.id
        );
      } catch (error) {
        console.error(
          "Refresh error:",
          error
        );

        setPageError(
          error instanceof Error
            ? error.message
            : "Unable to refresh."
        );
      } finally {
        setLoading(false);
      }
    }, [
      loadCurrentUser,
      loadProjects,
    ]);

  /*
   * ==========================================================
   * REQUEST PEER REVIEW
   * ==========================================================
   */

  const requestPeerReview =
    async () => {
      if (!currentUserId) {
        setPageError(
          "Please log in first."
        );
        return;
      }

      if (!selectedProjectId) {
        setPageError(
          "Select a project first."
        );
        return;
      }

      if (!selectedReviewerId) {
        setPageError(
          "A peer reviewer is required."
        );
        return;
      }

      setActionLoading(
        `request-${selectedProjectId}`
      );

      setPageError(null);
      setSuccessMessage(null);

      try {
        const {
          data: sessionData,
        } =
          await supabase.auth.getSession();

        const accessToken =
          sessionData.session
            ?.access_token;

        if (!accessToken) {
          throw new Error(
            "Your Vertex session has expired. Please log in again."
          );
        }

        const response =
          await fetch(
            "/api/projects/review",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${accessToken}`,
              },

              body: JSON.stringify({
                action:
                  "request_peer_review",

                project_id:
                  Number(
                    selectedProjectId
                  ),

                reviewer_id:
                  selectedReviewerId,
              }),
            }
          );

        const result =
          (await response.json()) as ReviewApiResponse;

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              result.details ||
              "Unable to request peer review."
          );
        }

        setSuccessMessage(
          result.message ||
            "Peer review requested successfully."
        );

        setSelectedProjectId(
          ""
        );

        /*
         * Reload projects/reviews.
         */

        const user =
          await loadCurrentUser();

        await loadProjects(
          user.id
        );
      } catch (error) {
        console.error(
          "Request peer review error:",
          error
        );

        setPageError(
          error instanceof Error
            ? error.message
            : "Unable to request peer review."
        );
      } finally {
        setActionLoading(
          null
        );
      }
    };

  /*
   * ==========================================================
   * APPROVE / REJECT PEER REVIEW
   * ==========================================================
   */

  const completePeerReview =
    async (
      review: Review,
      action:
        | "approve_peer_review"
        | "reject_peer_review"
    ) => {
      if (!currentUserId) {
        setPageError(
          "Please log in first."
        );
        return;
      }

      const scoreText =
        reviewScores[
          review.id
        ] ?? "";

      const feedback =
        reviewFeedback[
          review.id
        ]?.trim() || "";

      let score:
        | number
        | undefined;

      if (scoreText !== "") {
        const parsed =
          Number(scoreText);

        if (
          !Number.isInteger(
            parsed
          ) ||
          parsed < 0 ||
          parsed > 100
        ) {
          setPageError(
            "Review score must be an integer between 0 and 100."
          );
          return;
        }

        score =
          parsed;
      }

      if (!feedback) {
        setPageError(
          "Please provide review feedback."
        );
        return;
      }

      setActionLoading(
        review.id
      );

      setPageError(null);
      setSuccessMessage(null);

      try {
        const {
          data: sessionData,
        } =
          await supabase.auth.getSession();

        const accessToken =
          sessionData.session
            ?.access_token;

        if (!accessToken) {
          throw new Error(
            "Your Vertex session has expired. Please log in again."
          );
        }

        const response =
          await fetch(
            "/api/projects/review",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${accessToken}`,
              },

              body: JSON.stringify({
                action,

                project_id:
                  review.project_id,

                review_id:
                  review.id,

                score,

                feedback,
              }),
            }
          );

        const result =
          (await response.json()) as ReviewApiResponse;

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              result.details ||
              "Unable to complete peer review."
          );
        }

        setSuccessMessage(
          result.message ||
            "Peer review updated successfully."
        );

        const user =
          await loadCurrentUser();

        await loadProjects(
          user.id
        );
      } catch (error) {
        console.error(
          "Peer review action error:",
          error
        );

        setPageError(
          error instanceof Error
            ? error.message
            : "Unable to complete peer review."
        );
      } finally {
        setActionLoading(
          null
        );
      }
    };

  /*
   * ==========================================================
   * DERIVED DATA
   * ==========================================================
   */

  const ownerReviews =
    useMemo(() => {
      if (
        !currentUserId
      ) {
        return [];
      }

      const ownedProjectIds =
        new Set(
          projects.map(
            (project) =>
              project.id
          )
        );

      return reviews.filter(
        (review) =>
          ownedProjectIds.has(
            review.project_id
          )
      );
    }, [
      currentUserId,
      projects,
      reviews,
    ]);

  const incomingPeerReviews =
    useMemo(() => {
      if (
        !currentUserId
      ) {
        return [];
      }

      return reviews.filter(
        (review) =>
          review.reviewer_id ===
            currentUserId &&
          review.reviewer_role ===
            "peer"
      );
    }, [
      currentUserId,
      reviews,
    ]);

  const pendingOwnerReviews =
    ownerReviews.filter(
      (review) =>
        review.status ===
        "pending"
    ).length;

  const pendingIncomingReviews =
    incomingPeerReviews.filter(
      (review) =>
        review.status ===
        "pending"
    ).length;

  /*
   * ==========================================================
   * FIND PROJECT
   * ==========================================================
   */

  const getProjectById =
    (projectId: number) =>
      projects.find(
        (project) =>
          project.id ===
          projectId
      );

  /*
   * ==========================================================
   * LOADING UI
   * ==========================================================
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b14] text-white">
        <Navbar />

        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-8">
            <div className="animate-pulse">
              <div className="h-8 w-72 rounded bg-slate-800" />

              <div className="mt-4 h-4 w-125 max-w-full rounded bg-slate-800" />

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                <div className="h-48 rounded-2xl bg-[#0a1120]" />
                <div className="h-48 rounded-2xl bg-[#0a1120]" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ==========================================================
   * MAIN UI
   * ==========================================================
   */

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        {/* ==================================================
            HEADER
            ================================================== */}

        <div className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/5 px-3 py-1 text-xs font-medium text-blue-300">
                🔐 Vertex Project Verification
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Project Review Center
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
                Manage peer and senior reviews for your
                verified-project workflow.
              </p>

              {currentUserEmail && (
                <p className="mt-2 text-xs text-slate-500">
                  Signed in as{" "}
                  <span className="text-slate-300">
                    {currentUserEmail}
                  </span>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void refreshPage();
              }}
              className="rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-[#162033]"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* ==================================================
            ALERTS
            ================================================== */}

        {pageError && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            <div className="font-semibold">
              Something went wrong
            </div>

            <div className="mt-1">
              {pageError}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            <div className="font-semibold">
              ✅ Success
            </div>

            <div className="mt-1">
              {successMessage}
            </div>
          </div>
        )}

        {/* ==================================================
            STATS
            ================================================== */}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Your projects
            </p>

            <p className="mt-2 text-3xl font-bold text-white">
              {projects.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Your review requests
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-400">
              {ownerReviews.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Pending assigned
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-400">
              {pendingIncomingReviews}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Pending owner reviews
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-400">
              {pendingOwnerReviews}
            </p>
          </div>
        </section>

        {/* ==================================================
            REQUEST PEER REVIEW
            ================================================== */}

        <section className="mb-8 rounded-2xl border border-slate-800 bg-[#0f172a] p-6 shadow-2xl shadow-black/10">
          <div className="mb-6">
            <h2 className="text-xl font-bold">
              Request Peer Review
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Choose a project with collected GitHub
              evidence and send it to your peer reviewer.
            </p>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0a1120] p-5 text-sm text-slate-400">
              You do not have any projects yet.
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">

              <div>
                <label
                  htmlFor="review-project"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Project
                </label>

                <select
                  id="review-project"
                  value={selectedProjectId}
                  onChange={(event) => {
                    setSelectedProjectId(
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-[#0a1120] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                >
                  <option value="">
                    Select a project
                  </option>

                  {projects.map(
                    (project) => (
                      <option
                        key={project.id}
                        value={project.id}
                      >
                        {project.project_name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="reviewer-id"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Peer reviewer
                </label>

                <input
                  id="reviewer-id"
                  value={selectedReviewerId}
                  onChange={(event) => {
                    setSelectedReviewerId(
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-[#0a1120] px-4 py-3 font-mono text-xs text-white outline-none transition focus:border-blue-500"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Test reviewer: reviewer@gmail.com
                </p>
              </div>

              <button
                type="button"
                disabled={
                  !selectedProjectId ||
                  !selectedReviewerId ||
                  actionLoading !== null
                }
                onClick={() => {
                  void requestPeerReview();
                }}
                className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ===
                `request-${selectedProjectId}`
                  ? "Requesting..."
                  : "📨 Request Peer Review"}
              </button>
            </div>
          )}
        </section>

        {/* ==================================================
            OWNER REVIEW STATUS
            ================================================== */}

        <section className="mb-8">
          <div className="mb-5">
            <h2 className="text-2xl font-bold">
              Your Project Reviews
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Track the current peer and senior-review status
              of your projects.
            </p>
          </div>

          {ownerReviews.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-6 text-sm text-slate-400">
              No review requests have been created yet.
            </div>
          ) : (
            <div className="space-y-4">
              {ownerReviews.map(
                (review) => {
                  const project =
                    getProjectById(
                      review.project_id
                    );

                  return (
                    <div
                      key={review.id}
                      className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold">
                              {project?.project_name ??
                                `Project #${review.project_id}`}
                            </h3>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                                review.status ===
                                "approved"
                                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                  : review.status ===
                                    "rejected"
                                  ? "border-red-400/20 bg-red-400/10 text-red-300"
                                  : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                              }`}
                            >
                              {getStatusLabel(
                                review.status
                              )}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-400">
                            {getRoleLabel(
                              review.reviewer_role
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Review created{" "}
                            {formatDate(
                              review.created_at
                            )}
                          </p>
                        </div>

                        <div className="text-left lg:text-right">
                          {review.score !==
                            null && (
                            <p className="text-xl font-bold text-blue-400">
                              {review.score}
                              /100
                            </p>
                          )}

                          {review.reviewed_at && (
                            <p className="mt-1 text-xs text-slate-500">
                              Reviewed{" "}
                              {formatDate(
                                review.reviewed_at
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {review.feedback && (
                        <div className="mt-5 rounded-xl border border-slate-800 bg-[#0a1120] p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Reviewer feedback
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {review.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ==================================================
            INCOMING REVIEWS
            ================================================== */}

        <section className="mb-8">
          <div className="mb-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Incoming Peer Reviews
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Reviews assigned to your account.
                </p>
              </div>

              {currentUserId ===
                DEMO_PEER_REVIEWER_ID && (
                <div className="rounded-full border border-blue-400/20 bg-blue-400/5 px-3 py-1.5 text-xs font-medium text-blue-300">
                  👤 Test Peer Reviewer
                </div>
              )}
            </div>
          </div>

          {incomingPeerReviews.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-6">
              <p className="text-sm text-slate-400">
                No peer-review requests are assigned to this
                account yet.
              </p>

              {currentUserId !==
                DEMO_PEER_REVIEWER_ID && (
                <p className="mt-2 text-xs text-slate-500">
                  Log in with reviewer@gmail.com to test the
                  peer-review side.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {incomingPeerReviews.map(
                (review) => {
                  const project =
                    getProjectById(
                      review.project_id
                    );

                  const isPending =
                    review.status ===
                    "pending";

                  return (
                    <div
                      key={review.id}
                      className="rounded-2xl border border-slate-800 bg-[#0f172a] p-6 shadow-lg shadow-black/10"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-blue-400/20 bg-blue-400/5 px-2.5 py-1 text-xs font-medium text-blue-300">
                              Peer Review
                            </span>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                                review.status ===
                                "approved"
                                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                  : review.status ===
                                    "rejected"
                                  ? "border-red-400/20 bg-red-400/10 text-red-300"
                                  : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                              }`}
                            >
                              {getStatusLabel(
                                review.status
                              )}
                            </span>
                          </div>

                          <h3 className="mt-4 text-xl font-bold">
                            {project?.project_name ??
                              `Project #${review.project_id}`}
                          </h3>

                          {project ? (
                            <>
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {project.description ||
                                  "No project description provided."}
                              </p>

                              {project.github_repo && (
                                <p className="mt-3 text-xs text-slate-500">
                                  GitHub:{" "}
                                  <span className="font-mono text-slate-300">
                                    {project.github_owner}/
                                    {project.github_repo}
                                  </span>
                                </p>
                              )}

                              {project.verification_score !==
                                null && (
                                <p className="mt-2 text-xs text-slate-500">
                                  Evidence score:{" "}
                                  <span className="font-semibold text-blue-400">
                                    {
                                      project.verification_score
                                    }
                                    /100
                                  </span>
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500">
                              Project ID:{" "}
                              {review.project_id}
                            </p>
                          )}
                        </div>

                        {review.status !==
                          "pending" && (
                          <div
                            className={`rounded-xl px-4 py-3 text-sm ${
                              review.status ===
                              "approved"
                                ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                : "border border-red-400/20 bg-red-400/10 text-red-300"
                            }`}
                          >
                            {review.status ===
                            "approved"
                              ? "✅ Review approved"
                              : "❌ Review rejected"}
                          </div>
                        )}
                      </div>

                      {isPending && (
                        <div className="mt-6 grid gap-5 border-t border-slate-800 pt-6">
                          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
                            <div>
                              <label
                                htmlFor={`score-${review.id}`}
                                className="mb-2 block text-sm font-medium text-slate-300"
                              >
                                Review Score
                              </label>

                              <input
                                id={`score-${review.id}`}
                                type="number"
                                min="0"
                                max="100"
                                value={
                                  reviewScores[
                                    review.id
                                  ] ?? ""
                                }
                                onChange={(
                                  event
                                ) => {
                                  setReviewScores(
                                    (
                                      previous
                                    ) => ({
                                      ...previous,
                                      [review.id]:
                                        event
                                          .target
                                          .value,
                                    })
                                  );
                                }}
                                placeholder="0 - 100"
                                className="w-full rounded-xl border border-slate-700 bg-[#0a1120] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`feedback-${review.id}`}
                                className="mb-2 block text-sm font-medium text-slate-300"
                              >
                                Feedback
                              </label>

                              <textarea
                                id={`feedback-${review.id}`}
                                rows={4}
                                value={
                                  reviewFeedback[
                                    review.id
                                  ] ?? ""
                                }
                                onChange={(
                                  event
                                ) => {
                                  setReviewFeedback(
                                    (
                                      previous
                                    ) => ({
                                      ...previous,
                                      [review.id]:
                                        event
                                          .target
                                          .value,
                                    })
                                  );
                                }}
                                placeholder="Explain what is good, what needs improvement, and whether the project demonstrates genuine work."
                                className="w-full resize-none rounded-xl border border-slate-700 bg-[#0a1120] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              disabled={
                                actionLoading !==
                                null
                              }
                              onClick={() => {
                                void completePeerReview(
                                  review,
                                  "reject_peer_review"
                                );
                              }}
                              className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {actionLoading ===
                              review.id
                                ? "Saving..."
                                : "❌ Reject"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                actionLoading !==
                                null
                              }
                              onClick={() => {
                                void completePeerReview(
                                  review,
                                  "approve_peer_review"
                                );
                              }}
                              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {actionLoading ===
                              review.id
                                ? "Saving..."
                                : "✅ Approve"}
                            </button>
                          </div>
                        </div>
                      )}

                      {review.feedback &&
                        !isPending && (
                          <div className="mt-5 rounded-xl border border-slate-800 bg-[#0a1120] p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Submitted feedback
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {review.feedback}
                            </p>

                            {review.score !==
                              null && (
                              <p className="mt-3 text-xs text-slate-500">
                                Score:{" "}
                                <span className="font-semibold text-blue-400">
                                  {review.score}
                                  /100
                                </span>
                              </p>
                            )}
                          </div>
                        )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ==================================================
            WORKFLOW INFO
            ================================================== */}

        <section className="rounded-2xl border border-blue-400/10 bg-blue-400/5 p-6">
          <h2 className="text-lg font-bold text-white">
            Verification Workflow
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0a1120] p-4">
              <div className="text-xl">
                ✅
              </div>

              <p className="mt-2 font-semibold">
                GitHub Evidence
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Real repository activity is collected.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0a1120] p-4">
              <div className="text-xl">
                ⏳
              </div>

              <p className="mt-2 font-semibold">
                Peer Review
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Another Vertex user checks the project.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0a1120] p-4">
              <div className="text-xl">
                🔒
              </div>

              <p className="mt-2 font-semibold">
                Senior Review
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Available after peer approval.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0a1120] p-4">
              <div className="text-xl">
                🏆
              </div>

              <p className="mt-2 font-semibold">
                Verified Project
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Final approval completes verification.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}