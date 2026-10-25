import { requireHouseholdId } from "@/lib/current-session";
import { handle, HttpError, json, parseJson } from "@/lib/http";
import { babyRepository } from "@/modules/babies/baby.repository";
import { babyInput } from "@/modules/babies/baby.schemas";
import { getBaby, saveBaby } from "@/modules/babies/baby.service";

export const GET = handle(async () => {
  const householdId = await requireHouseholdId();
  return json({ baby: await getBaby(babyRepository, householdId, new Date()) });
});

const MESSAGES = {
  future_date: "La fecha de nacimiento no puede ser futura",
  too_old: "La app es para bebés de hasta 3 años",
  unknown_allergen: "Alérgeno desconocido",
} as const;

export const PUT = handle(async (req) => {
  const householdId = await requireHouseholdId();
  const input = await parseJson(req, babyInput, 2048);
  const result = await saveBaby(babyRepository, householdId, input, new Date());
  if (!result.ok)
    throw new HttpError(422, result.reason, MESSAGES[result.reason]);
  return json({ baby: result.baby });
});
