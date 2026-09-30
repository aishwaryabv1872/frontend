"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  company_id: string;
  visit_year: number;
  role: string | null;
  job_type: string | null;
  eligible_branch: string | null;
  minimum_cgpa: number | null;
  placement_status: string | null;
  package_lpa: number | null;
};

type PublicCutoff = {
  id: string;
  title: string | null;
  content: string | null;
  company_name: string | null;
  role: string | null;
  visit_year: number | null;
  created_at: string;
};

type PublicQuestion = {
  id: string;
  question: string;
  category: string;
  difficulty: string | null;
  round_name: string | null;
  report?: {
    source_submission_id: string | null;
    visit?: {
      visit_year: number;
      role: string | null;
      company?: { name: string } | null;
    } | null;
  } | null;
};

type College = {
  id: string;
  name: string;
};

type PublicIntel = {
  company: Company;
  visits: Visit[];
  cutoffs: PublicCutoff[];
  questions: PublicQuestion[];
};

export default function CampusIntelAIPage() {
  const [collegeName, setCollegeName] = useState("");
  const [intel, setIntel] = useState<PublicIntel[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const loadIntel = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        setError("Please log in to use AI Campus Intel.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("student_profiles")
        .select("college, college_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.college) {
        setError("Your college is missing from your student profile.");
        return;
      }

      setCollegeName(profile.college);

      let college: College | null = null;

      // Prefer the student's foreign-key college_id when available.
      // Fall back to the text college name for older profiles.
      if (profile.college_id) {
        const { data, error: collegeIdError } = await supabase
          .from("colleges")
          .select("id, name")
          .eq("id", profile.college_id)
          .maybeSingle();

        if (collegeIdError) throw collegeIdError;
        college = data;
      }

      if (!college) {
        const baseCollegeName = profile.college.split(",")[0].trim();
        const { data, error: collegeNameError } = await supabase
          .from("colleges")
          .select("id, name")
          .ilike("name", baseCollegeName)
          .limit(1)
          .maybeSingle();

        if (collegeNameError) throw collegeNameError;
        college = data;
      }

      if (!college) {
        setError(`Could not find ${profile.college} in Campus Intel.`);
        return;
      }

      const { data: visits, error: visitsError } = await supabase
        .from("campus_company_visits")
        .select(
          "id, company_id, visit_year, role, job_type, eligible_branch, minimum_cgpa, placement_status, package_lpa"
        )
        .eq("college_id", college.id)
        .order("visit_year", { ascending: false });

      if (visitsError) throw visitsError;

      const companyIds = Array.from(
        new Set((visits ?? []).map((visit) => visit.company_id))
      );

      if (companyIds.length === 0) {
        setIntel([]);
        return;
      }

      const { data: companies, error: companiesError } = await supabase
        .from("campus_companies")
        .select("id, name, website, industry, description")
        .in("id", companyIds);

      if (companiesError) throw companiesError;

      // Optional: approved placement cutoffs. A problem with this section
      // should not prevent the AI assistant from loading company visits.
      let cutoffs: PublicCutoff[] = [];

      const { data: cutoffData, error: cutoffError } = await supabase
        .from("campus_intel_submissions")
        .select(
          "id, title, content, company_name, role, visit_year, created_at"
        )
        .eq("college_id", college.id)
        .eq("submission_type", "cutoff")
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: false });

      if (cutoffError) {
        console.warn("AI Campus Intel cutoff query failed:", cutoffError.message);
      } else {
        cutoffs = cutoffData ?? [];
      }

      // Optional: approved interview questions. Keep this isolated because
      // nested Supabase joins can be blocked by RLS even when the main
      // Campus Intel page can still load visits/cutoffs.
      let publicQuestions: PublicQuestion[] = [];

      const { data: approvedQuestionSubmissions, error: approvedError } =
        await supabase
          .from("campus_intel_submissions")
          .select("id")
          .eq("college_id", college.id)
          .eq("submission_type", "interview_question")
          .eq("moderation_status", "approved");

      if (approvedError) {
        console.warn(
          "AI Campus Intel approved-question query failed:",
          approvedError.message
        );
      } else {
        const approvedIds = new Set(
          (approvedQuestionSubmissions ?? []).map((item) => item.id)
        );

        if (approvedIds.size > 0) {
          const { data: questionRows, error: questionError } = await supabase
            .from("campus_interview_questions")
            .select(`
              id,
              question,
              category,
              difficulty,
              round_name,
              report:campus_interview_reports!inner(
                source_submission_id,
                visit:campus_company_visits(
                  visit_year,
                  role,
                  company:campus_companies(name)
                )
              )
            `)
            .order("created_at", { ascending: false });

          if (questionError) {
            console.warn(
              "AI Campus Intel interview-question join failed:",
              questionError.message
            );
          } else {
            publicQuestions = ((questionRows ?? []) as unknown as PublicQuestion[]).filter(
              (item) =>
                Boolean(item.report?.source_submission_id) &&
                approvedIds.has(item.report?.source_submission_id as string)
            );
          }
        }
      }

      const grouped = new Map<string, PublicIntel>();

      for (const company of companies ?? []) {
        grouped.set(company.id, {
          company,
          visits: [],
          cutoffs: [],
          questions: [],
        });
      }

      for (const visit of visits ?? []) {
        const group = grouped.get(visit.company_id);
        if (group) group.visits.push(visit);
      }

      for (const cutoff of cutoffs ?? []) {
        const match = (companies ?? []).find(
          (company) =>
            company.name.trim().toLowerCase() ===
            (cutoff.company_name ?? "").trim().toLowerCase()
        );
        if (match) grouped.get(match.id)?.cutoffs.push(cutoff);
      }

      for (const item of publicQuestions) {
        const questionCompanyName =
          item.report?.visit?.company?.name?.trim().toLowerCase() ?? "";

        const companyId = (companies ?? []).find(
          (company) =>
            company.name.trim().toLowerCase() === questionCompanyName
        )?.id;

        if (companyId) grouped.get(companyId)?.questions.push(item);
      }

      const result = Array.from(grouped.values()).filter(
        (item) =>
          item.visits.length > 0 ||
          item.cutoffs.length > 0 ||
          item.questions.length > 0
      );

      // Company visits are the primary source of company-level Campus Intel.
      // Even if optional cutoff/question queries fail because of RLS, keep the
      // assistant usable with the approved visit data.
      setIntel(result);
      setSelectedCompanyId(result[0]?.company.id ?? "");
    } catch (err) {
      console.error("AI Campus Intel load error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Campus Intel."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadIntel();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadIntel]);

  const selectedIntel = useMemo(
    () =>
      intel.find((item) => item.company.id === selectedCompanyId) ??
      intel[0] ??
      null,
    [intel, selectedCompanyId]
  );

  function buildContext() {
    if (!selectedIntel) return "";

    const { company, visits, cutoffs, questions } = selectedIntel;

    return [
      `Company: ${company.name}`,
      `Industry: ${company.industry ?? "Not specified"}`,
      `Description: ${company.description ?? "Not specified"}`,
      "",
      "Campus visits:",
      ...visits.map(
        (visit) =>
          `- ${visit.visit_year}: ${visit.role ?? "Role not specified"}; ${
            visit.job_type ?? "Job type not specified"
          }; package ${
            visit.package_lpa != null ? `${visit.package_lpa} LPA` : "not specified"
          }; minimum CGPA ${
            visit.minimum_cgpa != null ? visit.minimum_cgpa : "not specified"
          }; eligible branches ${
            visit.eligible_branch ?? "not specified"
          }; status ${visit.placement_status ?? "not specified"}`
      ),
      "",
      "Approved placement cutoffs:",
      ...cutoffs.map(
        (cutoff) =>
          `- ${cutoff.title ?? "Placement cutoff"}: ${
            cutoff.content ?? "No details provided"
          }`
      ),
      "",
      "Approved interview questions:",
      ...questions.map(
        (item) =>
          `- ${item.question} | category: ${item.category} | difficulty: ${
            item.difficulty ?? "not specified"
          } | round: ${item.round_name ?? "not specified"}`
      ),
    ].join("\n");
  }

  async function askCampusAI(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  if (!selectedIntel) {
    setError("Select a company first.");
    return;
  }

  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    setError("Enter a question first.");
    return;
  }

  try {
    setAsking(true);
    setError("");
    setAnswer("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    const response = await fetch("/api/campus-intel-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        question: trimmedQuestion,
        college: collegeName,
        context: buildContext(),
      }),
    });

    let data: {
      answer?: string;
      error?: string;
    } = {};

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Unable to read the Campus Intel AI response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error || "AI request failed."
      );
    }

    setAnswer(
      data.answer || "No answer returned."
    );
  } catch (err) {
    console.error("Campus AI request failed:", {
      name: err instanceof Error ? err.name : "UnknownError",
    });

    setError(
      err instanceof Error
        ? err.message
        : "Unable to ask Campus Intel AI."
    );
  } finally {
    setAsking(false);
  }
}

  const examples = [
    "What should I prepare for this company?",
    "What technical topics have students reported?",
    "What is the minimum CGPA and which branches are eligible?",
    "Based on the approved questions, what should I practice first?",
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-[#060b1a] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl animate-pulse">
          <div className="h-6 w-40 rounded bg-white/10" />
          <div className="mt-6 h-16 w-2/3 rounded bg-white/10" />
          <div className="mt-8 h-64 rounded-3xl bg-white/5" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#060b1a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
        <Link
          href="/campus-intel"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-blue-200"
        >
          ← Back to Campus Intel
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-purple-400/20 bg-linear-to-br from-purple-500/15 via-indigo-500/10 to-transparent p-8 shadow-2xl shadow-black/20 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1.5 text-sm font-semibold text-purple-300">
            ✦ AI CAMPUS INTEL
          </div>

          <h1 className="mt-5 text-4xl font-bold tracking-tight lg:text-5xl">
            Ask Vertex about your campus placements
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            Ask questions about a company, eligibility, packages, placement
            cutoffs, or approved interview questions. Vertex answers using the
            approved Campus Intel available for your college.
          </p>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
            ⚠️ {error}
          </div>
        )}

        {intel.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-dashed border-white/10 bg-white/4 p-10 text-center">
            <div className="text-4xl">🏫</div>
            <h2 className="mt-4 text-xl font-semibold">
              No approved Campus Intel available yet
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Once your college has approved company, cutoff, or interview
              intelligence, the AI Campus Intel assistant can use it here.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/4 p-5">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Company
              </label>
              <select
                value={selectedCompanyId}
                onChange={(event) => {
                  setSelectedCompanyId(event.target.value);
                  setAnswer("");
                  setError("");
                }}
                className="w-full rounded-xl border border-white/10 bg-[#0a1022] px-4 py-3 text-sm text-white outline-none focus:border-purple-400/40"
              >
                {intel.map((item) => (
                  <option key={item.company.id} value={item.company.id}>
                    {item.company.name}
                  </option>
                ))}
              </select>
            </section>

            {selectedIntel && (
              <section className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Campus visits
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {selectedIntel.visits.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Verified cutoffs
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {selectedIntel.cutoffs.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Approved questions
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {selectedIntel.questions.length}
                  </p>
                </div>
              </section>
            )}

            <section className="mt-8 rounded-3xl border border-purple-400/15 bg-purple-400/5 p-6 lg:p-8">
              <form onSubmit={askCampusAI}>
                <label className="mb-3 block text-sm font-semibold text-purple-200">
                  Ask your placement question
                </label>

                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={1200}
                  rows={5}
                  placeholder="e.g. What should I prepare for Accenture based on the approved Campus Intel?"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-[#060b1a] px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-slate-600 focus:border-purple-400/40"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setQuestion(example)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
                    >
                      {example}
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-xs leading-5 text-slate-500">
                    AI answers are grounded in approved Campus Intel. They may
                    say when the available data is insufficient.
                  </p>

                  <button
                    type="submit"
                    disabled={asking}
                    className="shrink-0 rounded-xl bg-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {asking ? "Thinking..." : "Ask Vertex AI"}
                  </button>
                </div>
              </form>
            </section>

            {answer && (
              <section className="mt-8 rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-6 lg:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10">
                    ✨
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      Vertex AI Campus Intel
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedIntel?.company.name} · {collegeName}
                    </p>
                  </div>
                </div>

                <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                  {answer}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
