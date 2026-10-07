import fs from "fs";
import path from "path";

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

// ======================================================
// TEXT HELPERS
// ======================================================

function cleanText(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
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

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

// ======================================================
// SOURCE FILE
// ======================================================

function findSourceTxt(code) {
  const filePath = path.join(
    SUBJECT_DIR,
    `${code}.txt`
  );

  return fs.existsSync(filePath)
    ? filePath
    : null;
}

// ======================================================
// COURSE TITLE
// ======================================================

function extractCourseTitle(
  txt,
  code
) {
  const lines = txt
    .split("\n")
    .map(cleanText)
    .filter(Boolean);

  // Preferred source format:
  // Course Title: ...
  for (const line of lines) {
    const match = line.match(
      /^course\s*title\s*:\s*(.+)$/i
    );

    if (match) {
      const title = cleanText(
        match[1]
      );

      if (
        title &&
        !/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(
          title
        )
      ) {
        return title;
      }
    }
  }

  // Search near Course Code.
  const codeVariants = [
    code,
    ALT_CODE_MAP[code],
  ].filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
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
      j >= Math.max(0, i - 6);
      j--
    ) {
      const candidate =
        cleanText(lines[j]);

      if (
        !candidate ||
        /^course\s*(code|title)/i.test(
          candidate
        ) ||
        /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(
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

// ======================================================
// COURSE CODE
// ======================================================

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

// ======================================================
// MODULE HEADER DETECTION
// ======================================================

function detectModuleHeader(line) {
  const text = cleanText(line);

  /*
   * Examples:
   *
   * MODULE 1
   * Module-1
   * Module 1:
   * MODULE-I
   * MODULE – I
   */

  let match = text.match(
    /^module\s*[-–—:]?\s*(\d+)\s*[:.)-]?\s*(.*)$/i
  );

  if (match) {
    return {
      number: Number(match[1]),
      title: cleanText(match[2]),
    };
  }

  const romanMatch = text.match(
    /^module\s*[-–—:]?\s*(I|II|III|IV|V)\s*[:.)-]?\s*(.*)$/i
  );

  if (romanMatch) {
    const map = {
      I: 1,
      II: 2,
      III: 3,
      IV: 4,
      V: 5,
    };

    return {
      number:
        map[romanMatch[1].toUpperCase()],
      title: cleanText(
        romanMatch[2]
      ),
    };
  }

  return null;
}

function findModules(lines) {
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const header =
      detectModuleHeader(
        lines[i]
      );

    if (!header) {
      continue;
    }

    let title = header.title;

    /*
     * PDF extraction sometimes places the
     * module title on the following line.
     */
    if (
      !title &&
      lines[i + 1]
    ) {
      const next =
        cleanText(lines[i + 1]);

      if (
        next &&
        !detectModuleHeader(next) &&
        !/^course\s*outcomes?/i.test(
          next
        )
      ) {
        title = next;
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

// ======================================================
// MODULE HOURS
// ======================================================

function extractHours(text) {
  const patterns = [
    /\(\s*(\d+)\s*(?:hours?|hrs?)\s*\)/i,
    /\b(\d+)\s*(?:hours?|hrs?)\b/i,
  ];

  for (const pattern of patterns) {
    const match =
      text.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

// ======================================================
// COURSE OUTCOME HEADER
// ======================================================

function isCourseOutcomeHeader(line) {
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
    )
  );
}

// ======================================================
// CO LINE
// ======================================================

function parseCourseOutcome(line) {
  const text =
    cleanText(line);

  /*
   * Accept:
   *
   * CO1:
   * CO1 -
   * CO1
   * 1.
   * 1)
   */

  let match = text.match(
    /^CO\s*([1-9]\d*)\s*[:.)-]?\s*(.+)$/i
  );

  if (match) {
    return {
      number: Number(match[1]),
      text: cleanText(match[2]),
    };
  }

  match = text.match(
    /^([1-9]\d*)[\).:-]\s*(.+)$/
  );

  if (match) {
    return {
      number: Number(match[1]),
      text: cleanText(match[2]),
    };
  }

  return null;
}

// ======================================================
// EXTRACT COURSE OUTCOMES
// ======================================================

function extractCourseOutcomes(
  lines
) {
  let startIndex = -1;

  for (let i = 0; i < lines.length; i++) {
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

    // Stop at the next major section.
    if (
      /^module\s*/i.test(line) ||
      /^text\s*books?/i.test(line) ||
      /^reference\s*books?/i.test(
        line
      ) ||
      /^question\s*paper/i.test(
        line
      ) ||
      /^assessment/i.test(line) ||
      /^scheme\s*of\s*evaluation/i.test(
        line
      )
    ) {
      break;
    }

    const parsed =
      parseCourseOutcome(line);

    if (parsed) {
      if (current) {
        outcomes.push(
          current
        );
      }

      current = parsed.text;
      continue;
    }

    /*
     * Continuation line for the current CO.
     */
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

  /*
   * Deduplicate and remove suspicious
   * non-outcome lines.
   */
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

// ======================================================
// SELF LEARNING
// ======================================================

function isSelfLearningHeader(line) {
  return /^self[- ]?learning/i.test(
    cleanText(line)
  );
}

// ======================================================
// STOP MARKERS
// ======================================================

function isModuleStopLine(line) {
  const text =
    cleanText(line);

  return (
    isCourseOutcomeHeader(text) ||
    /^practical/i.test(text) ||
    /^laboratory/i.test(text) ||
    /^experiments?/i.test(text) ||
    /^text\s*books?/i.test(text) ||
    /^reference\s*books?/i.test(
      text
    ) ||
    /^question\s*paper/i.test(text)
  );
}

// ======================================================
// TOPIC CLEANING
// ======================================================

function cleanTopic(line) {
  return cleanText(line)
    .replace(
      /^[-•●▪◦‣]+\s*/,
      ""
    )
    .replace(
      /^\d+[\).:-]\s*/,
      ""
    )
    .replace(
      /^[A-Za-z][\).:-]\s*/,
      ""
    )
    .trim();
}

function isMetadataLine(line) {
  const text =
    cleanText(line);

  if (!text) {
    return true;
  }

  const patterns = [
    /^course\s*(code|title)/i,
    /^credits?\b/i,
    /^cie\b/i,
    /^see\b/i,
    /^teaching\s*hours?/i,
    /^pedagogy/i,
    /^assessment/i,
    /^exam/i,
    /^total\s*hours?/i,
    /^duration/i,
  ];

  return patterns.some(
    (pattern) =>
      pattern.test(text)
  );
}

// ======================================================
// MODULE CONTENT
// ======================================================

function extractModuleContent(
  lines,
  current,
  next
) {
  const start =
    current.startLine + 1;

  const end = next
    ? next.startLine
    : lines.length;

  const section =
    lines.slice(start, end);

  const topics = [];
  const selfLearning = [];

  let inSelfLearning =
    false;

  for (const rawLine of section) {
    const line =
      cleanTopic(rawLine);

    if (!line) {
      continue;
    }

    /*
     * Don't accidentally include another
     * module if the PDF extraction is strange.
     */
    if (
      detectModuleHeader(line)
    ) {
      break;
    }

    /*
     * Self-learning
     */
    if (
      isSelfLearningHeader(
        line
      )
    ) {
      inSelfLearning = true;

      const remainder =
        line.replace(
          /^self[- ]?learning\s*:?\s*/i,
          ""
        );

      if (remainder) {
        selfLearning.push(
          remainder
        );
      }

      continue;
    }

    /*
     * Course outcomes / practicals / books
     */
    if (
      isModuleStopLine(line)
    ) {
      break;
    }

    if (
      inSelfLearning
    ) {
      if (
        !isMetadataLine(line)
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

    /*
     * Ignore obvious page/date artifacts.
     */
    if (
      /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(
        line
      )
    ) {
      continue;
    }

    /*
     * Ignore tiny fragments.
     */
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

// ======================================================
// MODULE EXTRACTION
// ======================================================

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

    let title =
      current.title;

    const hours =
      extractHours(title);

    title = title
      .replace(
        /\(\s*\d+\s*(?:hours?|hrs?)\s*\)/gi,
        ""
      )
      .trim();

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

      ...(content.selfLearning.length
        ? {
            self_learning:
              content.selfLearning,
          }
        : {}),
    });
  }

  return modules;
}

// ======================================================
// PRACTICALS
// ======================================================

function extractPracticals(txt) {
  const lines =
    txt
      .split("\n")
      .map(cleanText);

  const practicals = [];

  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    if (
      /^practical/i.test(
        lines[i]
      ) ||
      /^laboratory/i.test(
        lines[i]
      ) ||
      /^experiments?/i.test(
        lines[i]
      )
    ) {
      start = i;
      break;
    }
  }

  if (start === -1) {
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
      isCourseOutcomeHeader(
        line
      ) ||
      /^text\s*books?/i.test(
        line
      ) ||
      /^reference\s*books?/i.test(
        line
      )
    ) {
      break;
    }

    const cleaned =
      cleanTopic(line);

    if (
      cleaned.length >= 5 &&
      /[\p{L}]/u.test(cleaned)
    ) {
      practicals.push(
        cleaned
      );
    }
  }

  return [
    ...new Set(practicals),
  ];
}

// ======================================================
// BUILD PACKAGE
// ======================================================

function buildSubjectJson(
  schemeCourse,
  txt
) {
  const code =
    schemeCourse.code;

  const subjectName =
    extractCourseTitle(
      txt,
      code
    );

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
      subjectName,

    credits:
      schemeCourse.credits,

    course_type:
      schemeCourse.course_type ??
      "Integrated",

    pedagogy_hours:
      schemeCourse.pedagogy_hours ??
      40,

    source: {
      source_name:
        "Visvesvaraya Technological University",

      source_document:
        "cse-sem-1-2-scheme.pdf",

      source_url:
        "https://vtu.ac.in/pdf/2022syll/csesch.pdf",

      source_version:
        "29052023/V10",

      effective_academic_year:
        "2022-23",

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

// ======================================================
// VALIDATION
// ======================================================

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
      subject.credits
    )
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

  for (const moduleData of
    subject.modules ?? []) {
    if (
      !moduleData.title
    ) {
      problems.push(
        `module ${moduleData.module_number}: missing title`
      );
    }

    if (
      !Array.isArray(
        moduleData.topics
      ) ||
      moduleData.topics.length === 0
    ) {
      problems.push(
        `module ${moduleData.module_number}: no topics extracted`
      );
    }
  }

  /*
   * We require 3-6 COs.
   *
   * VTU first-year subjects normally have
   * a small number of course outcomes.
   */
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

// ======================================================
// FIND MISSING COURSES
// ======================================================

function getMissingCourses(
  scheme
) {
  return (
    scheme.courses ?? []
  ).filter((course) => {
    const jsonPath =
      path.join(
        SUBJECT_DIR,
        `${course.code}.json`
      );

    return !fs.existsSync(
      jsonPath
    );
  });
}

// ======================================================
// MAIN
// ======================================================

function main() {
  console.log(
    "========================================"
  );

  console.log(
    " Vertex Subject JSON Generator"
  );

  console.log(
    " VTU 2022 CSE - Semester 1"
  );

  console.log(
    "========================================"
  );

  console.log(
    `\nMode: ${
      DRY_RUN
        ? "DRY RUN - NO FILES WILL BE WRITTEN"
        : "WRITE MODE"
    }\n`
  );

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

  const scheme =
    readJson(
      SCHEME_PATH
    );

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

  if (
    missing.length === 0
  ) {
    console.log(
      "\n✅ Nothing to generate."
    );
    return;
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const course of missing) {
    const code =
      course.code;

    console.log(
      "\n----------------------------------------"
    );

    console.log(
      ` ${code}`
    );

    if (
      PROTECTED_CODES.has(
        code
      )
    ) {
      console.log(
        " 🔒 Protected existing package - skipped"
      );

      skipped++;
      continue;
    }

    const txtPath =
      findSourceTxt(code);

    if (!txtPath) {
      console.log(
        ` ❌ Source TXT not found: ${code}.txt`
      );

      failed++;
      continue;
    }

    console.log(
      ` 📄 Source: ${path.basename(txtPath)}`
    );

    const txt =
      readText(txtPath);

    const subject =
      buildSubjectJson(
        course,
        txt
      );

    const problems =
      validateExtractedSubject(
        subject
      );

    if (
      problems.length > 0
    ) {
      console.log(
        " ❌ Extraction validation failed:"
      );

      for (const problem of
        problems) {
        console.log(
          `    - ${problem}`
        );
      }

      failed++;
      continue;
    }

    const topicCount =
      subject.modules.reduce(
        (sum, moduleData) =>
          sum +
          moduleData.topics.length,
        0
      );

    console.log(
      ` 📚 Title: ${subject.subject_name}`
    );

    console.log(
      ` 📦 Modules: ${subject.modules.length}`
    );

    console.log(
      ` 📝 Topics: ${topicCount}`
    );

    console.log(
      ` 🎯 Course Outcomes: ${
        subject.course_outcomes.length
      }`
    );

    if (
      subject.practicals
    ) {
      console.log(
        ` 🧪 Practicals: ${
          subject.practicals.length
        }`
      );
    }

    const jsonPath =
      path.join(
        SUBJECT_DIR,
        `${code}.json`
      );

    if (DRY_RUN) {
      console.log(
        ` 🔎 DRY RUN: would create ${code}.json`
      );

      generated++;
      continue;
    }

    if (
      fs.existsSync(
        jsonPath
      )
    ) {
      console.log(
        " 🔒 File already exists - skipped"
      );

      skipped++;
      continue;
    }

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
      ` ✅ Created ${code}.json`
    );

    generated++;
  }

  console.log(
    "\n========================================"
  );

  console.log(
    " Generation Summary"
  );

  console.log(
    "========================================\n"
  );

  console.log(
    ` Candidates : ${missing.length}`
  );

  console.log(
    ` Generated  : ${generated}`
  );

  console.log(
    ` Skipped    : ${skipped}`
  );

  console.log(
    ` Failed     : ${failed}`
  );

  if (DRY_RUN) {
    console.log(
      "\n🔎 DRY RUN COMPLETE"
    );

    console.log(
      "No files were modified."
    );

    console.log(
      "Review the extraction before write mode."
    );
  } else {
    console.log(
      "\n✅ GENERATION COMPLETE"
    );

    console.log(
      "No existing protected packages were overwritten."
    );

    console.log(
      "No Supabase changes were made."
    );
  }

  console.log("");
}

main();