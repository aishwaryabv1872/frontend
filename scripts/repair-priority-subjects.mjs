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

const APPLY = process.argv.includes("--apply");

const COURSES = [
  "BESCK104A",
  "BETCK105A",
  "BKSKK107",
  "BESCK104B",
  "BESCK104D",
  "BETCK105E",
  "BETCK105J",
];

const REPAIRS = {
  BESCK104A: {
    pedagogy_hours: 50,

    modules: [
      {
        title: "Civil Engineering Disciplines and Building Science",
        hours: 10,
      },
      {
        title: "Societal and Global Impact of Infrastructure",
        hours: 10,
      },
      {
        title: "Analysis of force systems",
        hours: 10,
      },
      {
        title: "Centroid",
        hours: 10,
      },
      {
        title: "Moment of inertia",
        hours: 10,
      },
    ],

    course_outcomes: [
      "Understand the various disciplines of civil engineering",
      "Understand the infrastructure requirement for sustainable development",
      "Compute the resultant and equilibrium of force systems.",
      "Locate the centroid of plane and built-up sections",
      "Compute the moment of inertia of plane and built-up sections.",
    ],
  },

  BETCK105A: {
    pedagogy_hours: 40,

    modules: [
      {
        title: "Emerging Materials",
        hours: 8,
      },
      {
        title: "Prefabricated/ Manufactured building components",
        hours: 8,
      },
      {
        title: "Smart Materials",
        hours: 8,
      },
      {
        title: "BIM and IBMS",
        hours: 8,
      },
      {
        title: "3-D Printing",
        hours: 8,
      },
    ],

    course_outcomes: [
      "Make use emerging materials for construction",
      "Decide the proper prefabricated building component",
      "Use smart materials and methods in building construction",
      "Implement BIM in building design",
      "Prepare 3-D modelling and manufacture building component",
    ],
  },

  BKSKK107: {
    pedagogy_hours: 15,

    modules: [
      {
        title:
          "ಕನ౬ಡ ๸ಸౙೃൟ ಮൡ౨ ූ๣ ಀค൞ದ ศಖನಗำ",
        hours: 3,
      },
      {
        title:
          "ಆඎඛಕ තವბದ ౽ವ౲ ූಗ",
        hours: 3,
      },
      {
        title:
          "ಆඎඛಕ ౽ವ౲ ූಗ",
        hours: 3,
      },
      {
        title:
          "൞ಂൟ౳ಕ ವ౲౾౨ಗಳ ಪคಚಯ",
        hours: 3,
      },
      {
        title:
          "๬ಂಸౙೃൟಕ, ಜನಪದ ಕ൳ ಮൡ౨ ಪ౳฿ಸ ಕಥನ",
        hours: 3,
      },
    ],

    removeTopics: [
      "BKSKK107-207",
    ],
  },

  BESCK104B: {
    modules: [
      {
        title: "Introduction",
        hours: 8,
      },
      {
        title: "A.C. Fundamentals",
        hours: 8,
      },
      {
        title: "DC Machines",
        hours: 8,
      },
      {
        title: "Transformers",
        hours: 8,
      },
      {
        title: "Domestic Wiring",
        hours: 8,
      },
    ],
  },

  BESCK104D: {
    modules: [
      {
        title:
          "Introduction: Role of Mechanical Engineering in Industries and Society",
        hours: 8,
      },
      {
        title: "Machine Tool Operations",
        hours: 8,
      },
      {
        title: "Introduction to IC Engines",
        hours: 8,
      },
      {
        title: "Engineering Materials",
        hours: 8,
      },
      {
        title: "Introduction to Mechatronics and Robotics",
        hours: 8,
      },
    ],
  },

  BETCK105E: {
    modules: [
      {
        title: "Introduction",
        hours: 8,
      },
      {
        title: "Solar Energy",
        hours: 8,
      },
      {
        title: "Wind Energy",
        hours: 8,
      },
      {
        title: "Tidal Power",
        hours: 8,
      },
      {
        title: "Green Energy",
        hours: 8,
      },
    ],
  },

  BETCK105J: {
    modules: [
      {
        title: "Introduction",
        hours: 8,
      },
      {
        title: "Characteristics and quality attributes of embedded systems",
        hours: 8,
      },
      {
        title:
          "Hardware Software Co design and Program Modelling",
        hours: 8,
      },
      {
        title:
          "Embedded Firmware Design and Development",
        hours: 8,
      },
      {
        title:
          "Real-time Operating System(RTOS) based Embedded System Design",
        hours: 8,
      },
    ],

    removeTopics: [
      "BETCK105J-205J",
    ],
  },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
}

function normalize(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function printChange(pathName, before, after) {
  console.log(`  ${pathName}`);
  console.log(`    - ${JSON.stringify(before)}`);
  console.log(`    + ${JSON.stringify(after)}`);
}

function repairCourse(code) {
  const filePath = path.join(
    SUBJECTS_DIR,
    `${code}.json`
  );

  console.log("");
  console.log("------------------------------------------------------");
  console.log(`COURSE: ${code}`);
  console.log("------------------------------------------------------");

  if (!fs.existsSync(filePath)) {
    console.log(`❌ JSON missing: ${filePath}`);
    return {
      changed: false,
      missing: true,
    };
  }

  const original = readJson(filePath);
  const data = structuredClone(original);
  const repair = REPAIRS[code];

  let changed = false;
  let changeCount = 0;

  if (!repair) {
    console.log("⚠️ No repair definition.");
    return {
      changed: false,
      missing: false,
    };
  }

  /*
   * ----------------------------------------------------
   * PEDAGOGY HOURS
   * ----------------------------------------------------
   */

  if (
    repair.pedagogy_hours !== undefined &&
    data.pedagogy_hours !== repair.pedagogy_hours
  ) {
    printChange(
      "pedagogy_hours",
      data.pedagogy_hours,
      repair.pedagogy_hours
    );

    data.pedagogy_hours = repair.pedagogy_hours;

    changed = true;
    changeCount++;
  }

  /*
   * ----------------------------------------------------
   * MODULES
   * ----------------------------------------------------
   */

  if (Array.isArray(repair.modules)) {
    if (!Array.isArray(data.modules)) {
      console.log("  ⚠️ Existing modules array missing.");
    } else if (data.modules.length !== repair.modules.length) {
      console.log(
        `  ⚠️ Existing module count ${data.modules.length}, expected ${repair.modules.length}.`
      );
    }

    const count = Math.min(
      Array.isArray(data.modules)
        ? data.modules.length
        : 0,
      repair.modules.length
    );

    for (let i = 0; i < count; i++) {
      const existingModule = data.modules[i];
      const expectedModule = repair.modules[i];

      const beforeTitle = existingModule.title;
      const afterTitle = expectedModule.title;

      if (
        normalize(beforeTitle) !==
        normalize(afterTitle)
      ) {
        printChange(
          `modules[${i}].title`,
          beforeTitle,
          afterTitle
        );

        existingModule.title = afterTitle;

        changed = true;
        changeCount++;
      }

      if (
        expectedModule.hours !== undefined &&
        existingModule.hours !== expectedModule.hours
      ) {
        printChange(
          `modules[${i}].hours`,
          existingModule.hours,
          expectedModule.hours
        );

        existingModule.hours = expectedModule.hours;

        changed = true;
        changeCount++;
      }
    }
  }

  /*
   * ----------------------------------------------------
   * COURSE OUTCOMES
   * ----------------------------------------------------
   */

  if (Array.isArray(repair.course_outcomes)) {
    const before =
      Array.isArray(data.course_outcomes)
        ? data.course_outcomes
        : [];

    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(
      repair.course_outcomes
    );

    if (beforeJson !== afterJson) {
      console.log("  course_outcomes");

      console.log(
        `    - ${before.length} existing outcome(s)`
      );

      console.log(
        `    + ${repair.course_outcomes.length} source outcome(s)`
      );

      data.course_outcomes =
        repair.course_outcomes;

      changed = true;
      changeCount++;
    }
  }

  /*
   * ----------------------------------------------------
   * REMOVE KNOWN EXTRACTION ARTIFACTS
   * ----------------------------------------------------
   */

  if (
    Array.isArray(repair.removeTopics) &&
    Array.isArray(data.modules)
  ) {
    for (let moduleIndex = 0; moduleIndex < data.modules.length; moduleIndex++) {
      const moduleEntry = data.modules[moduleIndex];

      if (!Array.isArray(moduleEntry.topics)) {
        continue;
      }

      const beforeTopics = moduleEntry.topics;

      const afterTopics = beforeTopics.filter(
        (topic) => {
          const topicText =
            typeof topic === "string"
              ? topic
              : topic?.title ?? "";

          return !repair.removeTopics.some(
            (artifact) =>
              normalize(topicText) ===
              normalize(artifact)
          );
        }
      );

      if (
        afterTopics.length !==
        beforeTopics.length
      ) {
        console.log(
          `  modules[${moduleIndex}].topics`
        );

        console.log(
          `    - removed ${
            beforeTopics.length -
            afterTopics.length
          } known extraction artifact(s)`
        );

        moduleEntry.topics = afterTopics;

        changed = true;
        changeCount++;
      }
    }
  }

  /*
   * ----------------------------------------------------
   * RESULT
   * ----------------------------------------------------
   */

  if (!changed) {
    console.log("  ✅ No changes required.");
  } else if (APPLY) {
    writeJson(filePath, data);
    console.log(
      `  ✅ Applied ${changeCount} change(s).`
    );
  } else {
    console.log(
      `  🟡 Dry-run: ${changeCount} change(s) would be applied.`
    );
  }

  return {
    changed,
    missing: false,
    changeCount,
  };
}

/*
 * ======================================================
 * MAIN
 * ======================================================
 */

console.log("");
console.log("======================================================");
console.log(" Vertex — Priority Subject Source Repair");
console.log(
  APPLY
    ? " APPLY MODE — JSON files WILL be modified."
    : " DRY-RUN MODE — JSON files will NOT be modified."
);
console.log(" Supabase data will NOT be modified.");
console.log("======================================================");

let changedCourses = 0;
let missingCourses = 0;
let totalChanges = 0;

for (const code of COURSES) {
  const result = repairCourse(code);

  if (result.changed) {
    changedCourses++;
    totalChanges += result.changeCount ?? 0;
  }

  if (result.missing) {
    missingCourses++;
  }
}

console.log("");
console.log("======================================================");
console.log(" REPAIR SUMMARY");
console.log("======================================================");
console.log(
  `Mode              : ${
    APPLY ? "APPLY" : "DRY-RUN"
  }`
);
console.log(
  `Courses inspected : ${COURSES.length}`
);
console.log(
  `Courses changed   : ${changedCourses}`
);
console.log(
  `Missing courses   : ${missingCourses}`
);
console.log(
  `Total changes     : ${totalChanges}`
);

if (!APPLY) {
  console.log("");
  console.log(
    "🟡 DRY-RUN ONLY — no JSON files were modified."
  );
  console.log("");
  console.log(
    "If the changes look correct, run:"
  );
  console.log("");
  console.log(
    "node scripts\\repair-priority-subjects.mjs --apply"
  );
} else {
  console.log("");
  console.log(
    "✅ Repair completed."
  );
}

console.log("");