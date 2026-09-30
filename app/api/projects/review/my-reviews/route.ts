import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

function createUserSupabase(
  accessToken: string
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase configuration is unavailable."
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
          Authorization:
            `Bearer ${accessToken}`,
        },
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
      accessToken: null,
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
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  if (!tokenMatch) {
    return {
      user: null,
      accessToken: null,
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
      accessToken: null,
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
      accessToken,
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
    accessToken,
    error: null,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    /*
     * -------------------------------------------------------
     * 1. Authenticate current Vertex user
     * -------------------------------------------------------
     */

    const auth =
      await authenticateRequest(request);

    if (
      auth.error ||
      !auth.user ||
      !auth.accessToken
    ) {
      return (
        auth.error ||
        NextResponse.json(
          {
            success: false,
            error:
              "Authentication required.",
          },
          { status: 401 }
        )
      );
    }

    const reviewerId =
      auth.user.id;

    /*
     * -------------------------------------------------------
     * 2. Create user-scoped Supabase client
     * -------------------------------------------------------
     */

    const supabase =
      createUserSupabase(
        auth.accessToken
      );

    /*
     * -------------------------------------------------------
     * 3. Load only reviews assigned to the
     *    authenticated user
     * -------------------------------------------------------
     *
     * IMPORTANT:
     * reviewer_id comes exclusively from the authenticated
     * Supabase user. It is never accepted from the request.
     */

    const {
      data: reviews,
      error: reviewsError,
    } =
      await supabase
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
          "reviewer_id",
          reviewerId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (reviewsError) {
      console.error(
        "Reviewer reviews query failed:",
        reviewsError.code
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load assigned reviews.",
        },
        { status: 500 }
      );
    }

    /*
     * -------------------------------------------------------
     * 4. Return only reviewer-scoped information
     * -------------------------------------------------------
     */

    return NextResponse.json({
      success: true,
      reviewer_id: reviewerId,
      reviews: reviews ?? [],
      count:
        reviews?.length ?? 0,
    });
  } catch (error) {
    console.error(
      "My reviews API failed:",
      error instanceof Error
        ? error.name
        : "Unknown error"
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to load reviewer dashboard.",
      },
      { status: 500 }
    );
  }
}