import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const authClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function createAdminSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase service configuration is unavailable."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function authenticateRequest(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      ),
    };
  }

  const tokenMatch =
    authorization.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          error:
            "Invalid authentication header.",
        },
        { status: 401 }
      ),
    };
  }

  const accessToken =
    tokenMatch[1].trim();

  if (!accessToken) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          error:
            "Authentication token is missing.",
        },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } =
    await authClient.auth.getUser(
      accessToken
    );

  if (authError || !user) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired session.",
        },
        { status: 401 }
      ),
    };
  }

  return {
    user,
    error: null,
  };
}

function isValidReviewId(
  value: string | null
) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();

  return (
    trimmed.length > 0 &&
    trimmed.length <= 100
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    /*
     * -------------------------------------------------------
     * 1. Authenticate the Vertex user
     * -------------------------------------------------------
     */

    const auth =
      await authenticateRequest(request);

    if (auth.error || !auth.user) {
      return (
        auth.error ||
        NextResponse.json(
          {
            success: false,
            error: "Authentication required.",
          },
          { status: 401 }
        )
      );
    }

    const reviewerId =
      auth.user.id;

    /*
     * -------------------------------------------------------
     * 2. Read and validate review_id
     * -------------------------------------------------------
     */

    const url =
      new URL(request.url);

    const reviewId =
      url.searchParams.get(
        "review_id"
      );

    if (!isValidReviewId(reviewId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid review_id is required.",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * 3. Create a user-scoped Supabase client
     * -------------------------------------------------------
     *
     * We authenticate the token first and then create
     * a client carrying that same token so RLS applies.
     */

    const authorization =
      request.headers.get("authorization")!;

    const tokenMatch =
      authorization.match(
        /^Bearer\s+(.+)$/i
      );

    if (!tokenMatch) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid authentication header.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      tokenMatch[1].trim();

    const userSupabase =
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

    /*
     * -------------------------------------------------------
     * 4. Verify that the review belongs to the
     *    authenticated reviewer
     * -------------------------------------------------------
     */

    const {
      data: review,
      error: reviewError,
    } =
      await userSupabase
        .from("project_reviews")
        .select(
          `
            id,
            project_id,
            reviewer_id,
            reviewer_role,
            status,
            score,
            feedback,
            reviewed_at,
            created_at
          `
        )
        .eq(
          "id",
          reviewId
        )
        .eq(
          "reviewer_id",
          reviewerId
        )
        .maybeSingle();

    if (reviewError) {
      console.error(
        "Review details lookup failed:",
        reviewError.code
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to read review details.",
        },
        { status: 500 }
      );
    }

    if (!review) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Review not found or you are not the assigned reviewer.",
        },
        { status: 404 }
      );
    }

    /*
     * -------------------------------------------------------
     * 5. Use service role only after authorization
     * -------------------------------------------------------
     */

    let adminSupabase;

    try {
      adminSupabase =
        createAdminSupabase();
    } catch (error) {
      console.error(
        "Admin Supabase client creation failed:",
        error instanceof Error
          ? error.name
          : "Unknown error"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load review details.",
        },
        { status: 500 }
      );
    }

    /*
     * -------------------------------------------------------
     * 6. Fetch the project attached to this review
     * -------------------------------------------------------
     *
     * project_id comes from the verified review.
     * It is NOT accepted from the request.
     */

    const {
      data: project,
      error: projectError,
    } =
      await adminSupabase
        .from("projects")
        .select(
          `
            id,
            project_name,
            description,
            tech_stack,
            project_url,
            verification_status,
            verification_score,
            github_owner,
            github_repo,
            github_url
          `
        )
        .eq(
          "id",
          review.project_id
        )
        .maybeSingle();

    if (projectError) {
      console.error(
        "Project details lookup failed:",
        projectError.code
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load project details.",
        },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Project details are unavailable.",
        },
        { status: 404 }
      );
    }

    /*
     * -------------------------------------------------------
     * 7. Fetch GitHub verification evidence
     * -------------------------------------------------------
     *
     * Evidence is scoped to the project attached to the
     * authenticated review.
     */

    const {
      data: evidence,
      error: evidenceError,
    } =
      await adminSupabase
        .from(
          "project_verification_evidence"
        )
        .select(
          `
            id,
            project_id,
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
            evidence_type,
            fetched_at
          `
        )
        .eq(
          "project_id",
          review.project_id
        )
        .maybeSingle();

    if (evidenceError) {
      console.error(
        "Evidence lookup failed:",
        evidenceError.code
      );

      /*
       * Evidence is supplementary. We still return the
       * review and project when evidence is unavailable.
       */
    }

    /*
     * -------------------------------------------------------
     * 8. Return only required data
     * -------------------------------------------------------
     */

    return NextResponse.json({
      success: true,
      review,
      project,
      evidence:
        evidence ?? null,
    });
  } catch (error) {
    console.error(
      "Review details API failed:",
      error instanceof Error
        ? error.name
        : "Unknown error"
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to load review details.",
      },
      { status: 500 }
    );
  }
}