import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type ResumeVersion = {
  id: string;
  user_id: string;
  version_name: string;
  resume_data: unknown;
  created_at: string;
  updated_at: string;
};

export type ResumeVersionInsert = {
  user_id: string;
  version_name: string;
  resume_data: unknown;
};

const globalForSupabase =
  globalThis as typeof globalThis & {
    __vertexSupabase?: ReturnType<typeof createClient<Database>>;
  };

export const supabase =
  globalForSupabase.__vertexSupabase ??
  createClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  );

globalForSupabase.__vertexSupabase =
  supabase;

// GitHub provider tokens are intentionally NOT copied
// into application-managed localStorage.
// Supabase manages the authenticated OAuth session.
if (typeof window !== "undefined") {
  const globalWindow =
    window as typeof window & {
      __vertexGithubListenerRegistered?: boolean;
    };

  if (!globalWindow.__vertexGithubListenerRegistered) {
    globalWindow.__vertexGithubListenerRegistered =
      true;

    // Remove any legacy GitHub provider token that may
    // have been stored by an older version of Vertex.
    localStorage.removeItem(
      "github_provider_token"
    );

    supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          localStorage.removeItem(
            "github_provider_token"
          );
          localStorage.removeItem(
            "github_provider_refresh_token"
          );
        }
      }
    );
  }
}