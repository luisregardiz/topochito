import { requireHouseholdId } from "@/lib/current-session";
import { handle, json, parseJson } from "@/lib/http";
import { menuDeps, menuError } from "@/modules/menu/menu.deps";
import { entriesInput } from "@/modules/menu/menu.schemas";
import { setEntries } from "@/modules/menu/menu.service";

export const PUT = handle(async (req) => {
  const householdId = await requireHouseholdId();
  const input = await parseJson(req, entriesInput, 4096);
  const result = await setEntries(menuDeps(), householdId, input);
  if (!result.ok) menuError(result.error);
  return json({ menu: result.menu });
});
