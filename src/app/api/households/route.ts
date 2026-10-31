import { getEnv } from "@/lib/env";
import { handle, HttpError, json, parseJson } from "@/lib/http";
import { startSession } from "@/lib/start-session";
import { babyRepository } from "@/modules/babies/baby.repository";
import { getCodeKeys } from "@/modules/households/households.keys";
import { householdsRepository } from "@/modules/households/households.repository";
import { onboardingInput } from "@/modules/households/households.schemas";
import {
  startFamily,
  type StartFamilyError,
} from "@/modules/households/households.service";

const ERRORS: Record<StartFamilyError, [number, string]> = {
  future_date: [422, "La fecha de nacimiento no puede ser futura"],
  too_old: [422, "La app es para bebés de hasta 3 años"],
  unknown_allergen: [422, "Alérgeno desconocido"],
  signup_closed: [403, "Por ahora no se están creando recetarios nuevos"],
};

// Alta autoservicio (/empezar). El código se devuelve aquí para mostrarlo al terminar.
export const POST = handle(async (req) => {
  const input = await parseJson(req, onboardingInput, 2048);
  const result = await startFamily(
    { ...householdsRepository, allergenSlugs: babyRepository.allergenSlugs },
    input,
    getCodeKeys(),
    { now: new Date(), maxHouseholds: getEnv().MAX_HOUSEHOLDS },
  );
  if (!result.ok) {
    const [status, message] = ERRORS[result.error];
    throw new HttpError(status, result.error, message);
  }
  await startSession(result.householdId, result.memberId);
  return json({ code: result.code }, { status: 201 });
});
