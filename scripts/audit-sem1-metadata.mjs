
/**
 * Semester-1 Metadata Audit
 *
 * VTU 2022 CSE - Semester 1
 *
 * PURPOSE:
 *   Read-only audit of subject metadata.
 *
 * CHECKS:
 *   1. Semester-1 scheme credits
 *   2. JSON credits
 *   3. JSON pedagogy_hours
 *   4. Module-hour totals
 *   5. Source TXT evidence for pedagogy hours
 *   6. Source TXT evidence for credits
 *   7. Source TXT course identity
 *   8. Source date presence
 *   9. All 31 packages
 *
 * IMPORTANT:
 *   - READ-ONLY
 *   - Never modifies JSON files
 *   - Never modifies TXT files
 *   - Never modifies PDFs
 *   - Never writes to Supabase
 *   - Never "fixes" anything automatically
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ============================================================
// PATHS
// ============================================================

const PROJECT_ROOT = process.cwd();

const CURRICULUM_DIR = path.join(
  PROJECT_ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE"
);

const SCHEME_FILE = path.join(
  CURRICULUM_DIR,
  "semester-1.json"
);

const SUBJECT_DIR = path.join(
  CURRICULUM_DIR,
  "subjects"
);

// ============================================================
// EXPECTATIONS
// ============================================================

const EXPECTED_SEMESTER = 1;
const EXPECTED_REGULATION = "2022";
const EXPECTED_BRANCH = "CSE";
const EXPECTED_COURSE_COUNT = 31;

// VTU 2022 convention seen in this dataset:
// 1-credit courses normally carry 15 hours of pedagogy.
// 3-credit / 4-credit theory courses commonly carry 40 hours.
//
// IMPORTANT:
// This script does NOT assume that convention is proof.
// It reports it only as an EXPECTED/REFERENCE value.
// Source evidence remains authoritative.
const REFERENCE_PEDAGOGY_BY_CREDIT = {
  1: 15,
  2: 30,
  3: 40,
  4: 40,
  5: 50,
};

// ============================================================
// STATE
// ============================================================

let errors = [];
let warnings = [];
let info = [];

const results = [];

// ============================================================
// OUTPUT HELPERS
// ============================================================

function section(title) {
  console.log("");
  console.log("========================================");
  console.log(` ${title}`);
  console.log("========================================");
}

function error(message) {
  errors.push(message);
  console.log(`❌ ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`⚠️ ${message}`);
}

function note(message) {
  info.push(message);
  console.log(`ℹ️ ${message}`);
}

// ============================================================
// FILE HELPERS
// ============================================================

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
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

function listJsonFiles(directory) {
  if (!fileExists(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, {
      withFileTypes: true,
    })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name
          .toLowerCase()
          .endsWith(".json")
    )
    .map((entry) => entry.name)
    .sort();
}

// ============================================================
// NORMALIZATION
// ============================================================

function normalizeCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .trim();
}

// ============================================================
// SCHEME HELPERS
// ============================================================

function getSchemeCourses(scheme) {
  if (
    !scheme ||
    !Array.isArray(scheme.courses)
  ) {
    throw new Error(
      "semester-1.json does not contain a valid courses array."
    );
  }

  return scheme.courses;
}

function getCourseCode(course) {
  return normalizeCode(
    course?.code ??
      course?.subject_code ??
      course?.course_code
  );
}

function getCourseName(course) {
  return cleanText(
    course?.name ??
      course?.title ??
      course?.subject_name ??
      course?.course_title
  );
}

function getCourseCredits(course) {
  const value =
    course?.credits ??
    course?.credit ??
    course?.course_credits;

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

// ============================================================
// SOURCE FILE HELPERS
// ============================================================

function getSourceFile(code) {
  return path.join(
    SUBJECT_DIR,
    `${code}.txt`
  );
}

// ============================================================
// SOURCE EXTRACTION
// ============================================================

function extractNumbersAroundPatterns(
  sourceText,
  patterns
) {
  const values = [];

  for (const pattern of patterns) {
    const regex = new RegExp(
      pattern,
      "gi"
    );

    let match;

    while (
      (match = regex.exec(sourceText)) !== null
    ) {
      const value = Number(
        match[1]
      );

      if (
        Number.isFinite(value)
      ) {
        values.push(value);
      }
    }
  }

  return values;
}

function extractSourceCredits(sourceText) {
  return extractNumbersAroundPatterns(
    sourceText,
    [
      String.raw`credits?\s*[:\-]?\s*(\d+(?:\.\d+)?)`,
      String.raw`credit\s*[:\-]?\s*(\d+(?:\.\d+)?)`,
      String.raw`credits?\s+of\s+pedagogy\s*[:\-]?\s*(\d+(?:\.\d+)?)`,
    ]
  );
}

function extractSourcePedagogyHours(sourceText) {
  return extractNumbersAroundPatterns(
    sourceText,
    [
      String.raw`total\s+hours?\s+of\s+pedagogy\s*[:\-]?\s*(\d+(?:\.\d+)?)`,
      String.raw`hours?\s+of\s+pedagogy\s*[:\-]?\s*(\d+(?:\.\d+)?)`,
      String.raw`pedagogy\s+hours?\s*[:\-]?\s*(\d+(?:\.\d+)?)`,
      String.raw`total\s+pedagogy\s+hours?\s*[:\-]?\s*(\d+(?:\.\d+)?)`,
    ]
  );
}

function extractSourceCourseCodes(sourceText) {
  const matches =
    sourceText.match(
      /\b[A-Z]{2,10}\d{3}[A-Z]?\b/gi
    ) ?? [];

  return [
    ...new Set(
      matches.map(
        normalizeCode
      )
    ),
  ];
}

// ============================================================
// SOURCE DATE
// ============================================================

function extractSourceDates(sourceText) {
  const dates = [];

  const patterns = [
    /\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g,
    /\b\d{1,2}[./-]\d{1,2}[./-]\d{2}\b/g,
    /\b\d{1,2}\.\d{1,2}\.\d{4}\b/g,
  ];

  for (const regex of patterns) {
    const matches =
      sourceText.match(regex) ?? [];

    dates.push(...matches);
  }

  return [
    ...new Set(
      dates.map((value) =>
        value.trim()
      )
    ),
  ];
}

// ============================================================
// MODULE HOURS
// ============================================================

function calculateModuleHours(subject) {
  if (
    !Array.isArray(
      subject?.modules
    )
  ) {
    return {
      total: null,
      known: false,
      values: [],
    };
  }

  const values =
    subject.modules.map(
      (module) => {
        const value =
          Number(module?.hours);

        return Number.isFinite(value)
          ? value
          : null;
      }
    );

  const knownValues =
    values.filter(
      (value) =>
        value !== null
    );

  if (
    knownValues.length === 0
  ) {
    return {
      total: null,
      known: false,
      values,
    };
  }

  const total =
    knownValues.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  return {
    total,
    known:
      knownValues.length ===
      values.length,
    values,
  };
}

// ============================================================
// SOURCE EVIDENCE CLASSIFICATION
// ============================================================

function classifyEvidence(
  sourceText,
  jsonCredits,
  jsonPedagogy,
  moduleTotal
) {
  const sourceCredits =
    extractSourceCredits(
      sourceText
    );

  const sourcePedagogy =
    extractSourcePedagogyHours(
      sourceText
    );

  const sourceDates =
    extractSourceDates(
      sourceText
    );

  const sourceCodes =
    extractSourceCourseCodes(
      sourceText
    );

  const creditMatches =
    sourceCredits.filter(
      (value) =>
        value === jsonCredits
    );

  const pedagogyMatches =
    sourcePedagogy.filter(
      (value) =>
        value === jsonPedagogy
    );

  const moduleTotalMatches =
    sourcePedagogy.filter(
      (value) =>
        moduleTotal !== null &&
        value === moduleTotal
    );

  return {
    sourceCredits,
    sourcePedagogy,
    sourceDates,
    sourceCodes,
    creditMatches,
    pedagogyMatches,
    moduleTotalMatches,
  };
}

// ============================================================
// AUDIT ONE SUBJECT
// ============================================================

function auditSubject(
  code,
  schemeCourse,
  subject,
  sourceText
) {
  const schemeCredits =
    getCourseCredits(
      schemeCourse
    );

  const jsonCredits =
    Number(subject?.credits);

  const jsonPedagogy =
    Number(
      subject?.pedagogy_hours
    );

  const moduleInfo =
    calculateModuleHours(
      subject
    );

  const referencePedagogy =
    Number.isFinite(
      schemeCredits
    )
      ? REFERENCE_PEDAGOGY_BY_CREDIT[
          schemeCredits
        ] ?? null
      : null;

  const evidence =
    classifyEvidence(
      sourceText,
      jsonCredits,
      jsonPedagogy,
      moduleInfo.total
    );

  const result = {
    code,

    schemeName:
      getCourseName(
        schemeCourse
      ),

    jsonName:
      cleanText(
        subject?.subject_name
      ),

    schemeCredits,

    jsonCredits,

    creditsMatch:
      schemeCredits !== null &&
      jsonCredits ===
        schemeCredits,

    jsonPedagogy,

    referencePedagogy,

    pedagogyMatchesReference:
      referencePedagogy !== null &&
      jsonPedagogy ===
        referencePedagogy,

    moduleHours:
      moduleInfo.total,

    moduleHoursKnown:
      moduleInfo.known,

    moduleHoursValues:
      moduleInfo.values,

    sourceCredits:
      evidence.sourceCredits,

    sourcePedagogy:
      evidence.sourcePedagogy,

    sourceDates:
      evidence.sourceDates,

    sourceCodes:
      evidence.sourceCodes,

    sourceConfirmsJsonCredits:
      evidence.creditMatches.length >
      0,

    sourceConfirmsJsonPedagogy:
      evidence.pedagogyMatches.length >
      0,

    sourceConfirmsModuleTotal:
      evidence.moduleTotalMatches.length >
      0,
  };

  results.push(result);

  return result;
}

// ============================================================
// FORMAT HELPERS
// ============================================================

function formatValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (
    Array.isArray(value)
  ) {
    if (value.length === 0) {
      return "—";
    }

    return value.join(", ");
  }

  return String(value);
}

function yesNo(value) {
  return value ? "YES" : "NO";
}

// ============================================================
// PRINT SUMMARY TABLE
// ============================================================

function printSummaryTable() {
  section(
    "Metadata Audit Summary"
  );

  const header = [
    "CODE",
    "CR",
    "JSON",
    "PED",
    "REF",
    "MOD",
    "SRC PED",
    "SRC CR",
    "DATE",
  ];

  console.log(
    header
      .map((value) =>
        value.padEnd(
          value === "CODE"
            ? 11
            : 9
        )
      )
      .join(" ")
  );

  console.log(
    "-".repeat(100)
  );

  for (const result of results) {
    const row = [
      result.code.padEnd(11),

      formatValue(
        result.schemeCredits
      ).padEnd(9),

      formatValue(
        result.jsonCredits
      ).padEnd(9),

      formatValue(
        result.jsonPedagogy
      ).padEnd(9),

      formatValue(
        result.referencePedagogy
      ).padEnd(9),

      formatValue(
        result.moduleHours
      ).padEnd(9),

      formatValue(
        result.sourcePedagogy
      ).padEnd(14),

      formatValue(
        result.sourceCredits
      ).padEnd(12),

      formatValue(
        result.sourceDates
      ).padEnd(15),
    ];

    console.log(
      row.join(" ")
    );
  }
}

// ============================================================
// PRINT 1-CREDIT FOCUS
// ============================================================

function printOneCreditFocus() {
  const oneCredit =
    results.filter(
      (result) =>
        result.schemeCredits === 1
    );

  section(
    "1-Credit Course Focus"
  );

  console.log(
    `1-credit courses found: ${oneCredit.length}`
  );

  console.log("");

  for (const result of oneCredit) {
    console.log(
      `--- ${result.code} ---`
    );

    console.log(
      `Scheme name       : ${result.schemeName}`
    );

    console.log(
      `JSON name         : ${result.jsonName}`
    );

    console.log(
      `Scheme credits    : ${formatValue(
        result.schemeCredits
      )}`
    );

    console.log(
      `JSON credits      : ${formatValue(
        result.jsonCredits
      )}`
    );

    console.log(
      `JSON pedagogy     : ${formatValue(
        result.jsonPedagogy
      )}`
    );

    console.log(
      `Reference pedagogy: ${formatValue(
        result.referencePedagogy
      )}`
    );

    console.log(
      `Module-hour total : ${formatValue(
        result.moduleHours
      )}`
    );

    console.log(
      `Module hours known: ${yesNo(
        result.moduleHoursKnown
      )}`
    );

    console.log(
      `Source pedagogy   : ${formatValue(
        result.sourcePedagogy
      )}`
    );

    console.log(
      `Source credits    : ${formatValue(
        result.sourceCredits
      )}`
    );

    console.log(
      `Source dates      : ${formatValue(
        result.sourceDates
      )}`
    );

    console.log(
      `Source confirms JSON pedagogy: ${yesNo(
        result.sourceConfirmsJsonPedagogy
      )}`
    );

    console.log(
      `Source confirms module total : ${yesNo(
        result.sourceConfirmsModuleTotal
      )}`
    );

    console.log("");
  }
}

// ============================================================
// PEDAGOGY MISMATCH REPORT
// ============================================================

function printPedagogyMismatchReport() {
  const mismatches =
    results.filter(
      (result) =>
        result.referencePedagogy !==
          null &&
        result.jsonPedagogy !==
          result.referencePedagogy
    );

  section(
    "Pedagogy Mismatch Report"
  );

  if (
    mismatches.length === 0
  ) {
    console.log(
      "No JSON/reference pedagogy mismatches found."
    );

    return;
  }

  console.log(
    `Potential mismatches: ${mismatches.length}`
  );

  console.log("");

  for (const result of mismatches) {
    console.log(
      `⚠️ ${result.code}`
    );

    console.log(
      `   Credits             : ${formatValue(
        result.schemeCredits
      )}`
    );

    console.log(
      `   JSON pedagogy       : ${formatValue(
        result.jsonPedagogy
      )}`
    );

    console.log(
      `   Reference pedagogy  : ${formatValue(
        result.referencePedagogy
      )}`
    );

    console.log(
      `   Module total        : ${formatValue(
        result.moduleHours
      )}`
    );

    console.log(
      `   Source pedagogy     : ${formatValue(
        result.sourcePedagogy
      )}`
    );

    console.log(
      `   Source confirms JSON: ${yesNo(
        result.sourceConfirmsJsonPedagogy
      )}`
    );

    console.log("");
  }
}

// ============================================================
// SOURCE EVIDENCE REPORT
// ============================================================

function printSourceEvidenceReport() {
  section(
    "Source Evidence Classification"
  );

  for (const result of results) {
    const sourcePedagogy =
      result.sourcePedagogy;

    const jsonPedagogy =
      result.jsonPedagogy;

    const moduleTotal =
      result.moduleHours;

    let classification =
      "NO DIRECT PEDAGOGY EVIDENCE";

    if (
      sourcePedagogy.length > 0
    ) {
      const unique =
        [
          ...new Set(
            sourcePedagogy
          ),
        ];

      if (
        unique.length === 1 &&
        unique[0] ===
          jsonPedagogy
      ) {
        classification =
          "SOURCE CONFIRMS JSON";
      } else if (
        moduleTotal !== null &&
        unique.includes(
          moduleTotal
        )
      ) {
        classification =
          "SOURCE MATCHES MODULE TOTAL";
      } else {
        classification =
          "SOURCE CONTAINS DIFFERENT VALUE";
      }
    }

    console.log(
      `${result.code.padEnd(12)} ${classification}`
    );

    if (
      sourcePedagogy.length > 0
    ) {
      console.log(
        `   Source pedagogy: ${sourcePedagogy.join(
          ", "
        )}`
      );
    }

    if (
      result.sourceCredits.length >
      0
    ) {
      console.log(
        `   Source credits : ${result.sourceCredits.join(
          ", "
        )}`
      );
    }

    if (
      result.sourceDates.length >
      0
    ) {
      console.log(
        `   Source dates   : ${result.sourceDates.join(
          ", "
        )}`
      );
    }
  }
}

// ============================================================
// DATE REPORT
// ============================================================

function printDateReport() {
  section(
    "Source Date Report"
  );

  const missingDates =
    results.filter(
      (result) =>
        result.sourceDates.length ===
        0
    );

  const withDates =
    results.filter(
      (result) =>
        result.sourceDates.length >
        0
    );

  console.log(
    `Packages with detectable source date : ${withDates.length}`
  );

  console.log(
    `Packages without detectable source date: ${missingDates.length}`
  );

  if (
    missingDates.length > 0
  ) {
    console.log("");

    console.log(
      "No detectable date in source TXT:"
    );

    for (const result of missingDates) {
      console.log(
        `   ⚠️ ${result.code}`
      );
    }
  }
}

// ============================================================
// CREDIT CONSISTENCY REPORT
// ============================================================

function printCreditReport() {
  section(
    "Credit Consistency Report"
  );

  const mismatches =
    results.filter(
      (result) =>
        !result.creditsMatch
    );

  if (
    mismatches.length === 0
  ) {
    console.log(
      "All JSON credits match the Semester-1 scheme."
    );

    return;
  }

  for (const result of mismatches) {
    console.log(
      `❌ ${result.code}: scheme=${formatValue(
        result.schemeCredits
      )}, JSON=${formatValue(
        result.jsonCredits
      )}`
    );
  }
}

// ============================================================
// SOURCE IDENTITY REPORT
// ============================================================

function printIdentityReport() {
  section(
    "Source Identity Report"
  );

  for (const result of results) {
    const normalizedCode =
      normalizeCode(
        result.code
      );

    const normalizedSourceCodes =
      result.sourceCodes.map(
        normalizeCode
      );

    const hasExactCode =
      normalizedSourceCodes.includes(
        normalizedCode
      );

    const hasAnyCode =
      normalizedSourceCodes.length >
      0;

    console.log(
      `${result.code.padEnd(12)} exact-code=${yesNo(
        hasExactCode
      )} source-codes=${formatValue(
        result.sourceCodes
      )}`
    );

    if (
      !hasExactCode &&
      hasAnyCode
    ) {
      note(
        `${result.code}: source TXT contains course-code artifacts different from JSON code`
      );
    }
  }
}

// ============================================================
// RECOMMENDATION REPORT
// ============================================================

function printRecommendations() {
  section(
    "Read-Only Recommendations"
  );

  const sourceConfirmed =
    results.filter(
      (result) =>
        result.referencePedagogy !==
          null &&
        result.jsonPedagogy !==
          result.referencePedagogy &&
        result.sourcePedagogy.includes(
          result.referencePedagogy
        )
    );

  const sourceConfirmsJson =
    results.filter(
      (result) =>
        result.sourceConfirmsJsonPedagogy
    );

  const unresolved =
    results.filter(
      (result) =>
        result.referencePedagogy !==
          null &&
        result.jsonPedagogy !==
          result.referencePedagogy &&
        !result.sourceConfirmsJsonPedagogy &&
        !result.sourcePedagogy.includes(
          result.referencePedagogy
        )
    );

  console.log(
    "Potentially safe metadata repairs"
  );

  if (
    sourceConfirmed.length === 0
  ) {
    console.log(
      "   None confirmed by this audit."
    );
  } else {
    for (const result of sourceConfirmed) {
      console.log(
        `   ${result.code}: JSON pedagogy ${result.jsonPedagogy} → reference ${result.referencePedagogy}`
      );
      console.log(
        `      Source evidence: ${result.sourcePedagogy.join(
          ", "
        )}`
      );
    }
  }

  console.log("");

  console.log(
    "Packages where source confirms current JSON pedagogy"
  );

  if (
    sourceConfirmsJson.length ===
    0
  ) {
    console.log(
      "   None detected."
    );
  } else {
    for (const result of sourceConfirmsJson) {
      console.log(
        `   ${result.code}: ${result.jsonPedagogy} hours`
      );
    }
  }

  console.log("");

  console.log(
    "Packages requiring manual/source review"
  );

  if (
    unresolved.length === 0
  ) {
    console.log(
      "   None detected."
    );
  } else {
    for (const result of unresolved) {
      console.log(
        `   ${result.code}: JSON=${result.jsonPedagogy}, reference=${result.referencePedagogy}, source=${formatValue(
          result.sourcePedagogy
        )}`
      );
    }
  }

  console.log("");

  console.log(
    "IMPORTANT: No recommendations above are automatically applied."
  );
}

// ============================================================
// MAIN
// ============================================================

function main() {
  console.log(
    "========================================"
  );

  console.log(
    " Semester-1 Metadata Audit"
  );

  console.log(
    " VTU 2022 CSE"
  );

  console.log(
    " READ-ONLY"
  );

  console.log(
    "========================================"
  );

  // ----------------------------------------------------------
  // Environment
  // ----------------------------------------------------------

  if (
    !fileExists(
      CURRICULUM_DIR
    )
  ) {
    error(
      `Curriculum directory not found: ${CURRICULUM_DIR}`
    );

    process.exitCode = 1;
    return;
  }

  if (
    !fileExists(
      SCHEME_FILE
    )
  ) {
    error(
      `Scheme file not found: ${SCHEME_FILE}`
    );

    process.exitCode = 1;
    return;
  }

  if (
    !fileExists(
      SUBJECT_DIR
    )
  ) {
    error(
      `Subject directory not found: ${SUBJECT_DIR}`
    );

    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // Load scheme
  // ----------------------------------------------------------

  let scheme;

  try {
    scheme =
      readJson(
        SCHEME_FILE
      );
  } catch (err) {
    error(
      `Could not parse scheme: ${err.message}`
    );

    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // Validate scheme identity
  // ----------------------------------------------------------

  section(
    "Scheme Identity"
  );

  const regulation =
    String(
      scheme?.scheme?.regulation ??
        scheme?.regulation ??
        ""
    );

  const semester =
    Number(
      scheme?.semester ??
        scheme?.semester_number
    );

  const branch =
    normalizeCode(
      scheme?.branch?.code ??
        scheme?.branch_code ??
        ""
    );

  console.log(
    `Regulation : ${regulation || "undefined"}`
  );

  console.log(
    `Semester   : ${Number.isFinite(semester) ? semester : "undefined"}`
  );

  console.log(
    `Branch     : ${branch || "undefined"}`
  );

  if (
    regulation !==
    EXPECTED_REGULATION
  ) {
    error(
      `Unexpected regulation: ${regulation || "undefined"}`
    );
  }

  if (
    semester !==
    EXPECTED_SEMESTER
  ) {
    error(
      `Unexpected semester: ${semester}`
    );
  }

  if (
    branch !==
    EXPECTED_BRANCH
  ) {
    error(
      `Unexpected branch: ${branch || "undefined"}`
    );
  }

  // ----------------------------------------------------------
  // Courses
  // ----------------------------------------------------------

  let courses;

  try {
    courses =
      getSchemeCourses(
        scheme
      );
  } catch (err) {
    error(err.message);

    process.exitCode = 1;
    return;
  }

  console.log(
    `Courses    : ${courses.length}`
  );

  if (
    courses.length !==
    EXPECTED_COURSE_COUNT
  ) {
    error(
      `Expected ${EXPECTED_COURSE_COUNT} courses, found ${courses.length}`
    );
  }

  const expectedCourses =
    new Map();

  for (const course of courses) {
    const code =
      getCourseCode(
        course
      );

    if (!code) {
      error(
        "Scheme contains a course without a valid code."
      );
      continue;
    }

    if (
      expectedCourses.has(
        code
      )
    ) {
      error(
        `Duplicate course code in scheme: ${code}`
      );
      continue;
    }

    expectedCourses.set(
      code,
      course
    );
  }

  // ----------------------------------------------------------
  // Inventory
  // ----------------------------------------------------------

  section(
    "Package Inventory"
  );

  const jsonFiles =
    listJsonFiles(
      SUBJECT_DIR
    );

  const packageFiles =
    jsonFiles.filter(
      (filename) =>
        normalizeCode(
          path.basename(
            filename,
            ".json"
          )
        ) !==
        "SCHEMESEM12"
    );

  console.log(
    `JSON packages found: ${packageFiles.length}`
  );

  const packageMap =
    new Map();

  for (const filename of packageFiles) {
    const code =
      normalizeCode(
        path.basename(
          filename,
          ".json"
        )
      );

    if (!code) {
      warn(
        `Could not derive code from ${filename}`
      );
      continue;
    }

    packageMap.set(
      code,
      filename
    );
  }

  // ----------------------------------------------------------
  // Audit every expected course
  // ----------------------------------------------------------

  section(
    "Auditing Subject Metadata"
  );

  for (
    const [
      code,
      schemeCourse,
    ] of expectedCourses.entries()
  ) {
    const filename =
      packageMap.get(
        code
      );

    if (!filename) {
      error(
        `${code}: JSON package is missing`
      );
      continue;
    }

    const jsonPath =
      path.join(
        SUBJECT_DIR,
        filename
      );

    let subject;

    try {
      subject =
        readJson(
          jsonPath
        );
    } catch (err) {
      error(
        `${code}: could not parse JSON: ${err.message}`
      );
      continue;
    }

    const sourcePath =
      getSourceFile(
        code
      );

    if (
      !fileExists(
        sourcePath
      )
    ) {
      warn(
        `${code}: source TXT missing: ${path.basename(
          sourcePath
        )}`
      );

      continue;
    }

    let sourceText;

    try {
      sourceText =
        readText(
          sourcePath
        );
    } catch (err) {
      error(
        `${code}: could not read source TXT: ${err.message}`
      );
      continue;
    }

    const result =
      auditSubject(
        code,
        schemeCourse,
        subject,
        sourceText
      );

    console.log(
      `${code.padEnd(12)} credits=${formatValue(
        result.jsonCredits
      ).padEnd(4)} pedagogy=${formatValue(
        result.jsonPedagogy
      ).padEnd(4)} module_total=${formatValue(
        result.moduleHours
      ).padEnd(4)} source_pedagogy=${formatValue(
        result.sourcePedagogy
      )}`
    );
  }

  // ----------------------------------------------------------
  // Reports
  // ----------------------------------------------------------

  printSummaryTable();

  printOneCreditFocus();

  printPedagogyMismatchReport();

  printSourceEvidenceReport();

  printDateReport();

  printCreditReport();

  printIdentityReport();

  printRecommendations();

  // ----------------------------------------------------------
  // Final summary
  // ----------------------------------------------------------

  section(
    "Audit Summary"
  );

  console.log(
    `Courses expected : ${expectedCourses.size}`
  );

  console.log(
    `Courses audited  : ${results.length}`
  );

  console.log(
    `Errors           : ${errors.length}`
  );

  console.log(
    `Warnings         : ${warnings.length}`
  );

  console.log(
    `Info messages    : ${info.length}`
  );

  console.log("");

  console.log(
    "========================================"
  );

  console.log(
    " READ-ONLY METADATA AUDIT COMPLETED"
  );

  console.log(
    "========================================"
  );

  console.log("");

  console.log(
    "No JSON files were modified."
  );

  console.log(
    "No TXT files were modified."
  );

  console.log(
    "No PDF files were modified."
  );

  console.log(
    "No Supabase changes were made."
  );

  console.log("");

  console.log(
    "Use the audit output to decide which metadata values have source evidence."
  );

  console.log(
    "Do NOT change pedagogy_hours based only on the reference convention."
  );

  console.log(
    "Source evidence must be checked before any repair."
  );

  process.exitCode =
    errors.length > 0
      ? 1
      : 0;
}

main();
