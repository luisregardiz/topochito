import "server-only";
import { cookies } from "next/headers";
import { getEnv } from "./env";
import { HttpError } from "./http";
import { SESSION_COOKIE, verifySession } from "./session";

// Familia de la sesión para los handlers: solo verifica la cookie, sin consultar la base de datos.
export async function requireHouseholdId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, getEnv().SESSION_SECRET);
  if (!session) throw new HttpError(401, "unauthorized", "Acceso requerido");
  return session.householdId;
}
