import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { errorResponse } from "@/lib/http";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PATHS = new Set([
  "/acceso",
  "/api/access",
  "/api/access/logout",
  "/api/health",
]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let limiters: { api: RateLimiter; access: RateLimiter } | undefined;
const getLimiters = () =>
  (limiters ??= {
    api: createRateLimiter({ prefix: "api", limit: 60, windowSeconds: 60 }),
    access: createRateLimiter({
      prefix: "access",
      limit: 5,
      windowSeconds: 15 * 60,
    }),
  });

// En Vercel x-forwarded-for lo fija la plataforma; fuera de ella un cliente podría falsearlo.
function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function tooMany(retryAfterSeconds: number) {
  return errorResponse(429, "rate_limited", "Demasiadas solicitudes", {
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi) {
    const { api, access } = getLimiters();
    const ip = clientIp(req);
    const general = await api.limit(ip);
    if (!general.success) return tooMany(general.retryAfterSeconds);
    if (pathname === "/api/access" && req.method === "POST") {
      const attempts = await access.limit(ip);
      if (!attempts.success) return tooMany(attempts.retryAfterSeconds);
    }
  }

  // Complementa SameSite=Lax: los métodos que modifican datos deben venir del mismo origen.
  if (!SAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return errorResponse(403, "bad_origin", "Origen no permitido");
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = await verifySession(
    req.cookies.get(SESSION_COOKIE)?.value,
    getEnv().SESSION_SECRET,
  );
  if (session) return NextResponse.next();

  if (isApi) return errorResponse(401, "unauthorized", "Acceso requerido");
  return NextResponse.redirect(new URL("/acceso", req.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
