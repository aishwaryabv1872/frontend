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
  Never expose this client or service-role key to the browser.
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
        { error: "Authentication required." },
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
        { error: "Invalid authorization header." },
        { status: 401 }
      ),
    };
  }

  const accessToken = tokenMatch[1];

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    console.error(
      "GOALS AUTH ERROR:",
      authError
    );

    return {
      user: null,
      response: NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

function getWeekRange() {
  const now = new Date();

  const day = now.getDay();

  const diffToMonday =
    day === 0 ? -6 : 1 - day;

  const start = new Date(now);

  start.setDate(
    now.getDate() + diffToMonday
  );

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  end.setDate(
    start.getDate() + 6
  );

  end.setHours(
    23,
    59,
    59,
    999
  );

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
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
      Never trust userId supplied by the browser.
      Always use the authenticated Supabase user ID.
    */
    const userId = user.id;

    // =====================================================
    // 2. READ REQUEST BODY
    // =====================================================

    const body = await request.json();

    const {
      action = "generate",
      goalId,
      progressValue,
      note,
    } = body;

    // =====================================================
    // 3. LOAD ACTIVE POD MEMBERSHIP
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
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      console.error(
        "GOALS MEMBERSHIP ERROR:",
        membershipError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load pod membership.",
        },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "You are not currently a member of an active pod.",
        },
        { status: 404 }
      );
    }

    const podId = membership.pod_id;

    // =====================================================
    // 4. GENERATE WEEKLY GOALS
    // =====================================================

    if (action === "generate") {
      const {
        start,
        end,
      } = getWeekRange();

      // ---------------------------------------------------
      // Check whether goals already exist
      // ---------------------------------------------------

      const {
        data: existingGoals,
        error: existingGoalsError,
      } = await supabaseAdmin
        .from("pod_goals")
        .select("*")
        .eq("pod_id", podId)
        .eq("user_id", userId)
        .gte("week_start", start)
        .lte("week_start", end);

      if (existingGoalsError) {
        console.error(
          "GOALS EXISTING LOOKUP ERROR:",
          existingGoalsError
        );

        return NextResponse.json(
          {
            error:
              "Failed to check existing goals.",
          },
          { status: 500 }
        );
      }

      if (
        existingGoals &&
        existingGoals.length > 0
      ) {
        return NextResponse.json({
          success: true,
          goals: existingGoals,
          alreadyExists: true,
        });
      }

      // ---------------------------------------------------
      // Load user's current progress
      // ---------------------------------------------------

      const [
        dsaResult,
        projectsResult,
        skillsResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("dsa_problems")
          .select(
            "id, problem_name, difficulty, solved_at"
          )
          .eq("user_id", userId),

        supabaseAdmin
          .from("projects")
          .select(
            "id, project_name, verification_status, verification_score"
          )
          .eq("user_id", userId),

        supabaseAdmin
          .from("student_skills")
          .select("id, skill_name")
          .eq("user_id", userId),
      ]);

      if (dsaResult.error) {
        throw dsaResult.error;
      }

      if (projectsResult.error) {
        throw projectsResult.error;
      }

      if (skillsResult.error) {
        throw skillsResult.error;
      }

      const dsaProblems =
        dsaResult.data ?? [];

      const projects =
        projectsResult.data ?? [];

      const skills =
        skillsResult.data ?? [];

      // ---------------------------------------------------
      // Build weekly goals
      // ---------------------------------------------------

      const goals = [
        {
          pod_id: podId,
          user_id: userId,
          goal_type: "dsa",
          title: "Solve DSA Problems",
          description:
            "Solve at least 3 DSA problems this week.",
          target_value: 3,
          progress_value: 0,
          unit: "problems",
          week_start: start,
          status: "active",
          metadata: {
            current_count:
              dsaProblems.length,
          },
        },
        {
          pod_id: podId,
          user_id: userId,
          goal_type: "project",
          title: "Improve Your Project",
          description:
            "Make at least one meaningful improvement to a project.",
          target_value: 1,
          progress_value: 0,
          unit: "improvement",
          week_start: start,
          status: "active",
          metadata: {
            current_count:
              projects.length,
          },
        },
        {
          pod_id: podId,
          user_id: userId,
          goal_type: "skills",
          title: "Build Technical Skills",
          description:
            "Learn or strengthen one technical skill.",
          target_value: 1,
          progress_value: 0,
          unit: "skill",
          week_start: start,
          status: "active",
          metadata: {
            current_count:
              skills.length,
          },
        },
        {
          pod_id: podId,
          user_id: userId,
          goal_type: "interview",
          title: "Practice Interview Questions",
          description:
            "Practice at least 5 placement interview questions.",
          target_value: 5,
          progress_value: 0,
          unit: "questions",
          week_start: start,
          status: "active",
        },
      ];

      const {
        data: insertedGoals,
        error: insertError,
      } = await supabaseAdmin
        .from("pod_goals")
        .insert(goals)
        .select("*");

      if (insertError) {
        console.error(
          "GOALS INSERT ERROR:",
          insertError
        );

        return NextResponse.json(
          {
            error:
              "Failed to generate weekly goals.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        goals: insertedGoals ?? [],
        alreadyExists: false,
      });
    }

    // =====================================================
    // 5. CHECK IN / UPDATE GOAL PROGRESS
    // =====================================================

    if (action === "checkin") {
      if (!goalId) {
        return NextResponse.json(
          {
            error:
              "goalId is required.",
          },
          { status: 400 }
        );
      }

      // ---------------------------------------------------
      // Verify goal belongs to authenticated user + pod
      // ---------------------------------------------------

      const {
        data: goal,
        error: goalError,
      } = await supabaseAdmin
        .from("pod_goals")
        .select("*")
        .eq("id", goalId)
        .eq("pod_id", podId)
        .eq("user_id", userId)
        .maybeSingle();

      if (goalError) {
        console.error(
          "GOAL LOOKUP ERROR:",
          goalError
        );

        return NextResponse.json(
          {
            error:
              "Failed to load goal.",
          },
          { status: 500 }
        );
      }

      if (!goal) {
        return NextResponse.json(
          {
            error:
              "Goal not found.",
          },
          { status: 404 }
        );
      }

      // ---------------------------------------------------
      // Validate progress
      // ---------------------------------------------------

      const numericProgress =
        Number(progressValue);

      if (
        !Number.isFinite(numericProgress) ||
        numericProgress < 0
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid progress value.",
          },
          { status: 400 }
        );
      }

      const targetValue =
        Number(goal.target_value) || 0;

      const finalProgress = Math.min(
        numericProgress,
        targetValue
      );

      const goalStatus =
        finalProgress >= targetValue
          ? "completed"
          : "active";

      // ---------------------------------------------------
      // Record check-in
      // ---------------------------------------------------

      const {
        error: checkinError,
      } = await supabaseAdmin
        .from("pod_goal_checkins")
        .insert({
          goal_id: goalId,
          pod_id: podId,
          user_id: userId,
          progress_value: finalProgress,
          note:
            typeof note === "string"
              ? note.trim()
              : null,
        });

      if (checkinError) {
        console.error(
          "GOAL CHECKIN INSERT ERROR:",
          checkinError
        );

        return NextResponse.json(
          {
            error:
              "Failed to record goal check-in.",
          },
          { status: 500 }
        );
      }

      // ---------------------------------------------------
      // Update goal
      // ---------------------------------------------------

      const {
        data: updatedGoal,
        error: updateError,
      } = await supabaseAdmin
        .from("pod_goals")
        .update({
          progress_value:
            finalProgress,
          status: goalStatus,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", goalId)
        .eq("pod_id", podId)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (updateError) {
        console.error(
          "GOAL UPDATE ERROR:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "Failed to update goal.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        goal: updatedGoal,
      });
    }

    // =====================================================
    // 6. GET CURRENT WEEK GOALS
    // =====================================================

    if (action === "get") {
      const {
        start,
        end,
      } = getWeekRange();

      const {
        data: goals,
        error: goalsError,
      } = await supabaseAdmin
        .from("pod_goals")
        .select("*")
        .eq("pod_id", podId)
        .eq("user_id", userId)
        .gte("week_start", start)
        .lte("week_start", end)
        .order("created_at", {
          ascending: true,
        });

      if (goalsError) {
        console.error(
          "GOALS GET ERROR:",
          goalsError
        );

        return NextResponse.json(
          {
            error:
              "Failed to load goals.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        goals: goals ?? [],
      });
    }

    // =====================================================
    // 7. INVALID ACTION
    // =====================================================

    return NextResponse.json(
      {
        error: "Invalid action.",
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error(
      "Goals API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to process goals request.",
      },
      { status: 500 }
    );
  }
}