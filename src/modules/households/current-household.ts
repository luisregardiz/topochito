import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { membersRepository } from "@/modules/members/members.repository";
import { getCodeKeys } from "./households.keys";
import { householdsRepository } from "./households.repository";
import { shareCodeOf } from "./households.service";

// Familia de la sesión actual (Server Components), con su código descifrado para poder compartirlo.
// Cada visita cuenta como actividad (evita la purga por inactividad). Un cuidador revocado no entra.
// Una cookie vieja sin cuidador pasa: la migra la primera llamada a la API (aquí no se pueden escribir cookies).
export const getCurrentHousehold = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, getEnv().SESSION_SECRET);
  if (!session) return null;
  if (session.memberId) {
    const member = await membersRepository.find(session.memberId);
    if (
      !member ||
      member.revokedAt ||
      member.householdId !== session.householdId
    )
      return null;
    await membersRepository.touch(member.id);
  }
  const row = await householdsRepository.findById(session.householdId);
  if (!row) return null;
  await householdsRepository.touch(row.id);
  return { ...shareCodeOf(row, getCodeKeys()), memberId: session.memberId };
});
