import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  food,
  householdUnavailableFood,
  recipeIngredient,
  recipeIngredientFood,
} from "@/db/schema";
import type { Requirement } from "./pantry.availability";
import type { FoodItem } from "./pantry.schemas";

// Líneas de ingredientes de todas las recetas con sus alimentos agrupados en alternativas.
// (Left join: una línea sin alimento concreto sigue apareciendo, con `groups` vacío.)
async function requirementsByRecipe() {
  const rows = await getDb()
    .select({
      recipeId: recipeIngredient.recipeId,
      ingredientId: recipeIngredient.id,
      position: recipeIngredient.position,
      optional: recipeIngredient.isOptional,
      slug: food.slug,
      name: food.name,
      staple: food.isStaple,
      altGroup: recipeIngredientFood.altGroup,
    })
    .from(recipeIngredient)
    .leftJoin(
      recipeIngredientFood,
      eq(recipeIngredientFood.ingredientId, recipeIngredient.id),
    )
    .leftJoin(food, eq(food.id, recipeIngredientFood.foodId))
    .orderBy(
      asc(recipeIngredient.recipeId),
      asc(recipeIngredient.position),
      asc(recipeIngredientFood.altGroup),
    );

  const lines = new Map<number, { recipeId: number; req: Requirement }>();
  for (const r of rows) {
    let line = lines.get(r.ingredientId);
    if (!line) {
      line = {
        recipeId: r.recipeId,
        req: { position: r.position, optional: r.optional, groups: [] },
      };
      lines.set(r.ingredientId, line);
    }
    if (
      r.slug === null ||
      r.name === null ||
      r.staple === null ||
      r.altGroup === null
    )
      continue;
    (line.req.groups[r.altGroup] ??= []).push({
      slug: r.slug,
      name: r.name,
      staple: r.staple,
    });
  }

  const byRecipe = new Map<number, Requirement[]>();
  for (const { recipeId, req } of lines.values()) {
    byRecipe.set(recipeId, [
      ...(byRecipe.get(recipeId) ?? []),
      { ...req, groups: req.groups.filter(Boolean) },
    ]);
  }
  return byRecipe;
}

const unavailableSlugs = async (householdId: string) =>
  (
    await getDb()
      .select({ slug: food.slug })
      .from(householdUnavailableFood)
      .innerJoin(food, eq(food.id, householdUnavailableFood.foodId))
      .where(eq(householdUnavailableFood.householdId, householdId))
  ).map((r) => r.slug);

export const pantryRepository = {
  // Alimentos que se le preguntan a la familia (sin los básicos), por categoría y nombre.
  foods: async (): Promise<FoodItem[]> =>
    getDb()
      .select({ slug: food.slug, name: food.name, category: food.category })
      .from(food)
      .where(eq(food.isStaple, false))
      .orderBy(asc(food.category), asc(food.name)) as Promise<FoodItem[]>,

  foodSlugs: async () =>
    (
      await getDb()
        .select({ slug: food.slug })
        .from(food)
        .where(eq(food.isStaple, false))
    ).map((f) => f.slug),

  unavailable: unavailableSlugs,

  save: async (householdId: string, slugs: string[]) => {
    await getDb().transaction(async (tx) => {
      await tx
        .delete(householdUnavailableFood)
        .where(eq(householdUnavailableFood.householdId, householdId));
      if (slugs.length === 0) return;
      const ids = await tx
        .select({ id: food.id })
        .from(food)
        .where(inArray(food.slug, slugs));
      await tx
        .insert(householdUnavailableFood)
        .values(ids.map((f) => ({ householdId, foodId: f.id })));
    });
  },

  // Lo necesario para saber qué recetas puede cocinar la familia.
  availability: async (householdId: string) => {
    const [unavailable, requirements] = await Promise.all([
      unavailableSlugs(householdId),
      requirementsByRecipe(),
    ]);
    return { unavailable: new Set(unavailable), requirements };
  },
};
