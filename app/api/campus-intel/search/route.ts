import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_QUERY_LENGTH = 1200;
const MAX_COLLEGE_ID_LENGTH = 100;

const MATCH_THRESHOLD = 0.7;
const MATCH_COUNT = 10;

function getBearerToken(
  authorization: string | null
): string | null {
  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) return null;

  const token = match[1].trim();

  return token || null;
}

function getErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  return "UnknownError";
}

function cleanText(
  value: unknown,
  maxLength: number
): string {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

export async function POST(req: NextRequest) {
  try {
    // --------------------------------------------------
    // 1. Validate environment
    // --------------------------------------------------

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      console.error(
        "Campus semantic search configuration is incomplete."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Campus Intel search is temporarily unavailable.",
        },
        { status: 503 }
      );
    }

    // --------------------------------------------------
    // 2. Strict Bearer authentication
    // --------------------------------------------------

    const accessToken = getBearerToken(
      req.headers.get("authorization")
    );

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 3. Verify authenticated Supabase user
    // --------------------------------------------------

    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(
      accessToken
    );

    if (authError || !user) {
      console.error(
        "Campus semantic search authentication failed:",
        getErrorName(authError)
      );

      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired session.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 4. Parse request body safely
    // --------------------------------------------------

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const requestBody = body as {
      query?: unknown;
      college_id?: unknown;
    };

    // --------------------------------------------------
    // 5. Validate inputs
    // --------------------------------------------------

    const query = cleanText(
      requestBody.query,
      MAX_QUERY_LENGTH
    );

    const collegeId = cleanText(
      requestBody.college_id,
      MAX_COLLEGE_ID_LENGTH
    );

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "Search query is required.",
        },
        { status: 400 }
      );
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Search query is too long.",
        },
        { status: 400 }
      );
    }

    if (!collegeId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "College ID is required for Campus Intel search.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 6. Create privileged client only after auth
    // --------------------------------------------------

    const supabase = createClient(
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
    // 7. Generate query embedding
    // --------------------------------------------------

    const {
      data: embeddingResult,
      error: embeddingError,
    } = await supabase.functions.invoke(
      "generate-campus-embedding",
      {
        body: {
          content: query,
        },
      }
    );

    if (embeddingError) {
      console.error(
        "Campus embedding generation failed:",
        getErrorName(embeddingError)
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to prepare the Campus Intel search.",
        },
        { status: 502 }
      );
    }

    const queryEmbedding =
      embeddingResult?.embedding ??
      embeddingResult?.data?.embedding;

    // --------------------------------------------------
    // 8. Validate embedding
    // --------------------------------------------------

    if (
      !Array.isArray(queryEmbedding) ||
      queryEmbedding.length !== 384 ||
      !queryEmbedding.every(
        (value: unknown) =>
          typeof value === "number" &&
          Number.isFinite(value)
      )
    ) {
      console.error(
        "Campus search returned an invalid embedding."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to prepare the Campus Intel search.",
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------
    // 9. Semantic pgvector search
    // --------------------------------------------------

    const {
      data: matches,
      error: searchError,
    } = await supabase.rpc(
      "match_campus_interview_embeddings",
      {
        query_embedding: queryEmbedding,
        match_threshold: MATCH_THRESHOLD,
        match_count: MATCH_COUNT,
        target_college_id: collegeId,
      }
    );

    if (searchError) {
      console.error(
        "Campus semantic search RPC failed:",
        getErrorName(searchError)
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Campus Intel semantic search is temporarily unavailable.",
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------
    // 10. Return approved semantic matches
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      query,
      college_id: collegeId,
      count: Array.isArray(matches)
        ? matches.length
        : 0,
      results: Array.isArray(matches)
        ? matches
        : [],
    });
  } catch (error) {
    console.error(
      "Campus Intel semantic search request failed:",
      {
        name: getErrorName(error),
      }
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to complete Campus Intel search right now.",
      },
      { status: 500 }
    );
  }
}