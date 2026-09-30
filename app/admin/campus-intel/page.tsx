
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Submission = {
  id: string;
  user_id: string;
  college_id: string | null;
  submission_type: string;
  title: string;
  content: string;
  company_name: string | null;
  role: string | null;
  visit_year: number | null;
  moderation_status: "pending" | "approved" | "rejected";
  moderator_notes: string | null;
  moderated_at: string | null;
  created_at: string;
  published_at: string | null;
  published_by: string | null;
  published_visit_id: string | null;
};

type Filter = "all" | "pending" | "approved" | "rejected";

const submissionTypeLabels: Record<string, string> = {
  company_visit: "Company Visit",
  interview_report: "Interview Report",
  interview_question: "Interview Question",
  cutoff: "Placement Cutoff",
  experience: "Placement Experience",
  other: "Other",
};

export default function CampusIntelAdminPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);
  const [moderatorNotes, setModeratorNotes] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /*
   * Load submissions
   */
  const loadSubmissions = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("campus_intel_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Submissions query failed:", queryError);
      setError(queryError.message);
      return;
    }

    setSubmissions((data ?? []) as Submission[]);
  }, []);

  /*
   * Verify admin and load dashboard
   */
  const checkAdminAndLoad = useCallback(async () => {
    setCheckingAdmin(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setIsAdmin(false);
        setError("Please log in to access the admin dashboard.");
        return;
      }

      const { data: adminRecord, error: adminError } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) throw adminError;

      if (!adminRecord) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
      await loadSubmissions();
    } catch (err) {
      console.error("Admin check failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify admin access."
      );
    } finally {
      setCheckingAdmin(false);
      setLoading(false);
    }
  }, [loadSubmissions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkAdminAndLoad();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [checkAdminAndLoad]);

  /*
   * Generate semantic embedding for approved interview questions
   */
  async function generateInterviewEmbedding(
    submission: Submission
  ): Promise<{ success: boolean; message: string }> {
    if (submission.submission_type !== "interview_question") {
      return {
        success: true,
        message: "No interview embedding required.",
      };
    }

    const { data: report, error: reportError } = await supabase
      .from("campus_interview_reports")
      .select(
        "id, difficulty, overall_experience, preparation_advice"
      )
      .eq("source_submission_id", submission.id)
      .maybeSingle();

    if (reportError) {
      console.error("Interview report lookup failed:", reportError);
      return {
        success: false,
        message:
          "Submission approved, but the linked interview report could not be found.",
      };
    }

    if (!report) {
      return {
        success: false,
        message:
          "Submission approved, but no linked interview report exists.",
      };
    }

    const { data: question, error: questionError } = await supabase
      .from("campus_interview_questions")
      .select("id, question, category, difficulty, round_name")
      .eq("report_id", report.id)
      .limit(1)
      .maybeSingle();

    if (questionError) {
      console.error("Interview question lookup failed:", questionError);
      return {
        success: false,
        message:
          "Submission approved, but the linked interview question could not be loaded.",
      };
    }

    if (!question) {
      return {
        success: false,
        message:
          "Submission approved, but no interview question is linked to the report.",
      };
    }

    const { data: result, error: embeddingError } =
      await supabase.functions.invoke("generate-campus-embedding", {
        body: {
          question_id: question.id,
          report_id: report.id,
          question: question.question,
          category: question.category,
          difficulty: question.difficulty,
          round_name: question.round_name,
          company_name: submission.company_name,
          role: submission.role,
          interview_year: submission.visit_year,
          report_difficulty: report.difficulty,
          overall_experience: report.overall_experience,
          preparation_advice: report.preparation_advice,
        },
      });

    if (embeddingError) {
      console.error("Embedding function failed:", embeddingError);
      return {
        success: false,
        message:
          "Submission approved, but semantic embedding generation failed.",
      };
    }

    if (!result?.success) {
      console.error("Embedding function returned failure:", result);
      return {
        success: false,
        message:
          "Submission approved, but the embedding function returned an error.",
      };
    }

    return {
      success: true,
      message:
        "Submission approved and semantic embedding generated successfully.",
    };
  }

  /*
   * Approve or reject a pending submission
   */
  async function moderateSubmission(
    submission: Submission,
    status: "approved" | "rejected"
  ) {
    setProcessingId(submission.id);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("You must be logged in.");

      if (submission.moderation_status !== "pending") {
        throw new Error(
          "Only pending submissions can be moderated."
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from("campus_intel_submissions")
        .update({
          moderation_status: status,
          moderator_notes: moderatorNotes.trim() || null,
          moderated_at: new Date().toISOString(),
        } as never)
        .eq("id", submission.id)
        .eq("moderation_status", "pending")
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) {
        throw new Error(
          "The submission was changed by another moderator. Refresh and try again."
        );
      }

      let resultMessage =
        status === "approved"
          ? "Campus Intel submission approved successfully."
          : "Campus Intel submission rejected.";

      if (
        status === "approved" &&
        submission.submission_type === "interview_question"
      ) {
        const embeddingResult =
          await generateInterviewEmbedding(submission);
        resultMessage = embeddingResult.message;
      }

      setMessage(resultMessage);
      setSelectedSubmission(null);
      setModeratorNotes("");
      await loadSubmissions();
    } catch (err) {
      console.error("Moderation failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to moderate submission."
      );
    } finally {
      setProcessingId(null);
    }
  }

  /*
   * Publish an approved company visit
   */
  async function publishSubmission(submission: Submission) {
    setProcessingId(submission.id);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("You must be logged in.");

      const { data: adminRecord, error: adminError } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) throw adminError;
      if (!adminRecord) throw new Error("Admin access required.");

      if (submission.moderation_status !== "approved") {
        throw new Error(
          "Only approved submissions can be published."
        );
      }

      if (submission.published_visit_id) {
        throw new Error(
          "This submission has already been published."
        );
      }

      if (submission.submission_type !== "company_visit") {
        throw new Error(
          "Only Company Visit submissions can be published here."
        );
      }

      if (!submission.college_id) {
        throw new Error(
          "This submission has no linked college."
        );
      }

      const companyName = submission.company_name?.trim();

      if (!companyName) {
        throw new Error(
          "Company name is required before publishing."
        );
      }

      const { data: existingCompanies, error: findError } =
        await supabase
          .from("campus_companies")
          .select("id, name")
          .ilike("name", companyName)
          .limit(1);

      if (findError) throw findError;

      let companyId: string | null =
        existingCompanies?.[0]?.id ?? null;

      if (!companyId) {
        const { data: newCompany, error: insertCompanyError } =
          await supabase
            .from("campus_companies")
            .insert({ name: companyName } as never)
            .select("id")
            .single();

        if (insertCompanyError) throw insertCompanyError;
        companyId = newCompany.id;
      }

      const { data: newVisit, error: visitError } = await supabase
        .from("campus_company_visits")
        .insert({
          college_id: submission.college_id,
          company_id: companyId,
          visit_year: submission.visit_year,
          role: submission.role,
          job_type: "Full Time",
          eligible_branch: null,
          minimum_cgpa: null,
          placement_status: "Reported",
          package_lpa: null,
          visit_notes: submission.content,
        } as never)
        .select("id")
        .single();

      if (visitError) throw visitError;

      const { data: updated, error: updateError } = await supabase
        .from("campus_intel_submissions")
        .update({
          published_at: new Date().toISOString(),
          published_by: user.id,
          published_visit_id: newVisit.id,
        } as never)
        .eq("id", submission.id)
        .eq("moderation_status", "approved")
        .is("published_visit_id", null)
        .select("id")
        .maybeSingle();

      if (updateError || !updated) {
        // Compensate if the submission could not be linked.
        const { error: cleanupError } = await supabase
          .from("campus_company_visits")
          .delete()
          .eq("id", newVisit.id);

        if (cleanupError) {
          console.error(
            "Failed to clean up unlinked visit:",
            cleanupError
          );
        }

        if (updateError) throw updateError;

        throw new Error(
          "The submission changed or was already published. Refresh and check its status."
        );
      }

      setMessage(
        `Campus Intel published successfully for ${companyName}.`
      );
      setSelectedSubmission(null);
      await loadSubmissions();
    } catch (err) {
      console.error("Publishing failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to publish Campus Intel."
      );
    } finally {
      setProcessingId(null);
    }
  }

  /*
   * Unpublish a published company visit.
   *
   * Important: this is a client-side, two-operation workflow,
   * not an atomic transaction. For production, move this logic
   * into a server-side admin-verified RPC/transaction.
   */
  async function unpublishSubmission(submission: Submission) {
    if (
      submission.moderation_status !== "approved" ||
      submission.submission_type !== "company_visit" ||
      !submission.published_visit_id
    ) {
      setError(
        "This submission is not eligible for unpublishing."
      );
      return;
    }

    const confirmed = window.confirm(
      `Unpublish "${submission.title}" from public Campus Intel?\n\n` +
        "The linked company visit will be removed. The approved submission and moderation history will be retained."
    );

    if (!confirmed) return;

    setProcessingId(submission.id);
    setError("");
    setMessage("");

    const visitId = submission.published_visit_id;
    const previousPublishedAt = submission.published_at;
    const previousPublishedBy = submission.published_by;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("You must be logged in.");

      const { data: adminRecord, error: adminError } =
        await supabase
          .from("platform_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (adminError) throw adminError;
      if (!adminRecord) {
        throw new Error("Admin access required.");
      }

      /*
       * Step 1:
       * Clear the foreign-key reference first.
       * This prevents the FK constraint from blocking deletion.
       */
      const { data: updatedSubmission, error: updateError } =
        await supabase
          .from("campus_intel_submissions")
          .update({
            published_at: null,
            published_by: null,
            published_visit_id: null,
          } as never)
          .eq("id", submission.id)
          .eq("published_visit_id", visitId)
          .select("id")
          .maybeSingle();

      if (updateError) throw updateError;

      if (!updatedSubmission) {
        throw new Error(
          "The submission's publication reference was not cleared. Refresh and inspect its current status."
        );
      }

      /*
       * Step 2:
       * Delete the exact visit after its FK reference is cleared.
       */
      const { data: deletedVisit, error: deleteError } =
        await supabase
          .from("campus_company_visits")
          .delete()
          .eq("id", visitId)
          .select("id")
          .maybeSingle();

      if (deleteError || !deletedVisit) {
        /*
         * If deletion failed, attempt to restore publication
         * metadata so the submission does not appear unpublished
         * while its visit still exists.
         */
        const { error: restoreError } = await supabase
          .from("campus_intel_submissions")
          .update({
            published_at: previousPublishedAt,
            published_by: previousPublishedBy,
            published_visit_id: visitId,
          } as never)
          .eq("id", submission.id)
          .is("published_visit_id", null);

        if (restoreError) {
          console.error(
            "Publication metadata restore failed:",
            restoreError
          );

          throw new Error(
            "Visit deletion failed and publication metadata could not be restored. Inspect both records before retrying."
          );
        }

        if (deleteError) throw deleteError;

        throw new Error(
          "The linked visit was not deleted. Check whether it still exists and verify the admin DELETE policy."
        );
      }

      setMessage(
        "Unpublished successfully. The approved submission and moderation history were retained."
      );

      setSelectedSubmission(null);
      await loadSubmissions();
    } catch (err) {
      console.error("Unpublishing failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to unpublish this submission."
      );

      // Refresh the UI to reflect the actual database state.
      await loadSubmissions();
    } finally {
      setProcessingId(null);
    }
  }

  /*
   * Search and filtering
   */
  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return submissions.filter((submission) => {
      const matchesStatus =
        filter === "all" ||
        submission.moderation_status === filter;

      const searchableText = [
        submission.title,
        submission.content,
        submission.company_name,
        submission.role,
        submission.submission_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (!query || searchableText.includes(query))
      );
    });
  }, [submissions, filter, search]);

  const pendingCount = submissions.filter(
    (item) => item.moderation_status === "pending"
  ).length;

  const approvedCount = submissions.filter(
    (item) => item.moderation_status === "approved"
  ).length;

  const rejectedCount = submissions.filter(
    (item) => item.moderation_status === "rejected"
  ).length;

  const publishedCount = submissions.filter(
    (item) => Boolean(item.published_visit_id)
  ).length;

  const allCount = submissions.length;

  /*
   * Access check screen
   */
  if (checkingAdmin) {
    return (
      <main className="min-h-screen bg-[#070b14] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🛡️</div>
          <h1 className="text-xl font-semibold">
            Checking admin access...
          </h1>
          <p className="text-gray-400 mt-2">
            Please wait.
          </p>
        </div>
      </main>
    );
  }

  /*
   * Unauthorized screen
   */
  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#070b14] text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-3xl border border-red-500/20 bg-[#0d1320] p-8 text-center shadow-2xl">
          <div className="text-5xl mb-5">🔒</div>
          <h1 className="text-2xl font-bold">
            Admin access required
          </h1>
          <p className="text-gray-400 mt-3 leading-6">
            Your account does not have permission to access
            the Campus Intel moderation dashboard.
          </p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <a
            href="/campus-intel"
            className="inline-flex mt-6 rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-gray-200 transition"
          >
            Back to Campus Intel
          </a>
        </div>
      </main>
    );
  }

  /*
   * Admin dashboard
   */
  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <header className="border-b border-white/10 bg-[#080d18]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <h1 className="text-xl font-bold">
                Vertex Admin
              </h1>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Campus Intel Moderation
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/campus-intel"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition"
            >
              View Campus Intel
            </a>

            <button
              onClick={() => {
                setLoading(true);
                setError("");
                void loadSubmissions().finally(() =>
                  setLoading(false)
                );
              }}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-gray-200 transition"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <section className="mb-8">
          <div className="rounded-3xl border border-white/10 bg-linear-to-br from-[#101827] to-[#0b101c] p-8 shadow-2xl">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300">
                <span>●</span> Moderator Console
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mt-5">
                Campus Intel Moderation
              </h2>

              <p className="text-gray-400 mt-3 leading-7">
                Review community-submitted placement intelligence
                before it becomes trusted Campus Intel.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-emerald-300">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-300">
            {error}
          </div>
        )}

        {/* Dashboard statistics */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total" value={allCount} icon="📋" />
          <StatCard label="Pending" value={pendingCount} icon="⏳" />
          <StatCard label="Approved" value={approvedCount} icon="✅" />
          <StatCard label="Rejected" value={rejectedCount} icon="❌" />
          <StatCard label="Published" value={publishedCount} icon="🚀" />
        </section>

        {/* Search and filters */}
        <section className="rounded-2xl border border-white/10 bg-[#0d1320] p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search company, role, title, or content..."
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-white/20"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {(
                [
                  ["pending", "Pending"],
                  ["approved", "Approved"],
                  ["rejected", "Rejected"],
                  ["all", "All"],
                ] as [Filter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    filter === value
                      ? "bg-white text-black"
                      : "border border-white/10 text-gray-400 hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Submission list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">
                Submissions
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {filteredSubmissions.length} matching submissions
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#0d1320] p-10 text-center text-gray-400">
              Loading submissions...
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0d1320] p-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-semibold">
                No submissions found
              </h3>
              <p className="text-gray-500 mt-2">
                There are no submissions matching the current filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubmissions.map((submission) => (
                <article
                  key={submission.id}
                  className="rounded-2xl border border-white/10 bg-[#0d1320] p-6 hover:border-white/15 transition"
                >
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="rounded-lg border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-medium text-blue-300">
                          {submissionTypeLabels[
                            submission.submission_type
                          ] ?? submission.submission_type}
                        </span>

                        <StatusBadge
                          status={submission.moderation_status}
                        />

                        {submission.published_visit_id && (
                          <span className="rounded-lg border border-purple-400/20 bg-purple-400/10 px-2.5 py-1 text-xs font-medium text-purple-300">
                            🚀 Published
                          </span>
                        )}
                      </div>

                      <h4 className="text-lg font-bold">
                        {submission.title}
                      </h4>

                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-400 mt-3">
                        {submission.company_name && (
                          <span>
                            🏢 {submission.company_name}
                          </span>
                        )}

                        {submission.role && (
                          <span>💼 {submission.role}</span>
                        )}

                        {submission.visit_year && (
                          <span>📅 {submission.visit_year}</span>
                        )}

                        <span>
                          🕒{" "}
                          {new Date(
                            submission.created_at
                          ).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-4">
                        <p className="text-sm leading-6 text-gray-300 whitespace-pre-wrap">
                          {submission.content}
                        </p>
                      </div>

                      {submission.moderator_notes && (
                        <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/5 p-4">
                          <p className="text-xs uppercase tracking-wider text-amber-300/70">
                            Moderator notes
                          </p>
                          <p className="text-sm text-gray-300 mt-2">
                            {submission.moderator_notes}
                          </p>
                        </div>
                      )}

                      {submission.published_at && (
                        <div className="mt-4 rounded-xl border border-purple-400/10 bg-purple-400/5 p-4">
                          <p className="text-xs uppercase tracking-wider text-purple-300/70">
                            Published
                          </p>
                          <p className="text-sm text-gray-300 mt-2">
                            Published on{" "}
                            {new Date(
                              submission.published_at
                            ).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex xl:flex-col gap-2 shrink-0">
                      {submission.moderation_status === "pending" ? (
                        <button
                          disabled={
                            processingId === submission.id
                          }
                          onClick={() => {
                            setSelectedSubmission(submission);
                            setModeratorNotes("");
                          }}
                          className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400 transition disabled:opacity-50"
                        >
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedSubmission(submission);
                            setModeratorNotes(
                              submission.moderator_notes ?? ""
                            );
                          }}
                          className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-gray-300 hover:bg-white/5 transition"
                        >
                          View Details
                        </button>
                      )}

                      {submission.moderation_status === "approved" &&
                        submission.submission_type ===
                          "company_visit" &&
                        !submission.published_visit_id && (
                          <button
                            disabled={
                              processingId === submission.id
                            }
                            onClick={() =>
                              void publishSubmission(submission)
                            }
                            className="rounded-xl bg-purple-500 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-400 transition disabled:opacity-50"
                          >
                            {processingId === submission.id
                              ? "Publishing..."
                              : "🚀 Publish"}
                          </button>
                        )}

                      {submission.published_visit_id && (
                        <div className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-5 py-3 text-center text-sm font-semibold text-purple-300">
                          ✓ Published
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Review and details modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0d1320] shadow-2xl">
            <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500">
                  Review Submission
                </div>
                <h2 className="text-2xl font-bold mt-2">
                  {selectedSubmission.title}
                </h2>
              </div>

              <button
                onClick={() => setSelectedSubmission(null)}
                aria-label="Close details"
                className="text-gray-500 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBox
                  label="Type"
                  value={
                    submissionTypeLabels[
                      selectedSubmission.submission_type
                    ] ?? selectedSubmission.submission_type
                  }
                />

                <InfoBox
                  label="Company"
                  value={
                    selectedSubmission.company_name ??
                    "Not provided"
                  }
                />

                <InfoBox
                  label="Role"
                  value={
                    selectedSubmission.role ?? "Not provided"
                  }
                />

                <InfoBox
                  label="Visit Year"
                  value={
                    selectedSubmission.visit_year
                      ? String(selectedSubmission.visit_year)
                      : "Not provided"
                  }
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-gray-500">
                  Submitted Content
                </label>

                <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm leading-7 text-gray-300 whitespace-pre-wrap">
                    {selectedSubmission.content}
                  </p>
                </div>
              </div>

              {selectedSubmission.moderation_status ===
                "pending" && (
                <div>
                  <label className="text-sm font-medium text-gray-300">
                    Moderator notes
                  </label>

                  <textarea
                    value={moderatorNotes}
                    onChange={(event) =>
                      setModeratorNotes(event.target.value)
                    }
                    rows={4}
                    placeholder="Optional reason or moderation note..."
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-white/20 resize-none"
                  />
                </div>
              )}

              {selectedSubmission.moderation_status !==
                "pending" && (
                <InfoBox
                  label="Moderation status"
                  value={
                    selectedSubmission.moderation_status
                  }
                />
              )}

              {selectedSubmission.published_visit_id && (
                <InfoBox
                  label="Publishing status"
                  value="Published to Campus Intel"
                />
              )}
            </div>

            {/* Pending moderation actions */}
            {selectedSubmission.moderation_status ===
              "pending" && (
              <div className="p-6 border-t border-white/10 flex flex-col sm:flex-row gap-3">
                <button
                  disabled={
                    processingId === selectedSubmission.id
                  }
                  onClick={() =>
                    void moderateSubmission(
                      selectedSubmission,
                      "rejected"
                    )
                  }
                  className="flex-1 rounded-xl border border-red-400/20 bg-red-400/10 px-5 py-3 font-semibold text-red-300 hover:bg-red-400/15 transition disabled:opacity-50"
                >
                  ❌ Reject
                </button>

                <button
                  disabled={
                    processingId === selectedSubmission.id
                  }
                  onClick={() =>
                    void moderateSubmission(
                      selectedSubmission,
                      "approved"
                    )
                  }
                  className="flex-1 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black hover:bg-emerald-400 transition disabled:opacity-50"
                >
                  {processingId === selectedSubmission.id
                    ? "Processing..."
                    : "✓ Approve"}
                </button>
              </div>
            )}

            {/* Publish approved, unpublished company visit */}
            {selectedSubmission.moderation_status ===
              "approved" &&
              selectedSubmission.submission_type ===
                "company_visit" &&
              !selectedSubmission.published_visit_id && (
                <div className="p-6 border-t border-white/10">
                  <button
                    disabled={
                      processingId === selectedSubmission.id
                    }
                    onClick={() =>
                      void publishSubmission(selectedSubmission)
                    }
                    className="w-full rounded-xl bg-purple-500 px-5 py-3 font-semibold text-white hover:bg-purple-400 transition disabled:opacity-50"
                  >
                    {processingId === selectedSubmission.id
                      ? "Publishing..."
                      : "🚀 Publish to Campus Intel"}
                  </button>
                </div>
              )}

            {/* Unpublish published company visit */}
            {selectedSubmission.moderation_status ===
              "approved" &&
              selectedSubmission.submission_type ===
                "company_visit" &&
              selectedSubmission.published_visit_id && (
                <div className="p-6 border-t border-white/10">
                  <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                    <p className="text-sm font-medium text-amber-300">
                      This company visit is publicly published.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-400">
                      Unpublishing removes the linked visit from
                      Campus Intel. The approved submission and
                      moderation history are retained.
                    </p>
                  </div>

                  <button
                    disabled={
                      processingId === selectedSubmission.id
                    }
                    onClick={() =>
                      void unpublishSubmission(
                        selectedSubmission
                      )
                    }
                    className="w-full rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-3 font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {processingId === selectedSubmission.id
                      ? "Unpublishing..."
                      : "↩ Unpublish from Campus Intel"}
                  </button>
                </div>
              )}
          </div>
        </div>
      )}
    </main>
  );
}

/*
 * Dashboard statistic card
 */
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1320] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <span>{icon}</span>
      </div>
      <div className="text-3xl font-bold mt-3">{value}</div>
    </div>
  );
}

/*
 * Moderation status badge
 */
function StatusBadge({
  status,
}: {
  status: Submission["moderation_status"];
}) {
  const styles = {
    pending:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
    approved:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    rejected:
      "border-red-400/20 bg-red-400/10 text-red-300",
  };

  const labels = {
    pending: "⏳ Pending",
    approved: "✓ Approved",
    rejected: "✕ Rejected",
  };

  return (
    <span
      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

/*
 * Detail information box
 */
function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-sm font-medium text-gray-200 mt-2">
        {value}
      </div>
    </div>
  );
}