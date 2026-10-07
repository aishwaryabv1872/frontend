
/**
 * BESCK104A Source Inspector
 *
 * VTU 2022 CSE - Semester 1
 *
 * PURPOSE:
 *   Inspect BESCK104A metadata and source TXT evidence
 *   before making any pedagogy_hours correction.
 *
 * IMPORTANT:
 *   - READ-ONLY
 *   - Never modifies JSON
 *   - Never modifies TXT
 *   - Never modifies PDF
 *   - Never writes to Supabase
 *
 * Specifically investigates:
 *   JSON pedagogy_hours = 50
 *   Reference pedagogy   = 40
 *   Source pedagogy      = 25, 25
 *
 * The goal is to determine whether:
 *   40, 50, or another value
 * is actually supported by the source.
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

const JSON_FILE = path.join(
  SUBJECT_DIR,
  "BESCK104A.json"
);

const TXT_FILE = path.join(
  SUBJECT_DIR,
  "BESCK104A.txt"
);

const PDF_FILE = path.join(
  SUBJECT_DIR,
  "BESCK104A.pdf"
);

// ============================================================
// CONSTANTS
// ============================================================

const TARGET_CODE = "BESCK104A";

const EXPECTED_REFERENCE_CREDITS = 3;
const EXPECTED_REFERENCE_PEDAGOGY = 40;

// How many lines around an interesting match to display.
const CONTEXT_LINES = 8;

// ============================================================
// OUTPUT HELPERS
// ============================================================

function section(title) {
  console.log("");
  console.log("============================================================");
  console.log(` ${title}`);
  console.log("============================================================");
}

function subsection(title) {
  console.log("");
  console.log("------------------------------------------------------------");
  console.log(` ${title}`);
  console.log("------------------------------------------------------------");
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

function warning(message) {
  console.log(`⚠️  ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
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

// ============================================================
// NORMALIZATION
// ============================================================

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .trim();
}

function normalizeCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// ============================================================
// NUMBER EXTRACTION
// ============================================================

function extractNumbers(text) {
  const matches = [];

  const regex =
    /(?<![A-Za-z])\d+(?:\.\d+)?(?![A-Za-z])/g;

  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      value: match[0],
      index: match.index,
    });
  }

  return matches;
}

function uniqueNumbers(numbers) {
  return [
    ...new Set(
      numbers.map((item) => item.value)
    ),
  ];
}

// ============================================================
// LINE HELPERS
// ============================================================

function getLines(text) {
  return text
    .split("\n")
    .map((line) => cleanText(line));
}

function printLine(lines, index, prefix = "") {
  if (
    index < 0 ||
    index >= lines.length
  ) {
    return;
  }

  const lineNumber =
    String(index + 1).padStart(5, " ");

  console.log(
    `${prefix}${lineNumber} | ${lines[index]}`
  );
}

function printContext(
  lines,
  centerIndex,
  context = CONTEXT_LINES
) {
  const start =
    Math.max(
      0,
      centerIndex - context
    );

  const end =
    Math.min(
      lines.length - 1,
      centerIndex + context
    );

  for (
    let index = start;
    index <= end;
    index++
  ) {
    const marker =
      index === centerIndex
        ? ">>> "
        : "    ";

    printLine(
      lines,
      index,
      marker
    );
  }
}

// ============================================================
// SEARCH HELPERS
// ============================================================

function findLineIndexes(
  lines,
  patterns
) {
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line =
      lines[i].toLowerCase();

    const matched =
      patterns.some((pattern) =>
        line.includes(
          pattern.toLowerCase()
        )
      );

    if (matched) {
      results.push(i);
    }
  }

  return results;
}

function printMatches(
  lines,
  patterns,
  title
) {
  subsection(title);

  const indexes =
    findLineIndexes(
      lines,
      patterns
    );

  if (indexes.length === 0) {
    warning(
      `No matches found for: ${patterns.join(
        ", "
      )}`
    );
    return;
  }

  info(
    `Found ${indexes.length} matching line(s).`
  );

  const printed = new Set();

  for (const index of indexes) {
    const start =
      Math.max(
        0,
        index - 1
      );

    const end =
      Math.min(
        lines.length - 1,
        index + 1
      );

    for (
      let i = start;
      i <= end;
      i++
    ) {
      if (!printed.has(i)) {
        printLine(
          lines,
          i,
          i === index
            ? ">>> "
            : "    "
        );

        printed.add(i);
      }
    }

    console.log("");
  }
}

// ============================================================
// COURSE IDENTITY INSPECTION
// ============================================================

function inspectCourseIdentity(
  subject,
  sourceText
) {
  section("Course Identity");

  console.log(
    `Target code       : ${TARGET_CODE}`
  );

  console.log(
    `JSON subject_code : ${subject.subject_code}`
  );

  console.log(
    `JSON subject_name : ${subject.subject_name}`
  );

  console.log(
    `JSON credits      : ${subject.credits}`
  );

  console.log(
    `JSON course_type  : ${subject.course_type}`
  );

  console.log(
    `JSON pedagogy     : ${subject.pedagogy_hours}`
  );

  const sourceHasCode =
    normalizeCode(sourceText).includes(
      normalizeCode(TARGET_CODE)
    );

  console.log(
    `Source contains code: ${
      sourceHasCode ? "YES" : "NO"
    }`
  );
}

// ============================================================
// JSON MODULE INSPECTION
// ============================================================

function inspectJsonModules(subject) {
  section("JSON Module Structure");

  const modules =
    Array.isArray(subject.modules)
      ? subject.modules
      : [];

  console.log(
    `Module count : ${modules.length}`
  );

  let totalHours = 0;
  let knownHours = 0;

  modules.forEach(
    (module, index) => {
      const hours =
        Number(module?.hours);

      const validHours =
        Number.isFinite(hours);

      if (validHours) {
        totalHours += hours;
        knownHours++;
      }

      console.log("");

      console.log(
        `Module ${index + 1}`
      );

      console.log(
        `  module_number : ${module?.module_number}`
      );

      console.log(
        `  title         : ${module?.title}`
      );

      console.log(
        `  hours         : ${
          validHours
            ? hours
            : String(module?.hours)
        }`
      );

      console.log(
        `  topics        : ${
          Array.isArray(module?.topics)
            ? module.topics.length
            : "INVALID"
        }`
      );

      if (
        Array.isArray(
          module?.topics
        )
      ) {
        module.topics.forEach(
          (topic, topicIndex) => {
            console.log(
              `    ${topicIndex + 1}. ${
                typeof topic === "string"
                  ? topic
                  : topic?.title
              }`
            );
          }
        );
      }
    }
  );

  console.log("");

  console.log(
    `Known module hours : ${knownHours}/${modules.length}`
  );

  console.log(
    `Module total       : ${totalHours}`
  );

  console.log(
    `JSON pedagogy      : ${subject.pedagogy_hours}`
  );

  console.log(
    `Reference pedagogy : ${EXPECTED_REFERENCE_PEDAGOGY}`
  );
}

// ============================================================
// JSON COURSE OUTCOME INSPECTION
// ============================================================

function inspectCourseOutcomes(
  subject
) {
  section("JSON Course Outcomes");

  const outcomes =
    Array.isArray(
      subject.course_outcomes
    )
      ? subject.course_outcomes
      : [];

  console.log(
    `CO count : ${outcomes.length}`
  );

  outcomes.forEach(
    (outcome, index) => {
      console.log(
        `CO${index + 1}: ${outcome}`
      );
    }
  );
}

// ============================================================
// JSON SOURCE METADATA
// ============================================================

function inspectJsonSource(
  subject
) {
  section("JSON Source Metadata");

  const source =
    subject.source ?? {};

  console.log(
    `source_name     : ${source.source_name}`
  );

  console.log(
    `source_document : ${source.source_document}`
  );

  console.log(
    `source_date     : ${source.source_date}`
  );
}

// ============================================================
// SOURCE COURSE CODE SEARCH
// ============================================================

function inspectCourseCode(
  lines
) {
  printMatches(
    lines,
    [
      TARGET_CODE,
      "BESCK104",
      "BESCK",
    ],
    "Source Course-Code Evidence"
  );
}

// ============================================================
// SOURCE PEDAGOGY SEARCH
// ============================================================

function inspectPedagogy(
  lines
) {
  printMatches(
    lines,
    [
      "pedagogy",
      "pedagogy hours",
      "hours of pedagogy",
      "total hours",
      "total hours of pedagogy",
      "teaching hours",
      "hours",
    ],
    "Source Pedagogy / Hours Evidence"
  );
}

// ============================================================
// SOURCE CREDIT SEARCH
// ============================================================

function inspectCredits(
  lines
) {
  printMatches(
    lines,
    [
      "credit",
      "credits",
      "course credit",
      "course credits",
    ],
    "Source Credit Evidence"
  );
}

// ============================================================
// SOURCE MODULE SEARCH
// ============================================================

function inspectModules(
  lines
) {
  printMatches(
    lines,
    [
      "module 1",
      "module 2",
      "module 3",
      "module 4",
      "module 5",
      "module-1",
      "module-2",
      "module-3",
      "module-4",
      "module-5",
    ],
    "Source Module Evidence"
  );
}

// ============================================================
// NUMBER CONTEXT ANALYSIS
// ============================================================

function inspectImportantNumbers(
  lines
) {
  section(
    "Important Numeric Values in Source"
  );

  const interestingValues =
    new Set([
      "1",
      "2",
      "3",
      "4",
      "5",
      "15",
      "20",
      "25",
      "30",
      "35",
      "40",
      "45",
      "50",
      "60",
    ]);

  const matches = [];

  lines.forEach(
    (line, index) => {
      const numbers =
        extractNumbers(line);

      const interesting =
        numbers.filter((item) =>
          interestingValues.has(
            item.value
          )
        );

      if (
        interesting.length > 0
      ) {
        matches.push({
          index,
          line,
          numbers:
            uniqueNumbers(
              interesting
            ),
        });
      }
    }
  );

  console.log(
    `Lines containing important values: ${matches.length}`
  );

  for (const match of matches) {
    printLine(
      lines,
      match.index,
      ">>> "
    );

    console.log(
      `      values: ${match.numbers.join(
        ", "
      )}`
    );
  }
}

// ============================================================
// 25 / 40 / 50 FOCUSED ANALYSIS
// ============================================================

function inspectTargetNumbers(
  lines
) {
  section(
    "Focused 25 / 40 / 50 Analysis"
  );

  const targets = [
    "25",
    "40",
    "50",
  ];

  for (const target of targets) {
    subsection(
      `Occurrences of ${target}`
    );

    const indexes = [];

    lines.forEach(
      (line, index) => {
        const regex =
          new RegExp(
            `(?<![A-Za-z])${target}(?![A-Za-z])`
          );

        if (
          regex.test(line)
        ) {
          indexes.push(index);
        }
      }
    );

    console.log(
      `Occurrences found: ${indexes.length}`
    );

    if (
      indexes.length === 0
    ) {
      continue;
    }

    for (const index of indexes) {
      printContext(
        lines,
        index,
        4
      );

      console.log("");
    }
  }
}

// ============================================================
// TABLE-LIKE LINE ANALYSIS
// ============================================================

function inspectTableLikeLines(
  lines
) {
  section(
    "Table-Like Source Lines"
  );

  const keywords = [
    "BESCK104A",
    "ENGINEERING",
    "SCIENCE",
    "COURSE",
    "CREDIT",
    "PEDAGOGY",
    "MODULE",
    "TOTAL",
    "HOURS",
  ];

  const candidates = [];

  lines.forEach(
    (line, index) => {
      const normalized =
        line.toLowerCase();

      const keywordCount =
        keywords.filter(
          (keyword) =>
            normalized.includes(
              keyword.toLowerCase()
            )
        ).length;

      const numbers =
        extractNumbers(line);

      if (
        keywordCount >= 1 &&
        numbers.length >= 1
      ) {
        candidates.push({
          index,
          keywordCount,
          numbers:
            uniqueNumbers(
              numbers
            ),
        });
      }
    }
  );

  candidates.sort(
    (a, b) =>
      b.keywordCount -
        a.keywordCount ||
      a.index - b.index
  );

  console.log(
    `Candidate lines: ${candidates.length}`
  );

  for (
    const candidate of candidates
  ) {
    printLine(
      lines,
      candidate.index,
      ">>> "
    );

    console.log(
      `      numeric values: ${candidate.numbers.join(
        ", "
      )}`
    );
  }
}

// ============================================================
// DATE SEARCH
// ============================================================

function inspectDates(
  lines
) {
  section("Source Date Evidence");

  const datePatterns = [
    /\b\d{1,2}\.\d{1,2}\.\d{4}\b/g,
    /\b\d{1,2}-\d{1,2}-\d{4}\b/g,
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
    /\b\d{1,2}-\d{1,2}\.\d{2}\b/g,
  ];

  const found = [];

  lines.forEach(
    (line, index) => {
      for (
        const regex of datePatterns
      ) {
        const matches =
          line.match(regex);

        if (
          matches &&
          matches.length > 0
        ) {
          found.push({
            index,
            dates: [
              ...new Set(matches),
            ],
          });
        }
      }
    }
  );

  if (
    found.length === 0
  ) {
    warning(
      "No recognizable dates found."
    );
    return;
  }

  for (const item of found) {
    printLine(
      lines,
      item.index,
      ">>> "
    );

    console.log(
      `      dates: ${item.dates.join(
        ", "
      )}`
    );
  }
}

// ============================================================
// SOURCE NUMBER SUMMARY
// ============================================================

function inspectGlobalNumberSummary(
  sourceText
) {
  section(
    "Global Numeric Summary"
  );

  const numbers =
    extractNumbers(
      sourceText
    );

  const counts =
    new Map();

  for (const item of numbers) {
    counts.set(
      item.value,
      (counts.get(item.value) ?? 0) +
        1
    );
  }

  const sorted =
    [...counts.entries()]
      .sort((a, b) => {
        const aNum =
          Number(a[0]);

        const bNum =
          Number(b[0]);

        return aNum - bNum;
      });

  console.log(
    `Total numeric tokens: ${numbers.length}`
  );

  console.log("");

  for (
    const [value, count] of sorted
  ) {
    console.log(
      `  ${value.padStart(8, " ")} : ${count}`
    );
  }
}

// ============================================================
// RAW SOURCE PREVIEW
// ============================================================

function inspectSourceSize(
  sourceText
) {
  section("Source File Information");

  console.log(
    `TXT path      : ${TXT_FILE}`
  );

  console.log(
    `TXT characters: ${sourceText.length}`
  );

  console.log(
    `TXT lines     : ${
      sourceText.split("\n").length
    }`
  );

  console.log(
    `PDF exists    : ${
      fileExists(PDF_FILE)
        ? "YES"
        : "NO"
    }`
  );

  if (
    fileExists(PDF_FILE)
  ) {
    const stats =
      fs.statSync(PDF_FILE);

    console.log(
      `PDF size      : ${stats.size} bytes`
    );
  }
}

// ============================================================
// FINAL INTERPRETATION
// ============================================================

function printInterpretation(
  subject
) {
  section(
    "Current Evidence — NO CHANGES MADE"
  );

  const jsonPedagogy =
    Number(
      subject.pedagogy_hours
    );

  console.log(
    `JSON pedagogy       : ${jsonPedagogy}`
  );

  console.log(
    `Reference pedagogy  : ${EXPECTED_REFERENCE_PEDAGOGY}`
  );

  console.log(
    `JSON module total   : ${
      Array.isArray(subject.modules)
        ? subject.modules.reduce(
            (sum, module) =>
              sum +
              (Number.isFinite(
                Number(module?.hours)
              )
                ? Number(module.hours)
                : 0),
            0
          )
        : "N/A"
    }`
  );

  console.log(
    `Expected credits    : ${EXPECTED_REFERENCE_CREDITS}`
  );

  console.log(
    `JSON credits        : ${subject.credits}`
  );

  console.log("");

  warning(
    "The source previously produced pedagogy values 25, 25."
  );

  warning(
    "Do NOT change pedagogy_hours until the source context above is interpreted."
  );

  info(
    "This script has made ZERO file modifications."
  );

  info(
    "No Supabase operations were performed."
  );
}

// ============================================================
// MAIN
// ============================================================

function main() {
  console.log(
    "============================================================"
  );

  console.log(
    " BESCK104A Source Inspector"
  );

  console.log(
    " VTU 2022 CSE - Semester 1"
  );

  console.log(
    " READ-ONLY"
  );

  console.log(
    "============================================================"
  );

  // ----------------------------------------------------------
  // Validate files
  // ----------------------------------------------------------

  if (
    !fileExists(JSON_FILE)
  ) {
    console.error(
      `\n❌ JSON file not found:\n${JSON_FILE}`
    );

    process.exitCode = 1;
    return;
  }

  if (
    !fileExists(TXT_FILE)
  ) {
    console.error(
      `\n❌ TXT file not found:\n${TXT_FILE}`
    );

    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // Load JSON
  // ----------------------------------------------------------

  let subject;

  try {
    subject =
      readJson(JSON_FILE);
  } catch (error) {
    console.error(
      `\n❌ Could not parse JSON:\n${error.message}`
    );

    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // Load TXT
  // ----------------------------------------------------------

  let sourceText;

  try {
    sourceText =
      readText(TXT_FILE);
  } catch (error) {
    console.error(
      `\n❌ Could not read TXT:\n${error.message}`
    );

    process.exitCode = 1;
    return;
  }

  const lines =
    getLines(sourceText);

  // ----------------------------------------------------------
  // Inspect
  // ----------------------------------------------------------

  inspectSourceSize(
    sourceText
  );

  inspectCourseIdentity(
    subject,
    sourceText
  );

  inspectJsonSource(
    subject
  );

  inspectJsonModules(
    subject
  );

  inspectCourseOutcomes(
    subject
  );

  inspectCourseCode(
    lines
  );

  inspectPedagogy(
    lines
  );

  inspectCredits(
    lines
  );

  inspectModules(
    lines
  );

  inspectImportantNumbers(
    lines
  );

  inspectTargetNumbers(
    lines
  );

  inspectTableLikeLines(
    lines
  );

  inspectDates(
    lines
  );

  inspectGlobalNumberSummary(
    sourceText
  );

  printInterpretation(
    subject
  );

  // ----------------------------------------------------------
  // Final safety statement
  // ----------------------------------------------------------

  console.log("");

  console.log(
    "============================================================"
  );

  success(
    "BESCK104A SOURCE INSPECTION COMPLETED"
  );

  console.log(
    "============================================================"
  );

  console.log("");

  console.log(
    "READ-ONLY RESULT:"
  );

  console.log(
    "  JSON modified : NO"
  );

  console.log(
    "  TXT modified  : NO"
  );

  console.log(
    "  PDF modified  : NO"
  );

  console.log(
    "  Supabase      : NO"
  );

  console.log("");

  console.log(
    "Use the printed source context to decide whether"
  );

  console.log(
    "BESCK104A pedagogy_hours should remain 50 or be"
  );

  console.log(
    "changed to the source-supported value."
  );
}

main();
