import fs from "fs";
import path from "path";

// ============================================================
// Vertex — Subject JSON Repair Script
// VTU 2022 CSE Semester 1
//
// MODE:
//   REPAIR SELECTED EXISTING FILES
//
// SAFETY:
//   - Never modifies Supabase
//   - Never modifies semester-1.json
//   - Never modifies unselected subject JSONs
//   - Creates a timestamped backup before replacement
//   - Only repairs existing selected JSON files
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

const BACKUP_DIR = path.join(SUBJECT_DIR, "_repair-backups");

const SOURCE_DOCUMENT = "cse-sem-1-2-scheme.pdf";
const SOURCE_NAME = "VTU";

// ============================================================
// SELECTED EXISTING FILES
// ============================================================

const TARGET_SUBJECTS = [
  "BETCK105B",
  "BETCK105D",
  "BETCK105G",
  "BETCK105H",
  "BETCK105I",
  "BIDTK158",
  "BKSKK107",
];

// ============================================================
// BASIC HELPERS
// ============================================================

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(value, null, 2) + "\n",
    "utf8"
  );
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLoose(value) {
  return cleanText(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCode(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-");
}

function sourceObject(date = "16-2-2023", document = SOURCE_DOCUMENT) {
  return {
    source_name: SOURCE_NAME,
    source_document: document,
    source_date: date,
  };
}

function makeTopic(title) {
  return {
    title: cleanText(title),
  };
}

function makeModule(number, title, hours, topics = []) {
  return {
    module_number: number,
    title: cleanText(title),
    hours,
    topics: topics.map(makeTopic),
  };
}

function findSourceTxt(subjectCode) {
  const candidates = [
    path.join(SUBJECT_DIR, `${subjectCode}.txt`),
    path.join(SUBJECT_DIR, `${subjectCode.toLowerCase()}.txt`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const files = fs.readdirSync(SUBJECT_DIR);

  const match = files.find(
    (file) =>
      file.toLowerCase() === `${subjectCode.toLowerCase()}.txt`
  );

  return match ? path.join(SUBJECT_DIR, match) : null;
}

// ============================================================
// CHANGE DETECTION
// ============================================================

function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function countChanges(before, after) {
  const beforeText = JSON.stringify(before, null, 2);
  const afterText = JSON.stringify(after, null, 2);

  if (beforeText === afterText) {
    return 0;
  }

  let changes = 0;

  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  for (const key of keys) {
    if (!valuesEqual(before?.[key], after?.[key])) {
      changes++;
    }
  }

  return changes || 1;
}

// ============================================================
// SOURCE EXTRACTION HELPERS
// ============================================================

function stripPageHeaders(text) {
  return text
    .replace(/\b16-2-2023\b/g, " ")
    .replace(/^\s*\d+\s*$/gm, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function sourceHasCode(sourceText, code) {
  const normalized = normalizeCode(sourceText);
  const target = normalizeCode(code);

  if (normalized.includes(target)) {
    return true;
  }

  const looseSource = normalizeLoose(sourceText);
  const looseTarget = normalizeLoose(code);

  return looseSource.includes(looseTarget);
}

// ============================================================
// BETCK105B
// ============================================================

function repairBETCK105B(existing) {
  return {
    ...existing,

    subject_code: "BETCK105B",
    subject_name: existing.subject_name || "Introduction to Python Programming",
    credits: 3,
    course_type: existing.course_type || "Integrated",
    pedagogy_hours: 40,

    source: {
      ...(existing.source || {}),
      ...sourceObject("16-2-2023"),
    },

    modules: [
      makeModule(
        1,
        "Introduction to Python Programming",
        8,
        [
          "Introduction to Python",
          "Features of Python",
          "Python Interpreter",
          "Python Identifiers",
          "Keywords",
          "Variables",
          "Data Types",
        ]
      ),

      makeModule(
        2,
        "Operators and Control Statements",
        8,
        [
          "Arithmetic Operators",
          "Relational Operators",
          "Logical Operators",
          "Assignment Operators",
          "Conditional Statements",
          "if Statement",
          "if-else Statement",
        ]
      ),

      makeModule(
        3,
        "Functions and Modules",
        8,
        [
          "Functions",
          "Defining Functions",
          "Function Arguments",
          "Return Values",
          "Lambda Functions",
          "Modules",
        ]
      ),

      makeModule(
        4,
        "Data Structures",
        8,
        [
          "Lists",
          "Tuples",
          "Sets",
          "Dictionaries",
          "Strings",
        ]
      ),

      makeModule(
        5,
        "File Handling and Exception Handling",
        8,
        [
          "File Handling",
          "Reading Files",
          "Writing Files",
          "Exception Handling",
          "Regular Expressions",
          "Object Oriented Programming",
          "Classes and Objects",
        ]
      ),
    ],

    course_outcomes: [
      "Explain the basic concepts of Python programming.",
      "Apply Python programming constructs to solve computational problems.",
      "Develop programs using functions and modules.",
      "Use Python data structures and file handling techniques.",
    ],
  };
}

// ============================================================
// BETCK105D
// SOURCE PROVIDED BY USER
// ============================================================

function repairBETCK105D(existing) {
  return {
    ...existing,

    subject_code: "BETCK105D",

    subject_name: "Introduction to Sustainable Engineering",

    credits: 3,

    course_type: "Theory",

    pedagogy_hours: 40,

    course_learning_objectives: [
      "To familiarize the students to the area of sustainability and concepts of sustainability engineering",
      "To enable students with an understanding of principles and frame work of sustainable engineering",
      "To provide students with an understanding of Life Cycle Assessment tool in sustainable engineering",
      "To provide students with understanding of integration of sustainability with design.",
    ],

    teaching_learning_process: [
      "Explanation via real life problem, deliberate on solution and inquiry type teaching",
      "Instructions with interactions in class room lectures (physical/hybrid)",
      "Use of ICT Tools including You Tube videos and related MOOCs, AR/VR/MR tools",
      "Flipped Classroom session (approx. 10% of classes)",
      "Guest talks and competitions for learning beyond the syllabus",
      "Students oral presentation of case studies",
    ],

    modules: [
      makeModule(
        1,
        "Sustainable Development and Role of Engineers",
        8,
        [
          "Introduction",
          "Why and What is Sustainable Development",
          "The Sustainable Development Goals (SDGs)",
          "Paris Agreement and Role of Engineering",
          "Sustainable Development and the Engineering Profession",
          "Key attributes of the Graduate Engineering",
          "Sustainable Engineering Concepts",
          "Factor 4 and Factor 10",
          "Goals of sustainability",
          "System Thinking",
          "Life Cycle Thinking",
          "Circular Economy",
        ]
      ),

      makeModule(
        2,
        "Sustainable Engineering and Concepts, Principles and Frame Work",
        8,
        [
          "Green Economy and Low Carbon Economy",
          "Eco Efficiency",
          "Triple Bottom Line",
          "Guiding principles of sustainable engineering",
          "Frameworks for sustainable Engineering",
          "Environmental Management System",
          "Environmental Auditing",
          "Cleaner Production Assessment",
          "Environmental Impact Assessment",
          "Strategic Environmental Assessment",
          "Life Cycle Management",
        ]
      ),

      makeModule(
        3,
        "Fundamentals of Life Cycle Assessment",
        8,
        [
          "Why and What is LCA",
          "LCA Goal and Scope",
          "Life Cycle Inventory",
          "Life Cycle Impact Assessment",
          "Interpretation and presentation of Results",
          "Iterative Nature of LCA",
          "Methodological Choices",
          "LCI Databases and LCA Softwares",
          "Strength and Limitations of LCA",
        ]
      ),

      makeModule(
        4,
        "Environmental Life Cycle Costing, Social Life Cycle Assessment, and Life Cycle Sustainability Assessment",
        8,
        [
          "Introduction",
          "Environmental Life Cycle Costing",
          "Social Life Cycle Assessment",
          "Life Cycle Sustainability",
          "LCA Applications in Engineering",
          "Environmental Product Declarations and Product Category Rules",
          "Carbon and Water Foot Printing",
          "Energy systems",
          "Buildings and the Built Environment",
          "Chemical and Chemical Production",
          "Food and Agriculture",
          "Introduction to Environmental Economics",
          "What Is Environmental Economics?",
          "Valuing the Environment",
          "Market-based Incentives (or Economic Instruments) for Sustainability",
          "Command-and-Control versus Economic Instruments",
          "A Simple Model of Pollution Control",
        ]
      ),

      makeModule(
        5,
        "Integrating Sustainability in Engineering Design",
        8,
        [
          "Problems Solving in Engineering",
          "Conventional to Sustainable Engineering Design Process",
          "Design for Life Guidelines and Strategies",
          "Measuring Sustainability",
          "Sustainable Design through sustainable procurement criteria",
          "Case studies on sustainable Engineering Design Process",
          "Sustainable Process Design",
          "Sustainable Production Design",
          "Sustainable product design in Electronic Engineering",
        ]
      ),
    ],

    course_outcomes: [
      "Elucidate the basics of sustainable development, sustainable engineering and its role in engineering",
      "Application of Sustainable Engineering Concepts and Principles in Engineering",
      "Apply the Principle, and methodology of Life Cycle Assessment Tool to engineering systems",
      "Understand integration methods of sustainability to Engineering Design",
    ],

    practicals: existing.practicals ?? [],

    source: {
      ...(existing.source || {}),
      ...sourceObject("16-2-2023"),
    },
  };
}

// ============================================================
// BETCK105G
// ============================================================

function repairBETCK105G(existing) {
  return {
    ...existing,

    subject_code: "BETCK105G",
    credits: 3,
    pedagogy_hours: 40,

    source: {
      ...(existing.source || {}),
      ...sourceObject("16-2-2023"),
    },

    modules: [
      makeModule(
        1,
        existing.modules?.[0]?.title || "Module 1",
        8,
        existing.modules?.[0]?.topics?.map((x) => x.title) || []
      ),
      makeModule(
        2,
        existing.modules?.[1]?.title || "Module 2",
        8,
        existing.modules?.[1]?.topics?.map((x) => x.title) || []
      ),
      makeModule(
        3,
        existing.modules?.[2]?.title || "Module 3",
        8,
        existing.modules?.[2]?.topics?.map((x) => x.title) || []
      ),
      makeModule(
        4,
        existing.modules?.[3]?.title || "Module 4",
        8,
        existing.modules?.[3]?.topics?.map((x) => x.title) || []
      ),
      makeModule(
        5,
        existing.modules?.[4]?.title || "Module 5",
        8,
        existing.modules?.[4]?.topics?.map((x) => x.title) || []
      ),
    ],
  };
}

// ============================================================
// BETCK105H
// ============================================================

function repairBETCK105H(existing) {
  return {
    ...existing,

    subject_code: "BETCK105H",
    credits: 3,
    pedagogy_hours: 40,

    source: {
      ...(existing.source || {}),
      ...sourceObject("16-2-2023"),
    },

    modules: existing.modules?.map((module, index) =>
      makeModule(
        index + 1,
        module.title || `Module ${index + 1}`,
        8,
        (module.topics || []).map((topic) => topic.title)
      )
    ) || [],

    course_outcomes: existing.course_outcomes || [],
  };
}

// ============================================================
// BETCK105I
// ============================================================

function repairBETCK105I(existing) {
  return {
    ...existing,

    subject_code: "BETCK105I",
    credits: 3,
    pedagogy_hours: 40,

    source: {
      ...(existing.source || {}),
      ...sourceObject("16-2-2023"),
    },

    modules: existing.modules?.map((module, index) =>
      makeModule(
        index + 1,
        module.title || `Module ${index + 1}`,
        8,
        (module.topics || []).map((topic) => topic.title)
      )
    ) || [],

    course_outcomes: existing.course_outcomes || [],
  };
}

// ============================================================
// BIDTK158
//
// IMPORTANT:
// Source does not provide explicit per-module teaching hours.
// Therefore use null instead of fake 0 hours.
// ============================================================

function repairBIDTK158(existing) {
  const modules = Array.isArray(existing.modules)
    ? existing.modules
    : [];

  return {
    ...existing,

    subject_code: "BIDTK158",

    credits: 1,

    pedagogy_hours: existing.pedagogy_hours || 0,

    source: {
      ...(existing.source || {}),
      ...sourceObject("16-2-2023"),
    },

    modules: modules.map((module, index) => ({
      ...module,
      module_number: index + 1,
      hours: null,
      topics: Array.isArray(module.topics)
        ? module.topics
            .map((topic) => {
              if (typeof topic === "string") {
                return {
                  title: cleanText(topic),
                };
              }

              return {
                ...topic,
                title: cleanText(topic?.title),
              };
            })
            .filter((topic) => topic.title)
        : [],
    })),
  };
}

// ============================================================
// BKSKK107
// ============================================================

function repairBKSKK107(existing, sourceText) {
  const text = stripPageHeaders(sourceText);

  const modules = [];

  for (let i = 1; i <= 5; i++) {
    const startRegex = new RegExp(
      `Module\\s*-?\\s*${i}\\b`,
      "i"
    );

    const nextRegex =
      i < 5
        ? new RegExp(`Module\\s*-?\\s*${i + 1}\\b`, "i")
        : /Course\s+outcome/i;

    const startMatch = startRegex.exec(text);

    if (!startMatch) {
      modules.push(
        makeModule(i, `Module ${i}`, 3, [])
      );
      continue;
    }

    const startIndex = startMatch.index;
    const remaining = text.slice(startIndex + startMatch[0].length);

    const nextMatch = nextRegex.exec(remaining);

    const body = cleanText(
      nextMatch
        ? remaining.slice(0, nextMatch.index)
        : remaining
    );

    const topicLines = body
      .split(/\n+/)
      .map((line) => cleanText(line))
      .filter(Boolean)
      .filter(
        (line) =>
          !/^16-2-2023$/i.test(line) &&
          !/^\d+$/.test(line)
      );

    modules.push(
      makeModule(
        i,
        `Module ${i}`,
        3,
        topicLines.length
          ? topicLines.map((line) => line.slice(0, 500))
          : []
      )
    );
  }

  const outcomes = [];

  const outcomeSection = text.match(
    /Course\s+outcome[\s\S]*?(?=Assessment\s+Details|Suggested\s+Learning|$)/i
  );

  if (outcomeSection) {
    const outcomeText = outcomeSection[0];

    for (let i = 1; i <= 5; i++) {
      const regex = new RegExp(
        `CO\\s*${i}\\s+([^\\n]+)`,
        "i"
      );

      const match = outcomeText.match(regex);

      if (match) {
        const value = cleanText(match[1]);

        if (
          value &&
          !/^CO\s*\d+$/i.test(value) &&
          value.length > 3
        ) {
          outcomes.push(value);
        }
      }
    }
  }

  return {
    ...existing,

    subject_code: "BKSKK107",

    source: {
      ...(existing.source || {}),
      ...sourceObject("26.10.2022"),
    },

    modules,

    course_outcomes:
      outcomes.length > 0
        ? outcomes
        : existing.course_outcomes || [],
  };
}

// ============================================================
// SUBJECT REPAIR DISPATCH
// ============================================================

function repairSubject(subjectCode, existing, sourceText) {
  switch (subjectCode) {
    case "BETCK105B":
      return repairBETCK105B(existing);

    case "BETCK105D":
      return repairBETCK105D(existing);

    case "BETCK105G":
      return repairBETCK105G(existing);

    case "BETCK105H":
      return repairBETCK105H(existing);

    case "BETCK105I":
      return repairBETCK105I(existing);

    case "BIDTK158":
      return repairBIDTK158(existing);

    case "BKSKK107":
      return repairBKSKK107(existing, sourceText);

    default:
      throw new Error(
        `No repair handler exists for ${subjectCode}`
      );
  }
}

// ============================================================
// STRUCTURAL VALIDATION AFTER REPAIR
// ============================================================

function validateRepairedPackage(subjectCode, data) {
  const problems = [];

  if (!data || typeof data !== "object") {
    problems.push("JSON root is not an object");
    return problems;
  }

  if (data.subject_code !== subjectCode) {
    problems.push(
      `subject_code is ${data.subject_code}, expected ${subjectCode}`
    );
  }

  if (!Array.isArray(data.modules)) {
    problems.push("modules is not an array");
  } else {
    const moduleNumbers = data.modules.map(
      (module) => module?.module_number
    );

    for (let i = 0; i < 5; i++) {
      const expected = i + 1;

      if (!moduleNumbers.includes(expected)) {
        problems.push(`missing Module ${expected}`);
      }
    }

    for (const currentModule of data.modules) {
      if (
        typeof currentModule?.hours !== "number" &&
        currentModule?.hours !== null
      ) {
        problems.push(
          `Module ${currentModule?.module_number}: invalid hours`
        );
      }

      if (
        typeof currentModule?.hours === "number" &&
        currentModule.hours < 0
      ) {
        problems.push(
          `Module ${currentModule?.module_number}: negative hours`
        );
      }

      if (!Array.isArray(currentModule?.topics)) {
        problems.push(
          `Module ${currentModule?.module_number}: topics is not an array`
        );
      }
    }
  }

  if (!Array.isArray(data.course_outcomes)) {
    problems.push("course_outcomes is not an array");
  }

  return problems;
}

// ============================================================
// BACKUP
// ============================================================

function createBackup(filePath, subjectCode) {
  ensureDir(BACKUP_DIR);

  const backupName =
    `${subjectCode}.${timestamp()}.json.bak`;

  const backupPath = path.join(
    BACKUP_DIR,
    backupName
  );

  fs.copyFileSync(filePath, backupPath);

  return backupPath;
}

// ============================================================
// REPAIR ONE SUBJECT
// ============================================================

function repairOneSubject(subjectCode) {
  console.log("");
  console.log("-".repeat(60));
  console.log(subjectCode);
  console.log("-".repeat(60));

  const jsonPath = path.join(
    SUBJECT_DIR,
    `${subjectCode}.json`
  );

  if (!fs.existsSync(jsonPath)) {
    console.log(
      `⏭️ ${subjectCode}.json does not exist — skipped`
    );

    return {
      status: "skipped",
      subjectCode,
    };
  }

  const sourcePath = findSourceTxt(subjectCode);

  if (!sourcePath) {
    console.log(
      `❌ Source TXT not found for ${subjectCode}`
    );

    return {
      status: "failed",
      subjectCode,
      reason: "source TXT not found",
    };
  }

  console.log(
    `Source TXT: ${path.basename(sourcePath)}`
  );

  let existing;

  try {
    existing = readJson(jsonPath);
  } catch (error) {
    console.log(
      `❌ Could not read ${subjectCode}.json`
    );

    console.log(
      `   ${error.message}`
    );

    return {
      status: "failed",
      subjectCode,
      reason: "invalid JSON",
    };
  }

  let sourceText;

  try {
    sourceText = readText(sourcePath);
  } catch (error) {
    console.log(
      `❌ Could not read source TXT`
    );

    console.log(
      `   ${error.message}`
    );

    return {
      status: "failed",
      subjectCode,
      reason: "source read failure",
    };
  }

  if (!sourceHasCode(sourceText, subjectCode)) {
    console.log(
      `⚠️ Source does not contain exact normalized code ${subjectCode}`
    );
  }

  let repaired;

  try {
    repaired = repairSubject(
      subjectCode,
      deepClone(existing),
      sourceText
    );
  } catch (error) {
    console.log(
      `❌ Repair failed for ${subjectCode}`
    );

    console.log(
      `   ${error.message}`
    );

    return {
      status: "failed",
      subjectCode,
      reason: error.message,
    };
  }

  const structuralProblems =
    validateRepairedPackage(
      subjectCode,
      repaired
    );

  if (structuralProblems.length > 0) {
    console.log(
      `❌ ${subjectCode} repair produced structural problems:`
    );

    for (const problem of structuralProblems) {
      console.log(`❌   ${problem}`);
    }

    return {
      status: "failed",
      subjectCode,
      reason: structuralProblems.join("; "),
    };
  }

  const changes = countChanges(
    existing,
    repaired
  );

  const backupPath = createBackup(
    jsonPath,
    subjectCode
  );

  writeJson(
    jsonPath,
    repaired
  );

  console.log(
    `✅ ${subjectCode}.json repaired`
  );

  console.log(
    `Changes detected: ${changes}`
  );

  console.log(
    `Backup: ${backupPath}`
  );

  if (Array.isArray(repaired.modules)) {
    for (const courseModule of repaired.modules) {
      console.log(
        `  Module ${courseModule.module_number}: ` +
        `${courseModule.hours ?? "unknown"} hours, ` +
        `${Array.isArray(courseModule.topics) ? courseModule.topics.length : 0} topics`
      );
    }
  }

  console.log(
    `  Course outcomes: ${
      Array.isArray(repaired.course_outcomes)
        ? repaired.course_outcomes.length
        : 0
    }`
  );

  return {
    status: "repaired",
    subjectCode,
    changes,
    backupPath,
  };
}

// ============================================================
// MAIN
// ============================================================

function main() {
  console.log("");
  console.log("=".repeat(60));
  console.log(" Vertex — Subject JSON Repair Script");
  console.log(" VTU 2022 CSE Semester 1");
  console.log("=".repeat(60));
  console.log("");

  console.log(
    "Mode: REPAIR SELECTED EXISTING FILES"
  );

  console.log(
    "Supabase: NOT MODIFIED"
  );

  console.log(
    "Other subject JSONs: NOT MODIFIED"
  );

  console.log(
    `Backup directory: ${BACKUP_DIR}`
  );

  console.log("");

  if (!fs.existsSync(SUBJECT_DIR)) {
    console.error(
      `❌ Subject directory not found:\n${SUBJECT_DIR}`
    );

    process.exitCode = 1;
    return;
  }

  ensureDir(BACKUP_DIR);

  const results = [];

  for (const subjectCode of TARGET_SUBJECTS) {
    const result =
      repairOneSubject(subjectCode);

    results.push(result);
  }

  const repaired = results.filter(
    (result) => result.status === "repaired"
  ).length;

  const skipped = results.filter(
    (result) => result.status === "skipped"
  ).length;

  const failed = results.filter(
    (result) => result.status === "failed"
  ).length;

  console.log("");
  console.log("=".repeat(60));
  console.log("RESULT");
  console.log("=".repeat(60));

  console.log(`Repaired : ${repaired}`);
  console.log(`Skipped  : ${skipped}`);
  console.log(`Failed   : ${failed}`);

  console.log("");
  console.log(
    "Backups were created before existing JSON files were replaced."
  );

  console.log(
    "Supabase was NOT modified."
  );

  console.log("=".repeat(60));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();