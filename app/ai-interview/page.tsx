"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ======================================================
// TYPES
// ======================================================

type Difficulty = "Beginner" | "Intermediate" | "Advanced";
type Mode = "Technical" | "HR" | "Mixed";

type InterviewAnswer = {
questionNumber: number;
question: string;
answer: string;
score: number;
feedback: string;
};

type InterviewResponse = {
score: number;
verdict: string;
whatYouDidWell: string;
whatIsMissing: string;
interviewerFeedback: string;
idealAnswer: string;
improvementTip: string;
nextQuestion: string;
};

type FinalReport = {
overallScore: number;
percentage: number;
averageScore: number;
strengths: string;
weaknesses: string;
improvementPlan: string;
};

type ApiResponse = {
success?: boolean;
answer?: string;
recommendation?: string;
error?: string;
errorCode?: string;
};

// ======================================================
// CONSTANTS
// ======================================================

const TOTAL_QUESTIONS = 10;
const QUOTA_COOLDOWN_SECONDS = 60;

// ======================================================
// HELPERS
// ======================================================

function extractSection(
text: string,
label: string,
nextLabels: string[]
) {
const escapedLabel = label.replace(
/[.*+?^${}()|[]\]/g,
"\$&"
);

const nextPattern =
nextLabels.length > 0
? `(?=\\n(?:${nextLabels
          .map((item) =>
            item.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )
          )
          .join("|")}))`
: "$";

const regex = new RegExp(
`${escapedLabel}\\s*(.*?)(?:${nextPattern})`,
"is"
);

const match = text.match(regex);

return match?.[1]?.trim() || "";
}

function parseScore(text: string): number {
const match = text.match(
/SCORE\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i
);

if (!match) return 0;

const score = Number(match[1]);

if (Number.isNaN(score)) return 0;

return Math.min(Math.max(score, 0), 10);
}

function parseInterviewResponse(
text: string
): InterviewResponse {
return {
score: parseScore(text),


verdict:
  extractSection(text, "VERDICT:", [
    "WHAT YOU DID WELL:",
    "WHAT IS MISSING:",
    "INTERVIEWER FEEDBACK:",
    "IDEAL ANSWER:",
    "IMPROVEMENT TIP:",
    "NEXT QUESTION:",
  ]) || "Your answer needs further evaluation.",

whatYouDidWell:
  extractSection(text, "WHAT YOU DID WELL:", [
    "WHAT IS MISSING:",
    "INTERVIEWER FEEDBACK:",
    "IDEAL ANSWER:",
    "IMPROVEMENT TIP:",
    "NEXT QUESTION:",
  ]) || "Your answer addressed the main topic.",

whatIsMissing:
  extractSection(text, "WHAT IS MISSING:", [
    "INTERVIEWER FEEDBACK:",
    "IDEAL ANSWER:",
    "IMPROVEMENT TIP:",
    "NEXT QUESTION:",
  ]) || "Try adding more relevant technical details.",

interviewerFeedback:
  extractSection(text, "INTERVIEWER FEEDBACK:", [
    "IDEAL ANSWER:",
    "IMPROVEMENT TIP:",
    "NEXT QUESTION:",
  ]) ||
  "Try to provide a clearer and more structured explanation.",

idealAnswer:
  extractSection(text, "IDEAL ANSWER:", [
    "IMPROVEMENT TIP:",
    "NEXT QUESTION:",
  ]) ||
  "Provide a clear, structured answer with relevant examples.",

improvementTip:
  extractSection(text, "IMPROVEMENT TIP:", [
    "NEXT QUESTION:",
  ]) ||
  "Practice explaining concepts using simple examples.",

nextQuestion:
  extractSection(text, "NEXT QUESTION:", []) ||
  "Let's continue with the next interview question.",


};
}

// ======================================================
// PAGE
// ======================================================

export default function AIInterviewPage() {
// ----------------------------------------------------
// INTERVIEW SETTINGS
// ----------------------------------------------------

const [role, setRole] =
useState("Full Stack Developer");

const [difficulty, setDifficulty] =
useState<Difficulty>("Beginner");

const [mode, setMode] =
useState<Mode>("Technical");

// ----------------------------------------------------
// INTERVIEW STATE
// ----------------------------------------------------

const [started, setStarted] = useState(false);

const [questionNumber, setQuestionNumber] =
useState(1);

const [currentQuestion, setCurrentQuestion] =
useState(
"What is the difference between frontend and backend development?"
);

const [answer, setAnswer] = useState("");

const [answers, setAnswers] =
useState<InterviewAnswer[]>([]);

const [feedback, setFeedback] =
useState<InterviewResponse | null>(null);

const [pendingNextQuestion, setPendingNextQuestion] =
useState("");

// ----------------------------------------------------
// LOADING / ERROR
// ----------------------------------------------------

const [loading, setLoading] = useState(false);

const [saving, setSaving] = useState(false);

const [quotaError, setQuotaError] =
useState(false);

const [serviceError, setServiceError] =
useState(false);

const [generalError, setGeneralError] =
useState("");

// ----------------------------------------------------
// 429 COOLDOWN
// ----------------------------------------------------

const [cooldown, setCooldown] = useState(0);

// ----------------------------------------------------
// COMPLETION
// ----------------------------------------------------

const [completed, setCompleted] =
useState(false);

const [finalReport, setFinalReport] =
useState<FinalReport | null>(null);

// ====================================================
// COOLDOWN TIMER
// ====================================================

const isCooldownActive = cooldown > 0;

useEffect(() => {
  if (!isCooldownActive) return;

  const timer = window.setInterval(() => {
    setCooldown((previous) => (previous > 0 ? previous - 1 : 0));
  }, 1000);

  return () => window.clearInterval(timer);
}, [isCooldownActive]);

// ====================================================
// PROGRESS
// ====================================================

const progress = useMemo(() => {
return Math.round(
((questionNumber - 1) / TOTAL_QUESTIONS) * 100
);
}, [questionNumber]);

// ====================================================
// START INTERVIEW
// ====================================================

function startInterview() {
setStarted(true);
setCompleted(false);


setQuestionNumber(1);

setCurrentQuestion(
  "What is the difference between frontend and backend development?"
);

setAnswer("");
setAnswers([]);
setFeedback(null);
setPendingNextQuestion("");

setLoading(false);
setSaving(false);

setQuotaError(false);
setServiceError(false);
setGeneralError("");

setCooldown(0);
setFinalReport(null);


}

// ====================================================
// SAVE INTERVIEW
// ====================================================

async function saveInterview(
finalAnswers: InterviewAnswer[]
) {
setSaving(true);


try {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error(
      "Please log in before saving your interview."
    );
  }

  const totalScore = finalAnswers.reduce(
    (sum, item) => sum + item.score,
    0
  );

  const averageScore =
    finalAnswers.length > 0
      ? totalScore / finalAnswers.length
      : 0;

  const percentage = Math.round(
    (averageScore / 10) * 100
  );

  const strengths = finalAnswers
    .filter((item) => item.score >= 8)
    .map(
      (item) =>
        `Q${item.questionNumber}: ${item.feedback}`
    )
    .join("\n\n");

  const weaknesses = finalAnswers
    .filter((item) => item.score < 8)
    .map(
      (item) =>
        `Q${item.questionNumber}: ${item.feedback}`
    )
    .join("\n\n");

  const improvementPlan =
    "Practice explaining technical concepts with real-world examples. Focus on structured answers, important technical keywords, and concise communication.";

  // ------------------------------------------------
  // CREATE SESSION
  // ------------------------------------------------

  const { data: session, error: sessionError } =
    await supabase
      .from("ai_interview_sessions")
      .insert({
        user_id: user.id,
        role,
        difficulty,
        mode,
        total_questions: TOTAL_QUESTIONS,
        answered_questions: finalAnswers.length,
        total_score: totalScore,
        percentage,
        strengths:
          strengths ||
          "Continue practicing technical concepts.",
        weaknesses:
          weaknesses ||
          "Keep improving answer depth and examples.",
        improvement_plan: improvementPlan,
      } as never)
      .select()
      .single();

  if (sessionError || !session) {
    throw (
      sessionError ||
      new Error("Unable to create interview session.")
    );
  }

  // ------------------------------------------------
  // SAVE ANSWERS
  // ------------------------------------------------

  const answerRows = finalAnswers.map((item) => ({
    session_id: session.id,
    question_number: item.questionNumber,
    question: item.question,
    answer: item.answer,
    score: item.score,
    feedback: item.feedback,
  }));

  const { error: answersError } =
    await supabase
      .from("ai_interview_answers")
      .insert(answerRows as never[]);

  if (answersError) {
    await supabase
      .from("ai_interview_sessions")
      .delete()
      .eq("id", session.id as string);

    throw answersError;
  }

  // ------------------------------------------------
  // FINAL REPORT
  // ------------------------------------------------

  setFinalReport({
    overallScore: totalScore,
    percentage,
    averageScore:
      Math.round(averageScore * 10) / 10,
    strengths:
      strengths ||
      "You completed the interview successfully.",
    weaknesses:
      weaknesses ||
      "Continue practicing to improve technical depth.",
    improvementPlan,
  });

  setCompleted(true);
} catch (error) {
  console.error("SAVE INTERVIEW ERROR:", error);

  setGeneralError(
    error instanceof Error
      ? error.message
      : "Unable to save the interview."
  );
} finally {
  setSaving(false);
}


}

// ====================================================
// SUBMIT ANSWER
// ====================================================

async function submitAnswer(
event?: FormEvent
) {
event?.preventDefault();


// Prevent duplicate requests.
if (loading || saving || feedback) {
  return;
}

// Prevent requests during quota cooldown.
if (cooldown > 0) {
  setQuotaError(true);

  setGeneralError(
    `Please wait ${cooldown} seconds before trying again.`
  );

  return;
}

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

if (!answer.trim()) {
  setGeneralError("Please enter your answer first.");
  return;
}

setLoading(true);

setQuotaError(false);
setServiceError(false);
setGeneralError("");

try {
 const {
  data: { session },
} = await supabase.auth.getSession();

if (!session?.access_token) {
  setGeneralError(
    "Your session has expired. Please log in again."
  );
  return;
}

const response = await fetch(
  "/api/ai-interview",
  {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },

    body: JSON.stringify({
      role,
      difficulty,
      mode,
      question: currentQuestion,
      answer: answer.trim(),
      questionNumber,
      totalQuestions: TOTAL_QUESTIONS,
    }),
  }
);
  let data: ApiResponse | null = null;

  try {
    data = (await response.json()) as ApiResponse;
  } catch {
    data = null;
  }

  // =================================================
  // 429 QUOTA ERROR
  // =================================================

  if (
    response.status === 429 ||
    data?.errorCode === "AI_QUOTA_EXCEEDED"
  ) {
    setQuotaError(true);

    setCooldown(QUOTA_COOLDOWN_SECONDS);

    setGeneralError(
      "The AI usage limit has been reached. Your answer is still محفوظ and has not been lost."
    );

    return;
  }

  // =================================================
  // 503 TEMPORARY SERVICE ERROR
  // =================================================

  if (
    response.status === 503 ||
    data?.errorCode === "AI_SERVICE_UNAVAILABLE"
  ) {
    setServiceError(true);

    setGeneralError(
      "The AI service is temporarily unavailable. Please try again in a moment."
    );

    return;
  }

  // =================================================
  // OTHER API ERRORS
  // =================================================

  if (!response.ok) {
    setGeneralError(
      data?.error ||
        "Unable to evaluate your answer. Please try again."
    );

    return;
  }

  // =================================================
  // SUCCESS
  // =================================================

  const resultText =
    data?.answer ||
    data?.recommendation ||
    "";

  if (!resultText.trim()) {
    setGeneralError(
      "The AI returned an empty response. Please try again."
    );

    return;
  }

  const parsed =
    parseInterviewResponse(resultText);

  // ------------------------------------------------
  // SAVE ANSWER IN MEMORY
  // ------------------------------------------------

  const newAnswer: InterviewAnswer = {
    questionNumber,
    question: currentQuestion,
    answer: answer.trim(),
    score: parsed.score,
    feedback: parsed.interviewerFeedback,
  };

  setAnswers((previous) => [
    ...previous,
    newAnswer,
  ]);

  // ------------------------------------------------
  // STORE FEEDBACK
  // ------------------------------------------------

  setFeedback(parsed);

  // ------------------------------------------------
  // STORE NEXT QUESTION
  // ------------------------------------------------

  setPendingNextQuestion(
    parsed.nextQuestion ||
      "Let's continue with the next interview question."
  );
} catch (error) {
  console.error(
    "AI INTERVIEW ERROR:",
    error
  );

  setGeneralError(
    error instanceof Error
      ? error.message
      : "Unable to connect to the AI service. Please try again."
  );
} finally {
  setLoading(false);
}


}

// ====================================================
// NEXT QUESTION
// ====================================================

async function handleNextQuestion() {
if (loading || saving || !feedback) {
return;
}


// --------------------------------------------------
// FINAL QUESTION
// --------------------------------------------------

if (questionNumber >= TOTAL_QUESTIONS) {
  await saveInterview(answers);

  return;
}

// --------------------------------------------------
// NEXT QUESTION
// --------------------------------------------------

setQuestionNumber((previous) => previous + 1);

setCurrentQuestion(
  pendingNextQuestion ||
    "Let's continue with the next interview question."
);

setAnswer("");

setFeedback(null);
setPendingNextQuestion("");

setQuotaError(false);
setServiceError(false);
setGeneralError("");


}

// ====================================================
// START NEW INTERVIEW
// ====================================================

function startNewInterview() {
startInterview();
}

// ====================================================
// UI - SETUP
// ====================================================

if (!started) {
return ( <main className="min-h-screen bg-slate-950 text-white"> <header className="border-b border-slate-800 bg-slate-950/95"> <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"> <Link
           href="/"
           className="text-2xl font-bold tracking-tight"
         >
Vertex </Link>

```
        <nav className="flex items-center gap-5 text-sm text-slate-300">
          <Link
            href="/roadmap"
            className="hover:text-white"
          >
            Roadmap
          </Link>

          <Link
            href="/dsa"
            className="hover:text-white"
          >
            DSA
          </Link>

          <Link
            href="/projects"
            className="hover:text-white"
          >
            Projects
          </Link>

          <Link
            href="/ai-tutor"
            className="hover:text-white"
          >
            AI Tutor
          </Link>

          <Link
            href="/ai-placement"
            className="hover:text-white"
          >
            AI Placement
          </Link>
        </nav>
      </div>
    </header>

    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-10 text-center">
        <div className="mb-4 text-5xl">
          🎤
        </div>

        <h1 className="text-4xl font-bold">
          AI Interview Preparation
        </h1>

        <p className="mt-3 text-slate-400">
          Practice realistic interviews and get
          instant AI feedback.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Target Role
            </label>

            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value)
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
            >
              <option>
                Full Stack Developer
              </option>
              <option>
                Frontend Developer
              </option>
              <option>
                Backend Developer
              </option>
              <option>
                Software Engineer
              </option>
              <option>
                Data Analyst
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Difficulty
            </label>

            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(
                  event.target.value as Difficulty
                )
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
            >
              <option value="Beginner">
                Beginner
              </option>
              <option value="Intermediate">
                Intermediate
              </option>
              <option value="Advanced">
                Advanced
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Interview Mode
            </label>

            <select
              value={mode}
              onChange={(event) =>
                setMode(
                  event.target.value as Mode
                )
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
            >
              <option value="Technical">
                Technical
              </option>
              <option value="HR">
                HR
              </option>
              <option value="Mixed">
                Mixed
              </option>
            </select>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Interview
            </span>

            <span className="font-semibold">
              10 Questions
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-slate-900 p-3">
              <div className="font-semibold">
                AI
              </div>
              <div className="text-xs text-slate-500">
                Evaluation
              </div>
            </div>

            <div className="rounded-lg bg-slate-900 p-3">
              <div className="font-semibold">
                Score
              </div>
              <div className="text-xs text-slate-500">
                /10
              </div>
            </div>

            <div className="rounded-lg bg-slate-900 p-3">
              <div className="font-semibold">
                Report
              </div>
              <div className="text-xs text-slate-500">
                Saved
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={startInterview}
          className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold transition hover:bg-blue-500"
        >
          Start AI Interview 🚀
        </button>
      </div>
    </section>
  </main>
);


}

// ====================================================
// UI - FINAL REPORT
// ====================================================

if (completed && finalReport) {
return ( <main className="min-h-screen bg-slate-950 text-white"> <header className="border-b border-slate-800"> <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"> <Link
           href="/"
           className="text-2xl font-bold"
         >
Vertex </Link>

```
        <nav className="flex gap-5 text-sm text-slate-300">
          <Link href="/ai-interview">
            AI Interview
          </Link>

          <Link href="/interview-history">
            Interview History
          </Link>

          <Link href="/ai-placement">
            AI Placement
          </Link>
        </nav>
      </div>
    </header>

    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 text-center">
        <div className="text-5xl">
          🎉
        </div>

        <h1 className="mt-4 text-4xl font-bold">
          Interview Complete!
        </h1>

        <p className="mt-2 text-slate-400">
          Your AI interview report has been saved.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="text-sm text-slate-400">
            Overall Score
          </p>

          <p className="mt-2 text-4xl font-bold">
            {Math.round(finalReport.overallScore)}
            /100
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="text-sm text-slate-400">
            Percentage
          </p>

          <p className="mt-2 text-4xl font-bold">
            {finalReport.percentage}%
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="text-sm text-slate-400">
            Average
          </p>

          <p className="mt-2 text-4xl font-bold">
            {finalReport.averageScore}/10
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">
            💪 Strengths
          </h2>

          <p className="mt-4 whitespace-pre-line text-slate-300">
            {finalReport.strengths}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">
            📈 Areas to Improve
          </h2>

          <p className="mt-4 whitespace-pre-line text-slate-300">
            {finalReport.weaknesses}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">
          🧠 Personalized Improvement Plan
        </h2>

        <p className="mt-4 text-slate-300">
          {finalReport.improvementPlan}
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">
          📊 Question-by-Question Scores
        </h2>

        <div className="mt-5 space-y-3">
          {answers.map((item) => (
            <div
              key={item.questionNumber}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <div>
                <span className="font-medium">
                  Question {item.questionNumber}
                </span>

                <p className="mt-1 text-sm text-slate-500">
                  {item.question}
                </p>
              </div>

              <span className="rounded-lg bg-slate-800 px-3 py-2 font-semibold">
                {item.score}/10
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={startNewInterview}
          className="flex-1 rounded-xl bg-blue-600 px-6 py-4 font-semibold hover:bg-blue-500"
        >
          Start New Interview 🎤
        </button>

        <Link
          href="/interview-history"
          className="flex-1 rounded-xl border border-slate-700 px-6 py-4 text-center font-semibold hover:bg-slate-900"
        >
          View Interview History
        </Link>

        <Link
          href="/ai-placement"
          className="flex-1 rounded-xl border border-slate-700 px-6 py-4 text-center font-semibold hover:bg-slate-900"
        >
          View AI Placement
        </Link>
      </div>
    </section>
  </main>
);


}

// ====================================================
// UI - INTERVIEW
// ====================================================

return ( <main className="min-h-screen bg-slate-950 text-white"> <header className="border-b border-slate-800"> <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"> <Link
         href="/"
         className="text-2xl font-bold"
       >
Vertex </Link>


      <div className="text-sm text-slate-400">
        {role} • {difficulty}
      </div>
    </div>
  </header>

  <section className="mx-auto max-w-4xl px-6 py-10">
    {/* PROGRESS */}

    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-400">
          Question {questionNumber} of{" "}
          {TOTAL_QUESTIONS}
        </span>

        <span className="font-medium">
          {progress}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
    </div>

    {/* QUOTA ERROR */}

    {quotaError && (
      <div className="mb-6 rounded-2xl border border-amber-700/50 bg-amber-950/30 p-5">
        <div className="flex gap-3">
          <div className="text-2xl">
            ⚠️
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-amber-300">
              AI quota temporarily unavailable
            </h3>

            <p className="mt-1 text-sm text-amber-200/80">
              Your answer is still محفوظ and has
              not been lost.
            </p>

            {cooldown > 0 ? (
              <div className="mt-4 rounded-lg bg-slate-950/50 p-3">
                <p className="text-sm text-slate-300">
                  Please wait before trying again.
                </p>

                <p className="mt-1 text-2xl font-bold text-amber-300">
                  {cooldown}s
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setQuotaError(false);
                  setGeneralError("");
                  submitAnswer();
                }}
                disabled={loading || saving}
                className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* SERVICE ERROR */}

    {serviceError && !quotaError && (
      <div className="mb-6 rounded-2xl border border-blue-700/50 bg-blue-950/30 p-5">
        <div className="flex gap-3">
          <div className="text-2xl">
            🔄
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-blue-300">
              AI service temporarily unavailable
            </h3>

            <p className="mt-1 text-sm text-blue-200/80">
              Your answer has not been lost. Please
              try again in a moment.
            </p>

            <button
              type="button"
              onClick={() => {
                setServiceError(false);
                setGeneralError("");
                submitAnswer();
              }}
              disabled={loading || saving}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Trying..."
                : "Try Again"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* GENERAL ERROR */}

    {generalError &&
      !quotaError &&
      !serviceError && (
        <div className="mb-6 rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
          {generalError}
        </div>
      )}

    {/* QUESTION */}

    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-xl">
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full bg-blue-600/10 px-3 py-1 text-sm font-medium text-blue-400">
          Question {questionNumber}
        </span>

        <span className="text-sm text-slate-500">
          {mode}
        </span>
      </div>

      <h1 className="text-2xl font-bold leading-relaxed">
        {currentQuestion}
      </h1>

      <form
        onSubmit={submitAnswer}
        className="mt-7"
      >
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Your Answer
        </label>

        <textarea
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);

            if (generalError) {
              setGeneralError("");
            }
          }}
          placeholder="Type your interview answer here..."
          rows={7}
          disabled={loading || saving || !!feedback}
          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        />

        {!feedback && (
          <button
            type="submit"
            disabled={
              loading ||
              saving ||
              cooldown > 0 ||
              !answer.trim()
            }
            className="mt-5 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "🤖 AI is evaluating..."
              : cooldown > 0
              ? `Please wait ${cooldown}s`
              : "Submit Answer →"}
          </button>
        )}
      </form>
    </div>

    {/* FEEDBACK */}

    {feedback && !loading && (
      <div className="mt-6 space-y-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              🤖 AI Feedback
            </h2>

            <div className="rounded-xl bg-blue-600/10 px-4 py-2 font-bold text-blue-400">
              {feedback.score}/10
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-400">
              Verdict
            </p>

            <p className="mt-1 text-slate-200">
              {feedback.verdict}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-400">
              What You Did Well
            </p>

            <p className="mt-1 whitespace-pre-line text-slate-300">
              {feedback.whatYouDidWell}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-400">
              What Is Missing
            </p>

            <p className="mt-1 whitespace-pre-line text-slate-300">
              {feedback.whatIsMissing}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-400">
              Interviewer Feedback
            </p>

            <p className="mt-1 text-slate-300">
              {feedback.interviewerFeedback}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-400">
              Ideal Answer
            </p>

            <p className="mt-1 whitespace-pre-line text-slate-300">
              {feedback.idealAnswer}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-400">
              Improvement Tip
            </p>

            <p className="mt-1 text-slate-300">
              {feedback.improvementTip}
            </p>
          </div>

          {/* NEXT QUESTION BUTTON */}

          <button
            type="button"
            onClick={handleNextQuestion}
            disabled={loading || saving}
            className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "💾 Saving Interview..."
              : questionNumber >= TOTAL_QUESTIONS
              ? "Finish Interview 🎉"
              : "Next Question →"}
          </button>
        </div>
      </div>
    )}

    {/* SAVING */}

    {saving && (
      <div className="mt-6 rounded-2xl border border-blue-800/50 bg-blue-950/20 p-6 text-center">
        <div className="text-3xl">
          💾
        </div>

        <h3 className="mt-3 font-semibold">
          Saving your interview report...
        </h3>

        <p className="mt-2 text-sm text-slate-400">
          Saving all {TOTAL_QUESTIONS} questions
          and scores.
        </p>
      </div>
    )}
  </section>
</main>

);
}
