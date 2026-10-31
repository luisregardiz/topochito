import "server-only";
import { cookies } from "next/headers";
import { membersRepository } from "@/modules/members/members.repository";
import { resolveMember } from "@/modules/members/members.service";
import { getEnv } from "./env";
import { HttpError } from "./http";
import { SESSION_COOKIE, verifySession } from "./session";
import { startSession } from "./start-session";

// Sesión de los handlers: firma de la cookie + cuidador vigente (la revocación se verifica aquí, no en proxy.ts).
// Una cookie vieja sin cuidador se migra al vuelo y se reemite (los handlers sí pueden escribir cookies).
export async function requireSession() {
  const store = await cookies();
  const session = await verifySession(
    store.get(SESSION_COOKIE)?.value,
    getEnv().SESSION_SECRET,
  );
  if (!session) throw new HttpError(401, "unauthorized", "Acceso requerido");
  const member = await resolveMember(membersRepository, session);
  if (!member) {
    store.delete(SESSION_COOKIE);
    throw new HttpError(401, "revoked", "Ya no tienes acceso a este recetario");
  }
  if (member.upgraded) await startSession(member.householdId, member.memberId);
  return member;
}

export async function requireHouseholdId() {
  return (await requireSession()).householdId;
}
