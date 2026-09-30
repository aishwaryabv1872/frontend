"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type ResumeDraft = {
  name: string;
  targetRole: string;
  careerObjective: string;
  college: string;
  branch: string;
  yearOfStudy: string;
  cgpa: string;
  graduationYear: string;
  skills: string;
  projects: string;
  dsaSummary: string;
};

type ResumeImprovement = {
  section: string;
  current: string;
  suggested: string;
  reason: string;
};

type ResumeAnalysis = {
  score: number;
  atsScore: number;
  skillsScore: number;
  projectsScore: number;
  problemSolvingScore: number;
  educationScore: number;
  impactScore: number;
  clarityScore: number;

  summary: string;

  strengths: string[];
  weaknesses: string[];
  missingInformation: string[];
  atsIssues: string[];

  improvements: ResumeImprovement[];

  parsedResume?: ResumeDraft;
};

type ResumeUploadResponse = {
  success: boolean;
  fileName?: string;
  fileSize?: number;
  text?: string;
  error?: string;
};

type ResumeParseResponse = {
  success: boolean;
  analysis?: ResumeAnalysis;
  draft?: ResumeDraft;
  error?: string;
};

type ResumeVersion = {
  id: string;
  user_id: string;
  resume_name: string;
  source: string;
  resume_text: string;
  resume_score: number | null;
  created_at: string;
};

type ResumeVersionInsert = Pick<
  ResumeVersion,
  "user_id" | "resume_name" | "source" | "resume_text" | "resume_score"
>;

const emptyDraft: ResumeDraft = {
  name: "",
  targetRole: "",
  careerObjective: "",
  college: "",
  branch: "",
  yearOfStudy: "",
  cgpa: "",
  graduationYear: "",
  skills: "",
  projects: "",
  dsaSummary: "",
};

const emptyAnalysis: ResumeAnalysis = {
  score: 0,
  atsScore: 0,
  skillsScore: 0,
  projectsScore: 0,
  problemSolvingScore: 0,
  educationScore: 0,
  impactScore: 0,
  clarityScore: 0,
  summary: "",
  strengths: [],
  weaknesses: [],
  missingInformation: [],
  atsIssues: [],
  improvements: [],
};

/* =========================================================
   PAGE
========================================================= */

export default function ResumePage() {
  const [resumeDraft, setResumeDraft] =
    useState<ResumeDraft>(emptyDraft);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  /* =====================================================
     VERSION HISTORY
  ===================================================== */

  const [resumeVersions, setResumeVersions] =
    useState<ResumeVersion[]>([]);

  const [loadingVersions, setLoadingVersions] =
    useState(false);

  const [versionError, setVersionError] =
    useState("");

  const [selectedVersionId, setSelectedVersionId] =
    useState<string | null>(null);

  const [savingVersion, setSavingVersion] =
    useState(false);

  /* =====================================================
     UPLOAD
  ===================================================== */

  const [uploadingResume, setUploadingResume] =
    useState(false);

  const [uploadedResumeName, setUploadedResumeName] =
    useState("");

  const [uploadedResumeText, setUploadedResumeText] =
    useState("");

  const [showImportedResume, setShowImportedResume] =
    useState(false);

  const [uploadError, setUploadError] =
    useState("");

  /* =====================================================
     AI PARSE
  ===================================================== */

  const [parsingResume, setParsingResume] =
    useState(false);

  const [parseError, setParseError] =
    useState("");

  /* =====================================================
     AI ANALYSIS
  ===================================================== */

  const [resumeAnalysis, setResumeAnalysis] =
    useState<ResumeAnalysis | null>(null);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [analysisError, setAnalysisError] =
    useState("");

  const [companyTier, setCompanyTier] =
    useState("Service-Based Company");

  const loadResumeVersions = useCallback(
    async (userId?: string) => {
      try {
        setLoadingVersions(true);
        setVersionError("");

        let currentUserId = userId;

        if (!currentUserId) {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          currentUserId = user?.id;
        }

        if (!currentUserId) {
          return;
        }

        const { data, error } = await supabase
          .from("resume_versions")
          .select(
            "id, user_id, resume_name, source, resume_text, resume_score, created_at"
          )
          .eq("user_id", currentUserId)
          .order("created_at", {
            ascending: false,
          });

        if (error) {
          console.error(
            "Resume versions loading error:",
            error
          );

          setVersionError(
            error.message ||
              "Failed to load resume versions."
          );

          return;
        }

        setResumeVersions(
          (data || []) as ResumeVersion[]
        );
      } catch (error) {
        console.error(
          "Resume versions error:",
          error
        );

        setVersionError(
          error instanceof Error
            ? error.message
            : "Failed to load resume versions."
        );
      } finally {
        setLoadingVersions(false);
      }
    },
    []
  );

  /* =========================================================
     LOAD PROFILE + VERSION HISTORY
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    async function loadResumeData() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const [profileResult, careerResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select(
                "id, full_name, college_name, branch, year_of_study, cgpa, graduation_year"
              )
              .eq("id", user.id)
              .maybeSingle(),

            supabase
              .from("career_goals")
              .select(
                "id, user_id, primary_goal, target_role"
              )
              .eq("user_id", user.id)
              .maybeSingle(),
          ]);

        if (!mounted) return;

        if (profileResult.error) {
          console.error(
            "Profile loading error:",
            profileResult.error
          );
        }

        if (careerResult.error) {
          console.error(
            "Career goal loading error:",
            careerResult.error
          );
        }

        const profile = profileResult.data as {
          full_name: string | null;
          college_name: string | null;
          branch: string | null;
          year_of_study: number | string | null;
          cgpa: number | string | null;
          graduation_year: number | string | null;
        } | null;

        const career = careerResult.data as {
          target_role: string | null;
          primary_goal: string | null;
        } | null;

        const localDraft =
          localStorage.getItem(
            "vertex_resume_draft"
          );

        if (localDraft) {
          try {
            const parsed = JSON.parse(localDraft);

            setResumeDraft({
              ...emptyDraft,
              ...parsed,
            });
          } catch {
            setResumeDraft({
              ...emptyDraft,
              name: profile?.full_name || "",
              targetRole:
                career?.target_role || "",
              careerObjective:
                career?.primary_goal || "",
              college:
                profile?.college_name || "",
              branch:
                profile?.branch || "",
              yearOfStudy:
                profile?.year_of_study
                  ? String(profile.year_of_study)
                  : "",
              cgpa:
                profile?.cgpa !== null &&
                profile?.cgpa !== undefined
                  ? String(profile.cgpa)
                  : "",
              graduationYear:
                profile?.graduation_year
                  ? String(profile.graduation_year)
                  : "",
            });
          }
        } else {
          setResumeDraft({
            ...emptyDraft,
            name: profile?.full_name || "",
            targetRole:
              career?.target_role || "",
            careerObjective:
              career?.primary_goal || "",
            college:
              profile?.college_name || "",
            branch:
              profile?.branch || "",
            yearOfStudy:
              profile?.year_of_study
                ? String(profile.year_of_study)
                : "",
            cgpa:
              profile?.cgpa !== null &&
              profile?.cgpa !== undefined
                ? String(profile.cgpa)
                : "",
            graduationYear:
              profile?.graduation_year
                ? String(profile.graduation_year)
                : "",
          });
        }

        await loadResumeVersions(user.id);
      } catch (error) {
        console.error(
          "Resume loading error:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadResumeData();

    return () => {
      mounted = false;
    };
  }, [loadResumeVersions]);

  /* =========================================================
     BUILD RESUME TEXT
  ========================================================= */

  function buildResumeText(
    draft: ResumeDraft
  ) {
    return `
Name:
${draft.name}

Target Role:
${draft.targetRole}

Career Objective:
${draft.careerObjective}

College:
${draft.college}

Branch:
${draft.branch}

Year of Study:
${draft.yearOfStudy}

CGPA:
${draft.cgpa}

Graduation Year:
${draft.graduationYear}

Skills:
${draft.skills}

Projects:
${draft.projects}

DSA / Problem Solving:
${draft.dsaSummary}
`.trim();
  }

  /* =========================================================
     SAVE RESUME VERSION
  ========================================================= */

  async function saveResumeVersion(
    customName?: string,
    customSource: string = "edited"
  ) {
    try {
      setSavingVersion(true);
      setVersionError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "You must be logged in to save a resume version."
        );
      }

      const resumeText =
        buildResumeText(resumeDraft);

      if (resumeText.length < 50) {
        throw new Error(
          "Please add some resume information before saving."
        );
      }

      const resumeName =
        customName ||
        resumeDraft.targetRole ||
        "Vertex Resume";

      const { data, error } = await supabase
        .from("resume_versions")
        .insert({
          user_id: user.id,
          resume_name: resumeName,
          source: customSource,
          resume_text: resumeText,
          resume_score:
            resumeAnalysis?.score ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error(
          "Resume version save error:",
          error
        );

        throw new Error(
          error.message ||
            "Failed to save resume version."
        );
      }

      if (data) {
        setResumeVersions((current) => [
          data as ResumeVersion,
          ...current,
        ]);
      }

      return data as ResumeVersion;
    } catch (error) {
      console.error(
        "Save resume version error:",
        error
      );

      setVersionError(
        error instanceof Error
          ? error.message
          : "Failed to save resume version."
      );

      return null;
    } finally {
      setSavingVersion(false);
    }
  }

  /* =========================================================
     FIELD UPDATE
  ========================================================= */

  function updateField(
    field: keyof ResumeDraft,
    value: string
  ) {
    setResumeDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /* =========================================================
     SAVE LOCAL + DATABASE VERSION
  ========================================================= */

  async function saveResume() {
    try {
      setSaving(true);
      setVersionError("");

      localStorage.setItem(
        "vertex_resume_draft",
        JSON.stringify(resumeDraft)
      );

      const version =
        await saveResumeVersion(
          resumeDraft.targetRole ||
            "Vertex Resume",
          "edited"
        );

      if (version) {
        setSelectedVersionId(version.id);
      }

      setEditing(false);
    } catch (error) {
      console.error(
        "Resume save error:",
        error
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     LOAD VERSION INTO EDITOR
  ========================================================= */

  function openResumeVersion(
    version: ResumeVersion
  ) {
    const text = version.resume_text;

    const extractSection = (
      sectionName: string,
      nextSections: string[]
    ) => {
      const startMarker =
        `${sectionName}:\n`;

      const startIndex =
        text.indexOf(startMarker);

      if (startIndex === -1) {
        return "";
      }

      const contentStart =
        startIndex +
        startMarker.length;

      let endIndex = text.length;

      for (const nextSection of nextSections) {
        const possibleIndex =
          text.indexOf(
            `\n${nextSection}:\n`,
            contentStart
          );

        if (
          possibleIndex !== -1 &&
          possibleIndex < endIndex
        ) {
          endIndex = possibleIndex;
        }
      }

      return text
        .slice(contentStart, endIndex)
        .trim();
    };

    const sections = [
      "Name",
      "Target Role",
      "Career Objective",
      "College",
      "Branch",
      "Year of Study",
      "CGPA",
      "Graduation Year",
      "Skills",
      "Projects",
      "DSA / Problem Solving",
    ];

    const draft: ResumeDraft = {
      name: extractSection(
        "Name",
        sections.filter(
          (section) =>
            section !== "Name"
        )
      ),

      targetRole: extractSection(
        "Target Role",
        sections.filter(
          (section) =>
            section !== "Target Role"
        )
      ),

      careerObjective: extractSection(
        "Career Objective",
        sections.filter(
          (section) =>
            section !==
            "Career Objective"
        )
      ),

      college: extractSection(
        "College",
        sections.filter(
          (section) =>
            section !== "College"
        )
      ),

      branch: extractSection(
        "Branch",
        sections.filter(
          (section) =>
            section !== "Branch"
        )
      ),

      yearOfStudy: extractSection(
        "Year of Study",
        sections.filter(
          (section) =>
            section !==
            "Year of Study"
        )
      ),

      cgpa: extractSection(
        "CGPA",
        sections.filter(
          (section) =>
            section !== "CGPA"
        )
      ),

      graduationYear:
        extractSection(
          "Graduation Year",
          sections.filter(
            (section) =>
              section !==
              "Graduation Year"
          )
        ),

      skills: extractSection(
        "Skills",
        sections.filter(
          (section) =>
            section !== "Skills"
        )
      ),

      projects: extractSection(
        "Projects",
        sections.filter(
          (section) =>
            section !== "Projects"
        )
      ),

      dsaSummary:
        extractSection(
          "DSA / Problem Solving",
          sections.filter(
            (section) =>
              section !==
              "DSA / Problem Solving"
          )
        ),
    };

    setResumeDraft({
      ...emptyDraft,
      ...draft,
    });

    localStorage.setItem(
      "vertex_resume_draft",
      JSON.stringify(draft)
    );

    setSelectedVersionId(
      version.id
    );

    setResumeAnalysis(
      version.resume_score !== null
        ? {
            ...emptyAnalysis,
            score:
              version.resume_score,
          }
        : null
    );

    setEditing(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* =========================================================
     DELETE VERSION
  ========================================================= */

  async function deleteResumeVersion(
    versionId: string
  ) {
    const confirmed =
      window.confirm(
        "Delete this saved resume version? This cannot be undone."
      );

    if (!confirmed) {
      return;
    }

    try {
      setVersionError("");

      const { error } =
        await supabase
          .from("resume_versions")
          .delete()
          .eq("id", versionId);

      if (error) {
        throw new Error(
          error.message ||
            "Failed to delete resume version."
        );
      }

      setResumeVersions(
        (current) =>
          current.filter(
            (version) =>
              version.id !== versionId
          )
      );

      if (
        selectedVersionId ===
        versionId
      ) {
        setSelectedVersionId(null);
      }
    } catch (error) {
      console.error(
        "Delete resume version error:",
        error
      );

      setVersionError(
        error instanceof Error
          ? error.message
          : "Failed to delete resume version."
      );
    }
  }

  /* =========================================================
     UPLOAD EXISTING RESUME
  ========================================================= */

  async function handleResumeUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    try {
      setUploadingResume(true);
      setUploadError("");
      setParseError("");

      setUploadedResumeText("");
      setUploadedResumeName("");

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const {
        data: {
          session,
        },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "You must be logged in to upload a resume."
        );
      }

      const response =
        await fetch(
          "/api/resume-upload",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: formData,
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      const responseText =
        await response.text();

      let data: ResumeUploadResponse;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        try {
          data =
            JSON.parse(
              responseText
            ) as ResumeUploadResponse;
        } catch {
          console.error(
            "Invalid upload JSON:",
            responseText
          );

          throw new Error(
            "Resume upload returned invalid JSON."
          );
        }
      } else {
        console.error(
          "Unexpected upload response:",
          responseText
        );

        throw new Error(
          `Resume upload returned an unexpected response (${response.status}).`
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Failed to process resume."
        );
      }

      const extractedText =
        data.text?.trim() || "";

      if (!extractedText) {
        throw new Error(
          "The resume was uploaded, but no readable text was extracted."
        );
      }

      setUploadedResumeText(
        extractedText
      );

      setUploadedResumeName(
        data.fileName ||
          file.name
      );

      setShowImportedResume(true);
      setUploadError("");
      setResumeAnalysis(null);

      console.log(
        "Vertex extracted resume:",
        extractedText.length,
        "characters"
      );
    } catch (error) {
      console.error(
        "Resume upload error:",
        error
      );

      setUploadError(
        error instanceof Error
          ? error.message
          : "Failed to upload resume."
      );
    } finally {
      setUploadingResume(false);
      event.target.value = "";
    }
  }

  /* =========================================================
     AI PARSE UPLOADED RESUME
  ========================================================= */

  async function handleImportIntoEditor() {
    try {
      setParsingResume(true);
      setParseError("");

      const text =
        uploadedResumeText.trim();

      if (!text) {
        throw new Error(
          "No extracted resume text is available. Please upload the resume again."
        );
      }

      const {
        data: {
          session,
        },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "You must be logged in to analyze the imported resume."
        );
      }

      const response =
        await fetch(
          "/api/resume-parse",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              text,
            }),
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      const responseText =
        await response.text();

      let data: ResumeParseResponse;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        try {
          data =
            JSON.parse(
              responseText
            ) as ResumeParseResponse;
        } catch {
          console.error(
            "Invalid AI parser JSON:",
            responseText
          );

          throw new Error(
            "Vertex received an invalid response from the AI parser."
          );
        }
      } else {
        console.error(
          "AI parser returned:",
          responseText
        );

        throw new Error(
          `AI parser returned an unexpected response (${response.status}).`
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Failed to analyze imported resume."
        );
      }

      const parsedResume =
        data.analysis
          ?.parsedResume ||
        data.draft;

      if (!parsedResume) {
        throw new Error(
          "AI did not return resume information."
        );
      }

      const updatedDraft: ResumeDraft =
        {
          ...resumeDraft,

          name:
            parsedResume.name ||
            resumeDraft.name,

          targetRole:
            parsedResume.targetRole ||
            resumeDraft.targetRole,

          careerObjective:
            parsedResume.careerObjective ||
            resumeDraft.careerObjective,

          college:
            parsedResume.college ||
            resumeDraft.college,

          branch:
            parsedResume.branch ||
            resumeDraft.branch,

          yearOfStudy:
            parsedResume.yearOfStudy ||
            resumeDraft.yearOfStudy,

          cgpa:
            parsedResume.cgpa ||
            resumeDraft.cgpa,

          graduationYear:
            parsedResume.graduationYear ||
            resumeDraft.graduationYear,

          skills:
            parsedResume.skills ||
            resumeDraft.skills,

          projects:
            parsedResume.projects ||
            resumeDraft.projects,

          dsaSummary:
            parsedResume.dsaSummary ||
            resumeDraft.dsaSummary,
        };

      setResumeDraft(
        updatedDraft
      );

      localStorage.setItem(
        "vertex_resume_draft",
        JSON.stringify(updatedDraft)
      );

      if (data.analysis) {
        setResumeAnalysis(
          data.analysis
        );
      }

      setShowImportedResume(false);
      setEditing(true);
      setParseError("");

      /* ---------------------------------------------
         SAVE IMPORTED VERSION
      --------------------------------------------- */

      await saveImportedVersion(
        updatedDraft,
        data.analysis?.score ??
          null,
        uploadedResumeName ||
          "Imported Resume"
      );

      console.log(
        "VERTEX RESUME IMPORT SUCCESS"
      );
    } catch (error) {
      console.error(
        "Resume import error:",
        error
      );

      setParseError(
        error instanceof Error
          ? error.message
          : "Failed to import resume."
      );
    } finally {
      setParsingResume(false);
    }
  }

  /* =========================================================
     SAVE IMPORTED VERSION
  ========================================================= */

  async function saveImportedVersion(
    draft: ResumeDraft,
    score: number | null,
    fileName: string
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const resumeText =
        buildResumeText(draft);

      const cleanName =
        fileName
          .replace(/\.[^/.]+$/, "")
          .trim() ||
        "Imported Resume";

      const { data, error } =
        await supabase
          .from("resume_versions")
          .insert({
            user_id: user.id,
            resume_name: cleanName,
            source: "uploaded",
            resume_text: resumeText,
            resume_score: score,
          } as ResumeVersionInsert)
          .select()
          .single();

      if (error) {
        console.error(
          "Imported version save error:",
          error
        );

        return;
      }

      if (data) {
        setResumeVersions(
          (current) => [
            data as ResumeVersion,
            ...current,
          ]
        );
      }
    } catch (error) {
      console.error(
        "Imported version error:",
        error
      );
    }
  }

  /* =========================================================
     ANALYZE CURRENT RESUME
  ========================================================= */

  async function analyzeResume() {
    try {
      setAnalyzing(true);
      setAnalysisError("");

      const resumeText =
        buildResumeText(
          resumeDraft
        ) +
        `\n\nCompany Type:\n${companyTier}`;

      if (
        resumeText.length < 50
      ) {
        throw new Error(
          "Please add some resume information before analyzing."
        );
      }

      const {
        data: {
          session,
        },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "You must be logged in to analyze your resume."
        );
      }

      const response =
        await fetch(
          "/api/resume-parse",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              text: resumeText,
            }),
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      const responseText =
        await response.text();

      let data: ResumeParseResponse;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        try {
          data =
            JSON.parse(
              responseText
            ) as ResumeParseResponse;
        } catch {
          throw new Error(
            "Vertex received an invalid response from the AI analysis."
          );
        }
      } else {
        throw new Error(
          `AI analysis returned an unexpected response (${response.status}).`
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Failed to analyze resume."
        );
      }

      if (!data.analysis) {
        throw new Error(
          "AI did not return a resume analysis."
        );
      }

      setResumeAnalysis(
        data.analysis
      );

      localStorage.setItem(
        "vertex_resume_draft",
        JSON.stringify(resumeDraft)
      );

      console.log(
        "Vertex resume analysis completed."
      );
    } catch (error) {
      console.error(
        "Resume analysis error:",
        error
      );

      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Failed to analyze resume."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  /* =========================================================
     APPLY AI IMPROVEMENT
  ========================================================= */

  function applySuggestion(
    improvement: ResumeImprovement
  ) {
    const section =
      improvement.section.toLowerCase();

    let field:
      | keyof ResumeDraft
      | null = null;

    if (
      section.includes("skill")
    ) {
      field = "skills";
    } else if (
      section.includes("project")
    ) {
      field = "projects";
    } else if (
      section.includes("objective") ||
      section.includes("summary")
    ) {
      field =
        "careerObjective";
    } else if (
      section.includes("dsa") ||
      section.includes("problem")
    ) {
      field =
        "dsaSummary";
    } else if (
      section.includes("role")
    ) {
      field =
        "targetRole";
    }

    if (!field) {
      alert(
        "Apply this suggestion manually in the appropriate resume section."
      );

      setEditing(true);

      return;
    }

    updateField(
      field,
      improvement.suggested
    );

    setEditing(true);
  }

  /* =========================================================
     RESET
  ========================================================= */

  function resetResume() {
    const confirmed =
      window.confirm(
        "Reset your manually edited resume data?"
      );

    if (!confirmed) return;

    localStorage.removeItem(
      "vertex_resume_draft"
    );

    window.location.reload();
  }

  /* =========================================================
     PRINT
  ========================================================= */

  function printResume() {
    window.print();
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b18] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-5xl mb-4">
            ✦
          </div>

          <p className="text-slate-300">
            Loading Vertex Resume Intelligence...
          </p>
        </div>
      </main>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <>
      <main className="min-h-screen bg-[#070b18] text-white">
        {/* HEADER */}

        <header className="border-b border-white/10 bg-[#070b18]/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.3em] text-violet-400 font-bold">
                  VERTEX RESUME INTELLIGENCE
                </p>

                <h1 className="text-3xl font-bold mt-2">
                  Resume Builder
                </h1>

                <p className="text-slate-400 mt-2">
                  Create, import, analyze and improve
                  your placement resume.
                </p>
              </div>

              <div className="rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-300">
                ✨ AI POWERED
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* =================================================
              MY RESUMES
          ================================================= */}

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs tracking-widest text-violet-400 font-bold">
                  RESUME VERSIONS
                </p>

                <h2 className="text-2xl font-bold mt-1">
                  My Resumes
                </h2>

                <p className="text-sm text-slate-400 mt-2">
                  Your saved resume versions and previous
                  imported resumes.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  saveResumeVersion(
                    resumeDraft.targetRole ||
                      "Current Resume",
                    "vertex"
                  )
                }
                disabled={savingVersion}
                className="px-5 py-3 rounded-xl bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-50 font-semibold"
              >
                {savingVersion
                  ? "Saving..."
                  : "＋ Save Current Resume"}
              </button>
            </div>

            {versionError && (
              <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
                <strong>
                  Version Error:
                </strong>{" "}
                {versionError}
              </div>
            )}

            {loadingVersions ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-slate-400">
                Loading saved resumes...
              </div>
            ) : resumeVersions.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
                <div className="text-4xl">
                  📁
                </div>

                <p className="font-semibold mt-3">
                  No saved resume versions yet
                </p>

                <p className="text-sm text-slate-500 mt-1">
                  Save your current resume to create
                  your first version.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
                {resumeVersions.map(
                  (version) => (
                    <div
                      key={version.id}
                      className={`rounded-2xl border p-5 transition ${
                        selectedVersionId ===
                        version.id
                          ? "border-violet-400/50 bg-violet-500/10"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">
                            {version.resume_name}
                          </p>

                          <p className="text-xs text-slate-500 mt-1">
                            {formatDate(
                              version.created_at
                            )}
                          </p>
                        </div>

                        {version.resume_score !==
                          null && (
                          <div className="text-right">
                            <p className="text-2xl font-black text-violet-300">
                              {
                                version.resume_score
                              }
                            </p>

                            <p className="text-[10px] text-slate-500">
                              SCORE
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider text-slate-400">
                          {version.source}
                        </span>
                      </div>

                      <div className="flex gap-2 mt-5">
                        <button
                          type="button"
                          onClick={() =>
                            openResumeVersion(
                              version
                            )
                          }
                          className="flex-1 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold"
                        >
                          Open
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteResumeVersion(
                              version.id
                            )
                          }
                          className="px-3 py-2 rounded-lg border border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* =================================================
              UPLOAD
          ================================================= */}

          <section className="rounded-3xl border border-violet-400/20 bg-linear-to-br from-violet-500/10 via-[#11182c] to-blue-500/10 p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-400/20 flex items-center justify-center text-2xl">
                📄
              </div>

              <div className="flex-1">
                <p className="text-xs font-bold tracking-widest text-violet-300">
                  IMPORT + IMPROVE
                </p>

                <h2 className="text-2xl font-bold mt-1">
                  Import Existing Resume
                </h2>

                <p className="text-slate-400 mt-2 max-w-3xl">
                  Upload a resume you created earlier.
                  Vertex extracts the content, uses AI
                  to understand the resume and provides
                  improvement suggestions.
                </p>

                <div className="flex flex-wrap gap-2 mt-5">
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
                    PDF
                  </span>

                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
                    DOCX
                  </span>

                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
                    TXT
                  </span>

                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
                    Max 5 MB
                  </span>
                </div>

                <div className="mt-6">
                  <label className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 cursor-pointer font-semibold shadow-lg transition">
                    {uploadingResume
                      ? "Extracting Resume..."
                      : "Upload Existing Resume"}

                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      disabled={
                        uploadingResume
                      }
                      onChange={
                        handleResumeUpload
                      }
                    />
                  </label>
                </div>

                {uploadError && (
                  <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
                    <strong>
                      Upload Error:
                    </strong>{" "}
                    {uploadError}
                  </div>
                )}

                {uploadedResumeName && (
                  <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 text-xl">
                        ✓
                      </span>

                      <div>
                        <p className="font-semibold text-emerald-300">
                          Resume imported successfully
                        </p>

                        <p className="text-sm text-slate-300 mt-1">
                          {uploadedResumeName}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          setShowImportedResume(
                            !showImportedResume
                          )
                        }
                        className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                      >
                        {showImportedResume
                          ? "Hide Imported Resume"
                          : "View Imported Resume"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUploadedResumeName(
                            ""
                          );
                          setUploadedResumeText(
                            ""
                          );
                          setShowImportedResume(
                            false
                          );
                          setResumeAnalysis(
                            null
                          );
                          setParseError("");
                        }}
                        className="px-4 py-2 rounded-lg border border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-sm"
                      >
                        Remove Resume
                      </button>
                    </div>
                  </div>
                )}

                {showImportedResume &&
                  uploadedResumeText && (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">
                            Imported Resume Content
                          </h3>

                          <p className="text-xs text-slate-500 mt-1">
                            {uploadedResumeText.length.toLocaleString()}{" "}
                            characters extracted
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setShowImportedResume(
                              false
                            )
                          }
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Hide
                        </button>
                      </div>

                      <textarea
                        value={
                          uploadedResumeText
                        }
                        onChange={(event) =>
                          setUploadedResumeText(
                            event.target.value
                          )
                        }
                        className="w-full min-h-32 rounded-xl border border-white/10 bg-[#080c18] px-4 py-3 text-sm text-slate-200 outline-none focus:border-violet-400/50"
                      />

                      {parseError && (
                        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
                          <strong>
                            AI Parse Error:
                          </strong>{" "}
                          {parseError}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 mt-4">
                        <button
                          type="button"
                          onClick={
                            handleImportIntoEditor
                          }
                          disabled={
                            parsingResume ||
                            !uploadedResumeText.trim()
                          }
                          className="px-5 py-3 rounded-xl bg-linear-to-r from-violet-600 to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                        >
                          {parsingResume
                            ? "✨ AI Parsing Resume..."
                            : "✨ Analyze & Import Into Editor"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setShowImportedResume(
                              false
                            )
                          }
                          className="px-5 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </section>

          {/* =================================================
              MAIN CONTENT
          ================================================= */}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* EDITOR */}

            <section className="xl:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs tracking-widest text-violet-400 font-bold">
                    EDITOR
                  </p>

                  <h2 className="text-2xl font-bold mt-1">
                    Resume Information
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!editing ? (
                    <button
                      type="button"
                      onClick={() =>
                        setEditing(true)
                      }
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold"
                    >
                      Edit Resume
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={
                          saveResume
                        }
                        disabled={saving}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-semibold"
                      >
                        {saving
                          ? "Saving..."
                          : "Save Changes"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditing(false)
                        }
                        className="px-4 py-2 rounded-xl border border-white/10 bg-white/5"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={
                      printResume
                    }
                    className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
                  >
                    Print / Save PDF
                  </button>
                </div>
              </div>

              {editing ? (
                <div className="space-y-6">
                  <EditorField
                    label="Full Name"
                    value={
                      resumeDraft.name
                    }
                    onChange={(value) =>
                      updateField(
                        "name",
                        value
                      )
                    }
                  />

                  <EditorField
                    label="Target Role"
                    value={
                      resumeDraft.targetRole
                    }
                    onChange={(value) =>
                      updateField(
                        "targetRole",
                        value
                      )
                    }
                  />

                  <EditorTextarea
                    label="Career Objective"
                    value={
                      resumeDraft.careerObjective
                    }
                    onChange={(value) =>
                      updateField(
                        "careerObjective",
                        value
                      )
                    }
                  />

                  <EditorField
                    label="College"
                    value={
                      resumeDraft.college
                    }
                    onChange={(value) =>
                      updateField(
                        "college",
                        value
                      )
                    }
                  />

                  <EditorField
                    label="Branch"
                    value={
                      resumeDraft.branch
                    }
                    onChange={(value) =>
                      updateField(
                        "branch",
                        value
                      )
                    }
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <EditorField
                      label="Year of Study"
                      value={
                        resumeDraft.yearOfStudy
                      }
                      onChange={(value) =>
                        updateField(
                          "yearOfStudy",
                          value
                        )
                      }
                    />

                    <EditorField
                      label="CGPA"
                      value={
                        resumeDraft.cgpa
                      }
                      onChange={(value) =>
                        updateField(
                          "cgpa",
                          value
                        )
                      }
                    />

                    <EditorField
                      label="Graduation Year"
                      value={
                        resumeDraft.graduationYear
                      }
                      onChange={(value) =>
                        updateField(
                          "graduationYear",
                          value
                        )
                      }
                    />
                  </div>

                  <EditorTextarea
                    label="Skills"
                    value={
                      resumeDraft.skills
                    }
                    onChange={(value) =>
                      updateField(
                        "skills",
                        value
                      )
                    }
                  />

                  <EditorTextarea
                    label="Projects"
                    value={
                      resumeDraft.projects
                    }
                    onChange={(value) =>
                      updateField(
                        "projects",
                        value
                      )
                    }
                  />

                  <EditorTextarea
                    label="DSA / Problem Solving"
                    value={
                      resumeDraft.dsaSummary
                    }
                    onChange={(value) =>
                      updateField(
                        "dsaSummary",
                        value
                      )
                    }
                  />
                </div>
              ) : (
                <ResumePreview
                  draft={resumeDraft}
                />
              )}
            </section>

            {/* AI REVIEW */}

            <section className="rounded-3xl border border-violet-400/20 bg-linear-to-b from-violet-500/10 to-white/5 p-6 h-fit">
              <p className="text-xs tracking-widest text-violet-400 font-bold">
                AI RESUME REVIEW
              </p>

              <h2 className="text-2xl font-bold mt-1">
                Analyze Resume
              </h2>

              <p className="text-sm text-slate-400 mt-2">
                Vertex checks your resume for ATS
                readability, skills, projects,
                problem solving and missing information.
              </p>

              <label className="block text-sm font-semibold mt-6 mb-2">
                Company Type
              </label>

              <select
                value={companyTier}
                onChange={(event) =>
                  setCompanyTier(
                    event.target.value
                  )
                }
                className="w-full h-12 rounded-xl border border-white/10 bg-[#0c1222] px-4 text-white outline-none focus:border-violet-400"
              >
                <option>
                  Service-Based Company
                </option>

                <option>
                  Product-Based Company
                </option>

                <option>
                  Startup
                </option>
              </select>

              <button
                type="button"
                onClick={
                  analyzeResume
                }
                disabled={analyzing}
                className="w-full mt-4 px-5 py-3 rounded-xl bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-50 font-semibold"
              >
                {analyzing
                  ? "✨ Analyzing..."
                  : "✨ Analyze Resume"}
              </button>

              {analysisError && (
                <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
                  <strong>
                    Analysis Error:
                  </strong>{" "}
                  {analysisError}
                </div>
              )}

              {resumeAnalysis && (
                <div className="mt-6 space-y-5">
                  {/* OVERALL SCORE */}

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                    <p className="text-sm text-slate-400">
                      Overall Resume Score
                    </p>

                    <p className="text-5xl font-black mt-2 text-violet-300">
                      {
                        resumeAnalysis.score
                      }

                      <span className="text-xl text-slate-500">
                        /100
                      </span>
                    </p>

                    <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-violet-500 to-blue-500"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              resumeAnalysis.score,
                              0
                            ),
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* SCORE CARDS */}

                  <div className="grid grid-cols-2 gap-3">
                    <ScoreCard
                      title="ATS"
                      score={
                        resumeAnalysis.atsScore
                      }
                    />

                    <ScoreCard
                      title="Skills"
                      score={
                        resumeAnalysis.skillsScore
                      }
                    />

                    <ScoreCard
                      title="Projects"
                      score={
                        resumeAnalysis.projectsScore
                      }
                    />

                    <ScoreCard
                      title="DSA"
                      score={
                        resumeAnalysis.problemSolvingScore
                      }
                    />

                    <ScoreCard
                      title="Education"
                      score={
                        resumeAnalysis.educationScore
                      }
                    />

                    <ScoreCard
                      title="Impact"
                      score={
                        resumeAnalysis.impactScore
                      }
                    />

                    <ScoreCard
                      title="Clarity"
                      score={
                        resumeAnalysis.clarityScore
                      }
                    />
                  </div>

                  {/* SUMMARY */}

                  {resumeAnalysis.summary && (
                    <AnalysisBox
                      title="AI Summary"
                      items={[
                        resumeAnalysis.summary,
                      ]}
                    />
                  )}

                  {/* STRENGTHS */}

                  {resumeAnalysis.strengths?.length >
                    0 && (
                    <AnalysisBox
                      title="✓ Strengths"
                      items={
                        resumeAnalysis.strengths
                      }
                    />
                  )}

                  {/* WEAKNESSES */}

                  {resumeAnalysis.weaknesses?.length >
                    0 && (
                    <AnalysisBox
                      title="⚠ Weak Areas"
                      items={
                        resumeAnalysis.weaknesses
                      }
                    />
                  )}

                  {/* MISSING INFORMATION */}

                  {resumeAnalysis
                    .missingInformation
                    ?.length > 0 && (
                    <AnalysisBox
                      title="Missing Information"
                      items={
                        resumeAnalysis.missingInformation
                      }
                    />
                  )}

                  {/* ATS ISSUES */}

                  {resumeAnalysis.atsIssues?.length >
                    0 && (
                    <AnalysisBox
                      title="ATS Issues"
                      items={
                        resumeAnalysis.atsIssues
                      }
                    />
                  )}

                  {/* IMPROVEMENTS */}

                  {resumeAnalysis.improvements
                    ?.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg">
                        ✨ AI Improvements
                      </h3>

                      <div className="space-y-4 mt-3">
                        {resumeAnalysis.improvements.map(
                          (
                            improvement,
                            index
                          ) => (
                            <div
                              key={index}
                              className="rounded-2xl border border-white/10 bg-black/20 p-4"
                            >
                              <p className="text-xs uppercase tracking-widest text-violet-400 font-bold">
                                {
                                  improvement.section
                                }
                              </p>

                              <div className="mt-3">
                                <p className="text-xs text-slate-500">
                                  CURRENT
                                </p>

                                <p className="text-sm text-slate-300 mt-1">
                                  {
                                    improvement.current
                                  }
                                </p>
                              </div>

                              <div className="mt-3">
                                <p className="text-xs text-emerald-400">
                                  SUGGESTED
                                </p>

                                <p className="text-sm text-white mt-1">
                                  {
                                    improvement.suggested
                                  }
                                </p>
                              </div>

                              <p className="text-xs text-slate-500 mt-3">
                                {
                                  improvement.reason
                                }
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  applySuggestion(
                                    improvement
                                  )
                                }
                                className="mt-4 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold"
                              >
                                Apply Suggestion
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* =================================================
              WORKFLOW
          ================================================= */}

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs tracking-widest text-violet-400 font-bold">
              VERTEX WORKFLOW
            </p>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-5">
              {[
                [
                  "01",
                  "Upload",
                  "Import your old resume",
                ],
                [
                  "02",
                  "Extract",
                  "Read PDF / DOCX / TXT",
                ],
                [
                  "03",
                  "AI Analyze",
                  "Understand and score resume",
                ],
                [
                  "04",
                  "Improve",
                  "Apply truthful suggestions",
                ],
                [
                  "05",
                  "Edit",
                  "Customize your resume",
                ],
                [
                  "06",
                  "Export",
                  "Print or save as PDF",
                ],
              ].map(
                (step) => (
                  <div
                    key={step[0]}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-xs text-violet-400 font-bold">
                      {step[0]}
                    </p>

                    <p className="font-semibold mt-2">
                      {step[1]}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      {step[2]}
                    </p>
                  </div>
                )
              )}
            </div>
          </section>

          {/* RESET */}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={
                resetResume
              }
              className="text-sm text-red-400 hover:text-red-300"
            >
              Reset Resume Data
            </button>
          </div>
        </div>
      </main>

      {/* =====================================================
          PRINT CSS
      ===================================================== */}

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }

          body * {
            visibility: hidden;
          }

          .print-resume,
          .print-resume * {
            visibility: visible;
          }

          .print-resume {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 40px !important;
          }

          button,
          select,
          textarea,
          input {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}

/* =========================================================
   DATE FORMATTER
========================================================= */

function formatDate(
  dateString: string
) {
  try {
    return new Date(
      dateString
    ).toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return dateString;
  }
}

/* =========================================================
   EDITOR FIELD
========================================================= */

function EditorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-200">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full h-12 rounded-xl border border-white/10 bg-[#0b1020] px-4 text-white placeholder:text-slate-600 outline-none focus:border-violet-400"
      />
    </div>
  );
}

/* =========================================================
   EDITOR TEXTAREA
========================================================= */

function EditorTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-200">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full min-h-32 rounded-xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-violet-400 resize-y"
      />
    </div>
  );
}

/* =========================================================
   SCORE CARD
========================================================= */

function ScoreCard({
  title,
  score,
}: {
  title: string;
  score: number;
}) {
  const safeScore = Math.min(
    Math.max(
      Number(score) || 0,
      0
    ),
    100
  );

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {title}
        </span>

        <span className="font-bold text-violet-300">
          {safeScore}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
        <div
          className="h-full bg-violet-500"
          style={{
            width: `${safeScore}%`,
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   ANALYSIS BOX
========================================================= */

function AnalysisBox({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="font-bold">
        {title}
      </h3>

      <div className="space-y-2 mt-3">
        {items.map(
          (item, index) => (
            <div
              key={index}
              className="flex gap-2 text-sm text-slate-300"
            >
              <span className="text-violet-400">
                •
              </span>

              <span>
                {item}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* =========================================================
   RESUME PREVIEW
========================================================= */

function ResumePreview({
  draft,
}: {
  draft: ResumeDraft;
}) {
  return (
    <div className="print-resume rounded-2xl bg-white text-slate-900 p-8 shadow-2xl">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-3xl font-bold">
          {draft.name ||
            "Your Name"}
        </h1>

        <p className="text-violet-700 font-semibold mt-1">
          {draft.targetRole ||
            "Target Role"}
        </p>

        {draft.careerObjective && (
          <p className="text-sm text-slate-600 mt-3 leading-6">
            {draft.careerObjective}
          </p>
        )}
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-violet-700">
          Education
        </h2>

        <div className="mt-3">
          <p className="font-bold">
            {draft.college ||
              "College / University"}
          </p>

          <p className="text-sm text-slate-600">
            {draft.branch ||
              "Branch / Specialization"}
          </p>

          <p className="text-sm text-slate-600 mt-1">
            {draft.yearOfStudy &&
              `Year: ${draft.yearOfStudy}`}

            {draft.cgpa &&
              ` • CGPA: ${draft.cgpa}`}

            {draft.graduationYear &&
              ` • Graduation: ${draft.graduationYear}`}
          </p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-violet-700">
          Skills
        </h2>

        <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">
          {draft.skills ||
            "Add your technical skills"}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-violet-700">
          Projects
        </h2>

        <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">
          {draft.projects ||
            "Project details will appear here."}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-violet-700">
          Problem Solving
        </h2>

        <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">
          {draft.dsaSummary ||
            "Problem-solving information will appear here."}
        </p>
      </section>
    </div>
  );
}