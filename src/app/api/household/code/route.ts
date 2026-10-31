import { requireSession } from "@/lib/current-session";
import { handle, json } from "@/lib/http";
import { getCodeKeys } from "@/modules/households/households.keys";
import { householdsRepository } from "@/modules/households/households.repository";
import { regenerateCode } from "@/modules/households/households.service";

// Código nuevo: el anterior (y los enlaces /join con él) dejan de servir. Las sesiones abiertas siguen.
export const POST = handle(async () => {
  const { householdId } = await requireSession();
  const code = await regenerateCode(
    householdsRepository,
    householdId,
    getCodeKeys(),
  );
  return json({ code });
});
