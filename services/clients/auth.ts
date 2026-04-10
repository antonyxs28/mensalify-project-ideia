import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export interface AuthenticatedContext {
  supabase: ReturnType<typeof createServerClient>;
  userId: string;
}

export async function getAuthenticatedContext(): Promise<AuthenticatedContext> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  console.log(
    "[AUTH] Cookies present:",
    allCookies.map((c) => c.name),
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: CookieOptions;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  let {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  console.log(
    "[AUTH] getAuthenticatedUser (cookies) - User:",
    user?.id || "none",
    "error:",
    error?.message,
  );

  if (!user) {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    const refreshToken = headersList.get("x-refresh-token");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      console.log("[AUTH] Trying token from Authorization header");
      console.log("[AUTH] Refresh token available:", !!refreshToken);

      const {
        data: { user: tokenUser },
        error: tokenError,
      } = await supabase.auth.getUser(token);
      console.log(
        "[AUTH] getAuthenticatedUser (token) - User:",
        tokenUser?.id || "none",
        "error:",
        tokenError?.message,
      );

      if (tokenUser && !tokenError) {
        const refreshTok = refreshToken || "";

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshTok,
        });

        console.log(
          "[AUTH] Session set for RLS, error:",
          setSessionError?.message || "none",
        );

        return { supabase, userId: tokenUser.id };
      }
    }
  }

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, userId: user.id };
}