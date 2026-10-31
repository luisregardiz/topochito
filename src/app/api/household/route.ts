import { requireSession } from "@/lib/current-session";
import { handle, HttpError, json, parseJson } from "@/lib/http";
import { householdsRepository } from "@/modules/households/households.repository";
import { settingsInput } from "@/modules/households/households.schemas";

// Ajustes de la familia: horarios de comida, zona horaria y país.
export const GET = handle(async () => {
  const { householdId } = await requireSession();
  const settings = await householdsRepository.settings(householdId);
  if (!settings)
    throw new HttpError(404, "not_found", "Recetario no encontrado");
  return json({ settings });
});

export const PUT = handle(async (req) => {
  const { householdId } = await requireSession();
  const input = await parseJson(req, settingsInput, 1024);
  await householdsRepository.saveSettings(householdId, input);
  return json({ settings: await householdsRepository.settings(householdId) });
});
