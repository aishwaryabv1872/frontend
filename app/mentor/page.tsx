"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type MentorForm = {
  full_name: string;
  college: string;
  branch: string;
  graduation_year: string;
  current_company: string;
  job_role: string;
  bio: string;
  skills: string;
  years_experience: string;
  target_roles: string;
  company_tiers: string;
  linkedin_url: string;
  github_url: string;
  session_price: string;
};

const initialForm: MentorForm = {
  full_name: "",
  college: "",
  branch: "",
  graduation_year: "",
  current_company: "",
  job_role: "",
  bio: "",
  skills: "",
  years_experience: "0",
  target_roles: "",
  company_tiers: "",
  linkedin_url: "",
  github_url: "",
  session_price: "0",
};

const days = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export default function MentorPage() {
  const [form, setForm] = useState<MentorForm>(initialForm);

  const [availability, setAvailability] = useState<AvailabilityRow[]>([
    {
      day_of_week: 6,
      start_time: "18:00",
      end_time: "19:00",
    },
  ]);

  const [mentorId, setMentorId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadMentorProfile();
  }, []);

  async function loadMentorProfile() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in to create your mentor profile.");
        return;
      }

      const { data: mentor, error: mentorError } = await supabase
        .from("mentors")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (mentorError) {
        throw mentorError;
      }

      if (!mentor) {
        return;
      }

      const mentorRecord = mentor as unknown as {
        id: string;
        full_name?: string | null;
        college?: string | null;
        branch?: string | null;
        graduation_year?: number | string | null;
        current_company?: string | null;
        job_role?: string | null;
        bio?: string | null;
        skills?: unknown;
        years_experience?: number | string | null;
        target_roles?: unknown;
        company_tiers?: unknown;
        linkedin_url?: string | null;
        github_url?: string | null;
        session_price?: number | string | null;
      };
      const currentMentorId = mentorRecord.id;
      setMentorId(currentMentorId);

      setForm({
        full_name: mentorRecord.full_name ?? "",
        college: mentorRecord.college ?? "",
        branch: mentorRecord.branch ?? "",
        graduation_year: mentorRecord.graduation_year
          ? String(mentorRecord.graduation_year)
          : "",
        current_company: mentorRecord.current_company ?? "",
        job_role: mentorRecord.job_role ?? "",
        bio: mentorRecord.bio ?? "",
        skills: Array.isArray(mentorRecord.skills)
          ? mentorRecord.skills.join(", ")
          : "",
        years_experience:
          mentorRecord.years_experience !== null &&
          mentorRecord.years_experience !== undefined
            ? String(mentorRecord.years_experience)
            : "0",
        target_roles: Array.isArray(mentorRecord.target_roles)
          ? mentorRecord.target_roles.join(", ")
          : "",
        company_tiers: Array.isArray(mentorRecord.company_tiers)
          ? mentorRecord.company_tiers.join(", ")
          : "",
        linkedin_url: mentorRecord.linkedin_url ?? "",
        github_url: mentorRecord.github_url ?? "",
        session_price:
          mentorRecord.session_price !== null &&
          mentorRecord.session_price !== undefined
            ? String(mentorRecord.session_price)
            : "0",
      });

      const { data: availabilityData, error: availabilityError } =
        await supabase
          .from("mentor_availability")
          .select("day_of_week,start_time,end_time")
          .eq("mentor_id", currentMentorId)
          .eq("is_active", true)
          .order("day_of_week");

      if (availabilityError) {
        throw availabilityError;
      }

      const availabilityRows: Array<{
        day_of_week: number;
        start_time?: string | null;
        end_time?: string | null;
      }> = availabilityData ?? [];

      if (availabilityRows.length > 0) {
        setAvailability(
          availabilityRows.map((item) => ({
            day_of_week: item.day_of_week,
            start_time: item.start_time?.slice(0, 5) ?? "18:00",
            end_time: item.end_time?.slice(0, 5) ?? "19:00",
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load mentor profile:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load mentor profile."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(
    field: keyof MentorForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function addAvailability() {
    setAvailability((previous) => [
      ...previous,
      {
        day_of_week: 6,
        start_time: "18:00",
        end_time: "19:00",
      },
    ]);
  }

  function removeAvailability(index: number) {
    setAvailability((previous) =>
      previous.filter((_, i) => i !== index)
    );
  }

  function updateAvailability(
    index: number,
    field: keyof AvailabilityRow,
    value: string | number
  ) {
    setAvailability((previous) =>
      previous.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function convertToArray(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!form.full_name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!form.current_company.trim()) {
      setError("Please enter your current company.");
      return;
    }

    if (!form.job_role.trim()) {
      setError("Please enter your current job role.");
      return;
    }

    if (!form.bio.trim()) {
      setError("Please add a short mentor bio.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to become a mentor.");
      }

      const mentorPayload = {
        user_id: user.id,

        full_name: form.full_name.trim(),
        college: form.college.trim() || null,
        branch: form.branch.trim() || null,

        graduation_year: form.graduation_year
          ? Number(form.graduation_year)
          : null,

        current_company: form.current_company.trim(),
        job_role: form.job_role.trim(),

        bio: form.bio.trim(),

        skills: convertToArray(form.skills),

        years_experience: form.years_experience
          ? Number(form.years_experience)
          : 0,

        target_roles: convertToArray(form.target_roles),
        company_tiers: convertToArray(form.company_tiers),

        linkedin_url: form.linkedin_url.trim() || null,
        github_url: form.github_url.trim() || null,

        session_price: form.session_price
          ? Number(form.session_price)
          : 0,

        currency: "INR",

        is_available: true,

        verification_status: "pending",
      };

      let savedMentor: { id: string };

      if (mentorId) {
        const { data, error: updateError } = await supabase
          .from("mentors")
          .update(mentorPayload as never)
          .eq("id", mentorId)
          .eq("user_id", user.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        savedMentor = data;
      } else {
        const { data, error: insertError } = await supabase
          .from("mentors")
          .insert(mentorPayload as never)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        savedMentor = data;
        setMentorId(savedMentor.id);
      }

      /*
       * Replace existing availability.
       */
      const { error: deleteAvailabilityError } =
        await supabase
          .from("mentor_availability")
          .delete()
          .eq("mentor_id", savedMentor.id);

      if (deleteAvailabilityError) {
        throw deleteAvailabilityError;
      }

      /*
       * Insert availability rows.
       */
      if (availability.length > 0) {
        const availabilityPayload = availability.map(
          (item) => ({
            mentor_id: savedMentor.id,
            day_of_week: item.day_of_week,
            start_time: item.start_time,
            end_time: item.end_time,
            timezone: "Asia/Kolkata",
            is_active: true,
          })
        );

        const { error: availabilityInsertError } =
          await supabase
            .from("mentor_availability")
            .insert(availabilityPayload as never[]);

        if (availabilityInsertError) {
          throw availabilityInsertError;
        }
      }

      setMessage(
        "Mentor profile saved successfully! Your profile is now pending verification."
      );

      await loadMentorProfile();
    } catch (err) {
      console.error("Failed to save mentor profile:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save mentor profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎓</div>
          <p className="text-slate-400">
            Loading mentor profile...
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
            <span className="text-cyan-400">Vertex</span>
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
              Become a Mentor
            </Link>
          </div>

          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Back
          </Link>
        </div>
      </nav>

      {/* HEADER */}
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-8">
        <div className="mb-3 text-cyan-400 text-sm font-semibold uppercase tracking-wider">
          Vertex Mentor Marketplace
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Become a Mentor 🎓
        </h1>

        <p className="text-slate-400 max-w-3xl text-lg leading-relaxed">
          Share your industry experience with students preparing
          for placements. Create your mentor profile, choose your
          availability, and help students through focused
          one-to-one sessions.
        </p>
      </section>

      {/* MAIN */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <form
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          {/* STATUS */}
          {message && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
              <div className="font-semibold mb-1">
                ✓ Profile Saved
              </div>

              <div className="text-sm">
                {message}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              <div className="font-semibold mb-1">
                Something went wrong
              </div>

              <div className="text-sm wrap-break-word">
                {error}
              </div>
            </div>
          )}

          {/* BASIC INFORMATION */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Basic Information
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                Tell students who you are.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <InputField
                label="Full Name"
                required
                value={form.full_name}
                onChange={(value) =>
                  updateField("full_name", value)
                }
                placeholder="e.g. Rahul Sharma"
              />

              <InputField
                label="College / University"
                value={form.college}
                onChange={(value) =>
                  updateField("college", value)
                }
                placeholder="e.g. Jain College of Engineering"
              />

              <InputField
                label="Branch"
                value={form.branch}
                onChange={(value) =>
                  updateField("branch", value)
                }
                placeholder="e.g. Computer Science and Engineering"
              />

              <InputField
                label="Graduation Year"
                type="number"
                value={form.graduation_year}
                onChange={(value) =>
                  updateField("graduation_year", value)
                }
                placeholder="e.g. 2024"
              />
            </div>
          </div>

          {/* PROFESSIONAL INFORMATION */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Professional Information
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                Help students understand your industry
                background.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <InputField
                label="Current Company"
                required
                value={form.current_company}
                onChange={(value) =>
                  updateField("current_company", value)
                }
                placeholder="e.g. Infosys"
              />

              <InputField
                label="Current Job Role"
                required
                value={form.job_role}
                onChange={(value) =>
                  updateField("job_role", value)
                }
                placeholder="e.g. Software Engineer"
              />

              <InputField
                label="Years of Experience"
                type="number"
                value={form.years_experience}
                onChange={(value) =>
                  updateField("years_experience", value)
                }
                placeholder="e.g. 2"
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Mentor Bio <span className="text-cyan-400">*</span>
              </label>

              <textarea
                value={form.bio}
                onChange={(event) =>
                  updateField("bio", event.target.value)
                }
                placeholder="Tell students about your experience, career journey, and how you can help them..."
                rows={5}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 resize-none"
              />
            </div>
          </div>

          {/* SKILLS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Expertise & Target Students
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                Separate multiple values using commas.
              </p>
            </div>

            <div className="space-y-6">
              <InputField
                label="Skills"
                value={form.skills}
                onChange={(value) =>
                  updateField("skills", value)
                }
                placeholder="React, Next.js, Node.js, SQL, DSA"
              />

              <InputField
                label="Target Roles"
                value={form.target_roles}
                onChange={(value) =>
                  updateField("target_roles", value)
                }
                placeholder="Full Stack Developer, Software Engineer"
              />

              <InputField
                label="Company Tiers"
                value={form.company_tiers}
                onChange={(value) =>
                  updateField("company_tiers", value)
                }
                placeholder="Product-Based Company, Service-Based Company, Startup"
              />
            </div>
          </div>

          {/* LINKS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Professional Links
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                Optional links students can use to learn more
                about you.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <InputField
                label="LinkedIn URL"
                value={form.linkedin_url}
                onChange={(value) =>
                  updateField("linkedin_url", value)
                }
                placeholder="https://linkedin.com/in/your-profile"
              />

              <InputField
                label="GitHub URL"
                value={form.github_url}
                onChange={(value) =>
                  updateField("github_url", value)
                }
                placeholder="https://github.com/yourusername"
              />
            </div>
          </div>

          {/* SESSION PRICING */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Session Pricing
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                You can offer free or paid mentoring sessions.
              </p>
            </div>

            <div className="max-w-md">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Session Price
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  ₹
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.session_price}
                  onChange={(event) =>
                    updateField(
                      "session_price",
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-4 py-3 text-white placeholder-slate-600 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  placeholder="0"
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Enter 0 if you want to provide free mentoring.
              </p>
            </div>
          </div>

          {/* AVAILABILITY */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  Availability
                </h2>

                <p className="text-slate-400 text-sm mt-1">
                  Choose when students can request mentoring
                  sessions.
                </p>
              </div>

              <button
                type="button"
                onClick={addAvailability}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 transition"
              >
                + Add Time Slot
              </button>
            </div>

            <div className="space-y-4">
              {availability.map((slot, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Day
                      </label>

                      <select
                        value={slot.day_of_week}
                        onChange={(event) =>
                          updateAvailability(
                            index,
                            "day_of_week",
                            Number(event.target.value)
                          )
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                      >
                        {days.map((day) => (
                          <option
                            key={day.value}
                            value={day.value}
                          >
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Start Time
                      </label>

                      <input
                        type="time"
                        value={slot.start_time}
                        onChange={(event) =>
                          updateAvailability(
                            index,
                            "start_time",
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        End Time
                      </label>

                      <input
                        type="time"
                        value={slot.end_time}
                        onChange={(event) =>
                          updateAvailability(
                            index,
                            "end_time",
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeAvailability(index)
                      }
                      disabled={availability.length === 1}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 hover:bg-red-500/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Timezone: Asia/Kolkata (IST)
            </div>
          </div>

          {/* VERIFICATION NOTICE */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex gap-4">
              <div className="text-2xl">🛡️</div>

              <div>
                <h3 className="font-semibold text-amber-300">
                  Mentor Verification
                </h3>

                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  After submitting your mentor profile, your
                  verification status will be set to{" "}
                  <span className="text-amber-300 font-medium">
                    Pending
                  </span>
                  . Vertex will later verify your professional
                  background before making your profile visible
                  to students.
                </p>
              </div>
            </div>
          </div>

          {/* SUBMIT */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-sm text-slate-500">
              Your mentor profile will be saved securely in
              Vertex.
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto rounded-xl bg-cyan-400 px-8 py-3.5 font-semibold text-slate-950 hover:bg-cyan-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? "Saving Profile..."
                : mentorId
                ? "Update Mentor Profile"
                : "Create Mentor Profile"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}


/* ============================================================
   REUSABLE INPUT
   ============================================================ */

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-200 mb-2">
        {label}{" "}
        {required && (
          <span className="text-cyan-400">*</span>
        )}
      </label>

      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
      />
    </div>
  );
}