import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client used only to verify the user's access token.
const authClient = createClient(
  supabaseUrl,
  anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Service-role client is used only AFTER admin authorization.
const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function requireAdmin(request: Request) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      ),
    };
  }

  const tokenMatch =
    authorization.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      ),
    };
  }

  const accessToken = tokenMatch[1];

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      ),
    };
  }

  // Check whether the authenticated user is a
  // platform administrator.
  const {
    data: adminRecord,
    error: adminError,
  } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

 if (adminError) {

  return {
    response: NextResponse.json(
      { error: "Failed to verify administrator access." },
      { status: 500 }
    ),
  };
}

  if (!adminRecord) {
    return {
      error: NextResponse.json(
        { error: "Forbidden." },
        { status: 403 }
      ),
    };
  }

  return {
    user,
  };
}

export async function GET(request: Request) {
  try {
    const authorization =
      await requireAdmin(request);

    if (authorization.error) {
      return authorization.error;
    }

    const { data, error } =
      await supabaseAdmin
        .from("mentor_verifications")
        .select(`
          id,
          mentor_id,
          document_type,
          document_url,
          submitted_at,
          reviewed_at,
          status,
          reviewer_note,
          mentors (
            id,
            user_id,
            full_name,
            college,
            branch,
            graduation_year,
            current_company,
            job_role,
            bio,
            skills,
            years_experience,
            target_roles,
            company_tiers,
            linkedin_url,
            github_url,
            verification_status,
            verification_note,
            session_price,
            currency,
            is_available,
            average_rating,
            total_reviews,
            total_sessions,
            created_at
          )
        `)
        .eq("status", "pending")
        .order("submitted_at", {
          ascending: false,
        });

    if (error) {
      console.error(
        "Admin mentor verification fetch error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Failed to load mentor verification requests.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      verifications: data ?? [],
    });
  } catch (error) {
    console.error(
      "Admin mentor verification GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load mentor verification requests.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authorization =
      await requireAdmin(request);

    if (authorization.error) {
      return authorization.error;
    }

    const body = await request.json();

    const {
      verificationId,
      mentorId,
      action,
      reviewerNote,
    } = body;

    if (
      typeof verificationId !== "string" ||
      typeof mentorId !== "string" ||
      !verificationId ||
      !mentorId ||
      !action
    ) {
      return NextResponse.json(
        {
          error:
            "verificationId, mentorId and action are required.",
        },
        { status: 400 }
      );
    }

    if (
      action !== "approve" &&
      action !== "reject"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid action. Use approve or reject.",
        },
        { status: 400 }
      );
    }

    if (
      reviewerNote !== undefined &&
      reviewerNote !== null &&
      typeof reviewerNote !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "reviewerNote must be a string.",
        },
        { status: 400 }
      );
    }

    const cleanReviewerNote =
      typeof reviewerNote === "string"
        ? reviewerNote.trim()
        : "";

    // Make sure the verification request actually
    // belongs to the supplied mentor before changing it.
    const {
      data: verification,
      error: lookupError,
    } = await supabaseAdmin
      .from("mentor_verifications")
      .select("id, mentor_id, status")
      .eq("id", verificationId)
      .eq("mentor_id", mentorId)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "Mentor verification lookup error:",
        lookupError
      );

      return NextResponse.json(
        {
          error:
            "Failed to validate mentor verification.",
        },
        { status: 500 }
      );
    }

    if (!verification) {
      return NextResponse.json(
        {
          error:
            "Mentor verification request not found.",
        },
        { status: 404 }
      );
    }

    if (verification.status !== "pending") {
      return NextResponse.json(
        {
          error:
            "This mentor verification request has already been reviewed.",
        },
        { status: 409 }
      );
    }

    if (action === "reject" && !cleanReviewerNote) {
      return NextResponse.json(
        {
          error:
            "Please provide a rejection reason.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (action === "approve") {
      const {
        error: verificationError,
      } = await supabaseAdmin
        .from("mentor_verifications")
        .update({
          status: "approved",
          reviewed_at: now,
          reviewer_note:
            cleanReviewerNote || null,
        })
        .eq("id", verificationId)
        .eq("mentor_id", mentorId)
        .eq("status", "pending");

      if (verificationError) {
        console.error(
          "Verification approval error:",
          verificationError
        );

        return NextResponse.json(
          {
            error:
              "Failed to approve mentor verification.",
          },
          { status: 500 }
        );
      }

      const {
        error: mentorError,
      } = await supabaseAdmin
        .from("mentors")
        .update({
          verification_status: "verified",
          verified_at: now,
          verification_note:
            cleanReviewerNote || null,
        })
        .eq("id", mentorId);

      if (mentorError) {
        console.error(
          "Mentor approval update error:",
          mentorError
        );

        return NextResponse.json(
          {
            error:
              "Failed to update mentor verification status.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "Mentor approved successfully.",
      });
    }

    if (action === "reject") {
      const {
        error: verificationError,
      } = await supabaseAdmin
        .from("mentor_verifications")
        .update({
          status: "rejected",
          reviewed_at: now,
          reviewer_note: cleanReviewerNote,
        })
        .eq("id", verificationId)
        .eq("mentor_id", mentorId)
        .eq("status", "pending");

      if (verificationError) {
        console.error(
          "Verification rejection error:",
          verificationError
        );

        return NextResponse.json(
          {
            error:
              "Failed to reject mentor verification.",
          },
          { status: 500 }
        );
      }

      const {
        error: mentorError,
      } = await supabaseAdmin
        .from("mentors")
        .update({
          verification_status: "rejected",
          verification_note:
            cleanReviewerNote,
        })
        .eq("id", mentorId);

      if (mentorError) {
        console.error(
          "Mentor rejection update error:",
          mentorError
        );

        return NextResponse.json(
          {
            error:
              "Failed to update mentor verification status.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "Mentor rejected successfully.",
      });
    }

    return NextResponse.json(
      {
        error: "Invalid request.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "Admin mentor verification POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to process mentor verification.",
      },
      { status: 500 }
    );
  }
}
