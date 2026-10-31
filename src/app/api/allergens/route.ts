import { connection } from "next/server";
import { handle, json } from "@/lib/http";
import { recipesRepository } from "@/modules/recipes/recipes.repository";
import { listAllergens } from "@/modules/recipes/recipes.service";

export const GET = handle(async () => {
  await connection(); // sin esto se prerenderiza en el build: consultaría la base y congelaría la lista
  return json({ allergens: await listAllergens(recipesRepository) });
});
