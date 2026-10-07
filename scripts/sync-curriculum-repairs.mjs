/**
 * Vertex Curriculum Repair Sync
 *
 * VTU 2022 CSE - Semester 1
 *
 * PURPOSE:
 *   Compare specifically repaired local JSON packages
 *   against their existing Supabase records.
 *
 * SAFETY:
 *   - READ ONLY by default.
 *   - Only explicitly listed subjects are inspected.
 *   - Never inserts.
 *   - Never deletes.
 *   - Never changes syllabus verification_status.
 *   - Never changes syllabus_subjects.
 *   - Never changes curriculum_imports.
 *
 * This script is intentionally separate from
 * import-curriculum.mjs.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// ENV
// ============================================================

const PROJECT_ROOT = process.cwd();

dotenv.config({
  path: path.join(PROJECT_ROOT, ".env.local"),
});

// ============================================================
// PATHS
// ============================================================

const CURRICULUM_DIR = path.join(
  PROJECT_ROOT,
  "data",
  "curriculum",
  "vtu-2022",
  "CSE"
);

const SUBJECT_DIR = path.join(
  CURRICULUM_DIR,
  "subjects"
);

// ============================================================
// CONSTANTS
// ============================================================

const EXISTING_SYLLABUS_ID =
  "2fa26dd1-77d4-4487-a1f0-266737da0efd";

/**
 * Explicit safety allowlist.
 *
 * DO NOT add other subjects unless we have
 * deliberately reviewed them.
 */
const TARGET_SUBJECTS = [
  "BENGK106",
  "BICOK107",
  "BETCK105H",
  "BETCK105I",
  "BIDTK158",
  "BKSKK107",
];

// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL"
  );
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ============================================================
// OUTPUT
// ============================================================

let differences = 0;
let subjectsChecked = 0;
let modulesChecked = 0;
let topicsChecked = 0;

function section(title) {
  console.log("");
  console.log("========================================");
  console.log(` ${title}`);
  console.log("========================================");
  console.log("");
}

function info(message) {
  console.log(`   ${message}`);
}

function difference(message) {
  differences++;
  console.log(`   ⚠️ ${message}`);
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
  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

// ============================================================
// NORMALIZATION
// ============================================================

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .trim();
}

function normalizeText(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[\u0000-\u001F]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function sameText(a, b) {
  return (
    normalizeText(a) ===
    normalizeText(b)
  );
}

function numberOrNull(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

// ============================================================
// LOCAL JSON
// ============================================================

function loadLocalSubject(code) {
  const filePath = path.join(
    SUBJECT_DIR,
    `${code}.json`
  );

  if (!fileExists(filePath)) {
    throw new Error(
      `Local package not found: ${filePath}`
    );
  }

  const subject = readJson(filePath);

  const actualCode = cleanText(
    subject?.subject_code
  ).toUpperCase();

  if (actualCode !== code) {
    throw new Error(
      `${code}: local JSON subject_code is "${actualCode}"`
    );
  }

  return subject;
}

function getLocalModules(subject) {
  if (!Array.isArray(subject?.modules)) {
    throw new Error(
      `${subject?.subject_code}: modules is not an array`
    );
  }

  return subject.modules;
}

function getLocalModuleNumber(module, index) {
  return (
    numberOrNull(module?.module_number) ??
    index + 1
  );
}

function getLocalModuleTitle(module) {
  return cleanText(
    module?.title ??
      module?.name
  );
}

function getLocalModuleDescription(module) {
  return cleanText(
    module?.description
  );
}

function getLocalModuleHours(module) {
  return numberOrNull(
    module?.hours ??
      module?.estimated_hours
  );
}

function getLocalTopics(module) {
  if (!Array.isArray(module?.topics)) {
    throw new Error(
      `Module ${module?.module_number}: topics is not an array`
    );
  }

  return module.topics;
}

function getLocalTopicNumber(topic, index) {
  if (
    topic &&
    typeof topic === "object" &&
    !Array.isArray(topic)
  ) {
    const value = Number(
      topic.topic_number ??
        topic.number ??
        topic.order
    );

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return index + 1;
}

function getLocalTopicTitle(topic) {
  if (
    topic &&
    typeof topic === "object" &&
    !Array.isArray(topic)
  ) {
    return cleanText(
      topic.title ??
        topic.name ??
        topic.topic_title
    );
  }

  if (typeof topic === "string") {
    return cleanText(topic);
  }

  return "";
}

function getLocalTopicDescription(topic) {
  if (
    topic &&
    typeof topic === "object" &&
    !Array.isArray(topic)
  ) {
    return cleanText(
      topic.description ??
        topic.details
    );
  }

  return "";
}

// ============================================================
// SUPABASE LOOKUPS
// ============================================================

async function findSubject(code) {
  const { data, error } =
    await supabase
      .from("syllabus_subjects")
      .select(
        `
          id,
          syllabus_id,
          subject_name,
          subject_code,
          credits,
          subject_type,
          description,
          interview_relevance,
          interview_topics,
          source_verified
        `
      )
      .eq(
        "syllabus_id",
        EXISTING_SYLLABUS_ID
      )
      .eq(
        "subject_code",
        code
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `${code}: subject lookup failed: ${error.message}`
    );
  }

  return data;
}

async function findModules(subjectId) {
  const { data, error } =
    await supabase
      .from("subject_modules")
      .select(
        `
          id,
          subject_id,
          title,
          description,
          module_number,
          estimated_hours
        `
      )
      .eq(
        "subject_id",
        subjectId
      )
      .order(
        "module_number",
        {
          ascending: true,
        }
      );

  if (error) {
    throw new Error(
      `Module lookup failed: ${error.message}`
    );
  }

  return data ?? [];
}

async function findTopics(moduleId) {
  const { data, error } =
    await supabase
      .from("module_topics")
      .select(
        `
          id,
          module_id,
          title,
          description,
          topic_number
        `
      )
      .eq(
        "module_id",
        moduleId
      )
      .order(
        "topic_number",
        {
          ascending: true,
        }
      );

  if (error) {
    throw new Error(
      `Topic lookup failed: ${error.message}`
    );
  }

  return data ?? [];
}

// ============================================================
// SUBJECT COMPARISON
// ============================================================

function compareSubject(
  code,
  local,
  db
) {
  if (!db) {
    difference(
      `${code}: subject does not exist in Supabase`
    );

    return;
  }

  subjectsChecked++;

  if (
    !sameText(
      local.subject_name,
      db.subject_name
    )
  ) {
    difference(
      `${code}: subject_name differs`
    );

    info(
      `Local: "${local.subject_name}"`
    );

    info(
      `DB   : "${db.subject_name}"`
    );
  }

  if (
    numberOrNull(local.credits) !==
    numberOrNull(db.credits)
  ) {
    difference(
      `${code}: credits differ`
    );

    info(
      `Local: ${local.credits}`
    );

    info(
      `DB   : ${db.credits}`
    );
  }

  if (
    !sameText(
      local.course_type,
      db.subject_type
    )
  ) {
    difference(
      `${code}: course_type / subject_type differs`
    );

    info(
      `Local: "${local.course_type}"`
    );

    info(
      `DB   : "${db.subject_type}"`
    );
  }
}

// ============================================================
// MODULE COMPARISON
// ============================================================

async function compareModules(
  code,
  local,
  db
) {
  const localModules =
    getLocalModules(local);

  const dbModules =
    await findModules(db.id);

  const dbByNumber = new Map(
    dbModules.map(
      (module) => [
        Number(module.module_number),
        module,
      ]
    )
  );

  info(
    `Local modules : ${localModules.length}`
  );

  info(
    `DB modules    : ${dbModules.length}`
  );

  if (
    localModules.length !==
    dbModules.length
  ) {
    difference(
      `${code}: module count differs`
    );
  }

  for (
    let index = 0;
    index < localModules.length;
    index++
  ) {
    const localModule =
      localModules[index];

    const moduleNumber =
      getLocalModuleNumber(
        localModule,
        index
      );

    modulesChecked++;

    const dbModule =
      dbByNumber.get(
        moduleNumber
      );

    if (!dbModule) {
      difference(
        `${code} Module ${moduleNumber}: missing in Supabase`
      );
      continue;
    }

    const localTitle =
      getLocalModuleTitle(
        localModule
      );

    if (
      !sameText(
        localTitle,
        dbModule.title
      )
    ) {
      difference(
        `${code} Module ${moduleNumber}: title differs`
      );

      info(
        `Local: "${localTitle}"`
      );

      info(
        `DB   : "${dbModule.title}"`
      );
    }

    const localDescription =
      getLocalModuleDescription(
        localModule
      );

    if (
      !sameText(
        localDescription,
        dbModule.description
      )
    ) {
      difference(
        `${code} Module ${moduleNumber}: description differs`
      );
    }

    const localHours =
      getLocalModuleHours(
        localModule
      );

    const dbHours =
      numberOrNull(
        dbModule.estimated_hours
      );

    if (
      localHours !== dbHours
    ) {
      difference(
        `${code} Module ${moduleNumber}: estimated_hours differs`
      );

      info(
        `Local: ${localHours}`
      );

      info(
        `DB   : ${dbHours}`
      );
    }

    await compareTopics(
      code,
      moduleNumber,
      localModule,
      dbModule
    );
  }
}

// ============================================================
// TOPIC COMPARISON
// ============================================================

async function compareTopics(
  code,
  moduleNumber,
  localModule,
  dbModule
) {
  const localTopics =
    getLocalTopics(localModule);

  const dbTopics =
    await findTopics(dbModule.id);

  const dbByNumber = new Map(
    dbTopics.map(
      (topic) => [
        Number(topic.topic_number),
        topic,
      ]
    )
  );

  if (
    localTopics.length !==
    dbTopics.length
  ) {
    difference(
      `${code} Module ${moduleNumber}: topic count differs (local=${localTopics.length}, DB=${dbTopics.length})`
    );
  }

  for (
    let index = 0;
    index < localTopics.length;
    index++
  ) {
    const localTopic =
      localTopics[index];

    const topicNumber =
      getLocalTopicNumber(
        localTopic,
        index
      );

    topicsChecked++;

    const dbTopic =
      dbByNumber.get(
        topicNumber
      );

    if (!dbTopic) {
      difference(
        `${code} Module ${moduleNumber} Topic ${topicNumber}: missing in Supabase`
      );
      continue;
    }

    const localTitle =
      getLocalTopicTitle(
        localTopic
      );

    if (
      !sameText(
        localTitle,
        dbTopic.title
      )
    ) {
      difference(
        `${code} Module ${moduleNumber} Topic ${topicNumber}: title differs`
      );

      info(
        `Local: "${localTitle}"`
      );

      info(
        `DB   : "${dbTopic.title}"`
      );
    }

    const localDescription =
      getLocalTopicDescription(
        localTopic
      );

    if (
      !sameText(
        localDescription,
        dbTopic.description
      )
    ) {
      difference(
        `${code} Module ${moduleNumber} Topic ${topicNumber}: description differs`
      );
    }
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(
    "========================================================================"
  );

  console.log(
    " Vertex — Curriculum Repair Comparison"
  );

  console.log(
    " VTU 2022 CSE Semester 1"
  );

  console.log(
    "========================================================================"
  );

  console.log("");
  console.log(
    "READ-ONLY MODE"
  );

  console.log(
    "No Supabase data will be modified."
  );

  console.log(
    "Only explicitly allowlisted subjects are inspected."
  );

  section("Safety Allowlist");

  for (
    const code of TARGET_SUBJECTS
  ) {
    console.log(
      `   • ${code}`
    );
  }

  try {
    section("Comparing Local JSON → Supabase");

    for (
      const code of TARGET_SUBJECTS
    ) {
      console.log("");
      console.log(
        `---------------- ${code} ----------------`
      );

      const local =
        loadLocalSubject(code);

      const db =
        await findSubject(code);

      if (!db) {
        difference(
          `${code}: subject record not found in Supabase`
        );
        continue;
      }

      compareSubject(
        code,
        local,
        db
      );

      await compareModules(
        code,
        local,
        db
      );
    }

    section("Comparison Summary");

    info(
      `Subjects checked : ${subjectsChecked}`
    );

    info(
      `Modules checked  : ${modulesChecked}`
    );

    info(
      `Topics checked   : ${topicsChecked}`
    );

    info(
      `Differences found: ${differences}`
    );

    console.log("");

    if (differences === 0) {
      console.log(
        "✅ LOCAL JSON AND SUPABASE MATCH FOR ALL TARGET SUBJECTS."
      );
    } else {
      console.log(
        "⚠️ DIFFERENCES FOUND."
      );

      console.log("");
      console.log(
        "No database changes were made."
      );

      console.log(
        "Review the differences before applying any repair."
      );
    }

    console.log("");
    console.log(
      "Syllabus verification_status was NOT modified."
    );

    console.log(
      "No subjects were inserted."
    );

    console.log(
      "No modules were inserted."
    );

    console.log(
      "No topics were inserted."
    );
  } catch (error) {
    console.log("");
    console.log(
      "========================================"
    );

    console.log(
      "❌ COMPARISON FAILED"
    );

    console.log(
      "========================================"
    );

    console.log("");

    console.log(
      error?.message ??
        String(error)
    );

    process.exitCode = 1;
  }
}

main();