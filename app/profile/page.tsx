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

type Branch = {
  id: string;
  name: string;
  short_name: string | null;
};

type StudentProfile = {
  university_id: string;
  college_id: string;
  program_id: string;
  branch_id: string;

  university_name: string;
  college_name: string;
  program_name: string;
  branch_name: string;
  syllabus_scheme_name: string;

  semester: number;

  target_role: string;
  company_tier: string;
  skill_level: string;
};

const defaultProfile: StudentProfile = {
  university_id: "",
  college_id: "",
  program_id: "",
  branch_id: "",

  university_name: "",
  college_name: "",
  program_name: "",
  branch_name: "",
  syllabus_scheme_name: "",

  semester: 1,

  target_role: "Full Stack Developer",
  company_tier: "Service-Based Company",
  skill_level: "Beginner",
};

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass =
  "mb-2 block text-sm font-medium text-slate-300";

// ======================================================
// CONSTANTS
// ======================================================

const DEGREE_OPTIONS = ["B.E.", "B.Tech"];

const SEMESTERS = Array.from(
  { length: 8 },
  (_, index) => index + 1
);

const TARGET_ROLES = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Software Engineer",
  "Data Analyst",
  "Data Scientist",
  "AI / ML Engineer",
  "Cloud Engineer",
];

const COMPANY_TIERS = [
  "Service-Based Company",
  "Product-Based Company",
  "Startup",
  "FAANG / Top Tech",
];

const SKILL_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
];

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

  const [branches, setBranches] =
    useState<Branch[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<"success" | "error">("error");

  // ====================================================
  // UPDATE PROFILE
  // ====================================================

  function updateProfile(
    updates: Partial<StudentProfile>
  ) {
    setProfile((previous) => ({
      ...previous,
      ...updates,
    }));
  }

  // ====================================================
  // LOAD USER + UNIVERSITY + PROFILE
  // ====================================================

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          if (active) {
            setMessage(
              "Please log in to manage your profile."
            );
            setMessageType("error");
          }

          return;
        }

        const [
          universityResult,
          profileResult,
        ] = await Promise.all([
          supabase
            .from("universities")
            .select(
              "id,name,short_name"
            )
            .order("name"),

          supabase
            .from("student_profiles")
            .select(`
              university_id,
              college_id,
              program_id,
              branch_id,
              university,
              college,
              academic_program,
              branch,
              syllabus_scheme,
              semester,
              semester_number,
              target_role,
              company_tier,
              skill_level
            `)
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (universityResult.error) {
          throw universityResult.error;
        }

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (!active) {
          return;
        }

        setUniversities(
          universityResult.data ?? []
        );

        const data = profileResult.data;

        if (data) {
          const universityId =
            data.university_id ?? "";

          const collegeId =
            data.college_id ?? "";

          const programId =
            data.program_id ?? "";

          const branchId =
            data.branch_id ?? "";

          const semester = Number(
            data.semester_number ??
              data.semester ??
              1
          );

          setProfile({
            university_id: universityId,
            college_id: collegeId,
            program_id: programId,
            branch_id: branchId,

            university_name:
              data.university ?? "",

            college_name:
              data.college ?? "",

            program_name:
              data.academic_program ?? "",

            branch_name:
              data.branch ?? "",

            syllabus_scheme_name:
              data.syllabus_scheme ?? "",

            semester:
              semester >= 1 &&
              semester <= 8
                ? semester
                : 1,

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

        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load your profile."
          );

          setMessageType("error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, []);

  // ====================================================
  // LOAD COLLEGES + PROGRAMS
  // ====================================================

  useEffect(() => {
    let active = true;

    async function loadRelatedRecords() {
      if (!profile.university_id) {
        setColleges([]);
        setPrograms([]);
        return;
      }

      const [
        collegeResult,
        programResult,
      ] = await Promise.all([
        supabase
          .from("colleges")
          .select(
            "id,name,university_id,city,state"
          )
          .eq(
            "university_id",
            profile.university_id
          )
          .order("name"),

        supabase
          .from("academic_programs")
          .select(
            "id,name,degree,university_id"
          )
          .eq(
            "university_id",
            profile.university_id
          )
          .in(
            "degree",
            [
              "B.E.",
              "B.Tech",
              "BE",
              "BTech",
            ]
          )
          .order("degree")
          .order("name"),
      ]);

      if (!active) {
        return;
      }

      if (collegeResult.error) {
        console.error(
          "COLLEGE LOAD ERROR:",
          collegeResult.error
        );

        setColleges([]);

        setMessage(
          "Unable to load colleges."
        );

        setMessageType("error");
      } else {
        setColleges(
          collegeResult.data ?? []
        );
      }

      if (programResult.error) {
        console.error(
          "PROGRAM LOAD ERROR:",
          programResult.error
        );

        setPrograms([]);

        setMessage(
          "Unable to load B.E. / B.Tech records."
        );

        setMessageType("error");
      } else {
        setPrograms(
          programResult.data ?? []
        );
      }
    }

    loadRelatedRecords();

    return () => {
      active = false;
    };
  }, [profile.university_id]);

  // ====================================================
  // LOAD BRANCHES FOR SELECTED COLLEGE
  // ====================================================

  useEffect(() => {
    let active = true;

    async function loadBranches() {
      if (!profile.college_id) {
        setBranches([]);
        return;
      }

      const { data, error } =
        await supabase
          .from("college_branches")
          .select(`
            branch_id,
            branches (
              id,
              name,
              short_name
            )
          `)
          .eq(
            "college_id",
            profile.college_id
          );

      if (!active) {
        return;
      }

      if (error) {
        console.error(
          "BRANCH LOAD ERROR:",
          error
        );

        setBranches([]);

        setMessage(
          "Unable to load branches for this college."
        );

        setMessageType("error");

        return;
      }

      const mappedBranches: Branch[] =
        (data ?? [])
          .map((row) => {
            const branch =
              Array.isArray(row.branches)
                ? row.branches[0]
                : row.branches;

            return branch;
          })
          .filter(
            (
              branch
            ): branch is Branch =>
              Boolean(branch)
          );

      setBranches(
        mappedBranches
      );
    }

    loadBranches();

    return () => {
      active = false;
    };
  }, [profile.college_id]);

  // ====================================================
  // SELECTED RECORDS
  // ====================================================

  const selectedUniversity =
    universities.find(
      (item) =>
        item.id ===
        profile.university_id
    ) ?? null;

  const selectedCollege =
    colleges.find(
      (item) =>
        item.id ===
        profile.college_id
    ) ?? null;

  const selectedProgram =
    programs.find(
      (item) =>
        item.id ===
        profile.program_id
    ) ?? null;

  const selectedBranch =
    branches.find(
      (item) =>
        item.id ===
        profile.branch_id
    ) ?? null;

  // ====================================================
  // UNIVERSITY CHANGE
  // ====================================================

  function handleUniversityChange(
    id: string
  ) {
    const university =
      universities.find(
        (item) =>
          item.id === id
      );

    setProfile((previous) => ({
      ...previous,

      university_id: id,

      university_name:
        university?.name ?? "",

      college_id: "",
      college_name: "",

      program_id: "",
      program_name: "",

      branch_id: "",
      branch_name: "",
    }));

    setColleges([]);
    setPrograms([]);
    setBranches([]);

    setMessage("");
  }

  // ====================================================
  // COLLEGE CHANGE
  // ====================================================

  function handleCollegeChange(
    id: string
  ) {
    const college =
      colleges.find(
        (item) =>
          item.id === id
      );

    updateProfile({
      college_id: id,

      college_name:
        college?.name ?? "",

      branch_id: "",
      branch_name: "",
    });

    setBranches([]);
    setMessage("");
  }

  // ====================================================
  // PROGRAM CHANGE
  // ====================================================

  function handleProgramChange(
    id: string
  ) {
    const program =
      programs.find(
        (item) =>
          item.id === id
      );

    let degree =
      program?.degree ?? "";

    if (
      degree === "BE" ||
      degree === "B.E."
    ) {
      degree = "B.E.";
    }

    if (
      degree === "BTech" ||
      degree === "B.Tech"
    ) {
      degree = "B.Tech";
    }

    updateProfile({
      program_id: id,
      program_name: degree,
    });

    setMessage("");
  }

  // ====================================================
  // BRANCH CHANGE
  // ====================================================

  function handleBranchChange(
    id: string
  ) {
    const branch =
      branches.find(
        (item) =>
          item.id === id
      );

    updateProfile({
      branch_id: id,

      branch_name:
        branch?.name ?? "",
    });

    setMessage("");
  }

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
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error(
          "Please log in before saving your profile."
        );
      }

      // ==================================================
      // REQUIRED MASTER DATA
      // ==================================================

      const universityId =
        profile.university_id;

      const collegeId =
        profile.college_id;

      const programId =
        profile.program_id;

      const branchId =
        profile.branch_id;

      // ==================================================
      // VALIDATION
      // ==================================================

      if (!universityId) {
        throw new Error(
          "Please select your university."
        );
      }

      if (!collegeId) {
        throw new Error(
          "Please select your college."
        );
      }

      if (!programId) {
        throw new Error(
          "Please select B.E. or B.Tech."
        );
      }

      if (!branchId) {
        throw new Error(
          "Please select your branch."
        );
      }

      if (!selectedUniversity) {
        throw new Error(
          "Selected university could not be found."
        );
      }

      if (!selectedCollege) {
        throw new Error(
          "Selected college could not be found."
        );
      }

      if (!selectedProgram) {
        throw new Error(
          "Selected academic program could not be found."
        );
      }

      if (!selectedBranch) {
        throw new Error(
          "Selected branch could not be found."
        );
      }

      // ==================================================
      // NORMALIZE DEGREE
      // ==================================================

      const rawDegree =
        selectedProgram.degree ?? "";

      const normalizedDegree =
        rawDegree === "BE" ||
        rawDegree === "B.E."
          ? "B.E."
          : rawDegree === "BTech" ||
              rawDegree === "B.Tech"
            ? "B.Tech"
            : "";

      if (
        !DEGREE_OPTIONS.includes(
          normalizedDegree
        )
      ) {
        throw new Error(
          "Academic Program must be B.E. or B.Tech."
        );
      }

      // ==================================================
      // VALIDATE SEMESTER
      // ==================================================

      if (
        !Number.isInteger(
          profile.semester
        ) ||
        profile.semester < 1 ||
        profile.semester > 8
      ) {
        throw new Error(
          "Please select a valid semester between 1 and 8."
        );
      }

      // ==================================================
      // VALIDATE COLLEGE / UNIVERSITY RELATION
      // ==================================================

      if (
        selectedCollege.university_id !==
        universityId
      ) {
        throw new Error(
          "The selected college does not belong to the selected university."
        );
      }

      // ==================================================
      // VALIDATE BRANCH / COLLEGE RELATION
      // ==================================================

      const {
        data: collegeBranch,
        error: collegeBranchError,
      } = await supabase
        .from("college_branches")
        .select("id")
        .eq(
          "college_id",
          collegeId
        )
        .eq(
          "branch_id",
          branchId
        )
        .maybeSingle();

      if (collegeBranchError) {
        throw collegeBranchError;
      }

      if (!collegeBranch) {
        throw new Error(
          "The selected branch is not available for this college."
        );
      }

      // ==================================================
      // TEXT VALUES
      // ==================================================

      const universityName =
        selectedUniversity.name;

      const collegeName =
        selectedCollege.name;

      const branchName =
        selectedBranch.name;

      const syllabusName =
        profile.syllabus_scheme_name.trim();

      // ==================================================
      // SAVE STUDENT PROFILE
      // ==================================================

      const {
        error: profileError,
      } = await supabase
        .from("student_profiles")
        .upsert(
          {
            user_id: user.id,

            // Normalized references
            university_id:
              universityId,

            college_id:
              collegeId,

            program_id:
              programId,

            branch_id:
              branchId,

            // Text compatibility fields
            university:
              universityName,

            college:
              collegeName,

            academic_program:
              normalizedDegree,

            branch:
              branchName,

            syllabus_scheme:
              syllabusName || null,

            // Scheme selection is not
            // implemented in this page yet.
            scheme_id: null,

            syllabus_scheme_id:
              null,

            // Semester
            semester:
              Number(
                profile.semester
              ),

            semester_number:
              Number(
                profile.semester
              ),

            // Career preferences
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
            onConflict:
              "user_id",
          }
        );

      if (profileError) {
        throw profileError;
      }

      // ==================================================
      // UPDATE LOCAL STATE
      // ==================================================

      setProfile(
        (previous) => ({
          ...previous,

          university_id:
            universityId,

          college_id:
            collegeId,

          program_id:
            programId,

          branch_id:
            branchId,

          university_name:
            universityName,

          college_name:
            collegeName,

          program_name:
            normalizedDegree,

          branch_name:
            branchName,
        })
      );

      setMessage(
        "Profile saved successfully! 🎉 Your university, college, degree, branch, and semester are connected to your Vertex academic profile."
      );

      setMessageType("success");
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

      setMessageType("error");
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
            Select your university, college,
            degree, branch, and academic details
            to personalize your Vertex placement
            journey.
          </p>
        </div>

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl md:p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">

            {/* ==========================================
                UNIVERSITY
            ========================================== */}

            <div className="md:col-span-2">
              <label className={labelClass}>
                University
              </label>

              <select
                className={inputClass}
                value={
                  profile.university_id
                }
                onChange={(event) =>
                  handleUniversityChange(
                    event.target.value
                  )
                }
                required
              >
                <option value="">
                  Select your university
                </option>

                {universities.map(
                  (university) => (
                    <option
                      key={university.id}
                      value={
                        university.id
                      }
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

            {/* ==========================================
                COLLEGE
            ========================================== */}

            <div className="md:col-span-2">
              <label className={labelClass}>
                College / Institution
              </label>

              <select
                className={inputClass}
                value={
                  profile.college_id
                }
                onChange={(event) =>
                  handleCollegeChange(
                    event.target.value
                  )
                }
                disabled={
                  !profile.university_id
                }
                required
              >
                <option value="">
                  {profile.university_id
                    ? "Select your college"
                    : "Select your university first"}
                </option>

                {colleges.map(
                  (college) => (
                    <option
                      key={college.id}
                      value={
                        college.id
                      }
                    >
                      {college.name}

                      {college.city
                        ? ` — ${college.city}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* ==========================================
                ACADEMIC PROGRAM
            ========================================== */}

            <div>
              <label className={labelClass}>
                Academic Program / Degree
              </label>

              <select
                className={inputClass}
                value={
                  profile.program_id
                }
                onChange={(event) =>
                  handleProgramChange(
                    event.target.value
                  )
                }
                disabled={
                  !profile.university_id
                }
                required
              >
                <option value="">
                  {profile.university_id
                    ? "Select B.E. / B.Tech"
                    : "Select your university first"}
                </option>

                {programs.map(
                  (program) => (
                    <option
                      key={program.id}
                      value={
                        program.id
                      }
                    >
                      {program.degree ===
                        "BE" ||
                      program.degree ===
                        "B.E."
                        ? "B.E."
                        : program.degree ===
                              "BTech" ||
                            program.degree ===
                              "B.Tech"
                          ? "B.Tech"
                          : program.degree}
                    </option>
                  )
                )}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                Select your degree: B.E. or
                B.Tech.
              </p>
            </div>

            {/* ==========================================
                BRANCH
            ========================================== */}

            <div>
              <label className={labelClass}>
                Branch / Specialization
              </label>

              <select
                className={inputClass}
                value={
                  profile.branch_id
                }
                onChange={(event) =>
                  handleBranchChange(
                    event.target.value
                  )
                }
                disabled={
                  !profile.college_id
                }
                required
              >
                <option value="">
                  {!profile.college_id
                    ? "Select your college first"
                    : "Select your branch"}
                </option>

                {branches.map(
                  (branch) => (
                    <option
                      key={branch.id}
                      value={
                        branch.id
                      }
                    >
                      {branch.name}

                      {branch.short_name
                        ? ` (${branch.short_name})`
                        : ""}
                    </option>
                  )
                )}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                Select your branch or
                specialization.
              </p>
            </div>

            {/* ==========================================
                SYLLABUS
            ========================================== */}

            <div className="md:col-span-2">
              <label className={labelClass}>
                Syllabus / Regulation (optional)
              </label>

              <input
                className={inputClass}
                value={
                  profile.syllabus_scheme_name
                }
                onChange={(event) =>
                  updateProfile({
                    syllabus_scheme_name:
                      event.target.value,
                  })
                }
                placeholder="e.g. VTU 2022 Scheme, 2024 Regulation"
                maxLength={200}
              />

              <p className="mt-2 text-xs text-slate-500">
                If you don&apos;t know your
                syllabus scheme, leave this
                blank.
              </p>
            </div>

            {/* ==========================================
                SEMESTER
            ========================================== */}

            <div>
              <label className={labelClass}>
                Current Semester
              </label>

              <select
                className={inputClass}
                value={
                  profile.semester
                }
                onChange={(event) =>
                  updateProfile({
                    semester:
                      Number(
                        event.target.value
                      ),
                  })
                }
                required
              >
                {SEMESTERS.map(
                  (semester) => (
                    <option
                      key={semester}
                      value={semester}
                    >
                      Semester {semester}
                    </option>
                  )
                )}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                B.E. / B.Tech profile supports
                Semester 1 through Semester 8.
              </p>
            </div>

            {/* ==========================================
                TARGET ROLE
            ========================================== */}

            <div>
              <label className={labelClass}>
                Target Role
              </label>

              <select
                className={inputClass}
                value={
                  profile.target_role
                }
                onChange={(event) =>
                  updateProfile({
                    target_role:
                      event.target.value,
                  })
                }
              >
                {TARGET_ROLES.map(
                  (role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {role}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* ==========================================
                COMPANY TIER
            ========================================== */}

            <div>
              <label className={labelClass}>
                Target Company Tier
              </label>

              <select
                className={inputClass}
                value={
                  profile.company_tier
                }
                onChange={(event) =>
                  updateProfile({
                    company_tier:
                      event.target.value,
                  })
                }
              >
                {COMPANY_TIERS.map(
                  (tier) => (
                    <option
                      key={tier}
                      value={tier}
                    >
                      {tier}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* ==========================================
                SKILL LEVEL
            ========================================== */}

            <div className="md:col-span-2">
              <label className={labelClass}>
                Current Skill Level
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                {SKILL_LEVELS.map(
                  (level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        updateProfile({
                          skill_level:
                            level,
                        })
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
                  )
                )}
              </div>
            </div>
          </div>

          {/* ==========================================
              ACADEMIC PROFILE PREVIEW
          ========================================== */}

          <div className="mt-8 rounded-xl border border-blue-900/60 bg-blue-950/20 p-5">
            <p className="text-sm font-semibold text-blue-400">
              🎓 Academic Profile Preview
            </p>

            <div className="mt-3 grid gap-2 wrap-break-word text-sm text-slate-300">
              <p>
                <span className="text-slate-500">
                  University:
                </span>{" "}
                {profile.university_name ||
                  "Not entered"}
              </p>

              <p>
                <span className="text-slate-500">
                  College:
                </span>{" "}
                {profile.college_name ||
                  "Not entered"}
              </p>

              <p>
                <span className="text-slate-500">
                  Academic Program:
                </span>{" "}
                {profile.program_name ||
                  "Not entered"}
              </p>

              <p>
                <span className="text-slate-500">
                  Branch:
                </span>{" "}
                {profile.branch_name ||
                  "Not entered"}
              </p>

              <p>
                <span className="text-slate-500">
                  Syllabus:
                </span>{" "}
                {profile.syllabus_scheme_name ||
                  "Not specified"}
              </p>

              <p>
                <span className="text-slate-500">
                  Semester:
                </span>{" "}
                {profile.semester}
              </p>
            </div>
          </div>

          {/* ==========================================
              MESSAGE
          ========================================== */}

          {message && (
            <div
              role="status"
              className={`mt-6 rounded-xl border p-4 text-sm ${
                messageType ===
                "success"
                  ? "border-green-800/50 bg-green-950/30 text-green-300"
                  : "border-red-800/50 bg-red-950/30 text-red-300"
              }`}
            >
              {message}
            </div>
          )}

          {/* ==========================================
              SAVE
          ========================================== */}

          <button
            type="submit"
            disabled={saving}
            className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving Profile..."
              : "Save Career Profile 🚀"}
          </button>

          {/* ==========================================
              CURRICULUM
          ========================================== */}

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