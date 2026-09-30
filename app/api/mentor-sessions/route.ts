
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// --------------------------------------------------
// AUTH CLIENT
// --------------------------------------------------

const authClient = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// --------------------------------------------------
// ADMIN/SERVER CLIENT
// --------------------------------------------------

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

// --------------------------------------------------
// AUTHENTICATION HELPER
// --------------------------------------------------

async function authenticateRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Invalid authorization header." },
        { status: 401 }
      ),
    };
  }

  const accessToken = tokenMatch[1];

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(accessToken);

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

// --------------------------------------------------
// POST
// --------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate request
    const {
      user,
      response: authResponse,
    } = await authenticateRequest(request);

    if (authResponse || !user) {
      return authResponse!;
    }

    // Never trust userId from request body.
    const authenticatedUserId = user.id;

    // 2. Parse and validate request
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { sessionId, action } = body as {
      sessionId?: unknown;
      action?: unknown;
    };

    if (
      typeof sessionId !== "string" ||
      !sessionId.trim()
    ) {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    const cleanSessionId = sessionId.trim();

    const allowedActions = [
      "create_room",
      "start",
      "end",
      "cancel",
      "get",
    ];

    if (
      typeof action !== "string" ||
      !allowedActions.includes(action)
    ) {
      return NextResponse.json(
        { error: "Invalid action." },
        { status: 400 }
      );
    }

    // 3. Load session belonging to authenticated participant
    const {
      data: session,
      error: sessionError,
    } = await supabaseAdmin
      .from("mentor_sessions")
      .select(`
        id,
        mentor_id,
        student_id,
        scheduled_at,
        duration_minutes,
        session_type,
        status,
        session_price,
        currency,
        payment_status,
        video_room_url
      `)
      .eq("id", cleanSessionId)
      .or(
        `student_id.eq.${authenticatedUserId},mentor_id.eq.${authenticatedUserId}`
      )
      .maybeSingle();

    if (sessionError) {
      console.error("Mentor session lookup failed:", {
        code: sessionError.code,
        message: sessionError.message,
      });

      return NextResponse.json(
        { error: "Unable to load mentor session." },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: "Mentor session not found." },
        { status: 404 }
      );
    }

    const isStudent = session.student_id === authenticatedUserId;
    const isMentor = session.mentor_id === authenticatedUserId;

    // Session query already enforces participant ownership.
    if (!isStudent && !isMentor) {
      return NextResponse.json(
        { error: "You are not allowed to access this session." },
        { status: 403 }
      );
    }

    // 4. CREATE VIDEO ROOM
    if (action === "create_room") {
      if (session.status === "cancelled") {
        return NextResponse.json(
          { error: "This session has been cancelled." },
          { status: 400 }
        );
      }

      // Paid sessions require completed payment.
      if (
        session.payment_status === "pending" &&
        Number(session.session_price) > 0
      ) {
        return NextResponse.json(
          {
            error:
              "Payment is required before joining this paid session.",
            paymentRequired: true,
          },
          { status: 402 }
        );
      }

      // Reuse existing room.
      if (session.video_room_url) {
        return NextResponse.json({
          success: true,
          video_room_url: session.video_room_url,
          videoRoomUrl: session.video_room_url,
          reused: true,
        });
      }

      // Generate a unique Jitsi room name.
      const roomName = `vertex-mentor-${session.id}`.replace(
        /[^a-zA-Z0-9-_]/g,
        ""
      );

      const videoRoomUrl = `https://meet.jit.si/${roomName}`;

      const {
        data: updatedSession,
        error: updateError,
      } = await supabaseAdmin
        .from("mentor_sessions")
        .update({
          video_room_url: videoRoomUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
        .or(
          `student_id.eq.${authenticatedUserId},mentor_id.eq.${authenticatedUserId}`
        )
        .select("id, video_room_url")
        .maybeSingle();

      if (updateError) {
        console.error("Video room update failed:", {
          code: updateError.code,
          message: updateError.message,
        });

        return NextResponse.json(
          { error: "Could not save the video room." },
          { status: 500 }
        );
      }

      if (!updatedSession?.video_room_url) {
        return NextResponse.json(
          { error: "Video room could not be saved." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        video_room_url: updatedSession.video_room_url,
        videoRoomUrl: updatedSession.video_room_url,
        reused: false,
      });
    }

    // 5. START SESSION
    if (action === "start") {
      if (session.status === "cancelled") {
        return NextResponse.json(
          { error: "A cancelled session cannot be started." },
          { status: 400 }
        );
      }

      if (session.status === "completed") {
        return NextResponse.json(
          { error: "This session has already been completed." },
          { status: 400 }
        );
      }

      // Require payment before starting a paid session.
      if (
        session.payment_status === "pending" &&
        Number(session.session_price) > 0
      ) {
        return NextResponse.json(
          {
            error:
              "Payment is required before starting this paid session.",
            paymentRequired: true,
          },
          { status: 402 }
        );
      }

      const now = new Date().toISOString();

      const {
        data: updatedSession,
        error,
      } = await supabaseAdmin
        .from("mentor_sessions")
        .update({
          status: "confirmed",
          meeting_started_at: now,
          updated_at: now,
        })
        .eq("id", session.id)
        .or(
          `student_id.eq.${authenticatedUserId},mentor_id.eq.${authenticatedUserId}`
        )
        .select(`
          id,
          status,
          payment_status,
          meeting_started_at,
          updated_at
        `)
        .maybeSingle();

      if (error) {
        console.error("Start session failed:", {
          code: error.code,
          message: error.message,
        });

        return NextResponse.json(
          { error: "Could not start the session." },
          { status: 500 }
        );
      }

      if (!updatedSession) {
        return NextResponse.json(
          { error: "The session could not be updated." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        session: updatedSession,
      });
    }

    // 6. END SESSION
    if (action === "end") {
      if (session.status === "cancelled") {
        return NextResponse.json(
          { error: "A cancelled session cannot be completed." },
          { status: 400 }
        );
      }

      if (session.status === "completed") {
        return NextResponse.json({
          success: true,
          session,
          message: "Session has already been completed.",
        });
      }

      const now = new Date().toISOString();

      const {
        data: updatedSession,
        error,
      } = await supabaseAdmin
        .from("mentor_sessions")
        .update({
          status: "completed",
          meeting_ended_at: now,
          updated_at: now,
        })
        .eq("id", session.id)
        .or(
          `student_id.eq.${authenticatedUserId},mentor_id.eq.${authenticatedUserId}`
        )
        .select(`
          id,
          status,
          payment_status,
          meeting_started_at,
          meeting_ended_at,
          updated_at
        `)
        .maybeSingle();

      if (error) {
        console.error("End session failed:", {
          code: error.code,
          message: error.message,
        });

        return NextResponse.json(
          { error: "Could not complete the session." },
          { status: 500 }
        );
      }

      if (!updatedSession) {
        return NextResponse.json(
          { error: "The session could not be updated." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        session: updatedSession,
      });
    }

    // 7. CANCEL SESSION
    if (action === "cancel") {
      if (session.status === "completed") {
        return NextResponse.json(
          { error: "A completed session cannot be cancelled." },
          { status: 400 }
        );
      }

      if (session.status === "cancelled") {
        return NextResponse.json({
          success: true,
          session,
          message: "Session has already been cancelled.",
        });
      }

      const {
        data: updatedSession,
        error,
      } = await supabaseAdmin
        .from("mentor_sessions")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
        .or(
          `student_id.eq.${authenticatedUserId},mentor_id.eq.${authenticatedUserId}`
        )
        .select(`
          id,
          status,
          payment_status,
          updated_at
        `)
        .maybeSingle();

      if (error) {
        console.error("Cancel session failed:", {
          code: error.code,
          message: error.message,
        });

        return NextResponse.json(
          { error: "Could not cancel the session." },
          { status: 500 }
        );
      }

      if (!updatedSession) {
        return NextResponse.json(
          { error: "The session could not be updated." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        session: updatedSession,
      });
    }

    // 8. GET SESSION
    if (action === "get") {
      return NextResponse.json({
        success: true,
        session,
      });
    }

    return NextResponse.json(
      { error: "Invalid action." },
      { status: 400 }
    );
  } catch (error) {
    // Avoid logging request bodies, tokens, or payment secrets.
    console.error(
      "Mentor session API error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to process mentor session request." },
      { status: 500 }
    );
  }
}