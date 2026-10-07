/**
 * ============================================================
 * Vertex — VTU Curriculum Warning Classifier v3
 * ============================================================
 *
 * READ-ONLY
 *
 * Purpose:
 *   Classify curriculum warnings before any automated repair.
 *
 * Categories:
 *   ARTIFACT
 *   SOURCE_LIMITATION
 *   VALIDATOR_LOGIC
 *   REVIEW
 *
 * IMPORTANT:
 *   This script NEVER modifies curriculum JSON files.
 *   This script NEVER modifies Supabase.
 *
 * Run:
 *   node scripts/classify-curriculum-warnings.mjs
 *
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

const SCHEME_FILE = path.join(
  BRANCH_DIR,
  "semester-1.json"
);

// ============================================================
// EXPECTED VALUES
// ============================================================

const EXPECTED_COURSE_COUNT = 31;

// ============================================================
// ALTERNATE COURSE CODES
// ============================================================

const ALTERNATE_CODE_MAP = {
  BCEDK103: "BCEDK203",
  BPHYS102: "BPHYS202",
  BCHES102: "BCHES202",
  BPOPS103: "BPOPS203",
  BENGK106: "BENGK206",
  BPWSK106: "BPWSK206",
  BKSKK107: "BKSKK207",
  BKBKK107: "BKBKK207",
  BICOK107: "BICOK207",
  BIDTK158: "BIDTK258",
  BSFHK158: "BSFHK258",
};

// ============================================================
// SOURCE CODE PREFIX ALIASES
// ============================================================

const SOURCE_CODE_PREFIX_ALIASES = {
  BETCK: "BETC",
};

// ============================================================
// KNOWN EXTRACTION ARTIFACTS
// ============================================================

const KNOWN_ARTIFACTS = [
  "BPWSK206106",
  "BENGK106206",
  "BKBKK107207",
  "BSFHK158258",
  "BETCK105J205J",

  "BENGK106-206",
  "BPWSK206-106",
  "BKBKK107-207",
  "BSFHK108-208",
  "BETCK105J-205J",

  "BSFHK158/258",
];

// ============================================================
// SPECIAL / ONE-CREDIT COURSE TYPES
// ============================================================

const SPECIAL_ONE_CREDIT_CODES = new Set([
  "BENGK106",
  "BPWSK106",
  "BKSKK107",
  "BKBKK107",
  "BICOK107",
  "BIDTK158",
  "BSFHK158",
]);

// ============================================================
// CLASSIFICATIONS
// ============================================================

const categories = {
  artifact: [],
  source_limitation: [],
  validator_logic: [],
  review: [],
};

// ============================================================
// BASIC HELPERS
// ============================================================

function section(title) {
  console.log("");
  console.log("=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value) {
  return clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeLoose(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function add(
  category,
  code,
  message,
  reason
) {
  if (!categories[category]) {
    return;
  }

  categories[category].push({
    code,
    message,
    reason,
  });
}

// ============================================================
// SUBJECT HELPERS
// ============================================================

function getCode(subject) {
  return clean(
    subject?.subject_code ??
    subject?.course_code ??
    subject?.code ??
    subject?.course?.code ??
    ""
  );
}

function getCredits(subject) {
  const value =
    subject?.credits ??
    subject?.course?.credits;

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getCourseType(subject) {
  return clean(
    subject?.course_type ??
    subject?.course?.course_type ??
    ""
  );
}

function getPedagogyHours(subject) {
  const value =
    subject?.pedagogy_hours ??
    subject?.course?.pedagogy_hours ??
    subject?.hours ??
    null;

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getModules(subject) {
  if (Array.isArray(subject?.modules)) {
    return subject.modules;
  }

  if (
    Array.isArray(
      subject?.course?.modules
    )
  ) {
    return subject.course.modules;
  }

  return [];
}

function getOutcomes(subject) {
  if (
    Array.isArray(
      subject?.course_outcomes
    )
  ) {
    return subject.course_outcomes;
  }

  if (
    Array.isArray(
      subject?.outcomes
    )
  ) {
    return subject.outcomes;
  }

  return [];
}

function getSource(subject) {
  return subject?.source ?? {};
}

// ============================================================
// CODE EQUIVALENCE
// ============================================================

function isExpectedCode(
  extractedCode,
  expectedCode
) {
  const extracted =
    normalizeCode(extractedCode);

  const expected =
    normalizeCode(expectedCode);

  if (
    extracted === expected
  ) {
    return true;
  }

  const alternate =
    ALTERNATE_CODE_MAP[expectedCode];

  if (
    alternate &&
    extracted ===
      normalizeCode(alternate)
  ) {
    return true;
  }

  const aliasPrefix =
    Object.entries(
      SOURCE_CODE_PREFIX_ALIASES
    ).find(
      ([expectedPrefix]) =>
        expected.startsWith(
          expectedPrefix
        )
    );

  if (aliasPrefix) {
    const [
      expectedPrefix,
      sourcePrefix,
    ] = aliasPrefix;

    const expectedSuffix =
      expected.slice(
        expectedPrefix.length
      );

    const aliased =
      normalizeCode(
        `${sourcePrefix}${expectedSuffix}`
      );

    if (
      extracted === aliased
    ) {
      return true;
    }
  }

  return false;
}

// ============================================================
// ARTIFACT DETECTION
// ============================================================

function isKnownArtifact(text) {
  const normalized =
    clean(text).toUpperCase();

  if (!normalized) {
    return false;
  }

  return KNOWN_ARTIFACTS.some(
    artifact =>
      normalized.includes(
        artifact
      )
  );
}

function isCodeJoiningArtifact(
  text,
  expectedCode
) {
  const raw =
    clean(text).toUpperCase();

  if (!raw) {
    return false;
  }

  const expected =
    expectedCode.toUpperCase();

  const alternate =
    ALTERNATE_CODE_MAP[
      expectedCode
    ]?.toUpperCase();

  if (!alternate) {
    return false;
  }

  const patterns = [
    `${expected}-${alternate}`,
    `${expected}/${alternate}`,
    `${expected}${alternate}`,

    `${alternate}-${expected}`,
    `${alternate}/${expected}`,
    `${alternate}${expected}`,

    `${expected}-${alternate.slice(
      expected.length
    )}`,

    `${expected}/${alternate.slice(
      expected.length
    )}`,
  ];

  return patterns.some(
    pattern =>
      raw.includes(pattern)
  );
}

function isArtifact(
  text,
  expectedCode
) {
  return (
    isKnownArtifact(text) ||
    isCodeJoiningArtifact(
      text,
      expectedCode
    )
  );
}

// ============================================================
// MODULE TITLE ANALYSIS
// ============================================================

function isGenericModuleTitle(title) {
  return (
    !title ||
    /^module\s*\d+$/i.test(title)
  );
}

function isHourOnlyTitle(title) {
  return /^\(\d+(?:\.\d+)?\)$/.test(
    clean(title)
  );
}

// ============================================================
// SPECIAL COURSE LOGIC
// ============================================================

function isSpecialOneCreditCourse(
  code,
  credits,
  courseType
) {
  if (
    SPECIAL_ONE_CREDIT_CODES.has(
      code
    )
  ) {
    return true;
  }

  if (
    credits !== null &&
    credits <= 1
  ) {
    return true;
  }

  const type =
    courseType.toLowerCase();

  return (
    type.includes("one credit") ||
    type.includes("audit") ||
    type.includes("mandatory")
  );
}

/*
 * IMPORTANT:
 *
 * This is ONLY a fallback heuristic.
 *
 * It must NEVER override an explicit
 * pedagogy_hours value already stored
 * in the subject JSON.
 */
function fallbackExpectedPedagogyHours(
  code,
  credits,
  courseType
) {
  if (
    isSpecialOneCreditCourse(
      code,
      credits,
      courseType
    )
  ) {
    return 15;
  }

  return 40;
}

// ============================================================
// DUPLICATE TOPIC ANALYSIS
// ============================================================

function classifyDuplicateTopic(
  code,
  topicTitle,
  count
) {
  if (
    isArtifact(
      topicTitle,
      code
    )
  ) {
    add(
      "artifact",
      code,
      `duplicate topic "${topicTitle}" appears ${count} times`,
      "The topic is a known current/alternate course-code extraction artifact."
    );

    return;
  }

  add(
    "review",
    code,
    `duplicate topic "${topicTitle}" appears ${count} times`,
    "Could be legitimate repetition or a PDF extraction duplicate."
  );
}

// ============================================================
// SUBJECT CLASSIFICATION
// ============================================================

function classifySubject(
  fileName,
  subject
) {
  const code =
    getCode(subject) ||
    fileName.replace(
      /\.json$/i,
      ""
    );

  const credits =
    getCredits(subject);

  const courseType =
    getCourseType(subject);

  const pedagogyHours =
    getPedagogyHours(subject);

  const modules =
    getModules(subject);

  const outcomes =
    getOutcomes(subject);

  const source =
    getSource(subject);

  // ==========================================================
  // SOURCE DATE
  // ==========================================================

  if (!source.source_date) {
    add(
      "source_limitation",
      code,
      "source_date is missing",
      "The package does not contain a publication date in source metadata."
    );
  }

  // ==========================================================
  // SOURCE DOCUMENT
  // ==========================================================

  const sourceDocument =
    clean(
      source.source_document
    );

  if (
    sourceDocument &&
    /official syllabus/i.test(
      sourceDocument
    ) &&
    !sourceDocument
      .toLowerCase()
      .endsWith(".pdf")
  ) {
    add(
      "source_limitation",
      code,
      `source document is an external/reference placeholder: ${sourceDocument}`,
      "No local PDF is referenced by this metadata. This is not automatically a curriculum-data error."
    );
  }

  // ==========================================================
  // SOURCE COURSE CODE
  // ==========================================================

  const extractedCode =
    clean(
      source.extracted_course_code
    );

  if (!extractedCode) {
    add(
      "source_limitation",
      code,
      "source extracted_course_code is missing",
      "The source metadata does not contain an extracted code. Verify against the official source when available."
    );
  } else if (
    !isExpectedCode(
      extractedCode,
      code
    )
  ) {
    /*
     * Do not immediately classify an unusual source code
     * as an error. VTU PDFs frequently contain current and
     * alternate semester/regulation codes.
     */
    add(
      "review",
      code,
      `source extracted course code "${extractedCode}" does not match "${code}"`,
      "The extracted source code should be checked against the official VTU source."
    );
  }

  // ==========================================================
  // MODULES
  // ==========================================================

  let genericModuleCount = 0;

  for (
    let index = 0;
    index < modules.length;
    index++
  ) {
    const moduleEntry =
      modules[index];

    const title =
      clean(
        moduleEntry?.title ??
        moduleEntry?.module_title ??
        moduleEntry?.name ??
        ""
      );

    if (
      isGenericModuleTitle(title)
    ) {
      genericModuleCount++;
    }

    const moduleText =
      JSON.stringify(
        moduleEntry
      );

    // --------------------------------------------------------
    // ARTIFACT
    // --------------------------------------------------------

    if (
      isArtifact(
        moduleText,
        code
      )
    ) {
      add(
        "artifact",
        code,
        `module ${index + 1} contains a known course-code extraction artifact`,
        "The value joins a current VTU code with its alternate semester code."
      );
    }

    // --------------------------------------------------------
    // HOUR-ONLY TITLE
    // --------------------------------------------------------

    if (
      isHourOnlyTitle(title)
    ) {
      add(
        "review",
        code,
        `module ${index + 1} title is only "${title}"`,
        "The parenthetical number is probably an extracted hour marker; verify the actual module title from the source."
      );
    }

    // --------------------------------------------------------
    // EMPTY TOPICS
    // --------------------------------------------------------

    const topics =
      Array.isArray(
        moduleEntry?.topics
      )
        ? moduleEntry.topics
        : null;

    if (
      topics &&
      topics.length === 0
    ) {
      add(
        "review",
        code,
        `module ${index + 1} has empty topics`,
        "Verify whether the official syllabus actually provides no topic list."
      );
    }

    // --------------------------------------------------------
    // INVALID HOURS
    // --------------------------------------------------------

    const moduleHours =
      moduleEntry?.hours ??
      moduleEntry?.module_hours ??
      null;

    if (
      typeof moduleHours === "number" &&
      Number.isFinite(moduleHours) &&
      moduleHours < 0
    ) {
      add(
        "review",
        code,
        `module ${index + 1} contains invalid negative hours: ${moduleHours}`,
        "Module hours cannot be negative."
      );
    }
  }

  // ==========================================================
  // GENERIC MODULE TITLES
  // ==========================================================

  if (
    genericModuleCount > 0
  ) {
    add(
      "review",
      code,
      `${genericModuleCount} module title(s) are generic "Module N"`,
      "Official module titles should be verified against the source PDF."
    );
  }

  // ==========================================================
  // DUPLICATE TOPICS
  // ==========================================================

  const topicOccurrences =
    new Map();

  for (
    const moduleEntry
    of modules
  ) {
    const topics =
      Array.isArray(
        moduleEntry?.topics
      )
        ? moduleEntry.topics
        : [];

    for (
      const topic
      of topics
    ) {
      const title =
        typeof topic === "string"
          ? topic
          : clean(
              topic?.title ??
              topic?.name ??
              ""
            );

      const normalized =
        normalizeLoose(title);

      if (!normalized) {
        continue;
      }

      if (
        !topicOccurrences.has(
          normalized
        )
      ) {
        topicOccurrences.set(
          normalized,
          []
        );
      }

      topicOccurrences
        .get(normalized)
        .push(title);
    }
  }

  for (
    const [
      ,
      values
    ] of topicOccurrences
  ) {
    if (
      values.length > 1
    ) {
      classifyDuplicateTopic(
        code,
        values[0],
        values.length
      );
    }
  }

  // ==========================================================
  // MODULE HOURS
  // ==========================================================

  /*
   * IMPORTANT:
   *
   * We deliberately DO NOT assume:
   *
   *   1 credit  = 15 hours
   *   3 credits = 40 hours
   *
   * for module-hour validation.
   *
   * The source PDFs can contain:
   *
   *   25
   *   30
   *   32
   *   35
   *   40
   *   50
   *
   * or null/implicit module hours.
   *
   * Therefore module-hour totals are not automatically
   * classified as errors merely because they differ from
   * a generic 15/40 heuristic.
   */

  let numericHourCount = 0;
  let numericHourTotal = 0;

  for (
    const moduleEntry
    of modules
  ) {
    const value =
      moduleEntry?.hours ??
      moduleEntry?.module_hours ??
      null;

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      numericHourCount++;
      numericHourTotal += value;
    }
  }

  /*
   * Keep the values available for diagnostics without
   * generating false warnings.
   */
  void numericHourCount;
  void numericHourTotal;

  // ==========================================================
  // PEDAGOGY HOURS
  // ==========================================================

  /*
   * IMPORTANT:
   *
   * An explicit pedagogy_hours value is source data.
   *
   * Example:
   *
   *   BESCK104A = 50
   *
   * should NOT be classified as:
   *
   *   "expected 40, got 50"
   *
   * because the official source explicitly says 50.
   *
   * The classifier therefore does not compare explicit
   * pedagogy_hours against the generic 15/40 heuristic.
   */

  if (
    pedagogyHours === null
  ) {
    /*
     * Missing pedagogy hours are not automatically an error.
     * Some source packages do not expose this value cleanly.
     */
  } else {
    /*
     * Explicit value exists.
     *
     * No heuristic warning is generated.
     */
    void fallbackExpectedPedagogyHours(
      code,
      credits,
      courseType
    );
  }

  // ==========================================================
  // COURSE OUTCOMES
  // ==========================================================

  if (
    outcomes.length === 0
  ) {
    add(
      "review",
      code,
      "course_outcomes array is empty",
      "Do not invent outcomes. Verify the official VTU source first."
    );
  }

  // ==========================================================
  // FULL JSON ARTIFACT SCAN
  // ==========================================================

  const fullJson =
    JSON.stringify(subject);

  if (
    isArtifact(
      fullJson,
      code
    )
  ) {
    add(
      "artifact",
      code,
      "JSON contains a known current/alternate course-code extraction artifact",
      "Likely PDF extraction contamination rather than a real curriculum value."
    );
  }
}

// ============================================================
// LOAD SCHEME
// ============================================================

if (!exists(SCHEME_FILE)) {
  console.error(
    `❌ Scheme file not found:\n${SCHEME_FILE}`
  );

  process.exit(1);
}

const scheme =
  readJson(SCHEME_FILE);

// ============================================================
// HEADER
// ============================================================

section(
  "Vertex — VTU 2022 CSE Semester 1 Warning Classifier v3"
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

// ============================================================
// SCHEME INFO
// ============================================================

console.log("");

console.log(
  `Semester    : ${
    scheme.semester ??
    "unknown"
  }`
);

console.log(
  `Regulation  : ${
    scheme.regulation ??
    "not explicitly stored"
  }`
);

console.log(
  `Source      : ${
    scheme.source_version ??
    scheme.source?.version ??
    "not explicitly stored"
  }`
);

const schemeBranch =
  typeof scheme.branch === "object"
    ? (
        scheme.branch?.short_name ??
        scheme.branch?.name ??
        "unknown"
      )
    : (
        scheme.branch ??
        "unknown"
      );

console.log(
  `Branch      : ${schemeBranch}`
);

// ============================================================
// SUBJECT DIRECTORY
// ============================================================

if (!exists(SUBJECTS_DIR)) {
  console.error(
    `❌ Subjects directory not found:\n${SUBJECTS_DIR}`
  );

  process.exit(1);
}

const subjectFiles =
  fs
    .readdirSync(
      SUBJECTS_DIR
    )
    .filter(
      file =>
        file
          .toLowerCase()
          .endsWith(".json")
    )
    .sort();

console.log("");

console.log(
  `Subject JSON files found: ${subjectFiles.length}`
);

if (
  subjectFiles.length !==
  EXPECTED_COURSE_COUNT
) {
  console.warn(
    `⚠ Expected ${EXPECTED_COURSE_COUNT} subject files but found ${subjectFiles.length}.`
  );
}

// ============================================================
// CLASSIFY ALL SUBJECTS
// ============================================================

for (
  const subjectFile
  of subjectFiles
) {
  const subjectPath =
    path.join(
      SUBJECTS_DIR,
      subjectFile
    );

  try {
    const subject =
      readJson(subjectPath);

    classifySubject(
      subjectFile,
      subject
    );
  } catch (error) {
    add(
      "review",
      subjectFile.replace(
        /\.json$/i,
        ""
      ),
      "JSON could not be parsed",
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
}

// ============================================================
// DEDUPLICATE
// ============================================================

for (
  const category
  of Object.keys(categories)
) {
  const seen =
    new Set();

  categories[category] =
    categories[category]
      .filter(item => {
        const key =
          `${item.code}|${item.message}`;

        if (
          seen.has(key)
        ) {
          return false;
        }

        seen.add(key);

        return true;
      });
}

// ============================================================
// SUMMARY
// ============================================================

section(
  "CLASSIFICATION SUMMARY"
);

console.log(
  `Artifact / safe extraction issues : ${categories.artifact.length}`
);

console.log(
  `Source limitations                : ${categories.source_limitation.length}`
);

console.log(
  `Validator logic candidates        : ${categories.validator_logic.length}`
);

console.log(
  `Manual / source review            : ${categories.review.length}`
);

const total =
  Object.values(categories)
    .reduce(
      (sum, items) =>
        sum + items.length,
      0
    );

console.log(
  `Total classified items            : ${total}`
);

// ============================================================
// PRINT CATEGORY
// ============================================================

function printCategory(
  title,
  icon,
  items
) {
  section(title);

  if (
    items.length === 0
  ) {
    console.log(
      "None."
    );

    return;
  }

  for (
    const item
    of items
  ) {
    console.log(
      `${icon} ${item.code} — ${item.message}`
    );

    console.log(
      `   Reason: ${item.reason}`
    );
  }
}

printCategory(
  "1. SAFE / EXTRACTION ARTIFACTS",
  "🧹",
  categories.artifact
);

printCategory(
  "2. SOURCE LIMITATIONS",
  "📄",
  categories.source_limitation
);

printCategory(
  "3. VALIDATOR LOGIC CANDIDATES",
  "⚙️",
  categories.validator_logic
);

printCategory(
  "4. REAL / MANUAL SOURCE REVIEW",
  "🔎",
  categories.review
);

// ============================================================
// IMPORTANT KNOWN ARTIFACTS
// ============================================================

section(
  "KNOWN EXTRACTION ARTIFACTS"
);

for (
  const artifact
  of KNOWN_ARTIFACTS
) {
  console.log(
    `  ${artifact}`
  );
}

// ============================================================
// IMPORTANT REVIEW SUBJECTS
// ============================================================

section(
  "HIGH-PRIORITY SUBJECTS"
);

const highPriorityCodes = [
  "BESCK104A",
  "BETCK105A",
  "BKSKK107",
  "BESCK104B",
  "BESCK104D",
  "BETCK105E",
  "BETCK105J",
];

for (
  const code
  of highPriorityCodes
) {
  console.log(
    `  🔎 ${code}`
  );
}

// ============================================================
// NEXT STEP
// ============================================================

section(
  "NEXT STEP"
);

console.log(
  "DO NOT edit curriculum JSON files yet."
);

console.log(
  "Validator heuristic false positives have been removed."
);

console.log(
  "Safe extraction artifacts can be separated from genuine source issues."
);

console.log(
  "Review official VTU source material before making curriculum repairs."
);

console.log("");

console.log(
  "✅ Classification v3 complete."
);

console.log(
  "✅ READ-ONLY — no files were modified."
);