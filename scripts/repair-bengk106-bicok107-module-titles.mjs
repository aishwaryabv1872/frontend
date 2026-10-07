import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SUBJECT_DIR = path.join(
  process.cwd(),
  "data",
  "curriculum",
  "vtu-2022",
  "CSE",
  "subjects"
);

const DRY_RUN = process.argv.includes("--dry-run");

const REPAIRS = {
  BENGK106: [
    "Introduction to Communicative English",
    "Introduction to Phonetics",
    "Basic English Communicative Grammar and Vocabulary PART - I",
    "Basic English Communicative Grammar and Vocabulary PART - II",
    "Communication Skills for Employment"
  ],

  BICOK107: [
    "Indian Constitution",
    "Salient features of India Constitution",
    "Directive Principles of State Policy (DPSP’s) and its present relevance in Indian society",
    "Parliament - LS and RS, Parliamentary Committees, Important Parliamentary Terminologies",
    "State Executive and Governer, CM, State Cabinet, Legislature - VS & VP, Election Commission, Elections & Electoral Process"
  ]
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
}

let changes = 0;
let errors = 0;

console.log("============================================================");
console.log(" Vertex — Targeted Module Title Repair");
console.log(" BENGK106 + BICOK107");
console.log("============================================================");
console.log("");

console.log(
  DRY_RUN
    ? "Mode: DRY RUN — NO FILES WILL BE MODIFIED"
    : "Mode: APPLY — ONLY 10 MODULE TITLES WILL CHANGE"
);

console.log("");

for (const [code, titles] of Object.entries(REPAIRS)) {
  const file = path.join(SUBJECT_DIR, `${code}.json`);

  if (!fs.existsSync(file)) {
    console.log(`❌ ${code}: file not found`);
    errors++;
    continue;
  }

  let subject;

  try {
    subject = readJson(file);
  } catch (err) {
    console.log(`❌ ${code}: invalid JSON — ${err.message}`);
    errors++;
    continue;
  }

  if (!Array.isArray(subject.modules)) {
    console.log(`❌ ${code}: modules is not an array`);
    errors++;
    continue;
  }

  if (subject.modules.length !== 5) {
    console.log(
      `❌ ${code}: expected exactly 5 modules, found ${subject.modules.length}`
    );
    errors++;
    continue;
  }

  console.log(`--- ${code} ---`);

  titles.forEach((newTitle, index) => {
    const module = subject.modules[index];

    if (!module || typeof module !== "object") {
      console.log(`❌ Module ${index + 1}: invalid module`);
      errors++;
      return;
    }

    const oldTitle = String(module.title ?? "").trim();

    if (oldTitle === newTitle) {
      console.log(
        `✓ Module ${index + 1}: already correct`
      );
      return;
    }

    console.log(`Module ${index + 1}:`);
    console.log(`  OLD: ${oldTitle}`);
    console.log(`  NEW: ${newTitle}`);

    if (!DRY_RUN) {
      module.title = newTitle;
    }

    changes++;
  });

  if (!DRY_RUN) {
    writeJson(file, subject);
  }

  console.log("");
}

console.log("============================================================");
console.log(
  `Changes ${DRY_RUN ? "planned" : "applied"}: ${changes}`
);
console.log(`Errors: ${errors}`);
console.log("============================================================");

if (errors > 0) {
  console.log("❌ TARGETED REPAIR FAILED");
  process.exitCode = 1;
} else if (DRY_RUN) {
  console.log(
    "✅ DRY RUN PASSED — no files were modified."
  );
} else {
  console.log(
    "✅ REPAIR COMPLETED — only BENGK106/BICOK107 module titles changed."
  );
}
