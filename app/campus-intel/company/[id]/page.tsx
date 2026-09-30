"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Company = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  description: string | null;
};

type Visit = {
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
};

type Cutoff = {
  id: string;
  title: string | null;
  content: string | null;
  company_name: string | null;
  role: string | null;
  visit_year: number | null;
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
  report: {
    anonymous: boolean;
    moderation_status: string;
    source_submission_id: string | null;
    visit: {
      visit_year: number;
      role: string | null;
      company: { name: string } | null;
    } | null;
  } | null;
};

type ProfileCollege = {
  college: string | null;
};

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const companyId = params?.id;

  const [company, setCompany] = useState<Company | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [cutoffs, setCutoffs] = useState<Cutoff[]>([]);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCompanyIntel(id: string) {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("Please log in to view company intelligence.");
      }

      // ---------------------------------------------------------
      // Student college
      // ---------------------------------------------------------
      const { data: profile, error: profileError } = await supabase
        .from("student_profiles")
        .select("college")
        .eq("user_id", user.id)
        .maybeSingle<ProfileCollege>();

      if (profileError) {
        throw new Error(
          `Student profile query failed: ${profileError.message}`
        );
      }

      if (!profile?.college) {
        throw new Error("Your college is not available in your profile.");
      }

      const baseCollegeName = profile.college.split(",")[0].trim();

      const { data: college, error: collegeError } = await supabase
        .from("colleges")
        .select("id, name, city, state")
        .ilike("name", baseCollegeName)
        .limit(1)
        .maybeSingle();

      if (collegeError) {
        throw new Error(`College lookup failed: ${collegeError.message}`);
      }

      if (!college) {
        throw new Error("Your college could not be found in Campus Intel.");
      }

      // ---------------------------------------------------------
      // Company
      // ---------------------------------------------------------
      const { data: companyData, error: companyError } = await supabase
        .from("campus_companies")
        .select("id, name, website, industry, description")
        .eq("id", id)
        .maybeSingle();

      if (companyError) {
        throw new Error(`Company query failed: ${companyError.message}`);
      }

      if (!companyData) {
        throw new Error("Company not found.");
      }

      setCompany(companyData as Company);

      // ---------------------------------------------------------
      // Campus visits for this company + student's college
      // ---------------------------------------------------------
      const { data: visitData, error: visitError } = await supabase
        .from("campus_company_visits")
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
        .eq("company_id", id)
        .eq("college_id", college.id)
        .order("visit_year", { ascending: false });

      if (visitError) {
        throw new Error(`Company visits query failed: ${visitError.message}`);
      }

      setVisits((visitData ?? []) as Visit[]);

      // ---------------------------------------------------------
      // Approved cutoff submissions for this college + company
      // ---------------------------------------------------------
      const { data: cutoffData, error: cutoffError } = await supabase
        .from("campus_intel_submissions")
        .select(
          `
            id,
            title,
            content,
            company_name,
            role,
            visit_year,
            created_at
          `
        )
        .eq("college_id", college.id)
        .eq("submission_type", "cutoff")
        .eq("moderation_status", "approved")
        .ilike("company_name", companyData.name)
        .order("created_at", { ascending: false });

      if (cutoffError) {
        console.error("Cutoff query failed:", cutoffError.message);
        setCutoffs([]);
      } else {
        setCutoffs((cutoffData ?? []) as Cutoff[]);
      }

      // ---------------------------------------------------------
      // Approved interview questions connected to approved
      // generic interview-question submissions.
      // ---------------------------------------------------------
      const { data: approvedQuestionSubmissions, error: submissionError } =
        await supabase
          .from("campus_intel_submissions")
          .select("id")
          .eq("college_id", college.id)
          .eq("submission_type", "interview_question")
          .eq("moderation_status", "approved");

      if (submissionError) {
        console.error(
          "Approved question submission query failed:",
          submissionError.message
        );
        setQuestions([]);
      } else {
        const approvedIds = new Set(
          (approvedQuestionSubmissions ?? []).map((row) => row.id)
        );

        if (approvedIds.size === 0) {
          setQuestions([]);
        } else {
          const { data: questionData, error: questionError } = await supabase
            .from("campus_interview_questions")
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
                  anonymous,
                  moderation_status,
                  source_submission_id,
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
            .order("created_at", { ascending: false });

          if (questionError) {
            console.error(
              "Interview question query failed:",
              questionError.message
            );
            setQuestions([]);
          } else {
            const publicQuestions = (
              (questionData ?? []) as unknown as InterviewQuestion[]
            ).filter((item) => {
              const report = item.report;
              const sourceSubmissionId = report?.source_submission_id;
              const questionCompany =
                report?.visit?.company?.name?.trim().toLowerCase() ?? "";

              if (!sourceSubmissionId) {
  return false;
}

return (
  approvedIds.has(sourceSubmissionId) &&
  questionCompany === companyData.name.trim().toLowerCase()
);
            });

            setQuestions(publicQuestions);
          }
        }
      }
    } catch (err) {
      console.error("Company Intel ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load company intelligence."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (companyId) {
      // This effect starts the external data load; the loader updates state
      // when the request completes (or fails).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadCompanyIntel(companyId);
    }
  }, [companyId]);

  const packageValues = useMemo(
    () =>
      visits
        .map((visit) => visit.package_lpa)
        .filter((value): value is number => typeof value === "number" && value > 0),
    [visits]
  );

  const highestPackage =
    packageValues.length > 0 ? Math.max(...packageValues) : null;

  const latestVisit = visits[0] ?? null;

  const latestCutoff = cutoffs[0] ?? null;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#060b1a] px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="h-6 w-32 rounded bg-white/10" />
          <div className="mt-8 h-40 rounded-3xl border border-white/10 bg-white/5" />
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="h-32 rounded-2xl bg-white/5" />
            <div className="h-32 rounded-2xl bg-white/5" />
            <div className="h-32 rounded-2xl bg-white/5" />
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="h-72 rounded-2xl bg-white/5" />
            <div className="h-72 rounded-2xl bg-white/5" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !company) {
    return (
      <main className="min-h-screen bg-[#060b1a] px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => router.back()}
            className="text-sm font-medium text-blue-300 hover:text-blue-200"
          >
            ← Back to Campus Intel
          </button>

          <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
            <h1 className="text-xl font-semibold text-red-300">
              Unable to load company intelligence
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {error || "Company not found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#060b1a] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 transition hover:text-blue-200"
        >
          ← Back to Campus Intel
        </button>

        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-blue-500/15 via-indigo-500/10 to-transparent p-8 shadow-2xl shadow-black/20 lg:p-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-sm font-medium text-blue-300">
                🏢 Company Intelligence
              </div>

              <h1 className="mt-5 text-4xl font-bold tracking-tight lg:text-5xl">
                {company.name}
              </h1>

              {company.industry && (
                <p className="mt-2 text-base text-slate-400">
                  {company.industry}
                </p>
              )}

              {company.description && (
                <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 lg:text-base">
                  {company.description}
                </p>
              )}
            </div>

            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Visit website ↗
              </a>
            )}
          </div>
        </section>

        {/* SUMMARY */}
        <section className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
            <p className="text-sm text-slate-500">Campus visits</p>
            <p className="mt-3 text-3xl font-bold">{visits.length}</p>
            <p className="mt-2 text-sm text-slate-500">
              Recorded opportunities
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
            <p className="text-sm text-slate-500">Highest recorded package</p>
            <p className="mt-3 text-3xl font-bold text-emerald-300">
              {highestPackage !== null ? `₹${highestPackage} LPA` : "—"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Based on this campus&apos;s records
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
            <p className="text-sm text-slate-500">Verified insights</p>
            <p className="mt-3 text-3xl font-bold">
              {cutoffs.length + questions.length}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Approved cutoffs + interview questions
            </p>
          </div>
        </section>

        {/* LATEST ELIGIBILITY */}
        {latestVisit && (
          <section className="mt-8 rounded-2xl border border-emerald-400/10 bg-emerald-400/5 p-6 lg:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  🎓 Latest Placement Opportunity
                </div>
                <h2 className="mt-2 text-2xl font-bold">
                  {latestVisit.role || "Placement opportunity"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {latestVisit.visit_year}
                  {latestVisit.job_type ? ` · ${latestVisit.job_type}` : ""}
                </p>
              </div>

              {latestVisit.package_lpa !== null && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Package
                  </p>
                  <p className="mt-1 text-xl font-bold text-emerald-300">
                    ₹{latestVisit.package_lpa} LPA
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoCard label="Minimum CGPA">
                {latestVisit.minimum_cgpa !== null
                  ? `≥ ${latestVisit.minimum_cgpa}`
                  : "Not specified"}
              </InfoCard>

              <InfoCard label="Eligible branches">
                {latestVisit.eligible_branch || "Not specified"}
              </InfoCard>

              <InfoCard label="Placement status">
                {latestVisit.placement_status || "Not specified"}
              </InfoCard>

              <InfoCard label="Job type">
                {latestVisit.job_type || "Not specified"}
              </InfoCard>
            </div>
          </section>
        )}

        {/* MAIN CONTENT */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* CAMPUS HISTORY */}
          <section className="rounded-2xl border border-white/10 bg-white/4 p-6">
            <div className="mb-5">
              <div className="text-sm font-semibold text-blue-300">
                📅 Placement History
              </div>
              <h2 className="mt-2 text-2xl font-bold">Campus visits</h2>
            </div>

            {visits.length === 0 ? (
              <EmptyState text="No recorded campus visits for this company yet." />
            ) : (
              <div className="space-y-4">
                {visits.map((visit) => (
                  <article
                    key={visit.id}
                    className="rounded-xl border border-white/8 bg-[#0a1022] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-white">
                          {visit.role || "Placement opportunity"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {visit.visit_year}
                          {visit.job_type ? ` · ${visit.job_type}` : ""}
                        </p>
                      </div>

                      {visit.package_lpa !== null && (
                        <span className="shrink-0 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                          ₹{visit.package_lpa} LPA
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {visit.minimum_cgpa !== null && (
                        <Badge>CGPA ≥ {visit.minimum_cgpa}</Badge>
                      )}
                      {visit.eligible_branch && (
                        <Badge>{visit.eligible_branch}</Badge>
                      )}
                      {visit.placement_status && (
                        <Badge>{visit.placement_status}</Badge>
                      )}
                    </div>

                    {visit.visit_notes && (
                      <p className="mt-4 text-sm leading-6 text-slate-400">
                        {visit.visit_notes}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* CUTOFFS */}
          <section className="rounded-2xl border border-white/10 bg-white/4 p-6">
            <div className="mb-5">
              <div className="text-sm font-semibold text-emerald-300">
                🎯 Eligibility Intelligence
              </div>
              <h2 className="mt-2 text-2xl font-bold">Verified cutoffs</h2>
            </div>

            {cutoffs.length === 0 ? (
              <EmptyState text="No approved placement cutoff contributions for this company yet." />
            ) : (
              <div className="space-y-4">
                {cutoffs.map((cutoff) => (
                  <article
                    key={cutoff.id}
                    className="rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-white">
                          {cutoff.title || `${company.name} placement cutoff`}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {cutoff.visit_year ?? "Year not specified"}
                          {cutoff.role ? ` · ${cutoff.role}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                        ✓ Verified
                      </span>
                    </div>

                    {cutoff.content && (
                      <p className="mt-4 text-sm leading-7 text-slate-300">
                        {cutoff.content}
                      </p>
                    )}

                    <p className="mt-4 text-xs text-slate-600">
                      Moderated contribution · {formatDate(cutoff.created_at)}
                    </p>
                  </article>
                ))}
              </div>
            )}

            {latestCutoff && !cutoffHasStructuredInfo(latestCutoff) && (
              <p className="mt-4 text-xs leading-5 text-slate-600">
                Cutoff submissions may contain additional eligibility details
                inside the contribution notes.
              </p>
            )}
          </section>
        </div>

        {/* INTERVIEW QUESTIONS */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/4 p-6 lg:p-8">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="text-sm font-semibold text-purple-300">
                🧠 Interview Intelligence
              </div>
              <h2 className="mt-2 text-2xl font-bold">Interview questions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Questions approved by Vertex and associated with this company.
              </p>
            </div>

            <div className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1.5 text-xs font-medium text-purple-300">
              {questions.length} approved
            </div>
          </div>

          {questions.length === 0 ? (
            <EmptyState text="No approved interview questions for this company yet." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {questions.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-purple-400/10 bg-purple-400/5 p-5"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge>{item.category}</Badge>
                    {item.difficulty && <Badge>{item.difficulty}</Badge>}
                    {item.round_name && <Badge>{item.round_name}</Badge>}
                  </div>

                  <div className="mt-5 rounded-xl border border-purple-400/10 bg-black/10 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-300">
                      ❓ Interview Question
                    </div>
                    <p className="text-sm leading-7 text-slate-200">
                      {item.question}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-slate-500">
                    <span>🛡️ Vertex moderated</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* TRUST */}
        <section className="mt-8 rounded-3xl border border-indigo-400/10 bg-linear-to-br from-indigo-500/10 via-blue-500/5 to-transparent p-8 lg:p-10">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold text-indigo-300">
              🛡️ TRUSTED CAMPUS INTEL
            </div>
            <h2 className="mt-4 text-2xl font-bold">
              One company, one intelligence view
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Vertex brings together campus visits, eligibility data, moderated
              cutoffs, and approved interview questions so students can prepare
              from one company-specific view.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{children}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
      {children}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-7 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-lg">
        📭
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

function cutoffHasStructuredInfo(cutoff: Cutoff) {
  const content = cutoff.content ?? "";
  return /minimum\s+cgpa|eligible\s+branch/i.test(content);
}
