
/**
 * Vertex — Targeted Curriculum DB Repair
 *
 * VTU 2022 CSE Semester 1
 *
 * SAFETY:
 * - Explicit allowlist only
 * - Updates subject_modules.title only
 * - Never inserts/deletes records
 * - Never modifies topics
 * - Never modifies syllabus verification_status
 * - Refuses to update if DB title is not the expected stale value
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// ENV
// ============================================================

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env.local: ${envPath}`);
  }

  const text = fs.readFileSync(envPath, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      value.startsWith('"') &&
      value.endsWith('"')
    ) {
      value = value.slice(1, -1);
    }

    if (
      value.startsWith("'") &&
      value.endsWith("'")
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is missing from .env.local"
  );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local"
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ============================================================
// CONSTANTS
// ============================================================

const SYLLABUS_ID =
  "2fa26dd1-77d4-4487-a1f0-266737da0efd";

const CURRICULUM_DIR = path.join(
  process.cwd(),
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
// STRICT ALLOWLIST
// ============================================================

const REPAIRS = {
  BENGK106: [
    {
      module_number: 1,
      expected_db_title: "(03 hours of pedagogy)",
    },
    {
      module_number: 2,
      expected_db_title: "(03 hours of pedagogy)",
    },
    {
      module_number: 3,
      expected_db_title: "(03 hours of pedagogy)",
    },
    {
      module_number: 4,
      expected_db_title: "(03 hours of pedagogy)",
    },
    {
      module_number: 5,
      expected_db_title: "(03 hours of pedagogy)",
    },
  ],

  BICOK107: [
    {
      module_number: 1,
      expected_db_title: "(03 hours of pedagogy)",
    },
    {
      module_number: 2,
      expected_db_title: "(03 hours of pedagogy)",
    },
    {
      module_number: 3,
      expected_db_title: "(03 hours of pedagogy)",
    },
    {
      module_number: 4,
      expected_db_title: "(03 hours of pedagogy)",
    },
    {
      module_number: 5,
      expected_db_title: "(03 hours of pedagogy)",
    },
  ],

  BETCK105H: [
    {
      module_number: 1,
      expected_db_title: "(8 hours of pedagogy)",
    },
    {
      module_number: 2,
      expected_db_title: "(8 hours of pedagogy)",
    },
    {
      module_number: 3,
      expected_db_title: "( 8 hours of pedagogy)",
    },
    {
      module_number: 4,
      expected_db_title: "( 8 ours of pedagogy)",
    },
    {
      module_number: 5,
      expected_db_title: "(8 hours of pedagogy)",
    },
  ],

  BETCK105I: [
    {
      module_number: 1,
      expected_db_title: "(8 hours of pedagogy)",
    },
    {
      module_number: 2,
      expected_db_title: "(8 hours of pedagogy)",
    },
    {
      module_number: 3,
      expected_db_title: "( 8 hours of pedagogy)",
    },
    {
      module_number: 4,
      expected_db_title: "( 8 ours of pedagogy)",
    },
    {
      module_number: 5,
      expected_db_title: "(8 hours of pedagogy)",
    },
  ],
};

// ============================================================
// HELPERS
// ============================================================

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

function getLocalModule(subject, moduleNumber) {
  if (!Array.isArray(subject.modules)) {
    throw new Error(
      `${subject.subject_code}: modules is not an array`
    );
  }

  const localModule = subject.modules.find(
    (item) =>
      Number(item?.module_number) === moduleNumber
  );

  if (!localModule) {
    throw new Error(
      `${subject.subject_code}: local module ${moduleNumber} not found`
    );
  }

  const title = String(
    localModule.title ?? ""
  ).trim();

  if (!title) {
    throw new Error(
      `${subject.subject_code}: local module ${moduleNumber} has empty title`
    );
  }

  return title;
}

function assertExactTitle(
  actual,
  expected,
  label
) {
  if (actual !== expected) {
    throw new Error(
      `${label}: safety check failed.\n` +
      `Expected DB title:\n` +
      `  "${expected}"\n` +
      `Actual DB title:\n` +
      `  "${actual}"\n` +
      `REFUSING TO UPDATE.`
    );
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
    " Vertex — Targeted Curriculum DB Repair"
  );
  console.log(
    " VTU 2022 CSE Semester 1"
  );
  console.log(
    "========================================================================"
  );

  console.log("");
  console.log("SAFETY MODE");
  console.log("");
  console.log(
    "Only subject_modules.title will be updated."
  );
  console.log(
    "No subjects, topics, syllabi, or verification status will be modified."
  );
  console.log("");

  const subjectCodes =
    Object.keys(REPAIRS);

  console.log("ALLOWLIST");
  console.log("");

  for (const code of subjectCodes) {
    console.log(`   • ${code}`);
  }

  console.log("");

  let updated = 0;

  for (const code of subjectCodes) {
    console.log("");
    console.log(
      `---------------- ${code} ----------------`
    );

    const jsonPath = path.join(
      SUBJECT_DIR,
      `${code}.json`
    );

    if (!fs.existsSync(jsonPath)) {
      throw new Error(
        `Local JSON missing: ${jsonPath}`
      );
    }

    const subject = readJson(jsonPath);

    if (
      String(subject.subject_code ?? "")
        .trim()
        .toUpperCase() !== code
    ) {
      throw new Error(
        `${code}: local subject_code mismatch`
      );
    }

    // --------------------------------------------------------
    // Find subject
    // --------------------------------------------------------

    const {
      data: dbSubject,
      error: subjectError,
    } = await supabase
      .from("syllabus_subjects")
      .select(
        "id, syllabus_id, subject_code, subject_name"
      )
      .eq("syllabus_id", SYLLABUS_ID)
      .eq("subject_code", code)
      .maybeSingle();

    if (subjectError) {
      throw new Error(
        `${code}: subject lookup failed: ${subjectError.message}`
      );
    }

    if (!dbSubject) {
      throw new Error(
        `${code}: DB subject not found`
      );
    }

    console.log(
      `   Subject ID: ${dbSubject.id}`
    );

    // --------------------------------------------------------
    // Find modules
    // --------------------------------------------------------

    const {
      data: dbModules,
      error: moduleError,
    } = await supabase
      .from("subject_modules")
      .select(
        "id, module_number, title"
      )
      .eq("subject_id", dbSubject.id)
      .order("module_number", {
        ascending: true,
      });

    if (moduleError) {
      throw new Error(
        `${code}: module lookup failed: ${moduleError.message}`
      );
    }

    if (!Array.isArray(dbModules)) {
      throw new Error(
        `${code}: invalid module response`
      );
    }

    if (dbModules.length !== 5) {
      throw new Error(
        `${code}: expected exactly 5 DB modules, found ${dbModules.length}`
      );
    }

    // --------------------------------------------------------
    // Apply only exact allowlisted repairs
    // --------------------------------------------------------

    for (const repair of REPAIRS[code]) {
      const dbModule = dbModules.find(
        (item) =>
          Number(item.module_number) ===
          repair.module_number
      );

      if (!dbModule) {
        throw new Error(
          `${code}: DB module ${repair.module_number} not found`
        );
      }

      const localTitle =
        getLocalModule(
          subject,
          repair.module_number
        );

      console.log("");
      console.log(
        `   Module ${repair.module_number}`
      );
      console.log(
        `   DB current : "${dbModule.title}"`
      );
      console.log(
        `   Local      : "${localTitle}"`
      );

      // Critical safety check.
      assertExactTitle(
        dbModule.title,
        repair.expected_db_title,
        `${code} Module ${repair.module_number}`
      );

      if (
        dbModule.title === localTitle
      ) {
        console.log(
          "   ✓ Already matches. No update needed."
        );
        continue;
      }

      const {
        data: updatedRows,
        error: updateError,
      } = await supabase
        .from("subject_modules")
        .update({
          title: localTitle,
        })
        .eq("id", dbModule.id)
        .eq(
          "title",
          repair.expected_db_title
        )
        .select(
          "id, module_number, title"
        );

      if (updateError) {
        throw new Error(
          `${code} Module ${repair.module_number}: update failed: ${updateError.message}`
        );
      }

      if (
        !Array.isArray(updatedRows) ||
        updatedRows.length !== 1
      ) {
        throw new Error(
          `${code} Module ${repair.module_number}: safety update affected ${updatedRows?.length ?? 0} rows; expected exactly 1`
        );
      }

      console.log(
        `   ✓ Updated title successfully.`
      );

      updated++;
    }
  }

  // ==========================================================
  // FINAL VERIFICATION
  // ==========================================================

  console.log("");
  console.log(
    "========================================================================"
  );
  console.log(" FINAL VERIFICATION");
  console.log(
    "========================================================================"
  );

  for (const code of subjectCodes) {
    const {
      data: dbSubject,
      error: subjectError,
    } = await supabase
      .from("syllabus_subjects")
      .select("id")
      .eq("syllabus_id", SYLLABUS_ID)
      .eq("subject_code", code)
      .maybeSingle();

    if (subjectError) {
      throw new Error(
        `${code}: final subject lookup failed: ${subjectError.message}`
      );
    }

    if (!dbSubject) {
      throw new Error(
        `${code}: final subject not found`
      );
    }

    const {
      data: modules,
      error: moduleError,
    } = await supabase
      .from("subject_modules")
      .select(
        "id, module_number, title"
      )
      .eq("subject_id", dbSubject.id)
      .order("module_number", {
        ascending: true,
      });

    if (moduleError) {
      throw new Error(
        `${code}: final module lookup failed: ${moduleError.message}`
      );
    }

    const localSubject = readJson(
      path.join(
        SUBJECT_DIR,
        `${code}.json`
      )
    );

    for (const repair of REPAIRS[code]) {
      const dbModule = modules.find(
        (module) =>
          Number(module.module_number) ===
          repair.module_number
      );

      const localTitle =
        getLocalModule(
          localSubject,
          repair.module_number
        );

      if (
        !dbModule ||
        dbModule.title !== localTitle
      ) {
        throw new Error(
          `${code} Module ${repair.module_number}: FINAL VERIFICATION FAILED`
        );
      }
    }

    console.log(
      `   ✓ ${code}: all 5 module titles match local JSON`
    );
  }

  console.log("");
  console.log(
    `Updated module titles: ${updated}`
  );
  console.log("");
  console.log(
    "✅ TARGETED CURRICULUM REPAIR COMPLETED"
  );
  console.log("");
  console.log(
    "Only subject_modules.title was modified."
  );
  console.log(
    "No subjects were inserted."
  );
  console.log(
    "No modules were inserted."
  );
  console.log(
    "No topics were modified."
  );
  console.log(
    "No syllabus verification status was modified."
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "❌ TARGETED REPAIR FAILED / REFUSED"
  );
  console.error("");
  console.error(error.message);
  console.error("");
  process.exitCode = 1;
});
