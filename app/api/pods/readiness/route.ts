import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/*
  Client used ONLY to verify the user's access token.
  This client does NOT use the service-role key.
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
  Privileged server-side client.

  IMPORTANT:
  Never expose this client to browser code.
*/
const adminClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function calculateReadiness({
  cgpa,
  skillsCount,
  dsaProblems,
  projectsCount,
  aptitudeAttempts,
}: {
  cgpa: number;
  skillsCount: number;
  dsaProblems: {
    difficulty: string | null;
  }[];
  projectsCount: number;
  aptitudeAttempts: {
    is_correct: boolean | null;
  }[];
}) {
  // =====================================================
  // 1. CGPA SCORE - 20 POINTS
  // =====================================================

  const cgpaScore = cgpa
    ? Math.min((Number(cgpa) / 10) * 20, 20)
    : 0;

  // =====================================================
  // 2. SKILLS SCORE - 30 POINTS
  // =====================================================

  const skillsScore = Math.min(
    skillsCount * 3,
    30
  );

  // =====================================================
  // 3. DSA SCORE - 25 POINTS
  // =====================================================

  let dsaPoints = 0;

  for (const problem of dsaProblems) {
    const difficulty = String(
      problem.difficulty ?? ""
    ).toLowerCase();

    if (difficulty === "easy") {
      dsaPoints += 1;
    } else if (difficulty === "medium") {
      dsaPoints += 2;
    } else if (difficulty === "hard") {
      dsaPoints += 3;
    }
  }

  const dsaScore = Math.min(
    Math.round(dsaPoints / 2),
    25
  );

  // =====================================================
  // 4. PROJECTS SCORE - 25 POINTS
  // =====================================================

  const projectsScore = Math.min(
    projectsCount * 8,
    25
  );

  // =====================================================
  // 5. APTITUDE SCORE - 10 POINTS
  // =====================================================

  let aptitudeAccuracy = 0;

  if (aptitudeAttempts.length > 0) {
    const totalQuestions =
      aptitudeAttempts.length;

    const correctAnswers =
      aptitudeAttempts.filter(
        (attempt) =>
          attempt.is_correct === true
      ).length;

    aptitudeAccuracy = Math.round(
      (correctAnswers / totalQuestions) * 100
    );
  }

  const aptitudeScore = Math.min(
    Math.round(aptitudeAccuracy / 10),
    10
  );

  // =====================================================
  // 6. TOTAL SCORE
  // =====================================================

  const totalScore =
    cgpaScore +
    skillsScore +
    dsaScore +
    projectsScore +
    aptitudeScore;

  // =====================================================
  // 7. NORMALIZE TO 100%
  // =====================================================

  const readiness = Math.min(
    Math.round(
      (totalScore / 110) * 100
    ),
    100
  );

  return {
    cgpaScore,
    skillsScore,
    dsaScore,
    projectsScore,
    aptitudeScore,
    aptitudeAccuracy,
    totalScore,
    readiness,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    // ===================================================
    // 1. AUTHENTICATE REQUEST
    // ===================================================

    const authorization =
      request.headers.get("authorization");

    if (!authorization) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    const tokenMatch =
      authorization.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid authorization header",
        },
        { status: 401 }
      );
    }

    const accessToken = tokenMatch[1];

    const {
      data: {
        user,
      },
      error: authError,
    } = await authClient.auth.getUser(
      accessToken
    );

    if (authError || !user) {
      console.error(
        "READINESS AUTH ERROR:",
        authError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired session",
        },
        { status: 401 }
      );
    }

    /*
      SECURITY IMPORTANT:

      We intentionally DO NOT accept userId from
      request.body.

      The authenticated Supabase user ID is the
      only identity used below.
    */
    const userId = user.id;

    console.log(
      "VERTEX READINESS CALCULATION:",
      userId
    );

    // ===================================================
    // 2. LOAD PROFILE
    // ===================================================

    const {
      data: profile,
      error: profileError,
    } = await adminClient
      .from("profiles")
      .select(
        "id, cgpa, full_name, college_name, branch, graduation_year"
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error(
        "READINESS PROFILE ERROR:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load profile",
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: "Profile not found",
        },
        { status: 404 }
      );
    }

    // ===================================================
    // 3. LOAD SKILLS
    // ===================================================

    const {
      data: skills,
      error: skillsError,
    } = await adminClient
      .from("student_skills")
      .select("id")
      .eq("user_id", userId);

    if (skillsError) {
      console.error(
        "READINESS SKILLS ERROR:",
        skillsError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load skills",
        },
        { status: 500 }
      );
    }

    const skillsCount =
      skills?.length ?? 0;

    // ===================================================
    // 4. LOAD DSA
    // ===================================================

    const {
      data: dsaProblems,
      error: dsaError,
    } = await adminClient
      .from("dsa_problems")
      .select("difficulty")
      .eq("user_id", userId);

    if (dsaError) {
      console.error(
        "READINESS DSA ERROR:",
        dsaError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load DSA progress",
        },
        { status: 500 }
      );
    }

    // ===================================================
    // 5. LOAD PROJECTS
    // ===================================================

    const {
      data: projects,
      error: projectsError,
    } = await adminClient
      .from("projects")
      .select("id")
      .eq("user_id", userId);

    if (projectsError) {
      console.error(
        "READINESS PROJECTS ERROR:",
        projectsError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load projects",
        },
        { status: 500 }
      );
    }

    const projectsCount =
      projects?.length ?? 0;

    // ===================================================
    // 6. LOAD APTITUDE
    // ===================================================

    const {
      data: aptitudeAttempts,
      error: aptitudeError,
    } = await adminClient
      .from("aptitude_attempts")
      .select("is_correct")
      .eq("user_id", userId);

    if (aptitudeError) {
      console.error(
        "READINESS APTITUDE ERROR:",
        aptitudeError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load aptitude progress",
        },
        { status: 500 }
      );
    }

    // ===================================================
    // 7. CALCULATE READINESS
    // ===================================================

    const result =
      calculateReadiness({
        cgpa: Number(
          profile.cgpa ?? 0
        ),

        skillsCount,

        dsaProblems:
          dsaProblems ?? [],

        projectsCount,

        aptitudeAttempts:
          aptitudeAttempts ?? [],
      });

    console.log(
      "VERTEX READINESS RESULT:",
      {
        userId,
        readiness: result.readiness,
        totalScore: result.totalScore,
      }
    );

    // ===================================================
    // 8. FIND ACTIVE POD MEMBERSHIP
    // ===================================================

    const {
      data: membership,
      error: membershipError,
    } = await adminClient
      .from("pod_members")
      .select(
        "id, pod_id, readiness_score"
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "READINESS MEMBERSHIP ERROR:",
        membershipError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load pod membership",
        },
        { status: 500 }
      );
    }

    // ===================================================
    // 9. UPDATE POD MEMBER READINESS
    // ===================================================

    if (membership) {
      const {
        error: updateError,
      } = await adminClient
        .from("pod_members")
        .update({
          readiness_score:
            result.readiness,
        })
        .eq(
          "id",
          membership.id
        )
        .eq(
          "user_id",
          userId
        );

      if (updateError) {
        console.error(
          "READINESS UPDATE ERROR:",
          updateError
        );

        return NextResponse.json(
          {
            success: false,
            error: "Unable to update readiness",
          },
          { status: 500 }
        );
      }

      console.log(
        "POD MEMBER READINESS UPDATED:",
        {
          membershipId:
            membership.id,
          readiness:
            result.readiness,
        }
      );
    }

    // ===================================================
    // 10. SUCCESS RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      readinessScore:
        result.readiness,

      totalScore:
        result.totalScore,

      maxScore: 110,

      breakdown: {
        cgpa:
          result.cgpaScore,

        skills:
          result.skillsScore,

        dsa:
          result.dsaScore,

        projects:
          result.projectsScore,

        aptitude:
          result.aptitudeScore,

        aptitudeAccuracy:
          result.aptitudeAccuracy,
      },

      profile: {
        cgpa:
          Number(profile.cgpa ?? 0),

        name:
          profile.full_name,

        college:
          profile.college_name,

        branch:
          profile.branch,

        graduationYear:
          profile.graduation_year,
      },

      counts: {
        skills:
          skillsCount,

        dsa:
          dsaProblems?.length ?? 0,

        projects:
          projectsCount,

        aptitudeAttempts:
          aptitudeAttempts?.length ?? 0,
      },

      membership: membership
        ? {
            id:
              membership.id,

            podId:
              membership.pod_id,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error(
      "VERTEX READINESS UNEXPECTED ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}