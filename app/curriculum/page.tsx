
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
  academic_program: string | null;
  branch: string | null;
  branch_id: string | null;
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

type Branch = {
  id: string;
  name: string;
  short_name: string | null;
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
// HELPERS
// ======================================================

function getSemesterNumber(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;

  const number =
    typeof value === "number"
      ? value
      : Number(String(value).match(/\d+/)?.[0]);

  return Number.isInteger(number) && number >= 1 && number <= 12
    ? number
    : null;
}

function getDegree(
  programDegree: string | null | undefined,
  profileDegree: string | null | undefined
): string {
  const allowed = ["B.E.", "B.Tech"];

  const programValue = (programDegree || "").trim();
  const profileValue = (profileDegree || "").trim();

  if (allowed.includes(programValue)) return programValue;
  if (allowed.includes(profileValue)) return profileValue;

  return "Not available";
}

function normalize(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRelevanceStyle(relevance: string | null) {
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

function getRelevanceMessage(relevance: string | null) {
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

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [university, setUniversity] = useState<University | null>(null);
  const [college, setCollege] = useState<College | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [subjects, setSubjects] = useState<SyllabusSubject[]>([]);

  // ====================================================
  // LOAD CURRICULUM
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadCurriculum() {
      setLoading(true);
      setMessage("");
      setProfile(null);
      setUniversity(null);
      setCollege(null);
      setProgram(null);
      setBranch(null);
      setSyllabus(null);
      setSubjects([]);

      try {
        // Current authenticated user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          if (!cancelled) {
            setMessage("Please log in to view your curriculum.");
          }
          return;
        }

        // Student profile
        const {
          data: studentProfile,
          error: profileError,
        } = await supabase
          .from("student_profiles")
          .select(`
            college,
            university,
            academic_program,
            branch,
            branch_id,
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

        if (profileError) throw profileError;

        if (!studentProfile) {
          if (!cancelled) {
            setMessage("Please complete your career profile first.");
          }
          return;
        }

        if (cancelled) return;
        setProfile(studentProfile);

        console.log("CURRICULUM PROFILE:", {
          userId: user.id,
          universityId: studentProfile.university_id,
          collegeId: studentProfile.college_id,
          programId: studentProfile.program_id,
          academicProgram: studentProfile.academic_program,
          branch: studentProfile.branch,
          branchId: studentProfile.branch_id,
        });

        // Semester
        const semesterNumber =
          studentProfile.semester_number ??
          getSemesterNumber(studentProfile.semester);

        if (!semesterNumber) {
          setMessage(
            "Unable to determine your semester. Please update your profile."
          );
          return;
        }

        // University is required for academic program matching
        if (!studentProfile.university_id) {
          setMessage(
            "Your university is not connected to the academic database yet. Please update your academic profile."
          );
          return;
        }

        // Load university
        const {
          data: universityData,
          error: universityError,
        } = await supabase
          .from("universities")
          .select("id, name")
          .eq("id", studentProfile.university_id)
          .maybeSingle();

        if (universityError) throw universityError;

        if (!universityData) {
          setMessage("The selected university could not be found.");
          return;
        }

        if (cancelled) return;
        setUniversity(universityData);

        // Load college when linked
        if (studentProfile.college_id) {
          const {
            data: collegeData,
            error: collegeError,
          } = await supabase
            .from("colleges")
            .select("id, name")
            .eq("id", studentProfile.college_id)
            .maybeSingle();

          if (collegeError) throw collegeError;
          if (cancelled) return;
          if (collegeData) setCollege(collegeData);
        }

        // Load branch by ID, with profile text as display fallback
        if (studentProfile.branch_id) {
          const {
            data: branchData,
            error: branchError,
          } = await supabase
            .from("branches")
            .select("id, name, short_name")
            .eq("id", studentProfile.branch_id)
            .maybeSingle();

          if (branchError) throw branchError;
          if (cancelled) return;
          if (branchData) setBranch(branchData);
        }

        // ==================================================
        // LOAD DEGREE PROGRAM
        // First use program_id; if unavailable, try a
        // university + degree + branch-name match.
        // ==================================================

        let programData: Program | null = null;

        if (studentProfile.program_id) {
          const {
            data,
            error,
          } = await supabase
            .from("academic_programs")
            .select("id, name, degree")
            .eq("id", studentProfile.program_id)
            .maybeSingle();

          if (error) throw error;
          programData = data;
        }

        // Fallback for older or incomplete profiles.
        // academic_program may contain the degree (e.g. B.E.)
        // rather than the program name.
        if (!programData) {
          const {
            data: candidatePrograms,
            error: candidateError,
          } = await supabase
            .from("academic_programs")
            .select("id, name, degree")
            .eq("university_id", studentProfile.university_id);

          if (candidateError) throw candidateError;

          const profileDegree = normalize(
            studentProfile.academic_program
          );
          const profileBranch = normalize(studentProfile.branch);

          const matchingPrograms = (candidatePrograms || []).filter(
            (candidate) => {
              const degreeMatches =
                !profileDegree ||
                normalize(candidate.degree) === profileDegree;

              const programName = normalize(candidate.name);
              const branchMatches =
                !profileBranch ||
                programName === profileBranch ||
                programName.includes(profileBranch) ||
                profileBranch.includes(programName);

              return degreeMatches && branchMatches;
            }
          );

          if (matchingPrograms.length === 1) {
            programData = matchingPrograms[0];
          } else if (matchingPrograms.length > 1) {
            // Prefer an exact program-name/branch match.
            programData =
              matchingPrograms.find(
                (candidate) =>
                  normalize(candidate.name) === profileBranch
              ) || null;
          }
        }

        if (!programData) {
          setMessage(
            "We couldn't match your academic profile to a degree program. Please check your university, degree, and branch in your profile."
          );
          return;
        }

        if (cancelled) return;
        setProgram(programData);

        const resolvedDegree = getDegree(
          programData.degree,
          studentProfile.academic_program
        );

        if (resolvedDegree === "Not available") {
          setMessage(
            "The connected academic program does not have a supported degree value. Please verify the degree in the academic database."
          );
          return;
        }

        // Branch should be linked for curriculum matching.
        if (!studentProfile.branch_id) {
          setMessage(
            "Your branch is not connected to the academic database yet. Please update your academic profile."
          );
          return;
        }

        // ==================================================
        // FIND PUBLISHED SYLLABUS
        // Prefer college-specific syllabus, then university.
        // ==================================================

        let selectedSyllabus: Syllabus | null = null;

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
            .eq("university_id", studentProfile.university_id)
            .eq("college_id", studentProfile.college_id)
            .eq("program_id", programData.id)
            .eq("semester", semesterNumber)
            .eq("status", "published")
            .maybeSingle();

          if (collegeSyllabusError) throw collegeSyllabusError;
          selectedSyllabus = collegeSyllabus;
        }

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
            .eq("university_id", studentProfile.university_id)
            .eq("program_id", programData.id)
            .eq("semester", semesterNumber)
            .eq("status", "published")
            .is("college_id", null)
            .maybeSingle();

          if (universitySyllabusError) {
            throw universitySyllabusError;
          }

          selectedSyllabus = universitySyllabus;
        }

        if (!selectedSyllabus) {
          setMessage(
            `No published syllabus was found for your academic profile and Semester ${semesterNumber}. Your degree is connected, but a matching syllabus may not have been published yet.`
          );
          return;
        }

        if (cancelled) return;
        setSyllabus(selectedSyllabus);

        // ==================================================
        // LOAD SYLLABUS SUBJECTS
        // ==================================================

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
          .eq("syllabus_id", selectedSyllabus.id)
          .order("subject_name");

        if (subjectError) throw subjectError;
        if (cancelled) return;

        setSubjects(subjectData || []);

        console.log("CURRICULUM LOADED:", {
          userId: user.id,
          university: universityData.name,
          college: college?.name || studentProfile.college,
          program: programData.name,
          degree: resolvedDegree,
          branch: branch?.name || studentProfile.branch,
          semester: semesterNumber,
          syllabus: selectedSyllabus.title,
          subjectCount: subjectData?.length || 0,
        });
      } catch (error) {
        console.error("CURRICULUM LOAD ERROR:", error);

        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load your curriculum."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCurriculum();

    return () => {
      cancelled = true;
    };
  });

  // ====================================================
  // DISPLAY VALUES
  // ====================================================

  const highRelevanceCount = subjects.filter(
    (subject) =>
      (subject.interview_relevance || "").toLowerCase() === "high"
  ).length;

  const totalTopics = subjects.reduce(
    (total, subject) =>
      total + (subject.interview_topics?.length || 0),
    0
  );

  const semesterNumber =
    profile?.semester_number ??
    getSemesterNumber(profile?.semester);

  const degree = getDegree(
    program?.degree,
    profile?.academic_program
  );

  const branchName =
    branch?.name || profile?.branch || "Not available";

  // ====================================================
  // LOADING VIEW
  // ====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <div className="flex min-h-[80vh] flex-col items-center justify-center">
          <div className="text-5xl">📚</div>
          <p className="mt-4 text-slate-400">
            Loading your personalized curriculum...
          </p>
        </div>
      </main>
    );
  }

  // ====================================================
  // MAIN PAGE
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
              Your syllabus is automatically selected using your
              university, college, degree program and semester.
            </p>
          </div>

          <Link
            href="/profile"
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
          >
            Edit Profile
          </Link>
        </div>

        {/* ACADEMIC PROFILE */}

        {profile && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <AcademicCard
              label="University"
              value={
                university?.name ||
                profile.university ||
                "Not available"
              }
            />
            <AcademicCard
              label="College"
              value={
                college?.name ||
                profile.college ||
                "Not available"
              }
            />
            <AcademicCard
              label="Degree"
              value={degree}
              highlight
            />
            <AcademicCard
              label="Branch"
              value={branchName}
              detail={branch?.short_name || undefined}
            />
            <AcademicCard
              label="Semester"
              value={
                semesterNumber
                  ? `Semester ${semesterNumber}`
                  : "Not available"
              }
            />
            <AcademicCard
              label="Target Role"
              value={profile.target_role || "Not selected"}
            />
          </div>
        )}

        {/* ACTIVE SYLLABUS */}

        {syllabus && !message && (
          <div className="mt-8 rounded-2xl border border-blue-900/50 bg-blue-950/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">
              Active Syllabus
            </p>
            <h2 className="mt-2 text-xl font-bold">
              {syllabus.title || "Published Syllabus"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {university?.name}
              {" • "}
              {college?.name || "University Syllabus"}
              {" • "}
              {degree}
              {" • "}
              {branchName}
              {" • "}
              Semester {syllabus.semester}
            </p>
            {syllabus.source_type && (
              <p className="mt-2 text-xs text-slate-500">
                Source: {syllabus.source_type}
              </p>
            )}
          </div>
        )}

        {/* MESSAGE */}

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

        {/* STATISTICS */}

        {!message && subjects.length > 0 && (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <StatCard
              icon="📚"
              label="Total Subjects"
              value={subjects.length}
            />
            <StatCard
              icon="🎯"
              label="High Interview Value"
              value={highRelevanceCount}
              valueClass="text-emerald-400"
            />
            <StatCard
              icon="💡"
              label="Interview Topics"
              value={totalTopics}
              valueClass="text-blue-400"
            />
          </div>
        )}

        {/* EMPTY SUBJECTS */}

        {!message && syllabus && subjects.length === 0 && (
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="text-5xl">📖</div>
            <h2 className="mt-4 text-xl font-semibold">
              No subjects found
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-slate-400">
              Your syllabus exists, but no subjects have been added
              to it yet.
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
                These subjects come from your selected university
                syllabus.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-700"
                >
                  {/* SUBJECT HEADER */}

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-3xl">📘</div>
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
                      {subject.interview_relevance || "Relevant"}
                    </span>
                  </div>

                  {/* DESCRIPTION */}

                  <p className="mt-5 text-sm leading-6 text-slate-400">
                    {subject.description ||
                      "Important concepts from this subject can strengthen your academic and technical interview preparation."}
                  </p>

                  {/* INTERVIEW RELEVANCE */}

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

                  {/* INTERVIEW TOPICS */}

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

                  {/* SOURCE VERIFICATION */}

                  {subject.source_verified && (
                    <div className="mt-5 text-xs text-emerald-400">
                      ✓ Source verified
                    </div>
                  )}

                  {/* ACTIONS */}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/ai-tutor?subject=${encodeURIComponent(
                        subject.subject_name
                      )}&code=${encodeURIComponent(
                        subject.subject_code || ""
                      )}`}
                      className="rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/50"
                    >
                      Ask AI Tutor
                    </Link>

                    <Link
                      href={`/ai-interview?subject=${encodeURIComponent(
                        subject.subject_name
                      )}`}
                      className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-900/50"
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

// ======================================================
// REUSABLE DISPLAY COMPONENTS
// ======================================================

function AcademicCard({
  label,
  value,
  detail,
  highlight = false,
}: {
  label: string;
  value: string;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-slate-900 p-5 ${
        highlight
          ? "border-emerald-900/60"
          : "border-slate-800"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 font-semibold ${
          highlight ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueClass = "",
}: {
  icon: string;
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="text-3xl">{icon}</div>
      <p className="mt-3 text-sm text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}