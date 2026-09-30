"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

type Mentor = {
  id: string;
  user_id: string;
  full_name: string;
  profile_photo_url: string | null;
  college: string | null;
  branch: string | null;
  graduation_year: number | null;
  current_company: string | null;
  job_role: string | null;
  bio: string | null;
  skills: string[] | null;
  years_experience: number | null;
  target_roles: string[] | null;
  company_tiers: string[] | null;
  linkedin_url: string | null;
  github_url: string | null;
  verification_status: string;
  session_price: number | null;
  currency: string | null;
  is_available: boolean;
  average_rating: number | null;
  total_reviews: number;
  total_sessions: number;
  created_at: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatPrice(
  price: number | null,
  currency: string | null
) {
  if (price === null || price === undefined) {
    return "Free";
  }

  const code = currency || "INR";

  if (code === "INR") {
    return `₹${price}`;
  }

  return `${code} ${price}`;
}

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [companyFilter, setCompanyFilter] =
    useState("All");

  const loadMentors = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error: mentorError } =
        await supabase
          .from("mentors")
          .select(`
            id,
            user_id,
            full_name,
            profile_photo_url,
            college,
            branch,
            graduation_year,
            current_company,
            job_role,
            bio,
            skills,
            years_experience,
            target_roles,
            company_tiers,
            linkedin_url,
            github_url,
            verification_status,
            session_price,
            currency,
            is_available,
            average_rating,
            total_reviews,
            total_sessions,
            created_at
          `)
          .eq(
            "verification_status",
            "verified"
          )
          .eq("is_available", true)
          .order("average_rating", {
            ascending: false,
            nullsFirst: false,
          });

      if (mentorError) {
        throw mentorError;
      }

      setMentors(data ?? []);
    } catch (err) {
      console.error(
        "Mentor marketplace error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load mentors."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadMentors();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMentors]);

  const targetRoles = useMemo(() => {
    const roles = new Set<string>();

    mentors.forEach((mentor) => {
      mentor.target_roles?.forEach((role) => {
        if (role.trim()) {
          roles.add(role.trim());
        }
      });
    });

    return Array.from(roles).sort();
  }, [mentors]);

  const companyTiers = useMemo(() => {
    const tiers = new Set<string>();

    mentors.forEach((mentor) => {
      mentor.company_tiers?.forEach((tier) => {
        if (tier.trim()) {
          tiers.add(tier.trim());
        }
      });
    });

    return Array.from(tiers).sort();
  }, [mentors]);

  const filteredMentors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mentors.filter((mentor) => {
      const searchableText = [
        mentor.full_name,
        mentor.current_company,
        mentor.job_role,
        mentor.college,
        mentor.branch,
        mentor.bio,
        ...(mentor.skills ?? []),
        ...(mentor.target_roles ?? []),
        ...(mentor.company_tiers ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        searchableText.includes(query);

      const matchesRole =
        roleFilter === "All" ||
        mentor.target_roles?.includes(
          roleFilter
        );

      const matchesCompany =
        companyFilter === "All" ||
        mentor.company_tiers?.includes(
          companyFilter
        );

      return (
        matchesSearch &&
        matchesRole &&
        matchesCompany
      );
    });
  }, [
    mentors,
    search,
    roleFilter,
    companyFilter,
  ]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-cyan-400"
          >
            Vertex
          </Link>

          <div className="flex items-center gap-5 text-sm">
            <Link
              href="/roadmap"
              className="text-slate-300 transition hover:text-white"
            >
              Roadmap
            </Link>

            <Link
              href="/dsa"
              className="text-slate-300 transition hover:text-white"
            >
              DSA
            </Link>

            <Link
              href="/projects"
              className="text-slate-300 transition hover:text-white"
            >
              Projects
            </Link>

            <Link
              href="/ai-tutor"
              className="text-slate-300 transition hover:text-white"
            >
              AI Tutor
            </Link>

            <Link
              href="/pods"
              className="text-slate-300 transition hover:text-white"
            >
              Pods
            </Link>

            <Link
              href="/mentor"
              className="text-slate-300 transition hover:text-white"
            >
              Mentor
            </Link>

            <Link
              href="/mentors"
              className="font-semibold text-cyan-400"
            >
              Find Mentors
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-400">
              Vertex Mentor Marketplace
            </p>

            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Learn from experienced mentors 🎓
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
              Connect with verified professionals for
              placement preparation, technical
              interviews, resume reviews, DSA guidance,
              and career advice.
            </p>
          </div>

          {/* Stats */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Verified Mentors
              </p>

              <p className="mt-2 text-3xl font-bold text-cyan-400">
                {mentors.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Available Now
              </p>

              <p className="mt-2 text-3xl font-bold text-emerald-400">
                {mentors.filter(
                  (mentor) => mentor.is_available
                ).length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Mentor Sessions
              </p>

              <p className="mt-2 text-3xl font-bold text-white">
                {mentors.reduce(
                  (sum, mentor) =>
                    sum +
                    (mentor.total_sessions || 0),
                  0
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Marketplace */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        {/* Filters */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto]">
            {/* Search */}
            <div>
              <label
                htmlFor="mentor-search"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Search mentors
              </label>

              <input
                id="mentor-search"
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search by name, company, skill, role..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
              />
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="role-filter"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Target Role
              </label>

              <select
                id="role-filter"
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="All">
                  All Roles
                </option>

                {targetRoles.map((role) => (
                  <option
                    key={role}
                    value={role}
                  >
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* Company */}
            <div>
              <label
                htmlFor="company-filter"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Company Type
              </label>

              <select
                id="company-filter"
                value={companyFilter}
                onChange={(event) =>
                  setCompanyFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="All">
                  All Companies
                </option>

                {companyTiers.map((tier) => (
                  <option
                    key={tier}
                    value={tier}
                  >
                    {tier}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset */}
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("All");
                  setCompanyFilter("All");
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300 lg:w-auto"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Results heading */}
        {!loading && !error && (
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold">
                Available Mentors
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredMentors.length} mentor
                {filteredMentors.length === 1
                  ? ""
                  : "s"} found
              </p>
            </div>

            <button
              type="button"
              onClick={loadMentors}
              className="text-sm text-cyan-400 transition hover:text-cyan-300"
            >
              ↻ Refresh
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
            <p className="font-semibold">
              Unable to load mentors
            </p>

            <p className="mt-2 text-sm">
              {error}
            </p>

            <button
              type="button"
              onClick={loadMentors}
              className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <div className="h-14 w-14 rounded-full bg-slate-800" />

                <div className="mt-5 h-5 w-2/3 rounded bg-slate-800" />

                <div className="mt-3 h-4 w-1/2 rounded bg-slate-800" />

                <div className="mt-6 h-20 rounded bg-slate-800" />

                <div className="mt-6 h-10 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        )}

        {/* No mentors */}
        {!loading &&
          !error &&
          filteredMentors.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-3xl">
                🎓
              </div>

              <h2 className="text-xl font-semibold">
                No mentors found
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                There are currently no verified mentors
                matching your search or filters.
              </p>

              {(search ||
                roleFilter !== "All" ||
                companyFilter !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setRoleFilter("All");
                    setCompanyFilter("All");
                  }}
                  className="mt-5 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

        {/* Mentor Cards */}
        {!loading &&
          !error &&
          filteredMentors.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredMentors.map((mentor) => (
                <article
                  key={mentor.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:-translate-y-1 hover:border-cyan-500/40"
                >
                  {/* Top */}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {mentor.profile_photo_url ? (
                          <Image
                            src={
                              mentor.profile_photo_url
                            }
                            width={56}
                            height={56}
                            alt={
                              mentor.full_name
                            }
                            className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-800"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 text-xl font-bold text-cyan-400 ring-2 ring-slate-800">
                            {mentor.full_name
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}

                        <div>
                          <h3 className="font-bold text-white">
                            {mentor.full_name}
                          </h3>

                          <p className="mt-1 text-sm text-slate-400">
                            {mentor.job_role ||
                              "Professional"}
                          </p>

                          {mentor.current_company && (
                            <p className="mt-0.5 text-sm text-cyan-400">
                              {mentor.current_company}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                        ✓ Verified
                      </span>
                    </div>

                    {/* Rating */}
                    <div className="mt-5 flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-amber-400">
                          ★
                        </span>

                        <span className="font-semibold text-white">
                          {mentor.average_rating
                            ? Number(
                                mentor.average_rating
                              ).toFixed(1)
                            : "New"}
                        </span>
                      </div>

                      <span className="text-slate-600">
                        •
                      </span>

                      <span className="text-sm text-slate-400">
                        {mentor.total_reviews || 0}{" "}
                        review
                        {mentor.total_reviews ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="mt-5 line-clamp-3 text-sm leading-6 text-slate-400">
                      {mentor.bio ||
                        "Experienced professional ready to help students with placement preparation."}
                    </p>

                    {/* Skills */}
                    <div className="mt-5">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Skills
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {(mentor.skills ?? [])
                          .slice(0, 5)
                          .map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300"
                            >
                              {skill}
                            </span>
                          ))}

                        {(mentor.skills?.length ??
                          0) > 5 && (
                          <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-500">
                            +
                            {(mentor.skills?.length ??
                              0) - 5}{" "}
                            more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="mt-5 space-y-2 text-sm">
                      {mentor.college && (
                        <div className="flex gap-2">
                          <span className="text-slate-500">
                            🏫
                          </span>

                          <span className="text-slate-300">
                            {mentor.college}
                          </span>
                        </div>
                      )}

                      {mentor.years_experience !==
                        null && (
                        <div className="flex gap-2">
                          <span className="text-slate-500">
                            💼
                          </span>

                          <span className="text-slate-300">
                            {
                              mentor.years_experience
                            }{" "}
                            year
                            {mentor.years_experience ===
                            1
                              ? ""
                              : "s"}{" "}
                            experience
                          </span>
                        </div>
                      )}

                      {mentor.target_roles &&
                        mentor.target_roles
                          .length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-slate-500">
                              🎯
                            </span>

                            <span className="text-slate-300">
                              {mentor.target_roles
                                .slice(0, 2)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Bottom */}
                  <div className="mt-auto border-t border-slate-800 bg-slate-950/50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500">
                          Session starting from
                        </p>

                        <p className="mt-1 text-xl font-bold text-white">
                          {formatPrice(
                            mentor.session_price,
                            mentor.currency
                          )}
                        </p>
                      </div>

                      {mentor.is_available && (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                          ● Available
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/mentors/${mentor.id}`}
                      className="block w-full rounded-lg bg-cyan-500 px-5 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
                    >
                      View Mentor Profile →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
      </section>
    </main>
  );
}