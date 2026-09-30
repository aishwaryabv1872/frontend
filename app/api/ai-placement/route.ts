import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import {
  checkAiRateLimit,
  cleanupAiRateLimitEntries,
} from "@/lib/security/ai-rate-limit";

// ======================================================
// CONFIGURATION
// ======================================================

const MODEL = "gemini-3.6-flash";

const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 2000;
const GEMINI_REQUEST_TIMEOUT_MS = 30000;

const MAX_NAME_LENGTH = 100;
const MAX_BRANCH_LENGTH = 150;
const MAX_SEMESTER_LENGTH = 50;
const MAX_SKILLS_LENGTH = 3000;
const MAX_CAREER_GOAL_LENGTH = 150;
const MAX_TARGET_ROLE_LENGTH = 150;
const MAX_DSA_LEVEL_LENGTH = 100;
const MAX_PROJECT_EXPERIENCE_LENGTH = 3000;

const MAX_READINESS_SCORE = 100;
const MAX_CATEGORY_SCORE = 1000;
const MAX_COUNT = 10000;

// ======================================================
// SUPABASE AUTH
// ======================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getBearerToken(
  request: NextRequest
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const token = match[1].trim();

  return token.length > 0 ? token : null;
}

async function authenticateRequest(
  request: NextRequest
): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase authentication configuration is missing."
    );

    return null;
  }

  const accessToken =
    getBearerToken(request);

  if (!accessToken) {
    return null;
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(
    accessToken
  );

  if (error || !user) {
    return null;
  }

  return user.id;
}

// ======================================================
// VALIDATION HELPERS
// ======================================================

function optionalString(
  value: unknown,
  maxLength: number
): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function numberValue(
  value: unknown,
  fallback = 0
): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function isValidBoundedNumber(
  value: unknown,
  min: number,
  max: number
): boolean {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= min &&
    number <= max
  );
}

// ======================================================
// GEMINI ERROR HELPERS
// ======================================================

function getErrorStatus(
  error: unknown
): number | null {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return null;
  }

  const errorObject = error as {
    status?: number;
    code?: number;
    error?: {
      status?: number;
      code?: number;
    };
  };

  return (
    errorObject.status ??
    errorObject.code ??
    errorObject.error?.status ??
    errorObject.error?.code ??
    null
  );
}

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}

function isQuotaError(
  error: unknown
): boolean {
  const status = getErrorStatus(error);

  if (status === 429) {
    return true;
  }

  const message =
    getErrorMessage(error).toLowerCase();

  return (
    message.includes(
      "resource_exhausted"
    ) ||
    message.includes("quota") ||
    message.includes(
      "generate_content_free_tier_requests"
    )
  );
}

function isRetryableError(
  error: unknown
): boolean {
  const status = getErrorStatus(error);

  if (isQuotaError(error)) {
    return false;
  }

  return (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function getRetryDelay(
  error: unknown
): number {
  try {
    const errorString =
      JSON.stringify(error);

    const match =
      errorString.match(
        /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/
      );

    if (match) {
      const seconds = Number(
        match[1]
      );

      if (Number.isFinite(seconds)) {
        return Math.min(
          Math.max(
            seconds * 1000,
            1000
          ),
          60000
        );
      }
    }
  } catch {
    // Use default delay.
  }

  return DEFAULT_RETRY_DELAY;
}

// ======================================================
// TIMEOUT
// ======================================================

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeoutPromise =
    new Promise<never>(
      (_, reject) => {
        timeoutId = setTimeout(
          () => {
            reject(
              new Error(
                "GEMINI_REQUEST_TIMEOUT"
              )
            );
          },
          timeoutMs
        );
      }
    );

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
// GEMINI REQUEST WITH SAFE RETRIES
// ======================================================

async function generateWithRetry(
  ai: GoogleGenAI,
  prompt: string
): Promise<string> {
  let lastError: unknown = null;

  for (
    let attempt = 0;
    attempt < MAX_RETRIES;
    attempt++
  ) {
    try {
      const response =
        await withTimeout(
          ai.models.generateContent({
            model: MODEL,
            contents: prompt,
          }),
          GEMINI_REQUEST_TIMEOUT_MS
        );

      const text =
        response.text?.trim();

      if (!text) {
        throw new Error(
          "Gemini returned an empty response."
        );
      }

      return text;
    } catch (error) {
      lastError = error;

      if (isQuotaError(error)) {
        console.error(
          "AI Placement Gemini quota exceeded."
        );

        throw new Error(
          "AI_QUOTA_EXCEEDED"
        );
      }

      if (
        error instanceof Error &&
        error.message ===
          "GEMINI_REQUEST_TIMEOUT"
      ) {
        console.warn(
          `Gemini request timed out on attempt ${
            attempt + 1
          }/${MAX_RETRIES}.`
        );

        if (
          attempt <
          MAX_RETRIES - 1
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                DEFAULT_RETRY_DELAY
              )
          );

          continue;
        }

        break;
      }

      if (
        isRetryableError(error) &&
        attempt <
          MAX_RETRIES - 1
      ) {
        const retryDelay =
          getRetryDelay(error);

        console.warn(
          `Gemini temporary error. ` +
            `Retrying attempt ${
              attempt + 2
            }/${MAX_RETRIES} ` +
            `after ${retryDelay}ms...`
        );

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              retryDelay
            )
        );

        continue;
      }

      break;
    }
  }

  console.error(
    "AI Placement Gemini request failed.",
    {
      errorName:
        lastError instanceof Error
          ? lastError.name
          : "UnknownError",
      errorStatus:
        getErrorStatus(lastError),
    }
  );

  throw new Error(
    "AI_SERVICE_UNAVAILABLE"
  );
}

// ======================================================
// POST API
// ======================================================

export async function POST(
  request: NextRequest
) {
  try {
    // ==================================================
    // AUTHENTICATION
    // ==================================================

    const userId =
      await authenticateRequest(
        request
      );

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
          errorCode:
            "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // ==================================================
    // AI REQUEST RATE LIMIT
    // ==================================================

    cleanupAiRateLimitEntries();

    const rateLimit = checkAiRateLimit(userId);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI Placement request limit reached. Please wait and try again later.",
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
    // REQUEST BODY
    // ==================================================

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        (await request.json()) as Record<
          string,
          unknown
        >;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request body.",
          errorCode:
            "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // EXTRACT AND NORMALIZE
    // ==================================================

    const name =
      optionalString(
        body.name,
        MAX_NAME_LENGTH
      );

    const branch =
      optionalString(
        body.branch,
        MAX_BRANCH_LENGTH
      );

    const semester =
      optionalString(
        body.semester,
        MAX_SEMESTER_LENGTH
      );

    const skills =
      optionalString(
        body.skills,
        MAX_SKILLS_LENGTH
      );

    const careerGoal =
      optionalString(
        body.careerGoal,
        MAX_CAREER_GOAL_LENGTH
      );

    const targetRole =
      optionalString(
        body.targetRole,
        MAX_TARGET_ROLE_LENGTH
      );

    const dsaLevel =
      optionalString(
        body.dsaLevel,
        MAX_DSA_LEVEL_LENGTH
      );

    const projectExperience =
      optionalString(
        body.projectExperience,
        MAX_PROJECT_EXPERIENCE_LENGTH
      );

    // ==================================================
    // NUMERIC VALUES
    // ==================================================

    const cgpa =
      numberValue(
        body.cgpa,
        0
      );

    const skillsCount =
      numberValue(
        body.skillsCount,
        0
      );

    const dsaCount =
      numberValue(
        body.dsaCount,
        0
      );

    const projectsCount =
      numberValue(
        body.projectsCount,
        0
      );

    const readinessScore =
      numberValue(
        body.readinessScore,
        0
      );

    const cgpaScore =
      numberValue(
        body.cgpaScore,
        0
      );

    const skillsScore =
      numberValue(
        body.skillsScore,
        0
      );

    const dsaScore =
      numberValue(
        body.dsaScore,
        0
      );

    const projectsScore =
      numberValue(
        body.projectsScore,
        0
      );

    // ==================================================
    // PROFILE VALIDATION
    // ==================================================

    if (
      !name &&
      !careerGoal &&
      !targetRole &&
      !branch &&
      !skills &&
      readinessScore === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide placement profile information before generating a recommendation.",
          errorCode:
            "PROFILE_REQUIRED",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // NUMERIC VALIDATION
    // ==================================================

    if (
      !isValidBoundedNumber(
        cgpa,
        0,
        10
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid CGPA value.",
          errorCode:
            "INVALID_CGPA",
        },
        { status: 400 }
      );
    }

    if (
      !isValidBoundedNumber(
        readinessScore,
        0,
        MAX_READINESS_SCORE
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid readiness score.",
          errorCode:
            "INVALID_READINESS_SCORE",
        },
        { status: 400 }
      );
    }

    const categoryScores = [
      cgpaScore,
      skillsScore,
      dsaScore,
      projectsScore,
    ];

    if (
      categoryScores.some(
        (score) =>
          !isValidBoundedNumber(
            score,
            0,
            MAX_CATEGORY_SCORE
          )
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid placement score.",
          errorCode:
            "INVALID_PLACEMENT_SCORE",
        },
        { status: 400 }
      );
    }

    const counts = [
      skillsCount,
      dsaCount,
      projectsCount,
    ];

    if (
      counts.some(
        (count) =>
          !Number.isInteger(count) ||
          count < 0 ||
          count > MAX_COUNT
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid placement progress count.",
          errorCode:
            "INVALID_PROGRESS_COUNT",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // GEMINI API KEY
    // ==================================================

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        "Gemini API configuration is missing."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The AI service is currently unavailable.",
          errorCode:
            "AI_CONFIGURATION_ERROR",
        },
        { status: 503 }
      );
    }

    // ==================================================
    // GEMINI CLIENT
    // ==================================================

    const ai = new GoogleGenAI({
      apiKey,
    });

    // ==================================================
    // PERSONALIZED AI PROMPT
    // ==================================================

    const prompt = `
You are Vertex AI Placement Assistant, an intelligent career and placement mentor.

Your task is to analyze the student's ACTUAL placement readiness data and provide highly personalized recommendations.

IMPORTANT:
Do NOT assume the student is starting from a blank slate.
Use the exact profile data and readiness scores provided below.

==================================================
STUDENT PROFILE
==================================================

Name: ${name || "Student"}

Career Goal: ${
      careerGoal || "Not specified"
    }

Target Role: ${
      targetRole || "Not specified"
    }

Branch: ${
      branch || "Not specified"
    }

Semester: ${
      semester || "Not specified"
    }

CGPA: ${
      cgpa || "Not specified"
    }

Current Skills: ${
      skills || "Not specified"
    }

Current DSA Level: ${
      dsaLevel || "Not specified"
    }

Project Experience: ${
      projectExperience ||
      "Not specified"
    }

==================================================
PLACEMENT READINESS ANALYSIS
==================================================

Overall Placement Readiness: ${readinessScore}%

CGPA Score: ${cgpaScore} / 20

Skills Score: ${skillsScore} / 30

DSA Score: ${dsaScore} / 25

Projects Score: ${projectsScore} / 25

Number of Skills: ${skillsCount}

Number of DSA Problems Completed: ${dsaCount}

Number of Projects Completed: ${projectsCount}

==================================================
YOUR ANALYSIS RULES
==================================================

Analyze the student's REAL data carefully.

1. Identify the strongest area based on the readiness scores.

2. Identify the weakest area based on the readiness scores.

3. Compare all categories:
   - CGPA
   - Technical Skills
   - DSA
   - Projects

4. Prioritize recommendations based on the LOWEST scores.

5. Do not give generic advice.

6. Mention specific numbers from the student's profile.

7. The student's Career Goal and Target Role must influence the recommendations.

If the target role is Full Stack Developer:
- Prioritize frontend development
- Backend development
- Databases
- APIs
- Authentication
- Deployment
- Real-world projects

If the Career Goal is Internship:
- Focus on building a strong portfolio quickly
- Prioritize practical skills
- Recommend internship-ready projects
- Focus on GitHub and deployment

==================================================
CREATE THE FOLLOWING RESPONSE
==================================================

### 1. PERSONALIZED PLACEMENT READINESS ANALYSIS

Analyze the student's current readiness percentage.

Explain:
- Current placement readiness
- Strongest area
- Weakest area
- Biggest gap

Mention the exact scores.

==================================================

### 2. PRIORITY ACTIONS

Create the top 5 actions the student should take immediately.

Order them from highest priority to lowest priority.

The weakest readiness category should receive the highest priority.

==================================================

### 3. SKILL GAP ANALYSIS

Compare the student's current skills with the requirements of their target role.

Clearly explain:
- Skills already available
- Missing skills
- Most important skills to learn next

==================================================

### 4. DSA IMPROVEMENT PLAN

Based on the student's current DSA progress:

- Recommend the next DSA topics
- Give a realistic problem-solving target
- Create a weekly practice strategy
- Explain how DSA progress affects placement readiness

Do not recommend advanced topics immediately if the student has completed very few DSA problems.

==================================================

### 5. PROJECT STRATEGY

Analyze the student's current project count.

Recommend projects based on their target role.

For each recommended project include:
- Project name
- Technologies
- Difficulty level
- Important features
- What the project demonstrates to recruiters

==================================================

### 6. 30-DAY DYNAMIC ACTION PLAN

Create a realistic 30-day plan based on the student's current weakest areas.

Divide it into:

Week 1
Week 2
Week 3
Week 4

The plan must focus more time on categories with lower readiness scores.

==================================================

### 7. READINESS IMPROVEMENT TARGET

Give realistic target scores.

Example:

Current Readiness: ${readinessScore}%
30-Day Target: Higher than the current score
60-Day Target: Higher than the 30-day score
90-Day Target: Higher than the 60-day score

Explain exactly what the student needs to accomplish to reach each level.

==================================================

### 8. FINAL PERSONALIZED RECOMMENDATION

Give a short and motivating conclusion.

Mention:
- The student's current readiness percentage
- The strongest area
- The most urgent area to improve
- The most important next action

==================================================
RESPONSE STYLE RULES
==================================================

- Be highly personalized.
- Use the student's actual numbers.
- Never say the student is "starting from a blank slate" if profile data exists.
- Do not provide generic recommendations.
- Be practical and realistic.
- Use clear headings and bullet points.
- Do not use markdown tables.
- Keep recommendations focused on improving placement readiness.
`;

    // ==================================================
    // GENERATE
    // ==================================================

    const recommendation =
      await generateWithRetry(
        ai,
        prompt
      );

    // ==================================================
    // SUCCESS
    // ==================================================

    return NextResponse.json(
      {
        success: true,
        recommendation,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error(
      "AI Placement API Error:",
      {
        errorName:
          error instanceof Error
            ? error.name
            : "UnknownError",
        errorCode:
          error instanceof Error
            ? error.message
            : "UNKNOWN",
        errorStatus:
          getErrorStatus(error),
      }
    );

    // ==================================================
    // QUOTA
    // ==================================================

    if (
      error instanceof Error &&
      error.message ===
        "AI_QUOTA_EXCEEDED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The AI request limit has been reached. Please wait and try again later.",
          errorCode:
            "AI_QUOTA_EXCEEDED",
        },
        { status: 429 }
      );
    }

    // ==================================================
    // SERVICE UNAVAILABLE
    // ==================================================

    if (
      error instanceof Error &&
      error.message ===
        "AI_SERVICE_UNAVAILABLE"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The AI service is temporarily unavailable. Please try again in a moment.",
          errorCode:
            "AI_SERVICE_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    // ==================================================
    // UNKNOWN ERROR
    // ==================================================

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to generate your AI placement plan. Please try again.",
        errorCode:
          "AI_PLACEMENT_ERROR",
      },
      { status: 500 }
    );
  }
}