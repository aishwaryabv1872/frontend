import { supabase } from "./supabase";

export type CodeExecutionResult = {
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
  time: string | null;
  memory: number | null;
  status: string;
  statusId: number | null;
};


export async function executeCode(
  sourceCode: string,
  languageId: number,
  stdin = ""
): Promise<CodeExecutionResult> {
  /*
   * Get the currently authenticated Vertex session.
   */
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (
    sessionError ||
    !session?.access_token
  ) {
    throw new Error(
      "You must be logged in to execute code."
    );
  }

  const response = await fetch(
    "/api/execute-code",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${session.access_token}`,
      },

      body: JSON.stringify({
        source_code:
          sourceCode,
        language_id:
          languageId,
        stdin,
      }),
    }
  );

  let data: unknown;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      "Invalid response from code execution service."
    );
  }

  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Invalid response from code execution service."
    );
  }

  const result =
    data as {
      success?: boolean;
      error?: string;
      stdout?: string;
      stderr?: string;
      compileOutput?: string;
      message?: string;
      time?: string | null;
      memory?: number | null;
      status?: string;
      statusId?: number | null;
    };

  if (!response.ok) {
    throw new Error(
      result.error ||
        "Failed to execute code."
    );
  }

  return {
    stdout:
      result.stdout ?? "",

    stderr:
      result.stderr ?? "",

    compileOutput:
      result.compileOutput ?? "",

    message:
      result.message ?? "",

    time:
      result.time ?? null,

    memory:
      result.memory ?? null,

    status:
      result.status ??
      "Unknown",

    statusId:
      result.statusId ?? null,
  };
}