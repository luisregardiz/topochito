import { handle, HttpError, json, parseJson } from "@/lib/http";
import { startSession } from "@/lib/start-session";
import { getCodeKeys } from "@/modules/households/households.keys";
import { householdsRepository } from "@/modules/households/households.repository";
import { accessInput } from "@/modules/households/households.schemas";
import { authenticate } from "@/modules/households/households.service";

export const POST = handle(async (req) => {
  const { code } = await parseJson(req, accessInput, 256);
  const household = await authenticate(
    householdsRepository,
    code,
    getCodeKeys(),
  );
  if (!household) throw new HttpError(401, "invalid_code", "Código incorrecto");

  await startSession(household.id);
  return json({ ok: true });
});
