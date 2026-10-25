import { requireHouseholdId } from "@/lib/current-session";
import { handle, json, parseJson } from "@/lib/http";
import { menuDeps, menuError } from "@/modules/menu/menu.deps";
import { regenerateInput } from "@/modules/menu/menu.schemas";
import { regenerate } from "@/modules/menu/menu.service";

export const POST = handle(async (req) => {
  const householdId = await requireHouseholdId();
  const input = await parseJson(req, regenerateInput, 256);
  const result = await regenerate(menuDeps(), householdId, input);
  if (!result.ok) menuError(result.error);
  return json({ menu: result.menu, previous: result.previous });
});
