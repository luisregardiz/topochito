import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

export const SESSION_COOKIE = "recetario_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const key = (secret: string) => new TextEncoder().encode(secret);

// El token solo lleva el householdId (claim `sub`).
export function signSession(householdId: string, secret: string) {
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(householdId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
    });
    const sub = z.uuid().safeParse(payload.sub);
    return sub.success ? { householdId: sub.data } : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  } as const;
}
