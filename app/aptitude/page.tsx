
"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type Question = {
  id: number;
  category: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | null;
};

type AnswerMap = {
  [questionId: number]: string;
};

export default function AptitudePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});

  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [currentIndex, setCurrentIndex] = useState(0);

  const [quizStarted, setQuizStarted] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

  const [score, setScore] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ==========================================
  // LOAD QUESTIONS
  // ==========================================

  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please log in to practice aptitude.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("aptitude_questions")
        .select(
          "id, category, question, option_a, option_b, option_c, option_d, correct_answer, explanation"
        )
        .order("id", { ascending: true });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setQuestions((data as Question[]) || []);
      setLoading(false);
    };

    loadQuestions();
  }, []);

  // ==========================================
  // CATEGORIES
  // ==========================================

  const categories = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(questions.map((question) => question.category))
      ),
    ];
  }, [questions]);

  // ==========================================
  // FILTER QUESTIONS
  // ==========================================

  const filteredQuestions = useMemo(() => {
    if (selectedCategory === "All") {
      return questions;
    }

    return questions.filter(
      (question) =>
        question.category === selectedCategory
    );
  }, [questions, selectedCategory]);

  const currentQuestion =
    filteredQuestions[currentIndex];

  // ==========================================
  // START QUIZ
  // ==========================================

  const startQuiz = () => {
    if (filteredQuestions.length === 0) {
      setMessage("No questions available.");
      return;
    }

    setAnswers({});
    setCurrentIndex(0);
    setScore(0);
    setQuizFinished(false);
    setQuizStarted(true);
    setMessage("");
  };

  // ==========================================
  // SELECT ANSWER
  // ==========================================

  const selectAnswer = (answer: string) => {
    if (!currentQuestion || quizFinished) {
      return;
    }

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.id]: answer,
    }));
  };

  // ==========================================
  // NEXT QUESTION
  // ==========================================

  const nextQuestion = () => {
    if (!currentQuestion) {
      return;
    }

    if (!answers[currentQuestion.id]) {
      setMessage("Please select an answer first.");
      return;
    }

    setMessage("");

    if (
      currentIndex <
      filteredQuestions.length - 1
    ) {
      setCurrentIndex((previous) => previous + 1);
    } else {
      finishQuiz();
    }
  };

  // ==========================================
  // SAVE ATTEMPTS
  // ==========================================

  const finishQuiz = async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in again.");
      setSaving(false);
      return;
    }

    let calculatedScore = 0;

    const attempts = filteredQuestions.map(
      (question) => {
        const selectedAnswer =
          answers[question.id] || null;

        const isCorrect =
          selectedAnswer ===
          question.correct_answer;

        if (isCorrect) {
          calculatedScore++;
        }

        return {
          user_id: user.id,
          category: question.category,
          question_id: question.id,
          selected_answer: selectedAnswer,
          is_correct: isCorrect,
        };
      }
    );

    const { error } = await supabase
      .from("aptitude_attempts")
      .insert(attempts);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setScore(calculatedScore);
    setQuizFinished(true);
    setSaving(false);
  };

  // ==========================================
  // RESTART
  // ==========================================

  const restartQuiz = () => {
    setQuizStarted(false);
    setQuizFinished(false);
    setAnswers({});
    setCurrentIndex(0);
    setScore(0);
    setMessage("");
  };

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Navbar />

        <div className="flex min-h-[80vh] items-center justify-center">
          <p className="text-slate-400">
            Loading aptitude questions...
          </p>
        </div>
      </main>
    );
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <section className="mx-auto max-w-5xl px-6 py-10">

        {/* HEADER */}

        <div>
          <p className="text-sm font-medium text-blue-400">
            VERTEX PLACEMENT PREPARATION
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Aptitude Practice 🧠
          </h1>

          <p className="mt-3 text-slate-400">
            Improve your quantitative aptitude,
            logical reasoning and verbal ability.
          </p>
        </div>

        {/* MESSAGE */}

        {message && (
          <div className="mt-6 rounded-lg border border-red-900 bg-red-950 p-4 text-red-300">
            {message}
          </div>
        )}

        {/* ==========================================
            RESULT
        ========================================== */}

        {quizFinished && (
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">

            <div className="text-5xl">
              {score >=
              filteredQuestions.length * 0.7
                ? "🎉"
                : "💪"}
            </div>

            <h2 className="mt-4 text-3xl font-bold">
              Quiz Completed!
            </h2>

            <p className="mt-3 text-slate-400">
              You scored
            </p>

            <p className="mt-2 text-5xl font-bold text-blue-500">
              {score} / {filteredQuestions.length}
            </p>

            <p className="mt-3 text-slate-400">
              {Math.round(
                (score /
                  filteredQuestions.length) *
                  100
              )}
              % accuracy
            </p>

            <button
              onClick={restartQuiz}
              className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
            >
              Try Again
            </button>

          </div>
        )}

        {/* ==========================================
            QUIZ NOT STARTED
        ========================================== */}

        {!quizStarted && !quizFinished && (
          <>
            {/* CATEGORY */}

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

              <h2 className="text-xl font-semibold">
                Choose a Category
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                {categories.map((category) => {

                  const count =
                    category === "All"
                      ? questions.length
                      : questions.filter(
                          (question) =>
                            question.category ===
                            category
                        ).length;

                  const active =
                    selectedCategory === category;

                  return (
                    <button
                      key={category}
                      onClick={() =>
                        setSelectedCategory(category)
                      }
                      className={`rounded-xl border p-5 text-left transition ${
                        active
                          ? "border-blue-500 bg-blue-950"
                          : "border-slate-700 bg-slate-950 hover:border-slate-500"
                      }`}
                    >

                      <p className="font-semibold">
                        {category}
                      </p>

                      <p className="mt-2 text-sm text-slate-400">
                        {count} questions
                      </p>

                    </button>
                  );
                })}

              </div>

              <button
                onClick={startQuiz}
                className="mt-6 w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
              >
                🚀 Start Quiz
              </button>

            </div>

            {/* INFO */}

            <div className="mt-8 grid gap-6 md:grid-cols-3">

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <div className="text-3xl">
                  🧮
                </div>

                <h3 className="mt-3 font-semibold">
                  Quantitative
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                  Practice percentages,
                  averages, speed and other
                  numerical problems.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <div className="text-3xl">
                  🧠
                </div>

                <h3 className="mt-3 font-semibold">
                  Logical Reasoning
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                  Improve patterns,
                  reasoning and problem-solving.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <div className="text-3xl">
                  📖
                </div>

                <h3 className="mt-3 font-semibold">
                  Verbal Ability
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                  Improve vocabulary,
                  spelling and language skills.
                </p>
              </div>

            </div>
          </>
        )}

        {/* ==========================================
            ACTIVE QUIZ
        ========================================== */}

        {quizStarted &&
          !quizFinished &&
          currentQuestion && (

            <div className="mt-8">

              {/* PROGRESS */}

              <div className="mb-5 flex items-center justify-between text-sm text-slate-400">

                <span>
                  Question {currentIndex + 1} of{" "}
                  {filteredQuestions.length}
                </span>

                <span>
                  {currentQuestion.category}
                </span>

              </div>

              <div className="mb-8 h-2 overflow-hidden rounded-full bg-slate-800">

                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${
                      ((currentIndex + 1) /
                        filteredQuestions.length) *
                      100
                    }%`,
                  }}
                />

              </div>

              {/* QUESTION */}

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-7">

                <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-medium text-blue-300">
                  {currentQuestion.category}
                </span>

                <h2 className="mt-5 text-xl font-semibold leading-8">
                  {currentQuestion.question}
                </h2>

                {/* OPTIONS */}

                <div className="mt-7 space-y-3">

                  {[
                    {
                      key: "A",
                      value:
                        currentQuestion.option_a,
                    },
                    {
                      key: "B",
                      value:
                        currentQuestion.option_b,
                    },
                    {
                      key: "C",
                      value:
                        currentQuestion.option_c,
                    },
                    {
                      key: "D",
                      value:
                        currentQuestion.option_d,
                    },
                  ].map((option) => {

                    const selected =
                      answers[
                        currentQuestion.id
                      ] === option.key;

                    return (
                      <button
                        key={option.key}
                        onClick={() =>
                          selectAnswer(option.key)
                        }
                        className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${
                          selected
                            ? "border-blue-500 bg-blue-950"
                            : "border-slate-700 bg-slate-950 hover:border-slate-500"
                        }`}
                      >

                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold ${
                            selected
                              ? "bg-blue-600 text-white"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {option.key}
                        </span>

                        <span className="text-sm">
                          {option.value}
                        </span>

                      </button>
                    );
                  })}

                </div>

                {/* NEXT */}

                <button
                  onClick={nextQuestion}
                  disabled={saving}
                  className="mt-7 w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : currentIndex ===
                        filteredQuestions.length - 1
                      ? "Finish Quiz"
                      : "Next Question →"}
                </button>

              </div>

            </div>
          )}

      </section>
    </main>
  );
}
