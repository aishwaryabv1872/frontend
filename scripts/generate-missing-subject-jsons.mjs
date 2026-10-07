import fs from "node:fs";
import path from "node:path";

// ============================================================
// CONFIG
// ============================================================

const ROOT = process.cwd();

const SCHEME_PATH = path.join(
  ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE",
  "semester-1.json"
);

const SUBJECT_DIR = path.join(
  ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE",
  "subjects"
);

const DRY_RUN = process.argv.includes("--dry-run");

const PROTECTED_CODES = new Set([
  "BMATS101",
  "BPHYS102",
  "BCHES102",
  "BPOPS103",
]);

const ALT_CODE_MAP = {
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

const SOURCE_NAME =
  "Visvesvaraya Technological University";

const SOURCE_DOCUMENT =
  "cse-sem-1-2-scheme.pdf";

const SOURCE_URL =
  "https://vtu.ac.in/pdf/2022syll/csesch.pdf";

const SOURCE_VERSION =
  "29052023/V10";

const EFFECTIVE_ACADEMIC_YEAR =
  "2022-23";

// ============================================================
// TEXT HELPERS
// ============================================================

function cleanText(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeLoose(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[\u0000-\u001F]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function isDateLike(value) {
  const text = cleanText(value);

  return (
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(text) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(text)
  );
}

function isMeaningfulText(value, minLength = 2) {
  const text = cleanText(value);

  return (
    text.length >= minLength &&
    /[\p{L}]/u.test(text)
  );
}

// ============================================================
// FILE HELPERS
// ============================================================

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function findSourceTxt(code) {
  const exactPath = path.join(
    SUBJECT_DIR,
    `${code}.txt`
  );

  if (fs.existsSync(exactPath)) {
    return exactPath;
  }

  const files = fs
    .readdirSync(SUBJECT_DIR, {
      withFileTypes: true,
    })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name
          .toLowerCase()
          .endsWith(".txt")
    )
    .map((entry) => entry.name);

  const normalizedCode =
    normalizeLoose(code);

  for (const filename of files) {
    const normalizedFilename =
      normalizeLoose(filename);

    if (
      normalizedFilename.includes(
        normalizedCode
      )
    ) {
      return path.join(
        SUBJECT_DIR,
        filename
      );
    }
  }

  const alternate =
    ALT_CODE_MAP[code];

  if (alternate) {
    const normalizedAlternate =
      normalizeLoose(alternate);

    for (const filename of files) {
      const normalizedFilename =
        normalizeLoose(filename);

      if (
        normalizedFilename.includes(
          normalizedAlternate
        )
      ) {
        return path.join(
          SUBJECT_DIR,
          filename
        );
      }
    }
  }

  return null;
}

// ============================================================
// SOURCE OBJECT
// ============================================================

function source() {
  return {
    source_name: SOURCE_NAME,
    source_document: SOURCE_DOCUMENT,
    source_url: SOURCE_URL,
    source_version: SOURCE_VERSION,
    effective_academic_year:
      EFFECTIVE_ACADEMIC_YEAR,
  };
}

// ============================================================
// COURSE TITLE
// ============================================================

function extractCourseTitle(
  txt,
  code
) {
  const lines = txt
    .split("\n")
    .map(cleanText);

  // ----------------------------------------------------------
  // 1. Explicit Course Title line
  // ----------------------------------------------------------

  for (const line of lines) {
    const match = line.match(
      /^course\s*title\s*:?\s*(.+)$/i
    );

    if (!match) {
      continue;
    }

    const title = cleanText(
      match[1]
    );

    if (
      isMeaningfulText(title, 3) &&
      !isDateLike(title)
    ) {
      return title;
    }
  }

  // ----------------------------------------------------------
  // 2. Search near course code
  // ----------------------------------------------------------

  const codeVariants = [
    code,
    ALT_CODE_MAP[code],
  ].filter(Boolean);

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const compact =
      normalizeLoose(lines[i]);

    const isCodeLine =
      codeVariants.some(
        (candidate) =>
          compact.includes(
            normalizeLoose(candidate)
          )
      );

    if (!isCodeLine) {
      continue;
    }

    for (
      let j = i - 1;
      j >= Math.max(0, i - 8);
      j--
    ) {
      const candidate =
        cleanText(lines[j]);

      if (!candidate) {
        continue;
      }

      if (
        /^course\s*(code|title)/i.test(
          candidate
        )
      ) {
        continue;
      }

      if (isDateLike(candidate)) {
        continue;
      }

      if (
        /^(scheme|semester|branch|regulation|credits?)\b/i.test(
          candidate
        )
      ) {
        continue;
      }

      if (
        candidate.length >= 5 &&
        /[\p{L}]/u.test(candidate)
      ) {
        return candidate;
      }
    }
  }

  return `VTU ${code}`;
}

// ============================================================
// COURSE CODE
// ============================================================

function extractCourseCode(
  txt,
  expectedCode
) {
  const candidates = [
    expectedCode,
    ALT_CODE_MAP[expectedCode],
  ].filter(Boolean);

  const compact =
    normalizeLoose(txt);

  for (const candidate of candidates) {
    if (
      compact.includes(
        normalizeLoose(candidate)
      )
    ) {
      return candidate;
    }
  }

  return expectedCode;
}

// ============================================================
// MODULE HEADER CLEANING
// ============================================================

function normalizeModuleHeaderText(
  value
) {
  return cleanText(value)
    .replace(
      /^[•●▪◦‣–—-]+\s*/,
      ""
    )
    .trim();
}

// ============================================================
// MODULE HEADER DETECTION
// ============================================================

function detectModuleHeader(line) {
  let text =
    normalizeModuleHeaderText(line);

  if (!text) {
    return null;
  }

  // ----------------------------------------------------------
  // Remove common PDF extraction noise
  // ----------------------------------------------------------

  text = text
    .replace(
      /^module\s*[:.-]?\s*/i,
      "MODULE "
    )
    .trim();

  // ----------------------------------------------------------
  // MODULE 1
  // MODULE-1
  // MODULE: 1
  // MODULE 1:
  // ----------------------------------------------------------

  let match = text.match(
    /^MODULE\s*[-–—:.]?\s*(\d+)\s*(?:[:.)-]\s*)?(.*)$/i
  );

  if (match) {
    return {
      number: Number(match[1]),
      title: cleanModuleTitle(
        match[2]
      ),
    };
  }

  // ----------------------------------------------------------
  // MODULE I
  // MODULE-II
  // MODULE: III
  // ----------------------------------------------------------

  match = text.match(
    /^MODULE\s*[-–—:.]?\s*(I|II|III|IV|V)\s*(?:[:.)-]\s*)?(.*)$/i
  );

  if (match) {
    const map = {
      I: 1,
      II: 2,
      III: 3,
      IV: 4,
      V: 5,
    };

    return {
      number:
        map[
          match[1].toUpperCase()
        ],
      title: cleanModuleTitle(
        match[2]
      ),
    };
  }

  return null;
}

// ============================================================
// MODULE TITLE CLEANING
// ============================================================

function extractPedagogyHours(
  text
) {
  const value =
    cleanText(text);

  const patterns = [
    /\(\s*(\d+)\s*hours?\s*of\s*pedagogy\s*\)/i,
    /\(\s*(\d+)\s*hrs?\s*of\s*pedagogy\s*\)/i,
    /\b(\d+)\s*hours?\s*of\s*pedagogy\b/i,
    /\b(\d+)\s*hrs?\s*of\s*pedagogy\b/i,
  ];

  for (const pattern of patterns) {
    const match =
      value.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function cleanModuleTitle(
  value
) {
  let title =
    cleanText(value);

  if (!title) {
    return "";
  }

  // Remove pedagogy-hour suffix/prefix.
  title = title.replace(
    /\(\s*\d+\s*hours?\s*of\s*pedagogy\s*\)/gi,
    ""
  );

  title = title.replace(
    /\(\s*\d+\s*hrs?\s*of\s*pedagogy\s*\)/gi,
    ""
  );

  title = title.replace(
    /\b\d+\s*hours?\s*of\s*pedagogy\b/gi,
    ""
  );

  title = title.replace(
    /\b\d+\s*hrs?\s*of\s*pedagogy\b/gi,
    ""
  );

  // Remove standalone punctuation left behind.
  title = title
    .replace(/^[\s:;,-]+/, "")
    .replace(/[\s:;,-]+$/, "")
    .trim();

  return title;
}

// ============================================================
// FIND MODULES
// ============================================================

function findModules(lines) {
  const result = [];

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const header =
      detectModuleHeader(
        lines[i]
      );

    if (!header) {
      continue;
    }

    let title =
      header.title;

    // --------------------------------------------------------
    // If title is on next line, use it.
    // --------------------------------------------------------

    if (
      !title &&
      lines[i + 1]
    ) {
      const next =
        cleanText(
          lines[i + 1]
        );

      if (
        next &&
        !detectModuleHeader(next) &&
        !isCourseOutcomeHeader(next) &&
        !isMetadataLine(next)
      ) {
        title =
          cleanModuleTitle(next);
      }
    }

    result.push({
      module_number:
        header.number,

      title:
        title ||
        `Module ${header.number}`,

      startLine: i,
    });
  }

  return result;
}

// ============================================================
// MODULE HOURS
// ============================================================

function extractHours(text) {
  const pedagogy =
    extractPedagogyHours(text);

  if (pedagogy !== null) {
    return pedagogy;
  }

  const patterns = [
    /\(\s*(\d+)\s*hours?\s*\)/i,
    /\(\s*(\d+)\s*hrs?\s*\)/i,
    /\b(\d+)\s*hours?\b/i,
    /\b(\d+)\s*hrs?\b/i,
  ];

  for (const pattern of patterns) {
    const match =
      cleanText(text).match(
        pattern
      );

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

// ============================================================
// COURSE OUTCOME HEADER
// ============================================================

function isCourseOutcomeHeader(
  line
) {
  const text =
    cleanText(line);

  return (
    /^course\s*outcomes?/i.test(
      text
    ) ||
    /^outcomes?\s*of\s*the\s*course/i.test(
      text
    ) ||
    /^course\s*learning\s*outcomes?/i.test(
      text
    ) ||
    /^course\s*outcome\b/i.test(
      text
    )
  );
}

// ============================================================
// COURSE OUTCOME LINE
// ============================================================

function parseCourseOutcome(line) {
  const text =
    cleanText(line);

  // CO1: ...
  // CO1 - ...
  // CO1 ...
  let match = text.match(
    /^CO\s*([1-9]\d*)\s*[:.)-]?\s*(.+)$/i
  );

  if (match) {
    return {
      number: Number(match[1]),
      text: cleanText(match[2]),
    };
  }

  // 1. ...
  // 1) ...
  // 1: ...
  match = text.match(
    /^([1-9]\d*)[.)-:]\s*(.+)$/
  );

  if (match) {
    return {
      number: Number(match[1]),
      text: cleanText(match[2]),
    };
  }

  return null;
}

// ============================================================
// COURSE OUTCOME EXTRACTION
// ============================================================

function extractCourseOutcomes(
  lines
) {
  let startIndex = -1;

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    if (
      isCourseOutcomeHeader(
        lines[i]
      )
    ) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    return [];
  }

  const outcomes = [];

  let current = null;

  for (
    let i = startIndex + 1;
    i < lines.length;
    i++
  ) {
    const line =
      cleanText(lines[i]);

    if (!line) {
      continue;
    }

    // --------------------------------------------------------
    // Stop at major sections
    // --------------------------------------------------------

    if (
      detectModuleHeader(line) ||
      /^text\s*books?/i.test(line) ||
      /^reference\s*books?/i.test(line) ||
      /^question\s*paper/i.test(line) ||
      /^assessment/i.test(line) ||
      /^scheme\s*of\s*evaluation/i.test(line) ||
      /^teaching\s*hours?/i.test(line)
    ) {
      break;
    }

    const parsed =
      parseCourseOutcome(line);

    if (parsed) {
      if (current) {
        outcomes.push(current);
      }

      current =
        parsed.text;

      continue;
    }

    if (current) {
      if (
        line.length >= 3 &&
        !/^course\s*outcomes?/i.test(
          line
        )
      ) {
        current += ` ${line}`;
      }
    }
  }

  if (current) {
    outcomes.push(current);
  }

  return [
    ...new Set(
      outcomes
        .map(cleanText)
        .filter(
          (value) =>
            value.length >= 10 &&
            /[\p{L}]/u.test(value)
        )
    ),
  ];
}

// ============================================================
// SELF LEARNING
// ============================================================

function isSelfLearningHeader(line) {
  return /^self[- ]?learning\b/i.test(
    cleanText(line)
  );
}

// ============================================================
// MODULE STOP MARKERS
// ============================================================

function isModuleStopLine(line) {
  const text =
    cleanText(line);

  return (
    isCourseOutcomeHeader(text) ||
    /^practical\b/i.test(text) ||
    /^laboratory\b/i.test(text) ||
    /^experiments?\b/i.test(text) ||
    /^text\s*books?/i.test(text) ||
    /^reference\s*books?/i.test(text) ||
    /^question\s*paper/i.test(text)
  );
}

// ============================================================
// TOPIC CLEANING
// ============================================================

function cleanTopic(line) {
  let text =
    cleanText(line);

  text = text.replace(
    /^[-•●▪◦‣–—]+\s*/,
    ""
  );

  text = text.replace(
    /^\d+[.)\-:]\s*/,
    ""
  );

  text = text.replace(
    /^[A-Za-z][.)\-:]\s*/,
    ""
  );

  return text.trim();
}

// ============================================================
// METADATA DETECTION
// ============================================================

function isMetadataLine(line) {
  const text =
    cleanText(line);

  if (!text) {
    return true;
  }

  const patterns = [
    /^course\s*(code|title)\b/i,
    /^credits?\b/i,
    /^cie\b/i,
    /^see\b/i,
    /^teaching\s*hours?\b/i,
    /^pedagogy\b/i,
    /^assessment\b/i,
    /^exam\b/i,
    /^total\s*hours?\b/i,
    /^duration\b/i,
    /^scheme\s*of\s*evaluation\b/i,
    /^contact\s*hours?\b/i,
    /^hours\s*per\s*week\b/i,
  ];

  if (
    patterns.some(
      (pattern) =>
        pattern.test(text)
    )
  ) {
    return true;
  }

  // Standalone pedagogy line.
  if (
    /^\(?\s*\d+\s*hours?\s*of\s*pedagogy\s*\)?$/i.test(
      text
    )
  ) {
    return true;
  }

  if (
    /^\(?\s*\d+\s*hrs?\s*of\s*pedagogy\s*\)?$/i.test(
      text
    )
  ) {
    return true;
  }

  return false;
}

// ============================================================
// OBVIOUS EXTRACTION ARTIFACTS
// ============================================================

function isObviousExtractionArtifact(
  line
) {
  const text =
    cleanText(line);

  if (!text) {
    return true;
  }

  if (
    isDateLike(text)
  ) {
    return true;
  }

  if (
    /^\(?\s*\d+\s*hours?\s*of\s*pedagogy\s*\)?$/i.test(
      text
    )
  ) {
    return true;
  }

  if (
    /^\(?\s*\d+\s*hrs?\s*of\s*pedagogy\s*\)?$/i.test(
      text
    )
  ) {
    return true;
  }

  return false;
}

// ============================================================
// MODULE CONTENT
// ============================================================

function extractModuleContent(
  lines,
  current,
  next
) {
  const start =
    current.startLine + 1;

  const end =
    next
      ? next.startLine
      : lines.length;

  const section =
    lines.slice(start, end);

  const topics = [];
  const selfLearning = [];

  let inSelfLearning =
    false;

  for (
    const rawLine of section
  ) {
    const line =
      cleanTopic(rawLine);

    if (!line) {
      continue;
    }

    if (
      detectModuleHeader(line)
    ) {
      break;
    }

    if (
      isSelfLearningHeader(line)
    ) {
      inSelfLearning = true;

      const remainder =
        line.replace(
          /^self[- ]?learning\s*:?\s*/i,
          ""
        );

      if (
        remainder &&
        !isObviousExtractionArtifact(
          remainder
        )
      ) {
        selfLearning.push(
          remainder
        );
      }

      continue;
    }

    if (
      isModuleStopLine(line)
    ) {
      break;
    }

    if (
      inSelfLearning
    ) {
      if (
        !isMetadataLine(line) &&
        !isObviousExtractionArtifact(
          line
        )
      ) {
        selfLearning.push(
          line
        );
      }

      continue;
    }

    if (
      isMetadataLine(line)
    ) {
      continue;
    }

    if (
      isObviousExtractionArtifact(
        line
      )
    ) {
      continue;
    }

    if (
      line.length < 4
    ) {
      continue;
    }

    if (
      !/[\p{L}]/u.test(line)
    ) {
      continue;
    }

    topics.push({
      title: line,
    });
  }

  return {
    topics,
    selfLearning,
  };
}

// ============================================================
// MODULE EXTRACTION
// ============================================================

function extractModules(txt) {
  const lines =
    txt
      .split("\n")
      .map(cleanText);

  const headings =
    findModules(lines);

  if (
    headings.length === 0
  ) {
    return [];
  }

  const modules = [];

  for (
    let i = 0;
    i < headings.length;
    i++
  ) {
    const current =
      headings[i];

    const next =
      headings[i + 1] ??
      null;

    const content =
      extractModuleContent(
        lines,
        current,
        next
      );

    const rawTitle =
      current.title;

    const hours =
      extractHours(
        rawTitle
      );

    const title =
      cleanModuleTitle(
        rawTitle
      );

    modules.push({
      module_number:
        current.module_number,

      title:
        title ||
        `Module ${current.module_number}`,

      hours:
        hours ?? 0,

      topics:
        content.topics,

      ...(content.selfLearning.length > 0
        ? {
            self_learning:
              content.selfLearning,
          }
        : {}),
    });
  }

  return modules;
}

// ============================================================
// PRACTICALS
// ============================================================

function extractPracticals(txt) {
  const lines =
    txt
      .split("\n")
      .map(cleanText);

  const practicals = [];

  let start = -1;

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    if (
      /^practical\b/i.test(lines[i]) ||
      /^laboratory\b/i.test(lines[i]) ||
      /^experiments?\b/i.test(lines[i])
    ) {
      start = i;
      break;
    }
  }

  if (
    start === -1
  ) {
    return [];
  }

  for (
    let i = start + 1;
    i < lines.length;
    i++
  ) {
    const line =
      cleanText(lines[i]);

    if (!line) {
      continue;
    }

    if (
      isCourseOutcomeHeader(line) ||
      /^text\s*books?/i.test(line) ||
      /^reference\s*books?/i.test(line)
    ) {
      break;
    }

    const cleaned =
      cleanTopic(line);

    if (
      cleaned.length >= 5 &&
      /[\p{L}]/u.test(cleaned) &&
      !isObviousExtractionArtifact(
        cleaned
      )
    ) {
      practicals.push(
        cleaned
      );
    }
  }

  return [
    ...new Set(
      practicals
    ),
  ];
}

// ============================================================
// BUILD SUBJECT JSON
// ============================================================

function buildSubjectJson(
  schemeCourse,
  txt
) {
  const code =
    schemeCourse.code;

  const modules =
    extractModules(txt);

  const outcomes =
    extractCourseOutcomes(
      txt
        .split("\n")
        .map(cleanText)
    );

  const practicals =
    extractPracticals(txt);

  const subject = {
    subject_code:
      code,

    subject_name:
      extractCourseTitle(
        txt,
        code
      ),

    credits:
      schemeCourse.credits,

    course_type:
      schemeCourse.course_type ??
      "Integrated",

    pedagogy_hours:
      schemeCourse.pedagogy_hours ??
      40,

    source: {
      ...source(),

      extracted_course_code:
        extractCourseCode(
          txt,
          code
        ),
    },

    modules,
  };

  if (
    practicals.length > 0
  ) {
    subject.practicals =
      practicals;
  }

  if (
    outcomes.length > 0
  ) {
    subject.course_outcomes =
      outcomes;
  }

  return subject;
}

// ============================================================
// SUBJECT VALIDATION
// ============================================================

function validateExtractedSubject(
  subject
) {
  const problems = [];

  if (
    !subject.subject_code
  ) {
    problems.push(
      "missing subject_code"
    );
  }

  if (
    !subject.subject_name ||
    /^VTU\s+/i.test(
      subject.subject_name
    )
  ) {
    problems.push(
      "course title could not be reliably extracted"
    );
  }

  if (
    !Number.isFinite(
      Number(subject.credits)
    ) ||
    Number(subject.credits) <= 0
  ) {
    problems.push(
      "invalid credits"
    );
  }

  if (
    !Array.isArray(
      subject.modules
    ) ||
    subject.modules.length === 0
  ) {
    problems.push(
      "no modules extracted"
    );
  }

  if (
    Array.isArray(
      subject.modules
    )
  ) {
    const seenNumbers =
      new Set();

    for (
      const moduleData of
        subject.modules
    ) {
      const number =
        Number(
          moduleData.module_number
        );

      if (
        !Number.isFinite(
          number
        )
      ) {
        problems.push(
          "module has invalid module_number"
        );
      }

      if (
        seenNumbers.has(number)
      ) {
        problems.push(
          `duplicate module number: ${number}`
        );
      }

      seenNumbers.add(number);

      if (
        !moduleData.title ||
        /^Module\s+\d+$/i.test(
          moduleData.title
        )
      ) {
        problems.push(
          `module ${number}: unreliable title`
        );
      }

      if (
        !Array.isArray(
          moduleData.topics
        ) ||
        moduleData.topics.length === 0
      ) {
        problems.push(
          `module ${number}: no topics extracted`
        );
      }

      for (
        const topic of
          moduleData.topics ?? []
      ) {
        const title =
          typeof topic === "string"
            ? topic
            : topic?.title;

        if (
          !isMeaningfulText(
            title,
            3
          )
        ) {
          problems.push(
            `module ${number}: invalid topic`
          );
        }
      }

      if (
        moduleData.title
          .toLowerCase()
          .includes(
            "hours of pedagogy"
          )
      ) {
        problems.push(
          `module ${number}: pedagogy text leaked into module title`
        );
      }
    }

    if (
      subject.modules.length !== 5
    ) {
      problems.push(
        `expected 5 modules, found ${subject.modules.length}`
      );
    }
  }

  // ----------------------------------------------------------
  // CO validation
  // ----------------------------------------------------------

  if (
    !Array.isArray(
      subject.course_outcomes
    ) ||
    subject.course_outcomes.length === 0
  ) {
    problems.push(
      "no course outcomes extracted"
    );
  } else if (
    subject.course_outcomes.length > 10
  ) {
    problems.push(
      `suspicious course outcome count: ${subject.course_outcomes.length}`
    );
  }

  return problems;
}

// ============================================================
// BKSKK107 SPECIAL HANDLER
// ============================================================

function findBKSKKSource() {
  const exact =
    findSourceTxt(
      "BKSKK107"
    );

  return exact;
}

function extractBetween(
  text,
  startRegex,
  endRegex
) {
  const startMatch =
    text.match(startRegex);

  if (!startMatch) {
    return "";
  }

  const start =
    startMatch.index +
    startMatch[0].length;

  const remaining =
    text.slice(start);

  const endMatch =
    remaining.match(
      endRegex
    );

  if (!endMatch) {
    return remaining.trim();
  }

  return remaining
    .slice(
      0,
      endMatch.index
    )
    .trim();
}

function cleanSourceText(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function makeBKSKKModule(
  number,
  rawText
) {
  const cleaned =
    cleanSourceText(
      rawText
    );

  return {
    module_number:
      number,

    title:
      `Module ${number}`,

    hours: 3,

    topics: cleaned
      ? [
          {
            title: cleaned,
          },
        ]
      : [],
  };
}

function buildBKSKK107FromSource() {
  const sourceFile =
    findBKSKKSource();

  if (!sourceFile) {
    console.log(
      "⚠️ BKSKK107 source TXT was not found."
    );

    return null;
  }

  const raw =
    readText(sourceFile);

  const module1 =
    extractBetween(
      raw,
      /Module\s*1/i,
      /Module\s*2/i
    );

  const module2 =
    extractBetween(
      raw,
      /Module\s*2/i,
      /Module\s*3/i
    );

  const module3 =
    extractBetween(
      raw,
      /Module\s*3/i,
      /Module\s*4/i
    );

  const module4 =
    extractBetween(
      raw,
      /Module\s*4/i,
      /Module\s*5/i
    );

  const module5 =
    extractBetween(
      raw,
      /Module\s*5/i,
      /Course\s+outcome/i
    );

  const outcomeSection =
    extractBetween(
      raw,
      /Course\s+outcome/i,
      /Assessment/i
    );

  const outcomeMatches = [
    ...outcomeSection.matchAll(
      /CO\s*([1-5])\s*[:.-]?\s*(.+?)(?=\n\s*CO\s*[1-5]\b|$)/gis
    ),
  ];

  const courseOutcomes =
    outcomeMatches.map(
      (match) =>
        `CO${match[1]}: ${cleanSourceText(
          match[2]
        )}`
    );

  return {
    subject_code:
      "BKSKK107",

    subject_name:
      "Kannada Language Course",

    credits: 1,

    course_type:
      "Theory",

    pedagogy_hours: 15,

    source: {
      ...source(),

      source_date:
        "26.10.2022",

      extracted_course_code:
        "BKSKK107",
    },

    modules: [
      makeBKSKKModule(
        1,
        module1
      ),
      makeBKSKKModule(
        2,
        module2
      ),
      makeBKSKKModule(
        3,
        module3
      ),
      makeBKSKKModule(
        4,
        module4
      ),
      makeBKSKKModule(
        5,
        module5
      ),
    ],

    course_outcomes:
      courseOutcomes,
  };
}

// ============================================================
// MISSING COURSES
// ============================================================

function getMissingCourses(
  scheme
) {
  return (
    scheme.courses ?? []
  ).filter(
    (course) => {
      const code =
        course.code;

      const jsonPath =
        path.join(
          SUBJECT_DIR,
          `${code}.json`
        );

      return !fs.existsSync(
        jsonPath
      );
    }
  );
}

// ============================================================
// MAIN
// ============================================================

function main() {
  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    " Vertex — Missing Subject JSON Generator"
  );
  console.log(
    " VTU 2022 CSE Semester 1"
  );
  console.log(
    "============================================================"
  );
  console.log("");

  console.log(
    `Mode: ${
      DRY_RUN
        ? "DRY RUN - NO FILES WILL BE WRITTEN"
        : "WRITE MODE"
    }`
  );

  console.log(
    "Existing JSON files will NEVER be overwritten."
  );

  console.log(
    "Supabase will NOT be modified."
  );

  console.log("");

  // ----------------------------------------------------------
  // Directory checks
  // ----------------------------------------------------------

  if (
    !fs.existsSync(
      SCHEME_PATH
    )
  ) {
    console.error(
      `❌ Scheme not found:\n${SCHEME_PATH}`
    );

    process.exitCode = 1;
    return;
  }

  if (
    !fs.existsSync(
      SUBJECT_DIR
    )
  ) {
    console.error(
      `❌ Subject directory not found:\n${SUBJECT_DIR}`
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
        SCHEME_PATH
      );
  } catch (error) {
    console.error(
      `❌ Could not read scheme:\n${error.message}`
    );

    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // Missing courses
  // ----------------------------------------------------------

  const missing =
    getMissingCourses(
      scheme
    );

  console.log(
    `Courses in scheme : ${
      scheme.courses?.length ?? 0
    }`
  );

  console.log(
    `Missing JSONs     : ${missing.length}`
  );

  // ----------------------------------------------------------
  // Nothing to do
  // ----------------------------------------------------------

  if (
    missing.length === 0
  ) {
    console.log("");
    console.log(
      "✅ Nothing to generate."
    );

    console.log(
      "All scheme courses already have JSON packages."
    );

    return;
  }

  // ----------------------------------------------------------
  // Counters
  // ----------------------------------------------------------

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  // ----------------------------------------------------------
  // Generate
  // ----------------------------------------------------------

  for (
    const course of missing
  ) {
    const code =
      course.code;

    console.log("");
    console.log(
      "----------------------------------------"
    );
    console.log(
      ` ${code}`
    );
    console.log(
      "----------------------------------------"
    );

    // --------------------------------------------------------
    // Protected packages
    // --------------------------------------------------------

    if (
      PROTECTED_CODES.has(
        code
      )
    ) {
      console.log(
        "🔒 Protected package - skipped"
      );

      skipped++;
      continue;
    }

    // --------------------------------------------------------
    // Source
    // --------------------------------------------------------

    const txtPath =
      findSourceTxt(
        code
      );

    if (!txtPath) {
      console.log(
        `❌ Source TXT not found for ${code}`
      );

      failed++;
      continue;
    }

    console.log(
      `📄 Source: ${path.basename(txtPath)}`
    );

    const txt =
      readText(
        txtPath
      );

    // --------------------------------------------------------
    // Special BKSKK107
    // --------------------------------------------------------

    let subject;

    if (
      code === "BKSKK107"
    ) {
      subject =
        buildBKSKK107FromSource();
    } else {
      subject =
        buildSubjectJson(
          course,
          txt
        );
    }

    if (!subject) {
      console.log(
        "❌ Could not build subject package."
      );

      failed++;
      continue;
    }

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    const problems =
      validateExtractedSubject(
        subject
      );

    if (
      problems.length > 0
    ) {
      console.log(
        "❌ Extraction validation failed:"
      );

      for (
        const problem of
          problems
      ) {
        console.log(
          `   - ${problem}`
        );
      }

      failed++;
      continue;
    }

    // --------------------------------------------------------
    // Statistics
    // --------------------------------------------------------

    const topicCount =
      subject.modules.reduce(
        (
          sum,
          moduleData
        ) =>
          sum +
          (
            moduleData.topics
              ?.length ?? 0
          ),
        0
      );

    console.log(
      `📚 Title: ${subject.subject_name}`
    );

    console.log(
      `📦 Modules: ${subject.modules.length}`
    );

    console.log(
      `📝 Topics: ${topicCount}`
    );

    console.log(
      `🎯 Course Outcomes: ${
        subject.course_outcomes?.length ??
        0
      }`
    );

    if (
      subject.practicals
    ) {
      console.log(
        `🧪 Practicals: ${
          subject.practicals.length
        }`
      );
    }

    // --------------------------------------------------------
    // Print module summary
    // --------------------------------------------------------

    for (
      const moduleData of
        subject.modules
    ) {
      console.log(
        `   M${moduleData.module_number}: ${moduleData.title} (${moduleData.topics.length} topics)`
      );
    }

    // --------------------------------------------------------
    // Destination
    // --------------------------------------------------------

    const jsonPath =
      path.join(
        SUBJECT_DIR,
        `${code}.json`
      );

    // --------------------------------------------------------
    // Dry run
    // --------------------------------------------------------

    if (DRY_RUN) {
      console.log(
        `🔎 DRY RUN: would create ${code}.json`
      );

      generated++;
      continue;
    }

    // --------------------------------------------------------
    // Safety check before writing
    // --------------------------------------------------------

    if (
      fs.existsSync(
        jsonPath
      )
    ) {
      console.log(
        "🔒 File already exists - skipped"
      );

      skipped++;
      continue;
    }

    // --------------------------------------------------------
    // Write
    // --------------------------------------------------------

    try {
      fs.writeFileSync(
        jsonPath,
        `${JSON.stringify(
          subject,
          null,
          2
        )}\n`,
        "utf8"
      );

      console.log(
        `✅ Created ${code}.json`
      );

      generated++;
    } catch (error) {
      console.log(
        `❌ Failed to write ${code}.json: ${error.message}`
      );

      failed++;
    }
  }

  // ==========================================================
  // SUMMARY
  // ==========================================================

  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    " Generation Summary"
  );
  console.log(
    "============================================================"
  );
  console.log("");

  console.log(
    `Candidates : ${missing.length}`
  );

  console.log(
    `Generated  : ${generated}`
  );

  console.log(
    `Skipped    : ${skipped}`
  );

  console.log(
    `Failed     : ${failed}`
  );

  console.log("");

  if (
    DRY_RUN
  ) {
    console.log(
      "🔎 DRY RUN COMPLETE"
    );

    console.log(
      "No files were modified."
    );

    console.log(
      "No Supabase changes were made."
    );
  } else {
    console.log(
      "✅ GENERATION COMPLETE"
    );

    console.log(
      "Existing JSON packages were protected."
    );

    console.log(
      "No Supabase changes were made."
    );
  }

  console.log("");

  if (
    failed > 0
  ) {
    process.exitCode = 1;
  }
}

main();