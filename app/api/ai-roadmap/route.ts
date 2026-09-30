import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import {
  checkAiRateLimit,
  cleanupAiRateLimitEntries,
} from "@/lib/security/ai-rate-limit";

const apiKey = process.env.GEMINI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!apiKey) {
  console.error("GEMINI_API_KEY is missing.");
}

if (!supabaseUrl) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing.");
}

if (!supabaseServiceRoleKey) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is missing."
  );
}

const ai = apiKey
  ? new GoogleGenAI({ apiKey })
  : null;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )
    : null;

// ======================================================
// SECURITY LIMITS
// ======================================================

const MAX_PROFILE_FIELD_LENGTH = 200;
const MAX_PROGRESS_VALUE = 10000;
const GEMINI_TIMEOUT_MS = 30000;
const MAX_GEMINI_RETRIES = 2;

// ======================================================
// TYPES
// ======================================================

type StudentProfile = {
  university?: string;
  college?: string;
  branch?: string;
  semester?: number | string;
  target_role?: string;
  company_tier?: string;
  skill_level?: string;
};

type StudentProgress = {
  dsa?: number;
  skills?: number;
  projects?: number;
};

type RoadmapWeek = {
  week: number;
  title: string;
  goal: string;
  topics: string[];
  tasks: string[];
  dsa: string[];
  project: string;
  priority: "High" | "Medium" | "Low";
};

type RoadmapResponse = {
  summary: string;
  readiness_focus: string;
  weeks: RoadmapWeek[];
};

// ======================================================
// AUTH HELPERS
// ======================================================

function getBearerToken(
  authorization: string | null
): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(
    /^Bearer\s+(.+)$/i
  );

  if (!match) {
    return null;
  }

  const token = match[1].trim();

  return token || null;
}

// ======================================================
// INPUT HELPERS
// ======================================================

function limitString(
  value: unknown,
  fallback: string
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(
    0,
    MAX_PROFILE_FIELD_LENGTH
  );
}

function normalizeProgressValue(
  value: unknown
): number {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(
    MAX_PROGRESS_VALUE,
    Math.max(0, number)
  );
}

// ======================================================
// TIMEOUT HELPER
// ======================================================

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeoutPromise =
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error("AI request timed out.")
        );
      }, timeoutMs);
    });

  try {
    return await Promise.race([
      promise,
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// ======================================================
// GEMINI ERROR HELPERS
// ======================================================

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return "";
}

function isQuotaError(
  error: unknown
): boolean {
  const message =
    getErrorMessage(error).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("resource exhausted")
  );
}

function isTemporaryGeminiError(
  error: unknown
): boolean {
  const message =
    getErrorMessage(error).toLowerCase();

  return (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("unavailable") ||
    message.includes("high demand")
  );
}

// ======================================================
// AI RESPONSE CLEANING
// ======================================================

function cleanAIResponse(
  text: string
): string {
  let cleaned = text.trim();

  if (
    cleaned.startsWith("```json")
  ) {
    cleaned = cleaned.replace(
      /^```json\s*/i,
      ""
    );

    cleaned = cleaned.replace(
      /\s*```$/i,
      ""
    );
  } else if (
    cleaned.startsWith("```")
  ) {
    cleaned = cleaned.replace(
      /^```\s*/i,
      ""
    );

    cleaned = cleaned.replace(
      /\s*```$/i,
      ""
    );
  }

  return cleaned.trim();
}

// ======================================================
// WEEK VALIDATION
// ======================================================

function isValidWeek(
  week: unknown
): week is RoadmapWeek {
  if (
    !week ||
    typeof week !== "object" ||
    Array.isArray(week)
  ) {
    return false;
  }

  const item =
    week as Record<string, unknown>;

  const validPriority =
    ["High", "Medium", "Low"].includes(
      String(item.priority)
    );

  return (
    typeof item.week === "number" &&
    Number.isFinite(item.week) &&
    typeof item.title === "string" &&
    typeof item.goal === "string" &&
    Array.isArray(item.topics) &&
    Array.isArray(item.tasks) &&
    Array.isArray(item.dsa) &&
    typeof item.project === "string" &&
    validPriority
  );
}

// ======================================================
// POST
// ======================================================

export async function POST(
  request: Request
) {
  try {
    // ==================================================
    // CHECK SERVER CONFIGURATION
    // ==================================================

    if (!apiKey || !ai) {
      return NextResponse.json(
        {
          error:
            "AI service configuration is unavailable.",
        },
        { status: 503 }
      );
    }

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey ||
      !supabaseAdmin
    ) {
      return NextResponse.json(
        {
          error:
            "Server configuration is unavailable.",
        },
        { status: 503 }
      );
    }

    // ==================================================
    // AUTHENTICATION
    // ==================================================

    const accessToken =
      getBearerToken(
        request.headers.get(
          "authorization"
        )
      );

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Authentication required. Please log in again.",
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        accessToken
      );

    if (userError || !user) {
      console.error(
        "AI ROADMAP AUTH FAILED:",
        userError?.name ||
          "Invalid session"
      );

      return NextResponse.json(
        {
          error:
            "Your session is invalid or expired. Please log in again.",
        },
        { status: 401 }
      );
    }

    const userId = user.id;

    // ==================================================
    // AI REQUEST RATE LIMIT
    // ==================================================

    cleanupAiRateLimitEntries();

    const rateLimit = checkAiRateLimit(userId);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "AI Roadmap request limit reached. Please wait and try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              rateLimit.retryAfterSeconds
            ),
          },
        }
      );
    }

    // ==================================================
    // READ REQUEST BODY
    // ==================================================

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid request data.",
        },
        { status: 400 }
      );
    }

    const requestBody =
      body as Record<string, unknown>;

    const profile =
      requestBody.profile;

    const progress =
      requestBody.progress;

    // ==================================================
    // VALIDATE PROFILE
    // ==================================================

    if (
      !profile ||
      typeof profile !== "object" ||
      Array.isArray(profile)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid student profile is required.",
        },
        { status: 400 }
      );
    }

    const rawProfile =
      profile as StudentProfile;

    // ==================================================
    // VALIDATE PROGRESS
    // ==================================================

    if (
      progress !== undefined &&
      (
        typeof progress !== "object" ||
        progress === null ||
        Array.isArray(progress)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid student progress data.",
        },
        { status: 400 }
      );
    }

    const rawProgress =
      progress as
        | StudentProgress
        | undefined;

    // ==================================================
    // NORMALIZE PROFILE
    // ==================================================

    const normalizedProfile = {
      university: limitString(
        rawProfile.university,
        "University not specified"
      ),

      college: limitString(
        rawProfile.college,
        "College not specified"
      ),

      branch: limitString(
        rawProfile.branch,
        "Branch not specified"
      ),

      semester:
        typeof rawProfile.semester ===
          "number" ||
        typeof rawProfile.semester ===
          "string"
          ? String(
              rawProfile.semester
            ).slice(0, 50)
          : "Not specified",

      target_role: limitString(
        rawProfile.target_role,
        "Software Engineer"
      ),

      company_tier: limitString(
        rawProfile.company_tier,
        "Not specified"
      ),

      skill_level: limitString(
        rawProfile.skill_level,
        "Beginner"
      ),
    };

    // ==================================================
    // NORMALIZE PROGRESS
    // ==================================================

    const normalizedProgress = {
      dsa: normalizeProgressValue(
        rawProgress?.dsa
      ),

      skills:
        normalizeProgressValue(
          rawProgress?.skills
        ),

      projects:
        normalizeProgressValue(
          rawProgress?.projects
        ),
    };

    // ==================================================
    // DETERMINE WEAK AREAS
    // ==================================================

    const weakAreas: string[] = [];

    if (
      normalizedProgress.skills < 5
    ) {
      weakAreas.push(
        "technical skill development"
      );
    }

    if (
      normalizedProgress.dsa < 5
    ) {
      weakAreas.push(
        "DSA and problem solving"
      );
    }

    if (
      normalizedProgress.projects < 1
    ) {
      weakAreas.push(
        "practical project development"
      );
    }

    if (weakAreas.length === 0) {
      weakAreas.push(
        "interview-level depth and advanced preparation"
      );
    }

    // ==================================================
    // AI PROMPT
    // ==================================================

    const prompt = `
You are the AI Roadmap Engine for Vertex, a placement-readiness platform.

Your job is to create a realistic, personalized, six-week placement preparation roadmap.

Do NOT create a generic roadmap.

The roadmap MUST be based on the student's actual profile and current progress.

==================================================
STUDENT PROFILE
==================================================

University:
${normalizedProfile.university}

College:
${normalizedProfile.college}

Branch:
${normalizedProfile.branch}

Semester:
${normalizedProfile.semester}

Target Role:
${normalizedProfile.target_role}

Company Tier:
${normalizedProfile.company_tier}

Current Skill Level:
${normalizedProfile.skill_level}

==================================================
CURRENT VERTEX PROGRESS
==================================================

DSA Problems Solved:
${normalizedProgress.dsa}

Technical Skills:
${normalizedProgress.skills}

Projects:
${normalizedProgress.projects}

==================================================
IDENTIFIED WEAK AREAS
==================================================

${weakAreas
  .map(
    (area) => `- ${area}`
  )
  .join("\n")}

==================================================
PERSONALIZATION RULES
==================================================

1. Generate exactly 6 weeks.

2. The roadmap must specifically prepare the student for:
   ${normalizedProfile.target_role}

3. Respect the student's current skill level:
   ${normalizedProfile.skill_level}

4. Respect the student's current progress:
   ${normalizedProgress.dsa} DSA problems,
   ${normalizedProgress.skills} technical skills,
   ${normalizedProgress.projects} projects.

5. Do not assume advanced knowledge.

6. Every week must contain DSA practice.

7. Every week must contain practical tasks.

8. Include project work progressively rather than repeating the same projecttask.

9. Prioritize weak areas identified above.

10. Because the student is in semester ${normalizedProfile.semester}, keep the plan realistic alongside college studies.

11. Consider the company tier:
   ${normalizedProfile.company_tier}

12. Prefer technologies and concepts relevant to the target role.

13. Avoid unnecessary technologies that are unrelated to the target role.

14. Move from fundamentals toward interview readiness.

15. Week 1 should address the most important foundational gaps.

16. Weeks 2-4 should build technical depth and practical ability.

17. Week 5 should emphasize integration, projects and interview-oriented preparation.

18. Week 6 should emphasize revision, mock interview preparation, DSA revision and placement readiness.

19. Do not invent personal achievements, experience, companies visited, or skills that were not supplied.

20. Do not claim that the student has completed anything unless it is present in the supplied progress.

21. Make tasks measurable whenever possible.

22. The roadmap should be actionable for a college student.

==================================================
DSA RULES
==================================================

DSA must appear every week.

Adapt DSA difficulty to the student's current level.

Current DSA solved:
${normalizedProgress.dsa}

Do not suddenly assign advanced competitive-programming topics to a beginner.

==================================================
PROJECT RULES
==================================================

Current projects:
${normalizedProgress.projects}

If projects = 0:
start with a small practical project.

If projects >= 1:
focus on improving, extending, documenting, testing or deploying existing projects before unnecessarily starting many new projects.

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.

Do not use Markdown.

Do not wrap the response in \`\`\`json.

Use exactly this structure:

{
  "summary": "Short assessment of the student's current preparation.",
  "readiness_focus": "The single most important preparation priority right now.",
  "weeks": [
    {
      "week": 1,
      "title": "Week title",
      "goal": "Main goal for this week",
      "topics": [
        "topic 1",
        "topic 2",
        "topic 3"
      ],
      "tasks": [
        "measurable task 1",
        "measurable task 2",
        "measurable task 3"
      ],
      "dsa": [
        "DSA topic or problem pattern 1",
        "DSA topic or problem pattern 2"
      ],
      "project": "Practical project task for this week",
      "priority": "High"
    }
  ]
}

The priority field MUST be exactly:

High
Medium
Low

The weeks array MUST contain exactly 6 objects.
`;

    // ==================================================
    // GENERATE ROADMAP WITH TIMEOUT + RETRIES
    // ==================================================

    let response:
      | { text?: string }
      | null = null;

    for (
      let attempt = 0;
      attempt <= MAX_GEMINI_RETRIES;
      attempt++
    ) {
      try {
        response =
          await withTimeout(
            ai.models.generateContent({
              model:
                "gemini-3.6-flash",
              contents: prompt,
            }),
            GEMINI_TIMEOUT_MS
          );

        break;
      } catch (error) {
        if (isQuotaError(error)) {
          throw error;
        }

        if (
          !isTemporaryGeminiError(
            error
          ) ||
          attempt ===
            MAX_GEMINI_RETRIES
        ) {
          throw error;
        }

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              500 *
                (attempt + 1)
            )
        );
      }
    }

    if (!response) {
      throw new Error(
        "AI roadmap generation failed."
      );
    }

    // ==================================================
    // READ AI RESPONSE
    // ==================================================

    const text =
      typeof response.text ===
      "string"
        ? response.text
        : "";

    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "AI returned an empty roadmap. Please try again.",
        },
        { status: 500 }
      );
    }

    // ==================================================
    // CLEAN RESPONSE
    // ==================================================

    const cleaned =
      cleanAIResponse(text);

    // ==================================================
    // PARSE JSON
    // ==================================================

    let roadmap:
      | RoadmapResponse
      | null = null;

    try {
      const parsed =
        JSON.parse(cleaned);

      roadmap =
        parsed as RoadmapResponse;
    } catch (error) {
      console.error(
        "AI ROADMAP JSON PARSE FAILED:",
        error instanceof Error
          ? error.name
          : "UnknownError"
      );

      return NextResponse.json(
        {
          error:
            "AI returned an invalid roadmap format. Please generate it again.",
        },
        { status: 500 }
      );
    }

    // ==================================================
    // VALIDATE ROOT RESPONSE
    // ==================================================

    if (
      !roadmap ||
      typeof roadmap !==
        "object" ||
      Array.isArray(roadmap)
    ) {
      return NextResponse.json(
        {
          error:
            "AI returned an invalid roadmap.",
        },
        { status: 500 }
      );
    }

    if (
      typeof roadmap.summary !==
        "string" ||
      typeof roadmap.readiness_focus !==
        "string" ||
      !Array.isArray(
        roadmap.weeks
      )
    ) {
      return NextResponse.json(
        {
          error:
            "AI returned an incomplete roadmap.",
        },
        { status: 500 }
      );
    }

    // ==================================================
    // STRICT SIX-WEEK VALIDATION
    // ==================================================

    const validWeeks =
      roadmap.weeks.filter(
        isValidWeek
      );

    if (
      roadmap.weeks.length !== 6 ||
      validWeeks.length !== 6
    ) {
      console.error(
        "AI ROADMAP WEEK VALIDATION FAILED"
      );

      return NextResponse.json(
        {
          error:
            "AI generated an incomplete six-week roadmap. Please try again.",
        },
        { status: 500 }
      );
    }

    // ==================================================
    // NORMALIZE WEEKS
    // ==================================================

    const weeks = validWeeks.map(
      (week, index) => ({
        ...week,

        week: index + 1,

        title: week.title
          .trim()
          .slice(
            0,
            300
          ),

        goal: week.goal
          .trim()
          .slice(
            0,
            1000
          ),

        topics: week.topics
          .filter(
            (
              topic
            ): topic is string =>
              typeof topic ===
              "string"
          )
          .map((topic) =>
            topic
              .trim()
              .slice(
                0,
                300
              )
          )
          .filter(
            Boolean
          )
          .slice(0, 8),

        tasks: week.tasks
          .filter(
            (
              task
            ): task is string =>
              typeof task ===
              "string"
          )
          .map((task) =>
            task
              .trim()
              .slice(
                0,
                500
              )
          )
          .filter(
            Boolean
          )
          .slice(0, 8),

        dsa: week.dsa
          .filter(
            (
              item
            ): item is string =>
              typeof item ===
              "string"
          )
          .map((item) =>
            item
              .trim()
              .slice(
                0,
                300
              )
          )
          .filter(
            Boolean
          )
          .slice(0, 6),

        project:
          week.project
            .trim()
            .slice(
              0,
              1000
            ),
      })
    );

    // ==================================================
    // SAVE ROADMAP TO SUPABASE
    // ==================================================

    const {
      data: savedRoadmap,
      error: saveError,
    } =
      await supabaseAdmin
        .from("ai_roadmaps")
        .insert({
          user_id: userId,

          summary:
            roadmap.summary
              .trim()
              .slice(
                0,
                2000
              ),

          readiness_focus:
            roadmap.readiness_focus
              .trim()
              .slice(
                0,
                2000
              ),

          roadmap: {
            weeks,
          },
        })
        .select(
          "id, user_id, summary, readiness_focus, roadmap, created_at, updated_at"
        )
        .single();

    if (saveError) {
      console.error(
        "AI ROADMAP SAVE FAILED:",
        saveError.name ||
          "DatabaseError"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Roadmap was generated but could not be saved.",
        },
        { status: 500 }
      );
    }

    // ==================================================
    // FINAL RESPONSE
    // ==================================================

    return NextResponse.json({
      success: true,

      roadmap_id:
        savedRoadmap.id,

      summary:
        roadmap.summary
          .trim(),

      readiness_focus:
        roadmap.readiness_focus
          .trim(),

      weeks,

      saved_at:
        savedRoadmap.created_at,
    });
  } catch (error: unknown) {
    const errorName =
      error instanceof Error
        ? error.name
        : "UnknownError";

    const message =
      error instanceof Error
        ? error.message
        : "";

    // Log only safe diagnostic information.
    // Never return the raw internal error to the client.
    console.error(
      "AI ROADMAP ERROR:",
      errorName
    );

    // ==================================================
    // QUOTA
    // ==================================================

    if (
      isQuotaError(error)
    ) {
      return NextResponse.json(
        {
          error:
            "AI quota has been exceeded. Please try again later.",
        },
        { status: 429 }
      );
    }

    // ==================================================
    // TIMEOUT
    // ==================================================

    if (
      message
        .toLowerCase()
        .includes("timed out")
    ) {
      return NextResponse.json(
        {
          error:
            "AI roadmap generation took too long. Please try again.",
        },
        { status: 504 }
      );
    }

    // ==================================================
    // TEMPORARY AI FAILURE
    // ==================================================

    if (
      isTemporaryGeminiError(
        error
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The AI service is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 }
      );
    }

    // ==================================================
    // GENERIC ERROR
    // ==================================================

    return NextResponse.json(
      {
        error:
          "Unable to generate your AI roadmap. Please try again.",
      },
      { status: 500 }
    );
  }
}