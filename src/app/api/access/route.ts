import { handle, HttpError, json, parseJson } from "@/lib/http";
import { startSession } from "@/lib/start-session";
import { getCodeKeys } from "@/modules/households/households.keys";
import { householdsRepository } from "@/modules/households/households.repository";
import { accessInput } from "@/modules/households/households.schemas";
import { authenticate } from "@/modules/households/households.service";
import { membersRepository } from "@/modules/members/members.repository";
import { CODE_MEMBER_LABEL } from "@/modules/members/members.service";

export const POST = handle(async (req) => {
  const { code, label } = await parseJson(req, accessInput, 256);
  const household = await authenticate(
    householdsRepository,
    code,
    getCodeKeys(),
  );
  if (!household) throw new HttpError(401, "invalid_code", "Código incorrecto");

  // Cada dispositivo que entra con el código es un cuidador propio (se puede revocar desde ajustes).
  const memberId = await membersRepository.create(
    household.id,
    label || CODE_MEMBER_LABEL,
  );
  await startSession(household.id, memberId);
  return json({ ok: true });
});
