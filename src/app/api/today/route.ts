import { requireHouseholdId } from "@/lib/current-session";
import { handle, json } from "@/lib/http";
import { menuDeps } from "@/modules/menu/menu.deps";
import { getToday } from "@/modules/menu/menu.service";

// Comidas de hoy en la zona horaria de la familia. `today: null` si aún no hay perfil del bebé.
export const GET = handle(async () => {
  const householdId = await requireHouseholdId();
  return json(await getToday(menuDeps(), householdId));
});
