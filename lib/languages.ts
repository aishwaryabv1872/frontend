export const LANGUAGES = {
  cpp: {
    id: 54,
    name: "C++",
    extension: "cpp",
  },

  c: {
    id: 50,
    name: "C",
    extension: "c",
  },

  python: {
    id: 71,
    name: "Python",
    extension: "py",
  },

  java: {
    id: 62,
    name: "Java",
    extension: "java",
  },

  javascript: {
    id: 63,
    name: "JavaScript",
    extension: "js",
  },

  typescript: {
    id: 74,
    name: "TypeScript",
    extension: "ts",
  },

  go: {
    id: 60,
    name: "Go",
    extension: "go",
  },

  rust: {
    id: 73,
    name: "Rust",
    extension: "rs",
  },
} as const;

export type LanguageKey = keyof typeof LANGUAGES;