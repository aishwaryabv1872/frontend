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
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1500, 3000, 6000];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type ResumeDraft = {
  name: string;
  targetRole: string;
  careerObjective: string;
  college: string;
  branch: string;
  yearOfStudy: string;
  cgpa: string;
  graduationYear: string;
  skills: string;
  projects: string;
  dsaSummary: string;
};

type ResumeImprovement = {
  section: string;
  current: string;
  suggested: string;
  reason: string;
};

type ResumeAnalysis = {
  score: number;
  atsScore: number;
  skillsScore: number;
  projectsScore: number;
  problemSolvingScore: number;
  educationScore: number;
  impactScore: number;
  clarityScore: number;

  summary: string;

  strengths: string[];
  weaknesses: string[];
  missingInformation: string[];
  atsIssues: string[];

  improvements: ResumeImprovement[];

  parsedResume: ResumeDraft;
};

const EMPTY_DRAFT: ResumeDraft = {
  name: "",
  targetRole: "",
  careerObjective: "",
  college: "",
  branch: "",
  yearOfStudy: "",
  cgpa: "",
  graduationYear: "",
  skills: "",
  projects: "",
  dsaSummary: "",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function clampScore(value: unknown, fallback = 0): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function cleanString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanResumeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Gemini sometimes returns:
 *
 * ```json
 * {...}
 * ```
 *
 * or additional text around the JSON.
 *
 * This function tries to safely extract the JSON object.
 */
function extractJson(text: string): unknown {
  let cleaned = text.trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue below.
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const possibleJson = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(possibleJson);
    } catch {
      // Continue below.
    }
  }

  throw new Error("Gemini returned an invalid JSON response.");
}

function normalizeDraft(value: unknown): ResumeDraft {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_DRAFT };
  }

  const draft = value as Record<string, unknown>;

  return {
    name: cleanString(draft.name),
    targetRole: cleanString(draft.targetRole),
    careerObjective: cleanString(draft.careerObjective),
    college: cleanString(draft.college),
    branch: cleanString(draft.branch),
    yearOfStudy: cleanString(draft.yearOfStudy),
    cgpa: cleanString(draft.cgpa),
    graduationYear: cleanString(draft.graduationYear),
    skills: cleanString(draft.skills),
    projects: cleanString(draft.projects),
    dsaSummary: cleanString(draft.dsaSummary),
  };
}

function normalizeImprovement(value: unknown): ResumeImprovement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    )
    .map((item) => ({
      section: cleanString(item.section),
      current: cleanString(item.current),
      suggested: cleanString(item.suggested),
      reason: cleanString(item.reason),
    }))
    .filter(
      (item) =>
        item.section ||
        item.current ||
        item.suggested ||
        item.reason
    );
}

function normalizeAnalysis(value: unknown): ResumeAnalysis {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini returned an invalid resume analysis.");
  }

  const data = value as Record<string, unknown>;

  return {
    score: clampScore(data.score),
    atsScore: clampScore(data.atsScore),
    skillsScore: clampScore(data.skillsScore),
    projectsScore: clampScore(data.projectsScore),
    problemSolvingScore: clampScore(data.problemSolvingScore),
    educationScore: clampScore(data.educationScore),
    impactScore: clampScore(data.impactScore),
    clarityScore: clampScore(data.clarityScore),

    summary: cleanString(data.summary),

    strengths: cleanStringArray(data.strengths),
    weaknesses: cleanStringArray(data.weaknesses),
    missingInformation: cleanStringArray(data.missingInformation),
    atsIssues: cleanStringArray(data.atsIssues),

    improvements: normalizeImprovement(data.improvements),

    parsedResume: normalizeDraft(data.parsedResume),
  };
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
      const match = object.message.match(/\b(429|500|502|503|504)\b/);

      if (match) {
        return Number(match[1]);
      }
    }
  }

  if (error instanceof Error) {
    const match = error.message.match(/\b(429|500|502|503|504)\b/);

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

function getErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }

  if (typeof error === "object" && error !== null) {
    const object = error as Record<string, unknown>;

    if (typeof object.name === "string") {
      return object.name;
    }
  }

  return "UnknownError";
}
const GEMINI_REQUEST_TIMEOUT_MS = 30000;

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

async function generateWithRetry(
  ai: GoogleGenAI,
  prompt: string
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `VERTEX RESUME AI: Gemini attempt ${attempt + 1}/${MAX_RETRIES + 1}`
      );

      const response = await withTimeout(
  ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  }),
  GEMINI_REQUEST_TIMEOUT_MS
);

      return response;
    } catch (error) {
      lastError = error;

      const retryable = isRetryableError(error);

      console.error(
        `VERTEX RESUME AI ERROR attempt ${attempt + 1}:`,
        getErrorName(error)
      );

      if (!retryable || attempt >= MAX_RETRIES) {
        throw error;
      }

      const delay = RETRY_DELAYS[attempt] ?? 6000;

      console.log(
        `VERTEX RESUME AI: retrying after ${delay}ms...`
      );

      await sleep(delay);
    }
  }

  throw lastError ?? new Error("Gemini request failed.");
}

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required.",
      },
      { status: 401 }
    );
  }

  try {
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      console.error(
        "VERTEX RESUME AUTH ERROR:",
        authError?.name ?? "InvalidUser"
      );

      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired authentication token.",
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
            "Resume Parse request limit reached. Please wait and try again later.",
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

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const rawText = (body as Record<string, unknown>).text;

    if (typeof rawText !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Resume text is required.",
        },
        { status: 400 }
      );
    }

    if (rawText.length > MAX_TEXT_LENGTH * 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Resume text is too large.",
        },
        { status: 413 }
      );
    }

    let resumeText = cleanResumeText(rawText);

    if (!resumeText) {
      return NextResponse.json(
        {
          success: false,
          error: "No resume text was provided.",
        },
        { status: 400 }
      );
    }

    if (resumeText.length > MAX_TEXT_LENGTH) {
      resumeText = resumeText.substring(0, MAX_TEXT_LENGTH);
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        `VERTEX RESUME AI CONFIG ERROR for user ${user.id}: GEMINI_API_KEY missing`
      );

      return NextResponse.json(
        {
          success: false,
          error: "Resume AI is temporarily unavailable.",
        },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
You are Vertex Resume Intelligence, an AI assistant that analyzes student resumes for placement preparation.

Your job has TWO purposes:

1. Analyze the resume truthfully.
2. Extract information from the resume into structured Vertex resume fields.

IMPORTANT TRUTHFULNESS RULES:

- NEVER invent information.
- NEVER create skills that are not present in the resume.
- NEVER create projects that are not present.
- NEVER invent company names.
- NEVER invent internships or work experience.
- NEVER invent certifications.
- NEVER invent achievements.
- NEVER invent DSA problems.
- NEVER invent GitHub links.
- NEVER invent LinkedIn links.
- NEVER invent numbers, percentages, metrics, users, performance improvements, rankings, awards, or statistics.
- NEVER assume a technology was used just because it is common for a particular role.
- NEVER upgrade vague information into a specific claim.
- If information is missing, leave the field empty.
- If something is unclear, put it into missingInformation instead of guessing.
- Suggestions may recommend what the student SHOULD add, but suggestions must clearly be recommendations and must NOT pretend that the student already has them.
- Preserve the user's actual information.
- Do not rewrite factual information into something stronger unless the original resume supports the stronger wording.

TARGET:

The resume is being prepared for placement applications.

Analyze:
- ATS readability
- technical skills
- projects
- problem solving / DSA
- education
- measurable impact
- clarity
- completeness

SCORING:

Return scores from 0 to 100.

score:
Overall resume quality.

atsScore:
How readable and searchable the resume is for ATS systems.

skillsScore:
How clearly relevant technical skills are presented.

projectsScore:
How clearly projects demonstrate technical ability.

problemSolvingScore:
Evidence of DSA/problem-solving/competitive programming.

educationScore:
How clearly education information is presented.

impactScore:
Evidence of quantified results or concrete achievements.
Do NOT penalize a student for not inventing metrics.

clarityScore:
Structure, readability, conciseness, and clarity.

PARSED RESUME FIELDS:

name:
Student's actual name.

targetRole:
Actual target role if explicitly stated.
Otherwise leave empty.

careerObjective:
Actual objective/profile/summary from the resume.
If there is no objective, leave empty.
Do not invent one.

college:
Actual college/university name.

branch:
Actual degree/branch/major.

yearOfStudy:
Actual year of study if present.

cgpa:
Actual CGPA if present.

graduationYear:
Actual graduation year if present.

skills:
A clean comma-separated list of ONLY skills explicitly found in the resume.

projects:
A concise text representation of ONLY projects explicitly found in the resume.
Preserve project names and technologies.
Do not invent descriptions.

dsaSummary:
Only include actual DSA/problem-solving evidence found in the resume.
For example:
- actual number of problems if stated
- actual coding platform if stated
- actual contest/ranking if explicitly stated

If there is no DSA evidence, leave this field empty.

STRENGTHS:

List genuine strengths supported by the resume.

WEAKNESSES:

List actual weaknesses or areas where the resume could be clearer.

MISSING INFORMATION:

List important information that is absent.
Examples:
- GitHub profile not provided
- LinkedIn profile not provided
- DSA evidence not provided
- project impact not quantified
- technical skills section could be more detailed

Do NOT say something is missing if it is actually present.

ATS ISSUES:

List actual ATS-related issues visible in the resume.

IMPROVEMENTS:

Provide actionable recommendations.

Each improvement must contain:

section
current
suggested
reason

The "suggested" field must be truthful.

For example, if the resume says:

"Created a bus tracking website"

A truthful suggestion could be:

"Describe the technologies used and the functionality implemented, if those details are accurate and can be verified."

Do NOT turn it into:

"Improved tracking accuracy by 40%"

unless the resume explicitly says that.

RETURN ONLY VALID JSON.

Do not use markdown.

Use exactly this JSON structure:

{
  "score": 0,
  "atsScore": 0,
  "skillsScore": 0,
  "projectsScore": 0,
  "problemSolvingScore": 0,
  "educationScore": 0,
  "impactScore": 0,
  "clarityScore": 0,
  "summary": "",
  "strengths": [],
  "weaknesses": [],
  "missingInformation": [],
  "atsIssues": [],
  "improvements": [
    {
      "section": "",
      "current": "",
      "suggested": "",
      "reason": ""
    }
  ],
  "parsedResume": {
    "name": "",
    "targetRole": "",
    "careerObjective": "",
    "college": "",
    "branch": "",
    "yearOfStudy": "",
    "cgpa": "",
    "graduationYear": "",
    "skills": "",
    "projects": "",
    "dsaSummary": ""
  }
}

RESUME TEXT:

${resumeText}
`;

    const response = await generateWithRetry(ai, prompt);

    const responseText =
      typeof response.text === "string"
        ? response.text
        : "";

    if (!responseText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Gemini returned an empty response.",
        },
        { status: 502 }
      );
    }

    let parsedJson: unknown;

    try {
      parsedJson = extractJson(responseText);
    } catch (error) {
      console.error(
        `VERTEX RESUME JSON PARSE ERROR for user ${user.id}:`,
        getErrorName(error)
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini returned an invalid response. Please try analyzing the resume again.",
        },
        { status: 502 }
      );
    }

    let analysis: ResumeAnalysis;

    try {
      analysis = normalizeAnalysis(parsedJson);
    } catch (error) {
      console.error(
        `VERTEX RESUME ANALYSIS NORMALIZATION ERROR for user ${user.id}:`,
        getErrorName(error)
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The AI response could not be converted into a valid resume analysis.",
        },
        { status: 502 }
      );
    }

    console.log(
      `VERTEX RESUME AI: analysis completed successfully for user ${user.id}.`
    );

    return NextResponse.json({
      success: true,
      analysis,
      draft: analysis.parsedResume,
    });
  } catch (error) {
    console.error(
      "VERTEX RESUME PARSE ERROR:",
      getErrorName(error)
    );

    const status = getErrorStatus(error);

    if (status === 429) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini rate limit reached. Please wait a little and try again.",
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
            "Gemini is temporarily unavailable after multiple retry attempts. Please try again in a moment.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to analyze the resume.",
      },
      { status: 500 }
    );
  }
}