import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import {
  checkAiRateLimit,
  cleanupAiRateLimitEntries,
} from "@/lib/security/ai-rate-limit";

const MODEL = "gemini-3.6-flash";

const MAX_QUESTION_LENGTH = 1200;
const MAX_CONTEXT_LENGTH = 14000;
const MAX_COLLEGE_LENGTH = 200;

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

function cleanText(
  value: unknown,
  maxLength: number
): string {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function getErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  return "UnknownError";
}

function getErrorStatus(
  error: unknown
): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error
  ) {
    const status = Number(
      (error as { status?: unknown }).status
    );

    return Number.isFinite(status)
      ? status
      : null;
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
      message.includes("resource_exhausted") ||
      message.includes("resource exhausted") ||
      message.includes("rate limit")
    );
  }

  return false;
}

function isTemporaryGeminiError(
  error: unknown
): boolean {
  const status = getErrorStatus(error);

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    return (
      message.includes("service unavailable") ||
      message.includes("temporarily unavailable") ||
      message.includes("high demand")
    );
  }

  return false;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeoutPromise = new Promise<never>(
    (_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error("Gemini request timed out.")
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Environment validation
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
        "Campus Intel AI configuration is incomplete."
      );

      return NextResponse.json(
        {
          error:
            "Campus Intel AI is temporarily unavailable.",
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
    } =
      await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      console.error(
        "Campus Intel AI authentication failed:",
        getErrorName(authError)
      );

      return NextResponse.json(
        {
          error:
            "Invalid or expired session.",
        },
        {
          status: 401,
        }
      );
    }

    // --------------------------------------------------
    // AI REQUEST RATE LIMIT
    // --------------------------------------------------

    cleanupAiRateLimitEntries();

    const rateLimit = checkAiRateLimit(user.id);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Campus Intel AI request limit reached. Please wait and try again later.",
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
    // 4. Safely parse request body
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

    const requestBody = body as {
      question?: unknown;
      context?: unknown;
      college?: unknown;
    };

    // --------------------------------------------------
    // 5. Validate and limit input
    // --------------------------------------------------

    const question = cleanText(
      requestBody.question,
      MAX_QUESTION_LENGTH
    );

    const context = cleanText(
      requestBody.context,
      MAX_CONTEXT_LENGTH
    );

    const college = cleanText(
      requestBody.college,
      MAX_COLLEGE_LENGTH
    );

    if (!question) {
      return NextResponse.json(
        {
          error: "Please enter a question.",
        },
        {
          status: 400,
        }
      );
    }

    if (!context) {
      return NextResponse.json(
        {
          error:
            "No approved Campus Intel context was provided.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 6. Build Gemini prompt
    // --------------------------------------------------

    const prompt = `You are Vertex AI Campus Intel, a placement-readiness assistant.

Student college: ${college || "Unknown college"}

Use ONLY the approved Campus Intel data supplied below for factual claims about companies, eligibility, packages, cutoffs, interview questions, and student experiences.
Do not invent company visits, salaries, cutoffs, questions, rounds, or experiences.
When the supplied data does not answer something, say that the available Campus Intel data does not contain enough information.
You may give clearly labeled general preparation advice, but do not present general advice as campus-specific facts.

Approved Campus Intel data:
${context}

Student question:
${question}

Answer in a practical placement-focused format.
Start with the direct answer.
Use concise headings and bullets when helpful.
When referring to supplied facts, stay faithful to the data.
End with 2-4 concrete preparation actions when appropriate.`;

    // --------------------------------------------------
    // 7. Gemini client
    // --------------------------------------------------

    const ai = new GoogleGenAI({
      apiKey,
    });

    // --------------------------------------------------
    // 8. Gemini request with timeout + retries
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
            model: MODEL,
            contents: prompt,
            config: {
              systemInstruction:
                "You are a careful campus placement intelligence assistant. Accuracy and source fidelity are more important than sounding confident.",
              temperature: 0.3,
            },
          }),
          GEMINI_TIMEOUT_MS
        );

        break;
      } catch (error) {
        console.error(
          "Campus Intel Gemini error:",
          {
            name: getErrorName(error),
            status: getErrorStatus(error),
            attempt: attempt + 1,
          }
        );

        // Do not retry quota/rate-limit errors.
        if (isQuotaError(error)) {
          return NextResponse.json(
            {
              error:
                "AI quota has been exceeded. Please try again later or use the Campus Intel search and company pages.",
            },
            {
              status: 429,
            }
          );
        }

        // Retry only temporary Gemini failures.
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
    // 9. Validate Gemini response
    // --------------------------------------------------

    const text = response?.text?.trim();

    if (!text) {
      console.error(
        "Campus Intel AI returned an empty response."
      );

      return NextResponse.json(
        {
          error:
            "Campus Intel AI could not generate an answer. Please try again.",
        },
        {
          status: 502,
        }
      );
    }

    // --------------------------------------------------
    // 10. Return safe response
    // --------------------------------------------------

    return NextResponse.json({
      answer: text,
    });
  } catch (error) {
    const status = getErrorStatus(error);

    console.error(
      "Campus Intel AI request failed:",
      {
        name: getErrorName(error),
        status,
      }
    );

    if (isQuotaError(error)) {
      return NextResponse.json(
        {
          error:
            "AI quota has been exceeded. Please try again later or use the Campus Intel search and company pages.",
        },
        {
          status: 429,
        }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "Gemini request timed out."
    ) {
      return NextResponse.json(
        {
          error:
            "Campus Intel AI took too long to respond. Please try again.",
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
            "Gemini is temporarily unavailable. Please try again in a moment.",
        },
        {
          status: 503,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to generate a Campus Intel AI response right now.",
      },
      {
        status: 500,
      }
    );
  }
}