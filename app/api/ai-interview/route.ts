import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import {
  checkAiRateLimit,
  cleanupAiRateLimitEntries,
} from "@/lib/security/ai-rate-limit";

const MODEL = "gemini-3.6-flash";

const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 2000;
const GEMINI_REQUEST_TIMEOUT_MS = 30000;

const MAX_ROLE_LENGTH = 100;
const MAX_DIFFICULTY_LENGTH = 50;
const MAX_MODE_LENGTH = 50;
const MAX_QUESTION_LENGTH = 10000;
const MAX_ANSWER_LENGTH = 15000;

const MAX_TOTAL_QUESTIONS = 100;

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------

type InterviewRequest = {
  role?: unknown;
  difficulty?: unknown;
  mode?: unknown;
  question?: unknown;
  answer?: unknown;
  questionNumber?: unknown;
  totalQuestions?: unknown;
};

// ------------------------------------------------------
// SUPABASE AUTH
// ------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);

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
    console.error("Supabase authentication configuration is missing.");
    return null;
  }

  const accessToken = getBearerToken(request);

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
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return user.id;
}

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
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

function getRetryDelay(error: unknown): number {
  if (!error || typeof error !== "object") {
    return DEFAULT_RETRY_DELAY;
  }

  try {
    const errorString = JSON.stringify(error);

    const match = errorString.match(
      /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/
    );

    if (match) {
      const seconds = Number(match[1]);

      if (Number.isFinite(seconds)) {
        return Math.min(
          Math.max(seconds * 1000, 1000),
          60000
        );
      }
    }
  } catch {
    // Use default delay.
  }

  return DEFAULT_RETRY_DELAY;
}

function isQuotaError(error: unknown): boolean {
  const status = getErrorStatus(error);

  if (status === 429) {
    return true;
  }

  let message = "";

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = "";
    }
  }

  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("resource_exhausted") ||
    normalizedMessage.includes("quota") ||
    normalizedMessage.includes(
      "generate_content_free_tier_requests"
    )
  );
}

function isRetryableError(error: unknown): boolean {
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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>(
    (_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error("GEMINI_REQUEST_TIMEOUT")
        );
      }, timeoutMs);
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

// ------------------------------------------------------
// GEMINI REQUEST WITH SAFE RETRIES + TIMEOUT
// ------------------------------------------------------

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
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
        }),
        GEMINI_REQUEST_TIMEOUT_MS
      );

      const text = response.text?.trim();

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
          "AI Interview Gemini quota exceeded."
        );

        throw new Error("AI_QUOTA_EXCEEDED");
      }

      if (
        error instanceof Error &&
        error.message === "GEMINI_REQUEST_TIMEOUT"
      ) {
        console.warn(
          `Gemini request timed out on attempt ${
            attempt + 1
          }/${MAX_RETRIES}.`
        );

        if (attempt < MAX_RETRIES - 1) {
          await sleep(DEFAULT_RETRY_DELAY);
          continue;
        }

        break;
      }

      const status = getErrorStatus(error);

      if (
        isRetryableError(error) &&
        attempt < MAX_RETRIES - 1
      ) {
        const retryDelay = getRetryDelay(error);

        console.warn(
          `Gemini temporary error (${status}). ` +
            `Retrying attempt ${
              attempt + 2
            }/${MAX_RETRIES} after ${retryDelay}ms...`
        );

        await sleep(retryDelay);

        continue;
      }

      break;
    }
  }

  console.error(
    "Gemini interview request failed.",
    {
      errorName:
        lastError instanceof Error
          ? lastError.name
          : "UnknownError",
      errorStatus: getErrorStatus(lastError),
    }
  );

  throw new Error("AI_SERVICE_UNAVAILABLE");
}

// ------------------------------------------------------
// VALIDATION HELPERS
// ------------------------------------------------------

function isNonEmptyString(
  value: unknown,
  maxLength: number
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function isValidQuestionNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_TOTAL_QUESTIONS
  );
}

function isValidTotalQuestions(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_TOTAL_QUESTIONS
  );
}

// ------------------------------------------------------
// POST
// ------------------------------------------------------

export async function POST(
  request: NextRequest
) {
  try {
    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

    const userId =
      await authenticateRequest(request);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
          errorCode: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // AI REQUEST RATE LIMIT
    // --------------------------------------------------

    cleanupAiRateLimitEntries();

    const rateLimit = checkAiRateLimit(userId);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI Interview request limit reached. Please wait and try again later.",
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

    // --------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------

    let body: InterviewRequest;

    try {
      body =
        (await request.json()) as InterviewRequest;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
          errorCode: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    const {
      role,
      difficulty,
      mode,
      question,
      answer,
      questionNumber = 1,
      totalQuestions = 10,
    } = body;

    // --------------------------------------------------
    // INPUT VALIDATION
    // --------------------------------------------------

    if (
      !isNonEmptyString(
        role,
        MAX_ROLE_LENGTH
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a valid interview role.",
          errorCode: "INVALID_ROLE",
        },
        { status: 400 }
      );
    }

    if (
      !isNonEmptyString(
        difficulty,
        MAX_DIFFICULTY_LENGTH
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a valid interview difficulty.",
          errorCode: "INVALID_DIFFICULTY",
        },
        { status: 400 }
      );
    }

    if (
      !isNonEmptyString(
        mode,
        MAX_MODE_LENGTH
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a valid interview mode.",
          errorCode: "INVALID_MODE",
        },
        { status: 400 }
      );
    }

    if (
      !isNonEmptyString(
        question,
        MAX_QUESTION_LENGTH
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Interview question is required.",
          errorCode: "INVALID_QUESTION",
        },
        { status: 400 }
      );
    }

    if (
      !isNonEmptyString(
        answer,
        MAX_ANSWER_LENGTH
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a valid answer.",
          errorCode: "INVALID_ANSWER",
        },
        { status: 400 }
      );
    }

    if (
      !isValidQuestionNumber(
        questionNumber
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid interview question number.",
          errorCode: "INVALID_QUESTION_NUMBER",
        },
        { status: 400 }
      );
    }

    if (
      !isValidTotalQuestions(
        totalQuestions
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid total question count.",
          errorCode: "INVALID_TOTAL_QUESTIONS",
        },
        { status: 400 }
      );
    }

    if (
      questionNumber > totalQuestions
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Question number cannot exceed total questions.",
          errorCode: "INVALID_QUESTION_RANGE",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // API KEY
    // --------------------------------------------------

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

    // --------------------------------------------------
    // GEMINI CLIENT
    // --------------------------------------------------

    const ai = new GoogleGenAI({
      apiKey,
    });

    // --------------------------------------------------
    // PROMPT
    // --------------------------------------------------

    const prompt = `
You are an expert technical interviewer conducting a real interview.

INTERVIEW DETAILS
-----------------
Role: ${role.trim()}
Difficulty: ${difficulty.trim()}
Mode: ${mode.trim()}

QUESTION ${questionNumber} OF ${totalQuestions}
-----------------

Question:
${question.trim()}

Candidate's Answer:
${answer.trim()}

Evaluate the candidate's answer fairly and professionally.

IMPORTANT:
- Do not be unnecessarily harsh.
- Do not give a perfect score unless the answer is genuinely excellent.
- Focus on technical correctness.
- Consider the selected difficulty.
- Keep feedback practical and interview-focused.
- If the answer is partially correct, clearly explain what is missing.
- Give a better answer that the candidate could use in a real interview.
- Keep the response concise enough to read easily.

Return the response EXACTLY in this structure:

SCORE: X/10

VERDICT:
One short sentence describing the quality of the answer.

WHAT YOU DID WELL:
- Point 1
- Point 2

WHAT IS MISSING:
- Point 1
- Point 2

INTERVIEWER FEEDBACK:
A concise paragraph explaining how the candidate can improve.

IDEAL ANSWER:
A strong interview-ready answer that the candidate could give.

IMPROVEMENT TIP:
One specific actionable tip.

NEXT QUESTION:
Write one relevant technical interview question for the same role and difficulty.

Do not add markdown headings before these labels.
Do not add JSON.
Do not include anything before SCORE.
`;

    // --------------------------------------------------
    // CALL GEMINI
    // --------------------------------------------------

    const result =
      await generateWithRetry(
        ai,
        prompt
      );

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      answer: result,
      recommendation: result,
      questionNumber,
      totalQuestions,
    });
  } catch (error) {
    // Never expose internal error details.
    console.error(
      "AI Interview API Error:",
      {
        errorName:
          error instanceof Error
            ? error.name
            : "UnknownError",
        errorCode:
          error instanceof Error
            ? error.message
            : "UNKNOWN",
      }
    );

    // --------------------------------------------------
    // QUOTA ERROR
    // --------------------------------------------------

    if (
      error instanceof Error &&
      error.message ===
        "AI_QUOTA_EXCEEDED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI quota reached. Please try again later.",
          errorCode:
            "AI_QUOTA_EXCEEDED",
        },
        {
          status: 429,
        }
      );
    }

    // --------------------------------------------------
    // TEMPORARY AI SERVICE ERROR
    // --------------------------------------------------

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
        {
          status: 503,
        }
      );
    }

    // --------------------------------------------------
    // UNKNOWN ERROR
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to generate the AI interview response. Please try again.",
        errorCode:
          "AI_INTERVIEW_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}