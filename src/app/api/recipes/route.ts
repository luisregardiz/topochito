import { handle, json } from "@/lib/http";
import { recipesRepository } from "@/modules/recipes/recipes.repository";
import { recipeListQuery } from "@/modules/recipes/recipes.schemas";
import { listRecipes } from "@/modules/recipes/recipes.service";

export const GET = handle(async (req) => {
  // Los parámetros vacíos (?q=) cuentan como ausentes.
  const raw = Object.fromEntries(
    [...new URL(req.url).searchParams].filter(([, v]) => v !== ""),
  );
  return json(await listRecipes(recipesRepository, recipeListQuery.parse(raw)));
});
