import { requireHouseholdId } from "@/lib/current-session";
import { handle, HttpError, json } from "@/lib/http";
import { recipesRepository } from "@/modules/recipes/recipes.repository";
import { recipeCodeParam } from "@/modules/recipes/recipes.schemas";
import { getRecipe } from "@/modules/recipes/recipes.service";

export const GET = handle(
  async (_req, ctx: RouteContext<"/api/recipes/[code]">) => {
    const code = recipeCodeParam.parse((await ctx.params).code);
    const found = await getRecipe(
      recipesRepository,
      code,
      await requireHouseholdId(),
    );
    if (!found) throw new HttpError(404, "not_found", "Receta no encontrada");
    return json(found);
  },
);
