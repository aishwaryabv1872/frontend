"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Mentor = {
  id: string;
  full_name: string;
  current_company: string | null;
  job_role: string | null;
  verification_status: string;
  verification_note: string | null;
};

type Verification = {
  id: string;
  document_type: string;
  document_url: string | null;
  status: string;
  reviewer_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

const documentTypes = [
  {
    value: "college_id",
    label: "College ID",
    description: "Proof of your college/university identity",
  },
  {
    value: "graduation_proof",
    label: "Graduation Proof",
    description: "Degree certificate or graduation document",
  },
  {
    value: "employment_proof",
    label: "Employment Proof",
    description: "Offer letter, employee ID, or employment document",
  },
  {
    value: "linkedin",
    label: "LinkedIn Profile",
    description: "Your professional LinkedIn profile",
  },
  {
    value: "other",
    label: "Other",
    description: "Any other supporting verification",
  },
];

export default function MentorVerificationPage() {
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [verifications, setVerifications] = useState<
    Verification[]
  >([]);

  const [documentType, setDocumentType] =
    useState("employment_proof");

  const [documentUrl, setDocumentUrl] = useState("");

  const [reviewerNote, setReviewerNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadVerificationData();
  }, []);

  async function loadVerificationData() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in to access mentor verification.");
        return;
      }

      const { data: mentorData, error: mentorError } =
        await supabase
          .from("mentors")
          .select(
            `
              id,
              full_name,
              current_company,
              job_role,
              verification_status,
              verification_note
            `
          )
          .eq("user_id", user.id)
          .maybeSingle();

      if (mentorError) {
        throw mentorError;
      }

      if (!mentorData) {
        setError(
          "You do not have a mentor profile yet. Please create one first."
        );
        return;
      }

      setMentor(mentorData as unknown as Mentor);

      const {
        data: verificationData,
        error: verificationError,
      } = await supabase
        .from("mentor_verifications")
        .select("*")
        .eq("mentor_id", (mentorData as unknown as Mentor).id)
        .order("submitted_at", {
          ascending: false,
        });

      if (verificationError) {
        throw verificationError;
      }

      setVerifications(verificationData ?? []);
    } catch (err) {
      console.error(
        "Failed to load verification data:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load verification data."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!mentor) {
      setError("Mentor profile not found.");
      return;
    }

    if (!documentUrl.trim()) {
      setError(
        "Please provide a verification document URL."
      );
      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "You must be logged in to submit verification."
        );
      }

      /*
       * Insert verification submission.
       */
      const { error: insertError } = await supabase
        .from("mentor_verifications")
        .insert(({
          mentor_id: mentor.id,
          document_type: documentType,
          document_url: documentUrl.trim(),
          status: "pending",
        }) as never);

      if (insertError) {
        throw insertError;
      }

      /*
       * Move mentor profile to under_review.
       */
      const { error: mentorUpdateError } =
        await supabase
          .from("mentors")
          .update(({
            verification_status: "under_review",
            verification_note:
              reviewerNote.trim() || null,
          }) as never)
          .eq("id", mentor.id)
          .eq("user_id", user.id);

      if (mentorUpdateError) {
        throw mentorUpdateError;
      }

      setDocumentUrl("");
      setReviewerNote("");

      setMessage(
        "Verification proof submitted successfully. Your mentor profile is now under review."
      );

      await loadVerificationData();
    } catch (err) {
      console.error(
        "Failed to submit verification:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit verification."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusClasses(status: string) {
    switch (status) {
      case "verified":
      case "approved":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

      case "rejected":
        return "border-red-500/30 bg-red-500/10 text-red-300";

      case "under_review":
      case "pending":
        return "border-amber-500/30 bg-amber-500/10 text-amber-300";

      case "suspended":
        return "border-red-500/30 bg-red-500/10 text-red-300";

      default:
        return "border-slate-700 bg-slate-800 text-slate-300";
    }
  }

  function formatStatus(status: string) {
    return status
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatDocumentType(type: string) {
    return (
      documentTypes.find(
        (document) => document.value === type
      )?.label ?? formatStatus(type)
    );
  }

  function formatDate(date: string | null) {
    if (!date) {
      return "Not available";
    }

    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🛡️</div>

          <p className="text-slate-400">
            Loading verification...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}
      <nav className="border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight"
          >
            <span className="text-cyan-400">
              Vertex
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link
              href="/roadmap"
              className="text-slate-300 hover:text-white transition"
            >
              Roadmap
            </Link>

            <Link
              href="/dsa"
              className="text-slate-300 hover:text-white transition"
            >
              DSA
            </Link>

            <Link
              href="/projects"
              className="text-slate-300 hover:text-white transition"
            >
              Projects
            </Link>

            <Link
              href="/ai-tutor"
              className="text-slate-300 hover:text-white transition"
            >
              AI Tutor
            </Link>

            <Link
              href="/pods"
              className="text-slate-300 hover:text-white transition"
            >
              Pods
            </Link>

            <Link
              href="/mentor"
              className="text-cyan-400 font-medium"
            >
              Mentor
            </Link>
          </div>

          <Link
            href="/mentor"
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Mentor Profile
          </Link>
        </div>
      </nav>

      {/* HEADER */}
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-8">
        <div className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-3">
          Mentor Verification
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Verify Your Mentor Profile 🛡️
        </h1>

        <p className="text-slate-400 text-lg max-w-3xl leading-relaxed">
          Submit supporting information so Vertex can verify
          your professional background before your profile is
          displayed to students.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20 space-y-8">
        {/* MENTOR STATUS */}
        {mentor && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <h2 className="text-2xl font-bold">
                  {mentor.full_name}
                </h2>

                <p className="text-slate-400 mt-1">
                  {mentor.job_role || "Mentor"}
                  {mentor.current_company
                    ? ` • ${mentor.current_company}`
                    : ""}
                </p>
              </div>

              <div
                className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-medium ${getStatusClasses(
                  mentor.verification_status
                )}`}
              >
                {formatStatus(
                  mentor.verification_status
                )}
              </div>
            </div>

            {mentor.verification_note && (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                  Verification Note
                </div>

                <p className="text-sm text-slate-300">
                  {mentor.verification_note}
                </p>
              </div>
            )}
          </div>
        )}

        {/* SUCCESS */}
        {message && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="font-semibold text-emerald-300">
              ✓ Submitted
            </div>

            <p className="text-sm text-emerald-200/80 mt-1">
              {message}
            </p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="font-semibold text-red-300">
              Something went wrong
            </div>

            <p className="text-sm text-red-200/80 mt-1 wrap-break-word">
              {error}
            </p>
          </div>
        )}

        {/* SUBMISSION FORM */}
        {mentor && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Submit Verification Proof
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                Provide a link to supporting evidence for your
                mentor profile.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {/* DOCUMENT TYPE */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Verification Type
                </label>

                <select
                  value={documentType}
                  onChange={(event) =>
                    setDocumentType(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                >
                  {documentTypes.map((document) => (
                    <option
                      key={document.value}
                      value={document.value}
                    >
                      {document.label}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-slate-500">
                  {
                    documentTypes.find(
                      (document) =>
                        document.value === documentType
                    )?.description
                  }
                </p>
              </div>

              {/* DOCUMENT URL */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Verification Document URL{" "}
                  <span className="text-cyan-400">
                    *
                  </span>
                </label>

                <input
                  type="url"
                  required
                  value={documentUrl}
                  onChange={(event) =>
                    setDocumentUrl(event.target.value)
                  }
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Use a secure document link that can be
                  reviewed by the Vertex verification team.
                </p>
              </div>

              {/* NOTE */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Additional Note
                </label>

                <textarea
                  value={reviewerNote}
                  onChange={(event) =>
                    setReviewerNote(event.target.value)
                  }
                  rows={4}
                  placeholder="Add any information that will help verify your professional background..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 resize-none"
                />
              </div>

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto rounded-xl bg-cyan-400 px-8 py-3.5 font-semibold text-slate-950 hover:bg-cyan-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Submitting..."
                  : "Submit for Verification"}
              </button>
            </form>
          </div>
        )}

        {/* HISTORY */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Verification History
            </h2>

            <p className="text-slate-400 text-sm mt-1">
              Previous verification documents submitted for
              this mentor profile.
            </p>
          </div>

          {verifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
              <div className="text-3xl mb-3">
                📄
              </div>

              <p className="text-slate-300 font-medium">
                No verification documents submitted yet.
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Submit your first verification proof above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {verifications.map((verification) => (
                <div
                  key={verification.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-white">
                        {formatDocumentType(
                          verification.document_type
                        )}
                      </h3>

                      <p className="text-xs text-slate-500 mt-1">
                        Submitted{" "}
                        {formatDate(
                          verification.submitted_at
                        )}
                      </p>
                    </div>

                    <span
                      className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                        verification.status
                      )}`}
                    >
                      {formatStatus(
                        verification.status
                      )}
                    </span>
                  </div>

                  {verification.document_url && (
                    <div className="mt-4">
                      <a
                        href={verification.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cyan-400 hover:text-cyan-300 break-all"
                      >
                        View submitted document →
                      </a>
                    </div>
                  )}

                  {verification.reviewer_note && (
                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
                      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                        Reviewer Note
                      </div>

                      <p className="text-sm text-slate-300">
                        {verification.reviewer_note}
                      </p>
                    </div>
                  )}

                  {verification.reviewed_at && (
                    <p className="text-xs text-slate-500 mt-4">
                      Reviewed{" "}
                      {formatDate(
                        verification.reviewed_at
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* INFO */}
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
          <div className="flex gap-4">
            <div className="text-2xl">💡</div>

            <div>
              <h3 className="font-semibold text-cyan-300">
                How verification works
              </h3>

              <ol className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <span className="text-cyan-400 font-medium">
                    1.
                  </span>{" "}
                  Submit your mentor profile.
                </li>

                <li>
                  <span className="text-cyan-400 font-medium">
                    2.
                  </span>{" "}
                  Submit supporting professional evidence.
                </li>

                <li>
                  <span className="text-cyan-400 font-medium">
                    3.
                  </span>{" "}
                  Vertex reviews the submission.
                </li>

                <li>
                  <span className="text-cyan-400 font-medium">
                    4.
                  </span>{" "}
                  Your profile is approved or rejected.
                </li>

                <li>
                  <span className="text-cyan-400 font-medium">
                    5.
                  </span>{" "}
                  Verified mentors can appear in the student
                  marketplace.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}