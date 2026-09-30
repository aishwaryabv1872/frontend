import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import {
  checkAiRateLimit,
  cleanupAiRateLimitEntries,
} from "@/lib/security/ai-rate-limit";

export const runtime = "nodejs";

const MODEL = "gemini-3.6-flash";

const MAX_TEXT_LENGTH = 30000;
const MAX_FIELD_LENGTH = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1500, 3000, 6000];
const GEMINI_REQUEST_TIMEOUT_MS = 30000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");

  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const token = match[1].trim();

  return token || null;
}

function cleanString(value: unknown, maxLength = MAX_FIELD_LENGTH): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function getErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    typeof (error as Record<string, unknown>).name === "string"
  ) {
    return (error as Record<string, unknown>).name as string;
  }

  return "UnknownError";
}

function getErrorStatus(error: unknown): number | null {
  if (!error) {
    return null;
  }

  if (typeof error === "object") {
    const object = error as Record<string, unknown>;

    if (typeof object.status === "number") {
      return object.status;
    }

    if (typeof object.code === "number") {
      return object.code;
    }

    if (typeof object.status === "string") {
      const status = Number(object.status);

      if (Number.isFinite(status)) {
        return status;
      }
    }

    if (typeof object.message === "string") {
      const match = object.message.match(
        /\b(400|401|403|404|408|429|500|502|503|504)\b/
      );

      if (match) {
        return Number(match[1]);
      }
    }
  }

  if (error instanceof Error) {
    const match = error.message.match(
      /\b(400|401|403|404|408|429|500|502|503|504)\b/
    );

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function isRetryableError(error: unknown): boolean {
  const status = getErrorStatus(error);

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Gemini request timed out."));
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

function extractResumeScore(text: string): number | null {
  const patterns = [
    /Overall Resume Score:\s*(\d{1,3})\s*\/\s*100/i,
    /Current Resume Score:\s*(\d{1,3})\s*\/\s*100/i,
    /Resume Score:\s*(\d{1,3})\s*\/\s*100/i,
    /Score:\s*(\d{1,3})\s*\/\s*100/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const score = Number(match[1]);

      if (score >= 0 && score <= 100) {
        return score;
      }
    }
  }

  return null;
}

async function generateWithRetry(
  ai: GoogleGenAI,
  prompt: string
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `VERTEX RESUME REVIEW AI: Gemini attempt ${
          attempt + 1
        }/${MAX_RETRIES + 1}`
      );

      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            temperature: 0.2,
          },
        }),
        GEMINI_REQUEST_TIMEOUT_MS
      );

      return response;
    } catch (error) {
      lastError = error;

      console.error(
        `VERTEX RESUME REVIEW AI ERROR attempt ${
          attempt + 1
        }:`,
        getErrorName(error)
      );

      if (
        !isRetryableError(error) ||
        attempt >= MAX_RETRIES
      ) {
        throw error;
      }

      const delay =
        RETRY_DELAYS[attempt] ?? 6000;

      console.log(
        `VERTEX RESUME REVIEW AI: retrying after ${delay}ms...`
      );

      await sleep(delay);
    }
  }

  throw (
    lastError ??
    new Error("Gemini request failed.")
  );
}

export async function POST(
  request: NextRequest
) {
  const accessToken =
    getBearerToken(request);

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required.",
      },
      { status: 401 }
    );
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "VERTEX RESUME REVIEW CONFIG ERROR: Supabase environment variables missing."
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Resume review is temporarily unavailable.",
      },
      { status: 503 }
    );
  }

  if (!geminiApiKey) {
    console.error(
      "VERTEX RESUME REVIEW CONFIG ERROR: GEMINI_API_KEY missing."
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Resume review is temporarily unavailable.",
      },
      { status: 503 }
    );
  }

  try {
    const authenticatedSupabase =
      createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        }
      );

    const {
      data: { user },
      error: userError,
    } =
      await authenticatedSupabase.auth.getUser(
        accessToken
      );

    if (userError || !user) {
      console.error(
        "VERTEX RESUME REVIEW AUTH ERROR:",
        userError?.name ?? "InvalidUser"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired authentication token.",
        },
        { status: 401 }
      );
    }

    cleanupAiRateLimitEntries();

    const rateLimit = checkAiRateLimit(user.id);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Resume Review request limit reached. Please wait and try again later.",
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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
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
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const data =
      body as Record<string, unknown>;

    const name = cleanString(data.name);
    const branch = cleanString(data.branch);
    const semester = cleanString(
      data.semester
    );
    const cgpa = cleanString(data.cgpa);
    const skills = cleanString(data.skills);
    const projects = cleanString(
      data.projects
    );
    const dsaProblems = cleanString(
      data.dsaProblems
    );
    const careerGoal = cleanString(
      data.careerGoal
    );
    const targetRole = cleanString(
      data.targetRole
    );
    const companyTier = cleanString(
      data.companyTier
    );
    const resumeText = cleanString(
      data.resumeText,
      MAX_TEXT_LENGTH
    );

    if (!resumeText) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Resume content is empty. Please add some resume information first.",
        },
        { status: 400 }
      );
    }

    if (typeof data.resumeText !== "string") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Resume content must be valid text.",
        },
        { status: 400 }
      );
    }

    if (
      data.resumeText.length >
      MAX_TEXT_LENGTH * 2
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Resume content is too large.",
        },
        { status: 413 }
      );
    }

    if (!targetRole) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Target role is required before reviewing the resume.",
        },
        { status: 400 }
      );
    }

    const selectedCompanyTier =
      companyTier ||
      "Service-Based Company";

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
    });

    const prompt = `
You are an expert technical recruiter and resume reviewer.

Review the following student's resume for placement readiness.

TARGET ROLE:
${targetRole}

TARGET COMPANY TIER:
${selectedCompanyTier}

STUDENT NAME:
${name || "Not provided"}

BRANCH:
${branch || "Not provided"}

YEAR / SEMESTER:
${semester || "Not provided"}

CGPA:
${cgpa || "Not provided"}

CAREER GOAL:
${careerGoal || "Not provided"}

TECHNICAL SKILLS:
${skills || "Not provided"}

PROJECTS:
${projects || "Not provided"}

DSA / PROBLEM SOLVING:
${dsaProblems || "Not provided"}

FULL RESUME:
${resumeText}

IMPORTANT RULES:

1. Use ONLY information explicitly provided in the resume.

2. DO NOT invent:
   - skills
   - technologies
   - projects
   - internships
   - jobs
   - certifications
   - achievements
   - GitHub activity
   - LeetCode activity
   - coding-platform rankings
   - metrics
   - users
   - performance numbers
   - responsibilities
   - tools
   - frameworks
   - programming languages

3. If something is missing, clearly identify it as a GAP.

4. Do not tell the student to claim a skill they do not actually demonstrate.

5. You may recommend learning a missing skill, but clearly label it as a recommendation.

6. Do not automatically assume:
   - Next.js means advanced React
   - Supabase means advanced PostgreSQL
   - TypeScript means advanced JavaScript
   - a project automatically means professional experience

7. Evaluate the resume specifically for:
   ${targetRole}

8. Adjust your discussion according to:
   ${selectedCompanyTier}

9. Be honest and evidence-based.

10. Give practical improvements suitable for a student/fresher.

Return the review using EXACTLY these sections:

1. OVERALL RESUME SCORE
Give one score from 0-100.

Format:
Overall Resume Score: XX/100

2. SCORE BREAKDOWN

Give scores from 0-10 for:

Relevance to Target Role:
Technical Skills:
Projects:
Problem Solving:
Education:
Impact / Achievements:
Clarity:
ATS Readiness:

3. STRENGTHS

List the strongest parts of the current resume.

4. DEMONSTRATED SKILLS

List only technical skills that are explicitly present in the resume.

5. MISSING SKILLS / GAPS

Identify skills or evidence commonly relevant to the target role that are missing.

Do NOT claim the student already knows them.

6. PROJECT ANALYSIS

Analyze the projects currently present.

Mention:
- technical clarity
- project relevance
- implementation detail
- measurable impact if present
- missing information

Do not invent metrics.

7. EXPERIENCE / ACHIEVEMENT GAPS

For a fresher, explain what evidence could strengthen the resume.

Examples may include:
- internships
- hackathons
- certifications
- open-source contributions
- coding practice
- leadership
- measurable project outcomes

Only identify them as missing unless explicitly present.

8. ATS ANALYSIS

Analyze:
- keywords
- structure
- readability
- section organization
- role alignment

9. BULLET / PROJECT IMPROVEMENTS

Give improved examples based ONLY on facts already present.

Do not invent achievements or metrics.

If information is insufficient, explain what additional information should be added.

10. TARGET ROLE GAP

Explain the main gap between the current resume and:

${targetRole}

11. 30-DAY IMPROVEMENT PLAN

Give a practical week-by-week plan:

Week 1:
Week 2:
Week 3:
Week 4:

12. PRIORITY ACTIONS

Give 5 concrete actions ordered by importance.

13. FINAL ASSESSMENT

Give a concise recruiter-style assessment of the current resume.

Do not rank the student against other students.

Remember:
The purpose is to improve the student's resume, not to invent content.
`;

    const response =
      await generateWithRetry(
        ai,
        prompt
      );

    const review =
      response.text?.trim() || "";

    if (!review) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI returned an empty resume review.",
        },
        { status: 502 }
      );
    }

    const resumeScore =
      extractResumeScore(review);

    const {
      data: savedReview,
      error: saveError,
    } =
      await authenticatedSupabase
        .from("resume_reviews")
        .insert({
          user_id: user.id,
          target_role: targetRole,
          company_tier: selectedCompanyTier,
          resume_score: resumeScore,
          review,
        })
        .select()
        .single();

    if (saveError) {
      console.error(
        `VERTEX RESUME REVIEW SAVE ERROR for user ${user.id}:`,
        saveError.name ?? "DatabaseError"
      );

      /*
       * The AI review itself succeeded, so return it
       * without exposing internal database details.
       */
      return NextResponse.json({
        success: true,
        review,
        resumeScore,
        saved: false,
        saveError:
          "Review history could not be saved.",
      });
    }

    return NextResponse.json({
      success: true,
      review,
      resumeScore,
      saved: true,
      reviewId:
        savedReview?.id ?? null,
      reviewRecord: savedReview,
    });
  } catch (error: unknown) {
    console.error(
      "VERTEX RESUME REVIEW API ERROR:",
      getErrorName(error)
    );

    const status =
      getErrorStatus(error);

    if (status === 429) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini request limit was reached. Please try again later.",
        },
        { status: 429 }
      );
    }

    if (
      status === 503 ||
      status === 500 ||
      status === 502 ||
      status === 504
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini is temporarily unavailable. Please try again in a moment.",
        },
        { status: 503 }
      );
    }

    if (status === 404) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The configured Gemini model is unavailable.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to generate AI resume review.",
      },
      { status: 500 }
    );
  }
}