import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

export const SESSION_COOKIE = "recetario_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const key = (secret: string) => new TextEncoder().encode(secret);

export type Session = {
  householdId: string;
  memberId: string | null; // null en cookies anteriores a los cuidadores (se migran al vuelo)
  issuedAt: number;
};

// El token lleva el householdId (claim `sub`) y el cuidador (claim `mid`).
export function signSession(
  householdId: string,
  memberId: string,
  secret: string,
) {
  return new SignJWT({ mid: memberId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(householdId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key(secret));
}

const claims = z.object({
  sub: z.uuid(),
  mid: z.uuid().optional(),
  iat: z.number().int().optional(),
});

export async function verifySession(
  token: string | undefined,
  secret: string,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
    });
    const c = claims.safeParse(payload);
    if (!c.success) return null;
    return {
      householdId: c.data.sub,
      memberId: c.data.mid ?? null,
      issuedAt: c.data.iat ?? 0,
    };
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
