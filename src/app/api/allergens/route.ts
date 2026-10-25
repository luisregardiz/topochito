import { handle, json } from "@/lib/http";
import { recipesRepository } from "@/modules/recipes/recipes.repository";
import { listAllergens } from "@/modules/recipes/recipes.service";

export const GET = handle(async () =>
  json({ allergens: await listAllergens(recipesRepository) }),
);
