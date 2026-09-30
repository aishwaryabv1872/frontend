"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// The project does not currently have generated Supabase Database typings.
// Keep the existing Supabase client/auth behavior while allowing the
// Campus Intel query shapes to be handled by the local interfaces below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Company = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  description: string | null;
};

type CompanyVisit = {
  id: string;
  college_id: string;
  company_id: string;
  visit_year: number;
  role: string | null;
  job_type: string | null;
  eligible_branch: string | null;
  minimum_cgpa: number | null;
  placement_status: string | null;
  package_lpa: number | null;
  visit_notes: string | null;
  company?: Company;
};

type College = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

type Submission = {
  id: string;
  submission_type: string;
  title: string | null;
  content: string | null;
  company_name: string | null;
  role: string | null;
  visit_year: number | null;
  moderation_status: string;
  created_at: string;
};

type InterviewQuestion = {
  id: string;
  report_id: string;
  question: string;
  category: string;
  difficulty: string | null;
  round_name: string | null;
  created_at: string;
  report?: {
    source_submission_id: string | null;
    company_name?: string | null;
    role?: string | null;
    interview_year?: number | null;
    overall_experience?: string | null;
    anonymous: boolean;
    moderation_status: string;
    visit?: {
      visit_year: number;
      role: string | null;
      company?: {
        name: string;
      } | null;
    } | null;
  } | null;
};

type SemanticSearchResult = {
  id: string;
  question_id: string | null;
  report_id: string | null;
  content: string;
  metadata: {
    company_name?: string | null;
    role?: string | null;
    category?: string | null;
    difficulty?: string | null;
    round_name?: string | null;
    interview_year?: number | null;
  } | null;
  similarity: number;
};

type PlacementCutoff = {
  id: string;
  title: string | null;
  content: string | null;
  company_name: string | null;
  role: string | null;
  visit_year: number | null;
  moderation_status: string;
  created_at: string;
};

type SubmissionType =
  | "company_visit"
  | "interview_report"
  | "interview_question"
  | "cutoff"
  | "experience"
  | "other";

export default function CampusIntelPage() {
  const [college, setCollege] = useState<College | null>(null);
  const [visits, setVisits] = useState<CompanyVisit[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [interviewQuestions, setInterviewQuestions] =
    useState<InterviewQuestion[]>([]);

  const [placementCutoffs, setPlacementCutoffs] =
    useState<PlacementCutoff[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");

  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const [semanticSearching, setSemanticSearching] = useState(false);
  const [semanticSearchError, setSemanticSearchError] = useState("");

  // ============================================================
  // SUBMISSION STATE
  // ============================================================

  const [showSubmissionForm, setShowSubmissionForm] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [submissionMessage, setSubmissionMessage] =
    useState("");

  const [submissionError, setSubmissionError] =
    useState("");

  const [submissionType, setSubmissionType] =
    useState<SubmissionType>("company_visit");

  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");

  const [visitYear, setVisitYear] = useState(
    new Date().getFullYear().toString()
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // ============================================================
  // INTERVIEW REPORT STATE
  // ============================================================

  const [selectedVisitId, setSelectedVisitId] =
    useState("");

  const [interviewResult, setInterviewResult] =
    useState("");

  const [roundsCount, setRoundsCount] =
    useState("");

  const [interviewDifficulty, setInterviewDifficulty] =
    useState("");

  const [overallExperience, setOverallExperience] =
    useState("");

  const [preparationAdvice, setPreparationAdvice] =
    useState("");

  const [anonymousInterview, setAnonymousInterview] =
    useState(true);

  // ============================================================
  // INTERVIEW QUESTION STATE
  // ============================================================

  const [selectedQuestionVisitId, setSelectedQuestionVisitId] =
    useState("");

  const [interviewQuestion, setInterviewQuestion] =
    useState("");

  const [questionCategory, setQuestionCategory] =
    useState("DSA");

  const [questionDifficulty, setQuestionDifficulty] =
    useState("Medium");

  const [questionRound, setQuestionRound] =
    useState("Technical Round 1");

  const [anonymousQuestion, setAnonymousQuestion] =
    useState(true);

  // ============================================================
  // PLACEMENT CUTOFF STATE
  // ============================================================

  const [selectedCutoffVisitId, setSelectedCutoffVisitId] =
    useState("");

  const [cutoffCgpa, setCutoffCgpa] =
    useState("");

  const [cutoffBranches, setCutoffBranches] =
    useState("");

  // ============================================================
  // LOAD
  // ============================================================

  useEffect(() => {
    loadCampusIntel();
  }, []);

  async function loadCampusIntel() {
    try {
      setLoading(true);
      setError("");

      // ---------------------------------------------------------
      // 1. Current user
      // ---------------------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(
          `Authentication error: ${userError.message}`
        );
      }

      if (!user) {
        setError("Please log in to view Campus Intel.");
        return;
      }

      // ---------------------------------------------------------
      // 2. Student profile
      // ---------------------------------------------------------

      const {
        data: profileData,
        error: profileError,
      } = await db.from("student_profiles")
        .select("college")
        .eq("user_id", user.id)
        .maybeSingle();

      const profile = profileData as { college: string | null } | null;

      if (profileError) {
        throw new Error(
          `Student profile query failed: ${profileError.message}`
        );
      }

      if (!profile?.college) {
        setError(
          "Your college is not available in your student profile. Please complete your profile first."
        );
        return;
      }

      // ---------------------------------------------------------
      // 3. Match college
      // ---------------------------------------------------------

      const collegeName = profile.college.trim();

      const baseCollegeName = collegeName
        .split(",")[0]
        .trim();

      const {
        data: collegeData,
        error: collegeError,
      } = await db.from("colleges")
        .select("id, name, city, state")
        .ilike("name", baseCollegeName)
        .limit(1)
        .maybeSingle();

      if (collegeError) {
        throw new Error(
          `College lookup failed: ${collegeError.message}`
        );
      }

      if (!collegeData) {
        setError(
          `We couldn't find "${profile.college}" in the Campus Intel college database.`
        );
        return;
      }

      // Supabase's generated type can infer this query result as `never`
      // when the database schema typings are unavailable.
      const matchedCollege = collegeData as unknown as College;

      setCollege(matchedCollege);

      // ---------------------------------------------------------
      // 4. Companies
      // ---------------------------------------------------------

      const {
        data: companyData,
        error: companyError,
      } = await db.from("campus_companies")
        .select(
          "id, name, website, industry, description"
        )
        .order("name", { ascending: true });

      if (companyError) {
        throw new Error(
          `Companies query failed: ${companyError.message}`
        );
      }

      // ---------------------------------------------------------
      // 5. Company visits
      // ---------------------------------------------------------

      const {
        data: visitData,
        error: visitError,
      } = await db.from("campus_company_visits")
        .select(
          `
            id,
            college_id,
            company_id,
            visit_year,
            role,
            job_type,
            eligible_branch,
            minimum_cgpa,
            placement_status,
            package_lpa,
            visit_notes
          `
        )
        .eq("college_id", matchedCollege.id)
        .order("visit_year", {
          ascending: false,
        });

      if (visitError) {
        throw new Error(
          `Company visits query failed: ${visitError.message}`
        );
      }

      // ---------------------------------------------------------
      // 6. Connect company + visit
      // ---------------------------------------------------------

      const typedCompanyData = companyData as unknown as Company[] | null;
      const companyMap = new Map(
        (typedCompanyData ?? []).map((company) => [
          company.id,
          company,
        ])
      );

      const formattedVisits: CompanyVisit[] =
        (visitData ?? []).map((visit: CompanyVisit) => ({
          ...visit,
          company: companyMap.get(visit.company_id),
        }));

      setVisits(formattedVisits);

      // ---------------------------------------------------------
      // 7. Current user's submissions
      // ---------------------------------------------------------

      const {
        data: submissionData,
        error: submissionLoadError,
      } = await db.from("campus_intel_submissions")
        .select(
          `
            id,
            submission_type,
            title,
            content,
            company_name,
            role,
            visit_year,
            moderation_status,
            created_at
          `
        )
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (submissionLoadError) {
        console.error(
          "Submission history error:",
          submissionLoadError.message
        );
      } else {
        setSubmissions(submissionData ?? []);
      }

      // ---------------------------------------------------------
      // 8. PUBLIC APPROVED INTERVIEW QUESTIONS
      // ---------------------------------------------------------

      const {
        data: questionData,
        error: questionError,
      } = await db.from("campus_interview_questions")
        .select(
          `
            id,
            report_id,
            question,
            category,
            difficulty,
            round_name,
            created_at,
            report:campus_interview_reports!inner(
              source_submission_id,
              anonymous,
              moderation_status,
              visit:campus_company_visits(
                visit_year,
                role,
                company:campus_companies(
                  name
                )
              )
            )
          `
        )
        .order("created_at", {
          ascending: false,
        });

      if (questionError) {
        console.error(
          "Interview questions load error:",
          questionError.message
        );
        setInterviewQuestions([]);
      } else {
        const {
          data: approvedQuestionSubmissions,
          error: approvedQuestionSubmissionError,
        } = await db.from("campus_intel_submissions")
          .select("id")
          .eq("college_id", collegeData.id)
          .eq("submission_type", "interview_question")
          .eq("moderation_status", "approved");

        if (approvedQuestionSubmissionError) {
          console.error(
            "Approved interview question submissions load error:",
            approvedQuestionSubmissionError.message
          );
          setInterviewQuestions([]);
        } else {
          const approvedIds = new Set(
            (approvedQuestionSubmissions ?? []).map(
              (submission: { id: string }) => submission.id
            )
          );

          const publicQuestions =
            ((questionData ?? []) as unknown as InterviewQuestion[]).filter(
              (question) => {
                const sourceSubmissionId =
                  question.report?.source_submission_id;

                return (
                  Boolean(sourceSubmissionId) &&
                  approvedIds.has(sourceSubmissionId as string)
                );
              }
            );

          setInterviewQuestions(publicQuestions);
        }
      }

      // ---------------------------------------------------------
      // 9. PUBLIC APPROVED PLACEMENT CUTOFFS
      // ---------------------------------------------------------

      const {
        data: cutoffData,
        error: cutoffError,
      } = await db.from("campus_intel_submissions")
        .select(
          `
            id,
            title,
            content,
            company_name,
            role,
            visit_year,
            moderation_status,
            created_at
          `
        )
        .eq("college_id", collegeData.id)
        .eq("submission_type", "cutoff")
        .eq("moderation_status", "approved")
        .order("created_at", {
          ascending: false,
        });

      if (cutoffError) {
        console.error(
          "Placement cutoffs load error:",
          cutoffError.message
        );
        setPlacementCutoffs([]);
      } else {
        setPlacementCutoffs(cutoffData ?? []);
      }
    } catch (err) {
      console.error(
        "Campus Intel ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Campus Intel."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // RESET FORM
  // ============================================================

  function resetSubmissionForm() {
    setSubmissionType("company_visit");

    setCompanyName("");
    setRole("");

    setVisitYear(
      new Date().getFullYear().toString()
    );

    setTitle("");
    setContent("");

    setSelectedVisitId("");
    setInterviewResult("");
    setRoundsCount("");
    setInterviewDifficulty("");
    setOverallExperience("");
    setPreparationAdvice("");
    setAnonymousInterview(true);

    setSelectedQuestionVisitId("");
    setInterviewQuestion("");
    setQuestionCategory("DSA");
    setQuestionDifficulty("Medium");
    setQuestionRound("Technical Round 1");
    setAnonymousQuestion(true);

    setSelectedCutoffVisitId("");
    setCutoffCgpa("");
    setCutoffBranches("");

    setSubmissionError("");
    setSubmissionMessage("");
  }

  // ============================================================
  // TYPE CHANGE
  // ============================================================

  function handleSubmissionTypeChange(
    type: SubmissionType
  ) {
    setSubmissionType(type);
    setSubmissionError("");

    if (type === "interview_report") {
      setSelectedQuestionVisitId("");
      setInterviewQuestion("");
    }

    if (type === "cutoff") {
      setSelectedVisitId("");
      setSelectedQuestionVisitId("");
      setInterviewResult("");
      setRoundsCount("");
      setInterviewDifficulty("");
      setOverallExperience("");
      setPreparationAdvice("");
      setAnonymousInterview(true);
      setInterviewQuestion("");
      setQuestionCategory("DSA");
      setQuestionDifficulty("Medium");
      setQuestionRound("Technical Round 1");
      setAnonymousQuestion(true);
    }

    if (type === "interview_question") {
      setSelectedVisitId("");
      setInterviewResult("");
      setRoundsCount("");
      setInterviewDifficulty("");
      setOverallExperience("");
      setPreparationAdvice("");
      setAnonymousInterview(true);
    }

    if (
      type !== "interview_report" &&
      type !== "interview_question"
    ) {
      setSelectedVisitId("");
      setInterviewResult("");
      setRoundsCount("");
      setInterviewDifficulty("");
      setOverallExperience("");
      setPreparationAdvice("");
      setAnonymousInterview(true);

      setSelectedQuestionVisitId("");
      setInterviewQuestion("");
      setQuestionCategory("DSA");
      setQuestionDifficulty("Medium");
      setQuestionRound("Technical Round 1");
      setAnonymousQuestion(true);
    }
  }

  // ============================================================
  // INTERVIEW EXPERIENCE VISIT
  // ============================================================

  function handleVisitSelection(
    visitId: string
  ) {
    setSelectedVisitId(visitId);
    setSubmissionError("");

    const selectedVisit = visits.find(
      (visit) => visit.id === visitId
    );

    if (!selectedVisit) {
      return;
    }

    setCompanyName(
      selectedVisit.company?.name ?? ""
    );

    setRole(
      selectedVisit.role ?? ""
    );

    setVisitYear(
      selectedVisit.visit_year?.toString() ??
        new Date().getFullYear().toString()
    );
  }

  // ============================================================
  // INTERVIEW QUESTION VISIT
  // ============================================================

  function handleQuestionVisitSelection(
    visitId: string
  ) {
    setSelectedQuestionVisitId(visitId);
    setSubmissionError("");

    const selectedVisit = visits.find(
      (visit) => visit.id === visitId
    );

    if (!selectedVisit) {
      return;
    }

    setCompanyName(
      selectedVisit.company?.name ?? ""
    );

    setRole(
      selectedVisit.role ?? ""
    );

    setVisitYear(
      selectedVisit.visit_year?.toString() ??
        new Date().getFullYear().toString()
    );
  }

  // ============================================================
  // PLACEMENT CUTOFF VISIT
  // ============================================================

  function handleCutoffVisitSelection(visitId: string) {
    setSelectedCutoffVisitId(visitId);
    setSubmissionError("");

    const selectedVisit = visits.find(
      (visit) => visit.id === visitId
    );

    if (!selectedVisit) {
      return;
    }

    setCompanyName(selectedVisit.company?.name ?? "");
    setRole(selectedVisit.role ?? "");
    setVisitYear(
      selectedVisit.visit_year?.toString() ??
        new Date().getFullYear().toString()
    );

    if (selectedVisit.minimum_cgpa !== null) {
      setCutoffCgpa(selectedVisit.minimum_cgpa.toString());
    }

    if (selectedVisit.eligible_branch) {
      setCutoffBranches(selectedVisit.eligible_branch);
    }
  }

  // ============================================================
  // SUBMIT
  // ============================================================

  async function handleSubmitIntel(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setSubmissionError("");
      setSubmissionMessage("");

      // ---------------------------------------------------------
      // Basic validation
      // ---------------------------------------------------------

      if (!content.trim()) {
        setSubmissionError(
          "Please fill in the Details field."
        );
        return;
      }

      // ---------------------------------------------------------
      // Interview report validation
      // ---------------------------------------------------------

      if (
        submissionType === "interview_report"
      ) {
        if (!selectedVisitId) {
          setSubmissionError(
            "Please select the company visit associated with this interview."
          );
          return;
        }

        if (!interviewResult) {
          setSubmissionError(
            "Please select the interview result."
          );
          return;
        }

        if (
          !roundsCount ||
          Number(roundsCount) < 1
        ) {
          setSubmissionError(
            "Please enter the number of interview rounds."
          );
          return;
        }

        if (!interviewDifficulty) {
          setSubmissionError(
            "Please select the interview difficulty."
          );
          return;
        }

        if (!overallExperience.trim()) {
          setSubmissionError(
            "Please describe your overall interview experience."
          );
          return;
        }

        if (!preparationAdvice.trim()) {
          setSubmissionError(
            "Please share your preparation advice."
          );
          return;
        }
      }

      // ---------------------------------------------------------
      // Interview question validation
      // ---------------------------------------------------------

      if (
        submissionType === "interview_question"
      ) {
        if (!selectedQuestionVisitId) {
          setSubmissionError(
            "Please select the company visit associated with this question."
          );
          return;
        }

        if (!interviewQuestion.trim()) {
          setSubmissionError(
            "Please enter the interview question."
          );
          return;
        }

        if (!questionCategory) {
          setSubmissionError(
            "Please select the question category."
          );
          return;
        }

        if (!questionRound) {
          setSubmissionError(
            "Please select the interview round."
          );
          return;
        }

        if (!companyName.trim()) {
          setSubmissionError(
            "Please enter the company name."
          );
          return;
        }
      }

      // ---------------------------------------------------------
      // Placement cutoff validation
      // ---------------------------------------------------------

      if (submissionType === "cutoff") {
        if (!selectedCutoffVisitId) {
          setSubmissionError(
            "Please select the company visit associated with this cutoff."
          );
          return;
        }

        if (!cutoffCgpa.trim()) {
          setSubmissionError(
            "Please enter the minimum CGPA cutoff."
          );
          return;
        }

        const cgpaValue = Number(cutoffCgpa);

        if (
          Number.isNaN(cgpaValue) ||
          cgpaValue < 0 ||
          cgpaValue > 10
        ) {
          setSubmissionError(
            "Minimum CGPA must be between 0 and 10."
          );
          return;
        }

        if (!cutoffBranches.trim()) {
          setSubmissionError(
            "Please enter the eligible branches."
          );
          return;
        }
      }

      // ---------------------------------------------------------
      // Current user
      // ---------------------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(
          userError.message
        );
      }

      if (!user) {
        throw new Error(
          "You must be logged in to submit Campus Intel."
        );
      }

      // ---------------------------------------------------------
      // Selected visit
      // ---------------------------------------------------------

      const selectedVisit =
        visits.find(
          (visit) =>
            visit.id ===
            (
              submissionType ===
              "interview_question"
                ? selectedQuestionVisitId
                : submissionType === "cutoff"
                  ? selectedCutoffVisitId
                  : selectedVisitId
            )
        ) ?? null;

      // ---------------------------------------------------------
      // 1. Generic Campus Intel submission
      // ---------------------------------------------------------

      const submissionContent =
        submissionType === "cutoff"
          ? `Minimum CGPA: ${cutoffCgpa.trim()}\nEligible Branches: ${cutoffBranches.trim()}\nNotes: ${content.trim()}`
          : content.trim();

      const {
        data: createdSubmission,
        error: insertError,
      } = await db.from("campus_intel_submissions")
        .insert({
          user_id: user.id,

          college_id:
            college?.id ?? null,

          submission_type:
            submissionType,

          title:
            title.trim() ||
            getDefaultTitle(
              submissionType,
              companyName
            ),

          content:
            submissionContent,

          company_name:
            companyName.trim() || null,

          role:
            role.trim() || null,

          visit_year:
            visitYear &&
            !Number.isNaN(
              Number(visitYear)
            )
              ? Number(visitYear)
              : null,

          moderation_status:
            "pending",
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(
          `Submission failed: ${insertError.message}`
        );
      }

      if (!createdSubmission) {
        throw new Error(
          "Campus Intel submission was not created."
        );
      }

      // ---------------------------------------------------------
      // 2. Interview Experience
      // ---------------------------------------------------------

      if (
        submissionType ===
        "interview_report"
      ) {
        if (!selectedVisit) {
          throw new Error(
            "Selected company visit could not be found."
          );
        }

        const {
          error:
            interviewInsertError,
        } = await db.from(
            "campus_interview_reports"
          )
          .insert({
            visit_id:
              selectedVisit.id,

            user_id:
              user.id,

            source_submission_id:
              createdSubmission.id,

            result:
              interviewResult,

            rounds_count:
              Number(roundsCount),

            overall_experience:
              overallExperience.trim(),

            preparation_advice:
              preparationAdvice.trim(),

            difficulty:
              interviewDifficulty,

            anonymous:
              anonymousInterview,

            moderation_status:
              "pending",
          });

        if (interviewInsertError) {
          console.error(
            "Interview report insert failed:",
            interviewInsertError
          );

          throw new Error(
            `Interview report could not be saved: ${interviewInsertError.message}`
          );
        }
      }

      // ---------------------------------------------------------
      // 3. Interview Question
      // ---------------------------------------------------------

      if (
        submissionType ===
        "interview_question"
      ) {
        if (!selectedVisit) {
          throw new Error(
            "Selected company visit could not be found."
          );
        }

        // First create the parent interview report.
        const {
          data: report,
          error:
            reportInsertError,
        } = await db.from(
            "campus_interview_reports"
          )
          .insert({
            visit_id:
              selectedVisit.id,

            user_id:
              user.id,

            source_submission_id:
              createdSubmission.id,

            result:
              "Not Disclosed",

            rounds_count:
              1,

            overall_experience:
              content.trim() ||
              "Interview question submission",

            preparation_advice:
              "",

            difficulty:
              questionDifficulty ||
              null,

            anonymous:
              anonymousQuestion,

            moderation_status:
              "pending",
          })
          .select("id")
          .single();

        if (reportInsertError) {
          console.error(
            "Interview question report error:",
            reportInsertError
          );

          throw new Error(
            `Interview question report could not be created: ${reportInsertError.message}`
          );
        }

        if (!report) {
          throw new Error(
            "Interview question report was not created."
          );
        }

        // Then create the actual question and return its ID.
        const {
          data: insertedQuestion,
          error: questionInsertError,
        } = await db
          .from("campus_interview_questions")
          .insert({
            report_id:
              report.id,

            question:
              interviewQuestion.trim(),

            category:
              questionCategory,

            difficulty:
              questionDifficulty ||
              null,

            round_name:
              questionRound ||
              null,
          })
          .select("id")
          .single();

        if (questionInsertError) {
          console.error(
            "Interview question insert failed:",
            questionInsertError
          );

          throw new Error(
            `Interview question could not be saved: ${questionInsertError.message}`
          );
        }

        if (!insertedQuestion?.id) {
          throw new Error(
            "Interview question was saved but its ID could not be retrieved."
          );
        }

        // ---------------------------------------------------------
        // Generate Campus Intel semantic embedding
        // ---------------------------------------------------------
        //
        // The question is already saved at this point. Embedding
        // generation is intentionally non-blocking: if the deployed
        // Edge Function has a temporary problem, the student's
        // submission remains safely stored and can be embedded later.
        //
        try {
          const { data: embeddingResult, error: embeddingError } =
            await supabase.functions.invoke(
              "generate-campus-embedding",
              {
                body: {
                  question_id:
                    insertedQuestion.id,

                  report_id:
                    report.id,

                  question:
                    interviewQuestion.trim(),

                  category:
                    questionCategory,

                  difficulty:
                    questionDifficulty ||
                    null,

                  round_name:
                    questionRound ||
                    null,

                  company_name:
                    companyName.trim() ||
                    null,

                  role:
                    role.trim() ||
                    null,

                  interview_year:
                    visitYear &&
                    !Number.isNaN(
                      Number(visitYear)
                    )
                      ? Number(visitYear)
                      : null,
                },
              }
            );

          if (embeddingError) {
            console.error(
              "Campus Intel embedding generation failed:",
              embeddingError
            );
          } else {
            console.log(
              "Campus Intel embedding generated successfully:",
              embeddingResult
            );
          }
        } catch (embeddingError) {
          // Do not fail the submission because the embedding service
          // is temporarily unavailable. The question is already saved.
          console.error(
            "Campus Intel embedding request failed:",
            embeddingError
          );
        }
      }

      // ---------------------------------------------------------
      // Success
      // ---------------------------------------------------------

      setSubmissionMessage(
        submissionType ===
          "interview_question"
          ? "Your interview question has been submitted successfully and is now pending moderation."
          : submissionType ===
              "interview_report"
            ? "Your interview experience has been submitted successfully and is now pending moderation."
            : "Your Campus Intel has been submitted successfully and is now pending moderation."
      );

      resetSubmissionForm();

      setShowSubmissionForm(false);

      await loadCampusIntel();
    } catch (err) {
      console.error(
        "SUBMISSION ERROR:",
        err
      );

      setSubmissionError(
        err instanceof Error
          ? err.message
          : "Unable to submit Campus Intel."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // SEMANTIC INTERVIEW SEARCH
  // ============================================================

  async function handleSemanticSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const query = semanticQuery.trim();

    if (!query) {
      setSemanticResults([]);
      setSemanticSearchError(
        "Enter a question, topic, or interview skill to search."
      );
      return;
    }

    if (!college?.id) {
      setSemanticResults([]);
      setSemanticSearchError(
        "Your college could not be identified for Campus Intel search."
      );
      return;
    }

    try {
      setSemanticSearching(true);
      setSemanticSearchError("");

      const {
  data: { session },
} = await supabase.auth.getSession();

if (!session?.access_token) {
  setSemanticResults([]);
  setSemanticSearchError(
    "Your session has expired. Please log in again."
  );
  return;
}

const response = await fetch("/api/campus-intel/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
        body: JSON.stringify({
          query,
          college_id: college.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Campus Intel semantic search failed."
        );
      }

      setSemanticResults(
        Array.isArray(result.results) ? result.results : []
      );
    } catch (err) {
      console.error("Campus Intel semantic search error:", err);
      setSemanticResults([]);
      setSemanticSearchError(
        err instanceof Error
          ? err.message
          : "Unable to search Campus Intel."
      );
    } finally {
      setSemanticSearching(false);
    }
  }

  function clearSemanticSearch() {
    setSemanticQuery("");
    setSemanticResults([]);
    setSemanticSearchError("");
  }

  // ============================================================
  // DEFAULT TITLE
  // ============================================================

  function getDefaultTitle(
    type: SubmissionType,
    company: string
  ) {
    switch (type) {
      case "company_visit":
        return company
          ? `${company} campus visit`
          : "Campus company visit";

      case "interview_report":
        return company
          ? `${company} interview experience`
          : "Interview experience";

      case "interview_question":
        return company
          ? `${company} interview question`
          : "Interview question";

      case "cutoff":
        return company
          ? `${company} placement cutoff`
          : "Placement cutoff";

      case "experience":
        return company
          ? `${company} placement experience`
          : "Placement experience";

      default:
        return "Campus Intel submission";
    }
  }

  // ============================================================
  // YEARS
  // ============================================================

  const years = useMemo(() => {
    return Array.from(
      new Set(
        visits
          .map(
            (visit) =>
              visit.visit_year
          )
          .filter(Boolean)
      )
    ).sort(
      (a, b) => b - a
    );
  }, [visits]);

  // ============================================================
  // FILTER VISITS
  // ============================================================

  const filteredVisits = useMemo(() => {
    const searchTerm =
      search.trim().toLowerCase();

    return visits.filter(
      (visit) => {
        const companyName =
          visit.company?.name?.toLowerCase() ??
          "";

        const visitRole =
          visit.role?.toLowerCase() ??
          "";

        const industry =
          visit.company?.industry?.toLowerCase() ??
          "";

        const branch =
          visit.eligible_branch?.toLowerCase() ??
          "";

        const jobType =
          visit.job_type?.toLowerCase() ??
          "";

        const matchesSearch =
          !searchTerm ||
          companyName.includes(
            searchTerm
          ) ||
          visitRole.includes(
            searchTerm
          ) ||
          industry.includes(
            searchTerm
          ) ||
          branch.includes(
            searchTerm
          ) ||
          jobType.includes(
            searchTerm
          );

        const matchesYear =
          yearFilter === "all" ||
          visit.visit_year.toString() ===
            yearFilter;

        return (
          matchesSearch &&
          matchesYear
        );
      }
    );
  }, [
    visits,
    search,
    yearFilter,
  ]);

  // ============================================================
  // STATISTICS
  // ============================================================

  const uniqueCompanies =
    new Set(
      visits.map(
        (visit) =>
          visit.company_id
      )
    ).size;

  const packageValues =
    visits
      .map(
        (visit) =>
          visit.package_lpa
      )
      .filter(
        (
          value
        ): value is number =>
          typeof value ===
            "number" &&
          value > 0
      );

  const averagePackage =
    packageValues.length >
    0
      ? (
          packageValues.reduce(
            (
              total,
              value
            ) =>
              total + value,
            0
          ) /
          packageValues.length
        ).toFixed(1)
      : "—";

  const highestPackage =
    packageValues.length >
    0
      ? Math.max(
          ...packageValues
        ).toFixed(1)
      : "—";

  // ============================================================
  // SUBMISSION LABEL
  // ============================================================

  function getSubmissionTypeLabel(
    type: string
  ) {
    switch (type) {
      case "company_visit":
        return "Company Visit";

      case "interview_report":
        return "Interview Report";

      case "interview_question":
        return "Interview Question";

      case "cutoff":
        return "Placement Cutoff";

      case "experience":
        return "Placement Experience";

      default:
        return "Other";
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#060b1a] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl animate-pulse">

          <div className="mb-8 h-6 w-40 rounded bg-white/10" />

          <div className="mb-10">
            <div className="mb-4 h-12 w-2/3 rounded bg-white/10" />
            <div className="h-5 w-1/2 rounded bg-white/10" />
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({
              length: 4,
            }).map(
              (_, index) => (
                <div
                  key={`stat-skeleton-${index}`}
                  className="h-32 rounded-2xl border border-white/10 bg-white/10"
                />
              )
            )}
          </div>

          <div className="mt-8 h-28 rounded-2xl border border-white/10 bg-white/10" />

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {Array.from({
              length: 4,
            }).map(
              (_, index) => (
                <div
                  key={`card-skeleton-${index}`}
                  className="h-64 rounded-2xl border border-white/10 bg-white/10"
                />
              )
            )}
          </div>

        </div>
      </main>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-[#060b1a] text-white">

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">

        {/* =====================================================
            HERO
        ====================================================== */}

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-indigo-500/15 via-blue-500/10 to-transparent p-8 shadow-2xl shadow-black/20 lg:p-10">

          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative">

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-sm font-medium text-blue-300">
              <span>🏫</span>
              Campus Intelligence
            </div>

            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">

              <div>

                <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
                  Campus Intel
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 lg:text-lg">
                  Discover companies that visit your campus,
                  placement roles, eligibility requirements,
                  packages, and real-world placement intelligence.
                </p>

                {college && (
                  <div className="mt-6">

                    <p className="text-xl font-semibold text-white">
                      {college.name}
                      {college.city
                        ? `, ${college.city}`
                        : ""}
                    </p>

                    {college.state && (
                      <p className="mt-1 text-sm text-slate-400">
                        {college.state}
                        {college.city
                          ? ", India"
                          : ""}
                      </p>
                    )}

                  </div>
                )}

              </div>

              <div className="flex flex-col gap-3 sm:flex-row">

                <button
                  onClick={() => {
                    setShowSubmissionForm(true);
                    setSubmissionMessage("");
                    setSubmissionError("");
                  }}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
                >
                  <span>＋</span>
                  Submit Campus Intel
                </button>

                <button
                  onClick={loadCampusIntel}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <span>↻</span>
                  Refresh Intel
                </button>

              </div>

            </div>

          </div>

        </section>

        {/* =====================================================
            SUCCESS
        ====================================================== */}

        {submissionMessage && (
          <section className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">

            <div className="flex items-start gap-3">

              <div className="text-xl">
                ✅
              </div>

              <div>

                <p className="font-semibold text-emerald-300">
                  Submission received
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {submissionMessage}
                </p>

              </div>

            </div>

          </section>
        )}

        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (
          <section className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-6">

            <div className="flex items-start gap-4">

              <div className="text-2xl">
                ⚠️
              </div>

              <div>

                <h2 className="font-semibold text-red-300">
                  Unable to load Campus Intel
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {error}
                </p>

              </div>

            </div>

          </section>
        )}

        {/* =====================================================
            STATISTICS
        ====================================================== */}

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-white/10 bg-white/4 p-6 transition hover:border-white/20">

            <div className="flex items-center justify-between">

              <span className="text-sm font-medium text-slate-400">
                Companies
              </span>

              <span className="text-xl">
                🏢
              </span>

            </div>

            <div className="mt-4 text-3xl font-bold">
              {uniqueCompanies}
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Companies with campus records
            </p>

          </div>

          <div className="rounded-2xl border border-white/10 bg-white/4 p-6 transition hover:border-white/20">

            <div className="flex items-center justify-between">

              <span className="text-sm font-medium text-slate-400">
                Placement Visits
              </span>

              <span className="text-xl">
                📅
              </span>

            </div>

            <div className="mt-4 text-3xl font-bold">
              {visits.length}
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Recorded opportunities
            </p>

          </div>

          <div className="rounded-2xl border border-white/10 bg-white/4 p-6 transition hover:border-white/20">

            <div className="flex items-center justify-between">

              <span className="text-sm font-medium text-slate-400">
                Average Package
              </span>

              <span className="text-xl">
                💰
              </span>

            </div>

            <div className="mt-4 text-3xl font-bold">
              {averagePackage !== "—"
                ? `₹${averagePackage} LPA`
                : "—"}
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Based on available package data
            </p>

          </div>

          <div className="rounded-2xl border border-white/10 bg-white/4 p-6 transition hover:border-white/20">

            <div className="flex items-center justify-between">

              <span className="text-sm font-medium text-slate-400">
                Highest Package
              </span>

              <span className="text-xl">
                🚀
              </span>

            </div>

            <div className="mt-4 text-3xl font-bold">
              {highestPackage !== "—"
                ? `₹${highestPackage} LPA`
                : "—"}
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Highest recorded package
            </p>

          </div>

        </section>

        {/* =====================================================
            SEARCH
        ====================================================== */}

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/4 p-6">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end">

            <div className="flex-1">

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Search Campus Intel
              </label>

              <div className="relative">

                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  🔎
                </span>

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search companies, roles, branches..."
                  className="w-full rounded-xl border border-white/10 bg-[#0a1022] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40"
                />

              </div>

            </div>

            <div className="w-full lg:w-52">

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Visit Year
              </label>

              <select
                value={yearFilter}
                onChange={(event) =>
                  setYearFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-[#0a1022] px-4 py-3 text-sm text-white outline-none focus:border-blue-400/40"
              >

                <option value="all">
                  All years
                </option>

                {years.map(
                  (year) => (
                    <option
                      key={year}
                      value={year.toString()}
                    >
                      {year}
                    </option>
                  )
                )}

              </select>

            </div>

          </div>

        </section>

        {/* =====================================================
            SEMANTIC INTERVIEW SEARCH
        ====================================================== */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-purple-400/20 bg-linear-to-br from-purple-500/10 via-indigo-500/5 to-transparent p-6">

          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-purple-300">
                <span>✨</span>
                AI Semantic Search
              </div>
              <h2 className="mt-2 text-2xl font-bold">
                Find similar interview questions
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Search by meaning, not just exact keywords. Try a topic, skill, or interview question.
              </p>
            </div>

            {semanticResults.length > 0 && (
              <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1.5 text-xs font-medium text-purple-300">
                {semanticResults.length} matching {semanticResults.length === 1 ? "question" : "questions"}
              </span>
            )}
          </div>

          <form onSubmit={handleSemanticSearch}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-purple-300">
                  🧠
                </span>
                <input
                  type="text"
                  value={semanticQuery}
                  onChange={(event) => setSemanticQuery(event.target.value)}
                  placeholder="e.g. React state and props, JavaScript closures, DSA arrays..."
                  className="w-full rounded-xl border border-white/10 bg-[#0a1022] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-purple-400/40"
                />
              </div>

              <button
                type="submit"
                disabled={semanticSearching}
                className="rounded-xl bg-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {semanticSearching ? "Searching..." : "Search with AI"}
              </button>

              {semanticResults.length > 0 && (
                <button
                  type="button"
                  onClick={clearSemanticSearch}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {semanticSearchError && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4">
              <p className="text-sm leading-6 text-red-300">⚠️ {semanticSearchError}</p>
            </div>
          )}

          {semanticResults.length > 0 && (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {semanticResults.map((result) => {
                const metadata = result.metadata ?? {};
                const similarity = Math.round(result.similarity * 1000) / 10;

                return (
                  <article
                    key={result.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-[#080d1d]/80 p-5 transition hover:border-purple-400/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-wrap gap-2">
                        {metadata.category && (
                          <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
                            {metadata.category}
                          </span>
                        )}
                        {metadata.difficulty && (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
                            {metadata.difficulty}
                          </span>
                        )}
                      </div>

                      <span className="shrink-0 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                        {similarity}% match
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl border border-purple-400/10 bg-purple-400/5 p-5">
                      <p className="text-sm leading-7 text-slate-200">
                        {result.content.split("\n")[0] || "Interview question"}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                      {metadata.company_name && <span>🏢 {metadata.company_name}</span>}
                      {metadata.role && <span>• {metadata.role}</span>}
                      {metadata.round_name && <span>• {metadata.round_name}</span>}
                      {metadata.interview_year && <span>• {metadata.interview_year}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!semanticSearching && semanticQuery.trim() && semanticResults.length === 0 && !semanticSearchError && (
            <div className="mt-5 rounded-xl border border-dashed border-white/10 bg-white/3 p-6 text-center">
              <p className="text-sm text-slate-500">
                No sufficiently similar interview questions were found.
              </p>
            </div>
          )}

        </section>

        {/* =====================================================
            COMPANY VISITS
        ====================================================== */}

        <section className="mt-10">

          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">

            <div>

              <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-300">
                <span>✦</span>
                Placement Intelligence
              </div>

              <h2 className="mt-2 text-2xl font-bold">
                Companies visiting your campus
              </h2>

            </div>

            <p className="text-sm text-slate-500">
              {filteredVisits.length} matching opportunities
            </p>

          </div>

          {filteredVisits.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-12 text-center">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl">
                🏢
              </div>

              <h3 className="mt-5 text-lg font-semibold">
                No campus data yet
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                There are currently no company visit records
                matching your college and selected filters.
              </p>

            </div>

          ) : (

            <div className="grid gap-5 md:grid-cols-2">

              {filteredVisits.map(
                (visit) => (

                  <article
                    key={visit.id}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-white/4 transition hover:-translate-y-1 hover:border-blue-400/20 hover:bg-white/6"
                  >

                    <div className="h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500" />

                    <div className="p-6">

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <h3 className="text-xl font-bold">
                            <Link
                              href={`/campus-intel/company/${visit.company_id}`}
                              className="transition hover:text-blue-300"
                            >
                              {visit.company?.name ??
                                "Unknown Company"}
                            </Link>
                          </h3>

                          {visit.company?.industry && (
                            <p className="mt-1 text-sm text-slate-500">
                              {visit.company.industry}
                            </p>
                          )}

                        </div>

                        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
                          {visit.visit_year}
                        </div>

                      </div>

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">

                        <div className="rounded-xl border border-white/5 bg-black/10 p-4">

                          <p className="text-xs uppercase tracking-wider text-slate-500">
                            Role
                          </p>

                          <p className="mt-2 font-semibold text-white">
                            {visit.role ??
                              "Not specified"}
                          </p>

                        </div>

                        <div className="rounded-xl border border-white/5 bg-black/10 p-4">

                          <p className="text-xs uppercase tracking-wider text-slate-500">
                            Job Type
                          </p>

                          <p className="mt-2 font-semibold text-white">
                            {visit.job_type ??
                              "Not specified"}
                          </p>

                        </div>

                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">

                        {visit.eligible_branch && (
                          <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
                            🎓 {visit.eligible_branch}
                          </span>
                        )}

                        {visit.minimum_cgpa !== null && (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                            CGPA ≥ {visit.minimum_cgpa}
                          </span>
                        )}

                        {visit.placement_status && (
                          <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
                            {visit.placement_status}
                          </span>
                        )}

                      </div>

                      {visit.package_lpa !== null && (
                        <div className="mt-5 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-4">

                          <div className="flex items-center justify-between">

                            <span className="text-sm text-slate-400">
                              Package
                            </span>

                            <span className="text-lg font-bold text-emerald-300">
                              ₹{visit.package_lpa} LPA
                            </span>

                          </div>

                        </div>
                      )}

                      {visit.visit_notes && (
                        <div className="mt-5">

                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Placement Notes
                          </p>

                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
                            {visit.visit_notes}
                          </p>

                        </div>
                      )}

                      {visit.company?.website && (
                        <div className="mt-5 border-t border-white/5 pt-5">

                          <a
                            href={
                              visit.company.website
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-300 transition hover:text-blue-200"
                          >
                            Visit company website
                            <span>↗</span>
                          </a>

                        </div>
                      )}

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>

        {/* =====================================================
            PUBLIC PLACEMENT CUTOFFS
        ====================================================== */}

        <section className="mt-12">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <span>🎯</span>
                Eligibility Intelligence
              </div>

              <h2 className="mt-2 text-2xl font-bold">
                Placement Cutoffs
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Moderated CGPA cutoffs and eligible branches shared by students for campus placement opportunities.
              </p>
            </div>

            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              {placementCutoffs.length} verified {placementCutoffs.length === 1 ? "cutoff" : "cutoffs"}
            </div>
          </div>

          {placementCutoffs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-2xl">
                🎯
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                No placement cutoffs yet
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Student-submitted cutoff information will appear here after moderation.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {placementCutoffs.map((cutoff) => {
                const minimumCgpa = cutoff.content?.match(
                  /Minimum CGPA:\s*([^\n]+)/i
                )?.[1]?.trim();
                const branches = cutoff.content?.match(
                  /Eligible Branches:\s*([^\n]+)/i
                )?.[1]?.trim();
                const notes = cutoff.content?.match(
                  /Notes:\s*([\s\S]*)/i
                )?.[1]?.trim();

                return (
                  <article
                    key={cutoff.id}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-white/4 transition hover:-translate-y-1 hover:border-emerald-400/20 hover:bg-white/6"
                  >
                    <div className="h-1 bg-linear-to-r from-emerald-500 via-teal-500 to-blue-500" />
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold">
                            {cutoff.company_name || "Company"}
                          </h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {cutoff.role || "Role not specified"}
                          </p>
                        </div>
                        {cutoff.visit_year && (
                          <span className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
                            {cutoff.visit_year}
                          </span>
                        )}
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-4">
                          <p className="text-xs uppercase tracking-wider text-slate-500">
                            Minimum CGPA
                          </p>
                          <p className="mt-2 text-2xl font-bold text-emerald-300">
                            {minimumCgpa || "Not specified"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-indigo-400/10 bg-indigo-400/5 p-4">
                          <p className="text-xs uppercase tracking-wider text-slate-500">
                            Eligible Branches
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-indigo-200">
                            {branches || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {notes && (
                        <div className="mt-5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Notes
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {notes}
                          </p>
                        </div>
                      )}

                      <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>🛡️</span>
                          <span>Vertex moderated</span>
                        </div>
                        <span className="text-xs text-slate-600">
                          {new Date(cutoff.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* =====================================================
            PUBLIC INTERVIEW QUESTIONS
        ====================================================== */}

        <section className="mt-12">

          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">

            <div>

              <div className="inline-flex items-center gap-2 text-sm font-semibold text-purple-300">
                <span>🧠</span>
                Interview Intelligence
              </div>

              <h2 className="mt-2 text-2xl font-bold">
                Interview Questions
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Real interview questions shared by students
                and reviewed by Vertex before publication.
              </p>

            </div>

            <div className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1.5 text-xs font-medium text-purple-300">
              {interviewQuestions.length} approved{" "}
              {interviewQuestions.length === 1
                ? "question"
                : "questions"}
            </div>

          </div>

          {interviewQuestions.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-10 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-400/10 text-2xl">
                🧠
              </div>

              <h3 className="mt-4 text-lg font-semibold">
                No approved interview questions yet
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Interview questions submitted by students
                will appear here after they pass moderation.
              </p>

            </div>

          ) : (

            <div className="grid gap-5 md:grid-cols-2">

              {interviewQuestions.map(
                (item) => {

                  const report =
                    item.report;

                  const company =
                    report?.company_name ||
                    report?.visit?.company?.name ||
                    "Company";

                  const questionRole =
                    report?.role ||
                    report?.visit?.role ||
                    "Role not specified";

                  const questionYear =
                    report?.interview_year ||
                    report?.visit?.visit_year;

                  return (
                    <article
                      key={item.id}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/4 transition hover:-translate-y-1 hover:border-purple-400/20 hover:bg-white/6"
                    >

                      <div className="h-1 bg-linear-to-r from-purple-500 via-indigo-500 to-blue-500" />

                      <div className="p-6">

                        <div className="flex items-start justify-between gap-4">

                          <div className="min-w-0">

                            <h3 className="text-lg font-bold text-white">
                              {company}
                            </h3>

                            <p className="mt-1 text-sm text-slate-400">
                              {questionRole}
                            </p>

                          </div>

                          {questionYear && (
                            <span className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
                              {questionYear}
                            </span>
                          )}

                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">

                          {item.category && (
                            <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
                              {item.category}
                            </span>
                          )}

                          {item.difficulty && (
                            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
                              {item.difficulty}
                            </span>
                          )}

                          {item.round_name && (
                            <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
                              {item.round_name}
                            </span>
                          )}

                        </div>

                        <div className="mt-5 rounded-xl border border-purple-400/10 bg-purple-400/5 p-5">

                          <div className="mb-2 flex items-center gap-2">

                            <span>
                              ❓
                            </span>

                            <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                              Interview Question
                            </span>

                          </div>

                          <p className="text-sm leading-7 text-slate-200">
                            {item.question}
                          </p>

                        </div>

                        <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">

                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>🛡️</span>
                            <span>
                              Vertex moderated
                            </span>
                          </div>

                          <span className="text-xs text-slate-600">
                            {new Date(
                              item.created_at
                            ).toLocaleDateString()}
                          </span>

                        </div>

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          )}

        </section>

        {/* =====================================================
            MY SUBMISSIONS
        ====================================================== */}

        <section className="mt-12">

          <div className="mb-5">

            <div className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <span>📋</span>
              Your Contributions
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              My Campus Intel submissions
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Track the information you&apos;ve submitted
              for moderation.
            </p>

          </div>

          {submissions.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-8">

              <div className="flex flex-col items-center justify-center text-center">

                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 text-2xl">
                  📝
                </div>

                <h3 className="mt-4 font-semibold">
                  No submissions yet
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Share a company visit, interview
                  experience, placement cutoff, or
                  useful interview question with your
                  campus community.
                </p>

                <button
                  onClick={() => {
                    setShowSubmissionForm(true);
                    setSubmissionMessage("");
                    setSubmissionError("");
                  }}
                  className="mt-5 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400"
                >
                  Submit your first Intel
                </button>

              </div>

            </div>

          ) : (

            <div className="space-y-3">

              {submissions.map(
                (submission) => (

                  <div
                    key={submission.id}
                    className="rounded-2xl border border-white/10 bg-white/4 p-5"
                  >

                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
                            {getSubmissionTypeLabel(
                              submission.submission_type
                            )}
                          </span>

                          <SubmissionStatus
                            status={
                              submission.moderation_status
                            }
                          />

                        </div>

                        <h3 className="mt-3 font-semibold text-white">
                          {submission.title ||
                            "Campus Intel submission"}
                        </h3>

                        {submission.company_name && (
                          <p className="mt-1 text-sm text-slate-400">
                            {submission.company_name}
                            {submission.role
                              ? ` · ${submission.role}`
                              : ""}
                          </p>
                        )}

                        {submission.content && (
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                            {submission.content}
                          </p>
                        )}

                      </div>

                      <div className="shrink-0 text-xs text-slate-600">
                        {new Date(
                          submission.created_at
                        ).toLocaleDateString()}
                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>

        {/* =====================================================
            TRUST
        ====================================================== */}

        <section className="mt-12 overflow-hidden rounded-3xl border border-indigo-400/10 bg-linear-to-br from-indigo-500/10 via-blue-500/5 to-transparent p-8 lg:p-10">

          <div className="max-w-3xl">

            <div className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <span>🛡️</span>
              VERTEX CAMPUS INTEL
            </div>

            <h2 className="mt-4 text-2xl font-bold lg:text-3xl">
              Turn student experiences into placement intelligence
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-400 lg:text-base">
              Campus Intel is designed to build a
              trusted knowledge base from real student
              experiences: interview rounds, coding
              questions, placement cutoffs, company
              visits, and preparation advice.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">

              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                Company Visits
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                Interview Questions
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                Placement Cutoffs
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                Preparation Advice
              </span>

            </div>

            <div className="mt-8 flex items-center gap-3 border-t border-white/5 pt-6">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
                🛡️
              </div>

              <div>

                <p className="text-sm font-semibold text-white">
                  Moderated
                </p>

                <p className="text-xs text-slate-500">
                  Community-submitted intelligence is
                  reviewed before becoming trusted
                  Campus Intel.
                </p>

              </div>

            </div>

          </div>

        </section>

      </div>

      {/* ==========================================================
          SUBMISSION MODAL
      =========================================================== */}

      {showSubmissionForm && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">

          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0a1022] shadow-2xl">

            {/* Header */}

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0a1022] px-6 py-5">

              <div>

                <div className="text-sm font-semibold text-blue-300">
                  ✦ COMMUNITY CONTRIBUTION
                </div>

                <h2 className="mt-1 text-xl font-bold">
                  Submit Campus Intel
                </h2>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (!submitting) {
                    setShowSubmissionForm(false);
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>

            </div>

            {/* Form */}

            <form
              onSubmit={handleSubmitIntel}
              className="space-y-6 p-6"
            >

              {/* Info */}

              <div className="rounded-2xl border border-blue-400/10 bg-blue-400/5 p-4">

                <div className="flex gap-3">

                  <div className="text-xl">
                    🛡️
                  </div>

                  <p className="text-sm leading-6 text-slate-400">
                    Your submission will be reviewed by
                    Vertex before it becomes trusted Campus
                    Intel. Please share genuine placement
                    information and avoid posting personal
                    or confidential information.
                  </p>

                </div>

              </div>

              {/* Information Type */}

              <div>

                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Information Type
                </label>

                <select
                  value={submissionType}
                  onChange={(event) =>
                    handleSubmissionTypeChange(
                      event.target.value as SubmissionType
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-blue-400/40"
                >

                  <option value="company_visit">
                    Company Visit
                  </option>

                  <option value="interview_report">
                    Interview Experience
                  </option>

                  <option value="interview_question">
                    Interview Question
                  </option>

                  <option value="cutoff">
                    Placement Cutoff
                  </option>

                  <option value="experience">
                    Placement Experience
                  </option>

                  <option value="other">
                    Other Campus Intel
                  </option>

                </select>

              </div>

              {/* ==================================================
                  PLACEMENT CUTOFF
              =================================================== */}

              {submissionType === "cutoff" && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-emerald-300">
                      Placement Cutoff
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Share the minimum CGPA and eligible branches reported for this campus placement opportunity.
                    </p>
                  </div>

                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Company Visit
                    <span className="ml-1 text-red-400">*</span>
                  </label>

                  <select
                    value={selectedCutoffVisitId}
                    onChange={(event) =>
                      handleCutoffVisitSelection(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/40"
                  >
                    <option value="">Select a company visit</option>
                    {visits.map((visit) => (
                      <option key={visit.id} value={visit.id}>
                        {visit.company?.name ?? "Unknown Company"} — {visit.visit_year}
                        {visit.role ? ` — ${visit.role}` : ""}
                      </option>
                    ))}
                  </select>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Minimum CGPA
                        <span className="ml-1 text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={cutoffCgpa}
                        onChange={(event) => setCutoffCgpa(event.target.value)}
                        placeholder="e.g. 7.0"
                        className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Eligible Branches
                        <span className="ml-1 text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={cutoffBranches}
                        onChange={(event) => setCutoffBranches(event.target.value)}
                        placeholder="e.g. CSE, ISE, AIML, ECE"
                        className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ==================================================
                  INTERVIEW EXPERIENCE
              =================================================== */}

              {submissionType ===
                "interview_report" && (

                <div className="rounded-2xl border border-indigo-400/20 bg-indigo-400/5 p-5">

                  <div className="mb-4">

                    <p className="text-sm font-semibold text-indigo-300">
                      Interview Experience
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Select the company visit associated
                      with this interview.
                    </p>

                  </div>

                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Company Visit
                    <span className="ml-1 text-red-400">
                      *
                    </span>
                  </label>

                  <select
                    value={selectedVisitId}
                    onChange={(event) =>
                      handleVisitSelection(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/40"
                  >

                    <option value="">
                      Select a company visit
                    </option>

                    {visits.map(
                      (visit) => (
                        <option
                          key={visit.id}
                          value={visit.id}
                        >
                          {visit.company?.name ??
                            "Unknown Company"}{" "}
                          — {visit.visit_year}
                          {visit.role
                            ? ` — ${visit.role}`
                            : ""}
                        </option>
                      )
                    )}

                  </select>

                  {visits.length === 0 && (
                    <p className="mt-3 text-xs text-amber-300">
                      No company visits are currently
                      available for your college.
                    </p>
                  )}

                </div>
              )}

              {/* ==================================================
                  INTERVIEW QUESTION
              =================================================== */}

              {submissionType ===
                "interview_question" && (

                <div className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">

                  <div className="mb-4">

                    <p className="text-sm font-semibold text-purple-300">
                      Interview Question
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Add the question that was asked during
                      the campus interview.
                    </p>

                  </div>

                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Company Visit
                    <span className="ml-1 text-red-400">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      selectedQuestionVisitId
                    }
                    onChange={(event) =>
                      handleQuestionVisitSelection(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-purple-400/40"
                  >

                    <option value="">
                      Select a company visit
                    </option>

                    {visits.map(
                      (visit) => (
                        <option
                          key={visit.id}
                          value={visit.id}
                        >
                          {visit.company?.name ??
                            "Unknown Company"}{" "}
                          — {visit.visit_year}
                          {visit.role
                            ? ` — ${visit.role}`
                            : ""}
                        </option>
                      )
                    )}

                  </select>

                  <div className="mt-5">

                    <div className="mb-2 flex items-center justify-between">

                      <label className="text-sm font-medium text-slate-300">
                        Interview Question
                        <span className="ml-1 text-red-400">
                          *
                        </span>
                      </label>

                      <span className="text-xs text-slate-600">
                        {interviewQuestion.length}/1000
                      </span>

                    </div>

                    <textarea
                      value={
                        interviewQuestion
                      }
                      onChange={(event) => {
                        if (
                          event.target.value
                            .length <= 1000
                        ) {
                          setInterviewQuestion(
                            event.target.value
                          );
                        }
                      }}
                      rows={5}
                      placeholder="e.g. Given an array, find the longest subarray with a sum equal to K."
                      className="w-full resize-none rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-purple-400/40"
                    />

                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">

                    <div>

                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Category
                        <span className="ml-1 text-red-400">
                          *
                        </span>
                      </label>

                      <select
                        value={
                          questionCategory
                        }
                        onChange={(event) =>
                          setQuestionCategory(
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-purple-400/40"
                      >

                        <option value="DSA">
                          DSA
                        </option>

                        <option value="SQL">
                          SQL
                        </option>

                        <option value="OOP">
                          OOP
                        </option>

                        <option value="DBMS">
                          DBMS
                        </option>

                        <option value="Computer Networks">
                          Computer Networks
                        </option>

                        <option value="Operating Systems">
                          Operating Systems
                        </option>

                        <option value="Web Development">
                          Web Development
                        </option>

                        <option value="Aptitude">
                          Aptitude
                        </option>

                        <option value="HR">
                          HR
                        </option>

                        <option value="Other">
                          Other
                        </option>

                      </select>

                    </div>

                    <div>

                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Difficulty
                      </label>

                      <select
                        value={
                          questionDifficulty
                        }
                        onChange={(event) =>
                          setQuestionDifficulty(
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-purple-400/40"
                      >

                        <option value="Easy">
                          Easy
                        </option>

                        <option value="Medium">
                          Medium
                        </option>

                        <option value="Hard">
                          Hard
                        </option>

                      </select>

                    </div>

                  </div>

                  <div className="mt-5">

                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Interview Round
                    </label>

                    <select
                      value={
                        questionRound
                      }
                      onChange={(event) =>
                        setQuestionRound(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-purple-400/40"
                    >

                      <option value="Online Assessment">
                        Online Assessment
                      </option>

                      <option value="Technical Round 1">
                        Technical Round 1
                      </option>

                      <option value="Technical Round 2">
                        Technical Round 2
                      </option>

                      <option value="Technical Round 3">
                        Technical Round 3
                      </option>

                      <option value="HR Round">
                        HR Round
                      </option>

                      <option value="Other">
                        Other
                      </option>

                    </select>

                  </div>

                  <label className="mt-5 flex cursor-pointer items-center gap-3">

                    <input
                      type="checkbox"
                      checked={
                        anonymousQuestion
                      }
                      onChange={(event) =>
                        setAnonymousQuestion(
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 rounded border-white/20 bg-[#060b1a]"
                    />

                    <span className="text-sm text-slate-400">
                      Submit anonymously
                    </span>

                  </label>

                </div>
              )}

              {/* ==================================================
                  COMPANY NAME
              =================================================== */}

              <div>

                <label className="mb-2 block text-sm font-medium text-slate-300">

                  Company Name

                  {(submissionType ===
                    "company_visit" ||
                    submissionType ===
                      "interview_report" ||
                    submissionType ===
                      "interview_question" ||
                    submissionType ===
                      "cutoff") && (
                    <span className="ml-1 text-red-400">
                      *
                    </span>
                  )}

                </label>

                <input
                  type="text"
                  value={companyName}
                  onChange={(event) =>
                    setCompanyName(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Accenture"
                  readOnly={
                    (submissionType ===
                      "interview_report" &&
                      Boolean(
                        selectedVisitId
                      )) ||
                    (submissionType ===
                      "interview_question" &&
                      Boolean(
                        selectedQuestionVisitId
                      )) ||
                    (submissionType ===
                      "cutoff" &&
                      Boolean(selectedCutoffVisitId))
                  }
                  className={`w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40 ${
                    (
                      (
                        submissionType ===
                          "interview_report" &&
                        selectedVisitId
                      ) ||
                      (
                        submissionType ===
                          "interview_question" &&
                        selectedQuestionVisitId
                      ) ||
                      (
                        submissionType ===
                          "cutoff" &&
                        selectedCutoffVisitId
                      )
                    )
                      ? "cursor-not-allowed opacity-70"
                      : ""
                  }`}
                />

              </div>

              {/* ==================================================
                  ROLE + YEAR
              =================================================== */}

              <div className="grid gap-5 sm:grid-cols-2">

                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Role
                  </label>

                  <input
                    type="text"
                    value={role}
                    onChange={(event) =>
                      setRole(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Associate Software Engineer"
                    readOnly={
                      (
                        submissionType ===
                          "interview_report" &&
                        Boolean(
                          selectedVisitId
                        )
                      ) ||
                      (
                        submissionType ===
                          "interview_question" &&
                        Boolean(
                          selectedQuestionVisitId
                        )
                      ) ||
                      (
                        submissionType ===
                          "cutoff" &&
                        Boolean(
                          selectedCutoffVisitId
                        )
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40"
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Year
                  </label>

                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={visitYear}
                    onChange={(event) =>
                      setVisitYear(
                        event.target.value
                      )
                    }
                    readOnly={
                      (
                        submissionType ===
                          "interview_report" &&
                        Boolean(
                          selectedVisitId
                        )
                      ) ||
                      (
                        submissionType ===
                          "interview_question" &&
                        Boolean(
                          selectedQuestionVisitId
                        )
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-blue-400/40"
                  />

                </div>

              </div>

              {/* ==================================================
                  INTERVIEW RESULT
              =================================================== */}

              {submissionType ===
                "interview_report" && (

                <div className="grid gap-5 sm:grid-cols-2">

                  <div>

                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Interview Result
                      <span className="ml-1 text-red-400">
                        *
                      </span>
                    </label>

                    <select
                      value={
                        interviewResult
                      }
                      onChange={(event) =>
                        setInterviewResult(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/40"
                    >

                      <option value="">
                        Select result
                      </option>

                      <option value="Selected">
                        Selected
                      </option>

                      <option value="Rejected">
                        Rejected
                      </option>

                      <option value="Waitlisted">
                        Waitlisted
                      </option>

                      <option value="Not Disclosed">
                        Not Disclosed
                      </option>

                    </select>

                  </div>

                  <div>

                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Number of Rounds
                      <span className="ml-1 text-red-400">
                        *
                      </span>
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={
                        roundsCount
                      }
                      onChange={(event) =>
                        setRoundsCount(
                          event.target.value
                        )
                      }
                      placeholder="e.g. 4"
                      className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/40"
                    />

                  </div>

                </div>
              )}

              {/* ==================================================
                  INTERVIEW DIFFICULTY
              =================================================== */}

              {submissionType ===
                "interview_report" && (

                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Interview Difficulty
                    <span className="ml-1 text-red-400">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      interviewDifficulty
                    }
                    onChange={(event) =>
                      setInterviewDifficulty(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/40"
                  >

                    <option value="">
                      Select difficulty
                    </option>

                    <option value="Easy">
                      Easy
                    </option>

                    <option value="Medium">
                      Medium
                    </option>

                    <option value="Hard">
                      Hard
                    </option>

                  </select>

                </div>
              )}

              {/* ==================================================
                  OVERALL EXPERIENCE
              =================================================== */}

              {submissionType ===
                "interview_report" && (

                <div>

                  <div className="mb-2 flex items-center justify-between">

                    <label className="block text-sm font-medium text-slate-300">
                      Overall Experience
                      <span className="ml-1 text-red-400">
                        *
                      </span>
                    </label>

                    <span className="text-xs text-slate-600">
                      {overallExperience.length}/3000
                    </span>

                  </div>

                  <textarea
                    value={
                      overallExperience
                    }
                    onChange={(event) => {
                      if (
                        event.target.value
                          .length <= 3000
                      ) {
                        setOverallExperience(
                          event.target.value
                        );
                      }
                    }}
                    rows={6}
                    placeholder="Describe the interview rounds, topics discussed, coding questions, technical discussions, and HR questions..."
                    className="w-full resize-none rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/40"
                  />

                </div>
              )}

              {/* ==================================================
                  PREPARATION ADVICE
              =================================================== */}

              {submissionType ===
                "interview_report" && (

                <div>

                  <div className="mb-2 flex items-center justify-between">

                    <label className="block text-sm font-medium text-slate-300">
                      Preparation Advice
                      <span className="ml-1 text-red-400">
                        *
                      </span>
                    </label>

                    <span className="text-xs text-slate-600">
                      {preparationAdvice.length}/2000
                    </span>

                  </div>

                  <textarea
                    value={
                      preparationAdvice
                    }
                    onChange={(event) => {
                      if (
                        event.target.value
                          .length <= 2000
                      ) {
                        setPreparationAdvice(
                          event.target.value
                        );
                      }
                    }}
                    rows={5}
                    placeholder="What should students prepare for this company?"
                    className="w-full resize-none rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/40"
                  />

                  <label className="mt-4 flex cursor-pointer items-center gap-3">

                    <input
                      type="checkbox"
                      checked={
                        anonymousInterview
                      }
                      onChange={(event) =>
                        setAnonymousInterview(
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 rounded border-white/20 bg-[#060b1a]"
                    />

                    <span className="text-sm text-slate-400">
                      Submit anonymously
                    </span>

                  </label>

                </div>
              )}

              {/* ==================================================
                  TITLE
              =================================================== */}

              <div>

                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Title
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value
                    )
                  }
                  placeholder="Short title for your contribution"
                  className="w-full rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40"
                />

              </div>

              {/* ==================================================
                  DETAILS
              =================================================== */}

              <div>

                <div className="mb-2 flex items-center justify-between">

                  <label className="block text-sm font-medium text-slate-300">

                    Details

                    <span className="ml-1 text-red-400">
                      *
                    </span>

                  </label>

                  <span className="text-xs text-slate-600">
                    {content.length}/3000
                  </span>

                </div>

                <textarea
                  value={content}
                  onChange={(event) => {
                    if (
                      event.target.value
                        .length <= 3000
                    ) {
                      setContent(
                        event.target.value
                      );
                    }
                  }}
                  rows={7}
                  placeholder={
                    submissionType ===
                    "interview_report"
                      ? "Add a concise summary of the selection process..."
                      : submissionType ===
                          "interview_question"
                        ? "Share any useful context about when the question was asked, what the interviewer expected, or optimization discussion..."
                        : submissionType ===
                            "cutoff"
                          ? "Share the placement eligibility/cutoff information..."
                          : submissionType ===
                              "company_visit"
                            ? "Describe the campus visit, role, eligibility, selection process, and anything useful for students..."
                            : "Share useful placement information that could help students at your college..."
                  }
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#060b1a] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40"
                />

              </div>

              {/* ==================================================
                  ERROR
              =================================================== */}

              {submissionError && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">

                  <div className="flex gap-3">

                    <span>
                      ⚠️
                    </span>

                    <p className="text-sm leading-6 text-red-300">
                      {submissionError}
                    </p>

                  </div>

                </div>
              )}

              {/* ==================================================
                  BUTTONS
              =================================================== */}

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowSubmissionForm(false);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Submitting..."
                    : "Submit for Review"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </main>
  );
}

/* ================================================================
   SUBMISSION STATUS
================================================================ */

function SubmissionStatus({
  status,
}: {
  status: string;
}) {
  if (status === "approved") {
    return (
      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
        ✓ Approved
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-300">
        Rejected
      </span>
    );
  }

  return (
    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
      ⏳ Pending Review
    </span>
  );
}