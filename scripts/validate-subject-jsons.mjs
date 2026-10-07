/**
 * Vertex Subject JSON Validator
 *
 * VTU 2022 CSE - Semester 1
 *
 * Validates:
 *   1. Environment / directory structure
 *   2. Semester-1 scheme
 *   3. Subject JSON inventory
 *   4. Subject JSON schema
 *   5. JSON <-> scheme consistency
 *   6. JSON <-> source TXT consistency
 *   7. Module structure
 *   8. Course outcomes
 *   9. Practicals
 *  10. Cross-semester contamination
 *  11. Duplicate / suspicious content
 *  12. Warning classification
 *
 * IMPORTANT:
 *   - Read-only validator.
 *   - Never modifies JSON/TXT/PDF files.
 *   - Never writes to Supabase.
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
// CONSTANTS
// ============================================================

const EXPECTED_SEMESTER = 1;
const EXPECTED_REGULATION = "2022";
const EXPECTED_BRANCH = "CSE";
const EXPECTED_COURSE_COUNT = 31;

const STANDARD_PEDAGOGY_HOURS = 40;
const ONE_CREDIT_PEDAGOGY_HOURS = 15;

// Corresponding Semester-2 course codes that may legitimately
// appear inside Semester-1 source extraction because VTU
// documents can contain both semester variants.
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

// Some VTU PDF extraction variants.
const SOURCE_CODE_PREFIX_ALIASES = {
  BETCK: "BETC",
};

// Known extraction artifacts observed in VTU source TXT.
const KNOWN_CODE_ARTIFACTS = [
  "BETCK105J-205J",
  "BENGK106-206",
  "BPWSK206-106",
  "BKBKK107-207",
  "BSFHK108-208",
  "BSFHK158/258",
  "BKBKK107207",
  "BENGK106206",
  "BPWSK206106",
  "BSFHK158258",
];

// ============================================================
// STATE
// ============================================================

let passed = 0;
let warnings = 0;
let errors = 0;
let infos = 0;

const warningCounts = {
  "SOURCE-LIMITATION": 0,
  METADATA: 0,
  "SOURCE-DUPLICATE": 0,
  "CONTENT-REVIEW": 0,
  OTHER: 0,
};

const expectedCourses = new Map();
const loadedPackages = new Map();

// ============================================================
// OUTPUT HELPERS
// ============================================================

function section(title) {
  console.log("");
  console.log("----------------------------------------");
  console.log(` ${title}`);
  console.log("----------------------------------------");
}

function pass() {
  passed++;
}

function info(message) {
  infos++;
  console.log(`ℹ️  ${message}`);
}

function warn(message, category = "OTHER") {
  warnings++;

  if (
    Object.prototype.hasOwnProperty.call(
      warningCounts,
      category
    )
  ) {
    warningCounts[category]++;
  } else {
    warningCounts.OTHER++;
  }

  console.log(
    `⚠️  [${category}] ${message}`
  );
}

function error(message) {
  errors++;
  console.log(`❌ ${message}`);
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
  try {
    return JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );
  } catch (err) {
    throw new Error(
      `Could not parse JSON: ${path.basename(
        filePath
      )} — ${err.message}`
    );
  }
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
// TEXT NORMALIZATION
// ============================================================

function normalizeLoose(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[\u0000-\u001F]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

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

function isMeaningfulString(value) {
  return (
    typeof value === "string" &&
    value.trim().length >= 2
  );
}

// ============================================================
// SCHEME EXTRACTION
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
// SOURCE HELPERS
// ============================================================

function getSourceFile(code) {
  return path.join(
    SUBJECT_DIR,
    `${code}.txt`
  );
}

function getExpectedAlternateCode(code) {
  return (
    ALTERNATE_CODE_MAP[code] ??
    null
  );
}

function sourceContainsCode(
  sourceText,
  code
) {
  const normalizedSource =
    normalizeCode(sourceText);

  const normalizedCodeValue =
    normalizeCode(code);

  return normalizedSource.includes(
    normalizedCodeValue
  );
}

function sourceContainsExpectedIdentity(
  sourceText,
  code,
  subjectName
) {
  if (
    sourceContainsCode(
      sourceText,
      code
    )
  ) {
    return true;
  }

  const alternateCode =
    getExpectedAlternateCode(code);

  if (
    alternateCode &&
    sourceContainsCode(
      sourceText,
      alternateCode
    )
  ) {
    return true;
  }

  // Handle BETCK/BETC extraction variation.
  const prefixAlias =
    SOURCE_CODE_PREFIX_ALIASES[
      code.slice(0, 5)
    ];

  if (prefixAlias) {
    const aliasCode =
      `${prefixAlias}${code.slice(5)}`;

    if (
      sourceContainsCode(
        sourceText,
        aliasCode
      )
    ) {
      return true;
    }
  }

  const normalizedSubject =
    normalizeLoose(subjectName);

  if (
    normalizedSubject.length >= 8 &&
    normalizeLoose(sourceText).includes(
      normalizedSubject
    )
  ) {
    return true;
  }

  return false;
}

function sourceContainsKnownArtifact(
  sourceText
) {
  const normalizedSource =
    normalizeCode(sourceText);

  return KNOWN_CODE_ARTIFACTS.some(
    (artifact) =>
      normalizedSource.includes(
        normalizeCode(artifact)
      )
  );
}

// ============================================================
// COURSE TITLE VALIDATION
// ============================================================

function isDateLike(value) {
  const text = String(value ?? "").trim();

  return (
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(
      text
    ) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(
      text
    )
  );
}

function isReliableSubjectName(value) {
  if (
    !isMeaningfulString(value)
  ) {
    return false;
  }

  if (isDateLike(value)) {
    return false;
  }

  const normalized =
    normalizeLoose(value);

  if (normalized.length < 4) {
    return false;
  }

  return true;
}

// ============================================================
// MODULE VALIDATION
// ============================================================

function validateModules(
  code,
  subject,
  sourceText
) {
  const modules =
    subject.modules;

  if (!Array.isArray(modules)) {
    error(
      `${code}: modules must be an array`
    );
    return;
  }

  if (modules.length === 0) {
    error(
      `${code}: no modules found`
    );
    return;
  }

  const seenModuleNumbers =
    new Set();

  modules.forEach(
    (module, index) => {
      const expectedNumber =
        index + 1;

      const actualNumber =
        Number(
          module?.module_number
        );

      if (
        actualNumber !==
        expectedNumber
      ) {
        error(
          `${code} module ${expectedNumber}: expected module_number ${expectedNumber}, found ${module?.module_number}`
        );
      } else {
        pass();
      }

      if (
        seenModuleNumbers.has(
          actualNumber
        )
      ) {
        error(
          `${code}: duplicate module_number ${actualNumber}`
        );
      }

      seenModuleNumbers.add(
        actualNumber
      );

      const title =
        cleanText(
          module?.title
        );

      if (
        !isMeaningfulString(title)
      ) {
        error(
          `${code} module ${expectedNumber}: missing title`
        );
      } else {
        pass();
      }

      // --------------------------------------------------------
      // Module hours
      //
      // IMPORTANT:
      // null/undefined is allowed when the source package
      // does not explicitly provide reliable module-level hours.
      // We do NOT invent hours.
      // --------------------------------------------------------

      const rawHours =
        module?.hours;

      if (
        rawHours === null ||
        rawHours === undefined ||
        rawHours === ""
      ) {
        warn(
          `${code} module ${expectedNumber}: module hours are not explicitly available in JSON; no hours were invented`,
          "SOURCE-LIMITATION"
        );
      } else {
        const hours =
          Number(rawHours);

        if (
          !Number.isFinite(hours) ||
          hours <= 0
        ) {
          error(
            `${code} module ${expectedNumber}: invalid module hours: ${rawHours}`
          );
        } else {
          pass();

          if (hours > 20) {
            warn(
              `${code} module ${expectedNumber}: unusually high module hours: ${hours}`,
              "CONTENT-REVIEW"
            );
          }
        }
      }

      // --------------------------------------------------------
      // Topics
      // --------------------------------------------------------

      const topics =
        module?.topics;

      if (!Array.isArray(topics)) {
        error(
          `${code} module ${expectedNumber}: topics must be an array`
        );
        return;
      }

      if (topics.length === 0) {
        error(
          `${code} module ${expectedNumber}: no topics`
        );
      } else {
        pass();
      }

      const topicKeys =
        new Map();

      topics.forEach(
        (topic, topicIndex) => {
          let title = "";

          // Normal schema:
          // { "title": "..." }
          if (
            topic &&
            typeof topic === "object" &&
            !Array.isArray(topic)
          ) {
            title = cleanText(
              topic.title
            );
          }

          // We deliberately do NOT silently accept
          // string topics. They must be repaired into
          // the standard topic object schema.
          if (
            !isMeaningfulString(title)
          ) {
            error(
              `${code} module ${expectedNumber} topic ${topicIndex + 1}: missing title`
            );
            return;
          }

          pass();

          const key =
            normalizeLoose(title);

          if (!key) {
            return;
          }

          if (
            topicKeys.has(key)
          ) {
            const firstIndex =
              topicKeys.get(key);

            warn(
              `${code} module ${expectedNumber}: duplicate topic title "${title}" (first occurrence ${firstIndex + 1})`,
              "SOURCE-DUPLICATE"
            );
          } else {
            topicKeys.set(
              key,
              topicIndex
            );
          }

          // Detect obvious source-extraction contamination.
          if (
            normalizeCode(title).includes(
              normalizeCode(code)
            )
          ) {
            warn(
              `${code} module ${expectedNumber}: topic "${title}" appears to contain the course code; inspect extraction`,
              "SOURCE-LIMITATION"
            );
          }

          // Detect corresponding Semester-2 code.
          const alternateCode =
            getExpectedAlternateCode(
              code
            );

          if (
            alternateCode &&
            normalizeCode(title).includes(
              normalizeCode(
                alternateCode
              )
            )
          ) {
            warn(
              `${code} module ${expectedNumber}: topic "${title}" appears to contain corresponding Semester-2 code ${alternateCode}`,
              "SOURCE-LIMITATION"
            );
          }
        }
      );

      // --------------------------------------------------------
      // Optional self_learning
      // --------------------------------------------------------

      const selfLearning =
        module?.self_learning;

      if (
        selfLearning !== undefined &&
        !Array.isArray(
          selfLearning
        )
      ) {
        error(
          `${code} module ${expectedNumber}: self_learning must be an array when present`
        );
      }

      // --------------------------------------------------------
      // Optional applications
      // --------------------------------------------------------

      const applications =
        module?.applications;

      if (
        applications !== undefined &&
        !Array.isArray(
          applications
        )
      ) {
        error(
          `${code} module ${expectedNumber}: applications must be an array when present`
        );
      }
    }
  );

  // ----------------------------------------------------------
  // Numeric module-hour total
  // ----------------------------------------------------------

  const numericHours =
    modules
      .map((module) =>
        Number(module?.hours)
      )
      .filter(
        (hours) =>
          Number.isFinite(hours) &&
          hours > 0
      );

  const totalHours =
    numericHours.reduce(
      (sum, hours) =>
        sum + hours,
      0
    );

  const allModulesHaveNumericHours =
    numericHours.length ===
    modules.length;

  if (
    allModulesHaveNumericHours &&
    totalHours > 0
  ) {
    const expected =
      Number(
        subject.pedagogy_hours
      );

    if (
      Number.isFinite(expected) &&
      totalHours < expected
    ) {
      warn(
        `${code}: module hours total ${totalHours} is below pedagogy hours ${expected}`,
        "CONTENT-REVIEW"
      );
    }

    if (
      totalHours > 60
    ) {
      warn(
        `${code}: module hours total ${totalHours} is unusually high`,
        "CONTENT-REVIEW"
      );
    }
  }

  // ----------------------------------------------------------
  // Source-level module identity checks
  // ----------------------------------------------------------

  const normalizedSource =
    normalizeLoose(sourceText);

  modules.forEach(
    (module) => {
      const title =
        normalizeLoose(
          module?.title
        );

      if (
        title.length >= 5 &&
        !normalizedSource.includes(
          title
        )
      ) {
        warn(
          `${code}: module title "${module?.title}" was not directly located in source TXT; inspect if needed`,
          "SOURCE-LIMITATION"
        );
      }
    }
  );
}

// ============================================================
// COURSE OUTCOME VALIDATION
// ============================================================

function validateCourseOutcomes(
  code,
  subject,
  sourceText
) {
  const outcomes =
    subject.course_outcomes;

  if (!Array.isArray(outcomes)) {
    error(
      `${code}: course_outcomes must be an array`
    );
    return;
  }

  if (outcomes.length === 0) {
    error(
      `${code}: no course outcomes found`
    );
    return;
  }

  if (outcomes.length > 6) {
    error(
      `${code}: suspicious course outcome count: ${outcomes.length}`
    );
  }

  const normalizedSource =
    normalizeLoose(sourceText);

  outcomes.forEach(
    (outcome, index) => {
      if (
        !isMeaningfulString(
          outcome
        )
      ) {
        error(
          `${code}: course outcome ${index + 1} must be a non-empty string`
        );
        return;
      }

      pass();

      if (
        /^CO\s*\d+/i.test(
          outcome.trim()
        )
      ) {
        warn(
          `${code}: course outcome ${index + 1} contains an explicit CO number; JSON normally stores outcome text only`,
          "CONTENT-REVIEW"
        );
      }

      const tokens =
        outcome
          .toUpperCase()
          .match(
            /[\p{L}\p{N}]+/gu
          )
          ?.filter(
            (token) =>
              token.length >= 4
          ) ?? [];

      if (tokens.length >= 4) {
        const matched =
          tokens.filter(
            (token) =>
              normalizedSource.includes(
                normalizeLoose(token)
              )
          );

        const ratio =
          matched.length /
          tokens.length;

        if (ratio < 0.55) {
          warn(
            `${code}: course outcome ${index + 1} has weak source-text similarity (${Math.round(
              ratio * 100
            )}%)`,
            "SOURCE-LIMITATION"
          );
        }
      }
    }
  );
}

// ============================================================
// PRACTICAL VALIDATION
// ============================================================

function validatePracticals(
  code,
  subject
) {
  if (
    subject.practicals ===
    undefined
  ) {
    return;
  }

  const practicals =
    subject.practicals;

  // ----------------------------------------------------------
  // Format 1: simple array
  // ----------------------------------------------------------

  if (
    Array.isArray(practicals)
  ) {
    if (
      practicals.length === 0
    ) {
      warn(
        `${code}: practicals field exists but contains zero entries`,
        "CONTENT-REVIEW"
      );
      return;
    }

    practicals.forEach(
      (practical, index) => {
        if (
          !isMeaningfulString(
            practical
          )
        ) {
          error(
            `${code}: practical ${index + 1} is empty or invalid`
          );
        } else {
          pass();
        }
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // Format 2: categorized practical object
  //
  // Example:
  //
  // "practicals": {
  //   "demonstration": [...],
  //   "exercise": [...],
  //   "structured_enquiry": [...],
  //   "open_ended": [...]
  // }
  // ----------------------------------------------------------

  if (
    practicals &&
    typeof practicals ===
      "object" &&
    !Array.isArray(practicals)
  ) {
    const categories =
      Object.entries(
        practicals
      );

    if (
      categories.length === 0
    ) {
      warn(
        `${code}: practicals object exists but contains no categories`,
        "CONTENT-REVIEW"
      );
      return;
    }

    for (
      const [
        category,
        entries,
      ] of categories
    ) {
      if (
        !Array.isArray(entries)
      ) {
        error(
          `${code}: practicals.${category} must be an array`
        );
        continue;
      }

      if (
        entries.length === 0
      ) {
        warn(
          `${code}: practicals.${category} contains zero entries`,
          "CONTENT-REVIEW"
        );
        continue;
      }

      entries.forEach(
        (practical, index) => {
          if (
            !isMeaningfulString(
              practical
            )
          ) {
            error(
              `${code}: practicals.${category}[${index}] is empty or invalid`
            );
          } else {
            pass();
          }
        }
      );
    }

    return;
  }

  // ----------------------------------------------------------
  // Invalid format
  // ----------------------------------------------------------

  error(
    `${code}: practicals must be an array or categorized object`
  );
}

// ============================================================
// SOURCE CROSS-SEMESTER CHECK
// ============================================================

function validateCrossSemesterSource(
  code,
  sourceText
) {
  const alternateCode =
    getExpectedAlternateCode(
      code
    );

  if (!alternateCode) {
    return;
  }

  if (
    sourceContainsCode(
      sourceText,
      alternateCode
    )
  ) {
    warn(
      `${code}: source TXT also contains corresponding Semester-2 code ${alternateCode}; verify package uses Semester-1 content`,
      "SOURCE-LIMITATION"
    );
  }
}

// ============================================================
// JSON CROSS-SEMESTER CHECK
// ============================================================

function scanJsonForCode(
  value,
  targetCode
) {
  const target =
    normalizeCode(targetCode);

  if (!target) {
    return false;
  }

  function walk(node) {
    if (
      typeof node ===
      "string"
    ) {
      return normalizeCode(
        node
      ).includes(target);
    }

    if (
      Array.isArray(node)
    ) {
      return node.some(walk);
    }

    if (
      node &&
      typeof node === "object"
    ) {
      return Object.values(
        node
      ).some(walk);
    }

    return false;
  }

  return walk(value);
}

function validateJsonCrossSemester(
  code,
  subject
) {
  const alternateCode =
    getExpectedAlternateCode(
      code
    );

  if (!alternateCode) {
    return;
  }

  // IMPORTANT:
  // Do NOT scan source metadata.
  //
  // VTU source metadata can legitimately contain:
  //
  //   extracted_course_code: BPWSK206
  //
  // even when the actual package is BPWSK106.
  //
  // We only inspect curriculum content.

  const curriculumContent = {
    subject_code:
      subject.subject_code,

    subject_name:
      subject.subject_name,

    course_type:
      subject.course_type,

    pedagogy_hours:
      subject.pedagogy_hours,

    modules:
      subject.modules,

    course_outcomes:
      subject.course_outcomes,

    practicals:
      subject.practicals,
  };

  if (
    scanJsonForCode(
      curriculumContent,
      alternateCode
    )
  ) {
    warn(
      `${code}: curriculum JSON contains corresponding Semester-2 code ${alternateCode}; inspect for cross-semester contamination`,
      "CONTENT-REVIEW"
    );
  }
}

// ============================================================
// TOP-LEVEL JSON VALIDATION
// ============================================================

function validateSubjectPackage(
  code,
  subject,
  schemeCourse,
  sourceText
) {
  section(
    `Validating ${code}`
  );

  // ----------------------------------------------------------
  // Root JSON object
  // ----------------------------------------------------------

  if (
    !subject ||
    typeof subject !==
      "object" ||
    Array.isArray(subject)
  ) {
    error(
      `${code}: root JSON value must be an object`
    );
    return;
  }

  // ----------------------------------------------------------
  // subject_code
  // ----------------------------------------------------------

  if (
    normalizeCode(
      subject.subject_code
    ) !== code
  ) {
    error(
      `${code}: subject_code mismatch; expected ${code}, found ${subject.subject_code}`
    );
  } else {
    pass();
  }

  // ----------------------------------------------------------
  // subject_name
  // ----------------------------------------------------------

  if (
    !isReliableSubjectName(
      subject.subject_name
    )
  ) {
    error(
      `${code}: subject_name is missing or unreliable`
    );
  } else {
    pass();
  }

  // ----------------------------------------------------------
  // Scheme name consistency
  // ----------------------------------------------------------

  const expectedName =
    getCourseName(
      schemeCourse
    );

  if (
    expectedName &&
    isReliableSubjectName(
      subject.subject_name
    )
  ) {
    const expectedNormalized =
      normalizeLoose(
        expectedName
      );

    const actualNormalized =
      normalizeLoose(
        subject.subject_name
      );

    const expectedTokens =
      expectedNormalized.length >=
      8
        ? expectedNormalized.match(
            /[\p{L}\p{N}]{4,}/gu
          ) ?? []
        : [];

    if (
      expectedTokens.length >= 2
    ) {
      const matches =
        expectedTokens.filter(
          (token) =>
            actualNormalized.includes(
              token
            )
        );

      const ratio =
        matches.length /
        expectedTokens.length;

      if (
        ratio < 0.35
      ) {
        warn(
          `${code}: weak title similarity with scheme: JSON="${subject.subject_name}", scheme="${expectedName}".`,
          "CONTENT-REVIEW"
        );
      }
    }
  }

  // ----------------------------------------------------------
  // Credits
  // ----------------------------------------------------------

  const expectedCredits =
    getCourseCredits(
      schemeCourse
    );

  const actualCredits =
    Number(subject.credits);

  if (
    !Number.isFinite(
      actualCredits
    ) ||
    actualCredits <= 0
  ) {
    error(
      `${code}: invalid credits: ${subject.credits}`
    );
  } else {
    pass();
  }

  if (
    expectedCredits !==
      null &&
    actualCredits !==
      expectedCredits
  ) {
    error(
      `${code}: credit mismatch; scheme=${expectedCredits}, JSON=${actualCredits}`
    );
  }

  // ----------------------------------------------------------
  // Course type
  // ----------------------------------------------------------

  if (
    !isMeaningfulString(
      subject.course_type
    )
  ) {
    error(
      `${code}: course_type is missing`
    );
  } else {
    pass();
  }

  // ----------------------------------------------------------
  // Pedagogy hours
  // ----------------------------------------------------------

  const pedagogyHours =
    Number(
      subject.pedagogy_hours
    );

  if (
    !Number.isFinite(
      pedagogyHours
    ) ||
    pedagogyHours <= 0
  ) {
    error(
      `${code}: invalid pedagogy_hours: ${subject.pedagogy_hours}`
    );
  } else {
    pass();
  }

  const expectedPedagogyHours =
    actualCredits === 1
      ? ONE_CREDIT_PEDAGOGY_HOURS
      : STANDARD_PEDAGOGY_HOURS;

  if (
    Number.isFinite(
      pedagogyHours
    ) &&
    pedagogyHours !==
      expectedPedagogyHours
  ) {
    warn(
      `${code}: pedagogy_hours is ${pedagogyHours}; expected ${expectedPedagogyHours} based on course credits`,
      "METADATA"
    );
  }

  // ----------------------------------------------------------
  // Source metadata
  // ----------------------------------------------------------

  if (
    !subject.source ||
    typeof subject.source !==
      "object"
  ) {
    error(
      `${code}: source object is missing`
    );
  } else {
    if (
      !isMeaningfulString(
        subject.source
          .source_name
      )
    ) {
      error(
        `${code}: source.source_name is missing`
      );
    } else {
      pass();
    }

    if (
      !isMeaningfulString(
        subject.source
          .source_document
      )
    ) {
      error(
        `${code}: source.source_document is missing`
      );
    } else {
      pass();
    }

    if (
      subject.source
        .source_date !==
        undefined &&
      !isMeaningfulString(
        subject.source
          .source_date
      )
    ) {
      warn(
        `${code}: source.source_date is empty`,
        "METADATA"
      );
    }

    if (
      subject.source
        .source_date ===
        undefined
    ) {
      warn(
        `${code}: source.source_date is missing`,
        "METADATA"
      );
    }

    // --------------------------------------------------------
    // Source document lookup
    // --------------------------------------------------------

    const sourceDocument =
      cleanText(
        subject.source
          .source_document
      );

    if (
      sourceDocument &&
      !fileExists(
        path.join(
          CURRICULUM_DIR,
          sourceDocument
        )
      ) &&
      !fileExists(
        path.join(
          PROJECT_ROOT,
          sourceDocument
        )
      )
    ) {
      warn(
        `${code}: source document not found locally: ${sourceDocument}`,
        "SOURCE-LIMITATION"
      );
    }
  }

  // ----------------------------------------------------------
  // Source identity
  // ----------------------------------------------------------

  if (
    !sourceContainsExpectedIdentity(
      sourceText,
      code,
      subject.subject_name
    )
  ) {
    warn(
      `${code}: source course identity could not be directly confirmed from source TXT; inspect if needed`,
      "SOURCE-LIMITATION"
    );
  }

  // ----------------------------------------------------------
  // Known source extraction artifacts
  // ----------------------------------------------------------

  if (
    sourceContainsKnownArtifact(
      sourceText
    )
  ) {
    warn(
      `${code}: source TXT contains one or more known VTU course-code extraction artifacts`,
      "SOURCE-LIMITATION"
    );
  }

  // ----------------------------------------------------------
  // Cross-semester source check
  // ----------------------------------------------------------

  validateCrossSemesterSource(
    code,
    sourceText
  );

  // ----------------------------------------------------------
  // Cross-semester JSON check
  // ----------------------------------------------------------

  validateJsonCrossSemester(
    code,
    subject
  );

  // ----------------------------------------------------------
  // Modules
  // ----------------------------------------------------------

  validateModules(
    code,
    subject,
    sourceText
  );

  // ----------------------------------------------------------
  // Course outcomes
  // ----------------------------------------------------------

  validateCourseOutcomes(
    code,
    subject,
    sourceText
  );

  // ----------------------------------------------------------
  // Practicals
  // ----------------------------------------------------------

  validatePracticals(
    code,
    subject
  );
}

// ============================================================
// INVENTORY VALIDATION
// ============================================================

function validateInventory() {
  section(
    "Checking JSON package inventory"
  );

  const jsonFiles =
    listJsonFiles(
      SUBJECT_DIR
    );

  const packageFiles =
    jsonFiles.filter(
      (filename) =>
        filename.toUpperCase() !==
        "SCHEME-SEM-1-2.JSON"
    );

  console.log(
    `Expected course packages : ${expectedCourses.size}`
  );

  console.log(
    `JSON packages found      : ${packageFiles.length}`
  );

  const foundCodes =
    new Set();

  for (
    const filename of packageFiles
  ) {
    const basename =
      path.basename(
        filename,
        ".json"
      );

    const code =
      normalizeCode(
        basename
      );

    if (!code) {
      warn(
        `Unable to derive course code from filename ${filename}`,
        "OTHER"
      );
      continue;
    }

    foundCodes.add(code);

    if (
      !expectedCourses.has(
        code
      )
    ) {
      warn(
        `JSON package ${filename} exists but is not in the current expected Semester-1 course list`,
        "CONTENT-REVIEW"
      );
      continue;
    }

    const filePath =
      path.join(
        SUBJECT_DIR,
        filename
      );

    try {
      const json =
        readJson(filePath);

      loadedPackages.set(
        code,
        {
          filename,
          filePath,
          json,
        }
      );

      info(
        `Loaded JSON package ${filename}`
      );
    } catch (err) {
      error(
        `${filename}: ${err.message}`
      );
    }
  }

  const missing = [];

  for (
    const code of expectedCourses.keys()
  ) {
    if (
      !foundCodes.has(code)
    ) {
      missing.push(code);
    }
  }

  if (
    missing.length > 0
  ) {
    section(
      "Missing JSON packages"
    );

    for (
      const code of missing
    ) {
      console.log(
        `   ❌ ${code}`
      );
    }

    error(
      `Missing JSON packages: ${missing.join(
        ", "
      )}`
    );
  }

  return {
    jsonFiles,
    packageFiles,
    missing,
  };
}

// ============================================================
// FILE NAME / PACKAGE CONSISTENCY
// ============================================================

function validatePackageFilenames() {
  for (
    const [
      code,
      packageInfo,
    ] of loadedPackages.entries()
  ) {
    const filenameCode =
      normalizeCode(
        path.basename(
          packageInfo.filename,
          ".json"
        )
      );

    if (
      filenameCode !== code
    ) {
      error(
        `${packageInfo.filename}: filename/code mismatch`
      );
    } else {
      pass();
    }
  }
}

// ============================================================
// SCHEME VALIDATION
// ============================================================

function validateScheme(scheme) {
  section(
    "Checking scheme"
  );

  if (
    !scheme ||
    typeof scheme !==
      "object"
  ) {
    error(
      "semester-1.json is not a valid JSON object"
    );
    return;
  }

  const regulation =
    String(
      scheme.scheme
        ?.regulation ??
        scheme.regulation ??
        ""
    );

  if (
    regulation !==
    EXPECTED_REGULATION
  ) {
    error(
      `Expected regulation ${EXPECTED_REGULATION}, found ${
        regulation ||
        "undefined"
      }`
    );
  } else {
    pass();
  }

  const semester =
    Number(
      scheme.semester ??
        scheme.semester_number
    );

  if (
    semester !==
    EXPECTED_SEMESTER
  ) {
    error(
      `Expected semester ${EXPECTED_SEMESTER}, found ${semester}`
    );
  } else {
    pass();
  }

  const branchCode =
    normalizeCode(
      scheme.branch?.code ??
        scheme.branch_code ??
        ""
    );

  if (
    branchCode !==
    EXPECTED_BRANCH
  ) {
    error(
      `Expected branch ${EXPECTED_BRANCH}, found ${
        branchCode ||
        "undefined"
      }`
    );
  } else {
    pass();
  }

  const courses =
    getSchemeCourses(
      scheme
    );

  if (
    courses.length !==
    EXPECTED_COURSE_COUNT
  ) {
    error(
      `Expected ${EXPECTED_COURSE_COUNT} Semester-1 CSE courses, found ${courses.length}`
    );
  } else {
    pass();
  }

  for (
    const course of courses
  ) {
    const code =
      getCourseCode(
        course
      );

    if (!code) {
      error(
        "Scheme contains a course without a valid code"
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

    pass();
  }
}

// ============================================================
// JSON PACKAGE CONSISTENCY
// ============================================================

function validatePackageConsistency() {
  section(
    "Checking JSON package consistency"
  );

  for (
    const [
      code,
      packageInfo,
    ] of loadedPackages.entries()
  ) {
    const subject =
      packageInfo.json;

    if (
      normalizeCode(
        subject.subject_code
      ) !== code
    ) {
      error(
        `${packageInfo.filename}: filename/code mismatch`
      );
    }

    const schemeCourse =
      expectedCourses.get(
        code
      );

    if (!schemeCourse) {
      continue;
    }

    const expectedCredits =
      getCourseCredits(
        schemeCourse
      );

    if (
      expectedCredits !==
        null &&
      Number(
        subject.credits
      ) !== expectedCredits
    ) {
      error(
        `${code}: credits mismatch with scheme`
      );
    }
  }
}

// ============================================================
// MAIN
// ============================================================

function main() {
  console.log(
    "========================================"
  );
  console.log(
    " Vertex Subject JSON Validator"
  );
  console.log(
    " VTU 2022 CSE - Semester 1"
  );
  console.log(
    "========================================"
  );

  // ----------------------------------------------------------
  // Validate directories
  // ----------------------------------------------------------

  if (
    !fileExists(
      CURRICULUM_DIR
    )
  ) {
    console.error(
      `\n❌ Curriculum directory not found:\n${CURRICULUM_DIR}`
    );

    process.exitCode = 1;
    return;
  }

  if (
    !fileExists(
      SCHEME_FILE
    )
  ) {
    console.error(
      `\n❌ Scheme file not found:\n${SCHEME_FILE}`
    );

    process.exitCode = 1;
    return;
  }

  if (
    !fileExists(
      SUBJECT_DIR
    )
  ) {
    console.error(
      `\n❌ Subject directory not found:\n${SUBJECT_DIR}`
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
    console.error(
      `\n❌ ${err.message}`
    );

    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // Scheme
  // ----------------------------------------------------------

  validateScheme(
    scheme
  );

  // ----------------------------------------------------------
  // Inventory
  // ----------------------------------------------------------

  const inventory =
    validateInventory();

  // ----------------------------------------------------------
  // Validate loaded packages
  // ----------------------------------------------------------

  for (
    const [
      code,
      packageInfo,
    ] of loadedPackages.entries()
  ) {
    const schemeCourse =
      expectedCourses.get(
        code
      );

    if (!schemeCourse) {
      continue;
    }

    const sourceFile =
      getSourceFile(
        code
      );

    let sourceText = "";

    if (
      !fileExists(
        sourceFile
      )
    ) {
      error(
        `${code}: source TXT missing: ${path.basename(
          sourceFile
        )}`
      );
      continue;
    }

    try {
      sourceText =
        readText(
          sourceFile
        );
    } catch (err) {
      error(
        `${code}: could not read source TXT: ${err.message}`
      );
      continue;
    }

    validateSubjectPackage(
      code,
      packageInfo.json,
      schemeCourse,
      sourceText
    );
  }

  // ----------------------------------------------------------
  // Package consistency
  // ----------------------------------------------------------

  validatePackageFilenames();

  validatePackageConsistency();

  // ----------------------------------------------------------
  // Warning classification
  // ----------------------------------------------------------

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    " Warning Classification"
  );
  console.log(
    "========================================"
  );
  console.log("");

  console.log(
    `SOURCE-LIMITATION : ${warningCounts["SOURCE-LIMITATION"]}`
  );

  console.log(
    `METADATA          : ${warningCounts.METADATA}`
  );

  console.log(
    `SOURCE-DUPLICATE  : ${warningCounts["SOURCE-DUPLICATE"]}`
  );

  console.log(
    `CONTENT-REVIEW    : ${warningCounts["CONTENT-REVIEW"]}`
  );

  console.log(
    `OTHER             : ${warningCounts.OTHER}`
  );

  const blockingReviewCount =
    warningCounts[
      "CONTENT-REVIEW"
    ];

  console.log("");

  if (
    blockingReviewCount === 0
  ) {
    console.log(
      "✅ Blocking content-review warnings: 0"
    );
  } else {
    console.log(
      `⚠️  Content-review warnings requiring source inspection: ${blockingReviewCount}`
    );
  }

  // ----------------------------------------------------------
  // Validation summary
  // ----------------------------------------------------------

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    " Validation Summary"
  );
  console.log(
    "========================================"
  );
  console.log("");

  console.log(
    `   Expected course packages : ${expectedCourses.size}`
  );

  console.log(
    `   JSON packages found      : ${inventory.packageFiles.length}`
  );

  console.log(
    `   Expected packages loaded : ${loadedPackages.size}`
  );

  console.log(
    `   Missing packages         : ${inventory.missing.length}`
  );

  console.log(
    `   Validation checks passed : ${passed}`
  );

  console.log(
    `   Warnings                 : ${warnings}`
  );

  console.log(
    `   Errors                   : ${errors}`
  );

  console.log(
    `   Info                     : ${infos}`
  );

  // ----------------------------------------------------------
  // Final result
  // ----------------------------------------------------------

  console.log("");
  console.log(
    "========================================"
  );

  if (
    errors === 0 &&
    inventory.missing.length === 0
  ) {
    console.log(
      " 🎉 SUBJECT JSON VALIDATION PASSED"
    );

    console.log(
      "========================================"
    );

    console.log("");

    if (
      warnings === 0
    ) {
      console.log(
        "All curriculum packages passed with no warnings."
      );
    } else {
      console.log(
        `All structural validation checks passed with ${warnings} warning(s).`
      );
    }

    console.log("");

    console.log(
      "No files were modified."
    );

    console.log(
      "No Supabase changes were made."
    );

    process.exitCode = 0;

    return;
  }

  console.log(
    " ❌ SUBJECT JSON VALIDATION FAILED"
  );

  console.log(
    "========================================"
  );

  console.log("");

  console.log(
    "The curriculum packages are NOT ready for Supabase import."
  );

  console.log("");

  console.log(
    "Fix the reported package/source problems and run the validator again."
  );

  console.log("");

  console.log(
    "No files were modified."
  );

  console.log(
    "No Supabase changes were made."
  );

  process.exitCode = 1;
}

main();