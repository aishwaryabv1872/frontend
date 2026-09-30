
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID!;
const razorpaySecret = process.env.RAZORPAY_KEY_SECRET!;

const authClient = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the caller.
    const authorization = request.headers.get("authorization");
    const tokenMatch = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
      return jsonError("Authentication required.", 401);
    }

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(tokenMatch[1]);

    if (authError || !user) {
      return jsonError("Invalid or expired session.", 401);
    }

    // 2. Parse and validate the request body.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid request body.", 400);
    }

    const {
      sessionId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body as Record<string, unknown>;

    if (
      !isNonEmptyString(sessionId) ||
      !isNonEmptyString(razorpay_order_id) ||
      !isNonEmptyString(razorpay_payment_id) ||
      !isNonEmptyString(razorpay_signature)
    ) {
      return jsonError("Missing payment verification details.", 400);
    }

    const cleanSessionId = sessionId.trim();
    const orderId = razorpay_order_id.trim();
    const paymentId = razorpay_payment_id.trim();
    const signature = razorpay_signature.trim();

    if (
      cleanSessionId.length > 128 ||
      orderId.length > 128 ||
      paymentId.length > 128 ||
      !/^[a-fA-F0-9]{64}$/.test(signature)
    ) {
      return jsonError("Invalid payment verification details.", 400);
    }

    // 3. Ensure payment credentials are configured.
    if (!razorpayKeyId || !razorpaySecret) {
      console.error("Razorpay credentials are not configured.");
      return jsonError("Payment service is not configured.", 500);
    }

    // 4. Fetch only a session belonging to the authenticated student.
    const {
      data: session,
      error: sessionError,
    } = await supabaseAdmin
      .from("mentor_sessions")
      .select(`
        id,
        student_id,
        status,
        session_price,
        currency,
        payment_status,
        razorpay_order_id,
        razorpay_payment_id,
        video_room_url
      `)
      .eq("id", cleanSessionId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (sessionError) {
      console.error("Session lookup failed:", {
        code: sessionError.code,
        message: sessionError.message,
      });
      return jsonError("Unable to verify mentor session.", 500);
    }

    if (!session) {
      return jsonError("Mentor session not found.", 404);
    }

    if (session.status === "cancelled") {
      return jsonError("This mentor session has been cancelled.", 400);
    }

    // 5. Handle an already-paid session idempotently.
    if (session.payment_status === "paid") {
      if (
        session.razorpay_payment_id === paymentId &&
        session.razorpay_order_id === orderId
      ) {
        return NextResponse.json({
          success: true,
          message: "Payment has already been verified.",
          sessionId: session.id,
          paymentStatus: "paid",
          sessionStatus: session.status,
          videoRoomUrl: session.video_room_url || null,
        });
      }

      return jsonError("This session has already been paid.", 409);
    }

    if (session.payment_status !== "pending") {
      return jsonError("This session is not awaiting payment.", 409);
    }

    // 6. Ensure the submitted order belongs to this session.
    if (!session.razorpay_order_id ||
        session.razorpay_order_id !== orderId) {
      return jsonError(
        "Razorpay order ID does not match this session.",
        400
      );
    }

    // 7. Verify the checkout signature using a timing-safe comparison.
    const expectedSignature = crypto
      .createHmac("sha256", razorpaySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const receivedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return jsonError("Payment signature verification failed.", 400);
    }

    // 8. Verify the payment directly with Razorpay.
    // A valid checkout signature alone does not establish that
    // the payment was captured for the expected amount.
    const basicAuth = Buffer.from(
      `${razorpayKeyId}:${razorpaySecret}`
    ).toString("base64");

    const razorpayResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!razorpayResponse.ok) {
      // Do not reveal provider response details to the client.
      console.error("Razorpay payment lookup failed:", {
        status: razorpayResponse.status,
      });
      return jsonError(
        "Unable to confirm payment with the payment provider.",
        502
      );
    }

    const paymentData: unknown = await razorpayResponse.json();

    if (
      !paymentData ||
      typeof paymentData !== "object" ||
      Array.isArray(paymentData)
    ) {
      return jsonError("Invalid payment-provider response.", 502);
    }

    const payment = paymentData as {
      id?: unknown;
      order_id?: unknown;
      status?: unknown;
      amount?: unknown;
      currency?: unknown;
      captured?: unknown;
    };

    // 9. Check the provider's payment identity and captured state.
    if (
      payment.id !== paymentId ||
      payment.order_id !== orderId
    ) {
      return jsonError(
        "Payment does not match the submitted order.",
        400
      );
    }

    if (payment.status !== "captured" || payment.captured !== true) {
      return jsonError(
        "Payment has not been captured yet.",
        409
      );
    }

    // 10. Compare the provider's amount and currency with the booking.
    const price = Number(session.session_price);
    const expectedAmountPaise = Math.round(price * 100);
    const expectedCurrency = String(session.currency || "INR").toUpperCase();

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isSafeInteger(expectedAmountPaise) ||
      !Number.isSafeInteger(payment.amount) ||
      payment.amount !== expectedAmountPaise ||
      payment.currency !== expectedCurrency
    ) {
      console.error("Payment amount or currency mismatch:", {
        sessionId: session.id,
        expectedCurrency,
        providerCurrency: payment.currency,
      });

      return jsonError(
        "Payment amount or currency does not match the booking.",
        400
      );
    }

    // 11. Apply the verified payment only if it is still pending.
    // The conditional update helps prevent duplicate concurrent claims.
    const now = new Date().toISOString();

    const {
      data: updatedSession,
      error: updateError,
    } = await supabaseAdmin
      .from("mentor_sessions")
      .update({
        payment_status: "paid",
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        status:
          session.status === "pending"
            ? "confirmed"
            : session.status,
        updated_at: now,
      })
      .eq("id", session.id)
      .eq("student_id", user.id)
      .eq("payment_status", "pending")
      .eq("razorpay_order_id", orderId)
      .select(`
        id,
        payment_status,
        status,
        video_room_url
      `)
      .maybeSingle();

    if (updateError) {
      console.error("Payment update failed:", {
        code: updateError.code,
        message: updateError.message,
      });

      return jsonError(
        "Payment was verified, but the session could not be updated.",
        500
      );
    }

    if (!updatedSession) {
      // Another request may have completed the update first.
      const { data: currentSession } = await supabaseAdmin
        .from("mentor_sessions")
        .select(`
          id,
          payment_status,
          status,
          razorpay_order_id,
          razorpay_payment_id,
          video_room_url
        `)
        .eq("id", session.id)
        .eq("student_id", user.id)
        .maybeSingle();

      if (
        currentSession?.payment_status === "paid" &&
        currentSession.razorpay_order_id === orderId &&
        currentSession.razorpay_payment_id === paymentId
      ) {
        return NextResponse.json({
          success: true,
          message: "Payment has already been verified.",
          sessionId: currentSession.id,
          paymentStatus: currentSession.payment_status,
          sessionStatus: currentSession.status,
          videoRoomUrl: currentSession.video_room_url || null,
        });
      }

      return jsonError(
        "Payment could not be applied to this session.",
        409
      );
    }

    // 12. Return only the information needed by the client.
    return NextResponse.json({
      success: true,
      message: "Payment verified successfully.",
      sessionId: updatedSession.id,
      paymentStatus: updatedSession.payment_status,
      sessionStatus: updatedSession.status,
      videoRoomUrl: updatedSession.video_room_url || null,
    });
  } catch (error) {
    console.error(
      "Razorpay verification error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return jsonError("Unable to verify payment.", 500);
  }
}