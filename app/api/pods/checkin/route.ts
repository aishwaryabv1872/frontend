import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/*
  Client used ONLY to verify the user's access token.
  Never use the service-role key for authentication.
*/
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

/*
  Privileged server-side database client.
  Never expose this client or key to browser code.
*/
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

async function authenticate(request: NextRequest) {
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

  const tokenMatch =
    authorization.match(/^Bearer\s+(.+)$/i);

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
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    console.error("CHECKIN AUTH ERROR:", authError);

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

export async function POST(request: NextRequest) {
  try {
    // =====================================================
    // 1. AUTHENTICATE USER
    // =====================================================

    const { user, response } = await authenticate(request);

    if (response || !user) {
      return response!;
    }

    /*
      SECURITY:
      Never trust userId from the browser.
      The authenticated Supabase user is the identity.
    */
    const userId = user.id;

    // =====================================================
    // 2. READ REQUEST BODY
    // =====================================================

    const body = await request.json();

    const {
      action = "schedule",
      checkinId,
      scheduledAt,
      videoRoomUrl,
      meetingNotes,
      attendeeUserId,
      attended,
    } = body;

    // =====================================================
    // 3. LOAD ACTIVE POD MEMBERSHIP
    // =====================================================

    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from("pod_members")
      .select("id, pod_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      console.error(
        "CHECKIN MEMBERSHIP ERROR:",
        membershipError
      );

      return NextResponse.json(
        { error: "Failed to load pod membership." },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "You are not currently a member of an active pod.",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // 4. SCHEDULE CHECK-IN
    // =====================================================

    if (action === "schedule") {
      if (membership.role !== "leader") {
        return NextResponse.json(
          {
            error:
              "Only the pod leader can schedule a group check-in.",
          },
          { status: 403 }
        );
      }

      if (!scheduledAt) {
        return NextResponse.json(
          {
            error:
              "Scheduled date and time are required.",
          },
          { status: 400 }
        );
      }

      const scheduledDate = new Date(scheduledAt);

      if (Number.isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          {
            error:
              "Invalid scheduled date and time.",
          },
          { status: 400 }
        );
      }

      const roomUrl =
        typeof videoRoomUrl === "string" &&
        videoRoomUrl.trim()
          ? videoRoomUrl.trim()
          : `https://meet.jit.si/vertex-pod-${membership.pod_id}-${Date.now()}`;

      const {
        data: checkin,
        error: checkinError,
      } = await supabaseAdmin
        .from("pod_checkins")
        .insert({
          pod_id: membership.pod_id,
          scheduled_at: scheduledDate.toISOString(),
          status: "scheduled",
          video_room_url: roomUrl,
          created_by: userId,
        })
        .select("*")
        .single();

      if (checkinError) {
        console.error(
          "CHECKIN CREATE ERROR:",
          checkinError
        );

        return NextResponse.json(
          { error: "Failed to schedule check-in." },
          { status: 500 }
        );
      }

      const { error: podUpdateError } =
        await supabaseAdmin
          .from("accountability_pods")
          .update({
            next_checkin_at:
              scheduledDate.toISOString(),
            video_room_url: roomUrl,
          })
          .eq("id", membership.pod_id);

      if (podUpdateError) {
        console.error(
          "POD CHECKIN UPDATE ERROR:",
          podUpdateError
        );

        return NextResponse.json({
          success: true,
          warning:
            "Check-in scheduled, but pod summary could not be updated.",
          checkin,
        });
      }

      return NextResponse.json({
        success: true,
        checkin,
      });
    }

    // =====================================================
    // 5. ATTENDANCE
    // =====================================================

    if (action === "attendance") {
      if (!checkinId) {
        return NextResponse.json(
          { error: "checkinId is required." },
          { status: 400 }
        );
      }

      const {
        data: checkin,
        error: checkinError,
      } = await supabaseAdmin
        .from("pod_checkins")
        .select("id, pod_id")
        .eq("id", checkinId)
        .eq("pod_id", membership.pod_id)
        .maybeSingle();

      if (checkinError) {
        console.error(
          "CHECKIN LOOKUP ERROR:",
          checkinError
        );

        return NextResponse.json(
          { error: "Failed to load check-in." },
          { status: 500 }
        );
      }

      if (!checkin) {
        return NextResponse.json(
          { error: "Check-in not found." },
          { status: 404 }
        );
      }

      /*
        Users may only record attendance for themselves.
      */
      if (
        attendeeUserId &&
        attendeeUserId !== userId
      ) {
        return NextResponse.json(
          {
            error:
              "You can only update your own attendance.",
          },
          { status: 403 }
        );
      }

      const hasAttended = attended !== false;

      const {
        data: existingAttendance,
        error: attendanceLookupError,
      } = await supabaseAdmin
        .from("pod_checkin_attendance")
        .select("id")
        .eq("checkin_id", checkinId)
        .eq("user_id", userId)
        .maybeSingle();

      if (attendanceLookupError) {
        console.error(
          "ATTENDANCE LOOKUP ERROR:",
          attendanceLookupError
        );

        return NextResponse.json(
          { error: "Failed to load attendance." },
          { status: 500 }
        );
      }

      if (existingAttendance) {
        const { error: updateError } =
          await supabaseAdmin
            .from("pod_checkin_attendance")
            .update({
              attended: hasAttended,
              joined_at: hasAttended
                ? new Date().toISOString()
                : null,
            })
            .eq("id", existingAttendance.id);

        if (updateError) {
          console.error(
            "ATTENDANCE UPDATE ERROR:",
            updateError
          );

          return NextResponse.json(
            { error: "Failed to update attendance." },
            { status: 500 }
          );
        }
      } else {
        const { error: insertError } =
          await supabaseAdmin
            .from("pod_checkin_attendance")
            .insert({
              checkin_id: checkinId,
              pod_id: membership.pod_id,
              user_id: userId,
              attended: hasAttended,
              joined_at: hasAttended
                ? new Date().toISOString()
                : null,
            });

        if (insertError) {
          console.error(
            "ATTENDANCE INSERT ERROR:",
            insertError
          );

          return NextResponse.json(
            { error: "Failed to record attendance." },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        attended: hasAttended,
      });
    }

    // =====================================================
    // 6. START CHECK-IN
    // =====================================================

    if (action === "start") {
      if (!checkinId) {
        return NextResponse.json(
          { error: "checkinId is required." },
          { status: 400 }
        );
      }

      const {
        data: checkin,
        error: checkinLookupError,
      } = await supabaseAdmin
        .from("pod_checkins")
        .select("id, pod_id, status")
        .eq("id", checkinId)
        .eq("pod_id", membership.pod_id)
        .maybeSingle();

      if (checkinLookupError) {
        console.error(
          "START CHECKIN LOOKUP ERROR:",
          checkinLookupError
        );

        return NextResponse.json(
          { error: "Failed to load check-in." },
          { status: 500 }
        );
      }

      if (!checkin) {
        return NextResponse.json(
          { error: "Check-in not found." },
          { status: 404 }
        );
      }

      /*
        Only the pod leader should control the meeting state.
      */
      if (membership.role !== "leader") {
        return NextResponse.json(
          {
            error:
              "Only the pod leader can start the check-in.",
          },
          { status: 403 }
        );
      }

      const { error: updateError } =
        await supabaseAdmin
          .from("pod_checkins")
          .update({
            status: "live",
          })
          .eq("id", checkinId)
          .eq("pod_id", membership.pod_id);

      if (updateError) {
        console.error(
          "START CHECKIN UPDATE ERROR:",
          updateError
        );

        return NextResponse.json(
          { error: "Failed to start check-in." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        status: "live",
      });
    }

    // =====================================================
    // 7. END CHECK-IN
    // =====================================================

    if (action === "end") {
      if (!checkinId) {
        return NextResponse.json(
          { error: "checkinId is required." },
          { status: 400 }
        );
      }

      if (membership.role !== "leader") {
        return NextResponse.json(
          {
            error:
              "Only the pod leader can end the check-in.",
          },
          { status: 403 }
        );
      }

      const { error: updateError } =
        await supabaseAdmin
          .from("pod_checkins")
          .update({
            status: "completed",
            ended_at: new Date().toISOString(),
            meeting_notes:
              typeof meetingNotes === "string"
                ? meetingNotes.trim()
                : null,
          })
          .eq("id", checkinId)
          .eq("pod_id", membership.pod_id);

      if (updateError) {
        console.error(
          "END CHECKIN UPDATE ERROR:",
          updateError
        );

        return NextResponse.json(
          { error: "Failed to end check-in." },
          { status: 500 }
        );
      }

      const {
        data: nextCheckin,
      } = await supabaseAdmin
        .from("pod_checkins")
        .select("scheduled_at, video_room_url")
        .eq("pod_id", membership.pod_id)
        .eq("status", "scheduled")
        .order("scheduled_at", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      await supabaseAdmin
        .from("accountability_pods")
        .update({
          next_checkin_at:
            nextCheckin?.scheduled_at ?? null,
          video_room_url:
            nextCheckin?.video_room_url ?? null,
        })
        .eq("id", membership.pod_id);

      return NextResponse.json({
        success: true,
        status: "completed",
      });
    }

    // =====================================================
    // 8. CANCEL CHECK-IN
    // =====================================================

    if (action === "cancel") {
      if (!checkinId) {
        return NextResponse.json(
          { error: "checkinId is required." },
          { status: 400 }
        );
      }

      if (membership.role !== "leader") {
        return NextResponse.json(
          {
            error:
              "Only the pod leader can cancel the check-in.",
          },
          { status: 403 }
        );
      }

      const { error: updateError } =
        await supabaseAdmin
          .from("pod_checkins")
          .update({
            status: "cancelled",
          })
          .eq("id", checkinId)
          .eq("pod_id", membership.pod_id);

      if (updateError) {
        console.error(
          "CANCEL CHECKIN UPDATE ERROR:",
          updateError
        );

        return NextResponse.json(
          { error: "Failed to cancel check-in." },
          { status: 500 }
        );
      }

      const {
        data: nextCheckin,
      } = await supabaseAdmin
        .from("pod_checkins")
        .select("scheduled_at, video_room_url")
        .eq("pod_id", membership.pod_id)
        .eq("status", "scheduled")
        .order("scheduled_at", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      await supabaseAdmin
        .from("accountability_pods")
        .update({
          next_checkin_at:
            nextCheckin?.scheduled_at ?? null,
          video_room_url:
            nextCheckin?.video_room_url ?? null,
        })
        .eq("id", membership.pod_id);

      return NextResponse.json({
        success: true,
        status: "cancelled",
      });
    }

    // =====================================================
    // 9. INVALID ACTION
    // =====================================================

    return NextResponse.json(
      { error: "Invalid action." },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("Check-in API error:", error);

    return NextResponse.json(
      { error: "Failed to process check-in request." },
      { status: 500 }
    );
  }
}