
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

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

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}

function safeCompareHex(received: string, expected: string) {
  if (
    !/^[a-fA-F0-9]{64}$/.test(received) ||
    !/^[a-fA-F0-9]{64}$/.test(expected)
  ) {
    return false;
  }

  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function POST(request: NextRequest) {
  try {
    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !webhookSecret
    ) {
      console.error("Webhook environment configuration is missing.");
      return jsonError("Webhook is not configured.", 500);
    }

    // Read the raw body: signature verification must use
    // the exact bytes Razorpay sent.
    const rawBody = await request.text();

    const receivedSignature =
      request.headers.get("x-razorpay-signature") || "";

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!safeCompareHex(receivedSignature, expectedSignature)) {
      console.error("Invalid Razorpay webhook signature.");
      return jsonError("Invalid webhook signature.", 400);
    }

    // Parse only after verifying the signature.
    let eventData: unknown;

    try {
      eventData = JSON.parse(rawBody);
    } catch {
      return jsonError("Invalid webhook JSON.", 400);
    }

    if (
      !eventData ||
      typeof eventData !== "object" ||
      Array.isArray(eventData)
    ) {
      return jsonError("Invalid webhook payload.", 400);
    }

    const event = eventData as {
      event?: unknown;
      payload?: {
        payment?: {
          entity?: unknown;
        };
      };
    };

    // This endpoint is configured for payment.captured.
    // Acknowledge unrelated events without modifying bookings.
    if (event.event !== "payment.captured") {
      return NextResponse.json({
        success: true,
        message: "Event ignored.",
      });
    }

    const paymentValue = event.payload?.payment?.entity;

    if (
      !paymentValue ||
      typeof paymentValue !== "object" ||
      Array.isArray(paymentValue)
    ) {
      return jsonError("Missing payment entity.", 400);
    }

    const payment = paymentValue as {
      id?: unknown;
      order_id?: unknown;
      status?: unknown;
      captured?: unknown;
      amount?: unknown;
      currency?: unknown;
    };

    const paymentId = payment.id;
    const orderId = payment.order_id;

    if (
      typeof paymentId !== "string" ||
      !paymentId.trim() ||
      typeof orderId !== "string" ||
      !orderId.trim()
    ) {
      return jsonError("Invalid payment identifiers.", 400);
    }

    // Only apply a payment that Razorpay reports as captured.
    if (
      payment.status !== "captured" ||
      payment.captured !== true
    ) {
      return NextResponse.json({
        success: true,
        message: "Payment is not captured; no update made.",
      });
    }

    if (
      typeof payment.amount !== "number" ||
      !Number.isSafeInteger(payment.amount) ||
      payment.amount <= 0 ||
      typeof payment.currency !== "string"
    ) {
      return jsonError("Invalid payment amount or currency.", 400);
    }

    // Locate the booking using the Razorpay order ID.
    const { data: session, error: lookupError } =
      await supabaseAdmin
        .from("mentor_sessions")
        .select(`
          id,
          status,
          session_price,
          currency,
          payment_status,
          razorpay_order_id,
          razorpay_payment_id
        `)
        .eq("razorpay_order_id", orderId)
        .maybeSingle();

    if (lookupError) {
      console.error("Webhook booking lookup failed:", {
        code: lookupError.code,
        message: lookupError.message,
      });
      return jsonError("Unable to find booking.", 500);
    }

    if (!session) {
      // Acknowledge unknown orders to avoid endless retries.
      // Investigate these in server logs.
      console.error("No booking found for captured Razorpay order.", {
        orderId,
        paymentId,
      });

      return NextResponse.json({
        success: true,
        message: "No matching booking; event recorded for investigation.",
      });
    }

    // Ensure the provider's captured amount and currency match
    // the amount stored for this booking.
    const price = Number(session.session_price);
    const expectedAmountPaise = Math.round(price * 100);
    const expectedCurrency =
      String(session.currency || "INR").toUpperCase();

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isSafeInteger(expectedAmountPaise) ||
      payment.amount !== expectedAmountPaise ||
      payment.currency.toUpperCase() !== expectedCurrency
    ) {
      console.error("Webhook payment amount/currency mismatch.", {
        sessionId: session.id,
        orderId,
        paymentId,
        expectedCurrency,
        receivedCurrency: payment.currency,
      });

      // Do not mark a mismatched booking as paid.
      // Return success to prevent futile retries; investigate manually.
      return NextResponse.json({
        success: true,
        message: "Payment mismatch; booking was not updated.",
      });
    }

    // Idempotency: repeated delivery of the same captured
    // payment must not change an already-paid booking.
    if (session.payment_status === "paid") {
      if (
        session.razorpay_order_id === orderId &&
        session.razorpay_payment_id === paymentId
      ) {
        return NextResponse.json({
          success: true,
          message: "Payment was already applied.",
        });
      }

      console.error("Different payment received for an already-paid booking.", {
        sessionId: session.id,
        orderId,
        paymentId,
      });

      return NextResponse.json({
        success: true,
        message: "Booking already paid; additional payment needs review.",
      });
    }

    if (
      session.payment_status !== "pending" ||
      session.status === "cancelled"
    ) {
      console.error("Captured payment needs booking review.", {
        sessionId: session.id,
        orderId,
        paymentId,
        sessionStatus: session.status,
        paymentStatus: session.payment_status,
      });

      return NextResponse.json({
        success: true,
        message: "Booking state requires manual review.",
      });
    }

    // Conditionally update only the still-pending booking.
    const { data: updatedSession, error: updateError } =
      await supabaseAdmin
        .from("mentor_sessions")
        .update({
          payment_status: "paid",
          razorpay_payment_id: paymentId,
          status:
            session.status === "pending"
              ? "confirmed"
              : session.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
        .eq("razorpay_order_id", orderId)
        .eq("payment_status", "pending")
        .neq("status", "cancelled")
        .select("id")
        .maybeSingle();

    if (updateError) {
      console.error("Webhook booking update failed:", {
        code: updateError.code,
        message: updateError.message,
      });
      return jsonError("Unable to update booking.", 500);
    }

    if (!updatedSession) {
      // A concurrent verification or webhook may have won.
      const { data: current } = await supabaseAdmin
        .from("mentor_sessions")
        .select(`
          payment_status,
          razorpay_order_id,
          razorpay_payment_id
        `)
        .eq("id", session.id)
        .maybeSingle();

      if (
        current?.payment_status === "paid" &&
        current.razorpay_order_id === orderId &&
        current.razorpay_payment_id === paymentId
      ) {
        return NextResponse.json({
          success: true,
          message: "Payment was already applied.",
        });
      }

      console.error("Webhook update did not apply; manual review needed.", {
        sessionId: session.id,
        orderId,
        paymentId,
      });

      // Acknowledge to avoid repeated automatic retries.
      // Review this event in logs and reconcile if needed.
      return NextResponse.json({
        success: true,
        message: "Booking was not updated; manual review required.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Captured payment applied to mentor booking.",
      sessionId: updatedSession.id,
    });
  } catch (error) {
    console.error(
      "Razorpay webhook error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return jsonError("Webhook processing failed.", 500);
  }
}