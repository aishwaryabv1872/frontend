import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Judge0Submission = {
  source_code?: unknown;
  language_id?: unknown;
  stdin?: unknown;
};

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const JUDGE0_URL =
  process.env.JUDGE0_API_URL ||
  "http://localhost:2359";

const MAX_SOURCE_CODE_LENGTH = 50_000;
const MAX_STDIN_LENGTH = 10_000;
const JUDGE0_TIMEOUT_MS = 15_000;

/*
 * Vertex-supported languages:
 *
 * 71 = Python
 * 54 = C++
 * 63 = JavaScript
 */
const ALLOWED_LANGUAGE_IDS =
  new Set([
    71,
    54,
    63,
  ]);

function createAuthClient() {
  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    throw new Error(
      "Supabase authentication configuration is unavailable."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function authenticateRequest(
  request: NextRequest
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (!authorization) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        { status: 401 }
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
      error: NextResponse.json(
        {
          success: false,
          error:
            "Invalid authentication header.",
        },
        { status: 401 }
      ),
    };
  }

  const accessToken =
    tokenMatch[1].trim();

  if (!accessToken) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          error:
            "Authentication token is missing.",
        },
        { status: 401 }
      ),
    };
  }

  let authClient;

  try {
    authClient =
      createAuthClient();
  } catch (error) {
    console.error(
      "DSA auth client creation failed:",
      error instanceof Error
        ? error.name
        : "Unknown error"
    );

    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          error:
            "Authentication service is unavailable.",
        },
        { status: 500 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } =
    await authClient.auth.getUser(
      accessToken
    );

  if (authError || !user) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired session.",
        },
        { status: 401 }
      ),
    };
  }

  return {
    user,
    error: null,
  };
}

function isValidSourceCode(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <=
      MAX_SOURCE_CODE_LENGTH
  );
}

function isValidStdin(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length <=
      MAX_STDIN_LENGTH
  );
}

function isValidLanguageId(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    ALLOWED_LANGUAGE_IDS.has(value)
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * -------------------------------------------------------
     * 1. Authenticate the Vertex user
     * -------------------------------------------------------
     */

    const auth =
      await authenticateRequest(
        request
      );

    if (
      auth.error ||
      !auth.user
    ) {
      return (
        auth.error ||
        NextResponse.json(
          {
            success: false,
            error:
              "Authentication required.",
          },
          { status: 401 }
        )
      );
    }

    /*
     * -------------------------------------------------------
     * 2. Parse request body
     * -------------------------------------------------------
     */

    let body: Judge0Submission;

    try {
      body =
        (await request.json()) as Judge0Submission;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const {
      source_code,
      language_id,
      stdin = "",
    } = body;

    /*
     * -------------------------------------------------------
     * 3. Validate source code
     * -------------------------------------------------------
     */

    if (
      !isValidSourceCode(
        source_code
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Source code is required and must be within the allowed size.",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * 4. Validate language
     * -------------------------------------------------------
     */

    if (
      !isValidLanguageId(
        language_id
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This programming language is not supported.",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * 5. Validate stdin
     * -------------------------------------------------------
     */

    if (!isValidStdin(stdin)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Input is invalid or exceeds the allowed size.",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * 6. Call Judge0 with timeout
     * -------------------------------------------------------
     */

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        JUDGE0_TIMEOUT_MS
      );

    const judge0BaseUrl =
      JUDGE0_URL.replace(
        /\/$/,
        ""
      );

    let submissionResponse:
      Response;

    try {
      submissionResponse =
        await fetch(
          `${judge0BaseUrl}/submissions?base64_encoded=false&wait=true`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              source_code,
              language_id,
              stdin,
            }),

            cache: "no-store",

            signal:
              controller.signal,
          }
        );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name ===
          "AbortError"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Code execution timed out.",
          },
          { status: 504 }
        );
      }

      console.error(
        "Judge0 connection failed:",
        error instanceof Error
          ? error.name
          : "Unknown error"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Code execution service is unavailable.",
        },
        { status: 503 }
      );
    } finally {
      clearTimeout(timeout);
    }

    /*
     * -------------------------------------------------------
     * 7. Read Judge0 response
     * -------------------------------------------------------
     */

    const responseText =
      await submissionResponse.text();

    if (
      !submissionResponse.ok
    ) {
      console.error(
        "Judge0 request failed:",
        {
          status:
            submissionResponse.status,
          userId:
            auth.user.id,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Code execution service rejected the request.",
        },
        { status: 502 }
      );
    }

    /*
     * -------------------------------------------------------
     * 8. Parse Judge0 response safely
     * -------------------------------------------------------
     */

    let result: {
      stdout?: string | null;
      stderr?: string | null;
      compile_output?: string | null;
      message?: string | null;
      time?: string | null;
      memory?: number | null;
      status?: {
        id?: number;
        description?: string;
      } | null;
    };

    try {
      result =
        JSON.parse(
          responseText
        );
    } catch {
      console.error(
        "Invalid Judge0 response received."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid response from code execution service.",
        },
        { status: 502 }
      );
    }

    /*
     * -------------------------------------------------------
     * 9. Return execution result
     * -------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      status:
        result.status
          ?.description ??
        "Unknown",

      statusId:
        result.status?.id ??
        null,

      stdout:
        result.stdout ?? "",

      stderr:
        result.stderr ?? "",

      compileOutput:
        result.compile_output ??
        "",

      message:
        result.message ?? "",

      time:
        result.time ?? null,

      memory:
        result.memory ?? null,
    });
  } catch (error) {
    console.error(
      "DSA execution API failed:",
      error instanceof Error
        ? error.name
        : "Unknown error"
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to execute code.",
      },
      { status: 500 }
    );
  }
}