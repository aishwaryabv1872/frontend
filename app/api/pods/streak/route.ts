import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/*
  Client used ONLY to verify the user's access token.
*/
const authClient = createClient(
  supabaseUrl,
  anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/*
  Privileged server-side database client.
  Never expose this client or service-role key to browser code.
*/
const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function authenticate(request: NextRequest) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return {
      user: null,
      response: NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      ),
    };
  }

  const tokenMatch =
    authorization.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return {
      user: null,
      response: NextResponse.json(
        {
          error:
            "Invalid authorization header.",
        },
        { status: 401 }
      ),
    };
  }

  const accessToken = tokenMatch[1];

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(
    accessToken
  );

  if (authError || !user) {
    console.error(
      "STREAK AUTH ERROR:",
      authError
    );

    return {
      user: null,
      response: NextResponse.json(
        {
          error:
            "Invalid or expired session.",
        },
        { status: 401 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff =
    day === 0 ? -6 : 1 - day;

  d.setDate(
    d.getDate() + diff
  );

  d.setHours(
    0,
    0,
    0,
    0
  );

  return d;
}

function dateKey(date: Date) {
  return date
    .toISOString()
    .slice(0, 10);
}

export async function POST(
  request: NextRequest
) {
  try {
    // =====================================================
    // 1. AUTHENTICATE USER
    // =====================================================

    const { user, response } =
      await authenticate(request);

    if (response || !user) {
      return response!;
    }

    /*
      SECURITY:
      Never trust userId from the request body.
      The authenticated Supabase user is the identity.
    */
    const userId = user.id;

    // =====================================================
    // 2. READ REQUEST BODY
    // =====================================================

    const body = await request.json();

    const { podId } = body;

    if (
      !podId ||
      typeof podId !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "podId is required.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 3. VERIFY ACTIVE POD MEMBERSHIP
    // =====================================================

    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from("pod_members")
      .select(
        "id, pod_id, role, status"
      )
      .eq("user_id", userId)
      .eq("pod_id", podId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      console.error(
        "STREAK MEMBERSHIP ERROR:",
        membershipError
      );

      return NextResponse.json(
        {
          error:
            "Failed to verify pod membership.",
        },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "You are not an active member of this pod.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 4. GET COMPLETED MEETINGS
    // =====================================================

    const {
      data: checkins,
      error: checkinsError,
    } = await supabaseAdmin
      .from("pod_checkins")
      .select(
        "id, scheduled_at, status"
      )
      .eq("pod_id", podId)
      .eq("status", "completed")
      .order("scheduled_at", {
        ascending: true,
      });

    if (checkinsError) {
      console.error(
        "STREAK CHECKINS ERROR:",
        checkinsError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load completed meetings.",
        },
        { status: 500 }
      );
    }

    if (
      !checkins ||
      checkins.length === 0
    ) {
      return NextResponse.json({
        currentStreak: 0,
        longestStreak: 0,
        activeWeeks: [],
      });
    }

    const checkinIds =
      checkins.map(
        (checkin) => checkin.id
      );

    // =====================================================
    // 5. GET AUTHENTICATED USER'S ATTENDANCE
    // =====================================================

    const {
      data: attendance,
      error: attendanceError,
    } = await supabaseAdmin
      .from(
        "pod_checkin_attendance"
      )
      .select(
        "checkin_id, attended, joined_at"
      )
      .eq("pod_id", podId)
      .eq("user_id", userId)
      .in(
        "checkin_id",
        checkinIds
      )
      .eq("attended", true);

    if (attendanceError) {
      console.error(
        "STREAK ATTENDANCE ERROR:",
        attendanceError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load attendance.",
        },
        { status: 500 }
      );
    }

    const attendedCheckinIds =
      new Set(
        (attendance ?? []).map(
          (item) =>
            item.checkin_id
        )
      );

    // =====================================================
    // 6. BUILD UNIQUE ACTIVE WEEKS
    // =====================================================

    const activeWeekSet =
      new Set<string>();

    for (const checkin of checkins) {
      if (
        !attendedCheckinIds.has(
          checkin.id
        )
      ) {
        continue;
      }

      const monday =
        getMonday(
          new Date(
            checkin.scheduled_at
          )
        );

      activeWeekSet.add(
        dateKey(monday)
      );
    }

    const activeWeeks =
      Array.from(
        activeWeekSet
      ).sort();

    if (
      activeWeeks.length === 0
    ) {
      return NextResponse.json({
        currentStreak: 0,
        longestStreak: 0,
        activeWeeks: [],
      });
    }

    // =====================================================
    // 7. CALCULATE LONGEST STREAK
    // =====================================================

    let longestStreak = 1;
    let runningStreak = 1;

    for (
      let i = 1;
      i < activeWeeks.length;
      i++
    ) {
      const previous =
        new Date(
          `${activeWeeks[i - 1]}T00:00:00`
        );

      const current =
        new Date(
          `${activeWeeks[i]}T00:00:00`
        );

      const difference =
        (current.getTime() -
          previous.getTime()) /
        (1000 * 60 * 60 * 24);

      if (difference === 7) {
        runningStreak++;

        longestStreak =
          Math.max(
            longestStreak,
            runningStreak
          );
      } else {
        runningStreak = 1;
      }
    }

    // =====================================================
    // 8. CALCULATE CURRENT STREAK
    // =====================================================

    const latestWeek =
      new Date(
        `${activeWeeks[activeWeeks.length - 1]}T00:00:00`
      );

    const currentWeek =
      getMonday(new Date());

    const daysSinceLatest =
      (currentWeek.getTime() -
        latestWeek.getTime()) /
      (1000 * 60 * 60 * 24);

    let currentStreak = 0;

    /*
      Latest activity must be this week
      or the immediately previous week.
    */
    if (
      daysSinceLatest === 0 ||
      daysSinceLatest === 7
    ) {
      currentStreak = 1;

      for (
        let i =
          activeWeeks.length - 1;
        i > 0;
        i--
      ) {
        const current =
          new Date(
            `${activeWeeks[i]}T00:00:00`
          );

        const previous =
          new Date(
            `${activeWeeks[i - 1]}T00:00:00`
          );

        const difference =
          (current.getTime() -
            previous.getTime()) /
          (1000 * 60 * 60 * 24);

        if (difference === 7) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // =====================================================
    // 9. SAVE STREAK
    // =====================================================

    const {
      data: existingStreak,
      error: existingError,
    } = await supabaseAdmin
      .from("pod_streaks")
      .select(
        "id, longest_streak"
      )
      .eq("pod_id", podId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      console.error(
        "STREAK EXISTING ERROR:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load existing streak.",
        },
        { status: 500 }
      );
    }

    const savedLongest =
      Math.max(
        longestStreak,
        existingStreak?.longest_streak ??
          0
      );

    if (existingStreak) {
      const {
        error: updateError,
      } = await supabaseAdmin
        .from("pod_streaks")
        .update({
          current_streak:
            currentStreak,

          longest_streak:
            savedLongest,

          last_completed_week:
            activeWeeks[
              activeWeeks.length - 1
            ],

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          existingStreak.id
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "pod_id",
          podId
        );

      if (updateError) {
        console.error(
          "STREAK UPDATE ERROR:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "Failed to save streak.",
          },
          { status: 500 }
        );
      }
    } else {
      const {
        error: insertError,
      } = await supabaseAdmin
        .from("pod_streaks")
        .insert({
          user_id: userId,
          pod_id: podId,
          current_streak:
            currentStreak,
          longest_streak:
            savedLongest,
          last_completed_week:
            activeWeeks[
              activeWeeks.length - 1
            ],
        });

      if (insertError) {
        console.error(
          "STREAK INSERT ERROR:",
          insertError
        );

        return NextResponse.json(
          {
            error:
              "Failed to save streak.",
          },
          { status: 500 }
        );
      }
    }

    // =====================================================
    // 10. RESPONSE
    // =====================================================

    return NextResponse.json({
      currentStreak,
      longestStreak:
        savedLongest,
      activeWeeks,
    });
  } catch (error: unknown) {
    console.error(
      "Streak API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to calculate streak.",
      },
      { status: 500 }
    );
  }
}