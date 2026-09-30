import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import mammoth from "mammoth";
import {
  extractText,
  getDocumentProxy,
} from "unpdf";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PAGES = 20;
const MAX_TEXT_LENGTH = 30000;
const PROCESSING_TIMEOUT_MS = 30_000;

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".txt",
]);

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

function parseBearerToken(
  request: NextRequest
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return match?.[1]?.trim() || null;
}

function cleanResumeText(
  text: string
) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getExtension(
  fileName: string
): string {
  const lower =
    fileName.toLowerCase();

  const lastDot =
    lower.lastIndexOf(".");

  if (lastDot === -1) {
    return "";
  }

  return lower.substring(
    lastDot
  );
}

function isPdfSignature(
  buffer: Buffer
): boolean {
  return (
    buffer.length >= 5 &&
    buffer
      .subarray(0, 5)
      .toString("ascii") ===
      "%PDF-"
  );
}

function isZipSignature(
  buffer: Buffer
): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeoutPromise =
    new Promise<never>(
      (_, reject) => {
        timeoutId =
          setTimeout(() => {
            reject(
              new Error(
                "PROCESSING_TIMEOUT"
              )
            );
          }, timeoutMs);
      }
    );

  try {
    return await Promise.race([
      promise,
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    // ==========================================
    // 1. AUTHENTICATE USER
    // ==========================================

    const accessToken =
      parseBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    const {
      data: {
        user,
      },
      error: authError,
    } = await supabase.auth.getUser(
      accessToken
    );

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    // ==========================================
    // 2. READ FORM DATA
    // ==========================================

    let formData: FormData;

    try {
      formData =
        await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid upload request.",
        },
        { status: 400 }
      );
    }

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No resume file was uploaded.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // 3. FILE SIZE VALIDATION
    // ==========================================

    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The uploaded file is empty.",
        },
        { status: 400 }
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Resume must be smaller than 5 MB.",
        },
        { status: 413 }
      );
    }

    // ==========================================
    // 4. FILE TYPE VALIDATION
    // ==========================================

    const originalName =
      file.name || "";

    const extension =
      getExtension(
        originalName
      );

    if (
      !ALLOWED_EXTENSIONS.has(
        extension
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only PDF, DOCX, and TXT files are supported.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // 5. READ FILE
    // ==========================================

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    let text = "";

    // ==========================================
    // 6. PDF
    // ==========================================

    if (extension === ".pdf") {
      if (
        !isPdfSignature(
          buffer
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The uploaded file is not a valid PDF.",
          },
          { status: 400 }
        );
      }

      try {
        const pdf =
          await withTimeout(
            getDocumentProxy(
              new Uint8Array(
                buffer
              )
            ),
            PROCESSING_TIMEOUT_MS
          );

        if (
          !Number.isInteger(
            pdf.numPages
          ) ||
          pdf.numPages <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "The PDF does not contain readable pages.",
            },
            { status: 422 }
          );
        }

        if (
          pdf.numPages >
          MAX_PAGES
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                `Resume must have ${MAX_PAGES} pages or fewer.`,
            },
            { status: 400 }
          );
        }

        const result =
          await withTimeout(
            extractText(pdf, {
              mergePages: true,
            }),
            PROCESSING_TIMEOUT_MS
          );

        text =
          result.text || "";
      } catch (error) {
        console.error(
          "Resume PDF processing failed:",
          {
            userId:
              user.id,
            error:
              error instanceof
              Error
                ? error.name
                : "UnknownError",
          }
        );

        if (
          error instanceof
            Error &&
          error.message ===
            "PROCESSING_TIMEOUT"
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Resume processing timed out.",
            },
            { status: 408 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            error:
              "Unable to process the PDF resume.",
          },
          { status: 422 }
        );
      }
    }

    // ==========================================
    // 7. DOCX
    // ==========================================

    else if (
      extension === ".docx"
    ) {
      if (
        !isZipSignature(
          buffer
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The uploaded file is not a valid DOCX document.",
          },
          { status: 400 }
        );
      }

      try {
        const result =
          await withTimeout(
            mammoth.extractRawText({
              buffer,
            }),
            PROCESSING_TIMEOUT_MS
          );

        text =
          result.value || "";
      } catch (error) {
        console.error(
          "Resume DOCX processing failed:",
          {
            userId:
              user.id,
            error:
              error instanceof
              Error
                ? error.name
                : "UnknownError",
          }
        );

        if (
          error instanceof
            Error &&
          error.message ===
            "PROCESSING_TIMEOUT"
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Resume processing timed out.",
            },
            { status: 408 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            error:
              "Unable to process the DOCX resume.",
          },
          { status: 422 }
        );
      }
    }

    // ==========================================
    // 8. TXT
    // ==========================================

    else if (
      extension === ".txt"
    ) {
      text =
        buffer.toString(
          "utf-8"
        );
    }

    // ==========================================
    // 9. CLEAN EXTRACTED TEXT
    // ==========================================

    text =
      cleanResumeText(text);

    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No readable text was found in this resume. Scanned or image-only PDFs are not supported yet.",
        },
        { status: 422 }
      );
    }

    if (
      text.length >
      MAX_TEXT_LENGTH
    ) {
      text =
        text.substring(
          0,
          MAX_TEXT_LENGTH
        );
    }

    // ==========================================
    // 10. SAFE RESPONSE
    // ==========================================

    return NextResponse.json({
      success: true,
      fileName:
        originalName,
      fileSize:
        file.size,
      text,
    });
  } catch (error) {
    console.error(
      "VERTEX RESUME EXTRACTION ERROR:",
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to process the uploaded resume.",
      },
      { status: 500 }
    );
  }
}