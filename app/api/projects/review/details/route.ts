import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createUserSupabase(accessToken: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

function createAdminSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase service-role environment variable is missing."
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

export async function GET(request: Request) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Read Vertex access token
     * ---------------------------------------------------------
     */

    const authorization =
      request.headers.get("authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing authentication token.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authorization
        .substring("Bearer ".length)
        .trim();

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid authentication token.",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. Authenticate reviewer with normal Supabase client
     * ---------------------------------------------------------
     */

    const userSupabase =
      createUserSupabase(accessToken);

    const {
      data: userData,
      error: userError,
    } =
      await userSupabase.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !userData.user
    ) {
      console.error(
        "Reviewer authentication error:",
        userError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired session. Please log in again.",
        },
        { status: 401 }
      );
    }

    const reviewerId =
      userData.user.id;

    /*
     * ---------------------------------------------------------
     * 3. Read review_id
     * ---------------------------------------------------------
     */

    const url =
      new URL(request.url);

    const reviewId =
      url.searchParams.get(
        "review_id"
      );

    if (!reviewId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "review_id is required.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Verify that this review belongs to this reviewer
     *
     * IMPORTANT:
     * We perform this check using the user's authenticated
     * Supabase client before using the service-role client.
     * ---------------------------------------------------------
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
        "Review lookup error:",
        reviewError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to read review.",
          details:
            reviewError.message,
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
     * ---------------------------------------------------------
     * 5. Create server-side admin client
     * ---------------------------------------------------------
     *
     * This client is NEVER sent to the browser.
     * The service-role key stays on the server.
     * ---------------------------------------------------------
     */

    const adminSupabase =
      createAdminSupabase();

    /*
     * ---------------------------------------------------------
     * 6. Fetch project details
     * ---------------------------------------------------------
     *
     * We already verified:
     *
     * reviewerId -> reviewId -> projectId
     *
     * Therefore the reviewer can only request the project
     * attached to their assigned review.
     * ---------------------------------------------------------
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
        "Project details error:",
        projectError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to read project details.",
          details:
            projectError.message,
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
     * ---------------------------------------------------------
     * 7. Fetch GitHub verification evidence
     * ---------------------------------------------------------
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
        "Evidence lookup warning:",
        evidenceError
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. Return everything needed by reviewer dashboard
     * ---------------------------------------------------------
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
      "Review details API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to load review details.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      { status: 500 }
    );
  }
}