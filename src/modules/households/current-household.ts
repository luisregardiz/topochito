import "server-only";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { getCodeKeys } from "./households.keys";
import { householdsRepository } from "./households.repository";
import { shareCodeOf } from "./households.service";

// Familia de la sesión actual, con su código descifrado para poder compartirlo.
// Cada visita cuenta como actividad (evita la purga por inactividad).
export async function getCurrentHousehold() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, getEnv().SESSION_SECRET);
  if (!session) return null;
  const row = await householdsRepository.findById(session.householdId);
  if (!row) return null;
  await householdsRepository.touch(row.id);
  return shareCodeOf(row, getCodeKeys());
}
