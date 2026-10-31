import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { errorResponse } from "@/lib/http";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PATHS = new Set([
  "/acceso",
  "/empezar",
  "/limite",
  "/api/access",
  "/api/access/logout",
  "/api/health",
  "/api/households",
  "/api/cron/purge-inactive", // sin sesión: se protege con CRON_SECRET
]);
const PUBLIC_PREFIXES = ["/join/", "/invitacion/", "/api/invitations/"];
const isPublic = (pathname: string) =>
  PUBLIC_PATHS.has(pathname) ||
  PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type Limiters = Record<
  "api" | "access" | "create" | "createGlobal" | "invite",
  RateLimiter
>;
let limiters: Limiters | undefined;
const getLimiters = () =>
  (limiters ??= {
    api: createRateLimiter({ prefix: "api", limit: 60, windowSeconds: 60 }),
    access: createRateLimiter({
      prefix: "access",
      limit: 5,
      windowSeconds: 15 * 60,
    }),
    create: createRateLimiter({
      prefix: "create",
      limit: 5,
      windowSeconds: 60 * 60,
    }),
    invite: createRateLimiter({
      prefix: "invite",
      limit: 10,
      windowSeconds: 60 * 60,
    }),
    // Tope global: protege la base aunque el abuso venga de muchas IPs.
    createGlobal: createRateLimiter({
      prefix: "create-global",
      limit: 30,
      windowSeconds: 60 * 60,
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

// La API responde 429 en JSON; las páginas, con una pantalla de espera.
function tooMany(req: NextRequest, retryAfterSeconds: number) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.redirect(
      new URL(`/limite?s=${retryAfterSeconds}`, req.url),
    );
  }
  return errorResponse(429, "rate_limited", "Demasiadas solicitudes", {
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    // Host del navegador, no nextUrl.host: Next lo calcula con el hostname en que escucha (p. ej. 0.0.0.0 en Docker).
    const host = (
      req.headers.get("x-forwarded-host") ?? req.headers.get("host")
    )
      ?.split(",")[0]
      ?.trim();
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const { api, access, create, createGlobal, invite } = getLimiters();
  const ip = clientIp(req);

  if (isApi) {
    const general = await api.limit(ip);
    if (!general.success) return tooMany(req, general.retryAfterSeconds);
  }

  // Cada superficie que acepta un código (formulario o enlace) comparte el límite anti fuerza bruta.
  const isCreate = pathname === "/api/households" && req.method === "POST";
  const isRedeem =
    pathname.startsWith("/api/invitations/") && req.method === "POST";
  const attemptsLimiter =
    (pathname === "/api/access" && req.method === "POST") ||
    pathname.startsWith("/join/")
      ? access
      : isCreate
        ? create
        : isRedeem
          ? invite
          : null;
  if (attemptsLimiter) {
    const attempts = await attemptsLimiter.limit(ip);
    if (!attempts.success) return tooMany(req, attempts.retryAfterSeconds);
  }
  if (isCreate) {
    const global = await createGlobal.limit("all");
    if (!global.success) return tooMany(req, global.retryAfterSeconds);
  }

  // Complementa SameSite=Lax: los métodos que modifican datos deben venir del mismo origen.
  if (!SAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return errorResponse(403, "bad_origin", "Origen no permitido");
  }

  if (isPublic(pathname)) return NextResponse.next();

  const session = await verifySession(
    req.cookies.get(SESSION_COOKIE)?.value,
    getEnv().SESSION_SECRET,
  );
  if (session) return NextResponse.next();

  if (isApi) return errorResponse(401, "unauthorized", "Acceso requerido");
  return NextResponse.redirect(new URL("/acceso", req.url));
}

export const config = {
  // El manifiesto (y los iconos .png) los pide el navegador sin cookie: no pueden pasar por el gate de sesión.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
