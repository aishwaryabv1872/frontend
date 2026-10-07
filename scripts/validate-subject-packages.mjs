import fs from "fs";
import path from "path";

// ============================================================
// Vertex Subject JSON Validator
// VTU 2022 CSE - Semester 1
//
// Purpose:
//   Validate existing subject JSON packages against:
//   1. semester-1.json scheme
//   2. corresponding TXT source
//   3. expected JSON structure
//
// This script DOES NOT modify any files.
// This script DOES NOT modify Supabase.
// ============================================================

const ROOT = process.cwd();

const SUBJECT_DIR = path.join(
  ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE",
  "subjects"
);

const SCHEME_FILE = path.join(
  ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE",
  "semester-1.json"
);

// ============================================================
// Helpers
// ============================================================

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to parse JSON: ${path.basename(filePath)}\n${error.message}`
    );
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalize(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[\u0000-\u001F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[\u0000-\u001F]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function addError(errors, message) {
  errors.push(`❌ ${message}`);
}

function addWarning(warnings, message) {
  warnings.push(`⚠️ ${message}`);
}

function addPass(passes, message) {
  passes.push(`✅ ${message}`);
}

function findSchemeCourse(scheme, code) {
  if (!Array.isArray(scheme.courses)) {
    return null;
  }

  return scheme.courses.find(
    (course) => course.code === code
  );
}

function getCourseCodesFromScheme(scheme) {
  if (!Array.isArray(scheme.courses)) {
    return [];
  }

  return scheme.courses
    .map((course) => course.code)
    .filter(Boolean);
}

// ============================================================
// Configuration
// ============================================================

const EXPECTED_EXISTING_JSONS = [
  "BMATS101",
  "BPHYS102",
  "BCHES102",
  "BPOPS103",
];

// Some VTU source documents use the corresponding
// Semester-2 code in the shared syllabus document.
//
// Example:
// BCEDK103 source may contain BCEDK203.
//
// This is only used for source identity validation.
const ALTERNATE_SOURCE_CODES = {
  BMATS101: ["BMATS201"],
  BPHYS102: ["BPHYS202"],
  BCHES102: ["BCHES202"],
  BPOPS103: ["BPOPS203"],
};

// ============================================================
// Start
// ============================================================

console.log("========================================");
console.log(" Vertex Subject JSON Validator");
console.log(" VTU 2022 CSE - Semester 1");
console.log("========================================");
console.log();

// ============================================================
// Validate paths
// ============================================================

const errors = [];
const warnings = [];
const passes = [];

if (!exists(SCHEME_FILE)) {
  addError(
    errors,
    `Semester 1 scheme not found: ${SCHEME_FILE}`
  );
} else {
  addPass(passes, "Semester 1 scheme file found");
}

if (!exists(SUBJECT_DIR)) {
  addError(
    errors,
    `Subject directory not found: ${SUBJECT_DIR}`
  );
} else {
  addPass(passes, "Subject directory found");
}

if (errors.length > 0) {
  console.log();
  console.log("----------------------------------------");
  console.log(" Path validation");
  console.log("----------------------------------------");
  console.log();

  for (const error of errors) {
    console.log(error);
  }

  console.log();
  console.log("❌ VALIDATION FAILED");
  process.exit(1);
}

// ============================================================
// Load scheme
// ============================================================

let scheme;

try {
  scheme = readJson(SCHEME_FILE);
  addPass(passes, "Semester 1 scheme loaded");
} catch (error) {
  addError(errors, error.message);
}

if (!scheme) {
  console.log();
  console.log("❌ VALIDATION FAILED");
  process.exit(1);
}

// ============================================================
// Validate scheme basics
// ============================================================

console.log("----------------------------------------");
console.log(" Checking scheme");
console.log("----------------------------------------");
console.log();

if (scheme.scheme?.regulation !== "2022") {
  addError(
    errors,
    `Expected regulation 2022, found ${scheme.scheme?.regulation}`
  );
} else {
  addPass(passes, "Regulation 2022");
}

if (scheme.branch?.code !== "CSE") {
  addError(
    errors,
    `Expected branch CSE, found ${scheme.branch?.code}`
  );
} else {
  addPass(passes, "Branch CSE");
}

if (scheme.semester !== 1) {
  addError(
    errors,
    `Expected semester 1, found ${scheme.semester}`
  );
} else {
  addPass(passes, "Semester 1");
}

const schemeCodes = getCourseCodesFromScheme(scheme);

if (schemeCodes.length !== 31) {
  addError(
    errors,
    `Expected 31 scheme courses, found ${schemeCodes.length}`
  );
} else {
  addPass(passes, "Scheme contains 31 courses");
}

// ============================================================
// Locate JSON packages
// ============================================================

console.log();
console.log("----------------------------------------");
console.log(" Checking expected JSON packages");
console.log("----------------------------------------");
console.log();

const subjectPackages = [];

for (const code of EXPECTED_EXISTING_JSONS) {
  const jsonPath = path.join(
    SUBJECT_DIR,
    `${code}.json`
  );

  const txtPath = path.join(
    SUBJECT_DIR,
    `${code}.txt`
  );

  if (!exists(jsonPath)) {
    addError(
      errors,
      `${code}: JSON package not found`
    );
    continue;
  }

  if (!exists(txtPath)) {
    addError(
      errors,
      `${code}: TXT source not found`
    );
    continue;
  }

  subjectPackages.push({
    code,
    jsonPath,
    txtPath,
  });

  addPass(
    passes,
    `${code}: JSON and TXT source found`
  );
}

// ============================================================
// Validate each subject
// ============================================================

for (const packageInfo of subjectPackages) {
  const {
    code,
    jsonPath,
    txtPath,
  } = packageInfo;

  console.log();
  console.log("----------------------------------------");
  console.log(` Validating ${code}`);
  console.log("----------------------------------------");
  console.log();

  let subject;

  try {
    subject = readJson(jsonPath);
    addPass(
      passes,
      `${code}: JSON syntax valid`
    );
  } catch (error) {
    addError(errors, error.message);
    continue;
  }

  const txt = readText(txtPath);

  // ----------------------------------------------------------
  // 1. JSON subject code
  // ----------------------------------------------------------

  if (subject.subject_code !== code) {
    addError(
      errors,
      `${code}: subject_code is "${subject.subject_code}", expected "${code}"`
    );
  } else {
    addPass(
      passes,
      `${code}: subject_code matches filename`
    );
  }

  // ----------------------------------------------------------
  // 2. Scheme course existence
  // ----------------------------------------------------------

  const schemeCourse = findSchemeCourse(
    scheme,
    code
  );

  if (!schemeCourse) {
    addError(
      errors,
      `${code}: course does not exist in semester-1.json`
    );
  } else {
    addPass(
      passes,
      `${code}: course exists in Semester 1 scheme`
    );
  }

  // ----------------------------------------------------------
  // 3. Required top-level fields
  // ----------------------------------------------------------

  const requiredFields = [
    "subject_code",
    "subject_name",
    "credits",
    "course_type",
    "pedagogy_hours",
    "source",
    "modules",
    "course_outcomes",
  ];

  for (const field of requiredFields) {
    if (
      subject[field] === undefined ||
      subject[field] === null
    ) {
      addError(
        errors,
        `${code}: missing required field "${field}"`
      );
    }
  }

  // ----------------------------------------------------------
  // 4. Subject name
  // ----------------------------------------------------------

  if (
    typeof subject.subject_name !== "string" ||
    !subject.subject_name.trim()
  ) {
    addError(
      errors,
      `${code}: subject_name is empty`
    );
  } else {
    addPass(
      passes,
      `${code}: subject_name present`
    );
  }

  // ----------------------------------------------------------
  // 5. Credits
  // ----------------------------------------------------------

  if (schemeCourse) {
    if (
      Number(subject.credits) !==
      Number(schemeCourse.credits)
    ) {
      addError(
        errors,
        `${code}: credits mismatch — JSON=${subject.credits}, scheme=${schemeCourse.credits}`
      );
    } else {
      addPass(
        passes,
        `${code}: credits match scheme (${subject.credits})`
      );
    }
  }

  // ----------------------------------------------------------
  // 6. Credits must be positive
  // ----------------------------------------------------------

  if (
    typeof subject.credits !== "number" ||
    subject.credits <= 0
  ) {
    addError(
      errors,
      `${code}: credits must be a positive number`
    );
  }

  // ----------------------------------------------------------
  // 7. Course type
  // ----------------------------------------------------------

  const validCourseTypes = [
    "Integrated",
    "Theory",
    "Practical",
    "Laboratory",
    "Theory + Practical",
  ];

  if (
    typeof subject.course_type !== "string" ||
    !subject.course_type.trim()
  ) {
    addError(
      errors,
      `${code}: course_type missing`
    );
  } else if (
    !validCourseTypes.includes(
      subject.course_type
    )
  ) {
    addWarning(
      warnings,
      `${code}: course_type "${subject.course_type}" is not in the standard list`
    );
  } else {
    addPass(
      passes,
      `${code}: course_type present`
    );
  }

  // ----------------------------------------------------------
  // 8. Pedagogy hours
  // ----------------------------------------------------------

  if (
    typeof subject.pedagogy_hours !== "number" ||
    subject.pedagogy_hours <= 0
  ) {
    addError(
      errors,
      `${code}: pedagogy_hours must be a positive number`
    );
  } else {
    addPass(
      passes,
      `${code}: pedagogy_hours valid (${subject.pedagogy_hours})`
    );
  }

  // ----------------------------------------------------------
  // 9. Source metadata
  // ----------------------------------------------------------

  if (
    !subject.source ||
    typeof subject.source !== "object"
  ) {
    addError(
      errors,
      `${code}: source metadata missing`
    );
  } else {
    const sourceFields = [
      "source_name",
      "source_document",
      "source_date",
    ];

    for (const field of sourceFields) {
      if (
        typeof subject.source[field] !== "string" ||
        !subject.source[field].trim()
      ) {
        addError(
          errors,
          `${code}: source.${field} missing`
        );
      }
    }

    if (
      subject.source?.source_name === "VTU"
    ) {
      addPass(
        passes,
        `${code}: source identified as VTU`
      );
    } else {
      addWarning(
        warnings,
        `${code}: source_name is "${subject.source?.source_name}"`
      );
    }
  }

  // ----------------------------------------------------------
  // 10. Modules
  // ----------------------------------------------------------

  if (!Array.isArray(subject.modules)) {
    addError(
      errors,
      `${code}: modules must be an array`
    );
  } else if (subject.modules.length === 0) {
    addError(
      errors,
      `${code}: modules array is empty`
    );
  } else {
    addPass(
      passes,
      `${code}: modules array contains ${subject.modules.length} modules`
    );

    // --------------------------------------------------------
    // Module numbering
    // --------------------------------------------------------

    subject.modules.forEach(
      (module, index) => {
        const expectedNumber = index + 1;

        if (
          module.module_number !==
          expectedNumber
        ) {
          addError(
            errors,
            `${code}: module ${index + 1} has module_number=${module.module_number}, expected ${expectedNumber}`
          );
        }

        if (
          typeof module.title !== "string" ||
          !module.title.trim()
        ) {
          addError(
            errors,
            `${code}: module ${expectedNumber} has no title`
          );
        }

        if (
          typeof module.hours !== "number" ||
          module.hours <= 0
        ) {
          addError(
            errors,
            `${code}: module ${expectedNumber} has invalid hours`
          );
        }

        if (
          !Array.isArray(module.topics)
        ) {
          addError(
            errors,
            `${code}: module ${expectedNumber} topics must be an array`
          );
        } else if (
          module.topics.length === 0
        ) {
          addWarning(
            warnings,
            `${code}: module ${expectedNumber} has no topics`
          );
        } else {
          module.topics.forEach(
            (topic, topicIndex) => {
              if (
                typeof topic?.title !== "string" ||
                !topic.title.trim()
              ) {
                addError(
                  errors,
                  `${code}: module ${expectedNumber}, topic ${topicIndex + 1} has no title`
                );
              }
            }
          );
        }

        if (
          module.self_learning !== undefined &&
          !Array.isArray(module.self_learning)
        ) {
          addError(
            errors,
            `${code}: module ${expectedNumber} self_learning must be an array`
          );
        }

        if (
          module.applications !== undefined &&
          !Array.isArray(module.applications)
        ) {
          addError(
            errors,
            `${code}: module ${expectedNumber} applications must be an array`
          );
        }
      }
    );
  }

  // ----------------------------------------------------------
  // 11. Module hours
  // ----------------------------------------------------------

  if (Array.isArray(subject.modules)) {
    const totalModuleHours =
      subject.modules.reduce(
        (sum, module) =>
          sum + Number(module.hours || 0),
        0
      );

    if (
      totalModuleHours >
      Number(subject.pedagogy_hours)
    ) {
      addWarning(
        warnings,
        `${code}: module hours (${totalModuleHours}) exceed pedagogy_hours (${subject.pedagogy_hours})`
      );
    } else {
      addPass(
        passes,
        `${code}: module hours total ${totalModuleHours}`
      );
    }
  }

  // ----------------------------------------------------------
  // 12. Course outcomes
  // ----------------------------------------------------------

  if (
    !Array.isArray(subject.course_outcomes)
  ) {
    addError(
      errors,
      `${code}: course_outcomes must be an array`
    );
  } else if (
    subject.course_outcomes.length === 0
  ) {
    addError(
      errors,
      `${code}: course_outcomes is empty`
    );
  } else {
    addPass(
      passes,
      `${code}: ${subject.course_outcomes.length} course outcomes found`
    );

    subject.course_outcomes.forEach(
      (outcome, index) => {
        if (
          typeof outcome !== "string" ||
          !outcome.trim()
        ) {
          addError(
            errors,
            `${code}: course outcome ${index + 1} is empty`
          );
        }
      }
    );
  }

  // ----------------------------------------------------------
  // 13. Practicals
  // ----------------------------------------------------------

  if (
    subject.practicals !== undefined
  ) {
    if (
      !Array.isArray(subject.practicals) &&
      (
        typeof subject.practicals !== "object" ||
        subject.practicals === null
      )
    ) {
      addError(
        errors,
        `${code}: practicals must be an array or object`
      );
    } else {
      addPass(
        passes,
        `${code}: practical information present`
      );
    }
  }

  // ----------------------------------------------------------
  // 14. TXT source identity
  // ----------------------------------------------------------

  const normalizedTxt = normalize(txt);
  const normalizedLooseTxt =
    normalizeLoose(txt);

  const codeFound =
    normalizedTxt.includes(
      normalize(code)
    );

  const alternateCodes =
    ALTERNATE_SOURCE_CODES[code] || [];

  const alternateCodeFound =
    alternateCodes.some(
      (alternateCode) =>
        normalizedTxt.includes(
          normalize(alternateCode)
        )
    );

  const jsonTitle =
    normalizeLoose(
      subject.subject_name
    );

  const titleFound =
    jsonTitle.length > 5 &&
    normalizedLooseTxt.includes(
      jsonTitle
    );

  if (
    codeFound ||
    alternateCodeFound ||
    titleFound
  ) {
    addPass(
      passes,
      `${code}: TXT source identifies the subject`
    );
  } else {
    addError(
      errors,
      `${code}: TXT does not contain subject code, alternate code, or JSON subject title`
    );
  }

  // ----------------------------------------------------------
  // 15. Check obvious wrong-code mismatch
  // ----------------------------------------------------------

  if (
    schemeCourse &&
    subject.subject_code !==
      schemeCourse.code
  ) {
    addError(
      errors,
      `${code}: subject code does not match scheme`
    );
  }

  // ----------------------------------------------------------
  // 16. Basic topic/source sanity check
  // ----------------------------------------------------------

  if (Array.isArray(subject.modules)) {
    let matchedTopicCount = 0;
    let checkedTopicCount = 0;

    for (const subjectModule of subject.modules) {
      if (!Array.isArray(subjectModule.topics)) {
        continue;
      }

      for (const topic of subjectModule.topics) {
        if (
          typeof topic?.title !== "string" ||
          !topic.title.trim()
        ) {
          continue;
        }

        checkedTopicCount++;

        const topicText =
          normalizeLoose(topic.title);

        // Only perform matching for reasonably
        // distinctive topic strings.
        if (topicText.length < 8) {
          continue;
        }

        if (
          normalizedLooseTxt.includes(
            topicText
          )
        ) {
          matchedTopicCount++;
        }
      }
    }

    if (checkedTopicCount > 0) {
      const percentage =
        Math.round(
          (matchedTopicCount /
            checkedTopicCount) *
            100
        );

      if (percentage >= 50) {
        addPass(
          passes,
          `${code}: ${matchedTopicCount}/${checkedTopicCount} checked topics found in TXT (${percentage}%)`
        );
      } else {
        addWarning(
          warnings,
          `${code}: only ${matchedTopicCount}/${checkedTopicCount} checked topics found in TXT (${percentage}%)`
        );
      }
    }
  }
}

// ============================================================
// Duplicate JSON detection
// ============================================================

console.log();
console.log("----------------------------------------");
console.log(" Checking JSON package consistency");
console.log("----------------------------------------");
console.log();

const jsonFiles = fs
  .readdirSync(SUBJECT_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort();

const jsonCodes = [];

for (const file of jsonFiles) {
  try {
    const data = readJson(
      path.join(SUBJECT_DIR, file)
    );

    if (data.subject_code) {
      jsonCodes.push(data.subject_code);
    }
  } catch {
    // Individual syntax problems are already
    // handled for the expected packages.
  }
}

const duplicateCodes = jsonCodes.filter(
  (code, index) =>
    jsonCodes.indexOf(code) !== index
);

if (duplicateCodes.length > 0) {
  const uniqueDuplicates = [
    ...new Set(duplicateCodes),
  ];

  for (const code of uniqueDuplicates) {
    addError(
      errors,
      `Duplicate subject_code detected: ${code}`
    );
  }
} else {
  addPass(
    passes,
    "No duplicate subject_code values detected"
  );
}

// ============================================================
// Summary
// ============================================================

console.log();
console.log("========================================");
console.log(" Validation Summary");
console.log("========================================");
console.log();

console.log(
  `   Expected existing packages : ${EXPECTED_EXISTING_JSONS.length}`
);

console.log(
  `   Successfully loaded        : ${subjectPackages.length}`
);

console.log(
  `   Validation checks passed   : ${passes.length}`
);

console.log(
  `   Warnings                   : ${warnings.length}`
);

console.log(
  `   Errors                     : ${errors.length}`
);

// ============================================================
// Warnings
// ============================================================

if (warnings.length > 0) {
  console.log();
  console.log("----------------------------------------");
  console.log(" Warnings");
  console.log("----------------------------------------");
  console.log();

  for (const warning of warnings) {
    console.log(`   ${warning}`);
  }
}

// ============================================================
// Errors
// ============================================================

if (errors.length > 0) {
  console.log();
  console.log("----------------------------------------");
  console.log(" Errors");
  console.log("----------------------------------------");
  console.log();

  for (const error of errors) {
    console.log(`   ${error}`);
  }
}

// ============================================================
// Final result
// ============================================================

console.log();
console.log("========================================");

if (errors.length === 0) {
  console.log(" 🎉 SUBJECT JSON VALIDATION PASSED");
  console.log("========================================");
  console.log();
  console.log(
    `All ${EXPECTED_EXISTING_JSONS.length} existing subject JSON packages passed structural and source validation.`
  );
  console.log();
  console.log("Validated packages:");

  for (const code of EXPECTED_EXISTING_JSONS) {
    console.log(`   ✅ ${code}`);
  }

  console.log();
  console.log("No files were modified.");
  console.log("No Supabase changes were made.");
  console.log();
} else {
  console.log(" ❌ SUBJECT JSON VALIDATION FAILED");
  console.log("========================================");
  console.log();
  console.log(
    `Found ${errors.length} error(s).`
  );
  console.log();
  console.log(
    "No files were modified."
  );
  console.log(
    "No Supabase changes were made."
  );
  console.log();
  process.exit(1);
}