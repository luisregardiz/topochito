import { requireHouseholdId } from "@/lib/current-session";
import { handle, json } from "@/lib/http";
import { menuDeps } from "@/modules/menu/menu.deps";
import { getMenu } from "@/modules/menu/menu.service";

export const GET = handle(async () =>
  json(await getMenu(menuDeps(), await requireHouseholdId())),
);
