"use client";

import { FormEvent, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

export default function AiTutorPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const askTutor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setError("Please enter a question.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Your session has expired. Please log in again.");
        return;
      }

      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question: trimmedQuestion,
        }),
      });

      let data: { answer?: string; error?: string } = {};

      try {
        data = await response.json();
      } catch {
        throw new Error("Unable to read the AI Tutor response.");
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Something went wrong. Please try again."
        );
      }

      if (!data.answer) {
        throw new Error("The AI Tutor returned an empty response.");
      }

      setAnswer(data.answer);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to AI Tutor."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <section className="mx-auto max-w-5xl px-6 py-12">
        {/* HEADER */}

        <div className="text-center">
          <div className="text-5xl">🤖</div>

          <h1 className="mt-4 text-4xl font-bold text-blue-500">
            Vertex AI Tutor
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Ask questions, understand difficult concepts,
            and prepare smarter for your placements with AI.
          </p>
        </div>

        {/* ASK QUESTION */}

        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">
            Ask your question
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Ask anything about programming, DSA, databases,
            web development, interviews, or placement preparation.
          </p>

          <form onSubmit={askTutor} className="mt-6">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Example: Explain binary search in simple terms..."
              rows={6}
              disabled={loading}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-4 text-white outline-none placeholder:text-slate-500 focus:border-blue-500 disabled:opacity-60"
            />

            {error && (
              <div className="mt-4 rounded-lg bg-red-950 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "🤖 Thinking..." : "✨ Ask Vertex AI"}
            </button>
          </form>
        </div>

        {/* QUICK QUESTIONS */}

        <div className="mt-8">
          <h2 className="text-lg font-semibold">
            Try asking
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              "Explain binary search in simple terms.",
              "What is the difference between let, const and var?",
              "Explain SQL joins with examples.",
              "How should I prepare for a technical interview?",
            ].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setQuestion(item);
                  setError("");
                }}
                disabled={loading}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left text-sm text-slate-300 transition hover:border-blue-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* AI RESPONSE */}

        {answer && (
          <div className="mt-8 rounded-2xl border border-blue-900 bg-slate-900 p-6">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🤖</div>

              <div>
                <h2 className="text-xl font-semibold">
                  Vertex AI Tutor
                </h2>

                <p className="text-sm text-slate-400">
                  AI-generated explanation
                </p>
              </div>
            </div>

            <div className="mt-6 whitespace-pre-wrap leading-7 text-slate-200">
              {answer}
            </div>
          </div>
        )}

        {/* FOOTER */}

        <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
          <p className="text-sm text-slate-400">
            💡 Learn consistently. Practice regularly.
            Let Vertex help you become placement ready.
          </p>
        </div>
      </section>
    </main>
  );
}