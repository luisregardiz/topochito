import "server-only";
import { cookies } from "next/headers";
import { getEnv } from "./env";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "./session";

export async function startSession(householdId: string) {
  const token = await signSession(householdId, getEnv().SESSION_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}
