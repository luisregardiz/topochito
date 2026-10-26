import { requireHouseholdId } from "@/lib/current-session";
import { handle, HttpError, json, parseJson } from "@/lib/http";
import { pantryRepository } from "@/modules/pantry/pantry.repository";
import { pantryInput } from "@/modules/pantry/pantry.schemas";
import { getPantry, savePantry } from "@/modules/pantry/pantry.service";

export const GET = handle(async () =>
  json(await getPantry(pantryRepository, await requireHouseholdId())),
);

export const PUT = handle(async (req) => {
  const householdId = await requireHouseholdId();
  const { unavailable } = await parseJson(req, pantryInput, 16384);
  const result = await savePantry(pantryRepository, householdId, unavailable);
  if (!result.ok)
    throw new HttpError(422, result.reason, "Alimento desconocido");
  return json(result.state);
});
