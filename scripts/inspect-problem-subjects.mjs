import fs from "fs";
import path from "path";

const dir = path.join(
  process.cwd(),
  "data",
  "curriculum",
  "vtu-2022",
  "CSE",
  "subjects"
);

const codes = [
  "BESCK104A",
  "BESCK104C",
  "BETCK105A",
  "BETCK105B",
  "BETCK105D",
  "BETCK105G",
  "BETCK105H",
  "BETCK105I",
  "BIDTK158",
  "BKSKK107",
];

for (const code of codes) {
  const file = path.join(dir, `${code}.json`);

  console.log("\n" + "=".repeat(70));
  console.log(code);
  console.log("=".repeat(70));

  if (!fs.existsSync(file)) {
    console.log("FILE NOT FOUND");
    continue;
  }

  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  console.log("\nsubject_code:", data.subject_code);
  console.log("subject_name:", data.subject_name);
  console.log("credits:", data.credits);
  console.log("pedagogy_hours:", data.pedagogy_hours);
  console.log("source:", JSON.stringify(data.source, null, 2));

  console.log("\nMODULES:");

  for (const moduleEntry of data.modules ?? []) {
    console.log(
      `Module ${moduleEntry.module_number}:`,
      JSON.stringify(
        {
          title: moduleEntry.title,
          hours: moduleEntry.hours,
          topic_count: moduleEntry.topics?.length ?? 0,
          topics: moduleEntry.topics,
        },
        null,
        2
      )
    );
  }

  console.log("\nCOURSE OUTCOMES:");
  console.log(JSON.stringify(data.course_outcomes, null, 2));
}