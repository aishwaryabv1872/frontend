"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type University = {
  id: string;
  name: string;
  short_name: string | null;
};

type College = {
  id: string;
  university_id: string | null;
  name: string;
  city: string | null;
  state: string | null;
};

type AcademicProgram = {
  id: string;
  university_id: string | null;
  name: string;
  degree: string | null;
};

type Branch = {
  id: string;
  name: string;
  short_name: string | null;
};

const VTU_ID = "5a70bfcc-7723-475a-87d0-c888bb0a08dc";
const JAIN_COLLEGE_ID = "3457de8a-814f-4dbd-840d-6ef8a006d68d";

const DEGREE_OPTIONS = ["B.E.", "B.Tech"] as const;

function normalizeDegree(value: string | null | undefined): string | null {
  const degree = value?.trim().toLowerCase().replace(/\s+/g, "");

  if (["be", "b.e", "b.e."].includes(degree ?? "")) {
    return "B.E.";
  }

  if (["btech", "b.tech", "b.tech."].includes(degree ?? "")) {
    return "B.Tech";
  }

  return null;
}

export default function AcademicPage() {
  const router = useRouter();

  const [university, setUniversity] = useState<University | null>(null);
  const [college, setCollege] = useState<College | null>(null);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [programId, setProgramId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchSearch, setBranchSearch] = useState("");

  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchShortName, setNewBranchShortName] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setInitializing(true);
      setMessage("");

      try {
        const [
          universityResult,
          collegeResult,
          programsResult,
          branchesResult,
        ] = await Promise.all([
          supabase
            .from("universities")
            .select("id,name,short_name")
            .eq("id", VTU_ID)
            .single(),

          supabase
            .from("colleges")
            .select("id,university_id,name,city,state")
            .eq("id", JAIN_COLLEGE_ID)
            .eq("university_id", VTU_ID)
            .single(),

          supabase
            .from("academic_programs")
            .select("id,university_id,name,degree")
            .eq("university_id", VTU_ID)
            .order("name"),

          supabase
            .from("branches")
            .select("id,name,short_name")
            .order("name"),
        ]);

        if (universityResult.error) throw universityResult.error;
        if (collegeResult.error) throw collegeResult.error;
        if (programsResult.error) throw programsResult.error;
        if (branchesResult.error) throw branchesResult.error;

        if (!active) return;

        setUniversity(universityResult.data);
        setCollege(collegeResult.data);
        setPrograms(programsResult.data ?? []);
        setBranches(branchesResult.data ?? []);

        const savedAcademic = localStorage.getItem("vertex_academic");

        if (savedAcademic) {
          try {
            const saved = JSON.parse(savedAcademic);

            if (
              saved.universityId === VTU_ID &&
              saved.collegeId === JAIN_COLLEGE_ID
            ) {
              const savedProgram = (programsResult.data ?? []).find(
                (item) =>
                  item.id === saved.programId &&
                  normalizeDegree(item.degree) !== null
              );

              const savedBranch = (branchesResult.data ?? []).find(
                (item) => item.id === saved.branchId
              );

              if (savedProgram) {
                setProgramId(savedProgram.id);
              }

              if (savedBranch) {
                setBranchId(savedBranch.id);
                setBranchSearch(savedBranch.name);
              }
            }
          } catch {
            localStorage.removeItem("vertex_academic");
          }
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load academic information."
          );
        }
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  const availableDegrees = useMemo(() => {
    const result: { degree: string; programId: string }[] = [];

    for (const degree of DEGREE_OPTIONS) {
      const existing = programs.find(
        (program) => normalizeDegree(program.degree) === degree
      );

      if (existing) {
        result.push({
          degree,
          programId: existing.id,
        });
      }
    }

    return result;
  }, [programs]);

  const filteredBranches = useMemo(() => {
    const search = branchSearch.trim().toLowerCase();

    if (!search) {
      return branches;
    }

    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(search) ||
        branch.short_name?.toLowerCase().includes(search)
    );
  }, [branches, branchSearch]);

  const selectedProgram = programs.find(
    (program) => program.id === programId
  );

  const selectedBranch = branches.find(
    (branch) => branch.id === branchId
  );

  async function handleAddBranch() {
    const name = newBranchName.trim();
    const shortName = newBranchShortName.trim();

    if (!name) {
      setMessage("Please enter the engineering branch name.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data: existing, error: lookupError } = await supabase
        .from("branches")
        .select("id,name,short_name")
        .ilike("name", name)
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existing) {
        setBranches((previous) =>
          previous.some((item) => item.id === existing.id)
            ? previous
            : [...previous, existing].sort((a, b) =>
                a.name.localeCompare(b.name)
              )
        );

        setBranchId(existing.id);
        setBranchSearch(existing.name);
        setShowAddBranch(false);
        setNewBranchName("");
        setNewBranchShortName("");
        setMessage("This branch already exists and has been selected.");
        return;
      }

      const { data, error } = await supabase
        .from("branches")
        .insert({
          name,
          short_name: shortName || null,
        })
        .select("id,name,short_name")
        .single();

      if (error) {
        throw error;
      }

      setBranches((previous) =>
        [...previous, data].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setBranchId(data.id);
      setBranchSearch(data.name);
      setNewBranchName("");
      setNewBranchShortName("");
      setShowAddBranch(false);
      setMessage("Engineering branch added and selected.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to add the engineering branch."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    setMessage("");

    if (!university || !college) {
      setMessage(
        "VTU or Jain College could not be loaded. Please check that both records exist in Supabase."
      );
      return;
    }

    const degree = normalizeDegree(selectedProgram?.degree);

    if (!programId || !degree) {
      setMessage("Please select your degree: B.E. or B.Tech.");
      return;
    }

    if (!branchId || !selectedBranch) {
      setMessage("Please select your engineering branch.");
      return;
    }

    localStorage.setItem(
      "vertex_academic",
      JSON.stringify({
        universityId: university.id,
        university: university.name,
        collegeId: college.id,
        college: college.name,
        programId,
        academicProgram: degree,
        degree,
        branchId: selectedBranch.id,
        branch: selectedBranch.name,
      })
    );

    router.push("/onboarding/goals");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-500">
            Step 1 of 3
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Academic Information
          </h1>

          <p className="mt-3 text-slate-400">
            Select your degree and engineering branch. Vertex is currently
            configured for VTU and Jain College of Engineering, Belagavi.
          </p>
        </div>

        <div className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
          {/* FIXED UNIVERSITY */}
          <section>
            <label className="mb-3 block font-medium">
              University
            </label>

            <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
              {initializing ? (
                <span className="text-slate-400">
                  Loading university...
                </span>
              ) : (
                <div>
                  <p className="font-medium">
                    {university?.name ?? "VTU record not found"}
                  </p>

                  {university?.short_name && (
                    <p className="mt-1 text-sm text-slate-400">
                      {university.short_name}
                    </p>
                  )}
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-500">
              University selection is fixed to VTU.
            </p>
          </section>

          {/* FIXED COLLEGE */}
          <section>
            <label className="mb-3 block font-medium">
              College
            </label>

            <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
              {initializing ? (
                <span className="text-slate-400">
                  Loading college...
                </span>
              ) : (
                <div>
                  <p className="font-medium">
                    {college?.name ?? "Jain College record not found"}
                  </p>

                  {college?.city && (
                    <p className="mt-1 text-sm text-slate-400">
                      {college.city}
                      {college.state ? `, ${college.state}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-500">
              College selection is fixed to Jain College of Engineering,
              Belagavi.
            </p>
          </section>

          {/* DEGREE */}
          <section>
            <label className="mb-3 block font-medium">
              Degree / Academic Program
            </label>

            <select
              value={programId}
              onChange={(event) => {
                setProgramId(event.target.value);
                setMessage("");
              }}
              disabled={
                initializing || availableDegrees.length === 0
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:opacity-60"
            >
              <option value="">Select your degree</option>

              {availableDegrees.map(({ degree, programId: id }) => (
                <option key={id} value={id}>
                  {degree}
                </option>
              ))}
            </select>

            {availableDegrees.length === 0 && !initializing && (
              <p className="mt-2 text-sm text-amber-400">
                No B.E. or B.Tech program record was found for VTU.
                Please add the appropriate program record in Supabase.
              </p>
            )}

            {selectedProgram && (
              <p className="mt-2 text-sm text-emerald-400">
                Selected degree:{" "}
                {normalizeDegree(selectedProgram.degree)}
              </p>
            )}

            <p className="mt-2 text-sm text-slate-400">
              Choose your degree separately from your engineering branch.
            </p>
          </section>

          {/* ALL ENGINEERING BRANCHES */}
          <section>
            <label className="mb-3 block font-medium">
              Engineering Branch / Specialization
            </label>

            <input
              type="text"
              value={branchSearch}
              onChange={(event) => {
                setBranchSearch(event.target.value);
                setBranchId("");
                setMessage("");
              }}
              placeholder="Search branches, e.g. CSE, ECE, AI & ML..."
              disabled={initializing}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            />

            {branchSearch && !branchId && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800">
                {filteredBranches.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => {
                      setBranchId(branch.id);
                      setBranchSearch(branch.name);
                      setMessage("");
                    }}
                    className="block w-full border-b border-slate-700 px-4 py-3 text-left hover:bg-slate-700"
                  >
                    <span className="font-medium">
                      {branch.name}
                    </span>

                    {branch.short_name && (
                      <span className="ml-2 text-sm text-slate-400">
                        ({branch.short_name})
                      </span>
                    )}
                  </button>
                ))}

                {filteredBranches.length === 0 && (
                  <p className="p-4 text-sm text-slate-400">
                    No matching branch found. You can add it below.
                  </p>
                )}
              </div>
            )}

            {selectedBranch && (
              <p className="mt-2 text-sm text-emerald-400">
                Selected: {selectedBranch.name}
                {selectedBranch.short_name
                  ? ` (${selectedBranch.short_name})`
                  : ""}
              </p>
            )}

            <p className="mt-2 text-sm text-slate-400">
              All branches in your Supabase branches table are searchable.
              Add a missing engineering branch if needed.
            </p>

            <button
              type="button"
              onClick={() => setShowAddBranch((value) => !value)}
              className="mt-3 text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              {showAddBranch
                ? "− Cancel adding branch"
                : "+ My branch isn't listed"}
            </button>

            {showAddBranch && (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-5">
                <input
                  value={newBranchName}
                  onChange={(event) =>
                    setNewBranchName(event.target.value)
                  }
                  placeholder="Engineering branch name *"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3"
                />

                <input
                  value={newBranchShortName}
                  onChange={(event) =>
                    setNewBranchShortName(event.target.value)
                  }
                  placeholder="Short name (optional, e.g. ECE)"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3"
                />

                <button
                  type="button"
                  onClick={handleAddBranch}
                  disabled={loading || initializing}
                  className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? "Adding..." : "Add and Select Branch"}
                </button>
              </div>
            )}
          </section>

          {message && (
            <div
              role="status"
              className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300"
            >
              {message}
            </div>
          )}

          {/* NAVIGATION */}
          <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-800 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/onboarding")}
              className="rounded-lg border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800"
            >
              Back
            </button>

            <button
              type="button"
              onClick={handleContinue}
              disabled={
                loading ||
                initializing ||
                !university ||
                !college
              }
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {initializing ? "Loading..." : "Continue to Goals"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}