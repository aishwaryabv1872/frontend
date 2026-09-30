import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import {
  checkAiRateLimit,
  cleanupAiRateLimitEntries,
} from "@/lib/security/ai-rate-limit";

const MAX_QUESTION_LENGTH = 10000;
const GEMINI_TIMEOUT_MS = 30000;
const MAX_GEMINI_RETRIES = 2;

function getBearerToken(
  authorization: string | null
): string | null {
  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) return null;

  const token = match[1].trim();

  return token || null;
}

function getErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  return "UnknownError";
}

function getErrorStatus(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error
  ) {
    const status = Number(
      (error as { status?: unknown }).status
    );

    return Number.isFinite(status) ? status : null;
  }

  return null;
}

function isQuotaError(error: unknown): boolean {
  const status = getErrorStatus(error);

  if (status === 429) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    return (
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("resource exhausted")
    );
  }

  return false;
}

function isTemporaryGeminiError(error: unknown): boolean {
  const status = getErrorStatus(error);

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Validate environment
    // --------------------------------------------------

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !apiKey
    ) {
      console.error(
        "AI Tutor configuration is incomplete."
      );

      return NextResponse.json(
        {
          error:
            "AI Tutor is temporarily unavailable.",
        },
        {
          status: 503,
        }
      );
    }

    // --------------------------------------------------
    // 2. Strict Bearer authentication
    // --------------------------------------------------

    const accessToken = getBearerToken(
      request.headers.get("authorization")
    );

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    // --------------------------------------------------
    // 3. Verify Supabase user
    // --------------------------------------------------

    const supabase = createClient(
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
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      console.error(
        "AI Tutor authentication failed:",
        getErrorName(authError)
      );

      return NextResponse.json(
        {
          error: "Invalid or expired session.",
        },
        {
          status: 401,
        }
      );
    }

    // --------------------------------------------------
    // 4. AI request rate limit
    // --------------------------------------------------

    cleanupAiRateLimitEntries();

    const rateLimit = checkAiRateLimit(user.id);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "AI Tutor request limit reached. Please wait and try again later.",
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
    // 5. Safely parse request body
    // --------------------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const rawQuestion = (
      body as {
        question?: unknown;
      }
    ).question;

    // --------------------------------------------------
    // 5. Validate question
    // --------------------------------------------------

    if (
      typeof rawQuestion !== "string" ||
      !rawQuestion.trim()
    ) {
      return NextResponse.json(
        {
          error: "Please enter a valid question.",
        },
        {
          status: 400,
        }
      );
    }

    const question = rawQuestion.trim();

    if (question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        {
          error:
            "Question is too long. Please keep it under 10,000 characters.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 6. Create Gemini client
    // --------------------------------------------------

    const ai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
You are Vertex AI Tutor, an intelligent learning assistant for
college students preparing for placements.

Answer the student's question clearly and accurately.

Student Question:
${question}

Instructions:

* Explain difficult concepts in simple language.
* Use practical examples whenever useful.
* For programming questions, provide clean code examples.
* Explain code step by step when appropriate.
* Use clear headings and bullet points.
* Focus on placement-oriented learning.
* Keep the response helpful and easy for a college student to understand.
* Do not make the answer unnecessarily complicated.
* If the question is unclear, ask the student for clarification.
`;

    // --------------------------------------------------
    // 7. Gemini request with timeout + safe retries
    // --------------------------------------------------

    let response;

    for (
      let attempt = 0;
      attempt <= MAX_GEMINI_RETRIES;
      attempt++
    ) {
      try {
        response = await withTimeout(
          ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
          }),
          GEMINI_TIMEOUT_MS
        );

        break;
      } catch (error) {
        const status = getErrorStatus(error);

        console.error("AI Tutor Gemini error:", {
          name: getErrorName(error),
          status,
          attempt: attempt + 1,
        });

        // Never retry quota/rate-limit errors.
        if (isQuotaError(error)) {
          return NextResponse.json(
            {
              error:
                "AI Tutor usage limit reached. Please try again later.",
            },
            {
              status: 429,
            }
          );
        }

        // Retry only temporary server-side failures.
        if (
          !isTemporaryGeminiError(error) ||
          attempt === MAX_GEMINI_RETRIES
        ) {
          throw error;
        }

        await sleep(500 * (attempt + 1));
      }
    }

    // --------------------------------------------------
    // 8. Validate Gemini response
    // --------------------------------------------------

    const answer = response?.text?.trim();

    if (!answer) {
      console.error(
        "AI Tutor returned an empty response."
      );

      return NextResponse.json(
        {
          error:
            "AI Tutor could not generate an answer. Please try again.",
        },
        {
          status: 502,
        }
      );
    }

    // --------------------------------------------------
    // 9. Return safe response
    // --------------------------------------------------

    return NextResponse.json({
      answer,
    });
  } catch (error) {
    const status = getErrorStatus(error);

    console.error("AI Tutor request failed:", {
      name: getErrorName(error),
      status,
    });

    if (isQuotaError(error)) {
      return NextResponse.json(
        {
          error:
            "AI Tutor usage limit reached. Please try again later.",
        },
        {
          status: 429,
        }
      );
    }

    if (
      error instanceof Error &&
      error.message === "Gemini request timed out."
    ) {
      return NextResponse.json(
        {
          error:
            "AI Tutor took too long to respond. Please try again.",
        },
        {
          status: 504,
        }
      );
    }

    if (isTemporaryGeminiError(error)) {
      return NextResponse.json(
        {
          error:
            "AI Tutor is temporarily unavailable. Please try again.",
        },
        {
          status: 503,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to generate an AI response right now.",
      },
      {
        status: 500,
      }
    );
  }
}