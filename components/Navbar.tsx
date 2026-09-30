import Link from "next/link";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/curriculum", label: "Curriculum" },
  { href: "/dsa", label: "DSA" },
  { href: "/projects", label: "Projects" },
  { href: "/campus-intel", label: "Campus Intel" },
  { href: "/pods", label: "Pods" },
  { href: "/mentor", label: "Mentors" },
];

const aiLinks = [
  { href: "/ai-tutor", label: "AI Tutor" },
  { href: "/ai-placement", label: "AI Placement" },
  { href: "/ai-interview", label: "AI Interview" },
];

export default function Navbar() {
  return (
    <nav className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 text-2xl font-bold text-blue-500"
        >
          Vertex
        </Link>

        {/* Navigation */}
        <div className="flex flex-1 items-center gap-5 overflow-x-auto">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm text-slate-300 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}

          {/* AI section */}
          <div className="flex items-center gap-4 border-l border-slate-700 pl-5">
            {aiLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-sm text-slate-300 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Profile */}
        <Link
          href="/profile"
          className="shrink-0 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500 hover:text-white"
        >
          Profile
        </Link>
      </div>
    </nav>
  );
}