"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type Project = {
  id: number;
  user_id: string;
  project_name: string;
  description: string;
  tech_stack: string;
  project_url: string;
  created_at: string;

  verification_status?: string | null;
  github_owner?: string | null;
  github_repo?: string | null;
  github_repo_id?: number | null;
  github_url?: string | null;
  verified_at?: string | null;
  verification_score?: number | null;
};

type GithubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  language?: string | null;
  description?: string | null;
};

type ProjectReview = {
  id: string;
  project_id: number;
  reviewer_id: string;
  reviewer_role: "peer" | "senior";
  status: "pending" | "approved" | "rejected";
  score?: number | null;
  feedback?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

type GithubEvidence = {
  id: string;
  project_id: number;
  github_repo_id?: number | null;
  github_owner?: string | null;
  github_repo?: string | null;
  github_url?: string | null;
  default_branch?: string | null;
  commit_count?: number | null;
  pull_request_count?: number | null;
  contributor_count?: number | null;
  first_commit_at?: string | null;
  last_commit_at?: string | null;
  evidence_type?: string | null;
  fetched_at?: string | null;
};

const TEMPORARY_SENIOR_REVIEWER_ID =
  "52ec5af2-011c-4b0f-a441-77225d66be5c";

const TEMPORARY_SENIOR_REVIEWER_EMAIL =
  "reviewer@gmail.com";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [repositories, setRepositories] = useState<
    GithubRepository[]
  >([]);

  const [reviews, setReviews] = useState<
    Record<number, ProjectReview[]>
  >({});

  const [evidence, setEvidence] = useState<
    Record<number, GithubEvidence | null>
  >({});

  const [loading, setLoading] = useState(true);
  const [loadingRepositories, setLoadingRepositories] =
    useState(false);

  const [addingProject, setAddingProject] =
    useState(false);

  const [verifyingProjectId, setVerifyingProjectId] =
    useState<number | null>(null);

  const [requestingPeerId, setRequestingPeerId] =
    useState<number | null>(null);

  const [requestingSeniorId, setRequestingSeniorId] =
    useState<number | null>(null);

  const [deletingProjectId, setDeletingProjectId] =
    useState<number | null>(null);

  const [selectedRepository, setSelectedRepository] =
    useState<Record<number, string>>({});

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [projectName, setProjectName] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("");

  /*
   * =========================================================
   * LOAD PROJECTS
   * =========================================================
   */

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "Session loading error:",
          sessionError
        );

        setError(
          "Unable to load your login session."
        );

        return;
      }

      if (!session?.user) {
        setError(
          "Please log in to view your projects."
        );

        return;
      }

      const user = session.user;

      console.log(
        "CURRENT USER:",
        user.id
      );

      const {
        data,
        error: projectsError,
      } = await supabase
        .from("projects")
        .select(
          `
            id,
            user_id,
            project_name,
            description,
            tech_stack,
            project_url,
            created_at,
            verification_status,
            github_owner,
            github_repo,
            github_repo_id,
            github_url,
            verified_at,
            verification_score
          `
        )
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      console.log(
        "CURRENT USER:",
        user.id
      );

      console.log(
        "PROJECTS DATA:",
        data
      );

      console.log(
        "PROJECTS ERROR:",
        projectsError
      );

      if (projectsError) {
        console.error(
          "Projects loading error:",
          projectsError
        );

        setError(
          projectsError.message
        );

        return;
      }

      setProjects(
        (data ?? []) as Project[]
      );
    } catch (err) {
      console.error(
        "Projects loading error:",
        err
      );

      setError(
        "Unable to load projects."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * =========================================================
   * LOAD REVIEWS
   * =========================================================
   */

  const loadReviews = useCallback(
    async (projectList: Project[]) => {
      if (!projectList.length) {
        setReviews({});
        return;
      }

      try {
        const projectIds =
          projectList.map(
            (project) => project.id
          );

        const {
          data,
          error: reviewsError,
        } = await supabase
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
          .order("created_at", {
            ascending: false,
          });

        if (reviewsError) {
          console.error(
            "Project reviews loading error:",
            reviewsError
          );

          return;
        }

        const grouped: Record<
          number,
          ProjectReview[]
        > = {};

        for (const review of (data ??
          []) as ProjectReview[]) {
          if (!grouped[review.project_id]) {
            grouped[review.project_id] = [];
          }

          grouped[review.project_id].push(
            review
          );
        }

        setReviews(grouped);
      } catch (err) {
        console.error(
          "Review loading error:",
          err
        );
      }
    },
    []
  );

  /*
   * =========================================================
   * LOAD GITHUB EVIDENCE
   * =========================================================
   */

  const loadEvidence = useCallback(
    async (projectList: Project[]) => {
      if (!projectList.length) {
        setEvidence({});
        return;
      }

      try {
        const projectIds =
          projectList.map(
            (project) => project.id
          );

        const {
          data,
          error: evidenceError,
        } = await supabase
          .from(
            "project_verification_evidence"
          )
          .select(
            `
              id,
              project_id,
              github_repo_id,
              github_owner,
              github_repo,
              github_url,
              default_branch,
              commit_count,
              pull_request_count,
              contributor_count,
              first_commit_at,
              last_commit_at,
              evidence_type,
              fetched_at
            `
          )
          .in(
            "project_id",
            projectIds
          );

        if (evidenceError) {
          console.error(
            "Evidence loading error:",
            evidenceError
          );

          return;
        }

        const grouped: Record<
          number,
          GithubEvidence | null
        > = {};

        for (const project of projectList) {
          grouped[project.id] = null;
        }

        for (const item of (data ??
          []) as GithubEvidence[]) {
          grouped[item.project_id] = item;
        }

        setEvidence(grouped);
      } catch (err) {
        console.error(
          "Evidence loading error:",
          err
        );
      }
    },
    []
  );

  /*
   * =========================================================
   * INITIAL LOAD
   * =========================================================
   */

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadProjects();
      }, 0);

    return () =>
      window.clearTimeout(timeoutId);
  }, [loadProjects]);

  /*
   * =========================================================
   * LOAD REVIEWS + EVIDENCE
   * =========================================================
   */

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadReviews(projects);
        void loadEvidence(projects);
      }, 0);

    return () =>
      window.clearTimeout(timeoutId);
  }, [
    projects,
    loadReviews,
    loadEvidence,
  ]);

  /*
   * =========================================================
   * LOAD GITHUB REPOSITORIES
   * =========================================================
   */

  const loadRepositories = useCallback(
    async () => {
  try {
    setLoadingRepositories(true);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      console.error(
        "No active Vertex session found."
      );

      return;
    }

    const providerToken =
  session.provider_token;

    if (!providerToken) {
      console.error(
        "GitHub provider token is missing."
      );

      return;
    }

    const response = await fetch(
      "/api/github/repositories",
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
          "X-GitHub-Provider-Token":
            providerToken,
        },
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(
        "GitHub repositories error:",
        result
      );

      return;
    }

    console.log(
      "GITHUB REPOSITORIES:",
      result.repositories
    );

    setRepositories(
      result.repositories ?? []
    );
  } catch (err) {
    console.error(
      "GitHub repository loading error:",
      err
    );
  } finally {
    setLoadingRepositories(false);
  }
},
[]
  );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadRepositories();
      }, 0);

    return () =>
      window.clearTimeout(timeoutId);
  }, [loadRepositories]);

  /*
   * =========================================================
   * ADD PROJECT
   * =========================================================
   */

  const handleAddProject = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (
      !projectName.trim() ||
      !projectUrl.trim()
    ) {
      setError(
        "Project name and project URL are required."
      );

      return;
    }

    try {
      setAddingProject(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "Please log in first."
        );

        return;
      }

      const {
        error: insertError,
      } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          project_name:
            projectName.trim(),
          project_url:
            projectUrl.trim(),
          description:
            description.trim(),
          tech_stack:
            techStack.trim(),
          verification_status:
            "pending",
          verification_score: 0,
        } as never);

      if (insertError) {
        console.error(
          "Project insert error:",
          insertError
        );

        setError(
          insertError.message
        );

        return;
      }

      setProjectName("");
      setProjectUrl("");
      setDescription("");
      setTechStack("");

      setMessage(
        "Project added successfully."
      );

      await loadProjects();
    } catch (err) {
      console.error(
        "Add project error:",
        err
      );

      setError(
        "Unable to add project."
      );
    } finally {
      setAddingProject(false);
    }
  };

  /*
   * =========================================================
   * GITHUB VERIFICATION
   * =========================================================
   */

  const handleVerifyGithub = async (
    project: Project
  ) => {
    setMessage("");
    setError("");

    /*
     * IMPORTANT:
     *
     * If the user has explicitly selected a repository,
     * use that value.
     *
     * Otherwise fall back to the GitHub repository already
     * saved on the project.
     */
    const repositoryFullName =
      selectedRepository[project.id] ??
      (
        project.github_owner &&
        project.github_repo
          ? `${project.github_owner}/${project.github_repo}`
          : ""
      );

    console.log(
      "VERIFY GITHUB PROJECT:",
      project.project_name
    );

    console.log(
      "SELECTED REPOSITORY:",
      repositoryFullName
    );

    if (!repositoryFullName) {
      setError(
        "Please select a GitHub repository first."
      );

      return;
    }

    const repository =
      repositories.find(
        (repo) =>
          repo.full_name ===
          repositoryFullName
      );

    console.log(
      "MATCHED GITHUB REPOSITORY:",
      repository
    );

    if (!repository) {
      setError(
        "Selected GitHub repository could not be found."
      );

      return;
    }

    try {
      setVerifyingProjectId(
        project.id
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError(
          "Your session has expired. Please log in again."
        );

        return;
      }

      const providerToken =
  session.provider_token;

      if (!providerToken) {
        setError(
          "GitHub connection token is missing. Please reconnect GitHub."
        );

        return;
      }

      console.log(
        "STARTING GITHUB VERIFICATION..."
      );

      const response =
        await fetch(
          "/api/github/verify",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              project_id:
                project.id,

              github_owner:
                repository.full_name.split(
                  "/"
                )[0],

              github_repo:
                repository.name,

              provider_token:
                providerToken,
            }),
          }
        );

      const result =
        await response.json();

      console.log(
        "GITHUB VERIFY STATUS:",
        response.status
      );

      console.log(
        "GITHUB VERIFY RESPONSE:",
        result
      );

      if (!response.ok) {
        console.error(
          "GitHub verification error:",
          result
        );

        setError(
          result.error ||
            "GitHub verification failed."
        );

        return;
      }

      setMessage(
        "GitHub verification completed successfully."
      );

      /*
       * Refresh projects first.
       */
      await loadProjects();

      /*
       * Refresh evidence directly so the latest
       * GitHub statistics appear immediately.
       */
      const {
        data: { session: refreshedSession },
      } = await supabase.auth.getSession();

      if (refreshedSession?.user) {
        const {
          data: refreshedProjects,
          error: refreshedProjectsError,
        } = await supabase
          .from("projects")
          .select(
            `
              id,
              user_id,
              project_name,
              description,
              tech_stack,
              project_url,
              created_at,
              verification_status,
              github_owner,
              github_repo,
              github_repo_id,
              github_url,
              verified_at,
              verification_score
            `
          )
          .eq(
            "user_id",
            refreshedSession.user.id
          )
          .order("created_at", {
            ascending: false,
          });

        if (refreshedProjectsError) {
          console.error(
            "Refreshed projects error:",
            refreshedProjectsError
          );
        } else if (refreshedProjects) {
          await loadEvidence(
            refreshedProjects as Project[]
          );
        }
      }
    } catch (err) {
      console.error(
        "GitHub verification error:",
        err
      );

      setError(
        "Unable to verify GitHub project."
      );
    } finally {
      setVerifyingProjectId(
        null
      );
    }
  };

  /*
   * =========================================================
   * REQUEST PEER REVIEW
   * =========================================================
   */

  const handleRequestPeerReview =
    async (project: Project) => {
      setMessage("");
      setError("");

      try {
        setRequestingPeerId(
          project.id
        );

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setError(
            "Your session has expired. Please log in again."
          );

          return;
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
                  `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action:
                  "request_peer_review",
                project_id:
                  project.id,
                reviewer_id:
                  TEMPORARY_SENIOR_REVIEWER_ID,
              }),
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          console.error(
            "Peer review request error:",
            result
          );

          setError(
            result.error ||
              "Unable to request peer review."
          );

          return;
        }

        setMessage(
          "Peer review requested successfully."
        );

        await loadProjects();
      } catch (err) {
        console.error(
          "Peer review request error:",
          err
        );

        setError(
          "Unable to request peer review."
        );
      } finally {
        setRequestingPeerId(
          null
        );
      }
    };

  /*
   * =========================================================
   * REQUEST SENIOR REVIEW
   * =========================================================
   */

  const handleRequestSeniorReview =
    async (project: Project) => {
      setMessage("");
      setError("");

      try {
        setRequestingSeniorId(
          project.id
        );

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setError(
            "Your session has expired. Please log in again."
          );

          return;
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
                  `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action:
                  "request_senior_review",
                project_id:
                  project.id,
                reviewer_id:
                  TEMPORARY_SENIOR_REVIEWER_ID,
              }),
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          console.error(
            "Senior review request error:",
            result
          );

          setError(
            result.error ||
              "Unable to request senior review."
          );

          return;
        }

        setMessage(
          `Senior review requested successfully. Assigned to ${TEMPORARY_SENIOR_REVIEWER_EMAIL}.`
        );

        await loadProjects();
      } catch (err) {
        console.error(
          "Senior review request error:",
          err
        );

        setError(
          "Unable to request senior review."
        );
      } finally {
        setRequestingSeniorId(
          null
        );
      }
    };

  /*
   * =========================================================
   * DELETE PROJECT
   * =========================================================
   */

  const handleDeleteProject =
    async (project: Project) => {
      const confirmed =
        window.confirm(
          `Delete "${project.project_name}"? This cannot be undone.`
        );

      if (!confirmed) return;

      setMessage("");
      setError("");

      try {
        setDeletingProjectId(
          project.id
        );

        const {
          error: deleteError,
        } = await supabase
          .from("projects")
          .delete()
          .eq(
            "id",
            project.id
          );

        if (deleteError) {
          console.error(
            "Delete project error:",
            deleteError
          );

          setError(
            deleteError.message
          );

          return;
        }

        setMessage(
          "Project deleted successfully."
        );

        await loadProjects();
      } catch (err) {
        console.error(
          "Delete project error:",
          err
        );

        setError(
          "Unable to delete project."
        );
      } finally {
        setDeletingProjectId(
          null
        );
      }
    };

  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */

  const getProjectReviews =
    (projectId: number) =>
      reviews[projectId] ?? [];

  const getPeerReview =
    (projectId: number) =>
      getProjectReviews(
        projectId
      ).find(
        (review) =>
          review.reviewer_role ===
          "peer"
      );

  const getSeniorReview =
    (projectId: number) =>
      getProjectReviews(
        projectId
      ).find(
        (review) =>
          review.reviewer_role ===
          "senior"
      );

  const hasApprovedPeerReview =
    (projectId: number) =>
      getProjectReviews(
        projectId
      ).some(
        (review) =>
          review.reviewer_role ===
            "peer" &&
          review.status ===
            "approved"
      );

  const hasSeniorReview =
    (projectId: number) =>
      getProjectReviews(
        projectId
      ).some(
        (review) =>
          review.reviewer_role ===
          "senior"
      );

  const getWorkflowState =
    (project: Project) => {
      const peer =
        getPeerReview(
          project.id
        );

      const senior =
        getSeniorReview(
          project.id
        );

      if (
        project.verification_status ===
        "verified"
      ) {
        return {
          label: "Verified Project",
          description:
            "This project has passed the verification workflow.",
          color:
            "text-emerald-400",
        };
      }

      if (
        senior?.status ===
        "approved"
      ) {
        return {
          label:
            "Senior Review Approved",
          description:
            "Senior review has been approved.",
          color:
            "text-emerald-400",
        };
      }

      if (
        senior?.status ===
        "pending"
      ) {
        return {
          label:
            "Senior Review Pending",
          description:
            "Your project is waiting for senior review.",
          color:
            "text-purple-400",
        };
      }

      if (
        peer?.status ===
        "approved"
      ) {
        return {
          label:
            "Peer Review Approved",
          description:
            "Peer review passed. Your project can now move to senior review.",
          color:
            "text-emerald-400",
        };
      }

      if (
        peer?.status ===
        "pending"
      ) {
        return {
          label:
            "Peer Review Pending",
          description:
            "Your project is currently being reviewed by a peer.",
          color:
            "text-amber-400",
        };
      }

      if (
        peer?.status ===
        "rejected"
      ) {
        return {
          label:
            "Peer Review Rejected",
          description:
            "The peer review was rejected. Review the feedback before requesting another review.",
          color:
            "text-red-400",
        };
      }

      return {
        label:
          "GitHub Verification Complete",
        description:
          "Your GitHub evidence is ready. Send this project to a peer reviewer.",
        color:
          "text-cyan-400",
      };
    };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* HEADER */}
        <div className="mb-10">
          <p className="mb-2 text-sm font-medium text-cyan-400">
            Vertex Project Portfolio
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Projects
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Build your project portfolio,
            connect GitHub, verify your work,
            and move through the peer and
            senior verification workflow.
          </p>
        </div>

        {/* MESSAGES */}
        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* GITHUB */}
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/3 p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                GitHub Integration
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                GitHub Account Connected
              </h2>

              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Connect GitHub so Vertex can
                collect repository evidence for
                your project verification.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={
                  loadRepositories
                }
                disabled={
                  loadingRepositories
                }
                className="rounded-xl border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/8 disabled:opacity-50"
              >
                {loadingRepositories
                  ? "Refreshing..."
                  : "Refresh Repositories"}
              </button>

              <Link
                href="/login"
                className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20"
              >
                Reconnect GitHub
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
              ✓
            </div>

            <div>
              <p className="font-medium text-white">
                Connected
              </p>

              <p className="text-sm text-slate-400">
                {repositories.length} repositories loaded
              </p>
            </div>
          </div>
        </section>

        {/* ADD PROJECT */}
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/3 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Portfolio
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Add a Project
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Add a project that you want to
            showcase and verify through Vertex.
          </p>

          <form
            onSubmit={
              handleAddProject
            }
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Project Name
              </label>

              <input
                value={projectName}
                onChange={(event) =>
                  setProjectName(
                    event.target.value
                  )
                }
                placeholder="Live Bus Tracking"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Project URL
              </label>

              <input
                value={projectUrl}
                onChange={(event) =>
                  setProjectUrl(
                    event.target.value
                  )
                }
                placeholder="https://your-project.vercel.app"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-300">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Describe what your project does..."
                className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Tech Stack
              </label>

              <input
                value={techStack}
                onChange={(event) =>
                  setTechStack(
                    event.target.value
                  )
                }
                placeholder="Next.js, Supabase, TypeScript"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={addingProject}
                className="w-full rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addingProject
                  ? "Adding..."
                  : "Add Project"}
              </button>
            </div>
          </form>
        </section>

        {/* PROJECTS */}
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Your Work
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Project Portfolio
              </h2>
            </div>

            <span className="text-sm text-slate-500">
              {projects.length}{" "}
              {projects.length === 1
                ? "Project"
                : "Projects"}
            </span>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/3 p-8 text-center text-slate-400">
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/2 p-10 text-center">
              <h3 className="text-lg font-semibold">
                No projects yet
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Add your first project above.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {projects.map(
                (project) => {
                  const peerReview =
                    getPeerReview(
                      project.id
                    );

                  const seniorReview =
                    getSeniorReview(
                      project.id
                    );

                  const projectEvidence =
                    evidence[
                      project.id
                    ];

                  const workflow =
                    getWorkflowState(
                      project
                    );

                  const peerApproved =
                    hasApprovedPeerReview(
                      project.id
                    );

                  const seniorRequested =
                    hasSeniorReview(
                      project.id
                    );

                  return (
                    <article
                      key={project.id}
                      className="overflow-hidden rounded-3xl border border-white/10 bg-white/3"
                    >
                      {/* PROJECT HEADER */}
                      <div className="border-b border-white/10 p-6">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="mb-3 flex flex-wrap items-center gap-3">
                              <h3 className="text-2xl font-semibold">
                                {
                                  project.project_name
                                }
                              </h3>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                  project.verification_status ===
                                  "verified"
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                    : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                                }`}
                              >
                                {project.verification_status ===
                                "verified"
                                  ? "Verified"
                                  : workflow.label}
                              </span>
                            </div>

                            <p className="max-w-3xl text-sm leading-6 text-slate-400">
                              {
                                project.description
                              }
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {project.tech_stack
                                ?.split(",")
                                .map(
                                  (
                                    tech
                                  ) => (
                                    <span
                                      key={tech}
                                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300"
                                    >
                                      {tech.trim()}
                                    </span>
                                  )
                                )}
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3">
                              <a
                                href={
                                  project.project_url
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/8"
                              >
                                Live Project ↗
                              </a>

                              {project.github_url && (
                                <a
                                  href={
                                    project.github_url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-xl border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/8"
                                >
                                  GitHub Repository ↗
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="min-w-45 rounded-2xl border border-cyan-400/10 bg-cyan-400/3 p-4">
                            <p className="text-xs uppercase tracking-wider text-slate-500">
                              Verification Score
                            </p>

                            <p className="mt-2 text-3xl font-bold text-cyan-300">
                              {
                                project.verification_score ??
                                0
                              }
                              <span className="text-base font-normal text-slate-500">
                                /25
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* GITHUB */}
                      <div className="border-b border-white/10 p-6">
                        <div className="mb-5 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                            🔗
                          </div>

                          <div>
                            <h4 className="font-semibold">
                              GitHub Evidence
                            </h4>

                            <p className="text-sm text-slate-500">
                              Select the GitHub repository associated with this project.
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                          <select
                            value={
                              selectedRepository[
                                project.id
                              ] ??
                              (
                                project.github_owner &&
                                project.github_repo
                                  ? `${project.github_owner}/${project.github_repo}`
                                  : ""
                              )
                            }
                            onChange={(
                              event
                            ) =>
                              setSelectedRepository(
                                (
                                  previous
                                ) => ({
                                  ...previous,
                                  [project.id]:
                                    event.target.value,
                                })
                              )
                            }
                            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                          >
                            <option
                              value=""
                              className="bg-slate-900"
                            >
                              Select a repository
                            </option>

                            {repositories.map(
                              (
                                repo
                              ) => (
                                <option
                                  key={
                                    repo.id
                                  }
                                  value={
                                    repo.full_name
                                  }
                                  className="bg-slate-900"
                                >
                                  {
                                    repo.full_name
                                  }
                                  {repo.private
                                    ? " (Private)"
                                    : ""}
                                </option>
                              )
                            )}
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              handleVerifyGithub(
                                project
                              )
                            }
                            disabled={
                              verifyingProjectId ===
                              project.id
                            }
                            className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {verifyingProjectId ===
                            project.id
                              ? "Verifying..."
                              : "Verify GitHub Project"}
                          </button>
                        </div>

                        {projectEvidence && (
                          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <p className="text-xs text-slate-500">
                                Commits
                              </p>

                              <p className="mt-1 text-xl font-semibold">
                                {
                                  projectEvidence.commit_count ??
                                  0
                                }
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <p className="text-xs text-slate-500">
                                Pull Requests
                              </p>

                              <p className="mt-1 text-xl font-semibold">
                                {
                                  projectEvidence.pull_request_count ??
                                  0
                                }
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <p className="text-xs text-slate-500">
                                Contributors
                              </p>

                              <p className="mt-1 text-xl font-semibold">
                                {
                                  projectEvidence.contributor_count ??
                                  0
                                }
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <p className="text-xs text-slate-500">
                                Branch
                              </p>

                              <p className="mt-1 text-xl font-semibold">
                                {
                                  projectEvidence.default_branch ??
                                  "—"
                                }
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* PEER REVIEW */}
                      <div className="border-b border-white/10 p-6">
                        <div className="mb-5 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
                            👥
                          </div>

                          <div>
                            <h4 className="font-semibold">
                              Peer Review
                            </h4>

                            <p className="text-sm text-slate-500">
                              Your GitHub evidence is ready. Send this project to a peer reviewer for the next verification step.
                            </p>
                          </div>
                        </div>

                        {peerReview ? (
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm text-slate-400">
                                  Peer Review Status
                                </p>

                                <p
                                  className={`mt-1 font-semibold ${
                                    peerReview.status ===
                                    "approved"
                                      ? "text-emerald-400"
                                      : peerReview.status ===
                                        "rejected"
                                      ? "text-red-400"
                                      : "text-amber-400"
                                  }`}
                                >
                                  {peerReview.status
                                    .charAt(
                                      0
                                    )
                                    .toUpperCase() +
                                    peerReview.status.slice(
                                      1
                                    )}
                                </p>
                              </div>

                              {peerReview.score !=
                                null && (
                                <div>
                                  <p className="text-sm text-slate-400">
                                    Peer Score
                                  </p>

                                  <p className="mt-1 text-2xl font-bold text-white">
                                    {
                                      peerReview.score
                                    }
                                    <span className="text-sm text-slate-500">
                                      /100
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>

                            {peerReview.feedback && (
                              <div className="mt-4 rounded-xl border border-white/10 bg-white/2 p-4">
                                <p className="text-xs uppercase tracking-wider text-slate-500">
                                  Feedback
                                </p>

                                <p className="mt-2 text-sm leading-6 text-slate-300">
                                  {
                                    peerReview.feedback
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm text-slate-400">
                                  Assigned Peer Reviewer
                                </p>

                                <p className="mt-1 font-medium text-white">
                                  reviewer@gmail.com
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRequestPeerReview(
                                    project
                                  )
                                }
                                disabled={
                                  requestingPeerId ===
                                  project.id
                                }
                                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {requestingPeerId ===
                                project.id
                                  ? "Requesting..."
                                  : "Request Peer Review"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* SENIOR REVIEW */}
                      <div className="border-b border-white/10 p-6">
                        <div className="mb-5 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-400/10 text-purple-300">
                            ★
                          </div>

                          <div>
                            <h4 className="font-semibold">
                              Senior Review
                            </h4>

                            <p className="text-sm text-slate-500">
                              After peer approval, your project moves to senior verification.
                            </p>
                          </div>
                        </div>

                        {!peerApproved ? (
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                            <p className="text-sm text-slate-500">
                              Senior review becomes available after your peer review is approved.
                            </p>
                          </div>
                        ) : seniorRequested ? (
                          <div className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm text-slate-400">
                                  Senior Review
                                </p>

                                <p className="mt-1 font-semibold text-purple-300">
                                  {seniorReview?.status ===
                                  "approved"
                                    ? "Approved"
                                    : seniorReview?.status ===
                                      "rejected"
                                    ? "Rejected"
                                    : "Pending Review"}
                                </p>

                                <p className="mt-2 text-sm text-slate-500">
                                  Assigned to{" "}
                                  {
                                    TEMPORARY_SENIOR_REVIEWER_EMAIL
                                  }
                                </p>
                              </div>

                              {seniorReview?.score !=
                                null && (
                                <div>
                                  <p className="text-sm text-slate-400">
                                    Senior Score
                                  </p>

                                  <p className="mt-1 text-2xl font-bold text-white">
                                    {
                                      seniorReview.score
                                    }
                                    <span className="text-sm text-slate-500">
                                      /100
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/4 p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-medium text-emerald-300">
                                  Peer Review Approved
                                </p>

                                <p className="mt-1 text-sm text-slate-400">
                                  Your project is eligible for senior verification.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRequestSeniorReview(
                                    project
                                  )
                                }
                                disabled={
                                  requestingSeniorId ===
                                  project.id
                                }
                                className="rounded-xl bg-purple-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {requestingSeniorId ===
                                project.id
                                  ? "Requesting..."
                                  : "Request Senior Review"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* WORKFLOW */}
                      <div className="p-6">
                        <div className="mb-5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Verification Workflow
                          </p>

                          <h4 className="mt-2 text-lg font-semibold">
                            From GitHub Evidence to Verified Project
                          </h4>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/3 p-5">
                            <span className="text-xs font-bold text-cyan-400">
                              01
                            </span>

                            <h5 className="mt-3 font-semibold">
                              GitHub Evidence
                            </h5>

                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              Vertex collects repository activity such as commits, pull requests, and contributors.
                            </p>
                          </div>

                          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/3 p-5">
                            <span className="text-xs font-bold text-amber-400">
                              02
                            </span>

                            <h5 className="mt-3 font-semibold">
                              Peer Review
                            </h5>

                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              A peer reviewer evaluates the project evidence and provides a review score and feedback.
                            </p>

                            {peerReview?.status ===
                              "approved" && (
                              <p className="mt-3 text-xs font-medium text-emerald-400">
                                ✓ Approved
                              </p>
                            )}
                          </div>

                          <div className="rounded-2xl border border-purple-400/20 bg-purple-400/3 p-5">
                            <span className="text-xs font-bold text-purple-400">
                              03
                            </span>

                            <h5 className="mt-3 font-semibold">
                              Senior Review
                            </h5>

                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              After peer approval, the project proceeds to senior review before final verification.
                            </p>

                            {seniorReview && (
                              <p className="mt-3 text-xs font-medium text-purple-300">
                                {seniorReview.status ===
                                "approved"
                                  ? "✓ Approved"
                                  : seniorReview.status ===
                                    "pending"
                                  ? "⏳ Pending"
                                  : "Rejected"}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* DELETE */}
                        <div className="mt-6 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteProject(
                                project
                              )
                            }
                            disabled={
                              deletingProjectId ===
                              project.id
                            }
                            className="rounded-xl border border-red-400/10 bg-red-400/3 px-4 py-2 text-sm text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                          >
                            {deletingProjectId ===
                            project.id
                              ? "Deleting..."
                              : "Delete Project"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}