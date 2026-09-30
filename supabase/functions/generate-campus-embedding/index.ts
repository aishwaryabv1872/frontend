declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
};

declare const Supabase: {
  ai: {
    Session: new (modelName: string) => {
      run(
        input: string,
        options?: {
          mean_pool?: boolean;
          normalize?: boolean;
        }
      ): Promise<number[]>;
    };
  };
};

const model = new Supabase.ai.Session("gte-small");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  // Normal question/report embedding
  question_id?: string;
  report_id?: string;

  // Semantic search query embedding
  content?: string;

  question?: string;
  category?: string | null;
  difficulty?: string | null;
  round_name?: string | null;
  company_name?: string | null;
  role?: string | null;
  interview_year?: number | null;

  report_difficulty?: string | null;
  overall_experience?: string | null;
  preparation_advice?: string | null;
};

function buildSearchText(body: RequestBody): string {
  const parts = [
    body.question,
    body.category ? `Category: ${body.category}` : null,
    body.difficulty ? `Difficulty: ${body.difficulty}` : null,
    body.round_name ? `Round: ${body.round_name}` : null,
    body.company_name ? `Company: ${body.company_name}` : null,
    body.role ? `Role: ${body.role}` : null,
    body.interview_year
      ? `Interview Year: ${body.interview_year}`
      : null,
    body.report_difficulty
      ? `Interview Difficulty: ${body.report_difficulty}`
      : null,
    body.overall_experience
      ? `Overall Experience: ${body.overall_experience}`
      : null,
    body.preparation_advice
      ? `Preparation Advice: ${body.preparation_advice}`
      : null,
  ];

  return parts
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0
    )
    .join("\n")
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Only POST requests are supported.",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const body = (await req.json()) as RequestBody;

    /*
     * ============================================================
     * SEMANTIC SEARCH QUERY MODE
     * ============================================================
     *
     * The frontend sends:
     *
     * {
     *   content: "React state and props"
     * }
     *
     * We generate a 384-dimensional embedding and return it.
     *
     * IMPORTANT:
     * We do NOT store this embedding in the database.
     */
    if (body.content && body.content.trim()) {
      const queryText = body.content.trim().slice(0, 6000);

      const embedding = await model.run(queryText, {
        mean_pool: true,
        normalize: true,
      });

      if (!embedding) {
        throw new Error(
          "Query embedding generation returned no result."
        );
      }

      const embeddingArray = Array.from(
        embedding as Iterable<number>
      );

      if (embeddingArray.length !== 384) {
        throw new Error(
          `Unexpected embedding dimension: ${embeddingArray.length}. Expected 384.`
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "query",
          embedding: embeddingArray,
          embedding_dimensions: embeddingArray.length,
          content_length: queryText.length,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    /*
     * ============================================================
     * STORED CAMPUS INTEL EMBEDDING MODE
     * ============================================================
     */

    if (!body.question_id && !body.report_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "question_id, report_id, or content is required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const content = buildSearchText(body);

    if (!content) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No searchable text was provided.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const limitedContent = content.slice(0, 6000);

    const embedding = await model.run(limitedContent, {
      mean_pool: true,
      normalize: true,
    });

    if (!embedding) {
      throw new Error(
        "Embedding generation returned no result."
      );
    }

    const embeddingArray = Array.from(
      embedding as Iterable<number>
    );

    if (embeddingArray.length !== 384) {
      throw new Error(
        `Unexpected embedding dimension: ${embeddingArray.length}. Expected 384.`
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing."
      );
    }

    const baseHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    const embeddingPayload = {
      question_id: body.question_id ?? null,
      report_id: body.report_id ?? null,
      content: limitedContent,
      embedding: embeddingArray,
      metadata: {
        category: body.category ?? null,
        difficulty: body.difficulty ?? null,
        round_name: body.round_name ?? null,
        company_name: body.company_name ?? null,
        role: body.role ?? null,
        interview_year: body.interview_year ?? null,
        report_difficulty:
          body.report_difficulty ?? null,
      },
      updated_at: new Date().toISOString(),
    };

    let stored: unknown;

    if (body.question_id) {
      const existingResponse = await fetch(
        `${supabaseUrl}/rest/v1/campus_interview_embeddings?question_id=eq.${encodeURIComponent(
          body.question_id
        )}&select=id&limit=1`,
        {
          method: "GET",
          headers: baseHeaders,
        }
      );

      if (!existingResponse.ok) {
        const errorText = await existingResponse.text();

        throw new Error(
          `Failed to check existing embedding: ${existingResponse.status} ${errorText}`
        );
      }

      const existingRows =
        await existingResponse.json();

      if (
        Array.isArray(existingRows) &&
        existingRows.length > 0
      ) {
        const embeddingId = existingRows[0].id;

        const updateResponse = await fetch(
          `${supabaseUrl}/rest/v1/campus_interview_embeddings?id=eq.${encodeURIComponent(
            embeddingId
          )}`,
          {
            method: "PATCH",
            headers: {
              ...baseHeaders,
              Prefer: "return=representation",
            },
            body: JSON.stringify(
              embeddingPayload
            ),
          }
        );

        if (!updateResponse.ok) {
          const errorText =
            await updateResponse.text();

          throw new Error(
            `Failed to update embedding: ${updateResponse.status} ${errorText}`
          );
        }

        stored = await updateResponse.json();
      } else {
        const insertResponse = await fetch(
          `${supabaseUrl}/rest/v1/campus_interview_embeddings`,
          {
            method: "POST",
            headers: {
              ...baseHeaders,
              Prefer: "return=representation",
            },
            body: JSON.stringify(
              embeddingPayload
            ),
          }
        );

        if (!insertResponse.ok) {
          const errorText =
            await insertResponse.text();

          throw new Error(
            `Failed to insert embedding: ${insertResponse.status} ${errorText}`
          );
        }

        stored = await insertResponse.json();
      }
    } else {
      const insertResponse = await fetch(
        `${supabaseUrl}/rest/v1/campus_interview_embeddings`,
        {
          method: "POST",
          headers: {
            ...baseHeaders,
            Prefer: "return=representation",
          },
          body: JSON.stringify(
            embeddingPayload
          ),
        }
      );

      if (!insertResponse.ok) {
        const errorText =
          await insertResponse.text();

        throw new Error(
          `Failed to insert report embedding: ${insertResponse.status} ${errorText}`
        );
      }

      stored = await insertResponse.json();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Campus Intel embedding generated successfully.",
        embedding_dimensions:
          embeddingArray.length,
        content_length:
          limitedContent.length,
        data: stored,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "CAMPUS EMBEDDING ERROR:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate Campus Intel embedding.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});