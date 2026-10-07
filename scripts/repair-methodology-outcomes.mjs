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

const TARGETS = [
  "BESCK104A.json",
  "BETCK105A.json",
];

const METHODOLOGY_PATTERNS = [
  /lecture method/i,
  /traditional lecture/i,
  /teaching method/i,
  /arrange visits/i,
  /show video/i,
  /animation films/i,
  /collaborative.*learning/i,
  /group.*learning/i,
  /higher-order thinking/i,
  /\bHOT\b/i,
  /problem based learning/i,
  /\bPBL\b/i,
  /teaching-learning/i,
  /innovative pedagogy/i,
  /multiple representations/i,
  /encourage.*solve/i,
  /real world/i,
];

function isTeachingMethodologyOutcome(value) {
  if (typeof value !== "string") return false;

  const text = value.trim();

  if (!text) return false;

  return METHODOLOGY_PATTERNS.some((pattern) => pattern.test(text));
}

function backupFile(filePath) {
  const backupPath = `${filePath}.before-methodology-repair`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`   Backup created: ${path.basename(backupPath)}`);
  } else {
    console.log(`   Backup already exists: ${path.basename(backupPath)}`);
  }
}

function repairFile(fileName) {
  const filePath = path.join(SUBJECTS_DIR, fileName);

  console.log("\n" + "=".repeat(72));
  console.log(`REPAIRING: ${fileName}`);
  console.log("=".repeat(72));

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`❌ Invalid JSON: ${error.message}`);
    return false;
  }

  if (!Array.isArray(data.course_outcomes)) {
    console.log("⚠️ course_outcomes is not an array. Nothing to repair.");
    return true;
  }

  const original = data.course_outcomes;

  console.log(`Original course outcomes: ${original.length}`);

  const methodologyOutcomes = original.filter(
    isTeachingMethodologyOutcome
  );

  const realOutcomes = original.filter(
    (outcome) => !isTeachingMethodologyOutcome(outcome)
  );

  console.log(
    `Teaching/pedagogy entries detected: ${methodologyOutcomes.length}`
  );

  console.log(`Potential real CO entries: ${realOutcomes.length}`);

  for (const outcome of methodologyOutcomes) {
    console.log(`   ❌ Removed methodology entry:`);
    console.log(`      ${outcome}`);
  }

  /*
   * IMPORTANT:
   *
   * We do NOT invent course outcomes.
   *
   * If all extracted entries are teaching methodology,
   * the normalized package must contain an empty CO array.
   */
  if (realOutcomes.length === 0) {
    backupFile(filePath);

    data.course_outcomes = [];

    fs.writeFileSync(
      filePath,
      JSON.stringify(data, null, 2) + "\n",
      "utf8"
    );

    console.log(
      "✅ All extracted entries were teaching methodology."
    );
    console.log(
      "✅ course_outcomes normalized to [] without inventing data."
    );

    return true;
  }

  /*
   * If some genuine outcomes exist, preserve only those.
   */
  backupFile(filePath);

  data.course_outcomes = realOutcomes;

  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );

  console.log(
    `✅ Preserved ${realOutcomes.length} non-methodology outcome(s).`
  );

  return true;
}

function main() {
  console.log(`
Vertex — VTU Course Outcome Methodology Repair
READ/REPAIR MODE
`);

  console.log(`Subjects directory: ${SUBJECTS_DIR}`);

  if (!fs.existsSync(SUBJECTS_DIR)) {
    console.error("❌ Subjects directory does not exist.");
    process.exitCode = 1;
    return;
  }

  let success = 0;
  let failed = 0;

  for (const fileName of TARGETS) {
    if (repairFile(fileName)) {
      success++;
    } else {
      failed++;
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log("REPAIR SUMMARY");
  console.log("=".repeat(72));
  console.log(`Repaired : ${success}`);
  console.log(`Failed   : ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
    console.log("\n❌ Repair completed with failures.");
  } else {
    console.log("\n✅ Methodology contamination repair completed.");
  }
}

main();