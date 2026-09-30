"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

// ======================================================
// TYPES
// ======================================================

type StudentProfile = {
  college: string | null;
  university: string | null;
  branch: string | null;
  semester: string | number | null;
  semester_number: number | null;

  target_role: string | null;
  company_tier: string | null;
  skill_level: string | null;

  university_id: string | null;
  college_id: string | null;
  program_id: string | null;
  syllabus_scheme_id: string | null;
  scheme_id: string | null;
};

type University = {
  id: string;
  name: string;
};

type College = {
  id: string;
  name: string;
};

type Program = {
  id: string;
  name: string;
  degree: string | null;
};

type Syllabus = {
  id: string;
  university_id: string | null;
  college_id: string | null;
  program_id: string | null;
  scheme_id: string | null;
  semester: number;
  title: string | null;
  source_type: string | null;
  status: string | null;
};

type SyllabusSubject = {
  id: string;
  syllabus_id: string | null;
  subject_name: string;
  subject_code: string | null;
  credits: number | null;
  subject_type: string | null;
  description: string | null;
  interview_relevance: string | null;
  interview_topics: string[] | null;
  source_verified: boolean | null;
};

// ======================================================
// SEMESTER HELPER
// ======================================================

function getSemesterNumber(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) &&
      value >= 1 &&
      value <= 12
      ? value
      : null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const match = text.match(/\d+/);

  if (!match) {
    return null;
  }

  const semester = Number(match[0]);

  return Number.isInteger(semester) &&
    semester >= 1 &&
    semester <= 12
    ? semester
    : null;
}

// ======================================================
// DISPLAY HELPERS
// ======================================================

function getRelevanceStyle(
  relevance: string | null
) {
  switch ((relevance || "").toLowerCase()) {
    case "high":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";

    case "medium":
      return "border-yellow-800 bg-yellow-950/40 text-yellow-300";

    case "low":
      return "border-slate-700 bg-slate-800 text-slate-300";

    default:
      return "border-blue-800 bg-blue-950/40 text-blue-300";
  }
}

function getRelevanceMessage(
  relevance: string | null
) {
  switch ((relevance || "").toLowerCase()) {
    case "high":
      return "Highly important for technical interviews";

    case "medium":
      return "Useful supporting knowledge for interviews";

    case "low":
      return "Lower interview priority";

    default:
      return "Relevant for interview preparation";
  }
}

// ======================================================
// PAGE
// ======================================================

export default function CurriculumPage() {
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");

  const [profile, setProfile] =
    useState<StudentProfile | null>(null);

  const [university, setUniversity] =
    useState<University | null>(null);

  const [college, setCollege] =
    useState<College | null>(null);

  const [program, setProgram] =
    useState<Program | null>(null);

  const [syllabus, setSyllabus] =
    useState<Syllabus | null>(null);

  const [subjects, setSubjects] =
    useState<SyllabusSubject[]>([]);

  // ====================================================
  // LOAD CURRICULUM
  // ====================================================

  useEffect(() => {
    async function loadCurriculum() {
      setLoading(true);
      setMessage("");

      try {
        // ================================================
        // GET CURRENT USER
        // ================================================

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setMessage(
            "Please log in to view your curriculum."
          );
          return;
        }

        // ================================================
        // GET STUDENT PROFILE
        // IMPORTANT:
        // Use stored database IDs instead of name matching.
        // ================================================

        const {
          data: studentProfile,
          error: profileError,
        } = await supabase
          .from("student_profiles")
          .select(`
            college,
            university,
            branch,
            semester,
            semester_number,
            target_role,
            company_tier,
            skill_level,
            university_id,
            college_id,
            program_id,
            syllabus_scheme_id,
            scheme_id
          `)
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!studentProfile) {
          setMessage(
            "Please complete your career profile first."
          );
          return;
        }

        setProfile(studentProfile);

        // ================================================
        // GET SEMESTER
        // ================================================

        const semesterNumber =
          studentProfile.semester_number ??
          getSemesterNumber(
            studentProfile.semester
          );

        if (!semesterNumber) {
          setMessage(
            "Unable to determine your semester. Please update your profile."
          );
          return;
        }

        // ================================================
        // VALIDATE REQUIRED IDs
        // ================================================

        if (!studentProfile.university_id) {
          setMessage(
            "Your university is not connected to the academic database yet."
          );
          return;
        }

        if (!studentProfile.program_id) {
          setMessage(
            "Your branch is not connected to an academic program yet."
          );
          return;
        }

        // ================================================
        // LOAD UNIVERSITY
        // ================================================

        const {
          data: universityData,
          error: universityError,
        } = await supabase
          .from("universities")
          .select("id, name")
          .eq(
            "id",
            studentProfile.university_id
          )
          .maybeSingle();

        if (universityError) {
          throw universityError;
        }

        if (!universityData) {
          setMessage(
            "The selected university could not be found."
          );
          return;
        }

        setUniversity(universityData);

        // ================================================
        // LOAD COLLEGE
        // ================================================

        if (studentProfile.college_id) {
          const {
            data: collegeData,
            error: collegeError,
          } = await supabase
            .from("colleges")
            .select("id, name")
            .eq(
              "id",
              studentProfile.college_id
            )
            .maybeSingle();

          if (collegeError) {
            throw collegeError;
          }

          if (collegeData) {
            setCollege(collegeData);
          }
        }

        // ================================================
        // LOAD PROGRAM
        // ================================================

        const {
          data: programData,
          error: programError,
        } = await supabase
          .from("academic_programs")
          .select("id, name, degree")
          .eq(
            "id",
            studentProfile.program_id
          )
          .maybeSingle();

        if (programError) {
          throw programError;
        }

        if (!programData) {
          setMessage(
            "The selected academic program could not be found."
          );
          return;
        }

        setProgram(programData);

        // ================================================
        // FIND COLLEGE-SPECIFIC SYLLABUS FIRST
        // ================================================

        let selectedSyllabus: Syllabus | null =
          null;

        if (studentProfile.college_id) {
          const {
            data: collegeSyllabus,
            error: collegeSyllabusError,
          } = await supabase
            .from("syllabi")
            .select(`
              id,
              university_id,
              college_id,
              program_id,
              scheme_id,
              semester,
              title,
              source_type,
              status
            `)
            .eq(
              "university_id",
              studentProfile.university_id
            )
            .eq(
              "college_id",
              studentProfile.college_id
            )
            .eq(
              "program_id",
              studentProfile.program_id
            )
            .eq(
              "semester",
              semesterNumber
            )
            .eq(
              "status",
              "published"
            )
            .maybeSingle();

          if (collegeSyllabusError) {
            throw collegeSyllabusError;
          }

          selectedSyllabus =
            collegeSyllabus;
        }

        // ================================================
        // FALLBACK TO UNIVERSITY SYLLABUS
        // ================================================

        if (!selectedSyllabus) {
          const {
            data: universitySyllabus,
            error: universitySyllabusError,
          } = await supabase
            .from("syllabi")
            .select(`
              id,
              university_id,
              college_id,
              program_id,
              scheme_id,
              semester,
              title,
              source_type,
              status
            `)
            .eq(
              "university_id",
              studentProfile.university_id
            )
            .eq(
              "program_id",
              studentProfile.program_id
            )
            .eq(
              "semester",
              semesterNumber
            )
            .eq(
              "status",
              "published"
            )
            .is(
              "college_id",
              null
            )
            .maybeSingle();

          if (universitySyllabusError) {
            throw universitySyllabusError;
          }

          selectedSyllabus =
            universitySyllabus;
        }

        // ================================================
        // NO SYLLABUS
        // ================================================

        if (!selectedSyllabus) {
          setMessage(
            `No published syllabus was found for your academic profile and Semester ${semesterNumber}.`
          );
          return;
        }

        setSyllabus(selectedSyllabus);

        // ================================================
        // LOAD SUBJECTS
        // ================================================

        const {
          data: subjectData,
          error: subjectError,
        } = await supabase
          .from("syllabus_subjects")
          .select(`
            id,
            syllabus_id,
            subject_name,
            subject_code,
            credits,
            subject_type,
            description,
            interview_relevance,
            interview_topics,
            source_verified
          `)
          .eq(
            "syllabus_id",
            selectedSyllabus.id
          )
          .order("subject_name");

        if (subjectError) {
          throw subjectError;
        }

        setSubjects(subjectData || []);

        console.log(
          "CURRICULUM LOADED:",
          {
            university: universityData.name,
            program: programData.name,
            semester: semesterNumber,
            syllabus: selectedSyllabus.title,
            subjectCount:
              subjectData?.length || 0,
          }
        );
      } catch (error) {
        console.error(
          "CURRICULUM LOAD ERROR:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load your curriculum."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCurriculum();
  }, []);

  // ====================================================
  // CALCULATIONS
  // ====================================================

  const highRelevanceCount =
    subjects.filter(
      (subject) =>
        (
          subject.interview_relevance || ""
        ).toLowerCase() === "high"
    ).length;

  const totalTopics =
    subjects.reduce(
      (total, subject) =>
        total +
        (
          subject.interview_topics?.length || 0
        ),
      0
    );

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />

        <div className="flex min-h-[80vh] flex-col items-center justify-center">
          <div className="text-5xl">
            📚
          </div>

          <p className="mt-4 text-slate-400">
            Loading your personalized curriculum...
          </p>
        </div>
      </main>
    );
  }

  // ====================================================
  // PAGE
  // ====================================================

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 py-12">
        {/* HEADER */}

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-400">
              CURRICULUM → CAREER BRIDGE
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Your Curriculum Journey 📚
            </h1>

            <p className="mt-3 max-w-2xl text-slate-400">
              Your syllabus is automatically selected
              using your university, college, program
              and semester.
            </p>
          </div>

          <Link
            href="/profile"
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
          >
            Edit Profile
          </Link>
        </div>

        {/* PROFILE SUMMARY */}

        {profile && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                University
              </p>

              <p className="mt-2 font-semibold">
                {university?.name ||
                  profile.university ||
                  "Not available"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                College
              </p>

              <p className="mt-2 font-semibold">
                {college?.name ||
                  profile.college ||
                  "Not available"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Program
              </p>

              <p className="mt-2 font-semibold">
                {program?.name ||
                  profile.branch ||
                  "Not available"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Semester
              </p>

              <p className="mt-2 font-semibold">
                Semester{" "}
                {profile.semester_number ||
                  getSemesterNumber(
                    profile.semester
                  ) ||
                  "N/A"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Target Role
              </p>

              <p className="mt-2 font-semibold">
                {profile.target_role ||
                  "Not selected"}
              </p>
            </div>
          </div>
        )}

        {/* ACTIVE SYLLABUS */}

        {syllabus && !message && (
          <div className="mt-8 rounded-2xl border border-blue-900/50 bg-blue-950/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">
              Active Syllabus
            </p>

            <h2 className="mt-2 text-xl font-bold">
              {syllabus.title}
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              {university?.name}
              {" • "}
              {college?.name || "University Syllabus"}
              {" • "}
              {program?.name}
              {" • "}
              Semester {syllabus.semester}
            </p>
          </div>
        )}

        {/* ERROR */}

        {message && (
          <div className="mt-8 rounded-xl border border-yellow-900 bg-yellow-950/30 p-6">
            <p className="font-medium text-yellow-300">
              ⚠️ {message}
            </p>

            <Link
              href="/profile"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Update Profile →
            </Link>
          </div>
        )}

        {/* STATS */}

        {!message && subjects.length > 0 && (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="text-3xl">📚</div>

              <p className="mt-3 text-sm text-slate-400">
                Total Subjects
              </p>

              <p className="mt-1 text-3xl font-bold">
                {subjects.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="text-3xl">🎯</div>

              <p className="mt-3 text-sm text-slate-400">
                High Interview Value
              </p>

              <p className="mt-1 text-3xl font-bold text-emerald-400">
                {highRelevanceCount}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="text-3xl">💡</div>

              <p className="mt-3 text-sm text-slate-400">
                Interview Topics
              </p>

              <p className="mt-1 text-3xl font-bold text-blue-400">
                {totalTopics}
              </p>
            </div>
          </div>
        )}

        {/* EMPTY */}

        {!message &&
          syllabus &&
          subjects.length === 0 && (
            <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
              <div className="text-5xl">📖</div>

              <h2 className="mt-4 text-xl font-semibold">
                No subjects found
              </h2>

              <p className="mx-auto mt-2 max-w-lg text-slate-400">
                Your syllabus exists, but no subjects
                have been added to it yet.
              </p>
            </div>
          )}

        {/* SUBJECTS */}

        {!message && subjects.length > 0 && (
          <div className="mt-10">
            <div className="mb-5">
              <h2 className="text-2xl font-bold">
                Your Semester Subjects
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                These subjects come from your selected
                university syllabus.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-3xl">
                        📘
                      </div>

                      <h3 className="mt-4 text-xl font-bold">
                        {subject.subject_name}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {subject.subject_code && (
                          <span className="rounded-lg bg-slate-950 px-2 py-1 text-xs text-slate-400">
                            {subject.subject_code}
                          </span>
                        )}

                        {subject.credits !== null &&
                          subject.credits !== undefined && (
                            <span className="rounded-lg bg-slate-950 px-2 py-1 text-xs text-slate-400">
                              {subject.credits} Credits
                            </span>
                          )}

                        {subject.subject_type && (
                          <span className="rounded-lg bg-slate-950 px-2 py-1 text-xs text-slate-400">
                            {subject.subject_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRelevanceStyle(
                        subject.interview_relevance
                      )}`}
                    >
                      {subject.interview_relevance ||
                        "Relevant"}
                    </span>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-slate-400">
                    {subject.description ||
                      "Important concepts from this subject can strengthen your academic and technical interview preparation."}
                  </p>

                  <div className="mt-5 rounded-xl bg-slate-950 p-4">
                    <p className="text-sm font-medium text-blue-400">
                      🎯 Interview Relevance
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {getRelevanceMessage(
                        subject.interview_relevance
                      )}
                    </p>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-slate-300">
                      Important Interview Topics
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {subject.interview_topics &&
                      subject.interview_topics.length > 0 ? (
                        subject.interview_topics.map(
                          (topic, index) => (
                            <span
                              key={`${subject.id}-${index}`}
                              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"
                            >
                              {topic}
                            </span>
                          )
                        )
                      ) : (
                        <span className="text-sm text-slate-500">
                          Topics will be added soon.
                        </span>
                      )}
                    </div>
                  </div>

                  {subject.source_verified && (
                    <div className="mt-5 text-xs text-emerald-400">
                      ✓ Source verified
                    </div>
                  )}

                  <div className="mt-6 flex gap-3">
                    <Link
  href={`/ai-tutor?subject=${encodeURIComponent(
    subject.subject_name
  )}&code=${encodeURIComponent(
    subject.subject_code || ""
  )}`}
>
  Ask AI Tutor
</Link>

                   <Link
  href={`/ai-interview?subject=${encodeURIComponent(
    subject.subject_name
  )}`}
>
  Practice
</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}