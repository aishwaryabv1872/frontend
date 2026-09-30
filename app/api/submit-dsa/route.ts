import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TestCase = {
  input: string;
  expectedOutput: string;
};

type Judge0Result = {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?: {
    id?: number;
    description?: string;
  };
};

type SubmissionBody = {
  problem_id?: unknown;
  source_code?: unknown;
  language_id?: unknown;
};

const JUDGE0_URL =
  process.env.JUDGE0_API_URL || "http://localhost:2359";

const JUDGE0_TIMEOUT_MS = 15_000;

const MAX_SOURCE_CODE_LENGTH = 50_000;

// Supported Vertex languages only:
// Python 71
// C++ 54
// JavaScript 63
const ALLOWED_LANGUAGE_IDS = new Set([
  71,
  54,
  63,
]);

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

const hiddenTests: Record<number, TestCase[]> = {
  // --------------------------------------------------
  // PROBLEM 1
  // --------------------------------------------------
  1: [
    {
      input: "5 7",
      expectedOutput: "12",
    },
    {
      input: "10 20",
      expectedOutput: "30",
    },
    {
      input: "-5 10",
      expectedOutput: "5",
    },
    {
      input: "100 250",
      expectedOutput: "350",
    },
  ],

  // --------------------------------------------------
  // PROBLEM 2
  // --------------------------------------------------
  2: [
    {
      input: `5
1 8 3 2 6`,
      expectedOutput: "8",
    },
    {
      input: `4
10 5 20 3`,
      expectedOutput: "20",
    },
    {
      input: `3
-10 -5 -20`,
      expectedOutput: "-5",
    },
    {
      input: `6
7 7 2 9 4 1`,
      expectedOutput: "9",
    },
  ],

  // --------------------------------------------------
  // PROBLEM 3
  // --------------------------------------------------
  3: [
    {
      input: `6
1 2 3 4 5 6`,
      expectedOutput: "3",
    },
    {
      input: `5
2 4 6 8 10`,
      expectedOutput: "5",
    },
    {
      input: `5
1 3 5 7 9`,
      expectedOutput: "0",
    },
    {
      input: `4
-2 -3 -4 5`,
      expectedOutput: "2",
    },
  ],

  // --------------------------------------------------
  // PROBLEM 4
  // --------------------------------------------------
  4: [
    {
      input: "hello",
      expectedOutput: "olleh",
    },
    {
      input: "vertex",
      expectedOutput: "xetrev",
    },
    {
      input: "coding",
      expectedOutput: "gnidoc",
    },
    {
      input: "abc",
      expectedOutput: "cba",
    },
  ],

  // --------------------------------------------------
  // PROBLEM 5
  // --------------------------------------------------
  5: [
    {
      input: "5",
      expectedOutput: "120",
    },
    {
      input: "0",
      expectedOutput: "1",
    },
    {
      input: "1",
      expectedOutput: "1",
    },
    {
      input: "6",
      expectedOutput: "720",
    },
  ],
};

function normalizeOutput(
  value: string | null | undefined
) {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\s+/g, " ");
}

function parseBearerToken(
  request: NextRequest
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return match?.[1]?.trim() || null;
}

function isValidProblemId(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 100000
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

function isJudge0Result(
  value: unknown
): value is Judge0Result {
  return (
    typeof value === "object" &&
    value !== null
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    // --------------------------------------------------
    // 1. AUTHENTICATE USER
    // --------------------------------------------------

    const accessToken =
      parseBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    const {
      data: {
        user,
      },
      error: authError,
    } = await supabase.auth.getUser(
      accessToken
    );

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. PARSE REQUEST BODY
    // --------------------------------------------------

    let body: SubmissionBody;

    try {
      body =
        (await request.json()) as SubmissionBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const {
      problem_id,
      source_code,
      language_id,
    } = body;

    // --------------------------------------------------
    // 3. VALIDATE PROBLEM
    // --------------------------------------------------

    if (
      !isValidProblemId(
        problem_id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid problem_id.",
        },
        { status: 400 }
      );
    }

    const tests =
      hiddenTests[problem_id];

    if (!tests) {
      return NextResponse.json(
        {
          error:
            "Problem not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 4. VALIDATE SOURCE CODE
    // --------------------------------------------------

    if (
      typeof source_code !==
        "string" ||
      source_code.trim()
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "source_code is required.",
        },
        { status: 400 }
      );
    }

    if (
      source_code.length >
      MAX_SOURCE_CODE_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            "Source code is too large.",
        },
        { status: 413 }
      );
    }

    // --------------------------------------------------
    // 5. VALIDATE LANGUAGE
    // --------------------------------------------------

    if (
      !isValidLanguageId(
        language_id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported language.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 6. RUN HIDDEN TESTS
    // --------------------------------------------------

    const results: Array<{
      test: number;
      passed: boolean;
      status?: string;
      time?: string | null;
      memory?: number | null;
      error?: string;
    }> = [];

    let passedTests = 0;

    for (
      let i = 0;
      i < tests.length;
      i++
    ) {
      const test =
        tests[i];

      try {
        const controller =
          new AbortController();

        const timeout =
          setTimeout(
            () =>
              controller.abort(),
            JUDGE0_TIMEOUT_MS
          );

        let judgeResponse: Response;

        try {
          judgeResponse =
            await fetch(
              `${JUDGE0_URL.replace(
                /\/$/,
                ""
              )}/submissions?base64_encoded=false&wait=true`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  source_code,
                  language_id,
                  stdin:
                    test.input,
                }),
                cache:
                  "no-store",
                signal:
                  controller.signal,
              }
            );
        } finally {
          clearTimeout(
            timeout
          );
        }

        let responseData: unknown;

        try {
          responseData =
            await judgeResponse.json();
        } catch {
          results.push({
            test: i + 1,
            passed: false,
            error:
              "Invalid Judge0 response.",
          });

          break;
        }

        if (
          !judgeResponse.ok
        ) {
          console.error(
            "Judge0 submission failed:",
            {
              status:
                judgeResponse.status,
              userId:
                user.id,
              problemId:
                problem_id,
            }
          );

          results.push({
            test: i + 1,
            passed: false,
            error:
              "Judge0 execution failed.",
          });

          break;
        }

        if (
          !isJudge0Result(
            responseData
          )
        ) {
          results.push({
            test: i + 1,
            passed: false,
            error:
              "Invalid Judge0 response.",
          });

          break;
        }

        const result =
          responseData;

        const actualOutput =
          normalizeOutput(
            result.stdout
          );

        const expectedOutput =
          normalizeOutput(
            test.expectedOutput
          );

        const passed =
          result.status?.id ===
            3 &&
          actualOutput ===
            expectedOutput;

        if (passed) {
          passedTests++;
        }

        results.push({
          test: i + 1,
          passed,
          status:
            result.status
              ?.description ??
            "Unknown",
          time:
            result.time ??
            null,
          memory:
            result.memory ??
            null,
        });

        // Stop immediately
        // when a hidden test fails.
        if (!passed) {
          break;
        }
      } catch (error) {
        if (
          error instanceof
            Error &&
          error.name ===
            "AbortError"
        ) {
          results.push({
            test: i + 1,
            passed: false,
            error:
              "Execution timed out.",
          });
        } else {
          console.error(
            "DSA hidden test execution error:",
            {
              userId:
                user.id,
              problemId:
                problem_id,
              test:
                i + 1,
              error:
                error instanceof
                Error
                  ? error.name
                  : "UnknownError",
            }
          );

          results.push({
            test: i + 1,
            passed: false,
            error:
              "Execution error.",
          });
        }

        break;
      }
    }

    // --------------------------------------------------
    // 7. CALCULATE VERDICT
    // --------------------------------------------------

    const totalTests =
      tests.length;

    const accepted =
      passedTests ===
      totalTests;

    const score =
      Math.round(
        (passedTests /
          totalTests) *
          100
      );

    const verdict =
      accepted
        ? "Accepted"
        : "Wrong Answer";

    // --------------------------------------------------
    // 8. RETURN SAFE RESPONSE
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      problemId:
        problem_id,
      verdict,
      accepted,
      passedTests,
      totalTests,
      score,
      results,
    });
  } catch (error) {
    console.error(
      "DSA SUBMISSION ERROR:",
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return NextResponse.json(
      {
        error:
          "Unable to submit solution.",
      },
      { status: 500 }
    );
  }
}