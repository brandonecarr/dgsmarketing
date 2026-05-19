import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Hosts considered "the app" — anything else gets rewritten into /p/ so
 * tenant-owned custom domains serve their public landing pages.
 *
 * Set APP_HOSTS=app.example.com,www.example.com to extend in production.
 */
const APP_HOSTS = new Set(
  [
    "localhost",
    "127.0.0.1",
    ...(process.env.APP_HOSTS?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) ?? []),
  ],
);

function isAppHost(host: string) {
  const h = host.split(":")[0]!.toLowerCase();
  if (APP_HOSTS.has(h)) return true;
  if (h.endsWith(".vercel.app")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const path = request.nextUrl.pathname;

  // Custom-domain rewrite: a non-app host serves the tenant's public pages.
  // /  →  /p/__root__   (resolved to the tenant's customDomainRootSlug page)
  // /foo  →  /p/foo
  if (host && !isAppHost(host)) {
    const skipPrefixes = [
      "/p/",
      "/api/",
      "/q/",
      "/_next/",
      "/favicon.ico",
      "/dsar",
      "/legal/",
      "/integrations",
      "/docs/",
    ];
    const isSkip = skipPrefixes.some((p) => path.startsWith(p));
    if (!isSkip) {
      const url = request.nextUrl.clone();
      url.pathname = path === "/" ? "/p/__root__" : `/p${path}`;
      return NextResponse.rewrite(url);
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>,
        ) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const isAuthed = !!data.user;

  const publicPaths = [
    "/login",
    "/auth/callback",
    "/q/",
    "/p/",
    "/api/webhooks/",
    "/api/embed/",
    "/dsar",
    "/legal/",
    "/integrations",
    "/docs/",
    "/api/dsar",
  ];
  const isPublic = publicPaths.some((p) => path.startsWith(p));

  if (!isAuthed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isAuthed && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
