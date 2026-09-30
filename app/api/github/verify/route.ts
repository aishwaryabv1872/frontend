import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const authClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type GithubUser = {
  login: string;
  id: number;
};

type GithubRepository = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  default_branch: string;
  owner: {
    login: string;
  };
};

type GithubCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string | null;
    } | null;
  };
  author: {
    login: string;
  } | null;
};

type GithubPullRequest = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  merged_at: string | null;
  user: {
    login: string;
  } | null;
};

type GithubContributor = {
  login: string;
  contributions: number;
};

type VerifyRequest = {
  project_id: number | string;
  github_owner: string;
  github_repo: string;
  provider_token: string;
};

type EvidenceRecord = {
  id: string;
  project_id: number;
  user_id: string;
  github_repo_id: number;
  github_owner: string;
  github_repo: string;
  github_url: string;
  default_branch: string;
  commit_count: number;
  pull_request_count: number;
  contributor_count: number;
  first_commit_at: string | null;
  last_commit_at: string | null;
  evidence_json: Record<string, unknown>;
  fetched_at: string;
  created_at: string;
  evidence_type: string | null;
  metadata: Record<string, unknown> | null;
};

function getGithubHeaders(
  providerToken: string
) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${providerToken}`,
    "X-GitHub-Api-Version":
      GITHUB_API_VERSION,
    "User-Agent":
      "Vertex-Placement-Platform",
  };
}

async function githubGet<T>(
  url: string,
  providerToken: string
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers:
      getGithubHeaders(providerToken),
    cache: "no-store",
  });

  const responseText =
    await response.text();

  if (!response.ok) {
    let githubMessage =
      "GitHub request failed.";

    try {
      const parsed =
        JSON.parse(responseText) as {
          message?: string;
        };

      if (parsed.message) {
        githubMessage =
          parsed.message;
      }
    } catch {
      // Do not expose raw response.
    }

    throw new Error(
      `GitHub API request failed with status ${response.status}: ${githubMessage}`
    );
  }

  try {
    return JSON.parse(
      responseText
    ) as T;
  } catch {
    throw new Error(
      "GitHub returned invalid JSON."
    );
  }
}

function calculateVerificationScore(
  commitCount: number,
  pullRequestCount: number,
  contributorCount: number
): number {
  const commitScore =
    Math.min(commitCount, 50);

  const pullRequestScore =
    Math.min(
      pullRequestCount * 5,
      30
    );

  const contributorScore =
    Math.min(
      contributorCount * 10,
      20
    );

  return Math.min(
    commitScore +
      pullRequestScore +
      contributorScore,
    100
  );
}

async function authenticateRequest(
  request: NextRequest
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (!authorization) {
    return {
      user: null,
      error:
        "Authentication required.",
    };
  }

  const tokenMatch =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  if (!tokenMatch) {
    return {
      user: null,
      error:
        "Invalid authorization header.",
    };
  }

  const accessToken =
    tokenMatch[1].trim();

  if (!accessToken) {
    return {
      user: null,
      error:
        "Authentication required.",
    };
  }

  const {
    data: { user },
    error,
  } =
    await authClient.auth.getUser(
      accessToken
    );

  if (error || !user) {
    return {
      user: null,
      error:
        "Invalid or expired session.",
    };
  }

  return {
    user,
    error: null,
  };
}

function isValidGithubName(
  value: string
): boolean {
  return (
    value.length >= 1 &&
    value.length <= 100 &&
    /^[A-Za-z0-9_.-]+$/.test(value)
  );
}

function isValidProjectId(
  value: unknown
): boolean {
  if (
    typeof value === "number"
  ) {
    return (
      Number.isInteger(value) &&
      value > 0
    );
  }

  if (
    typeof value === "string"
  ) {
    return (
      value.trim().length > 0 &&
      value.trim().length <= 100
    );
  }

  return false;
}

export async function POST(
  request: NextRequest
) {
  try {
    // ========================================================
    // 1. AUTHENTICATE VERTEX USER
    // ========================================================

    const {
      user,
      error: authError,
    } =
      await authenticateRequest(
        request
      );

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            authError ||
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    // ========================================================
    // 2. READ REQUEST BODY
    // ========================================================

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const requestBody =
      body as Partial<VerifyRequest>;

    const projectId =
      requestBody.project_id;

    const githubOwner =
      typeof requestBody.github_owner ===
      "string"
        ? requestBody.github_owner.trim()
        : "";

    const githubRepo =
      typeof requestBody.github_repo ===
      "string"
        ? requestBody.github_repo.trim()
        : "";

    const providerToken =
      typeof requestBody.provider_token ===
      "string"
        ? requestBody.provider_token.trim()
        : "";

    // ========================================================
    // 3. VALIDATE INPUT
    // ========================================================

    if (
      !isValidProjectId(projectId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid project ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      !githubOwner ||
      !isValidGithubName(
        githubOwner
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid GitHub owner is required.",
        },
        { status: 400 }
      );
    }

    if (
      !githubRepo ||
      !isValidGithubName(
        githubRepo
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid GitHub repository is required.",
        },
        { status: 400 }
      );
    }

    if (!providerToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GitHub authentication is required.",
        },
        { status: 400 }
      );
    }

    // ========================================================
    // 4. CREATE AUTHENTICATED SUPABASE CLIENT
    // ========================================================

    const authorization =
      request.headers.get(
        "authorization"
      );

    const accessToken =
      authorization!
        .replace(
          /^Bearer\s+/i,
          ""
        )
        .trim();

    const supabase =
      createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        }
      );

    // ========================================================
    // 5. VERIFY GITHUB TOKEN
    //
    // This confirms the supplied GitHub token is valid and
    // identifies the GitHub account that owns the repository.
    // ========================================================

    const githubUser =
      await githubGet<GithubUser>(
        `${GITHUB_API}/user`,
        providerToken
      );

    if (
      !githubUser?.login
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify the GitHub account.",
        },
        { status: 401 }
      );
    }

    if (
      githubUser.login.toLowerCase() !==
      githubOwner.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The GitHub account does not match the repository owner.",
        },
        { status: 403 }
      );
    }

    // ========================================================
    // 6. LOAD USER'S PROJECT
    // ========================================================

    const {
      data: project,
      error: projectError,
    } =
      await supabase
        .from("projects")
        .select(
          `
            id,
            user_id,
            project_name,
            description,
            tech_stack,
            project_url,
            verification_status,
            github_owner,
            github_repo,
            github_repo_id,
            github_url,
            verified_at,
            verification_score
          `
        )
        .eq(
          "id",
          projectId
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (projectError) {
      console.error(
        "Project database error:",
        projectError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to read the selected project.",
        },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Project not found for the current Vertex account.",
        },
        { status: 404 }
      );
    }

    // ========================================================
    // 7. READ GITHUB REPOSITORY
    // ========================================================

    const repository =
      await githubGet<GithubRepository>(
        `${GITHUB_API}/repos/` +
          `${encodeURIComponent(
            githubOwner
          )}/` +
          `${encodeURIComponent(
            githubRepo
          )}`,
        providerToken
      );

    // ========================================================
    // 8. CONFIRM REPOSITORY OWNER
    // ========================================================

    if (
      repository.owner.login.toLowerCase() !==
      githubOwner.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected GitHub repository owner does not match.",
        },
        { status: 400 }
      );
    }

    // ========================================================
    // 9. FETCH COMMITS
    // ========================================================

    const commits =
      await githubGet<GithubCommit[]>(
        `${GITHUB_API}/repos/` +
          `${encodeURIComponent(
            githubOwner
          )}/` +
          `${encodeURIComponent(
            githubRepo
          )}` +
          `/commits?per_page=100`,
        providerToken
      );

    // ========================================================
    // 10. FETCH PULL REQUESTS
    // ========================================================

    const pullRequests =
      await githubGet<GithubPullRequest[]>(
        `${GITHUB_API}/repos/` +
          `${encodeURIComponent(
            githubOwner
          )}/` +
          `${encodeURIComponent(
            githubRepo
          )}` +
          `/pulls?state=all&per_page=100`,
        providerToken
      );

    const mergedPullRequests =
      pullRequests.filter(
        (pullRequest) =>
          pullRequest.merged_at !==
          null
      );

    // ========================================================
    // 11. FETCH CONTRIBUTORS
    // ========================================================

    const contributors =
      await githubGet<GithubContributor[]>(
        `${GITHUB_API}/repos/` +
          `${encodeURIComponent(
            githubOwner
          )}/` +
          `${encodeURIComponent(
            githubRepo
          )}` +
          `/contributors?per_page=100`,
        providerToken
      );

    // ========================================================
    // 12. CALCULATE COUNTS
    // ========================================================

    const commitCount =
      commits.length;

    const pullRequestCount =
      mergedPullRequests.length;

    const contributorCount =
      contributors.length;

    // ========================================================
    // 13. CALCULATE VERIFICATION SCORE
    // ========================================================

    const verificationScore =
      calculateVerificationScore(
        commitCount,
        pullRequestCount,
        contributorCount
      );

    // ========================================================
    // 14. FIND COMMIT DATES
    // ========================================================

    const commitDates =
      commits
        .map(
          (commit) =>
            commit.commit.author
              ?.date ?? null
        )
        .filter(
          (
            date
          ): date is string =>
            Boolean(date)
        )
        .sort(
          (a, b) =>
            new Date(
              a
            ).getTime() -
            new Date(
              b
            ).getTime()
        );

    const firstCommitAt =
      commitDates.length > 0
        ? commitDates[0]
        : null;

    const lastCommitAt =
      commitDates.length > 0
        ? commitDates[
            commitDates.length - 1
          ]
        : null;

    const fetchedAt =
      new Date().toISOString();

    // ========================================================
    // 15. UPDATE PROJECT
    // ========================================================

    const {
      data: updatedProject,
      error: updateError,
    } =
      await supabase
        .from("projects")
        .update({
          verification_status:
            "pending",

          github_owner:
            repository.owner.login,

          github_repo:
            repository.name,

          github_repo_id:
            repository.id,

          github_url:
            repository.html_url,

          verification_score:
            verificationScore,
        })
        .eq(
          "id",
          project.id
        )
        .eq(
          "user_id",
          user.id
        )
        .select(
          `
            id,
            project_name,
            verification_status,
            github_owner,
            github_repo,
            github_repo_id,
            github_url,
            verification_score
          `
        )
        .maybeSingle();

    if (updateError) {
      console.error(
        "Project update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "GitHub evidence was collected, but the project could not be updated.",
        },
        { status: 500 }
      );
    }

    // ========================================================
    // 16. BUILD EVIDENCE PAYLOAD
    // ========================================================

    const evidencePayload = {
      project_id:
        project.id,

      user_id:
        user.id,

      github_repo_id:
        repository.id,

      github_owner:
        repository.owner.login,

      github_repo:
        repository.name,

      github_url:
        repository.html_url,

      default_branch:
        repository.default_branch,

      commit_count:
        commitCount,

      pull_request_count:
        pullRequestCount,

      contributor_count:
        contributorCount,

      first_commit_at:
        firstCommitAt,

      last_commit_at:
        lastCommitAt,

      evidence_type:
        "github_repository",

      evidence_json: {
        repository: {
          id:
            repository.id,

          owner:
            repository.owner.login,

          name:
            repository.name,

          full_name:
            repository.full_name,

          url:
            repository.html_url,

          private:
            repository.private,

          default_branch:
            repository.default_branch,
        },

        commits:
          commits
            .slice(0, 50)
            .map(
              (commit) => ({
                sha:
                  commit.sha,

                url:
                  commit.html_url,

                message:
                  commit.commit.message,

                author:
                  commit.commit
                    .author
                    ?.name ??
                  null,

                email:
                  commit.commit
                    .author
                    ?.email ??
                  null,

                date:
                  commit.commit
                    .author
                    ?.date ??
                  null,

                github_login:
                  commit.author
                    ?.login ??
                  null,
              })
            ),

        pull_requests:
          mergedPullRequests
            .slice(0, 50)
            .map(
              (pullRequest) => ({
                number:
                  pullRequest.number,

                title:
                  pullRequest.title,

                url:
                  pullRequest.html_url,

                state:
                  pullRequest.state,

                merged_at:
                  pullRequest.merged_at,

                author:
                  pullRequest.user
                    ?.login ??
                  null,
              })
            ),

        contributors:
          contributors
            .slice(0, 50)
            .map(
              (contributor) => ({
                login:
                  contributor.login,

                contributions:
                  contributor.contributions,
              })
            ),
      },

      metadata: {
        source:
          "github",

        verification_score:
          verificationScore,

        fetched_at:
          fetchedAt,
      },

      fetched_at:
        fetchedAt,
    };

    // ========================================================
    // 17. FIND EXISTING EVIDENCE
    // ========================================================

    const {
      data: existingEvidence,
      error: evidenceLookupError,
    } =
      await supabase
        .from(
          "project_verification_evidence"
        )
        .select("id")
        .eq(
          "project_id",
          project.id
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    let evidenceRecord:
      | EvidenceRecord
      | null = null;

    let evidenceError:
      | {
          message: string;
          code?: string;
          hint?: string | null;
          details?: string | null;
        }
      | null = null;

    // ========================================================
    // 18. SAVE EVIDENCE
    // ========================================================

    if (evidenceLookupError) {
      console.error(
        "Evidence lookup warning:",
        evidenceLookupError
      );

      evidenceError =
        evidenceLookupError;
    } else if (
      existingEvidence?.id
    ) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "project_verification_evidence"
          )
          .update(
            evidencePayload
          )
          .eq(
            "id",
            existingEvidence.id
          )
          .eq(
            "project_id",
            project.id
          )
          .eq(
            "user_id",
            user.id
          )
          .select(
            `
              id,
              project_id,
              user_id,
              github_repo_id,
              github_owner,
              github_repo,
              github_url,
              default_branch,
              commit_count,
              pull_request_count,
              contributor_count,
              first_commit_at,
              last_commit_at,
              evidence_json,
              fetched_at,
              created_at,
              evidence_type,
              metadata
            `
          )
          .maybeSingle();

      evidenceRecord =
        data as EvidenceRecord | null;

      evidenceError =
        error;
    } else {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "project_verification_evidence"
          )
          .insert(
            evidencePayload
          )
          .select(
            `
              id,
              project_id,
              user_id,
              github_repo_id,
              github_owner,
              github_repo,
              github_url,
              default_branch,
              commit_count,
              pull_request_count,
              contributor_count,
              first_commit_at,
              last_commit_at,
              created_at,
              evidence_type,
              metadata,
              evidence_json,
              fetched_at
            `
          )
          .maybeSingle();

      evidenceRecord =
        data as EvidenceRecord | null;

      evidenceError =
        error;
    }

    if (evidenceError) {
      console.error(
        "Evidence insert/update warning:",
        evidenceError
      );
    }

    // ========================================================
    // 19. SAVE VERIFICATION EVENT
    // ========================================================

    const eventPayload = {
      project_id:
        project.id,

      user_id:
        user.id,

      actor_id:
        user.id,

      event_type:
        "evidence_fetched",

      metadata: {
        github_owner:
          repository.owner.login,

        github_repo:
          repository.name,

        github_repo_id:
          repository.id,

        github_url:
          repository.html_url,

        default_branch:
          repository.default_branch,

        commit_count:
          commitCount,

        pull_request_count:
          pullRequestCount,

        contributor_count:
          contributorCount,

        verification_score:
          verificationScore,

        verification_status:
          "pending",

        evidence_id:
          evidenceRecord?.id ??
          null,

        fetched_at:
          fetchedAt,
      },
    };

    const {
      data: eventRecord,
      error: eventError,
    } =
      await supabase
        .from(
          "project_verification_events"
        )
        .insert(
          eventPayload
        )
        .select(
          `
            id,
            project_id,
            user_id,
            actor_id,
            event_type,
            metadata,
            created_at
          `
        )
        .maybeSingle();

    if (eventError) {
      console.error(
        "Event insert warning:",
        eventError
      );
    }

    // ========================================================
    // 20. RETURN SAFE RESPONSE
    // ========================================================

    const warnings: string[] =
      [];

    if (evidenceError) {
      warnings.push(
        "Verification evidence could not be saved."
      );
    }

    if (eventError) {
      warnings.push(
        "Verification event could not be saved."
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "GitHub project verification completed successfully.",

      verification: {
        project_id:
          project.id,

        project_name:
          project.project_name,

        github_owner:
          repository.owner.login,

        github_repo:
          repository.name,

        github_url:
          repository.html_url,

        default_branch:
          repository.default_branch,

        verification_status:
          updatedProject
            ?.verification_status ??
          "pending",

        verification_score:
          verificationScore,
      },

      evidence: {
        id:
          evidenceRecord?.id ??
          null,

        project_id:
          project.id,

        user_id:
          user.id,

        github_owner:
          repository.owner.login,

        github_repo:
          repository.name,

        github_repo_id:
          repository.id,

        github_url:
          repository.html_url,

        default_branch:
          repository.default_branch,

        commit_count:
          commitCount,

        pull_request_count:
          pullRequestCount,

        contributor_count:
          contributorCount,

        first_commit_at:
          firstCommitAt,

        last_commit_at:
          lastCommitAt,

        verification_score:
          verificationScore,

        evidence_type:
          "github_repository",

        fetched_at:
          fetchedAt,
      },

      event: {
        id:
          eventRecord?.id ??
          null,

        event_type:
          eventRecord?.event_type ??
          "evidence_fetched",

        created_at:
          eventRecord?.created_at ??
          null,
      },

      warnings,
    });
  } catch (error) {
    console.error(
      "GitHub verification error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "GitHub verification failed. Please check your GitHub connection and try again.",
      },
      { status: 500 }
    );
  }
}