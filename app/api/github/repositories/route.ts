import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const authClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type GithubUser = {
  login?: string;
  id?: number;
};

type GithubRepository = {
  id?: number;
  name?: string;
  full_name?: string;
  private?: boolean;
  html_url?: string;
  description?: string | null;
  owner?: {
    login?: string;
  };
};

async function authenticateVertexUser(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return {
      user: null,
      accessToken: null,
      response: NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      ),
    };
  }

  const tokenMatch =
    authorization.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return {
      user: null,
      accessToken: null,
      response: NextResponse.json(
        {
          success: false,
          error: "Invalid authentication header.",
        },
        { status: 401 }
      ),
    };
  }

  const accessToken = tokenMatch[1].trim();

  if (!accessToken) {
    return {
      user: null,
      accessToken: null,
      response: NextResponse.json(
        {
          success: false,
          error: "Authentication token is missing.",
        },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(accessToken);

  if (error || !user) {
    return {
      user: null,
      accessToken: null,
      response: NextResponse.json(
        {
          success: false,
          error: "Invalid or expired session.",
        },
        { status: 401 }
      ),
    };
  }

  return {
    user,
    accessToken,
    response: null,
  };
}

async function githubGet<T>(
  path: string,
  providerToken: string
): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
}> {
  const response = await fetch(
    `${GITHUB_API}${path}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${providerToken}`,
        Accept:
          "application/vnd.github+json",
        "X-GitHub-Api-Version":
          GITHUB_API_VERSION,
        "User-Agent":
          "Vertex-Placement-Platform",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: null,
    };
  }

  try {
    const data = (await response.json()) as T;

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      data: null,
    };
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    /*
     * 1. Authenticate the Vertex user.
     */
    const auth =
      await authenticateVertexUser(request);

    if (auth.response) {
      return auth.response;
    }

    /*
     * 2. The GitHub provider token is supplied
     *    separately through X-GitHub-Provider-Token.
     *
     *    This prevents accidentally treating the
     *    Supabase access token as a GitHub token.
     */
    const providerToken =
      request.headers.get(
        "x-github-provider-token"
      )?.trim();

    if (!providerToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GitHub connection is required.",
        },
        { status: 401 }
      );
    }

    /*
     * 3. Verify that the GitHub token is valid
     *    and identify the GitHub account.
     */
    const githubUserResult =
      await githubGet<GithubUser>(
        "/user",
        providerToken
      );

    if (
      !githubUserResult.ok ||
      !githubUserResult.data?.login
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify the GitHub connection.",
        },
        { status: 401 }
      );
    }

    const githubLogin =
      githubUserResult.data.login;

    /*
     * 4. Fetch repositories belonging to the
     *    authenticated GitHub account.
     */
    const repositoriesResult =
      await githubGet<GithubRepository[]>(
        "/user/repos?per_page=100&sort=updated&direction=desc",
        providerToken
      );

    if (
      !repositoriesResult.ok ||
      !Array.isArray(
        repositoriesResult.data
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to retrieve GitHub repositories.",
        },
        { status: 502 }
      );
    }

    /*
     * 5. Only expose the fields required by
     *    the Vertex UI.
     */
    const repositories =
      repositoriesResult.data
        .filter((repo) => {
          /*
           * GitHub's /user/repos endpoint returns
           * repositories accessible to the token.
           *
           * We additionally ensure the repository
           * has a valid owner before returning it.
           */
          return Boolean(
            repo.owner?.login &&
              repo.owner.login.toLowerCase() ===
                githubLogin.toLowerCase()
          );
        })
        .map((repo) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          html_url: repo.html_url,
          description:
            repo.description ?? null,
        }));

    return NextResponse.json({
      success: true,
      repositories,
    });
  } catch (error) {
    /*
     * Keep detailed errors in server logs only.
     * Never expose internal exception messages.
     */
    console.error(
      "GitHub repositories route failed:",
      error instanceof Error
        ? error.name
        : "Unknown error"
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to retrieve GitHub repositories.",
      },
      { status: 500 }
    );
  }
}