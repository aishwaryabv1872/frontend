/**
 * Vertex — Confirmed Extraction Artifact Cleaner
 *
 * VTU 2022 CSE - Semester 1
 *
 * IMPORTANT:
 *   - DRY-RUN by default.
 *   - Use --apply to actually modify JSON.
 *   - Removes ONLY exact, previously confirmed PDF extraction artifacts.
 *   - Does not modify legitimate curriculum topics.
 *   - Does not modify source metadata.
 *   - Does not modify course outcomes.
 *   - Does not modify module titles/hours.
 *   - Does not modify Supabase.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ============================================================
// PATHS
// ============================================================

const PROJECT_ROOT = process.cwd();

const SUBJECT_DIR = path.join(
  PROJECT_ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE",
  "subjects"
);

// ============================================================
// MODE
// ============================================================

const APPLY_MODE =
  process.argv.includes("--apply");

// ============================================================
// CONFIRMED ARTIFACTS
// ============================================================
//
// These values were directly confirmed by source inspection.
// DO NOT expand this list automatically.
//

const ARTIFACTS = {
  BENGK106: new Set([
    "BENGK106-206",
  ]),

  BKBKK107: new Set([
    "BKBKK107-207",
  ]),

  BPWSK106: new Set([
    "BPWSK206-106",
  ]),

  BSFHK158: new Set([
    "BSFHK108-208",
    "BSFHK158/258",
  ]),
};

// ============================================================
// HELPERS
// ============================================================

function cleanText(value) {
  return String(value ?? "").trim();
}

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

function writeJson(filePath, value) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(value, null, 2) + "\n",
    "utf8"
  );
}

function getTopicTitle(topic) {
  if (
    topic &&
    typeof topic === "object"
  ) {
    return cleanText(topic.title);
  }

  return "";
}

// ============================================================
// CLEAN ONE SUBJECT
// ============================================================

function cleanSubject(code) {
  const filePath = path.join(
    SUBJECT_DIR,
    `${code}.json`
  );

  console.log("");
  console.log("----------------------------------------");
  console.log(`SUBJECT: ${code}`);
  console.log("----------------------------------------");

  if (!fs.existsSync(filePath)) {
    console.log(
      `❌ File not found: ${filePath}`
    );

    return {
      changed: false,
      removed: 0,
      failed: true,
    };
  }

  let subject;

  try {
    subject = readJson(filePath);
  } catch (err) {
    console.log(
      `❌ Could not parse ${code}.json: ${err.message}`
    );

    return {
      changed: false,
      removed: 0,
      failed: true,
    };
  }

  if (
    !subject ||
    typeof subject !== "object" ||
    Array.isArray(subject)
  ) {
    console.log(
      `❌ ${code}.json root value is not an object`
    );

    return {
      changed: false,
      removed: 0,
      failed: true,
    };
  }

  if (
    !Array.isArray(subject.modules)
  ) {
    console.log(
      `❌ ${code}: modules is not an array`
    );

    return {
      changed: false,
      removed: 0,
      failed: true,
    };
  }

  const artifacts =
    ARTIFACTS[code];

  if (!artifacts) {
    console.log(
      `ℹ️ No cleanup rules defined for ${code}`
    );

    return {
      changed: false,
      removed: 0,
      failed: false,
    };
  }

  let removed = 0;
  let changed = false;

  subject.modules.forEach(
    (moduleEntry, moduleIndex) => {
      if (
        !Array.isArray(
          moduleEntry?.topics
        )
      ) {
        return;
      }

      const originalTopics =
        moduleEntry.topics;

      const keptTopics = [];

      originalTopics.forEach(
        (topic, topicIndex) => {
          const title =
            getTopicTitle(topic);

          if (artifacts.has(title)) {
            console.log(
              `🧹 Module ${moduleIndex + 1}, topic ${topicIndex + 1}:`
            );

            console.log(
              `   REMOVE: "${title}"`
            );

            removed++;
            changed = true;

            return;
          }

          keptTopics.push(topic);
        }
      );

      moduleEntry.topics =
        keptTopics;
    }
  );

  if (!changed) {
    console.log(
      "✅ No confirmed extraction artifacts found."
    );

    return {
      changed: false,
      removed: 0,
      failed: false,
    };
  }

  console.log("");
  console.log(
    `Confirmed artifacts found: ${removed}`
  );

  if (APPLY_MODE) {
    writeJson(
      filePath,
      subject
    );

    console.log(
      `✅ ${code}.json modified.`
    );
  } else {
    console.log(
      `ℹ️ DRY-RUN: ${code}.json was NOT modified.`
    );
  }

  return {
    changed,
    removed,
    failed: false,
  };
}

// ============================================================
// MAIN
// ============================================================

function main() {
  console.log(
    "========================================================================"
  );
  console.log(
    "Vertex — Confirmed Extraction Artifact Cleaner"
  );
  console.log(
    "VTU 2022 CSE Semester 1"
  );
  console.log(
    "========================================================================"
  );

  if (APPLY_MODE) {
    console.log(
      "⚠️ APPLY MODE — JSON files WILL be modified."
    );
  } else {
    console.log(
      "🔎 DRY-RUN MODE — No JSON files will be modified."
    );
  }

  console.log(
    "No Supabase data will be modified."
  );

  console.log("");

  if (!fs.existsSync(SUBJECT_DIR)) {
    console.error(
      `❌ Subjects directory not found:\n${SUBJECT_DIR}`
    );

    process.exitCode = 1;
    return;
  }

  const codes =
    Object.keys(ARTIFACTS);

  let subjectsChanged = 0;
  let subjectsSkipped = 0;
  let failures = 0;
  let totalRemoved = 0;

  for (const code of codes) {
    const result =
      cleanSubject(code);

    if (result.failed) {
      failures++;
      continue;
    }

    if (result.changed) {
      subjectsChanged++;
      totalRemoved +=
        result.removed;
    } else {
      subjectsSkipped++;
    }
  }

  console.log("");
  console.log(
    "========================================================================"
  );
  console.log(
    "CLEANUP SUMMARY"
  );
  console.log(
    "========================================================================"
  );

  console.log(
    `Subjects checked : ${codes.length}`
  );

  console.log(
    `Subjects changed : ${subjectsChanged}`
  );

  console.log(
    `Subjects skipped : ${subjectsSkipped}`
  );

  console.log(
    `Artifacts removed: ${totalRemoved}`
  );

  console.log(
    `Failures        : ${failures}`
  );

  console.log("");

  if (!APPLY_MODE) {
    console.log(
      "DRY-RUN COMPLETE"
    );

    console.log("");
    console.log(
      "No files were modified."
    );

    console.log("");
    console.log(
      "If the output shows only the confirmed artifacts, run:"
    );

    console.log("");
    console.log(
      "node scripts/clean-confirmed-extraction-artifacts.mjs --apply"
    );

    return;
  }

  if (failures > 0) {
    console.log(
      "❌ CLEANUP COMPLETED WITH FAILURES"
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    "✅ CONFIRMED EXTRACTION ARTIFACT CLEANUP COMPLETE"
  );

  console.log("");
  console.log(
    "Only the explicitly confirmed extraction artifacts were removed."
  );

  console.log(
    "No Supabase changes were made."
  );
}

main();