"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

declare global {
  interface RazorpayPaymentResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }

  interface RazorpayPaymentFailedResponse {
    error?: {
      description?: string;
    };
  }

  interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    prefill?: {
      name?: string;
    };
    notes?: Record<string, string>;
    theme?: {
      color?: string;
    };
    handler: (
      response: RazorpayPaymentResponse
    ) => void | Promise<void>;
    modal?: {
      ondismiss?: () => void;
    };
  }

  interface RazorpayInstance {
    on(
      event: "payment.failed",
      handler: (
        response: RazorpayPaymentFailedResponse
      ) => void
    ): void;

    open(): void;
  }

  interface RazorpayConstructor {
    new (
      options: RazorpayOptions
    ): RazorpayInstance;
  }

  interface Window {
    Razorpay: RazorpayConstructor;
  }
}

type Mentor = {
  id: string;
  full_name: string;
  current_company: string | null;
  job_role: string | null;
  session_price: number | null;
  currency: string | null;
};

type Availability = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
};

type ExistingSession = {
  id: string;
  student_id: string;
  status: string;
  payment_status: string;
  session_price: number | null;
  currency: string | null;
  scheduled_at: string;
  duration_minutes: number;
  session_type: string;
  student_message: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
};

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const sessionTypes = [
  {
    value: "career_guidance",
    label: "Career Guidance",
  },
  {
    value: "resume_review",
    label: "Resume Review",
  },
  {
    value: "mock_interview",
    label: "Mock Interview",
  },
  {
    value: "dsa_guidance",
    label: "DSA Guidance",
  },
  {
    value: "project_review",
    label: "Project Review",
  },
  {
    value: "placement_strategy",
    label: "Placement Strategy",
  },
  {
    value: "general",
    label: "General",
  },
];

function formatTime(time: string) {
  if (!time) return "";

  const [hour, minute] = time
    .split(":")
    .map(Number);

  const date = new Date();

  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript =
      document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

    if (existingScript) {
      existingScript.addEventListener(
        "load",
        () => resolve(true)
      );

      existingScript.addEventListener(
        "error",
        () => resolve(false)
      );

      return;
    }

    const script =
      document.createElement("script");

    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";

    script.async = true;

    script.onload = () => {
      resolve(true);
    };

    script.onerror = () => {
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

export default function MentorBookingPage() {
  const params = useParams();
  const router = useRouter();

  const mentorId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";

  const [mentor, setMentor] =
    useState<Mentor | null>(null);

  const [availability, setAvailability] =
    useState<Availability[]>([]);

  const [selectedDate, setSelectedDate] =
    useState("");

  const [selectedTime, setSelectedTime] =
    useState("");

  const [duration, setDuration] =
    useState("60");

  const [sessionType, setSessionType] =
    useState("mock_interview");

  const [studentMessage, setStudentMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [booking, setBooking] =
    useState(false);

  const [paymentLoading, setPaymentLoading] =
    useState(false);

  const [checkingBooking, setCheckingBooking] =
    useState(false);

  const [existingPendingSession, setExistingPendingSession] =
    useState<ExistingSession | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // --------------------------------------------------
  // LOAD MENTOR + AVAILABILITY
  // --------------------------------------------------

  useEffect(() => {
    async function loadData() {
      if (!mentorId) {
        setError("Mentor ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const {
          data: mentorData,
          error: mentorError,
        } = await supabase
          .from("mentors")
          .select(
            `
              id,
              full_name,
              current_company,
              job_role,
              session_price,
              currency
            `
          )
          .eq("id", mentorId)
          .eq(
            "verification_status",
            "verified"
          )
          .eq("is_available", true)
          .single();

        if (mentorError) {
          console.error(
            "Mentor loading error:",
            mentorError
          );

          throw new Error(
            mentorError.message ||
              "Unable to load mentor."
          );
        }

        setMentor(mentorData);

        const {
          data: availabilityData,
          error: availabilityError,
        } = await supabase
          .from("mentor_availability")
          .select(
            `
              id,
              day_of_week,
              start_time,
              end_time,
              timezone
            `
          )
          .eq("mentor_id", mentorId)
          .eq("is_active", true)
          .order("day_of_week", {
            ascending: true,
          });

        if (availabilityError) {
          console.error(
            "Availability loading error:",
            availabilityError
          );

          throw new Error(
            availabilityError.message ||
              "Unable to load mentor availability."
          );
        }

        setAvailability(
          availabilityData ?? []
        );
      } catch (err) {
        console.error(
          "Booking page error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load booking page."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [mentorId]);

  // --------------------------------------------------
  // GET AVAILABLE SLOTS FOR SELECTED DATE
  // --------------------------------------------------

  function getSelectedAvailability() {
    if (!selectedDate) return [];

    const date = new Date(
      `${selectedDate}T00:00:00`
    );

    const dayOfWeek = date.getDay();

    return availability.filter(
      (slot) =>
        slot.day_of_week === dayOfWeek
    );
  }

  // --------------------------------------------------
  // CREATE / CONTINUE RAZORPAY PAYMENT
  // --------------------------------------------------

  async function createRazorpayPayment(
    sessionId: string,
    amount: number,
    currency: string
  ) {
    try {
      setPaymentLoading(true);
      setError("");
      setSuccess("");

      // ------------------------------------------------
      // LOAD RAZORPAY CHECKOUT
      // ------------------------------------------------

      const razorpayLoaded =
        await loadRazorpayScript();

      if (!razorpayLoaded) {
        throw new Error(
          "Unable to load Razorpay Checkout. Please check your internet connection and try again."
        );
      }


      // ------------------------------------------------
      // GET AUTHENTICATED SUPABASE SESSION
      // ------------------------------------------------

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Authentication required. Please sign in again."
        );
      }

      // ------------------------------------------------
      // CREATE RAZORPAY ORDER
      // ------------------------------------------------

      const orderResponse = await fetch(
        "/api/mentor-payment/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            sessionId,
          }),
        }
      );

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(
          orderData?.error ||
            "Unable to create Razorpay order."
        );
      }
      // ------------------------------------------------
      // OPEN RAZORPAY CHECKOUT
      // ------------------------------------------------

      const options: RazorpayOptions = {
        key: orderData.keyId,

        amount:
          orderData.order.amount,

        currency:
          orderData.order.currency ||
          currency,

        name: "Vertex",

        description:
          `Mentor session with ${
            mentor?.full_name || "mentor"
          }`,

        order_id:
          orderData.order.id,

        prefill: {
          name: "Vertex Student",
        },

        notes: {
          session_id: sessionId,
        },

        theme: {
          color: "#22d3ee",
        },

        handler: async function (
          response
        ) {
          try {
            setPaymentLoading(true);
            setError("");
            setSuccess("");

            // ------------------------------------------
            // VERIFY PAYMENT
            // ------------------------------------------

            const {
  data: { session: authSession },
  error: authError,
} = await supabase.auth.getSession();

if (authError || !authSession?.access_token) {
  throw new Error(
    "Your session has expired. Please log in again."
  );
}

const verifyResponse =
  await fetch(
    "/api/mentor-payment/verify",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        Authorization:
          `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify({
        sessionId,

        razorpay_order_id:
          response.razorpay_order_id,

        razorpay_payment_id:
          response.razorpay_payment_id,

        razorpay_signature:
          response.razorpay_signature,
      }),
    }
  );

            const verifyData =
              await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(
                verifyData?.error ||
                  "Payment verification failed."
              );
            }

            if (!verifyData?.success) {
              throw new Error(
                verifyData?.error ||
                  "Payment verification failed."
              );
            }

            setSuccess(
              "Payment successful! Your mentor session is confirmed."
            );

            setExistingPendingSession(
              null
            );

            // ------------------------------------------
            // REDIRECT
            // ------------------------------------------

            setTimeout(() => {
              router.push(
                `/mentors/${mentorId}`
              );
            }, 1800);
          } catch (err) {
            console.error(
              "Payment verification error:",
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : "Payment verification failed."
            );
          } finally {
            setPaymentLoading(false);
            setBooking(false);
          }
        },

        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
            setBooking(false);

            setError(
              "Payment was cancelled. Your booking is still pending. You can try the payment again."
            );
          },
        },
      };

      const razorpay =
        new window.Razorpay(options);

      razorpay.on(
        "payment.failed",
        function (response) {
          console.error(
            "Razorpay payment failed:",
            response
          );

          setPaymentLoading(false);
          setBooking(false);

          setError(
            response?.error?.description ||
              "Payment failed. Please try again."
          );
        }
      );

      razorpay.open();
    } catch (err) {
      console.error(
        "Razorpay checkout error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to start payment."
      );

      setPaymentLoading(false);
      setBooking(false);
    }
  }

  // --------------------------------------------------
  // BOOKING
  // --------------------------------------------------

  async function handleBooking(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!mentor) {
      setError(
        "Mentor information is missing."
      );
      return;
    }

    if (!selectedDate) {
      setError(
        "Please select a date."
      );
      return;
    }

    if (!selectedTime) {
      setError(
        "Please select a time."
      );
      return;
    }

    try {
      setBooking(true);
      setCheckingBooking(true);

      // ------------------------------------------------
      // GET CURRENT USER
      // ------------------------------------------------

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(
          `/login?redirect=/mentors/${mentorId}/book`
        );
        return;
      }

      // ------------------------------------------------
      // CREATE SCHEDULED DATE
      // ------------------------------------------------

      const scheduledAt = new Date(
        `${selectedDate}T${selectedTime}:00`
      );

      if (
        Number.isNaN(
          scheduledAt.getTime()
        )
      ) {
        throw new Error(
          "Invalid date or time selected."
        );
      }

      if (
        scheduledAt.getTime() <=
        Date.now()
      ) {
        throw new Error(
          "Please select a future date and time."
        );
      }

      const price =
        mentor.session_price ?? 0;

      // ------------------------------------------------
      // CHECK EXISTING BOOKINGS
      // ------------------------------------------------

      const {
        data: existingSessions,
        error: existingError,
      } = await supabase
        .from("mentor_sessions")
        .select(
          `
            id,
            student_id,
            status,
            payment_status,
            session_price,
            currency,
            scheduled_at,
            duration_minutes,
            session_type,
            student_message,
            razorpay_order_id,
            razorpay_payment_id
          `
        )
        .eq(
          "mentor_id",
          mentor.id
        )
        .eq(
          "scheduled_at",
          scheduledAt.toISOString()
        )
        .in("status", [
          "pending",
          "confirmed",
        ]);

      if (existingError) {
        console.error(
          "Existing booking check error:",
          existingError
        );

        throw new Error(
          existingError.message
        );
      }

      // ------------------------------------------------
      // CHECK IF THIS USER ALREADY HAS A
      // PENDING PAYMENT FOR THIS SLOT
      // ------------------------------------------------

      const ownPendingSession =
        existingSessions?.find(
          (session) =>
            session.student_id ===
              user.id &&
            session.status ===
              "pending" &&
            session.payment_status ===
              "pending"
        );

      // ------------------------------------------------
      // CONTINUE EXISTING PAYMENT
      // ------------------------------------------------

      if (ownPendingSession) {
        console.log(
          "Existing pending session found:",
          ownPendingSession
        );

        setExistingPendingSession(
          ownPendingSession
        );

        setCheckingBooking(false);

        setSuccess(
          "You already have a pending booking for this time. Opening payment..."
        );

        await createRazorpayPayment(
          ownPendingSession.id,

          Number(
            ownPendingSession.session_price ??
              price
          ),

          ownPendingSession.currency ||
            mentor.currency ||
            "INR"
        );

        return;
      }

      // ------------------------------------------------
      // CHECK IF SOMEONE ELSE BOOKED THE SLOT
      // ------------------------------------------------

      const someoneElseBooked =
        existingSessions?.find(
          (session) =>
            session.student_id !==
            user.id
        );

      if (someoneElseBooked) {
        setCheckingBooking(false);

        throw new Error(
          "This time slot has already been booked. Please choose another time."
        );
      }

      // ------------------------------------------------
      // CREATE NEW SESSION
      // ------------------------------------------------

      const {
        data: session,
        error: insertError,
      } = await supabase
        .from("mentor_sessions")
        .insert({
          mentor_id:
            mentor.id,

          student_id:
            user.id,

          scheduled_at:
            scheduledAt.toISOString(),

          duration_minutes:
            Number(duration),

          session_type:
            sessionType,

          student_message:
            studentMessage.trim() ||
            null,

          status:
            "pending",

          session_price:
            price,

          currency:
            mentor.currency ||
            "INR",

          payment_status:
            price > 0
              ? "pending"
              : "not_required",

          video_room_url:
            null,
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          "Booking insert error:",
          insertError
        );

        throw new Error(
          insertError.message
        );
      }

      console.log(
        "New booking created:",
        session
      );

      setExistingPendingSession(
        price > 0
          ? session
          : null
      );

      setCheckingBooking(false);

      // ------------------------------------------------
      // FREE SESSION
      // ------------------------------------------------

      if (price <= 0) {
        setSuccess(
          "Session booking confirmed successfully!"
        );

        setTimeout(() => {
          router.push(
            `/mentors/${mentor.id}`
          );
        }, 1800);

        return;
      }

      // ------------------------------------------------
      // PAID SESSION
      // ------------------------------------------------

      setSuccess(
        "Booking created. Opening secure payment..."
      );

      await createRazorpayPayment(
        session.id,

        price,

        mentor.currency ||
          "INR"
      );
    } catch (err) {
      console.error(
        "Booking submission error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create booking."
      );

      setBooking(false);
      setPaymentLoading(false);
      setCheckingBooking(false);
    }
  }

  // --------------------------------------------------
  // SELECTED SLOTS
  // --------------------------------------------------

  const selectedSlots =
    getSelectedAvailability();

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <Link
            href="/mentors"
            className="text-sm text-slate-400 hover:text-cyan-400"
          >
            ← Back to Mentors
          </Link>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

            <p className="mt-4 text-slate-400">
              Loading booking page...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // LOAD ERROR
  // --------------------------------------------------

  if (error && !mentor) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link
            href="/mentors"
            className="text-sm text-slate-400 hover:text-cyan-400"
          >
            ← Back to Mentors
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-8">
            <h1 className="text-2xl font-bold text-red-400">
              Unable to load booking
            </h1>

            <p className="mt-3 text-slate-300">
              {error}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!mentor) {
    return null;
  }

  const price =
    mentor.session_price ?? 0;

  const isProcessing =
    booking ||
    paymentLoading ||
    checkingBooking;

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}

      <nav className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-2xl font-bold text-cyan-400"
          >
            Vertex
          </Link>

          <div className="hidden items-center gap-6 text-sm md:flex">
            <Link
              href="/roadmap"
              className="text-slate-400 hover:text-white"
            >
              Roadmap
            </Link>

            <Link
              href="/dsa"
              className="text-slate-400 hover:text-white"
            >
              DSA
            </Link>

            <Link
              href="/projects"
              className="text-slate-400 hover:text-white"
            >
              Projects
            </Link>

            <Link
              href="/ai-tutor"
              className="text-slate-400 hover:text-white"
            >
              AI Tutor
            </Link>

            <Link
              href="/pods"
              className="text-slate-400 hover:text-white"
            >
              Pods
            </Link>

            <Link
              href="/mentor"
              className="text-slate-400 hover:text-white"
            >
              Mentor
            </Link>

            <Link
              href="/mentors"
              className="font-semibold text-cyan-400"
            >
              Find Mentors
            </Link>
          </div>
        </div>
      </nav>

      {/* CONTENT */}

      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href={`/mentors/${mentor.id}`}
          className="text-sm text-slate-400 hover:text-cyan-400"
        >
          ← Back to Mentor Profile
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* BOOKING FORM */}

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2 md:p-8">
            <div>
              <p className="text-sm font-semibold text-cyan-400">
                MENTOR SESSION
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                Book a Session
              </h1>

              <p className="mt-2 text-slate-400">
                Schedule a personalized session
                with{" "}
                <span className="font-semibold text-white">
                  {mentor.full_name}
                </span>
                .
              </p>
            </div>

            <form
              onSubmit={handleBooking}
              className="mt-8 space-y-6"
            >
              {/* DATE */}


<div>
  <label
    htmlFor="session-date"
    className="mb-2 block text-sm font-semibold text-white"
  >
    Select Date
  </label>

  <input
    id="session-date"
    type="date"
    value={selectedDate}
    min={new Date().toLocaleDateString("en-CA")}
    onChange={(e) => {
      setSelectedDate(e.target.value);
      setSelectedTime("");
      setExistingPendingSession(null);
      setError("");
      setSuccess("");
    }}
    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition scheme-dark focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
  />
</div>

              {/* TIME */}

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Select Time
                </label>

                {!selectedDate ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
                    Select a date first.
                  </div>
                ) : selectedSlots.length ===
                  0 ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    This mentor is not
                    available on the selected
                    day.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedSlots.map(
                      (slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => {
                            setSelectedTime(
                              slot.start_time.slice(
                                0,
                                5
                              )
                            );

                            setExistingPendingSession(
                              null
                            );

                            setError("");
                            setSuccess("");
                          }}
                          className={`rounded-xl border p-4 text-left transition ${
                            selectedTime ===
                            slot.start_time.slice(
                              0,
                              5
                            )
                              ? "border-cyan-400 bg-cyan-500/10"
                              : "border-slate-700 bg-slate-950 hover:border-cyan-500/50"
                          }`}
                        >
                          <p className="font-semibold">
                            {formatTime(
                              slot.start_time
                            )}{" "}
                            –{" "}
                            {formatTime(
                              slot.end_time
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {slot.timezone ||
                              "Asia/Kolkata"}
                          </p>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* DURATION */}

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Duration
                </label>

                <select
                  value={duration}
                  onChange={(e) =>
                    setDuration(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                >
                  <option value="30">
                    30 minutes
                  </option>

                  <option value="45">
                    45 minutes
                  </option>

                  <option value="60">
                    60 minutes
                  </option>
                </select>
              </div>

              {/* SESSION TYPE */}

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Session Type
                </label>

                <select
                  value={sessionType}
                  onChange={(e) =>
                    setSessionType(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                >
                  {sessionTypes.map(
                    (type) => (
                      <option
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* MESSAGE */}

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Message for Mentor
                </label>

                <textarea
                  value={studentMessage}
                  onChange={(e) =>
                    setStudentMessage(
                      e.target.value
                    )
                  }
                  rows={5}
                  placeholder="Tell the mentor what you want help with..."
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                />
              </div>

              {/* EXISTING PENDING NOTICE */}

              {existingPendingSession && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="font-semibold text-amber-300">
                    Pending payment found
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    You already have a booking
                    for this time. You can
                    continue the payment instead
                    of creating another booking.
                  </p>
                </div>
              )}

              {/* PAYMENT INFO */}

              {price > 0 && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">
                        Secure Payment
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        You will be redirected to
                        Razorpay Checkout.
                      </p>
                    </div>

                    <span className="font-bold text-cyan-400">
                      {mentor.currency ===
                      "INR"
                        ? "₹"
                        : mentor.currency ||
                          "₹"}{" "}
                      {price.toLocaleString(
                        "en-IN"
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* ERROR */}

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* SUCCESS */}

              {success && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                  {success}
                </div>
              )}

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full rounded-xl bg-cyan-500 px-6 py-4 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paymentLoading
                  ? "Opening Razorpay..."
                  : checkingBooking
                    ? "Checking Booking..."
                    : existingPendingSession
                      ? `Continue Payment ₹${Number(
                          existingPendingSession.session_price ??
                            price
                        ).toLocaleString(
                          "en-IN"
                        )} →`
                      : booking
                        ? "Creating Booking..."
                        : price > 0
                          ? `Pay ₹${price.toLocaleString(
                              "en-IN"
                            )} & Book Session →`
                          : "Book Session →"}
              </button>
            </form>
          </section>

          {/* SUMMARY */}

          <aside className="space-y-6">
            {/* MENTOR */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 text-xl font-bold text-slate-950">
                  {mentor.full_name
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <h2 className="font-bold">
                    {mentor.full_name}
                  </h2>

                  <p className="text-sm text-slate-400">
                    {mentor.job_role}
                  </p>

                  <p className="text-sm text-slate-500">
                    {mentor.current_company}
                  </p>
                </div>
              </div>
            </section>

            {/* BOOKING SUMMARY */}

            <section className="rounded-2xl border border-cyan-500/20 bg-slate-900 p-6">
              <h2 className="font-bold">
                Booking Summary
              </h2>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">
                    Date
                  </span>

                  <span className="text-right">
                    {selectedDate ||
                      "Not selected"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">
                    Time
                  </span>

                  <span>
                    {selectedTime
                      ? formatTime(
                          selectedTime
                        )
                      : "Not selected"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">
                    Duration
                  </span>

                  <span>
                    {duration} minutes
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">
                    Session
                  </span>

                  <span className="text-right">
                    {
                      sessionTypes.find(
                        (item) =>
                          item.value ===
                          sessionType
                      )?.label
                    }
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      Total
                    </span>

                    <span className="text-2xl font-bold text-cyan-400">
                      {mentor.currency ===
                      "INR"
                        ? "₹"
                        : mentor.currency ||
                          "₹"}{" "}
                      {price.toLocaleString(
                        "en-IN"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* AVAILABILITY */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="font-bold">
                Available Days
              </h2>

              <div className="mt-4 space-y-2">
                {availability.length >
                0 ? (
                  availability.map(
                    (slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm"
                      >
                        <span>
                          {
                            days[
                              slot.day_of_week
                            ]
                          }
                        </span>

                        <span className="text-cyan-400">
                          {formatTime(
                            slot.start_time
                          )}{" "}
                          –
                          {formatTime(
                            slot.end_time
                          )}
                        </span>
                      </div>
                    )
                  )
                ) : (
                  <p className="text-sm text-slate-500">
                    No availability found.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
