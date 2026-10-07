import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const CURRICULUM_DIR = path.join(
  ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE"
);

const SUBJECTS_DIR = path.join(CURRICULUM_DIR, "subjects");

const HIGH_PRIORITY = [
  "BESCK104A",
  "BETCK105A",
  "BKSKK107",
  "BESCK104B",
  "BESCK104D",
  "BETCK105E",
  "BETCK105J",
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const results = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\\/g, "/");
}

const allFiles = walk(CURRICULUM_DIR);

const pdfFiles = allFiles.filter((f) =>
  f.toLowerCase().endsWith(".pdf")
);

const txtFiles = allFiles.filter((f) =>
  f.toLowerCase().endsWith(".txt")
);

console.log("");
console.log("======================================================");
console.log(" Vertex — High Priority Source Inspection");
console.log(" READ-ONLY MODE");
console.log(" No JSON files will be modified.");
console.log(" No Supabase data will be modified.");
console.log("======================================================");
console.log("");

console.log(`Curriculum directory : ${CURRICULUM_DIR}`);
console.log(`PDF files found      : ${pdfFiles.length}`);
console.log(`TXT files found      : ${txtFiles.length}`);
console.log("");

for (const code of HIGH_PRIORITY) {
  console.log("");
  console.log("------------------------------------------------------");
  console.log(`COURSE: ${code}`);
  console.log("------------------------------------------------------");

  const jsonPath = path.join(SUBJECTS_DIR, `${code}.json`);

  if (!fs.existsSync(jsonPath)) {
    console.log("❌ JSON package missing");
    continue;
  }

  const data = loadJson(jsonPath);

  if (!data) {
    console.log("❌ Could not parse JSON");
    continue;
  }

  console.log(`Subject name : ${data.subject_name ?? "—"}`);
  console.log(`Credits      : ${data.credits ?? "—"}`);
  console.log(`Course type  : ${data.course_type ?? "—"}`);

  console.log("");
  console.log("SOURCE METADATA");

  console.log(`Document     : ${data.source?.source_document ?? "—"}`);
  console.log(`URL          : ${data.source?.source_url ?? "—"}`);
  console.log(`Version      : ${data.source?.source_version ?? "—"}`);
  console.log(`Extracted code: ${data.source?.extracted_course_code ?? "—"}`);

  const sourceDocument = normalize(data.source?.source_document);

  console.log("");
  console.log("MATCHING LOCAL SOURCE FILES");

  const matches = allFiles.filter((file) => {
    const normalizedFile = normalize(file);

    return (
      normalizedFile.includes(code.toLowerCase()) ||
      (sourceDocument &&
        path.basename(normalizedFile) === path.basename(sourceDocument))
    );
  });

  if (matches.length === 0) {
    console.log("⚠️ No filename match found.");
  } else {
    for (const file of matches) {
      console.log(`  - ${path.relative(ROOT, file)}`);
    }
  }

  console.log("");
  console.log("COURSE STRUCTURE");

  console.log(`Modules      : ${Array.isArray(data.modules) ? data.modules.length : "—"}`);

  if (Array.isArray(data.modules)) {
    data.modules.forEach((moduleEntry, index) => {
      console.log(
        `  Module ${index + 1}: ` +
        `title="${moduleEntry.title ?? "—"}" ` +
        `hours=${moduleEntry.hours ?? "—"} ` +
        `topics=${Array.isArray(moduleEntry.topics) ? moduleEntry.topics.length : "—"}`
      );
    });
  }

  console.log("");
  console.log(
    `Course outcomes: ${
      Array.isArray(data.course_outcomes)
        ? data.course_outcomes.length
        : "—"
    }`
  );

  if (Array.isArray(data.course_outcomes)) {
    data.course_outcomes.slice(0, 12).forEach((co, index) => {
      const text =
        typeof co === "string"
          ? co
          : co?.description ??
            co?.text ??
            JSON.stringify(co);

      console.log(`  CO ${index + 1}: ${text}`);
    });
  }

  console.log("");
  console.log("POSSIBLE TXT CONTENT");

  const codeTxtFiles = txtFiles.filter((file) => {
    const base = path.basename(file).toLowerCase();
    return base.includes(code.toLowerCase());
  });

  if (codeTxtFiles.length === 0) {
    console.log("  No course-specific TXT file found.");
  } else {
    for (const txtFile of codeTxtFiles) {
      console.log("");
      console.log(`  FILE: ${path.relative(ROOT, txtFile)}`);

      const content = fs.readFileSync(txtFile, "utf8");

      const lines = content.split(/\r?\n/);

      const matches = [];

      for (let i = 0; i < lines.length; i++) {
        if (
          lines[i].toLowerCase().includes(code.toLowerCase())
        ) {
          matches.push(i);
        }
      }

      if (matches.length === 0) {
        console.log("  Course code not found inside TXT.");
        continue;
      }

      for (const lineIndex of matches.slice(0, 5)) {
        const start = Math.max(0, lineIndex - 8);
        const end = Math.min(lines.length, lineIndex + 30);

        console.log("");
        console.log(
          `  ---- lines ${start + 1}-${end} ----`
        );

        for (let i = start; i < end; i++) {
          console.log(
            `${String(i + 1).padStart(5, " ")} | ${lines[i]}`
          );
        }
      }
    }
  }
}

console.log("");
console.log("======================================================");
console.log(" INSPECTION COMPLETE");
console.log("======================================================");
console.log("");
console.log("Next step:");
console.log("Send me the complete output of this command.");
console.log("We will then build the source-driven repair safely.");
console.log("");