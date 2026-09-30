"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

// ============================================================
// AUTHENTICATED API HELPER
// ============================================================

const getAuthHeaders = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.access_token) {
    throw new Error(
      "Your session has expired. Please log in again."
    );
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
};

// ============================================================
// TYPES
// ============================================================

type Pod = {
  id: string;
  name: string;
  description: string | null;
  status:
    | "forming"
    | "active"
    | "completed"
    | "archived";
  max_members: number;
  target_role: string | null;
  skill_level: string | null;
  company_tier: string | null;
  timezone: string | null;
  preferred_checkin_day: string | null;
  preferred_checkin_time: string | null;
  next_checkin_at: string | null;
  video_room_url: string | null;
  branch: string | null;
  semester_number: number | null;
  created_at: string;
  updated_at: string;
};

type PodMember = {
  id: string;
  pod_id: string;
  user_id: string;
  role: "member" | "leader";
  status:
    | "invited"
    | "active"
    | "left"
    | "removed";
  branch: string | null;
  target_role: string | null;
  skill_level: string | null;
  company_tier: string | null;
  readiness_score: number;
  timezone: string | null;
  available_days: string[];
  preferred_checkin_time: string | null;
  joined_at: string;
  left_at: string | null;
};

type PodGoal = {
  id: string;
  pod_id: string;
  user_id: string;
  title: string;
  description: string | null;
  category:
    | "dsa"
    | "project"
    | "skills"
    | "resume"
    | "interview"
    | "aptitude"
    | "general";
  week_start: string;
  week_end: string;
  status:
    | "pending"
    | "in_progress"
    | "completed"
    | "missed"
    | "cancelled";
  target_value: number | null;
  current_value: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type PodStreak = {
  id?: string;
  user_id?: string;
  pod_id?: string;
  current_streak: number;
  longest_streak: number;
  last_completed_week: string | null;
  updated_at?: string;
};

type PodCheckin = {
  id: string;
  pod_id: string;
  scheduled_at: string;
  ended_at: string | null;
  status:
    | "scheduled"
    | "live"
    | "completed"
    | "cancelled";
  video_room_url: string | null;
  meeting_notes: string | null;
  created_by: string | null;
  created_at: string;
};

type PodAttendance = {
  id: string;
  checkin_id: string;
  pod_id: string;
  user_id: string;
  attended: boolean;
  joined_at: string | null;
  left_at: string | null;
  note: string | null;
  created_at: string;
};

// ============================================================
// PAGE
// ============================================================

export default function PodsPage() {
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [userId, setUserId] =
    useState<string | null>(null);

  const [pod, setPod] =
    useState<Pod | null>(null);

  const [members, setMembers] =
    useState<PodMember[]>([]);

  const [goals, setGoals] =
    useState<PodGoal[]>([]);

  const [streak, setStreak] =
    useState<PodStreak | null>(null);

  const [checkins, setCheckins] =
    useState<PodCheckin[]>([]);

  const [attendance, setAttendance] =
    useState<PodAttendance[]>([]);

  const [matching, setMatching] =
    useState(false);

  const [generatingGoals, setGeneratingGoals] =
    useState(false);

  const [goalActionId, setGoalActionId] =
    useState<string | null>(null);

  const [schedulingCheckin, setSchedulingCheckin] =
    useState(false);

  const [checkinActionId, setCheckinActionId] =
    useState<string | null>(null);

  const [scheduleDate, setScheduleDate] =
    useState("");

  const [scheduleTime, setScheduleTime] =
    useState("18:00");

  // ==========================================================
  // LOAD STREAK
  // ==========================================================

  const loadStreak = useCallback(
    async (
      currentUserId: string,
      podId: string
    ) => {
      try {
        const response = await fetch(
  "/api/pods/streak",
  {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      podId,
    }),
  }
);

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load streak."
          );
        }

        const activeWeeks =
          data.activeWeeks ?? [];

        setStreak({
          current_streak:
            data.currentStreak ?? 0,

          longest_streak:
            data.longestStreak ?? 0,

          last_completed_week:
            activeWeeks.length > 0
              ? activeWeeks[
                  activeWeeks.length - 1
                ]
              : null,
        });
      } catch (err) {
        console.error(
          "Failed to load streak:",
          err
        );

        setStreak({
          current_streak: 0,
          longest_streak: 0,
          last_completed_week: null,
        });
      }
    },
    []
  );

  // ==========================================================
  // LOAD POD DATA
  // ==========================================================

  const loadPodData = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setError(
            "Please log in to access your accountability pod."
          );
          return;
        }

        setUserId(user.id);

        // ======================================================
        // REFRESH POD READINESS
        // ======================================================

        try {
          /*
            SECURITY:

            The readiness API no longer accepts userId
            from the request body.

            We send the authenticated Supabase access
            token instead. The server verifies the token
            and gets the user ID directly from Supabase Auth.
          */

          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) {
            throw sessionError;
          }

          if (!session?.access_token) {
            throw new Error(
              "Your session has expired. Please log in again."
            );
          }

          const readinessResponse =
            await fetch(
              "/api/pods/readiness",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Authorization:
                    `Bearer ${session.access_token}`,
                },

                /*
                  IMPORTANT:

                  Do NOT send userId here.

                  The API gets the authenticated user ID
                  from the verified access token.
                */
                body: JSON.stringify({}),
              }
            );

          const readinessData =
            await readinessResponse.json();

          if (!readinessResponse.ok) {
            console.error(
              "Failed to refresh pod readiness:",
              readinessData.error
            );
          } else {
            console.log(
              "Pod readiness refreshed:",
              readinessData.readinessScore
            );
          }
        } catch (readinessError) {
          console.error(
            "Pod readiness refresh error:",
            readinessError
          );
        }

        // ======================================================
        // MEMBERSHIP
        // ======================================================

        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from("pod_members")
          .select("*")
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "status",
            "active"
          )
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        // No pod yet.
        if (!membership) {
          setPod(null);
          setMembers([]);
          setGoals([]);
          setCheckins([]);
          setAttendance([]);
          setStreak(null);
          return;
        }

        const activeMembership =
          membership as PodMember;

        // ======================================================
        // POD
        // ======================================================

        const {
          data: podData,
          error: podError,
        } = await supabase
          .from(
            "accountability_pods"
          )
          .select("*")
          .eq(
            "id",
            activeMembership.pod_id
          )
          .single();

        if (podError) {
          throw podError;
        }

        setPod(podData as Pod);

        // ======================================================
        // MEMBERS
        // ======================================================

        const {
          data: memberData,
          error: membersError,
        } = await supabase
          .from("pod_members")
          .select("*")
          .eq(
            "pod_id",
            activeMembership.pod_id
          )
          .eq(
            "status",
            "active"
          )
          .order(
            "joined_at",
            {
              ascending: true,
            }
          );

        if (membersError) {
          throw membersError;
        }

        setMembers(
          (memberData ?? []) as PodMember[]
        );

        // ======================================================
        // GOALS
        // ======================================================

        const now = new Date();

        const day = now.getDay();

        const sunday =
          new Date(now);

        sunday.setDate(
          now.getDate() - day
        );

        const saturday =
          new Date(sunday);

        saturday.setDate(
          sunday.getDate() + 6
        );

        const currentWeekStart =
          sunday
            .toISOString()
            .slice(0, 10);

        const currentWeekEnd =
          saturday
            .toISOString()
            .slice(0, 10);

        const {
          data: goalData,
          error: goalsError,
        } =
          await supabase
            .from("pod_goals")
            .select("*")
            .eq(
              "pod_id",
              activeMembership.pod_id
            )
            .eq(
              "user_id",
              user.id
            )
            .eq(
              "week_start",
              currentWeekStart
            )
            .eq(
              "week_end",
              currentWeekEnd
            )
            .order(
              "created_at",
              {
                ascending: true,
              }
            );

        if (goalsError) {
          throw goalsError;
        }

        setGoals(
          (goalData ?? []) as PodGoal[]
        );

        // ======================================================
        // CHECK-INS
        // ======================================================

        const {
          data: checkinData,
          error: checkinError,
        } =
          await supabase
            .from("pod_checkins")
            .select("*")
            .eq(
              "pod_id",
              activeMembership.pod_id
            )
            .order(
              "scheduled_at",
              {
                ascending: true,
              }
            );

        if (checkinError) {
          throw checkinError;
        }

        setCheckins(
          (checkinData ?? []) as unknown as PodCheckin[]
        );

        // ======================================================
        // ATTENDANCE
        // ======================================================

        const {
          data: attendanceData,
          error: attendanceError,
        } =
          await supabase
            .from(
              "pod_checkin_attendance"
            )
            .select("*")
            .eq(
              "pod_id",
              activeMembership.pod_id
            )
            .eq(
              "user_id",
              user.id
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            );

        if (attendanceError) {
          throw attendanceError;
        }

        setAttendance(
          (attendanceData ?? []) as unknown as PodAttendance[]
        );

        // ======================================================
        // STREAK
        // ======================================================

        await loadStreak(
          user.id,
          activeMembership.pod_id
        );
      } catch (err: unknown) {
        console.error(
          "Failed to load pod data:",
          err
        );

        setError(
          (err instanceof Error
            ? err.message
            : undefined) ||
            "Failed to load accountability pod."
        );
      } finally {
        setLoading(false);
      }
    },
    [loadStreak]
  );

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadPodData();
      }, 0);

    return () =>
      window.clearTimeout(
        timeoutId
      );
  }, [loadPodData]);

  // ==========================================================
  // MATCH POD
  // ==========================================================

  const matchPod = async () => {
    if (!userId) return;

    try {
      setMatching(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/pods/match",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              userId,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to find a pod."
        );
      }

      setMessage(
        data.message ||
          "You have been matched to an accountability pod! 🤝"
      );

      await loadPodData();
    } catch (err: unknown) {
      console.error(
        "Pod matching error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to match you with a pod."
      );
    } finally {
      setMatching(false);
    }
  };

  // ==========================================================
  // GENERATE WEEKLY GOALS
  // ==========================================================

  const generateGoals = async () => {
    if (!userId) return;

    try {
      setGeneratingGoals(true);
      setError("");
      setMessage("");

      const response =
  await fetch(
    "/api/pods/goals",
    {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        action: "generate",
      }),
    }
  );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to generate weekly goals."
        );
      }

      setMessage(
        data.message ||
          "Weekly goals generated successfully! 🎯"
      );

      await loadPodData();
    } catch (err: unknown) {
      console.error(
        "Goal generation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate weekly goals."
      );
    } finally {
      setGeneratingGoals(false);
    }
  };

  // ==========================================================
  // UPDATE GOAL PROGRESS
  // ==========================================================

  const updateGoalProgress = async (
    goal: PodGoal,
    progressValue: number
  ) => {
    if (!userId) return;

    try {
      setGoalActionId(
        goal.id
      );

      setError("");
      setMessage("");

      const response =
  await fetch(
    "/api/pods/goals",
    {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        action: "checkin",
        goalId: goal.id,
        progressValue,
        note:
          progressValue >=
          (goal.target_value ?? 1)
            ? "Goal completed."
            : "Progress updated.",
      }),
    }
  );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update goal."
        );
      }

      setMessage(
        progressValue >=
          (goal.target_value ?? 1)
          ? "Goal completed! 🎉"
          : "Goal progress updated! 📈"
      );

      await loadPodData();
    } catch (err: unknown) {
      console.error(
        "Goal update error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update goal progress."
      );
    } finally {
      setGoalActionId(null);
    }
  };

  // ==========================================================
  // SCHEDULE CHECK-IN
  // ==========================================================

  const scheduleCheckin =
    async () => {
      if (!userId || !pod) return;

      if (
        !scheduleDate ||
        !scheduleTime
      ) {
        setError(
          "Please select a date and time."
        );
        return;
      }

      try {
        setSchedulingCheckin(
          true
        );

        setError("");
        setMessage("");

        const scheduledAt =
          new Date(
            `${scheduleDate}T${scheduleTime}`
          ).toISOString();

        const response =
  await fetch(
    "/api/pods/checkin",
    {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        action: "schedule",
        podId: pod.id,
        scheduledAt,
      }),
    }
  );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to schedule group check-in."
          );
        }

        setMessage(
          "Group check-in scheduled successfully! 📅"
        );

        setScheduleDate("");
        setScheduleTime(
          "18:00"
        );

        await loadPodData();
      } catch (err: unknown) {
        console.error(
          "Schedule check-in error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to schedule group check-in."
        );
      } finally {
        setSchedulingCheckin(
          false
        );
      }
    };

  // ==========================================================
  // START / END / CANCEL CHECK-IN
  // ==========================================================

  const performCheckinAction =
    async (
      checkinId: string,
      action:
        | "start"
        | "end"
        | "cancel"
    ) => {
      if (!userId || !pod) return;

      try {
        setCheckinActionId(
          checkinId
        );

        setError("");
        setMessage("");

        const response =
  await fetch(
    "/api/pods/checkin",
    {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        action,
        podId: pod.id,
        checkinId,
        meetingNotes:
          action === "end"
            ? "Meeting completed successfully."
            : undefined,
      }),
    }
  );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              `Failed to ${action} meeting.`
          );
        }

        if (
          action === "start"
        ) {
          setMessage(
            "Group check-in started! ▶️"
          );
        }

        if (
          action === "end"
        ) {
          setMessage(
            "Group check-in completed successfully! ✅"
          );
        }

        if (
          action === "cancel"
        ) {
          setMessage(
            "Group check-in cancelled."
          );
        }

        await loadPodData();
      } catch (err: unknown) {
        console.error(
          `${action} check-in error:`,
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : `Failed to ${action} meeting.`
        );
      } finally {
        setCheckinActionId(
          null
        );
      }
    };

  // ==========================================================
  // MARK ATTENDANCE
  // ==========================================================

  const markAttendance = async (
    checkinId: string
  ) => {
    if (!userId || !pod) return;

    try {
      setCheckinActionId(
        checkinId
      );

      setError("");
      setMessage("");

      const response =
  await fetch(
    "/api/pods/checkin",
    {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        action: "attendance",
        podId: pod.id,
        checkinId,
        attended: true,
      }),
    }
  );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to record attendance."
        );
      }

      setMessage(
        "Your attendance has been recorded! ✅"
      );

      await loadPodData();
    } catch (err: unknown) {
      console.error(
        "Attendance error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to record attendance."
      );
    } finally {
      setCheckinActionId(
        null
      );
    }
  };

  // ==========================================================
  // DERIVED DATA
  // ==========================================================

  const currentMember =
    useMemo(
      () =>
        members.find(
          (member) =>
            member.user_id ===
            userId
        ) ?? null,
      [members, userId]
    );

  const isLeader =
    currentMember?.role ===
    "leader";

  const upcomingCheckins =
    useMemo(() => {
      const now =
        new Date();

      return checkins
        .filter(
          (checkin) =>
            checkin.status ===
              "scheduled" ||
            checkin.status ===
              "live"
        )
        .filter(
          (checkin) =>
            new Date(
              checkin.scheduled_at
            ) >= now ||
            checkin.status ===
              "live"
        )
        .sort(
          (a, b) =>
            new Date(
              a.scheduled_at
            ).getTime() -
            new Date(
              b.scheduled_at
            ).getTime()
        );
    }, [checkins]);

  const nextCheckin =
    upcomingCheckins[0] ??
    null;

  const completedGoals =
    goals.filter(
      (goal) =>
        goal.status ===
          "completed" ||
        (goal.target_value !==
          null &&
          goal.current_value >=
            goal.target_value)
    ).length;

  const goalProgress =
    goals.length
      ? Math.round(
          (goals.reduce(
            (sum, goal) =>
              sum +
              Math.min(
                goal.current_value,
                goal.target_value ??
                  1
              ),
            0
          ) /
            goals.reduce(
              (sum, goal) =>
                sum +
                (goal.target_value ??
                  1),
              0
            )) *
            100
        )
      : 0;

  const readinessScore =
    currentMember?.readiness_score ??
    0;

  // ==========================================================
  // DATE HELPERS
  // ==========================================================

  const formatDate = (
    dateString: string | null
  ) => {
    if (!dateString) {
      return "Not scheduled";
    }

    return new Date(
      dateString
    ).toLocaleDateString(
      "en-IN",
      {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  };

  const formatDateTime = (
    dateString: string | null
  ) => {
    if (!dateString) {
      return "Not scheduled";
    }

    return new Date(
      dateString
    ).toLocaleString(
      "en-IN",
      {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  };

  const getGoalIcon = (
    category: string
  ) => {
    switch (category) {
      case "dsa":
        return "🧠";

      case "project":
        return "💻";

      case "skills":
        return "🛠️";

      case "resume":
        return "📄";

      case "interview":
        return "🎤";

      case "aptitude":
        return "📝";

      default:
        return "🎯";
    }
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="animate-pulse">
              <div className="h-4 w-48 rounded bg-slate-800" />

              <div className="mt-4 h-10 w-80 rounded bg-slate-800" />

              <div className="mt-4 h-5 w-lg max-w-full rounded bg-slate-800" />

              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({
                  length: 4,
                }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="h-32 rounded-2xl bg-slate-900"
                    />
                  )
                )}
              </div>

              <div className="mt-8 h-72 rounded-2xl bg-slate-900" />
            </div>
          </div>
        </main>
      </>
    );
  }

  // ==========================================================
  // NO POD
  // ==========================================================

  if (!pod) {
    return (
      <>
        <Navbar />

        <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
                Vertex Accountability
              </p>

              <div className="mt-6 text-6xl">
                🤝
              </div>

              <h1 className="mt-5 text-4xl font-bold">
                Accountability Pods
              </h1>

              <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                Stay consistent with a small group
                of students, set weekly goals,
                track your streak, and prepare
                together for placements.
              </p>
            </div>

            <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
              <div className="text-center">
                <div className="text-5xl">
                  🚀
                </div>

                <h2 className="mt-5 text-2xl font-bold">
                  You haven&apos;t joined a pod yet
                </h2>

                <p className="mx-auto mt-3 max-w-xl text-slate-400">
                  Vertex will match you using
                  your target role, skill level,
                  branch, semester, and company
                  preference.
                </p>

                {error && (
                  <div className="mx-auto mt-6 max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button
                  onClick={matchPod}
                  disabled={matching}
                  className="mt-7 rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {matching ? (
                    <>
                      <span className="mr-2 inline-block animate-spin">
                        ⟳
                      </span>

                      Finding Your Pod...
                    </>
                  ) : (
                    <>
                      🚀 Find My Pod
                    </>
                  )}
                </button>

                {message && (
                  <div className="mx-auto mt-5 max-w-xl rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ==========================================================
  // MAIN PAGE
  // ==========================================================

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">

          {/* ==================================================
              HEADER
          ================================================== */}

          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
                Vertex Accountability
              </p>

              <h1 className="mt-2 text-4xl font-bold sm:text-5xl">
                {pod.name}
              </h1>

              <p className="mt-3 max-w-2xl text-slate-400">
                {pod.description ||
                  "Stay accountable, work toward your placement goals, and grow together."}
              </p>
            </div>

            <span className="w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
              ● {pod.status}
            </span>
          </div>

          {/* ==================================================
              ALERTS
          ================================================== */}

          {message && (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* ==================================================
              SUMMARY CARDS
          ================================================== */}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* MEMBERS */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">
                👥 Pod Members
              </p>

              <p className="mt-2 text-3xl font-bold">
                {
                  members.filter(
                    (member) =>
                      member.status ===
                      "active"
                  ).length
                }

                <span className="text-lg text-slate-500">
                  /{pod.max_members}
                </span>
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Active accountability team
              </p>
            </div>

            {/* GOALS */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">
                🎯 Weekly Goals
              </p>

              <p className="mt-2 text-3xl font-bold">
                {completedGoals}

                <span className="text-lg text-slate-500">
                  /{goals.length}
                </span>
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Goals completed
              </p>
            </div>

            {/* STREAK */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">
                🔥 Current Streak
              </p>

              <p className="mt-2 text-3xl font-bold">
                {streak?.current_streak ??
                  0}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                weeks
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Longest:{" "}
                {streak?.longest_streak ??
                  0}{" "}
                weeks
              </p>
            </div>

            {/* GOAL PROGRESS */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">
                📈 Goal Progress
              </p>

              <p className="mt-2 text-3xl font-bold">
                {goalProgress}%
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{
                    width: `${goalProgress}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* ==================================================
              MEMBERS + QUICK CHECK-IN
          ================================================== */}

          <div className="mt-8 grid gap-6 lg:grid-cols-3">

            {/* MEMBERS */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
              <div>
                <h2 className="text-xl font-bold">
                  👥 Pod Members
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Your placement accountability team
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {members.map(
                  (
                    member,
                    index
                  ) => {
                    const isCurrentUser =
                      member.user_id ===
                      userId;

                    return (
                      <div
                        key={
                          member.id
                        }
                        className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-800 font-bold text-slate-200">
                              {index +
                                1}
                            </div>

                            <div>
                              <p className="font-semibold">
                                {isCurrentUser
                                  ? "You"
                                  : `Pod Member ${
                                      index +
                                      1
                                    }`}
                              </p>

                              <p className="text-xs text-slate-500">
                                {member.target_role ||
                                  "Placement preparation"}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            {member.role ===
                              "leader" && (
                              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                                Leader
                              </span>
                            )}

                            <p className="mt-2 text-xs text-slate-500">
                              Readiness{" "}
                              {Number(
                                member.readiness_score ??
                                  0
                              ).toFixed(
                                0
                              )}
                              %
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-cyan-400 transition-all"
                            style={{
                              width: `${Math.min(
                                Number(
                                  member.readiness_score ??
                                    0
                                ),
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}

                {members.length ===
                  0 && (
                  <p className="text-sm text-slate-500">
                    No members found.
                  </p>
                )}
              </div>
            </section>

            {/* QUICK CHECK-IN */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">
                📅 Group Check-in
              </h2>

              {nextCheckin ? (
                <>
                  <p className="mt-5 text-sm text-slate-400">
                    Next session
                  </p>

                  <p className="mt-2 font-semibold">
                    {formatDateTime(
                      nextCheckin.scheduled_at
                    )}
                  </p>

                  <span className="mt-3 inline-block rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                    {
                      nextCheckin.status
                    }
                  </span>

                  {nextCheckin.video_room_url && (
                    <button
                      onClick={() => {
                        void markAttendance(
                          nextCheckin.id
                        );

                        window.open(
                          nextCheckin.video_room_url!,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                      disabled={
                        checkinActionId ===
                        nextCheckin.id
                      }
                      className="mt-6 block w-full rounded-xl bg-cyan-400 px-4 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      🎥 Join Check-in
                    </button>
                  )}

                  {isLeader &&
                    nextCheckin.status ===
                      "scheduled" && (
                      <button
                        onClick={() =>
                          performCheckinAction(
                            nextCheckin.id,
                            "start"
                          )
                        }
                        disabled={
                          checkinActionId ===
                          nextCheckin.id
                        }
                        className="mt-3 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        ▶ Start Meeting
                      </button>
                    )}

                  {isLeader &&
                    nextCheckin.status ===
                      "live" && (
                      <button
                        onClick={() =>
                          performCheckinAction(
                            nextCheckin.id,
                            "end"
                          )
                        }
                        disabled={
                          checkinActionId ===
                          nextCheckin.id
                        }
                        className="mt-3 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        ■ End Meeting
                      </button>
                    )}

                  {isLeader &&
                    nextCheckin.status !==
                      "completed" && (
                      <button
                        onClick={() =>
                          performCheckinAction(
                            nextCheckin.id,
                            "cancel"
                          )
                        }
                        disabled={
                          checkinActionId ===
                          nextCheckin.id
                        }
                        className="mt-3 w-full rounded-xl border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Cancel Meeting
                      </button>
                    )}
                </>
              ) : (
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <p className="text-sm text-slate-400">
                    No upcoming group check-in
                    has been scheduled yet.
                  </p>

                  {pod.preferred_checkin_day && (
                    <p className="mt-4 text-sm text-slate-400">
                      Preferred day:{" "}
                      <span className="font-semibold text-white">
                        {
                          pod.preferred_checkin_day
                        }
                      </span>
                    </p>
                  )}

                  {pod.preferred_checkin_time && (
                    <p className="mt-1 text-sm text-slate-500">
                      Preferred time:{" "}
                      {
                        pod.preferred_checkin_time
                      }
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ==================================================
              GROUP CHECK-IN MANAGEMENT
          ================================================== */}

          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div>
              <h2 className="text-xl font-bold">
                📅 Group Check-in Management
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Schedule meetings, join sessions,
                and track your pod&apos;s activity.
              </p>
            </div>

            {/* LEADER SCHEDULING */}

            {isLeader && (
              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">
                    👑
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Pod Leader Controls
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Schedule a new group check-in.
                      A Jitsi meeting room will be
                      created automatically.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Date
                    </label>

                    <input
                      type="date"
                      value={
                        scheduleDate
                      }
                      onChange={(
                        event
                      ) =>
                        setScheduleDate(
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Time
                    </label>

                    <input
                      type="time"
                      value={
                        scheduleTime
                      }
                      onChange={(
                        event
                      ) =>
                        setScheduleTime(
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={
                        scheduleCheckin
                      }
                      disabled={
                        schedulingCheckin
                      }
                      className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {schedulingCheckin
                        ? "Scheduling..."
                        : "📅 Schedule Check-in"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MEETING HISTORY */}

            <div className="mt-8 border-t border-slate-800 pt-8">
              <h3 className="text-lg font-bold">
                Meeting History
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Upcoming and previous pod meetings
              </p>

              {checkins.length ===
              0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-sm text-slate-500">
                  📅 No meetings scheduled yet.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {[...checkins]
                    .sort(
                      (a, b) =>
                        new Date(
                          b.scheduled_at
                        ).getTime() -
                        new Date(
                          a.scheduled_at
                        ).getTime()
                    )
                    .map(
                      (
                        checkin
                      ) => (
                        <div
                          key={
                            checkin.id
                          }
                          className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold">
                                {formatDateTime(
                                  checkin.scheduled_at
                                )}
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                {checkin.status
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase() +
                                  checkin.status.slice(
                                    1
                                  )}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {checkin.video_room_url &&
                                checkin.status !==
                                  "cancelled" && (
                                  <button
                                    onClick={() => {
                                      void markAttendance(
                                        checkin.id
                                      );

                                      window.open(
                                        checkin.video_room_url!,
                                        "_blank",
                                        "noopener,noreferrer"
                                      );
                                    }}
                                    disabled={
                                      checkinActionId ===
                                      checkin.id
                                    }
                                    className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                                  >
                                    🎥 Join Meeting
                                  </button>
                                )}

                              {isLeader &&
                                checkin.status ===
                                  "scheduled" && (
                                  <button
                                    onClick={() =>
                                      performCheckinAction(
                                        checkin.id,
                                        "start"
                                      )
                                    }
                                    disabled={
                                      checkinActionId ===
                                      checkin.id
                                    }
                                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                                  >
                                    ▶ Start
                                  </button>
                                )}

                              {isLeader &&
                                checkin.status ===
                                  "live" && (
                                  <button
                                    onClick={() =>
                                      performCheckinAction(
                                        checkin.id,
                                        "end"
                                      )
                                    }
                                    disabled={
                                      checkinActionId ===
                                      checkin.id
                                    }
                                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                                  >
                                    ■ End
                                  </button>
                                )}

                              {isLeader &&
                                checkin.status !==
                                  "completed" &&
                                checkin.status !==
                                  "cancelled" && (
                                  <button
                                    onClick={() =>
                                      performCheckinAction(
                                        checkin.id,
                                        "cancel"
                                      )
                                    }
                                    disabled={
                                      checkinActionId ===
                                      checkin.id
                                    }
                                    className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                )}
                            </div>
                          </div>

                          {checkin.status ===
                            "completed" && (
                            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                              ✓ Meeting completed
                              successfully.
                            </div>
                          )}

                          {checkin.status ===
                            "cancelled" && (
                            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                              Meeting cancelled.
                            </div>
                          )}

                          {checkin.meeting_notes && (
                            <div className="mt-3 text-xs text-slate-500">
                              {
                                checkin.meeting_notes
                              }
                            </div>
                          )}
                        </div>
                      )
                    )}
                </div>
              )}
            </div>
          </section>

          {/* ==================================================
              ATTENDANCE
          ================================================== */}

          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold">
                  📋 Attendance
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Track your participation in pod check-ins.
                </p>
              </div>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
                <p className="text-xs text-slate-400">
                  Attendance Rate
                </p>

                <p className="mt-1 text-2xl font-bold text-cyan-300">
                  {checkins.filter(
                    (checkin) =>
                      checkin.status ===
                      "completed"
                  ).length > 0
                    ? Math.round(
                        (attendance.filter(
                          (item) =>
                            item.attended &&
                            checkins.some(
                              (checkin) =>
                                checkin.id ===
                                  item.checkin_id &&
                                checkin.status ===
                                  "completed"
                            )
                        ).length /
                          checkins.filter(
                            (checkin) =>
                              checkin.status ===
                              "completed"
                          ).length) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm text-slate-500">
                  Completed Meetings
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {
                    checkins.filter(
                      (checkin) =>
                        checkin.status ===
                        "completed"
                    ).length
                  }
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm text-slate-500">
                  Meetings Attended
                </p>

                <p className="mt-2 text-2xl font-bold text-emerald-300">
                  {
                    attendance.filter(
                      (item) =>
                        item.attended &&
                        checkins.some(
                          (checkin) =>
                            checkin.id ===
                              item.checkin_id &&
                            checkin.status ===
                              "completed"
                        )
                    ).length
                  }
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm text-slate-500">
                  Missed Meetings
                </p>

                <p className="mt-2 text-2xl font-bold text-red-300">
                  {Math.max(
                    checkins.filter(
                      (checkin) =>
                        checkin.status ===
                        "completed"
                    ).length -
                      attendance.filter(
                        (item) =>
                          item.attended &&
                          checkins.some(
                            (checkin) =>
                              checkin.id ===
                                item.checkin_id &&
                              checkin.status ===
                                "completed"
                          )
                      ).length,
                    0
                  )}
                </p>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-800 pt-8">
              <h3 className="text-lg font-bold">
                Attendance History
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Your attendance across completed pod meetings.
              </p>

              {checkins.filter(
                (checkin) =>
                  checkin.status ===
                  "completed"
              ).length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center">
                  <div className="text-3xl">
                    📅
                  </div>

                  <p className="mt-3 text-sm text-slate-500">
                    No completed meetings yet.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {checkins
                    .filter(
                      (checkin) =>
                        checkin.status ===
                        "completed"
                    )
                    .sort(
                      (a, b) =>
                        new Date(
                          b.scheduled_at
                        ).getTime() -
                        new Date(
                          a.scheduled_at
                        ).getTime()
                    )
                    .map(
                      (checkin) => {
                        const record =
                          attendance.find(
                            (item) =>
                              item.checkin_id ===
                              checkin.id
                          );

                        const attended =
                          record?.attended ===
                          true;

                        return (
                          <div
                            key={
                              checkin.id
                            }
                            className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-semibold">
                                  {formatDateTime(
                                    checkin.scheduled_at
                                  )}
                                </p>

                                {record?.joined_at && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Joined:{" "}
                                    {formatDateTime(
                                      record.joined_at
                                    )}
                                  </p>
                                )}
                              </div>

                              {attended ? (
                                <span className="inline-flex w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                                  ✓ Attended
                                </span>
                              ) : (
                                <span className="inline-flex w-fit rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300">
                                  ✕ Not Attended
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                </div>
              )}
            </div>
          </section>

          {/* ==================================================
              WEEKLY GOALS
          ================================================== */}

          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold">
                  🎯 Your Weekly Goals
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Stay consistent and keep your
                  pod updated.
                </p>
              </div>

              {goals.length === 0 && (
                <button
                  onClick={
                    generateGoals
                  }
                  disabled={
                    generatingGoals
                  }
                  className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                >
                  {generatingGoals
                    ? "Generating..."
                    : "🎯 Generate Weekly Goals"}
                </button>
              )}
            </div>

            {/* GOAL SUMMARY */}

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">
                  {completedGoals} of{" "}
                  {goals.length}{" "}
                  completed
                </span>

                <span className="text-slate-500">
                  {goalProgress}%
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{
                    width: `${goalProgress}%`,
                  }}
                />
              </div>
            </div>

            {/* GOALS */}

            {goals.length ===
            0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
                <div className="text-4xl">
                  🎯
                </div>

                <h3 className="mt-3 font-semibold">
                  No weekly goals yet
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Generate your goals to start
                  tracking your placement progress.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {goals.map(
                  (goal) => {
                    const target =
                      goal.target_value ??
                      1;

                    const progress =
                      Math.min(
                        Math.round(
                          (goal.current_value /
                            target) *
                            100
                        ),
                        100
                      );

                    const isComplete =
                      goal.status ===
                        "completed" ||
                      goal.current_value >=
                        target;

                    return (
                      <div
                        key={
                          goal.id
                        }
                        className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                      >
                        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                          <div className="flex gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-2xl">
                              {getGoalIcon(
                                goal.category
                              )}
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                                {
                                  goal.category
                                }
                              </p>

                              <h3
                                className={`mt-1 text-lg font-bold ${
                                  isComplete
                                    ? "text-slate-500 line-through"
                                    : "text-white"
                                }`}
                              >
                                {
                                  goal.title
                                }
                              </h3>

                              {goal.description && (
                                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                                  {
                                    goal.description
                                  }
                                </p>
                              )}

                              <p className="mt-3 text-xs text-slate-600">
                                {formatDate(
                                  goal.week_start
                                )}{" "}
                                →{" "}
                                {formatDate(
                                  goal.week_end
                                )}
                              </p>

                              <div className="mt-4 flex max-w-md items-center justify-between text-xs text-slate-500">
                                <span>
                                  Progress
                                </span>

                                <span>
                                  {
                                    goal.current_value
                                  }
                                  /
                                  {
                                    target
                                  }
                                </span>
                              </div>

                              <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-cyan-400 transition-all"
                                  style={{
                                    width: `${progress}%`,
                                  }}
                                />
                              </div>

                              <p className="mt-2 text-xs text-slate-500">
                                {
                                  progress
                                }%
                                complete
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isComplete ? (
                              <span className="inline-flex rounded-lg bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                                ✓ Completed
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  updateGoalProgress(
                                    goal,
                                    Math.min(
                                      goal.current_value +
                                        1,
                                      target
                                    )
                                  )
                                }
                                disabled={
                                  goalActionId ===
                                  goal.id
                                }
                                className="rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                              >
                                {goalActionId ===
                                goal.id
                                  ? "Updating..."
                                  : goal.current_value ===
                                        0 &&
                                      target ===
                                        1
                                    ? "Mark as completed ✓"
                                    : `+1 Progress (${goal.current_value}/${target})`}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          {/* ==================================================
              MATCHING PROFILE
          ================================================== */}

          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">
              🤝 Pod Matching Profile
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Information used to keep your
              accountability group aligned.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              {/* ROLE */}

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-500">
                  Target Role
                </p>

                <p className="mt-2 font-semibold">
                  {pod.target_role ||
                    "Not specified"}
                </p>
              </div>

              {/* SKILL */}

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-500">
                  Skill Level
                </p>

                <p className="mt-2 font-semibold">
                  {pod.skill_level ||
                    "Not specified"}
                </p>
              </div>

              {/* COMPANY */}

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-500">
                  Company Tier
                </p>

                <p className="mt-2 font-semibold">
                  {pod.company_tier ||
                    "Not specified"}
                </p>
              </div>

              {/* TIMEZONE */}

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-500">
                  Timezone
                </p>

                <p className="mt-2 font-semibold">
                  {pod.timezone ||
                    "Not specified"}
                </p>
              </div>

              {/* BRANCH */}

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-500">
                  Branch
                </p>

                <p className="mt-2 font-semibold">
                  {pod.branch ||
                    "Not specified"}
                </p>
              </div>

              {/* SEMESTER */}

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-500">
                  Semester
                </p>

                <p className="mt-2 font-semibold">
                  {pod.semester_number
                    ? `Semester ${pod.semester_number}`
                    : "Not specified"}
                </p>
              </div>

              {/* READINESS */}

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-500">
                  Your Readiness
                </p>

                <p className="mt-2 font-semibold">
                  {Number(
                    readinessScore
                  ).toFixed(0)}
                  %
                </p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{
                      width: `${Math.min(
                        Number(
                          readinessScore
                        ),
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* LONGEST STREAK */}

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-500">
                  Longest Streak
                </p>

                <p className="mt-2 font-semibold">
                  {streak?.longest_streak ??
                    0}{" "}
                  weeks
                </p>
              </div>
            </div>
          </section>

          {/* ==================================================
              NAVIGATION
          ================================================== */}

          <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-800 pt-8">
            <Link
              href="/roadmap"
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
            >
              ← Back to Roadmap
            </Link>

            <Link
              href="/dsa"
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
            >
              Practice DSA
            </Link>

            <Link
              href="/projects"
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
            >
              Projects
            </Link>

            <Link
              href="/ai-interview"
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
            >
              AI Interview
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}