"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

// ======================================================
// TYPES
// ======================================================

type University = {
  id: string;
  name: string;
  short_name: string | null;
};

type College = {
  id: string;
  name: string;
  university_id: string | null;
  city: string | null;
  state: string | null;
};

type AcademicProgram = {
  id: string;
  name: string;
  degree: string | null;
  university_id: string | null;
};

type StudentProfile = {
  university_id: string;
  college_id: string;
  program_id: string;
  semester: number;
  target_role: string;
  company_tier: string;
  skill_level: string;
};

const defaultProfile: StudentProfile = {
  university_id: "",
  college_id: "",
  program_id: "",
  semester: 1,
  target_role: "Full Stack Developer",
  company_tier: "Service-Based Company",
  skill_level: "Beginner",
};

// ======================================================
// PAGE
// ======================================================

export default function ProfilePage() {
  const [profile, setProfile] =
    useState<StudentProfile>(defaultProfile);

  const [universities, setUniversities] =
    useState<University[]>([]);

  const [colleges, setColleges] =
    useState<College[]>([]);

  const [programs, setPrograms] =
    useState<AcademicProgram[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  // ====================================================
  // LOAD UNIVERSITIES
  // ====================================================

  useEffect(() => {
    async function loadUniversities() {
      try {
        const {
          data,
          error,
        } = await supabase
          .from("universities")
          .select(`
            id,
            name,
            short_name
          `)
          .order("name");

        if (error) {
          throw error;
        }

        setUniversities(data || []);
      } catch (error) {
        console.error(
          "UNIVERSITY LOAD ERROR:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load universities."
        );
      }
    }

    loadUniversities();
  }, []);

  // ====================================================
  // LOAD PROFILE
  // ====================================================

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setMessage(
            "Please log in to manage your profile."
          );
          return;
        }

        const {
          data,
          error,
        } = await supabase
          .from("student_profiles")
          .select(`
            university_id,
            college_id,
            program_id,
            semester,
            semester_number,
            target_role,
            company_tier,
            skill_level
          `)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          const semester =
            data.semester_number ??
            data.semester ??
            1;

          setProfile({
            university_id:
              data.university_id || "",

            college_id:
              data.college_id || "",

            program_id:
              data.program_id || "",

            semester:
              Number(semester),

            target_role:
              data.target_role ||
              "Full Stack Developer",

            company_tier:
              data.company_tier ||
              "Service-Based Company",

            skill_level:
              data.skill_level ||
              "Beginner",
          });
        }
      } catch (error) {
        console.error(
          "PROFILE LOAD ERROR:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load your profile."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  // ====================================================
  // LOAD COLLEGES
  // ====================================================

  useEffect(() => {
    async function loadColleges() {
      if (!profile.university_id) {
        setColleges([]);
        return;
      }

      try {
        const {
          data,
          error,
        } = await supabase
          .from("colleges")
          .select(`
            id,
            name,
            university_id,
            city,
            state
          `)
          .eq(
            "university_id",
            profile.university_id
          )
          .order("name");

        if (error) {
          throw error;
        }

        setColleges(data || []);
      } catch (error) {
        console.error(
          "COLLEGE LOAD ERROR:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load colleges."
        );
      }
    }

    loadColleges();
  }, [profile.university_id]);

  // ====================================================
  // LOAD PROGRAMS
  // ====================================================

  useEffect(() => {
    async function loadPrograms() {
      if (!profile.university_id) {
        setPrograms([]);
        return;
      }

      try {
        const {
          data,
          error,
        } = await supabase
          .from("academic_programs")
          .select(`
            id,
            name,
            degree,
            university_id
          `)
          .eq(
            "university_id",
            profile.university_id
          )
          .order("name");

        if (error) {
          throw error;
        }

        setPrograms(data || []);
      } catch (error) {
        console.error(
          "PROGRAM LOAD ERROR:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load academic programs."
        );
      }
    }

    loadPrograms();
  }, [profile.university_id]);

  // ====================================================
  // UNIVERSITY CHANGE
  // ====================================================

  function handleUniversityChange(
    universityId: string
  ) {
    setProfile((previous) => ({
      ...previous,
      university_id: universityId,
      college_id: "",
      program_id: "",
    }));

    setColleges([]);
    setPrograms([]);
  }

  // ====================================================
  // GET SELECTED VALUES
  // ====================================================

  const selectedUniversity =
    universities.find(
      (university) =>
        university.id ===
        profile.university_id
    ) || null;

  const selectedCollege =
    colleges.find(
      (college) =>
        college.id ===
        profile.college_id
    ) || null;

  const selectedProgram =
    programs.find(
      (program) =>
        program.id ===
        profile.program_id
    ) || null;

  // ====================================================
  // SAVE PROFILE
  // ====================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      // ================================================
      // VALIDATION
      // ================================================

      if (!profile.university_id) {
        throw new Error(
          "Please select your university."
        );
      }

      if (!profile.college_id) {
        throw new Error(
          "Please select your college."
        );
      }

      if (!profile.program_id) {
        throw new Error(
          "Please select your academic program."
        );
      }

      if (
        profile.semester < 1 ||
        profile.semester > 12
      ) {
        throw new Error(
          "Please select a valid semester."
        );
      }

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
        throw new Error(
          "Please log in before saving your profile."
        );
      }

      // ================================================
      // GET NAMES
      // ================================================

      if (
        !selectedUniversity ||
        !selectedCollege ||
        !selectedProgram
      ) {
        throw new Error(
          "Please select valid university, college and program information."
        );
      }

      // ================================================
      // SAVE TO STUDENT PROFILES
      // ================================================

      const {
        error,
      } = await supabase
        .from("student_profiles")
        .upsert(
          {
            user_id: user.id,

            // ------------------------------------------
            // UNIVERSAL DATABASE IDS
            // ------------------------------------------

            university_id:
              selectedUniversity.id,

            college_id:
              selectedCollege.id,

            program_id:
              selectedProgram.id,

            // ------------------------------------------
            // SEMESTER
            // ------------------------------------------

            semester:
              Number(profile.semester),

            semester_number:
              Number(profile.semester),

            // ------------------------------------------
            // BACKWARD COMPATIBILITY TEXT
            // ------------------------------------------

            university:
              selectedUniversity.name,

            college:
              selectedCollege.name,

            branch:
              selectedProgram.name,

            // ------------------------------------------
            // CAREER DETAILS
            // ------------------------------------------

            target_role:
              profile.target_role,

            company_tier:
              profile.company_tier,

            skill_level:
              profile.skill_level,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        throw error;
      }

      setMessage(
        "Profile saved successfully! 🎉 Your curriculum can now be matched automatically."
      );
    } catch (error) {
      console.error(
        "PROFILE SAVE ERROR:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />

        <div className="flex min-h-[80vh] flex-col items-center justify-center">

          <div className="text-5xl">
            👤
          </div>

          <p className="mt-4 text-slate-400">
            Loading your career profile...
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

      <section className="mx-auto max-w-3xl px-6 py-12">

        {/* HEADER */}

        <div className="mb-8">

          <p className="text-sm font-semibold text-blue-400">
            PERSONALIZED VERTEX PROFILE
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Build Your Career Profile 👤
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Select your university, college and academic
            program. Vertex will automatically connect
            your profile to the correct syllabus and
            personalized learning journey.
          </p>

        </div>

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl md:p-8"
        >

          <div className="grid gap-6 md:grid-cols-2">

            {/* UNIVERSITY */}

            <div className="md:col-span-2">

              <label className="mb-2 block text-sm font-medium text-slate-300">
                University
              </label>

              <select
                value={profile.university_id}
                onChange={(event) =>
                  handleUniversityChange(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              >

                <option value="">
                  Select your university
                </option>

                {universities.map(
                  (university) => (
                    <option
                      key={university.id}
                      value={university.id}
                    >
                      {university.name}
                      {university.short_name
                        ? ` (${university.short_name})`
                        : ""}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* COLLEGE */}

            <div className="md:col-span-2">

              <label className="mb-2 block text-sm font-medium text-slate-300">
                College
              </label>

              <select
                value={profile.college_id}
                onChange={(event) =>
                  setProfile((previous) => ({
                    ...previous,
                    college_id:
                      event.target.value,
                  }))
                }
                disabled={
                  !profile.university_id
                }
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >

                <option value="">
                  {profile.university_id
                    ? "Select your college"
                    : "Select a university first"}
                </option>

                {colleges.map((college) => (
                  <option
                    key={college.id}
                    value={college.id}
                  >
                    {college.name}
                    {college.city
                      ? ` - ${college.city}`
                      : ""}
                  </option>
                ))}

              </select>

            </div>

            {/* PROGRAM */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Academic Program
              </label>

              <select
                value={profile.program_id}
                onChange={(event) =>
                  setProfile((previous) => ({
                    ...previous,
                    program_id:
                      event.target.value,
                  }))
                }
                disabled={
                  !profile.university_id
                }
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >

                <option value="">
                  {profile.university_id
                    ? "Select your program"
                    : "Select a university first"}
                </option>

                {programs.map((program) => (
                  <option
                    key={program.id}
                    value={program.id}
                  >
                    {program.name}
                    {program.degree
                      ? ` (${program.degree})`
                      : ""}
                  </option>
                ))}

              </select>

            </div>

            {/* SEMESTER */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Current Semester
              </label>

              <select
                value={profile.semester}
                onChange={(event) =>
                  setProfile((previous) => ({
                    ...previous,
                    semester: Number(
                      event.target.value
                    ),
                  }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              >

                {[
                  1,
                  2,
                  3,
                  4,
                  5,
                  6,
                  7,
                  8,
                  9,
                  10,
                  11,
                  12,
                ].map((semester) => (
                  <option
                    key={semester}
                    value={semester}
                  >
                    Semester {semester}
                  </option>
                ))}

              </select>

            </div>

            {/* TARGET ROLE */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Target Role
              </label>

              <select
                value={profile.target_role}
                onChange={(event) =>
                  setProfile((previous) => ({
                    ...previous,
                    target_role:
                      event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              >

                <option>
                  Full Stack Developer
                </option>

                <option>
                  Frontend Developer
                </option>

                <option>
                  Backend Developer
                </option>

                <option>
                  Software Engineer
                </option>

                <option>
                  Data Analyst
                </option>

                <option>
                  Data Scientist
                </option>

                <option>
                  AI / ML Engineer
                </option>

                <option>
                  Cloud Engineer
                </option>

              </select>

            </div>

            {/* COMPANY TIER */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Target Company Tier
              </label>

              <select
                value={profile.company_tier}
                onChange={(event) =>
                  setProfile((previous) => ({
                    ...previous,
                    company_tier:
                      event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              >

                <option>
                  Service-Based Company
                </option>

                <option>
                  Product-Based Company
                </option>

                <option>
                  Startup
                </option>

                <option>
                  FAANG / Top Tech
                </option>

              </select>

            </div>

            {/* SKILL LEVEL */}

            <div className="md:col-span-2">

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Current Skill Level
              </label>

              <div className="grid gap-3 sm:grid-cols-3">

                {[
                  "Beginner",
                  "Intermediate",
                  "Advanced",
                ].map((level) => (

                  <button
                    key={level}
                    type="button"
                    onClick={() =>
                      setProfile((previous) => ({
                        ...previous,
                        skill_level: level,
                      }))
                    }
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      profile.skill_level ===
                      level
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {level}
                  </button>

                ))}

              </div>

            </div>

          </div>

          {/* SELECTED PROFILE PREVIEW */}

          {selectedUniversity &&
            selectedCollege &&
            selectedProgram && (

              <div className="mt-8 rounded-xl border border-blue-900/60 bg-blue-950/20 p-5">

                <p className="text-sm font-semibold text-blue-400">
                  🎓 Academic Profile Preview
                </p>

                <div className="mt-3 grid gap-2 text-sm text-slate-300">

                  <p>
                    <span className="text-slate-500">
                      University:
                    </span>{" "}
                    {selectedUniversity.name}
                  </p>

                  <p>
                    <span className="text-slate-500">
                      College:
                    </span>{" "}
                    {selectedCollege.name}
                  </p>

                  <p>
                    <span className="text-slate-500">
                      Program:
                    </span>{" "}
                    {selectedProgram.name}
                  </p>

                  <p>
                    <span className="text-slate-500">
                      Semester:
                    </span>{" "}
                    Semester {profile.semester}
                  </p>

                </div>

              </div>

            )}

          {/* MESSAGE */}

          {message && (

            <div
              className={`mt-6 rounded-xl border p-4 text-sm ${
                message.includes(
                  "successfully"
                )
                  ? "border-green-800/50 bg-green-950/30 text-green-300"
                  : "border-red-800/50 bg-red-950/30 text-red-300"
              }`}
            >
              {message}
            </div>

          )}

          {/* SAVE */}

          <button
            type="submit"
            disabled={
              saving ||
              !profile.university_id ||
              !profile.college_id ||
              !profile.program_id
            }
            className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving Profile..."
              : "Save Career Profile 🚀"}
          </button>

          {/* CURRICULUM LINK */}

          <Link
            href="/curriculum"
            className="mt-4 block w-full rounded-xl border border-slate-700 px-6 py-4 text-center font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            View My Curriculum 📚
          </Link>

        </form>

      </section>

    </main>
  );
}