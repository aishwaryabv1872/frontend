/**
 * ============================================================
 * Vertex — VTU Content Review Subject Inspector
 * ============================================================
 *
 * READ-ONLY
 *
 * Purpose:
 *   Inspect the four remaining content-review subjects from
 *   the Semester 1 JSON validation report.
 *
 * Subjects:
 *   BESCK104E
 *   BETCK105C
 *   BETCK105D
 *   BPOPS103
 *
 * IMPORTANT:
 *   This script NEVER modifies JSON files.
 *   This script NEVER modifies Supabase.
 * ============================================================
 */

import fs from "fs";
import path from "path";

// ============================================================
// PATHS
// ============================================================

const ROOT = process.cwd();

const BRANCH_DIR = path.join(
  ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE"
);

const SUBJECTS_DIR = path.join(
  BRANCH_DIR,
  "subjects"
);

// ============================================================
// SUBJECTS
// ============================================================

const REVIEW_CODES = [
  "BESCK104E",
  "BETCK105C",
  "BETCK105D",
  "BPOPS103",
];

// ============================================================
// HELPERS
// ============================================================

function section(title) {
  console.log("");
  console.log("=".repeat(90));
  console.log(title);
  console.log("=".repeat(90));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

function printJson(label, value) {
  console.log("");
  console.log(`--- ${label} ---`);

  if (
    value === undefined ||
    value === null
  ) {
    console.log("(none)");
    return;
  }

  console.log(
    JSON.stringify(
      value,
      null,
      2
    )
  );
}

// ============================================================
// SOURCE DISCOVERY
// ============================================================

function findSourceFiles(code) {
  const results = [];

  function walk(dir) {
    if (!exists(dir)) {
      return;
    }

    const entries = fs
      .readdirSync(dir, {
        withFileTypes: true,
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    for (const entry of entries) {
      const fullPath = path.join(
        dir,
        entry.name
      );

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const lower =
        entry.name.toLowerCase();

      if (
        lower.includes(
          code.toLowerCase()
        ) &&
        (
          lower.endsWith(".txt") ||
          lower.endsWith(".md") ||
          lower.endsWith(".pdf")
        )
      ) {
        results.push(fullPath);
      }
    }
  }

  walk(BRANCH_DIR);

  return results;
}

// ============================================================
// TEXT SOURCE
// ============================================================

function printTextSource(filePath) {
  try {
    const text = fs.readFileSync(
      filePath,
      "utf8"
    );

    console.log("");
    console.log(
      `SOURCE FILE: ${filePath}`
    );

    console.log(
      "-".repeat(90)
    );

    console.log(text);
  } catch (error) {
    console.log(
      `Could not read source file: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }
}

// ============================================================
// SUBJECT INSPECTION
// ============================================================

function inspectSubject(code) {
  section(`SUBJECT: ${code}`);

  const jsonPath = path.join(
    SUBJECTS_DIR,
    `${code}.json`
  );

  if (!exists(jsonPath)) {
    console.log(
      `❌ JSON package not found: ${jsonPath}`
    );

    return;
  }

  const subject = readJson(
    jsonPath
  );

  // ----------------------------------------------------------
  // JSON FILE
  // ----------------------------------------------------------

  console.log(
    `JSON FILE: ${jsonPath}`
  );

  // ----------------------------------------------------------
  // IMPORTANT METADATA
  // ----------------------------------------------------------

  printJson(
    "IDENTITY",
    {
      subject_code:
        subject.subject_code,

      subject_name:
        subject.subject_name,

      credits:
        subject.credits,

      course_type:
        subject.course_type,

      pedagogy_hours:
        subject.pedagogy_hours,
    }
  );

  // ----------------------------------------------------------
  // SOURCE METADATA
  // ----------------------------------------------------------

  printJson(
    "SOURCE METADATA",
    subject.source
  );

  // ----------------------------------------------------------
  // COURSE OUTCOMES
  // ----------------------------------------------------------

  printJson(
    "COURSE OUTCOMES",
    subject.course_outcomes
  );

  // ----------------------------------------------------------
  // MODULES
  // ----------------------------------------------------------

  printJson(
    "MODULES",
    subject.modules
  );

  // ----------------------------------------------------------
  // PRACTICALS
  // ----------------------------------------------------------

  printJson(
    "PRACTICALS",
    subject.practicals
  );

  // ----------------------------------------------------------
  // SOURCE FILES
  // ----------------------------------------------------------

  const sourceFiles =
    findSourceFiles(code);

  section(
    `SOURCE FILES FOUND FOR ${code}`
  );

  if (
    sourceFiles.length === 0
  ) {
    console.log(
      "⚠️ No matching TXT/MD/PDF source files found."
    );

    return;
  }

  for (
    const sourceFile
    of sourceFiles
  ) {
    const extension =
      path.extname(
        sourceFile
      ).toLowerCase();

    console.log("");
    console.log(
      `SOURCE: ${sourceFile}`
    );

    if (
      extension === ".txt" ||
      extension === ".md"
    ) {
      printTextSource(
        sourceFile
      );
    } else if (
      extension === ".pdf"
    ) {
      console.log(
        "PDF found. PDF text is not extracted by this inspector."
      );
    }
  }
}

// ============================================================
// HEADER
// ============================================================

section(
  "Vertex — VTU 2022 CSE Content Review Inspector"
);

console.log(
  "READ-ONLY MODE"
);

console.log(
  "No JSON files will be modified."
);

console.log(
  "No Supabase data will be modified."
);

console.log("");

console.log(
  "Subjects being inspected:"
);

for (
  const code
  of REVIEW_CODES
) {
  console.log(
    `  🔎 ${code}`
  );
}

// ============================================================
// RUN
// ============================================================

for (
  const code
  of REVIEW_CODES
) {
  inspectSubject(code);
}

// ============================================================
// FINISHED
// ============================================================

section(
  "INSPECTION COMPLETE"
);

console.log(
  "✅ No curriculum JSON files were modified."
);

console.log(
  "✅ No Supabase data was modified."
);

console.log(
  "Next step: compare JSON against the official VTU source."
);