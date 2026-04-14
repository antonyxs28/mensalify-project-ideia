import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export interface AuthenticatedContext {
  supabase: ReturnType<typeof createServerClient>;
  userId: string;
}

export async function getAuthenticatedContext(): Promise<AuthenticatedContext> {
  const cookieStore = await cookies();

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

  if (!user) {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    const refreshToken = headersList.get("x-refresh-token");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      const {
        data: { user: tokenUser },
        error: tokenError,
      } = await supabase.auth.getUser(token);

      if (tokenUser && !tokenError) {
        const refreshTok = refreshToken || ""

        if (!refreshTok) {
          throw new Error("Unauthorized")
        }

        await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshTok,
        });

        return { supabase, userId: tokenUser.id };
      }
    }
  }

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, userId: user.id };
}