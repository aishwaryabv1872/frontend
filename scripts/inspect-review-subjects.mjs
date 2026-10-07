/**
 * ============================================================
 * Vertex — VTU Review Subject Inspector
 * ============================================================
 *
 * READ-ONLY
 *
 * Purpose:
 *   Inspect the remaining manually classified subjects and
 *   compare their JSON package with available source material.
 *
 * Subjects:
 *   BESCK104C
 *   BKSKK107
 *   BETCK105G
 *   BESCK104B
 *   BETCK105C
 *   BETCK105D
 *   BETCK105F
 *   BPHYS102
 *
 * IMPORTANT:
 *   This script NEVER modifies JSON files.
 *   This script NEVER modifies Supabase.
 *
 * Run:
 *   node scripts/inspect-review-subjects.mjs
 * ============================================================
 */

import fs from "fs";
import path from "path";

// ============================================================
// PATHS
// ============================================================

const ROOT = process.cwd();

const CURRICULUM_DIR = path.join(
  ROOT,
  "data",
  "curriculum",
  "vtu-2022"
);

const BRANCH_DIR = path.join(
  CURRICULUM_DIR,
  "CSE"
);

const SUBJECTS_DIR = path.join(
  BRANCH_DIR,
  "subjects"
);

// ============================================================
// SUBJECTS TO INSPECT
// ============================================================

const REVIEW_CODES = [
  "BESCK104C",
  "BKSKK107",
  "BETCK105G",
  "BESCK104B",
  "BETCK105C",
  "BETCK105D",
  "BETCK105F",
  "BPHYS102",
];

// ============================================================
// HELPERS
// ============================================================

function section(title) {
  console.log("");
  console.log("=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
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
// SOURCE FILE DISCOVERY
// ============================================================

function findSourceFiles(code) {
  const results = [];

  /*
   * Search the entire CSE curriculum directory.
   *
   * This intentionally avoids assuming a particular source
   * filename or extension.
   */
  function walk(dir) {
    if (!exists(dir)) {
      return;
    }

    const entries =
      fs.readdirSync(
        dir,
        {
          withFileTypes: true,
        }
      );

    for (
      const entry of entries
      .sort((a, b) =>
        a.name.localeCompare(
          b.name
        )
      )
    ) {
      const fullPath =
        path.join(
          dir,
          entry.name
        );

      if (
        entry.isDirectory()
      ) {
        walk(fullPath);
        continue;
      }

      const lower =
        entry.name.toLowerCase();

      /*
       * We are interested in text-like source files.
       *
       * PDFs are listed but not parsed here because this script
       * is intended to remain simple and read-only.
       */
      if (
        lower.includes(
          code.toLowerCase()
        ) &&
        (
          lower.endsWith(".txt") ||
          lower.endsWith(".pdf") ||
          lower.endsWith(".md")
        )
      ) {
        results.push(
          fullPath
        );
      }
    }
  }

  walk(BRANCH_DIR);

  return results;
}

// ============================================================
// PRINT TEXT SOURCE
// ============================================================

function printTextSource(
  filePath,
  maxCharacters = 30000
) {
  try {
    const text =
      fs.readFileSync(
        filePath,
        "utf8"
      );

    console.log("");
    console.log(
      `SOURCE FILE: ${filePath}`
    );

    console.log(
      "-".repeat(80)
    );

    if (
      text.length <=
      maxCharacters
    ) {
      console.log(text);
      return;
    }

    console.log(
      text.slice(
        0,
        maxCharacters
      )
    );

    console.log("");
    console.log(
      `[SOURCE TRUNCATED — ${text.length} characters total]`
    );
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
  section(
    `SUBJECT: ${code}`
  );

  const jsonPath =
    path.join(
      SUBJECTS_DIR,
      `${code}.json`
    );

  if (!exists(jsonPath)) {
    console.log(
      `❌ JSON not found:\n${jsonPath}`
    );

    return;
  }

  let subject;

  try {
    subject =
      readJson(jsonPath);
  } catch (error) {
    console.log(
      `❌ JSON parse failed: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );

    return;
  }

  console.log(
    `JSON: ${jsonPath}`
  );

  // ==========================================================
  // BASIC METADATA
  // ==========================================================

  printJson(
    "Basic course metadata",
    {
      subject_code:
        subject.subject_code,

      course_code:
        subject.course_code,

      code:
        subject.code,

      title:
        subject.title ??
        subject.course_title,

      credits:
        subject.credits,

      course_type:
        subject.course_type,

      pedagogy_hours:
        subject.pedagogy_hours,
    }
  );

  // ==========================================================
  // SOURCE METADATA
  // ==========================================================

  printJson(
    "Source metadata",
    subject.source
  );

  // ==========================================================
  // COURSE OUTCOMES
  // ==========================================================

  printJson(
    "Course outcomes",
    subject.course_outcomes ??
      subject.outcomes
  );

  // ==========================================================
  // MODULES
  // ==========================================================

  const modules =
    Array.isArray(
      subject.modules
    )
      ? subject.modules
      : [];

  console.log("");
  console.log(
    `Modules: ${modules.length}`
  );

  for (
    let index = 0;
    index < modules.length;
    index++
  ) {
    const moduleEntry =
      modules[index];

    console.log("");
    console.log(
      `MODULE ${index + 1}`
    );

    console.log(
      `Title: ${
        clean(
          moduleEntry?.title ??
          moduleEntry?.module_title ??
          moduleEntry?.name ??
          ""
        ) || "(empty)"
      }`
    );

    console.log(
      `Hours: ${
        moduleEntry?.hours ??
        moduleEntry?.module_hours ??
        "(not specified)"
      }`
    );

    const topics =
      Array.isArray(
        moduleEntry?.topics
      )
        ? moduleEntry.topics
        : [];

    console.log(
      `Topics: ${topics.length}`
    );

    if (
      topics.length === 0
    ) {
      console.log(
        "  (EMPTY)"
      );
    } else {
      for (
        let topicIndex = 0;
        topicIndex < topics.length;
        topicIndex++
      ) {
        const topic =
          topics[topicIndex];

        const topicText =
          typeof topic === "string"
            ? topic
            : clean(
                topic?.title ??
                topic?.name ??
                JSON.stringify(topic)
              );

        console.log(
          `  ${topicIndex + 1}. ${topicText}`
        );
      }
    }
  }

  // ==========================================================
  // FULL SOURCE FILES
  // ==========================================================

  section(
    `SOURCE MATERIAL — ${code}`
  );

  const sourceFiles =
    findSourceFiles(code);

  if (
    sourceFiles.length === 0
  ) {
    console.log(
      "No matching local TXT/PDF/MD source file found."
    );

    return;
  }

  console.log(
    `Matching source files: ${sourceFiles.length}`
  );

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
        "PDF found. This inspector does not extract PDF text automatically."
      );

      console.log(
        "Use the existing extracted TXT/source inspection workflow for this PDF."
      );
    }
  }
}

// ============================================================
// HEADER
// ============================================================

section(
  "Vertex — VTU 2022 CSE Review Subject Inspector"
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
  "Next step: compare the printed JSON against the official source material before repairing anything."
);