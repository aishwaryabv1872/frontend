import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_READINESS = 100;

type CareerGoal = {
  primary_goal: string | null;
  target_role: string | null;
};

function getBearerToken(
  authorization: string | null
): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const token = match[1].trim();

  return token || null;
}

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function round(
  value: number
): number {
  return Math.round(value);
}

function normalizeText(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getScoreLevel(
  score: number,
  max: number
): "strong" | "developing" | "needs_attention" {
  const percentage =
    max > 0
      ? (score / max) * 100
      : 0;

  if (percentage >= 75) {
    return "strong";
  }

  if (percentage >= 45) {
    return "developing";
  }

  return "needs_attention";
}

export async function POST(
  request: Request
) {
  try {
    // ==================================================
    // 1. ENVIRONMENT
    // ==================================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      console.error(
        "Readiness Intelligence configuration is incomplete."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Readiness Intelligence is temporarily unavailable.",
        },
        {
          status: 503,
        }
      );
    }

    // ==================================================
    // 2. AUTHENTICATION
    // ==================================================

    const accessToken = getBearerToken(
      request.headers.get("authorization")
    );

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // 3. VERIFY USER
    // ==================================================

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } =
      await authClient.auth.getUser(
        accessToken
      );

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired session.",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // 4. SERVICE ROLE CLIENT
    // ==================================================

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // ==================================================
    // 5. LOAD PROFILE
    // ==================================================

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "full_name, college_name, branch, year_of_study, cgpa, graduation_year"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Readiness profile query failed:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load your profile.",
        },
        {
          status: 500,
        }
      );
    }

    // ==================================================
    // 6. LOAD CAREER GOAL
    // Exact Dashboard schema:
    // primary_goal, target_role
    // ==================================================

    const {
      data: careerGoal,
      error: careerGoalError,
    } = await supabase
      .from("career_goals")
      .select(
        "primary_goal, target_role"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (careerGoalError) {
  console.error(
    "Readiness career goal query failed:",
    careerGoalError
  );

  return NextResponse.json(
    {
      success: false,
      error:
        "Unable to load your career goal.",
    },
    {
      status: 500,
    }
  );
}

    const typedCareerGoal =
      careerGoal as CareerGoal | null;

    // ==================================================
    // 7. LOAD SKILLS
    // ==================================================

    const {
      data: skills,
      error: skillsError,
    } = await supabase
      .from("student_skills")
      .select("id")
      .eq("user_id", user.id);

    if (skillsError) {
      console.error(
        "Readiness skills query failed:",
        skillsError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load your skills.",
        },
        {
          status: 500,
        }
      );
    }

    // ==================================================
    // 8. LOAD DSA
    // ==================================================

    const {
      data: dsaProblems,
      error: dsaError,
    } = await supabase
      .from("dsa_problems")
      .select("difficulty")
      .eq("user_id", user.id);

    if (dsaError) {
      console.error(
        "Readiness DSA query failed:",
        dsaError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load DSA progress.",
        },
        {
          status: 500,
        }
      );
    }

    // ==================================================
    // 9. LOAD PROJECTS
    // ==================================================

    const {
      data: projects,
      error: projectsError,
    } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id);

    if (projectsError) {
      console.error(
        "Readiness projects query failed:",
        projectsError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load project progress.",
        },
        {
          status: 500,
        }
      );
    }

    // ==================================================
    // 10. LOAD APTITUDE
    // ==================================================

    const {
      data: aptitudeAttempts,
      error: aptitudeError,
    } = await supabase
      .from("aptitude_attempts")
      .select(
        "question_id, category, is_correct"
      )
      .eq("user_id", user.id);

    if (aptitudeError) {
      console.error(
        "Readiness aptitude query failed:",
        aptitudeError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load aptitude progress.",
        },
        {
          status: 500,
        }
      );
    }

    // ==================================================
    // 11. CALCULATE CGPA SCORE
    // Max = 20
    // ==================================================

    const cgpa = clamp(
      safeNumber(profile?.cgpa),
      0,
      10
    );

    const cgpaScore = Math.min(
      (cgpa / 10) * 20,
      20
    );

    // ==================================================
    // 12. CALCULATE SKILLS SCORE
    // Max = 30
    // ==================================================

    const skillsCount =
      Array.isArray(skills)
        ? skills.length
        : 0;

    const skillsScore = Math.min(
      skillsCount * 3,
      30
    );

    // ==================================================
    // 13. CALCULATE DSA SCORE
    // Max = 25
    // ==================================================

    const dsaList = Array.isArray(
      dsaProblems
    )
      ? dsaProblems
      : [];

    const easyCount =
      dsaList.filter(
        (problem) =>
          normalizeText(
            problem.difficulty
          ).toLowerCase() === "easy"
      ).length;

    const mediumCount =
      dsaList.filter(
        (problem) =>
          normalizeText(
            problem.difficulty
          ).toLowerCase() === "medium"
      ).length;

    const hardCount =
      dsaList.filter(
        (problem) =>
          normalizeText(
            problem.difficulty
          ).toLowerCase() === "hard"
      ).length;

    const dsaPoints =
      easyCount +
      mediumCount * 2 +
      hardCount * 3;

    const dsaScore = Math.min(
      Math.round(dsaPoints / 2),
      25
    );

    const dsaCount =
      dsaList.length;

    // ==================================================
    // 14. CALCULATE PROJECT SCORE
    // Max = 25
    // ==================================================

    const projectList =
      Array.isArray(projects)
        ? projects
        : [];

    const projectsCount =
      projectList.length;

    const projectsScore = Math.min(
      projectsCount * 8,
      25
    );

    // ==================================================
    // 15. CALCULATE APTITUDE SCORE
    // Max = 10
    // ==================================================

    const aptitudeList =
      Array.isArray(
        aptitudeAttempts
      )
        ? aptitudeAttempts
        : [];

    const aptitudeAttempted =
      aptitudeList.length;

    const aptitudeCorrect =
      aptitudeList.filter(
        (attempt) =>
          attempt.is_correct === true
      ).length;

    const aptitudeAccuracy =
      aptitudeAttempted > 0
        ? Math.round(
            (aptitudeCorrect /
              aptitudeAttempted) *
              100
          )
        : 0;

    const aptitudeScore = Math.min(
      Math.round(
        aptitudeAccuracy / 10
      ),
      10
    );

    // ==================================================
    // 16. TOTAL READINESS
    // Max = 110
    // ==================================================

    const totalScore =
      cgpaScore +
      skillsScore +
      dsaScore +
      projectsScore +
      aptitudeScore;

    const readinessPercentage =
      clamp(
        Math.round(
          (totalScore / 110) * 100
        ),
        0,
        MAX_READINESS
      );

    // ==================================================
    // 17. CATEGORY ANALYSIS
    // ==================================================

    const categories = [
      {
        key: "cgpa",
        name: "Academic Performance",
        score: round(cgpaScore),
        maxScore: 20,
        level: getScoreLevel(
          cgpaScore,
          20
        ),
      },
      {
        key: "skills",
        name: "Technical Skills",
        score: skillsScore,
        maxScore: 30,
        level: getScoreLevel(
          skillsScore,
          30
        ),
      },
      {
        key: "dsa",
        name: "DSA",
        score: dsaScore,
        maxScore: 25,
        level: getScoreLevel(
          dsaScore,
          25
        ),
      },
      {
        key: "projects",
        name: "Projects",
        score: projectsScore,
        maxScore: 25,
        level: getScoreLevel(
          projectsScore,
          25
        ),
      },
      {
        key: "aptitude",
        name: "Aptitude",
        score: aptitudeScore,
        maxScore: 10,
        level: getScoreLevel(
          aptitudeScore,
          10
        ),
      },
    ];

    const sortedCategories =
      [...categories].sort(
        (a, b) => {
          const aRatio =
            a.score / a.maxScore;

          const bRatio =
            b.score / b.maxScore;

          return aRatio - bRatio;
        }
      );

    const weakestCategory =
      sortedCategories[0];

    const strongestCategory =
      [...categories].sort(
        (a, b) => {
          const aRatio =
            a.score / a.maxScore;

          const bRatio =
            b.score / b.maxScore;

          return bRatio - aRatio;
        }
      )[0];

    // ==================================================
    // 18. STRENGTHS
    // ==================================================

    const strengths: string[] = [];

    if (cgpaScore >= 16) {
      strengths.push(
        `Academic performance is strong with a CGPA of ${cgpa.toFixed(
          2
        )}/10.`
      );
    }

    if (skillsScore >= 15) {
      strengths.push(
        `Technical skill coverage contributes ${skillsScore}/30 points.`
      );
    }

    if (dsaScore >= 13) {
      strengths.push(
        `DSA progress has reached ${dsaCount} solved problems.`
      );
    }

    if (projectsScore >= 16) {
      strengths.push(
        `Project portfolio currently contains ${projectsCount} project${
          projectsCount === 1
            ? ""
            : "s"
        }.`
      );
    }

    if (aptitudeScore >= 6) {
      strengths.push(
        `Aptitude accuracy is currently ${aptitudeAccuracy}%.`
      );
    }

    if (strengths.length === 0) {
      strengths.push(
        "Your readiness profile has a clear starting point that can be improved systematically."
      );
    }

    // ==================================================
    // 19. GAPS
    // ==================================================

    const gaps: string[] = [];

    if (cgpaScore < 16) {
      gaps.push(
        `Academic readiness is ${round(
          cgpaScore
        )}/20; maintaining or improving CGPA can strengthen eligibility for campus opportunities.`
      );
    }

    if (skillsScore < 15) {
      gaps.push(
        `Technical skills currently contribute ${skillsScore}/30 points.`
      );
    }

    if (dsaScore < 13) {
      gaps.push(
        `DSA currently contributes ${dsaScore}/25 points from ${dsaCount} solved problems.`
      );
    }

    if (projectsScore < 16) {
      gaps.push(
        `Projects currently contribute ${projectsScore}/25 points from ${projectsCount} project${
          projectsCount === 1
            ? ""
            : "s"
        }.`
      );
    }

    if (
      aptitudeAttempted === 0 ||
      aptitudeScore < 6
    ) {
      gaps.push(
        aptitudeAttempted === 0
          ? "No aptitude attempts are currently contributing to readiness."
          : `Aptitude currently contributes ${aptitudeScore}/10 points with ${aptitudeAccuracy}% accuracy.`
      );
    }

    // ==================================================
    // 20. PRIORITY ACTIONS
    // ==================================================

    const priorities = categories
      .map((category) => {
        const percentage =
          category.maxScore > 0
            ? Math.round(
                (category.score /
                  category.maxScore) *
                  100
              )
            : 0;

        let action =
          "Continue improving this area consistently.";

        if (category.key === "dsa") {
          action =
            "Solve DSA problems consistently, starting with fundamentals and gradually increasing difficulty.";
        }

        if (category.key === "skills") {
          action =
            "Add role-relevant technical skills and demonstrate them through practical work.";
        }

        if (category.key === "projects") {
          action =
            "Build and document production-style projects with GitHub and deployment evidence.";
        }

        if (category.key === "aptitude") {
          action =
            "Practice quantitative, logical, and verbal aptitude regularly and track accuracy.";
        }

        if (category.key === "cgpa") {
          action =
            "Maintain academic performance while balancing technical placement preparation.";
        }

        return {
          area: category.name,
          key: category.key,
          score: category.score,
          maxScore: category.maxScore,
          percentage,
          priority:
            percentage < 45
              ? "high"
              : percentage < 75
              ? "medium"
              : "maintenance",
          action,
        };
      })
      .sort(
        (a, b) =>
          a.percentage -
          b.percentage
      );

    // ==================================================
    // 21. TARGET ROLE + CAREER GOAL
    // Exact career_goals schema
    // ==================================================

    const targetRole =
      normalizeText(
        typedCareerGoal?.target_role
      );

    const careerGoalName =
      normalizeText(
        typedCareerGoal?.primary_goal
      );

    // ==================================================
    // 22. RETURN READINESS INTELLIGENCE
    // ==================================================

    return NextResponse.json(
      {
        success: true,

        readiness: {
          percentage:
            readinessPercentage,
          totalScore:
            round(totalScore),
          maxScore: 110,
        },

        profile: {
          name:
            normalizeText(
              profile?.full_name
            ) ||
            "Student",

          branch:
            normalizeText(
              profile?.branch
            ),

          college:
            normalizeText(
              profile?.college_name
            ),

          cgpa,

          careerGoal:
            careerGoalName,

          targetRole,
        },

        progress: {
          skillsCount,
          dsaCount,
          projectsCount,
          aptitudeAttempted,
          aptitudeCorrect,
          aptitudeAccuracy,
        },

        scores: {
          cgpa: round(cgpaScore),
          skills: skillsScore,
          dsa: dsaScore,
          projects: projectsScore,
          aptitude: aptitudeScore,
        },

        dsa: {
          easy: easyCount,
          medium: mediumCount,
          hard: hardCount,
          totalSolved: dsaCount,
        },

        categories,

        strongestArea: {
          key:
            strongestCategory.key,
          name:
            strongestCategory.name,
          score:
            strongestCategory.score,
          maxScore:
            strongestCategory.maxScore,
        },

        weakestArea: {
          key:
            weakestCategory.key,
          name:
            weakestCategory.name,
          score:
            weakestCategory.score,
          maxScore:
            weakestCategory.maxScore,
        },

        strengths,

        gaps,

        priorities,

        nextAction:
          priorities[0]?.action ||
          "Continue improving your placement readiness consistently.",
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Readiness Intelligence API failed:",
      {
        name:
          error instanceof Error
            ? error.name
            : "UnknownError",

        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      }
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to calculate readiness intelligence right now.",
      },
      {
        status: 500,
      }
    );
  }
}