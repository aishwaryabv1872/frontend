import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const SUBJECTS_DIR = path.join(
  ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE",
  "subjects"
);

const COURSES = [
  "BESCK104A",
  "BETCK105A",
  "BKSKK107",
  "BESCK104B",
  "BESCK104D",
  "BETCK105E",
  "BETCK105J",
];

function normalizeLine(line) {
  return line
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

/*
 * English module headings:
 *   Module-1 (08 Hrs)
 *   Module 1 (8 hours)
 *   Module-3(8 Hours)
 *
 * Kannada module headings:
 *   ಘಟಕ - 1
 *   ಘಟಕ - 2
 *   ...
 */
function isModuleStart(line) {
  return (
    /^Module[-\s]*[1-5]\b/i.test(line) ||
    /^ಘಟಕ\s*[-–—]?\s*[1-5]\b/.test(line)
  );
}

function isCourseOutcomeStart(line) {
  return (
    /^Course outcome/i.test(line) ||
    /^Course Learning Outcome/i.test(line) ||
    /^Course Outcomes/i.test(line) ||
    /^At the end of the course/i.test(line)
  );
}

function isAssessmentStart(line) {
  return /^Assessment Details/i.test(line);
}

function isTeachingLearningStart(line) {
  return /^Teaching[-\s]*Learning Process/i.test(line);
}

function isSectionBoundary(line) {
  return (
    isCourseOutcomeStart(line) ||
    isAssessmentStart(line) ||
    isTeachingLearningStart(line)
  );
}

console.log("");
console.log("======================================================");
console.log(" Vertex — Priority Source Section Extraction");
console.log(" READ-ONLY MODE");
console.log(" No JSON files will be modified.");
console.log(" No Supabase data will be modified.");
console.log("======================================================");
console.log("");

for (const code of COURSES) {
  const txtPath = path.join(SUBJECTS_DIR, `${code}.txt`);

  console.log("");
  console.log("======================================================");
  console.log(`COURSE: ${code}`);
  console.log("======================================================");

  if (!fs.existsSync(txtPath)) {
    console.log(`❌ TXT source missing: ${txtPath}`);
    continue;
  }

  const raw = fs.readFileSync(txtPath, "utf8");
  const lines = raw.split(/\r?\n/);

  console.log(`Source: ${path.relative(ROOT, txtPath)}`);
  console.log("");

  let currentModule = null;
  let moduleBuffer = [];
  let foundModules = 0;

  function flushModule() {
    if (!currentModule) {
      return;
    }

    console.log("");
    console.log(
      `---------------- ${currentModule.heading} ----------------`
    );

    for (const line of moduleBuffer) {
      console.log(line);
    }

    currentModule = null;
    moduleBuffer = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeLine(lines[i]);

    if (!line) {
      if (currentModule) {
        moduleBuffer.push("");
      }

      continue;
    }

    /*
     * New module detected.
     */
    if (isModuleStart(line)) {
      flushModule();

      currentModule = {
        heading: line,
      };

      moduleBuffer.push(line);
      foundModules++;

      continue;
    }

    /*
     * Teaching-learning / CO / assessment sections
     * are printed separately.
     */
    if (
      currentModule &&
      isSectionBoundary(line)
    ) {
      flushModule();

      console.log("");
      console.log(`>>> ${line}`);

      for (let j = i + 1; j < lines.length; j++) {
        const next = normalizeLine(lines[j]);

        if (
          isModuleStart(next) ||
          isAssessmentStart(next)
        ) {
          break;
        }

        if (next) {
          console.log(next);
        }
      }

      continue;
    }

    if (currentModule) {
      moduleBuffer.push(line);
    }
  }

  flushModule();

  console.log("");
  console.log(`Detected module sections: ${foundModules}`);

  if (foundModules !== 5) {
    console.log(
      `⚠️ Expected 5 modules but detected ${foundModules}.`
    );
  } else {
    console.log("✅ All 5 module sections detected.");
  }
}

console.log("");
console.log("======================================================");
console.log(" EXTRACTION COMPLETE");
console.log("======================================================");
console.log("");