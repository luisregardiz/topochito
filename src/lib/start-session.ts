import "server-only";
import { cookies } from "next/headers";
import { getEnv } from "./env";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "./session";

export async function startSession(householdId: string, memberId: string) {
  const token = await signSession(
    householdId,
    memberId,
    getEnv().SESSION_SECRET,
  );
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}
