import { requireHouseholdId } from "@/lib/current-session";
import { handle, json } from "@/lib/http";
import { menuDeps, menuError } from "@/modules/menu/menu.deps";
import { generateMenu } from "@/modules/menu/menu.service";

export const POST = handle(async () => {
  const result = await generateMenu(menuDeps(), await requireHouseholdId());
  if (!result.ok) menuError(result.error);
  return json({ menu: result.menu });
});
