
import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function errorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function getRequiredEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function logError(
  label: string,
  error: unknown
) {
  if (error instanceof Error) {
    console.error(label, error.message);
  } else {
    console.error(label, "Unknown error");
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate server configuration before creating clients.
    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const razorpayKeyId = getRequiredEnv("RAZORPAY_KEY_ID");
    const razorpayKeySecret = getRequiredEnv("RAZORPAY_KEY_SECRET");

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !razorpayKeyId ||
      !razorpayKeySecret
    ) {
      console.error("Payment API configuration is incomplete.");
      return errorResponse("Payment service is not configured.", 500);
    }

    // 2. Authenticate the student.
    const authorization = request.headers.get("authorization");
    const tokenMatch = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
      return errorResponse("Authentication required.", 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(tokenMatch[1]);

    if (authError || !user) {
      return errorResponse("Invalid or expired session.", 401);
    }

    // 3. Parse and validate request body.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Invalid request body.", 400);
    }

    const sessionId = (body as { sessionId?: unknown }).sessionId;

    if (
      typeof sessionId !== "string" ||
      !sessionId.trim() ||
      sessionId.trim().length > 128
    ) {
      return errorResponse("Valid session ID is required.", 400);
    }

    const cleanSessionId = sessionId.trim();

    // 4. Create server-side clients.
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    // 5. Fetch only a session owned by this authenticated student.
    const {
      data: session,
      error: sessionError,
    } = await adminClient
      .from("mentor_sessions")
      .select(`
        id,
        student_id,
        mentor_id,
        session_price,
        currency,
        status,
        payment_status,
        razorpay_order_id
      `)
      .eq("id", cleanSessionId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (sessionError) {
      logError("Mentor session lookup failed:", sessionError);
      return errorResponse("Could not load the mentor session.", 500);
    }

    if (!session) {
      return errorResponse("Mentor session not found.", 404);
    }

    // 6. Enforce session and payment state.
    if (session.status === "cancelled") {
      return errorResponse("This mentor session has been cancelled.", 400);
    }

    if (session.status === "completed") {
      return errorResponse("This mentor session has already been completed.", 400);
    }

    if (session.payment_status === "paid") {
      return errorResponse("This mentor session has already been paid for.", 409);
    }

    if (session.payment_status !== "pending") {
      return errorResponse("This session is not awaiting payment.", 409);
    }

    // 7. Derive the amount exclusively from the database.
    const sessionPrice = Number(session.session_price);

    if (
      !Number.isFinite(sessionPrice) ||
      sessionPrice <= 0 ||
      Math.round(sessionPrice * 100) !== sessionPrice * 100
    ) {
      console.error("Invalid session price:", session.id);
      return errorResponse("The mentor session has an invalid price.", 500);
    }

    const amountInPaise = Math.round(sessionPrice * 100);

    if (
      !Number.isSafeInteger(amountInPaise) ||
      amountInPaise <= 0
    ) {
      console.error("Invalid payment amount:", session.id);
      return errorResponse("The mentor session price is invalid.", 500);
    }

    const currency = String(session.currency || "INR").toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      console.error("Invalid session currency:", session.id);
      return errorResponse("The mentor session has an invalid currency.", 500);
    }

    // 8. Reuse a stored Razorpay order if it still matches this booking.
    if (session.razorpay_order_id) {
      let existingOrder;

      try {
        existingOrder = await razorpay.orders.fetch(
          session.razorpay_order_id
        );
      } catch (error) {
        // Do not create a second order when the status of the first
        // order cannot be established. Reconcile or retry instead.
        logError("Existing Razorpay order lookup failed:", error);
        return errorResponse(
          "Could not confirm the existing payment order. Please retry shortly.",
          502
        );
      }

      if (
        existingOrder.id !== session.razorpay_order_id ||
        Number(existingOrder.amount) !== amountInPaise ||
        String(existingOrder.currency).toUpperCase() !== currency
      ) {
        console.error("Stored order does not match booking:", session.id);
        return errorResponse(
          "The existing payment order does not match this booking.",
          409
        );
      }

      if (existingOrder.status === "paid") {
        // The provider reports payment, but the database still says
        // pending. Do not issue another order; reconcile the payment.
        return errorResponse(
          "Payment exists at the provider and requires reconciliation.",
          409
        );
      }

      if (
        existingOrder.status !== "created" &&
        existingOrder.status !== "attempted"
      ) {
        return errorResponse(
          "The existing payment order is not available for payment.",
          409
        );
      }

      return NextResponse.json({
        success: true,
        order: {
          id: existingOrder.id,
          amount: existingOrder.amount,
          currency: existingOrder.currency,
        },
        keyId: razorpayKeyId,
      });
    }

    // 9. Create a new order using the database amount.
    // The compact receipt stays within Razorpay's receipt length limit.
    const compactSessionId = session.id.replace(/-/g, "");
    const receipt = `mentor_${compactSessionId}`.slice(0, 40);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        session_id: session.id,
        student_id: user.id,
        mentor_id: session.mentor_id,
      },
    });

    // 10. Persist the order ID only while this booking remains pending.
    // Returning a checkout order before confirming persistence could
    // leave the frontend with an order that cannot be verified later.
    const {
      data: savedSession,
      error: updateError,
    } = await adminClient
      .from("mentor_sessions")
      .update({
        razorpay_order_id: order.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .eq("student_id", user.id)
      .eq("payment_status", "pending")
      .is("razorpay_order_id", null)
      .select("id, razorpay_order_id")
      .maybeSingle();

    if (updateError) {
      logError("Saving Razorpay order ID failed:", updateError);
      return errorResponse(
        "Could not initialize the payment. Please retry or contact support.",
        500
      );
    }

    if (!savedSession) {
      // A concurrent request may have changed the booking or saved
      // a different order. Do not return this unpersisted order.
      return errorResponse(
        "The payment order could not be attached to this booking. Please refresh and retry.",
        409
      );
    }

    // 11. Return only the checkout information needed by the client.
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      keyId: razorpayKeyId,
    });
  } catch (error) {
    logError("Razorpay create-order API failed:", error);
    return errorResponse("Could not create Razorpay order.", 500);
  }
}