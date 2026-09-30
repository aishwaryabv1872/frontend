import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Back to Vertex
          </Link>

          <h1 className="mt-4 text-4xl font-bold">
            Vertex Admin
          </h1>

          <p className="mt-2 text-slate-400">
            Manage and moderate the Vertex platform.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/admin/campus-intel"
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500 hover:bg-slate-800"
          >
            <div className="text-3xl">🏫</div>

            <h2 className="mt-4 text-xl font-semibold">
              Campus Intel Moderation
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Review, approve, reject, and manage Campus Intel submissions.
            </p>

            <span className="mt-5 inline-block text-sm font-semibold text-blue-400">
              Open Campus Intel →
            </span>
          </Link>

          <Link
            href="/admin/mentors"
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500 hover:bg-slate-800"
          >
            <div className="text-3xl">👨‍🏫</div>

            <h2 className="mt-4 text-xl font-semibold">
              Mentor Management
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Manage mentor verification and mentor-related administration.
            </p>

            <span className="mt-5 inline-block text-sm font-semibold text-blue-400">
              Open Mentor Management →
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}