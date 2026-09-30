"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
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
};

type Availability = {
  id: string;
  mentor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(time: string) {
  if (!time) return "";

  const [hourString, minuteString] = time.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MentorProfilePage() {
  const params = useParams();
  const router = useRouter();

  const mentorId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";

  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [availability, setAvailability] = useState<
    Availability[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMentor = useCallback(async () => {
    if (!mentorId) {
      setError("Mentor ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const {
        data: mentorData,
        error: mentorError,
      } = await supabase
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
          total_sessions
        `)
        .eq("id", mentorId)
        .eq("verification_status", "verified")
        .eq("is_available", true)
        .single();

      if (mentorError) {
        console.error(
          "Mentor profile error:",
          mentorError
        );

        setError(
          mentorError.message ||
            "Unable to load mentor profile."
        );

        setMentor(null);
        return;
      }

      setMentor(mentorData);

      const {
        data: availabilityData,
        error: availabilityError,
      } = await supabase
        .from("mentor_availability")
        .select(`
          id,
          mentor_id,
          day_of_week,
          start_time,
          end_time,
          timezone,
          is_active
        `)
        .eq("mentor_id", mentorId)
        .eq("is_active", true)
        .order("day_of_week", {
          ascending: true,
        })
        .order("start_time", {
          ascending: true,
        });

      if (availabilityError) {
        console.error(
          "Availability error:",
          availabilityError
        );

        setAvailability([]);
      } else {
        setAvailability(
          availabilityData ?? []
        );
      }
    } catch (err) {
      console.error(
        "Unexpected mentor profile error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading the mentor."
      );

      setMentor(null);
    } finally {
      setLoading(false);
    }
  }, [mentorId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMentor();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMentor]);

  const handleBookSession = () => {
    if (!mentor) return;

    router.push(
      `/mentors/${mentor.id}/book`
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Link
            href="/mentors"
            className="text-sm text-slate-400 hover:text-cyan-400"
          >
            ← Back to Mentors
          </Link>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

            <p className="mt-4 text-slate-400">
              Loading mentor profile...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !mentor) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link
            href="/mentors"
            className="text-sm text-slate-400 hover:text-cyan-400"
          >
            ← Back to Mentors
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-8">
            <h1 className="text-2xl font-bold text-red-400">
              Mentor not available
            </h1>

            <p className="mt-2 text-slate-300">
              {error ||
                "This mentor could not be found or is no longer available."}
            </p>

            <Link
              href="/mentors"
              className="mt-6 inline-block rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Browse Mentors
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const rating =
    mentor.average_rating !== null
      ? Number(mentor.average_rating).toFixed(1)
      : "New";

  const currency =
    mentor.currency || "INR";

  const price =
    mentor.session_price !== null
      ? Number(mentor.session_price).toLocaleString(
          "en-IN"
        )
      : "Contact mentor";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVIGATION */}
      <nav className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-cyan-400"
          >
            Vertex
          </Link>

          <div className="hidden items-center gap-6 text-sm md:flex">
            <Link
              href="/roadmap"
              className="text-slate-400 transition hover:text-white"
            >
              Roadmap
            </Link>

            <Link
              href="/dsa"
              className="text-slate-400 transition hover:text-white"
            >
              DSA
            </Link>

            <Link
              href="/projects"
              className="text-slate-400 transition hover:text-white"
            >
              Projects
            </Link>

            <Link
              href="/ai-tutor"
              className="text-slate-400 transition hover:text-white"
            >
              AI Tutor
            </Link>

            <Link
              href="/pods"
              className="text-slate-400 transition hover:text-white"
            >
              Pods
            </Link>

            <Link
              href="/mentor"
              className="text-slate-400 transition hover:text-white"
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

      {/* PAGE */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/mentors"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-400"
        >
          ← Back to Mentors
        </Link>

        {/* PROFILE HEADER */}
        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          <div className="h-32 bg-linear-to-r from-cyan-500/20 via-blue-500/10 to-purple-500/20" />

          <div className="px-6 pb-8 md:px-10">
            <div className="-mt-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-5 md:flex-row md:items-end">
                {/* AVATAR */}
                {mentor.profile_photo_url ? (
                  <Image
                    src={mentor.profile_photo_url}
                    alt={mentor.full_name}
                    width={112}
                    height={112}
                    className="h-28 w-28 rounded-3xl border-4 border-slate-900 object-cover shadow-xl"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-slate-900 bg-cyan-500 text-4xl font-bold text-slate-950 shadow-xl">
                    {mentor.full_name
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold">
                      {mentor.full_name}
                    </h1>

                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-400">
                      ✓ Verified
                    </span>
                  </div>

                  <p className="mt-2 text-lg text-slate-300">
                    {mentor.job_role ||
                      "Experienced Professional"}
                  </p>

                  {mentor.current_company && (
                    <p className="mt-1 text-slate-400">
                      {mentor.current_company}
                    </p>
                  )}
                </div>
              </div>

              {/* BOOK BUTTON */}
              <button
                onClick={handleBookSession}
                className="rounded-xl bg-cyan-500 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-400"
              >
                Book a Session →
              </button>
            </div>
          </div>
        </section>

        {/* QUICK STATS */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-500">
              Experience
            </p>
            <p className="mt-2 text-2xl font-bold">
              {mentor.years_experience ?? 0}{" "}
              {mentor.years_experience === 1
                ? "year"
                : "years"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-500">
              Rating
            </p>
            <p className="mt-2 text-2xl font-bold">
              ★ {rating}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {mentor.total_reviews} reviews
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-500">
              Sessions
            </p>
            <p className="mt-2 text-2xl font-bold">
              {mentor.total_sessions}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-500">
              Starting price
            </p>
            <p className="mt-2 text-2xl font-bold text-cyan-400">
              {currency === "INR"
                ? "₹"
                : currency}{" "}
              {price}
            </p>
          </div>
        </section>

        {/* MAIN CONTENT */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* LEFT */}
          <div className="space-y-6 lg:col-span-2">
            {/* ABOUT */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">
                About the Mentor
              </h2>

              <p className="mt-4 whitespace-pre-line leading-7 text-slate-300">
                {mentor.bio ||
                  "This mentor has not added a bio yet."}
              </p>
            </section>

            {/* PROFESSIONAL DETAILS */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">
                Professional Background
              </h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-500">
                    Current Company
                  </p>
                  <p className="mt-1 font-medium">
                    {mentor.current_company ||
                      "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Role
                  </p>
                  <p className="mt-1 font-medium">
                    {mentor.job_role ||
                      "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    College
                  </p>
                  <p className="mt-1 font-medium">
                    {mentor.college ||
                      "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Branch
                  </p>
                  <p className="mt-1 font-medium">
                    {mentor.branch ||
                      "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Graduation Year
                  </p>
                  <p className="mt-1 font-medium">
                    {mentor.graduation_year ||
                      "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Experience
                  </p>
                  <p className="mt-1 font-medium">
                    {mentor.years_experience ??
                      0}{" "}
                    years
                  </p>
                </div>
              </div>
            </section>

            {/* SKILLS */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">
                Skills & Expertise
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {(mentor.skills ?? []).length > 0 ? (
                  mentor.skills!.map(
                    (skill, index) => (
                      <span
                        key={`${skill}-${index}`}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                      >
                        {skill}
                      </span>
                    )
                  )
                ) : (
                  <p className="text-slate-500">
                    No skills listed.
                  </p>
                )}
              </div>
            </section>

            {/* TARGET ROLES */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">
                Students I Can Help
              </h2>

              <div className="mt-4">
                <p className="mb-3 text-sm text-slate-500">
                  Target roles
                </p>

                <div className="flex flex-wrap gap-2">
                  {(mentor.target_roles ?? [])
                    .length > 0 ? (
                    mentor.target_roles!.map(
                      (role, index) => (
                        <span
                          key={`${role}-${index}`}
                          className="rounded-lg bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300"
                        >
                          {role}
                        </span>
                      )
                    )
                  ) : (
                    <p className="text-slate-500">
                      No target roles listed.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm text-slate-500">
                  Company types
                </p>

                <div className="flex flex-wrap gap-2">
                  {(mentor.company_tiers ?? [])
                    .length > 0 ? (
                    mentor.company_tiers!.map(
                      (tier, index) => (
                        <span
                          key={`${tier}-${index}`}
                          className="rounded-lg bg-purple-500/10 px-3 py-2 text-sm text-purple-300"
                        >
                          {tier}
                        </span>
                      )
                    )
                  ) : (
                    <p className="text-slate-500">
                      No company types listed.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">
            {/* BOOK CARD */}
            <section className="rounded-2xl border border-cyan-500/20 bg-slate-900 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  Book a Session
                </h2>

                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                  ● Available
                </span>
              </div>

              <div className="mt-6 rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-500">
                  Session price
                </p>

                <p className="mt-1 text-3xl font-bold text-cyan-400">
                  {currency === "INR"
                    ? "₹"
                    : currency}{" "}
                  {price}
                </p>
              </div>

              <button
                onClick={handleBookSession}
                className="mt-5 w-full rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Choose Date & Time
              </button>

              <p className="mt-3 text-center text-xs text-slate-500">
                Secure booking through Vertex
              </p>
            </section>

            {/* AVAILABILITY */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">
                Availability
              </h2>

              {availability.length === 0 ? (
                <div className="mt-5 rounded-xl bg-slate-950 p-4">
                  <p className="text-sm text-slate-400">
                    No availability schedule has
                    been added yet.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {availability.map(
                    (slot) => (
                      <div
                        key={slot.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">
                            {dayNames[
                              slot.day_of_week
                            ] ?? "Day"}
                          </span>

                          <span className="text-sm text-cyan-400">
                            {formatTime(
                              slot.start_time
                            )}{" "}
                            –{" "}
                            {formatTime(
                              slot.end_time
                            )}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {slot.timezone ||
                            "Asia/Kolkata"}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            {/* SOCIAL LINKS */}
            {(mentor.linkedin_url ||
              mentor.github_url) && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-bold">
                  Connect
                </h2>

                <div className="mt-4 space-y-3">
                  {mentor.linkedin_url && (
                    <a
                      href={
                        mentor.linkedin_url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
                    >
                      🔗 LinkedIn →
                    </a>
                  )}

                  {mentor.github_url && (
                    <a
                      href={mentor.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
                    >
                      💻 GitHub →
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* TRUST */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">
                Why book through Vertex?
              </h2>

              <div className="mt-5 space-y-4 text-sm text-slate-300">
                <div className="flex gap-3">
                  <span className="text-emerald-400">
                    ✓
                  </span>
                  <span>
                    Mentor verification is reviewed
                    before appearing in the marketplace.
                  </span>
                </div>

                <div className="flex gap-3">
                  <span className="text-emerald-400">
                    ✓
                  </span>
                  <span>
                    Choose a session based on your
                    placement goals.
                  </span>
                </div>

                <div className="flex gap-3">
                  <span className="text-emerald-400">
                    ✓
                  </span>
                  <span>
                    Meet mentors through a dedicated
                    video session.
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* BOTTOM CTA */}
        <section className="mt-8 rounded-3xl border border-cyan-500/20 bg-linear-to-r from-cyan-500/10 to-blue-500/10 p-8 text-center">
          <h2 className="text-2xl font-bold">
            Ready to learn from{" "}
            {mentor.full_name}?
          </h2>

          <p className="mx-auto mt-2 max-w-2xl text-slate-400">
            Book a personalized session and get
            guidance for your placement journey.
          </p>

          <button
            onClick={handleBookSession}
            className="mt-6 rounded-xl bg-cyan-500 px-7 py-3 font-bold text-slate-950 transition hover:bg-cyan-400"
          >
            Book Session →
          </button>
        </section>
      </div>
    </main>
  );
}