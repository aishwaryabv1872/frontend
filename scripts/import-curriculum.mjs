/**
 * Vertex Curriculum Importer
 *
 * VTU 2022 CSE - Semester 1
 *
 * Imports:
 *   syllabus
 *      └── syllabus_subjects
 *            └── subject_modules
 *                  └── module_topics
 *
 * Safety:
 *   - Never creates a duplicate syllabus
 *   - Never deletes records
 *   - Reuses existing matching subjects/modules/topics
 *   - Fails on identity/content conflicts instead of overwriting
 *   - Does not change syllabus verification_status
 *   - Safe to rerun after interruption
 *
 * Usage:
 *
 *   node scripts/import-curriculum.mjs --dry-run
 *   node scripts/import-curriculum.mjs --apply
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

const SCHEME_FILE = path.join(
  CURRICULUM_DIR,
  "semester-1.json"
);

const SUBJECT_DIR = path.join(
  CURRICULUM_DIR,
  "subjects"
);

// ============================================================
// CONSTANTS
// ============================================================

const EXPECTED_SEMESTER = 1;
const EXPECTED_REGULATION = "2022";
const EXPECTED_BRANCH = "CSE";
const EXPECTED_SUBJECT_COUNT = 31;

// Existing Supabase VTU records discovered during schema
// verification.
const VTU_UNIVERSITY_ID =
  "5a70bfcc-7723-475a-87d0-c888bb0a08dc";

const VTU_ACADEMIC_SCHEME_ID =
  "baf0027e-68a1-49f9-99bc-7acd6d68382c";

const VTU_SYLLABUS_SCHEME_ID =
  "1eb367dd-38da-4c0d-ae99-f99caca87023";

const CSE_BRANCH_ID =
  "910da1b6-0f3d-4c68-b5b6-956bf4a2df1a";

const CSE_PROGRAM_ID =
  "42202568-d96a-4a5e-abe2-0a2aabdf2558";

// Existing syllabus discovered in Supabase.
const EXISTING_SYLLABUS_ID =
  "2fa26dd1-77d4-4487-a1f0-266737da0efd";

// ============================================================
// MODE
// ============================================================

const APPLY_MODE =
  process.argv.includes("--apply");

const DRY_RUN_MODE =
  process.argv.includes("--dry-run") ||
  !APPLY_MODE;

// ============================================================
// STATE
// ============================================================

let warnings = [];
let errors = [];

let subjectsInserted = 0;
let subjectsReused = 0;

let modulesInserted = 0;
let modulesReused = 0;

let topicsInserted = 0;
let topicsReused = 0;

let importRecordCreated = false;

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
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL in .env.local"
  );
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local"
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

function success(message) {
  console.log(`   ✅ ${message}`);
}

function warning(message) {
  warnings.push(message);
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

function listJsonFiles(directory) {
  if (!fileExists(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, {
      withFileTypes: true,
    })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".json")
    )
    .map((entry) => entry.name)
    .sort();
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

function normalizeCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
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
// SCHEME
// ============================================================

function getSchemeCourses(scheme) {
  if (
    !scheme ||
    !Array.isArray(scheme.courses)
  ) {
    throw new Error(
      "semester-1.json does not contain a valid courses array."
    );
  }

  return scheme.courses;
}

function getCourseCode(course) {
  return normalizeCode(
    course?.code ??
      course?.subject_code ??
      course?.course_code
  );
}

function getCourseName(course) {
  return cleanText(
    course?.name ??
      course?.title ??
      course?.subject_name ??
      course?.course_title
  );
}

// ============================================================
// SUBJECT JSON
// ============================================================

function getJsonSubjectCode(subject) {
  return normalizeCode(
    subject?.subject_code ??
      subject?.code
  );
}

function getJsonSubjectName(subject) {
  return cleanText(
    subject?.subject_name ??
      subject?.name ??
      subject?.title
  );
}

function getSubjectCredits(subject) {
  return numberOrNull(
    subject?.credits ??
      subject?.credit
  );
}

function getSubjectType(subject) {
  return cleanText(
    subject?.course_type ??
      subject?.subject_type ??
      "Theory"
  );
}

function getSubjectDescription(subject) {
  return cleanText(
    subject?.description
  ) || null;
}

function getInterviewRelevance(subject) {
  return cleanText(
    subject?.interview_relevance
  ) || null;
}

function getInterviewTopics(subject) {
  if (
    Array.isArray(subject?.interview_topics)
  ) {
    return subject.interview_topics
      .filter(
        (item) =>
          typeof item === "string" &&
          item.trim()
      )
      .map((item) => item.trim());
  }

  return [];
}

function getSourceVerified(subject) {
  if (
    typeof subject?.source_verified ===
    "boolean"
  ) {
    return subject.source_verified;
  }

  // These packages have already gone through the
  // local source-validation workflow.
  return true;
}

// ============================================================
// MODULE PLAN
// ============================================================

function getModules(subject) {
  if (!Array.isArray(subject?.modules)) {
    throw new Error(
      `${getJsonSubjectCode(subject)}: modules must be an array`
    );
  }

  return subject.modules;
}

function getModuleNumber(module, index) {
  const explicit =
    numberOrNull(
      module?.module_number
    );

  return explicit ?? index + 1;
}

function getModuleTitle(module) {
  return cleanText(
    module?.title ??
      module?.name
  );
}

function getModuleDescription(module) {
  return cleanText(
    module?.description
  ) || null;
}

function getModuleHours(module) {
  return numberOrNull(
    module?.hours ??
      module?.estimated_hours
  );
}

// ============================================================
// TOPICS
// ============================================================

function getTopics(module) {
  if (!Array.isArray(module?.topics)) {
    throw new Error(
      `Module ${module?.module_number}: topics must be an array`
    );
  }

  return module.topics;
}

function getTopicNumber(topic, fallbackIndex) {
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

  return fallbackIndex + 1;
}

function getTopicTitle(topic) {
  // Normal topic object:
  // { title: "..." }
  if (
    topic &&
    typeof topic === "object" &&
    !Array.isArray(topic)
  ) {
    return cleanText(
      topic.title ??
        topic.name ??
        topic.topic_title ??
        ""
    );
  }

  // Some extracted VTU packages store topics
  // directly as strings.
  if (typeof topic === "string") {
    return cleanText(topic);
  }

  return "";
}

function getTopicDescription(topic) {
  if (
    topic &&
    typeof topic === "object" &&
    !Array.isArray(topic)
  ) {
    return cleanText(
      topic.description ??
        topic.details ??
        ""
    );
  }

  // String topics have no separate description.
  return "";
}

// ============================================================
// LOAD LOCAL SCHEME
// ============================================================

function loadScheme() {
  section("Checking local scheme");

  if (!fileExists(SCHEME_FILE)) {
    throw new Error(
      `Scheme file not found: ${SCHEME_FILE}`
    );
  }

  const scheme =
    readJson(SCHEME_FILE);

  const regulation =
    String(
      scheme?.scheme?.regulation ??
        scheme?.regulation ??
        ""
    );

  if (
    regulation !== EXPECTED_REGULATION
  ) {
    throw new Error(
      `Expected regulation ${EXPECTED_REGULATION}, found ${regulation}`
    );
  }

  success(
    `Regulation = ${regulation}`
  );

  const semester =
    Number(
      scheme?.semester ??
        scheme?.semester_number
    );

  if (
    semester !== EXPECTED_SEMESTER
  ) {
    throw new Error(
      `Expected semester ${EXPECTED_SEMESTER}, found ${semester}`
    );
  }

  success(
    `Semester = ${semester}`
  );

  const branch =
    normalizeCode(
      scheme?.branch?.code ??
        scheme?.branch_code ??
        ""
    );

  if (
    branch !== EXPECTED_BRANCH
  ) {
    throw new Error(
      `Expected branch ${EXPECTED_BRANCH}, found ${branch}`
    );
  }

  success(
    `Branch = ${branch}`
  );

  const courses =
    getSchemeCourses(scheme);

  if (
    courses.length !==
    EXPECTED_SUBJECT_COUNT
  ) {
    throw new Error(
      `Expected ${EXPECTED_SUBJECT_COUNT} courses, found ${courses.length}`
    );
  }

  success(
    `Scheme contains ${courses.length} courses`
  );

  return scheme;
}

// ============================================================
// LOAD PACKAGES
// ============================================================

function loadPackages(scheme) {
  section("Loading local subject packages");

  const files =
    listJsonFiles(SUBJECT_DIR)
      .filter(
        (file) =>
          file.toUpperCase() !==
          "SCHEME-SEM-1-2.JSON"
      );

  info(
    `JSON files found: ${files.length}`
  );

  const packages = new Map();

  for (const file of files) {
    const filePath =
      path.join(
        SUBJECT_DIR,
        file
      );

    let json;

    try {
      json =
        readJson(filePath);
    } catch (err) {
      throw new Error(
        `${file}: invalid JSON — ${err.message}`
      );
    }

    const code =
      getJsonSubjectCode(json);

    if (!code) {
      throw new Error(
        `${file}: missing subject_code`
      );
    }

    if (
      packages.has(code)
    ) {
      throw new Error(
        `Duplicate local package for ${code}`
      );
    }

    packages.set(
      code,
      {
        filename: file,
        filePath,
        json,
      }
    );
  }

  const schemeCodes =
    getSchemeCourses(scheme)
      .map(getCourseCode);

  for (const code of schemeCodes) {
    if (!packages.has(code)) {
      throw new Error(
        `Missing local subject package: ${code}`
      );
    }
  }

  if (
    packages.size !==
    EXPECTED_SUBJECT_COUNT
  ) {
    throw new Error(
      `Expected ${EXPECTED_SUBJECT_COUNT} subject packages, loaded ${packages.size}`
    );
  }

  success(
    `Loaded ${packages.size} expected subject packages`
  );

  console.log("");
  info(
    `Supabase URL loaded      : YES`
  );
  info(
    `Service-role key loaded  : YES`
  );
  info(
    `Anon key available       : ${
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? "YES"
        : "NO"
    }`
  );

  return packages;
}

// ============================================================
// SUPABASE SYLLABUS
// ============================================================

async function loadSyllabus() {
  section("Checking existing DB syllabus");

  const { data, error } =
    await supabase
      .from("syllabi")
      .select(
        `
          id,
          university_id,
          college_id,
          program_id,
          scheme_id,
          semester,
          title,
          source_type,
          status,
          source_name,
          source_url,
          verification_status,
          branch_id
        `
      )
      .eq(
        "id",
        EXISTING_SYLLABUS_ID
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Could not read syllabus: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      `Expected syllabus ${EXISTING_SYLLABUS_ID} was not found`
    );
  }

  if (
    data.university_id !==
    VTU_UNIVERSITY_ID
  ) {
    throw new Error(
      `Syllabus university_id mismatch`
    );
  }

  if (
    data.program_id !==
    CSE_PROGRAM_ID
  ) {
    throw new Error(
      `Syllabus program_id mismatch`
    );
  }

  if (
    data.branch_id !==
    CSE_BRANCH_ID
  ) {
    throw new Error(
      `Syllabus branch_id mismatch`
    );
  }

  if (
    Number(data.semester) !==
    EXPECTED_SEMESTER
  ) {
    throw new Error(
      `Syllabus semester mismatch`
    );
  }

  if (
    data.scheme_id !==
    VTU_SYLLABUS_SCHEME_ID
  ) {
    throw new Error(
      `Syllabus scheme_id mismatch`
    );
  }

  success(
    `Existing syllabus found: ${data.id}`
  );

  if (
    data.verification_status !==
    "verified"
  ) {
    warning(
      `Syllabus verification_status is "${data.verification_status}"`
    );
  }

  return data;
}

// ============================================================
// EXISTING SUBJECTS
// ============================================================

async function loadExistingSubjects(
  syllabusId
) {
  section("Checking existing DB subjects");

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
        syllabusId
      );

  if (error) {
    throw new Error(
      `Could not read syllabus_subjects: ${error.message}`
    );
  }

  const rows = data ?? [];

  info(
    `Existing subjects: ${rows.length}`
  );

  return rows;
}

// ============================================================
// BUILD PLAN
// ============================================================

function buildPlan(
  scheme,
  packages
) {
  section("Building import plan");

  const courses = getSchemeCourses(scheme);

  const plan = [];

  let moduleCount = 0;
  let topicCount = 0;

  for (const course of courses) {
    const code = getCourseCode(course);

    const packageInfo = packages.get(code);

    if (!packageInfo) {
      throw new Error(`No package found for ${code}`);
    }

    const subject = packageInfo.json;

    const jsonCode = getJsonSubjectCode(subject);

    if (jsonCode !== code) {
      throw new Error(
        `${code}: JSON subject_code mismatch: ${jsonCode}`
      );
    }

    const schemeName = getCourseName(course);
    const subjectName = getJsonSubjectName(subject);

    if (
      schemeName &&
      subjectName &&
      !sameText(schemeName, subjectName)
    ) {
      warning(
        `${code}: local JSON name differs from scheme name: "${subjectName}" vs "${schemeName}"`
      );
    }

    const sourceModules = getModules(subject);
    const modulePlans = [];

    let subjectTopicCount = 0;

    for (
      let moduleIndex = 0;
      moduleIndex < sourceModules.length;
      moduleIndex++
    ) {
      const moduleItem = sourceModules[moduleIndex];

      const moduleNumber = getModuleNumber(
        moduleItem,
        moduleIndex
      );

      const moduleTitle = getModuleTitle(moduleItem);

      if (!moduleTitle) {
        throw new Error(
          `${code}: module ${moduleNumber} has no title`
        );
      }

      const sourceTopics = getTopics(moduleItem);
      const topicPlans = [];

      for (
        let topicIndex = 0;
        topicIndex < sourceTopics.length;
        topicIndex++
      ) {
        const topicItem = sourceTopics[topicIndex];

        const topicNumber = getTopicNumber(
          topicItem,
          topicIndex
        );

        const topicTitle = getTopicTitle(topicItem);

        if (!topicTitle) {
          throw new Error(
            `${code}: module ${moduleNumber}, topic ${topicNumber} has no title`
          );
        }

        topicPlans.push({
          source: topicItem,
          topic_number: topicNumber,
          title: topicTitle,
          description: getTopicDescription(topicItem),
        });

        topicCount++;
        subjectTopicCount++;
      }

      modulePlans.push({
        source: moduleItem,
        module_number: moduleNumber,
        title: moduleTitle,
        description: getModuleDescription(moduleItem),
        estimated_hours: getModuleHours(moduleItem),
        topics: topicPlans,
      });

      moduleCount++;
    }

    console.log(
      `   ${code}: ${sourceModules.length} modules, ${subjectTopicCount} topics`
    );

    plan.push({
      code,
      schemeCourse: course,
      packageInfo,
      subject,
      subject_name: subjectName,
      credits: getSubjectCredits(subject),
      subject_type: getSubjectType(subject),
      description: getSubjectDescription(subject),
      interview_relevance: getInterviewRelevance(subject),
      interview_topics: getInterviewTopics(subject),
      source_verified: getSourceVerified(subject),
      modules: modulePlans,
    });
  }

  info(`Subjects planned : ${plan.length}`);
  info(`Modules planned  : ${moduleCount}`);
  info(`Topics planned   : ${topicCount}`);

  return {
    subjects: plan,
    moduleCount,
    topicCount,
  };
}

// ============================================================
// EXISTING SUBJECT LOOKUP
// ============================================================

async function findExistingSubject(
  syllabusId,
  subjectCode
) {
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
        syllabusId
      )
      .eq(
        "subject_code",
        subjectCode
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Subject lookup ${subjectCode}: ${error.message}`
    );
  }

  return data;
}

// ============================================================
// INSERT / REUSE SUBJECT
// ============================================================

async function ensureSubject(
  syllabusId,
  subjectPlan
) {
  const existing =
    await findExistingSubject(
      syllabusId,
      subjectPlan.code
    );

  if (existing) {
    if (
      !sameText(
        existing.subject_name,
        subjectPlan.subject_name
      )
    ) {
      throw new Error(
        `${subjectPlan.code}: existing DB subject name conflicts with local JSON: "${existing.subject_name}" vs "${subjectPlan.subject_name}"`
      );
    }

    if (
      subjectPlan.credits !== null &&
      Number(existing.credits) !==
        Number(subjectPlan.credits)
    ) {
      throw new Error(
        `${subjectPlan.code}: existing DB credits conflict with local JSON`
      );
    }

    subjectsReused++;

    return existing.id;
  }

  if (DRY_RUN_MODE) {
    return `DRY-RUN-SUBJECT-${subjectPlan.code}`;
  }

  const payload = {
    syllabus_id: syllabusId,
    subject_name:
      subjectPlan.subject_name,
    subject_code:
      subjectPlan.code,
    credits:
      subjectPlan.credits,
    subject_type:
      subjectPlan.subject_type,
    description:
      subjectPlan.description,
    interview_relevance:
      subjectPlan.interview_relevance,
    interview_topics:
      subjectPlan.interview_topics,
    source_verified:
      subjectPlan.source_verified,
  };

  const { data, error } =
    await supabase
      .from("syllabus_subjects")
      .insert(payload)
      .select("id")
      .single();

  if (error) {
    throw new Error(
      `Insert subject ${subjectPlan.code}: ${error.message}`
    );
  }

  subjectsInserted++;

  return data.id;
}

// ============================================================
// FIND EXISTING MODULE
// ============================================================

async function findExistingModule(
  subjectId,
  moduleNumber
) {
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
      .eq(
        "module_number",
        moduleNumber
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Module lookup ${moduleNumber}: ${error.message}`
    );
  }

  return data;
}

// ============================================================
// INSERT / REUSE MODULE
// ============================================================

async function ensureModule(
  subjectId,
  modulePlan,
  subjectCode
) {
  if (DRY_RUN_MODE) {
    return `DRY-RUN-MODULE-${subjectCode}-${modulePlan.module_number}`;
  }

  const existing =
    await findExistingModule(
      subjectId,
      modulePlan.module_number
    );

  if (existing) {
    if (
      !sameText(
        existing.title,
        modulePlan.title
      )
    ) {
      throw new Error(
        `${subjectCode} Module ${modulePlan.module_number}: existing title conflicts: "${existing.title}" vs "${modulePlan.title}"`
      );
    }

    modulesReused++;

    return existing.id;
  }

  const payload = {
    subject_id: subjectId,
    title:
      modulePlan.title,
    description:
      modulePlan.description,
    module_number:
      modulePlan.module_number,
    estimated_hours:
      modulePlan.estimated_hours,
  };

  const { data, error } =
    await supabase
      .from("subject_modules")
      .insert(payload)
      .select("id")
      .single();

  if (error) {
    throw new Error(
      `Insert ${subjectCode} Module ${modulePlan.module_number}: ${error.message}`
    );
  }

  modulesInserted++;

  return data.id;
}

// ============================================================
// FIND EXISTING TOPIC
// ============================================================

async function findExistingTopic(
  moduleId,
  topicNumber
) {
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
      .eq(
        "topic_number",
        topicNumber
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Topic lookup ${topicNumber}: ${error.message}`
    );
  }

  return data;
}

// ============================================================
// INSERT / REUSE TOPIC
// ============================================================

async function ensureTopic(
  moduleId,
  topicPlan,
  subjectCode,
  moduleNumber
) {
  if (DRY_RUN_MODE) {
    return;
  }

  const existing =
    await findExistingTopic(
      moduleId,
      topicPlan.topic_number
    );

  if (existing) {
    if (
      !sameText(
        existing.title,
        topicPlan.title
      )
    ) {
      throw new Error(
        `${subjectCode} Module ${moduleNumber} Topic ${topicPlan.topic_number}: existing title conflicts: "${existing.title}" vs "${topicPlan.title}"`
      );
    }

    topicsReused++;

    return;
  }

  const payload = {
    module_id:
      moduleId,
    title:
      topicPlan.title,
    description:
      topicPlan.description,
    topic_number:
      topicPlan.topic_number,
  };

  const { error } =
    await supabase
      .from("module_topics")
      .insert(payload);

  if (error) {
    throw new Error(
      `Insert ${subjectCode} Module ${moduleNumber} Topic ${topicPlan.topic_number}: ${error.message}`
    );
  }

  topicsInserted++;
}

// ============================================================
// APPLY IMPORT
// ============================================================

async function applyImport(
  syllabus,
  plan
) {
  section("APPLY MODE");

  info(
    "Importing subjects → modules → topics"
  );

  for (
    let subjectIndex = 0;
    subjectIndex < plan.subjects.length;
    subjectIndex++
  ) {
    const subjectPlan =
      plan.subjects[subjectIndex];

    console.log(
      `\n[${subjectIndex + 1}/${plan.subjects.length}] ${subjectPlan.code} — ${subjectPlan.subject_name}`
    );

    const subjectId =
      await ensureSubject(
        syllabus.id,
        subjectPlan
      );

    if (DRY_RUN_MODE) {
      continue;
    }

    for (
      const modulePlan of
      subjectPlan.modules
    ) {
      const moduleId =
        await ensureModule(
          subjectId,
          modulePlan,
          subjectPlan.code
        );

      for (
        const topicPlan of
        modulePlan.topics
      ) {
        await ensureTopic(
          moduleId,
          topicPlan,
          subjectPlan.code,
          modulePlan.module_number
        );
      }
    }
  }

  success(
    "Nested curriculum import completed"
  );
}

// ============================================================
// VERIFY COUNTS
// ============================================================

async function verifyCounts(
  syllabusId,
  expectedSubjects,
  expectedModules,
  expectedTopics
) {
  section("Verifying Supabase counts");

  const {
    count: subjectCount,
    error: subjectError,
  } = await supabase
    .from("syllabus_subjects")
    .select(
      "id",
      {
        count: "exact",
        head: true,
      }
    )
    .eq(
      "syllabus_id",
      syllabusId
    );

  if (subjectError) {
    throw new Error(
      `Subject count verification failed: ${subjectError.message}`
    );
  }

  const { data: subjects, error } =
    await supabase
      .from("syllabus_subjects")
      .select("id")
      .eq(
        "syllabus_id",
        syllabusId
      );

  if (error) {
    throw new Error(
      `Subject verification failed: ${error.message}`
    );
  }

  const subjectIds =
    (subjects ?? []).map(
      (row) => row.id
    );

  let moduleCount = 0;
  let topicCount = 0;

  if (subjectIds.length > 0) {
    const {
      count,
      error: moduleError,
    } = await supabase
      .from("subject_modules")
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .in(
        "subject_id",
        subjectIds
      );

    if (moduleError) {
      throw new Error(
        `Module count verification failed: ${moduleError.message}`
      );
    }

    moduleCount =
      count ?? 0;

    const {
      data: modules,
      error: modulesError,
    } = await supabase
      .from("subject_modules")
      .select("id")
      .in(
        "subject_id",
        subjectIds
      );

    if (modulesError) {
      throw new Error(
        `Module verification failed: ${modulesError.message}`
      );
    }

    const moduleIds =
      (modules ?? []).map(
        (row) => row.id
      );

    if (moduleIds.length > 0) {
      const {
        count: topics,
        error: topicError,
      } = await supabase
        .from("module_topics")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .in(
          "module_id",
          moduleIds
        );

      if (topicError) {
        throw new Error(
          `Topic count verification failed: ${topicError.message}`
        );
      }

      topicCount =
        topics ?? 0;
    }
  }

  console.log(
    `   Subjects in DB : ${subjectCount ?? 0} / ${expectedSubjects}`
  );

  console.log(
    `   Modules in DB  : ${moduleCount} / ${expectedModules}`
  );

  console.log(
    `   Topics in DB   : ${topicCount} / ${expectedTopics}`
  );

  if (
    Number(subjectCount) !==
    expectedSubjects
  ) {
    throw new Error(
      `Subject count mismatch: expected ${expectedSubjects}, found ${subjectCount}`
    );
  }

  if (
    moduleCount !== expectedModules
  ) {
    throw new Error(
      `Module count mismatch: expected ${expectedModules}, found ${moduleCount}`
    );
  }

  if (
    topicCount !== expectedTopics
  ) {
    throw new Error(
      `Topic count mismatch: expected ${expectedTopics}, found ${topicCount}`
    );
  }

  success(
    "All database counts match the local curriculum package"
  );
}

// ============================================================
// CURRICULUM IMPORT RECORD
// ============================================================

async function createImportRecord(
  syllabus,
  subjectCount
) {
  section("Recording curriculum import");

  const payload = {
    university_id:
      VTU_UNIVERSITY_ID,

    scheme_id:
      VTU_ACADEMIC_SCHEME_ID,

    branch_id:
      CSE_BRANCH_ID,

    semester_number:
      EXPECTED_SEMESTER,

    source_name:
      syllabus.source_name ||
      "VTU / VTUCircle",

    source_url:
      syllabus.source_url ||
      null,

    status:
      "imported",

    subject_count:
      subjectCount,

    imported_at:
      new Date().toISOString(),

    verified_at:
      null,

    error_message:
      null,
  };

  const { error } =
    await supabase
      .from("curriculum_imports")
      .insert(payload);

  if (error) {
    throw new Error(
      `Could not create curriculum_imports record: ${error.message}`
    );
  }

  importRecordCreated = true;

  success(
    "curriculum_imports record created"
  );
}

// ============================================================
// SUMMARY
// ============================================================

function printSummary(
  plan
) {
  section("Import Summary");

  info(
    `Local scheme courses : ${EXPECTED_SUBJECT_COUNT}`
  );

  info(
    `Local JSON packages  : ${plan.subjects.length}`
  );

  info(
    `Planned modules      : ${plan.moduleCount}`
  );

  info(
    `Planned topics       : ${plan.topicCount}`
  );

  if (!DRY_RUN_MODE) {
    console.log("");
    info(
      `Subjects inserted    : ${subjectsInserted}`
    );

    info(
      `Subjects reused      : ${subjectsReused}`
    );

    info(
      `Modules inserted     : ${modulesInserted}`
    );

    info(
      `Modules reused       : ${modulesReused}`
    );

    info(
      `Topics inserted      : ${topicsInserted}`
    );

    info(
      `Topics reused        : ${topicsReused}`
    );

    info(
      `Import record        : ${
        importRecordCreated
          ? "created"
          : "not created"
      }`
    );
  }

  info(
    `Errors               : ${errors.length}`
  );

  info(
    `Warnings             : ${warnings.length}`
  );
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(
    "========================================"
  );

  console.log(
    " Vertex Curriculum Importer"
  );

  console.log(
    " VTU 2022 CSE - Semester 1"
  );

  console.log(
    "========================================"
  );

  console.log("");

  if (DRY_RUN_MODE) {
    console.log(
      "MODE: DRY RUN — READ ONLY"
    );
  } else {
    console.log(
      "MODE: APPLY"
    );
  }

  console.log("");

  try {
    const scheme =
      loadScheme();

    const packages =
      loadPackages(scheme);

    const syllabus =
      await loadSyllabus();

    await loadExistingSubjects(
      syllabus.id
    );

    const plan =
      buildPlan(
        scheme,
        packages
      );

    printSummary(plan);

    if (DRY_RUN_MODE) {
      section("DRY RUN RESULT");

      console.log(
        "🎉 DRY RUN PASSED"
      );

      console.log("");
      console.log(
        "No Supabase data was modified."
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

      return;
    }

    await applyImport(
      syllabus,
      plan
    );

    await verifyCounts(
      syllabus.id,
      plan.subjects.length,
      plan.moduleCount,
      plan.topicCount
    );

    await createImportRecord(
      syllabus,
      plan.subjects.length
    );

    printSummary(plan);

    section("FINAL RESULT");

    if (errors.length === 0) {
      console.log(
        "🎉 CURRICULUM IMPORT COMPLETED"
      );

      console.log("");
      console.log(
        `Subjects : ${plan.subjects.length}`
      );

      console.log(
        `Modules  : ${plan.moduleCount}`
      );

      console.log(
        `Topics   : ${plan.topicCount}`
      );

      console.log("");
      console.log(
        "VTU 2022 CSE Semester 1 is now imported."
      );

      console.log(
        "Syllabus verification_status was not modified."
      );
    }
  } catch (err) {
    console.log("");
    console.log(
      "========================================"
    );

    console.log(
      "❌ APPLY FAILED"
    );

    console.log(
      "========================================"
    );

    console.log("");

    console.log(
      err?.message ??
        String(err)
    );

    console.log("");

    console.log(
      "The importer is safe to rerun."
    );

    console.log(
      "Existing matching records are reused."
    );

    console.log(
      "Conflicting records are never overwritten."
    );

    process.exitCode = 1;
  }
}

main();