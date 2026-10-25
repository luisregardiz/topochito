import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { handle, HttpError, json, parseJson } from "@/lib/http";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "@/lib/session";
import { accessInput } from "@/modules/households/households.schemas";
import { authenticate } from "@/modules/households/households.service";
import { householdsRepository } from "@/modules/households/households.repository";

export const POST = handle(async (req) => {
  const { code } = await parseJson(req, accessInput, 256);
  const household = await authenticate(householdsRepository, code);
  if (!household) throw new HttpError(401, "invalid_code", "Código incorrecto");

  const token = await signSession(household.id, getEnv().SESSION_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  return json({ ok: true });
});
