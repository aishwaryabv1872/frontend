
/**
 * Semester-1 Pedagogy Hours Targeted Repair
 *
 * VTU 2022 CSE - Semester 1
 *
 * PURPOSE:
 *   Correct pedagogy_hours for six verified 1-credit courses.
 *
 * TARGETED CHANGES ONLY:
 *   BENGK106  40 -> 15
 *   BPWSK106  40 -> 15
 *   BKBKK107  40 -> 15
 *   BICOK107  40 -> 15
 *   BIDTK158  40 -> 15
 *   BSFHK158  40 -> 15
 *
 * SAFETY:
 *   - Requires --apply before modifying files.
 *   - Refuses unexpected current values.
 *   - Refuses non-1-credit courses.
 *   - Checks source TXT for 15-hour evidence.
 *   - Does NOT modify module hours.
 *   - Does NOT modify course names.
 *   - Does NOT modify topics.
 *   - Does NOT modify course outcomes.
 *   - Does NOT modify source metadata.
 *   - Does NOT modify Supabase.
 *
 * DEFAULT:
 *   Dry-run only.
 *
 * RUN:
 *   node .\scripts\repair-sem1-pedagogy-hours.mjs
 *
 * APPLY:
 *   node .\scripts\repair-sem1-pedagogy-hours.mjs --apply
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
// TARGET ALLOWLIST
// ============================================================

const TARGETS = [
  "BENGK106",
  "BPWSK106",
  "BKBKK107",
  "BICOK107",
  "BIDTK158",
  "BSFHK158",
];

// ============================================================
// EXPECTED VALUES
// ============================================================

const EXPECTED_CREDITS = 1;
const EXPECTED_CURRENT_PEDAGOGY = 40;
const EXPECTED_NEW_PEDAGOGY = 15;

// ============================================================
// STATE
// ============================================================

const applyMode =
  process.argv.includes("--apply");

let changed = 0;
let skipped = 0;
let errors = [];

// ============================================================
// OUTPUT
// ============================================================

function section(title) {
  console.log("");
  console.log("========================================");
  console.log(` ${title}`);
  console.log("========================================");
}

function fail(message) {
  console.log(`❌ ${message}`);
  errors.push(message);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
}

// ============================================================
// HELPERS
// ============================================================

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function normalizeCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

function readText(filePath) {
  return fs.readFileSync(
    filePath,
    "utf8"
  );
}

// ============================================================
// SOURCE EVIDENCE
// ============================================================

function has15HourPedagogyEvidence(
  sourceText
) {
  const normalized = String(
    sourceText ?? ""
  )
    .replace(/\r/g, "")
    .replace(/\u0000/g, "");

  /*
   * Accept common VTU TXT extraction variants such as:
   *
   * Total Hours of Pedagogy: 15 hours
   * Total Hours of Pedagogy : 15 hours
   * Total Hours of Pedagogy 15
   * Total Hours of Pedagogy: 15
   *
   * We deliberately do NOT accept a bare "15" somewhere
   * in the document because that would be weak evidence.
   */

  const patterns = [
    /total\s+hours?\s+of\s+pedagogy\s*[:\-]?\s*15\s*(?:hours?)?/i,
    /total\s+hours?\s+of\s+pedagogy[^0-9]{0,20}15\b/i,
    /hours?\s+of\s+pedagogy\s*[:\-]?\s*15\s*(?:hours?)?/i,
    /pedagogy\s+hours?\s*[:\-]?\s*15\s*(?:hours?)?/i,
  ];

  return patterns.some(
    (pattern) =>
      pattern.test(normalized)
  );
}

// ============================================================
// MODULE EVIDENCE
// ============================================================

function getModuleHourState(subject) {
  if (!Array.isArray(subject.modules)) {
    return {
      valid: false,
      total: null,
      allNull: false,
    };
  }

  let total = 0;
  let allNull = true;

  for (const moduleEntry of subject.modules) {
    const hours = moduleEntry?.hours;

    if (
      hours === null ||
      hours === undefined ||
      hours === ""
    ) {
      continue;
    }

    allNull = false;

    const numeric = Number(hours);

    if (!Number.isFinite(numeric)) {
      return {
        valid: false,
        total: null,
        allNull: false,
      };
    }

    total += numeric;
  }

  return {
    valid: true,
    total,
    allNull,
  };
}

// ============================================================
// VALIDATE TARGET
// ============================================================

function validateTarget(code) {
  const jsonFile = path.join(
    SUBJECT_DIR,
    `${code}.json`
  );

  const txtFile = path.join(
    SUBJECT_DIR,
    `${code}.txt`
  );

  console.log("");
  console.log(`--- ${code} ---`);

  // ----------------------------------------------------------
  // JSON existence
  // ----------------------------------------------------------

  if (!fileExists(jsonFile)) {
    fail(
      `${code}: JSON file not found`
    );
    return null;
  }

  // ----------------------------------------------------------
  // TXT existence
  // ----------------------------------------------------------

  if (!fileExists(txtFile)) {
    fail(
      `${code}: source TXT not found`
    );
    return null;
  }

  // ----------------------------------------------------------
  // JSON parse
  // ----------------------------------------------------------

  let subject;

  try {
    subject = readJson(jsonFile);
  } catch (err) {
    fail(
      `${code}: could not parse JSON: ${err.message}`
    );
    return null;
  }

  // ----------------------------------------------------------
  // Subject code
  // ----------------------------------------------------------

  if (
    normalizeCode(
      subject.subject_code
    ) !== code
  ) {
    fail(
      `${code}: subject_code mismatch: ${subject.subject_code}`
    );
    return null;
  }

  // ----------------------------------------------------------
  // Credits
  // ----------------------------------------------------------

  const credits =
    Number(subject.credits);

  if (
    credits !== EXPECTED_CREDITS
  ) {
    fail(
      `${code}: expected credits=${EXPECTED_CREDITS}, found ${subject.credits}`
    );
    return null;
  }

  // ----------------------------------------------------------
  // Current pedagogy
  // ----------------------------------------------------------

  const currentPedagogy =
    Number(subject.pedagogy_hours);

  if (
    currentPedagogy !==
    EXPECTED_CURRENT_PEDAGOGY
  ) {
    fail(
      `${code}: refusing repair because current pedagogy_hours is ${subject.pedagogy_hours}; expected exactly ${EXPECTED_CURRENT_PEDAGOGY}`
    );
    return null;
  }

  // ----------------------------------------------------------
  // Source evidence
  // ----------------------------------------------------------

  let sourceText;

  try {
    sourceText =
      readText(txtFile);
  } catch (err) {
    fail(
      `${code}: could not read source TXT: ${err.message}`
    );
    return null;
  }

  if (
    !has15HourPedagogyEvidence(
      sourceText
    )
  ) {
    fail(
      `${code}: source TXT does not contain explicit 15-hour pedagogy evidence; refusing repair`
    );
    return null;
  }

  // ----------------------------------------------------------
  // Module state
  // ----------------------------------------------------------

  const moduleState =
    getModuleHourState(subject);

  if (!moduleState.valid) {
    fail(
      `${code}: module structure/hours are invalid; refusing repair`
    );
    return null;
  }

  /*
   * For these courses, either:
   *
   * 1. module total is already 15, or
   * 2. module hours are intentionally unavailable/null.
   *
   * We never invent module hours here.
   */

  if (
    !moduleState.allNull &&
    moduleState.total !== 15
  ) {
    fail(
      `${code}: module-hour total is ${moduleState.total}; expected 15 or entirely unavailable/null. Refusing repair`
    );
    return null;
  }

  // ----------------------------------------------------------
  // Safe
  // ----------------------------------------------------------

  success(
    `${code}: source confirms 15-hour pedagogy`
  );

  console.log(
    `   Credits          : ${credits}`
  );

  console.log(
    `   Current pedagogy : ${currentPedagogy}`
  );

  console.log(
    `   New pedagogy     : ${EXPECTED_NEW_PEDAGOGY}`
  );

  console.log(
    `   Module total     : ${
      moduleState.allNull
        ? "unavailable/null"
        : moduleState.total
    }`
  );

  console.log(
    `   JSON file        : ${path.basename(jsonFile)}`
  );

  return {
    code,
    jsonFile,
    subject,
  };
}

// ============================================================
// MAIN
// ============================================================

function main() {
  console.log("========================================");
  console.log(
    " Semester-1 Pedagogy Hours Targeted Repair"
  );
  console.log(" VTU 2022 CSE");
  console.log("========================================");

  if (applyMode) {
    console.log("");
    console.log(
      "MODE: APPLY — files will be modified"
    );
  } else {
    console.log("");
    console.log(
      "MODE: DRY-RUN — no files will be modified"
    );
    console.log(
      "Use --apply to perform the repair."
    );
  }

  // ----------------------------------------------------------
  // Directory
  // ----------------------------------------------------------

  if (!fileExists(SUBJECT_DIR)) {
    console.error("");
    console.error(
      `❌ Subject directory not found:\n${SUBJECT_DIR}`
    );

    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // Allowlist
  // ----------------------------------------------------------

  section("Target Allowlist");

  for (const code of TARGETS) {
    console.log(`   ${code}`);
  }

  // ----------------------------------------------------------
  // Validation
  // ----------------------------------------------------------

  section("Validating Targets");
  info("Checking all target packages against source evidence and rules.");

  const validated = [];

  for (const code of TARGETS) {
    const result =
      validateTarget(code);

    if (result) {
      validated.push(result);
    }
  }

  // ----------------------------------------------------------
  // Abort if any validation failed
  // ----------------------------------------------------------

  if (
    errors.length > 0
  ) {
    section("Repair Aborted");

    console.log(
      `Errors found: ${errors.length}`
    );

    for (const message of errors) {
      console.log(
        `   ❌ ${message}`
      );
    }

    console.log("");
    console.log(
      "No files were modified."
    );

    process.exitCode = 1;
    return;
  }

  if (
    validated.length !==
    TARGETS.length
  ) {
    console.error("");
    console.error(
      "❌ Not all target packages passed validation."
    );

    console.error(
      "No files were modified."
    );

    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // Dry run
  // ----------------------------------------------------------

  if (!applyMode) {
    section("Dry-Run Result");

    console.log(
      `Packages validated : ${validated.length}`
    );

    console.log(
      `Packages to modify : ${validated.length}`
    );

    console.log(
      `Field to modify    : pedagogy_hours`
    );

    console.log(
      `Change             : 40 -> 15`
    );

    console.log("");
    console.log(
      "No files were modified."
    );

    console.log("");
    console.log(
      "To apply the repair:"
    );

    console.log(
      "node .\\scripts\\repair-sem1-pedagogy-hours.mjs --apply"
    );

    process.exitCode = 0;
    return;
  }

  // ----------------------------------------------------------
  // Apply
  // ----------------------------------------------------------

  section("Applying Targeted Repair");

  for (const item of validated) {
    const before =
      item.subject.pedagogy_hours;

    item.subject.pedagogy_hours =
      EXPECTED_NEW_PEDAGOGY;

    fs.writeFileSync(
      item.jsonFile,
      `${JSON.stringify(
        item.subject,
        null,
        2
      )}\n`,
      "utf8"
    );

    changed++;

    success(
      `${item.code}: pedagogy_hours ${before} -> ${EXPECTED_NEW_PEDAGOGY}`
    );
  }

  // ----------------------------------------------------------
  // Final summary
  // ----------------------------------------------------------

  section("Repair Summary");

  console.log(
    `Target packages : ${TARGETS.length}`
  );

  console.log(
    `Validated       : ${validated.length}`
  );

  console.log(
    `Changed         : ${changed}`
  );

  console.log(
    `Skipped         : ${skipped}`
  );

  console.log(
    `Errors          : ${errors.length}`
  );

  console.log("");
  console.log(
    "Only pedagogy_hours was modified."
  );

  console.log(
    "No module hours were modified."
  );

  console.log(
    "No topics were modified."
  );

  console.log(
    "No course outcomes were modified."
  );

  console.log(
    "No source metadata was modified."
  );

  console.log(
    "No Supabase changes were made."
  );

  console.log("");
  console.log(
    "TARGETED PEDAGOGY REPAIR COMPLETED"
  );

  process.exitCode = 0;
}

main();
