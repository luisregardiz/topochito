import { getEnv } from "@/lib/env";
import { handle, HttpError, json, parseJson } from "@/lib/http";
import { startSession } from "@/lib/start-session";
import { getCodeKeys } from "@/modules/households/households.keys";
import { householdsRepository } from "@/modules/households/households.repository";
import { createHouseholdInput } from "@/modules/households/households.schemas";
import { createHousehold } from "@/modules/households/households.service";

export const POST = handle(async (req) => {
  const { name } = await parseJson(req, createHouseholdInput, 512);
  const household = await createHousehold(
    householdsRepository,
    name,
    getCodeKeys(),
    {
      maxHouseholds: getEnv().MAX_HOUSEHOLDS,
    },
  );
  if (!household) {
    throw new HttpError(
      403,
      "signup_closed",
      "Por ahora no se están creando recetarios nuevos",
    );
  }

  await startSession(household.id); // entra directo; el código se comparte desde la app
  return json({ ok: true }, { status: 201 });
});
