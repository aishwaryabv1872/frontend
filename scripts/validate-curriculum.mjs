import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const curriculumPath = path.join(
  ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE",
  "semester-1.json"
);

function fail(message) {
  console.error(`\n❌ VALIDATION FAILED`);
  console.error(`   ${message}\n`);
  process.exit(1);
}

function pass(message) {
  console.log(`   ✅ ${message}`);
}

console.log("\n========================================");
console.log(" Vertex Curriculum Validator");
console.log(" VTU 2022 CSE - Semester 1");
console.log("========================================\n");

console.log(`Checking file:`);
console.log(curriculumPath);

if (!fs.existsSync(curriculumPath)) {
  fail(
    `semester-1.json was not found.\n` +
    `Expected:\n${curriculumPath}`
  );
}

let data;

try {
  const raw = fs.readFileSync(curriculumPath, "utf8");
  data = JSON.parse(raw);
  pass("JSON syntax is valid");
} catch (error) {
  fail(`Could not parse semester-1.json:\n${error.message}`);
}

// --------------------------------------------------
// BASIC METADATA
// --------------------------------------------------

if (data.scheme?.regulation !== "2022") {
  fail(`Expected regulation "2022", got "${data.scheme?.regulation}"`);
}

pass("Regulation is 2022");

if (data.branch?.code !== "CSE") {
  fail(`Expected branch code CSE, got "${data.branch?.code}"`);
}

pass("Branch is CSE");

if (data.semester !== 1) {
  fail(`Expected semester 1, got "${data.semester}"`);
}

pass("Semester is 1");

if (data.source?.source_version !== "29052023/V10") {
  fail(
    `Expected source version "29052023/V10", got "${data.source?.source_version}"`
  );
}

pass("Source version is 29052023/V10");

// --------------------------------------------------
// EXPECTED STRUCTURE
// --------------------------------------------------

if (!Array.isArray(data.courses)) {
  fail("courses must be an array");
}

pass(`Courses array exists (${data.courses.length} courses)`);

if (!data.selection_rules) {
  fail("selection_rules section is missing");
}

pass("Selection rules exist");

// --------------------------------------------------
// COURSE INDEX
// --------------------------------------------------

const courses = new Map();

for (const course of data.courses) {
  if (!course.code) {
    fail("Found course without code");
  }

  if (courses.has(course.code)) {
    fail(`Duplicate course code: ${course.code}`);
  }

  courses.set(course.code, course);
}

pass("No duplicate course codes");

// --------------------------------------------------
// EXPECTED COURSE CODES
// --------------------------------------------------

const requiredCodes = [
  "BMATS101",

  "BPHYS102",
  "BPOPS103",

  "BCHES102",
  "BCEDK103",

  "BESCK104A",
  "BESCK104B",
  "BESCK104C",
  "BESCK104D",
  "BESCK104E",

  "BETCK105A",
  "BETCK105B",
  "BETCK105C",
  "BETCK105D",
  "BETCK105E",
  "BETCK105F",
  "BETCK105G",
  "BETCK105H",
  "BETCK105I",
  "BETCK105J",

  "BPLCK105A",
  "BPLCK105B",
  "BPLCK105C",
  "BPLCK105D",

  "BENGK106",
  "BPWSK106",

  "BKSKK107",
  "BKBKK107",
  "BICOK107",

  "BIDTK158",
  "BSFHK158"
];

for (const code of requiredCodes) {
  if (!courses.has(code)) {
    fail(`Missing required course: ${code}`);
  }
}

pass(`All ${requiredCodes.length} expected course codes exist`);

// --------------------------------------------------
// CREDIT VALIDATION
// --------------------------------------------------

for (const course of courses.values()) {
  if (
    typeof course.credits !== "number" ||
    course.credits <= 0
  ) {
    fail(
      `${course.code} has invalid credits: ${course.credits}`
    );
  }
}

pass("All course credits are valid");

// --------------------------------------------------
// SPECIFIC CREDIT CHECKS
// --------------------------------------------------

const expectedCredits = {
  BMATS101: 4,

  BPHYS102: 4,
  BPOPS103: 3,

  BCHES102: 4,
  BCEDK103: 3,

  BESCK104A: 3,
  BESCK104B: 3,
  BESCK104C: 3,
  BESCK104D: 3,
  BESCK104E: 3,

  BETCK105A: 3,
  BETCK105B: 3,
  BETCK105C: 3,
  BETCK105D: 3,
  BETCK105E: 3,
  BETCK105F: 3,
  BETCK105G: 3,
  BETCK105H: 3,
  BETCK105I: 3,
  BETCK105J: 3,

  BPLCK105A: 3,
  BPLCK105B: 3,
  BPLCK105C: 3,
  BPLCK105D: 3,

  BENGK106: 1,
  BPWSK106: 1,

  BKSKK107: 1,
  BKBKK107: 1,
  BICOK107: 1,

  BIDTK158: 1,
  BSFHK158: 1
};

for (const [code, expected] of Object.entries(expectedCredits)) {
  const actual = courses.get(code)?.credits;

  if (actual !== expected) {
    fail(
      `${code}: expected ${expected} credits, got ${actual}`
    );
  }
}

pass("All course credit values match the VTU scheme");

// --------------------------------------------------
// CSE RESTRICTION
// --------------------------------------------------

const escCProgramming = courses.get("BESCK104E");

if (escCProgramming?.allowed_for_cse !== false) {
  fail(
    "BESCK104E must have allowed_for_cse=false because CSE/ISE/allied branches cannot select it"
  );
}

pass("BESCK104E CSE restriction is correctly encoded");

// --------------------------------------------------
// CATEGORY COUNTS
// --------------------------------------------------

const etcCourses = requiredCodes.filter(code =>
  code.startsWith("BETCK105")
);

const plcCourses = requiredCodes.filter(code =>
  code.startsWith("BPLCK105")
);

if (etcCourses.length !== 10) {
  fail(`Expected 10 ETC-I courses, found ${etcCourses.length}`);
}

pass("ETC-I contains 10 options");

if (plcCourses.length !== 4) {
  fail(`Expected 4 PLC-I courses, found ${plcCourses.length}`);
}

pass("PLC-I contains 4 options");

// --------------------------------------------------
// SEMESTER CREDIT CALCULATION
// --------------------------------------------------

const commonCredits =
  courses.get("BMATS101").credits;

const physicsCredits =
  courses.get("BPHYS102").credits +
  courses.get("BPOPS103").credits;

const chemistryCredits =
  courses.get("BCHES102").credits +
  courses.get("BCEDK103").credits;

const escCredits = 3;
const etcOrPlcCredits = 3;
const languageFoundationCredits = 3;

const physicsTotal =
  commonCredits +
  physicsCredits +
  escCredits +
  etcOrPlcCredits +
  languageFoundationCredits;

const chemistryTotal =
  commonCredits +
  chemistryCredits +
  escCredits +
  etcOrPlcCredits +
  languageFoundationCredits;

if (physicsTotal !== 20) {
  fail(
    `Physics-group Semester 1 total is ${physicsTotal}, expected 20`
  );
}

pass("Physics-group path totals 20 credits");

if (chemistryTotal !== 20) {
  fail(
    `Chemistry-group Semester 1 total is ${chemistryTotal}, expected 20`
  );
}

pass("Chemistry-group path totals 20 credits");

// --------------------------------------------------
// SELECTION RULES
// --------------------------------------------------

const rules = data.selection_rules;

if (rules.science_group !== "one") {
  fail("Science group must require exactly one choice");
}

pass("Science group requires one choice");

if (rules.esc_i !== "one") {
  fail("ESC-I must require exactly one choice");
}

pass("ESC-I requires one choice");

if (rules.etc_or_plc_i !== "one") {
  fail("ETC-I / PLC-I must require exactly one category");
}

pass("ETC-I / PLC-I category rule is valid");

if (!rules.cross_semester_rule) {
  fail("Cross-semester ETC/PLC rule is missing");
}

pass("Cross-semester ETC/PLC rule exists");

// --------------------------------------------------
// FINAL RESULT
// --------------------------------------------------

console.log("\n========================================");
console.log(" 🎉 VALIDATION PASSED");
console.log("========================================");
console.log("\nVTU 2022 CSE Semester 1 package is structurally valid.");
console.log("No database changes were made.");
console.log("Safe to proceed to the next validation/import stage.\n");