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

  const [customUniversity, setCustomUniversity] =
    useState(false);

  const [customCollege, setCustomCollege] =
    useState(false);

  const [customProgram, setCustomProgram] =
    useState(false);

  const [customBranch, setCustomBranch] =
    useState(false);

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
  // LOAD USER + DIRECTORY + PROFILE
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
              semester >= 1 && semester <= 8
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

          setCustomUniversity(
            !universityId
          );

          setCustomCollege(
            !collegeId
          );

          setCustomProgram(
            !programId
          );

          setCustomBranch(
            !branchId
          );
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
            ["B.E.", "B.Tech", "BE", "BTech"]
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
          "Unable to load colleges. You can enter yours manually."
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
          "Unable to load degree records. You can choose B.E. or B.Tech manually."
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
  // SELECTED DIRECTORY RECORDS
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
  // UNIVERSITY MODE
  // ====================================================

  function changeUniversityMode(
    useCustom: boolean
  ) {
    setCustomUniversity(
      useCustom
    );

    setCustomCollege(false);
    setCustomProgram(false);
    setCustomBranch(false);

    setProfile((previous) => ({
      ...previous,

      university_id: useCustom
        ? ""
        : previous.university_id,

      college_id: "",
      program_id: "",
      branch_id: "",

      university_name:
        useCustom
          ? previous.university_name
          : "",

      college_name: "",
      program_name: "",
      branch_name: "",
    }));

    setColleges([]);
    setPrograms([]);
    setBranches([]);

    setMessage("");
  }

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

    setCustomCollege(false);
    setCustomProgram(false);
    setCustomBranch(false);

    setColleges([]);
    setPrograms([]);
    setBranches([]);

    setMessage("");
  }

  // ====================================================
  // COLLEGE MODE
  // ====================================================

  function changeCollegeMode(
    useCustom: boolean
  ) {
    setCustomCollege(
      useCustom
    );

    setCustomBranch(false);

    setProfile((previous) => ({
      ...previous,

      college_id: "",

      college_name:
        useCustom
          ? previous.college_name
          : "",

      branch_id: "",
      branch_name: "",
    }));

    setBranches([]);
  }

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

    setCustomBranch(false);
    setBranches([]);

    setMessage("");
  }

  // ====================================================
  // PROGRAM MODE
  // ====================================================

  function changeProgramMode(
    useCustom: boolean
  ) {
    setCustomProgram(
      useCustom
    );

    setProfile((previous) => ({
      ...previous,

      program_id: "",

      program_name:
        useCustom
          ? previous.program_name
          : "",
    }));
  }

  function handleProgramChange(
    id: string
  ) {
    const program =
      programs.find(
        (item) =>
          item.id === id
      );

    updateProfile({
      program_id: id,

      // IMPORTANT:
      // UI/profile stores the degree,
      // not "Computer Science (B.E.)".
      program_name:
        program?.degree === "BE"
          ? "B.E."
          : program?.degree === "BTech"
            ? "B.Tech"
            : program?.degree ?? "",
    });
  }

  function handleManualDegreeChange(
    degree: string
  ) {
    updateProfile({
      program_id: "",
      program_name: degree,
    });
  }

  // ====================================================
  // BRANCH MODE
  // ====================================================

  function changeBranchMode(
    useCustom: boolean
  ) {
    setCustomBranch(
      useCustom
    );

    setProfile((previous) => ({
      ...previous,

      branch_id: "",

      branch_name:
        useCustom
          ? previous.branch_name
          : "",
    }));
  }

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
  }

  // ====================================================
  // SAVE / CREATE DIRECTORY RECORDS
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

      const universityName =
        profile.university_name.trim();

      const collegeName =
        profile.college_name.trim();

      const programName =
        profile.program_name.trim();

      const branchName =
        profile.branch_name.trim();

      const syllabusName =
        profile.syllabus_scheme_name.trim();

      // ==================================================
      // VALIDATION
      // ==================================================

      if (!universityName) {
        throw new Error(
          "Enter or select your university."
        );
      }

      if (!collegeName) {
        throw new Error(
          "Enter or select your college."
        );
      }

      if (
        !DEGREE_OPTIONS.includes(
          programName
        )
      ) {
        throw new Error(
          "Academic Program must be B.E. or B.Tech."
        );
      }

      if (!branchName) {
        throw new Error(
          "Select or enter your branch."
        );
      }

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
      // UNIVERSITY
      // ==================================================

      let universityId =
        !customUniversity &&
        selectedUniversity
          ? selectedUniversity.id
          : null;

      if (
        customUniversity ||
        !universityId
      ) {
        const {
          data: existingUniversity,
          error: existingUniversityError,
        } = await supabase
          .from("universities")
          .select(
            "id,name,short_name"
          )
          .ilike(
            "name",
            universityName
          )
          .maybeSingle();

        if (
          existingUniversityError
        ) {
          throw existingUniversityError;
        }

        if (existingUniversity) {
          universityId =
            existingUniversity.id;
        } else {
          const {
            data: newUniversity,
            error: newUniversityError,
          } = await supabase
            .from("universities")
            .insert({
              name: universityName,
              short_name: null,
              country: "India",
            })
            .select(
              "id,name,short_name"
            )
            .single();

          if (newUniversityError) {
            throw newUniversityError;
          }

          universityId =
            newUniversity.id;

          setUniversities(
            (previous) => [
              ...previous,
              newUniversity,
            ].sort((a, b) =>
              a.name.localeCompare(
                b.name
              )
            )
          );
        }
      }

      // ==================================================
      // COLLEGE
      // ==================================================

      let collegeId =
        !customCollege &&
        selectedCollege
          ? selectedCollege.id
          : null;

      if (
        customCollege ||
        !collegeId
      ) {
        const {
          data: existingCollege,
          error: existingCollegeError,
        } = await supabase
          .from("colleges")
          .select(
            "id,name,university_id,city,state"
          )
          .eq(
            "university_id",
            universityId
          )
          .ilike(
            "name",
            collegeName
          )
          .maybeSingle();

        if (existingCollegeError) {
          throw existingCollegeError;
        }

        if (existingCollege) {
          collegeId =
            existingCollege.id;
        } else {
          const {
            data: newCollege,
            error: newCollegeError,
          } = await supabase
            .from("colleges")
            .insert({
              university_id:
                universityId,
              name: collegeName,
              city: null,
              state: null,
              country: "India",
            })
            .select(
              "id,name,university_id,city,state"
            )
            .single();

          if (newCollegeError) {
            throw newCollegeError;
          }

          collegeId =
            newCollege.id;

          setColleges(
            (previous) => [
              ...previous,
              newCollege,
            ].sort((a, b) =>
              a.name.localeCompare(
                b.name
              )
            )
          );
        }
      }

      // ==================================================
      // ACADEMIC PROGRAM / DEGREE
      // ==================================================

      let programId =
        !customProgram &&
        selectedProgram
          ? selectedProgram.id
          : null;

      /*
       * The UI is intentionally limited to:
       *
       * B.E.
       * B.Tech
       *
       * Existing academic_programs rows may have names such
       * as "Computer Science" with degree "B.E.".
       *
       * We therefore look for a program record belonging
       * to this university and degree.
       *
       * If no matching record exists, create a canonical
       * B.E. / B.Tech record.
       */

      const normalizedDegree =
        programName === "B.E."
          ? "B.E."
          : "B.Tech";

      if (
        !programId ||
        customProgram
      ) {
        const {
          data: existingDegree,
          error: existingDegreeError,
        } = await supabase
          .from("academic_programs")
          .select(
            "id,name,degree,university_id"
          )
          .eq(
            "university_id",
            universityId
          )
          .in(
            "degree",
            normalizedDegree ===
              "B.E."
              ? ["B.E.", "BE"]
              : ["B.Tech", "BTech"]
          )
          .order("name")
          .limit(1)
          .maybeSingle();

        if (existingDegreeError) {
          throw existingDegreeError;
        }

        if (existingDegree) {
          programId =
            existingDegree.id;
        } else {
          const {
            data: newProgram,
            error: newProgramError,
          } = await supabase
            .from("academic_programs")
            .insert({
              name: normalizedDegree,
              degree: normalizedDegree,
              university_id:
                universityId,
            })
            .select(
              "id,name,degree,university_id"
            )
            .single();

          if (newProgramError) {
            throw newProgramError;
          }

          programId =
            newProgram.id;

          setPrograms(
            (previous) => [
              ...previous,
              newProgram,
            ]
          );
        }
      }

      // ==================================================
      // BRANCH
      // ==================================================

      let branchId =
        !customBranch &&
        selectedBranch
          ? selectedBranch.id
          : null;

      if (
        customBranch ||
        !branchId
      ) {
        const {
          data: existingBranch,
          error: existingBranchError,
        } = await supabase
          .from("branches")
          .select(
            "id,name,short_name"
          )
          .ilike(
            "name",
            branchName
          )
          .maybeSingle();

        if (existingBranchError) {
          throw existingBranchError;
        }

        if (existingBranch) {
          branchId =
            existingBranch.id;
        } else {
          const {
            data: newBranch,
            error: newBranchError,
          } = await supabase
            .from("branches")
            .insert({
              name: branchName,
              short_name: null,
            })
            .select(
              "id,name,short_name"
            )
            .single();

          if (newBranchError) {
            throw newBranchError;
          }

          branchId =
            newBranch.id;
        }

        // ================================================
        // CONNECT BRANCH TO COLLEGE
        // ================================================

        const {
          data: existingCollegeBranch,
          error: existingCollegeBranchError,
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

        if (
          existingCollegeBranchError
        ) {
          throw existingCollegeBranchError;
        }

        if (
          !existingCollegeBranch
        ) {
          const {
            error: collegeBranchInsertError,
          } = await supabase
            .from("college_branches")
            .insert({
              college_id:
                collegeId,
              branch_id:
                branchId,
            });

          if (
            collegeBranchInsertError
          ) {
            throw collegeBranchInsertError;
          }
        }
      }

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

            // These remain unset until
            // scheme selection is implemented.
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
            universityId ?? "",

          college_id:
            collegeId ?? "",

          program_id:
            programId ?? "",

          branch_id:
            branchId ?? "",

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

      setCustomUniversity(false);
      setCustomCollege(false);
      setCustomProgram(false);
      setCustomBranch(false);

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
            Students from any university,
            college, or branch can create a
            Vertex profile. Select existing
            academic records or enter new
            academic details.
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

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    changeUniversityMode(
                      false
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    !customUniversity
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  Select listed university
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeUniversityMode(
                      true
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    customUniversity
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  My university isn&apos;t listed
                </button>
              </div>

              {customUniversity ? (
                <input
                  className={inputClass}
                  value={
                    profile.university_name
                  }
                  onChange={(event) =>
                    updateProfile({
                      university_name:
                        event.target.value,
                    })
                  }
                  placeholder="Enter your university's full name"
                  required
                  maxLength={200}
                />
              ) : (
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
              )}

              <p className="mt-2 text-xs text-slate-500">
                Not listed? Enter it manually.
                Vertex will create the university
                directory record when you save.
              </p>
            </div>

            {/* ==========================================
                COLLEGE
            ========================================== */}

            <div className="md:col-span-2">
              <label className={labelClass}>
                College / Institution
              </label>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    changeCollegeMode(
                      false
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    !customCollege
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  Select listed college
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeCollegeMode(
                      true
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    customCollege
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  Enter college manually
                </button>
              </div>

              {customCollege ? (
                <input
                  className={inputClass}
                  value={
                    profile.college_name
                  }
                  onChange={(event) =>
                    updateProfile({
                      college_name:
                        event.target.value,
                    })
                  }
                  placeholder="Enter your college name"
                  required
                  maxLength={200}
                />
              ) : (
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
                      ? colleges.length
                        ? "Select your college"
                        : "No listed colleges — enter manually"
                      : "Select a listed university first"}
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
              )}
            </div>

            {/* ==========================================
                ACADEMIC PROGRAM
            ========================================== */}

            <div>
              <label className={labelClass}>
                Academic Program / Degree
              </label>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    changeProgramMode(
                      false
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    !customProgram
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  Select listed
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeProgramMode(
                      true
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    customProgram
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  Select degree manually
                </button>
              </div>

              {customProgram ? (
                <select
                  className={inputClass}
                  value={
                    profile.program_name
                  }
                  onChange={(event) =>
                    handleManualDegreeChange(
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Select degree
                  </option>

                  {DEGREE_OPTIONS.map(
                    (degree) => (
                      <option
                        key={degree}
                        value={degree}
                      >
                        {degree}
                      </option>
                    )
                  )}
                </select>
              ) : (
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
                      ? programs.length
                        ? "Select B.E. / B.Tech"
                        : "No listed degree — choose manually"
                      : "Select a listed university first"}
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
                        "BE"
                          ? "B.E."
                          : program.degree ===
                            "BTech"
                            ? "B.Tech"
                            : program.degree}
                      </option>
                    )
                  )}
                </select>
              )}

              <p className="mt-2 text-xs text-slate-500">
                Academic Program means your degree:
                B.E. or B.Tech. Your specialization
                is selected separately under Branch.
              </p>
            </div>

            {/* ==========================================
                BRANCH
            ========================================== */}

            <div>
              <label className={labelClass}>
                Branch / Specialization
              </label>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    changeBranchMode(
                      false
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    !customBranch
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  Select listed branch
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeBranchMode(
                      true
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    customBranch
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  Enter new branch
                </button>
              </div>

              {customBranch ? (
                <input
                  className={inputClass}
                  value={
                    profile.branch_name
                  }
                  onChange={(event) =>
                    updateProfile({
                      branch_name:
                        event.target.value,

                      branch_id: "",
                    })
                  }
                  placeholder="e.g. Artificial Intelligence and Machine Learning"
                  required
                  maxLength={200}
                />
              ) : (
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
                      : branches.length
                        ? "Select your branch"
                        : "No listed branches — enter new branch"}
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
              )}

              <p className="mt-2 text-xs text-slate-500">
                Branch is your specialization, such
                as CSE, AI &amp; ML, ISE, ECE,
                Mechanical, or Civil.
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
                If you don&apos;t know your syllabus
                scheme, leave this blank.
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
                    semester: Number(
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
                BE / B.Tech profile supports
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