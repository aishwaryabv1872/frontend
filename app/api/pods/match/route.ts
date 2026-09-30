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

  IMPORTANT:
  The service-role key must NEVER be exposed
  to browser/client-side code.
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

// ============================================================
// AUTHENTICATION
// ============================================================

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
        {
          status: 401,
        }
      ),
    };
  }

  const tokenMatch =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  if (!tokenMatch) {
    return {
      user: null,
      response: NextResponse.json(
        {
          error:
            "Invalid authorization header.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const accessToken =
    tokenMatch[1];

  const {
    data: { user },
    error: authError,
  } =
    await authClient.auth.getUser(
      accessToken
    );

  if (authError || !user) {
    console.error(
      "MATCH AUTH ERROR:",
      authError
    );

    return {
      user: null,
      response: NextResponse.json(
        {
          error:
            "Invalid or expired session.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

// ============================================================
// HELPERS
// ============================================================

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

// ============================================================
// READINESS CALCULATION
// ============================================================

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
  // -----------------------------
  // CGPA
  // -----------------------------

  const cgpaScore = cgpa
    ? Math.min(
        (Number(cgpa) / 10) * 20,
        20
      )
    : 0;

  // -----------------------------
  // Skills
  // -----------------------------

  const skillsScore = Math.min(
    skillsCount * 3,
    30
  );

  // -----------------------------
  // DSA
  // -----------------------------

  let dsaPoints = 0;

  for (const problem of dsaProblems) {
    const difficulty =
      String(
        problem.difficulty ?? ""
      ).toLowerCase();

    if (difficulty === "easy") {
      dsaPoints += 1;
    } else if (
      difficulty === "medium"
    ) {
      dsaPoints += 2;
    } else if (
      difficulty === "hard"
    ) {
      dsaPoints += 3;
    }
  }

  const dsaScore = Math.min(
    Math.round(dsaPoints / 2),
    25
  );

  // -----------------------------
  // Projects
  // -----------------------------

  const projectsScore = Math.min(
    projectsCount * 8,
    25
  );

  // -----------------------------
  // Aptitude
  // -----------------------------

  let aptitudeAccuracy = 0;

  if (
    aptitudeAttempts.length > 0
  ) {
    const correctAnswers =
      aptitudeAttempts.filter(
        (attempt) =>
          attempt.is_correct === true
      ).length;

    aptitudeAccuracy =
      Math.round(
        (correctAnswers /
          aptitudeAttempts.length) *
          100
      );
  }

  const aptitudeScore = Math.min(
    Math.round(
      aptitudeAccuracy / 10
    ),
    10
  );

  // -----------------------------
  // Total
  // -----------------------------

  const totalScore =
    cgpaScore +
    skillsScore +
    dsaScore +
    projectsScore +
    aptitudeScore;

  // -----------------------------
  // Final readiness
  // -----------------------------

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

// ============================================================
// MATCH SCORE
// ============================================================

function calculateMatchScore(
  profile: {
    branch?: string | null;
    semester?: string | null;
    target_role?: string | null;
    target_company?: string | null;
    skills?: string[] | null;
  },
  pod: {
    branch?: string | null;
    semester?: string | null;
    target_role?: string | null;
    target_company?: string | null;
    skills?: string[] | null;
  }
) {
  let score = 0;

  // -----------------------------
  // Branch
  // -----------------------------

  if (
    normalize(profile.branch) &&
    normalize(profile.branch) ===
      normalize(pod.branch)
  ) {
    score += 20;
  }

  // -----------------------------
  // Semester
  // -----------------------------

  if (
    normalize(profile.semester) &&
    normalize(profile.semester) ===
      normalize(pod.semester)
  ) {
    score += 15;
  }

  // -----------------------------
  // Target role
  // -----------------------------

  if (
    normalize(profile.target_role) &&
    normalize(profile.target_role) ===
      normalize(pod.target_role)
  ) {
    score += 25;
  }

  // -----------------------------
  // Target company
  // -----------------------------

  if (
    normalize(profile.target_company) &&
    normalize(profile.target_company) ===
      normalize(pod.target_company)
  ) {
    score += 20;
  }

  // -----------------------------
  // Skills
  // -----------------------------

  const profileSkills =
    new Set(
      (profile.skills ?? []).map(
        normalize
      )
    );

  const podSkills =
    pod.skills ?? [];

  if (
    profileSkills.size > 0 &&
    podSkills.length > 0
  ) {
    const overlap =
      podSkills.filter(
        (skill) =>
          profileSkills.has(
            normalize(skill)
          )
      ).length;

    score += Math.min(
      overlap * 5,
      20
    );
  }

  return Math.min(
    score,
    100
  );
}

// ============================================================
// POST
// ============================================================

export async function POST(
  request: NextRequest
) {
  try {
    // ========================================================
    // 1. AUTHENTICATE USER
    // ========================================================

    const {
      user,
      response,
    } =
      await authenticate(request);

    if (
      response ||
      !user
    ) {
      return response!;
    }

    /*
      SECURITY:

      The authenticated Supabase user is the
      ONLY identity used by this endpoint.

      We intentionally DO NOT read userId
      from request.body.
    */
    const userId = user.id;

    // ========================================================
    // 2. LOAD STUDENT PROFILE
    // ========================================================

    const {
      data: studentProfile,
      error:
        studentProfileError,
    } =
      await supabaseAdmin
        .from(
          "student_profiles"
        )
        .select("*")
        .eq(
          "user_id",
          userId
        )
        .maybeSingle();

    if (
      studentProfileError
    ) {
      console.error(
        "MATCH STUDENT PROFILE ERROR:",
        studentProfileError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load student profile.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 3. LOAD MAIN PROFILE
    // ========================================================

    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, cgpa, branch, graduation_year"
        )
        .eq(
          "id",
          userId
        )
        .maybeSingle();

    if (profileError) {
      console.error(
        "MATCH PROFILE ERROR:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load profile.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 4. LOAD USER READINESS DATA
    // ========================================================

    const [
      skillsResult,
      dsaResult,
      projectsResult,
      aptitudeResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(
          "student_skills"
        )
        .select(
          "skill_name"
        )
        .eq(
          "user_id",
          userId
        ),

      supabaseAdmin
        .from(
          "dsa_problems"
        )
        .select(
          "difficulty"
        )
        .eq(
          "user_id",
          userId
        ),

      supabaseAdmin
        .from(
          "projects"
        )
        .select("id")
        .eq(
          "user_id",
          userId
        ),

      supabaseAdmin
        .from(
          "aptitude_attempts"
        )
        .select(
          "is_correct"
        )
        .eq(
          "user_id",
          userId
        ),
    ]);

    if (
      skillsResult.error
    ) {
      throw skillsResult.error;
    }

    if (
      dsaResult.error
    ) {
      throw dsaResult.error;
    }

    if (
      projectsResult.error
    ) {
      throw projectsResult.error;
    }

    if (
      aptitudeResult.error
    ) {
      throw aptitudeResult.error;
    }

    const skills =
      skillsResult.data ?? [];

    const dsaProblems =
      dsaResult.data ?? [];

    const projects =
      projectsResult.data ?? [];

    const aptitudeAttempts =
      aptitudeResult.data ?? [];

    // ========================================================
    // 5. CALCULATE READINESS
    // ========================================================

    const readinessData =
      calculateReadiness({
        cgpa: Number(
          profile?.cgpa ?? 0
        ),

        skillsCount:
          skills.length,

        dsaProblems,

        projectsCount:
          projects.length,

        aptitudeAttempts,
      });

    // ========================================================
    // 6. BUILD MATCH PROFILE
    // ========================================================

    const matchProfile = {
      branch:
        studentProfile?.branch ??
        profile?.branch ??
        null,

      semester:
        studentProfile?.semester ??
        null,

      target_role:
        studentProfile?.target_role ??
        null,

      target_company:
        studentProfile?.target_company ??
        null,

      skills:
        skills.map(
          (skill) =>
            skill.skill_name
        ),
    };

    // ========================================================
    // 7. CHECK EXISTING MEMBERSHIP
    // ========================================================

    const {
      data: existingMembership,
      error:
        existingMembershipError,
    } =
      await supabaseAdmin
        .from(
          "pod_members"
        )
        .select(
          "id, pod_id, role, status"
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "status",
          "active"
        )
        .maybeSingle();

    if (
      existingMembershipError
    ) {
      console.error(
        "MATCH MEMBERSHIP ERROR:",
        existingMembershipError
      );

      return NextResponse.json(
        {
          error:
            "Failed to check existing pod membership.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 8. UPDATE EXISTING MEMBERSHIP
    // ========================================================

    if (
      existingMembership
    ) {
      const {
        data:
          updatedMembership,
        error:
          updateError,
      } =
        await supabaseAdmin
          .from(
            "pod_members"
          )
          .update({
            readiness_score:
              readinessData.readiness,

            branch:
              matchProfile.branch,

            semester:
              matchProfile.semester,

            target_role:
              matchProfile.target_role,

            target_company:
              matchProfile.target_company,

            skills:
              matchProfile.skills,
          })
          .eq(
            "id",
            existingMembership.id
          )
          .eq(
            "user_id",
            userId
          )
          .select("*")
          .single();

      if (updateError) {
        console.error(
          "MATCH MEMBERSHIP UPDATE ERROR:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "Failed to update pod membership.",
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        alreadyMember: true,
        membership:
          updatedMembership,
        readiness:
          readinessData,
      });
    }

    // ========================================================
    // 9. LOAD ACTIVE PODS
    // ========================================================

    const {
      data: activePods,
      error:
        activePodsError,
    } =
      await supabaseAdmin
        .from(
          "accountability_pods"
        )
        .select("*")
        .eq(
          "status",
          "active"
        );

    if (
      activePodsError
    ) {
      console.error(
        "MATCH ACTIVE PODS ERROR:",
        activePodsError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load available pods.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 10. CALCULATE CANDIDATE PODS
    // ========================================================

    const candidatePods: {
      pod: NonNullable<
        typeof activePods
      >[number];

      memberCount: number;

      matchScore: number;
    }[] = [];

    for (
      const pod of activePods ?? []
    ) {
      const {
        count,
        error:
          countError,
      } =
        await supabaseAdmin
          .from(
            "pod_members"
          )
          .select(
            "id",
            {
              count:
                "exact",
              head: true,
            }
          )
          .eq(
            "pod_id",
            pod.id
          )
          .eq(
            "status",
            "active"
          );

      if (countError) {
        console.error(
          "MATCH MEMBER COUNT ERROR:",
          countError
        );

        continue;
      }

      const memberCount =
        count ?? 0;

      const maxMembers =
        Number(
          pod.max_members ?? 5
        );

      // Never select a full pod.
      if (
        memberCount >=
        maxMembers
      ) {
        continue;
      }

      const matchScore =
        calculateMatchScore(
          matchProfile,
          {
            branch:
              pod.branch,

            semester:
              pod.semester,

            target_role:
              pod.target_role,

            target_company:
              pod.target_company,

            skills:
              pod.skills,
          }
        );

      if (
        matchScore >= 40
      ) {
        candidatePods.push({
          pod,
          memberCount,
          matchScore,
        });
      }
    }

    // Highest score first.
    candidatePods.sort(
      (a, b) =>
        b.matchScore -
        a.matchScore
    );

    const bestMatch =
      candidatePods[0];

    // ========================================================
    // 11. JOIN EXISTING POD
    // ========================================================

    if (bestMatch) {
      const {
        data: membership,
        error:
          membershipError,
      } =
        await supabaseAdmin
          .from(
            "pod_members"
          )
          .insert({
            pod_id:
              bestMatch.pod.id,

            user_id:
              userId,

            role: "member",

            status: "active",

            readiness_score:
              readinessData.readiness,

            branch:
              matchProfile.branch,

            semester:
              matchProfile.semester,

            target_role:
              matchProfile.target_role,

            target_company:
              matchProfile.target_company,

            skills:
              matchProfile.skills,

            timezone:
              "Asia/Kolkata",
          })
          .select("*")
          .single();

      if (
        membershipError
      ) {
        console.error(
          "MATCH JOIN POD ERROR:",
          membershipError
        );

        return NextResponse.json(
          {
            error:
              "Failed to join matched pod.",
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        matched: true,
        matchScore:
          bestMatch.matchScore,
        pod:
          bestMatch.pod,
        membership,
        readiness:
          readinessData,
      });
    }

    // ========================================================
    // 12. CREATE NEW POD
    // ========================================================

    const {
      data: newPod,
      error: newPodError,
    } =
      await supabaseAdmin
        .from(
          "accountability_pods"
        )
        .insert({
          status: "active",

          max_members: 5,

          target_role:
            matchProfile.target_role,

          target_company:
            matchProfile.target_company,

          branch:
            matchProfile.branch,

          semester:
            matchProfile.semester,

          skills:
            matchProfile.skills,

          timezone:
            "Asia/Kolkata",

          preferred_day:
            "Saturday",

          preferred_time:
            "18:00",
        })
        .select("*")
        .single();

    if (newPodError) {
      console.error(
        "MATCH CREATE POD ERROR:",
        newPodError
      );

      return NextResponse.json(
        {
          error:
            "Failed to create a new pod.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 13. CREATE LEADER MEMBERSHIP
    // ========================================================

    const {
      data: membership,
      error:
        membershipError,
    } =
      await supabaseAdmin
        .from(
          "pod_members"
        )
        .insert({
          pod_id:
            newPod.id,

          user_id:
            userId,

          role: "leader",

          status: "active",

          readiness_score:
            readinessData.readiness,

          branch:
            matchProfile.branch,

          semester:
            matchProfile.semester,

          target_role:
            matchProfile.target_role,

          target_company:
            matchProfile.target_company,

          skills:
            matchProfile.skills,

          timezone:
            "Asia/Kolkata",
        })
        .select("*")
        .single();

    if (
      membershipError
    ) {
      console.error(
        "MATCH CREATE MEMBERSHIP ERROR:",
        membershipError
      );

      /*
        Clean up the newly created pod if
        membership creation fails.
      */
      await supabaseAdmin
        .from(
          "accountability_pods"
        )
        .delete()
        .eq(
          "id",
          newPod.id
        );

      return NextResponse.json(
        {
          error:
            "Failed to create pod membership.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 14. SUCCESS
    // ========================================================

    return NextResponse.json({
      success: true,

      matched: false,

      created: true,

      matchScore: 0,

      pod: newPod,

      membership,

      readiness:
        readinessData,
    });
  } catch (error: unknown) {
    console.error(
      "Pod match API error:",
      error
    );

    /*
      SECURITY:
      Do not send raw database/server
      errors back to the browser.
    */
    return NextResponse.json(
      {
        error:
          "Failed to process pod matching request.",
      },
      {
        status: 500,
      }
    );
  }
}