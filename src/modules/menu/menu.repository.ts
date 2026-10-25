import "server-only";
import { and, asc, eq, inArray, lte, ne, notExists, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  allergen,
  householdMenuEntry,
  recipe,
  recipeAllergen,
  recipeTag,
  tag,
} from "@/db/schema";
import { allergensByRecipeId } from "@/modules/recipes/recipes.repository";
import type { Candidate } from "./menu.generator";
import type { EntryRef, MenuMeal, StoredEntry } from "./menu.schemas";

// «Pescado» = alérgeno pescado no opcional; «máx. 1 vez por semana» = etiqueta del hígado.
// Se consultan con joins del constructor (que califica las columnas): un `sql` a mano dentro de una consulta
// de una sola tabla hace que Drizzle omita el prefijo y la subconsulta compare contra la tabla equivocada.
async function flagSets() {
  const db = getDb();
  const [fish, maxOnce] = await Promise.all([
    db
      .select({ id: recipeAllergen.recipeId })
      .from(recipeAllergen)
      .innerJoin(allergen, eq(allergen.id, recipeAllergen.allergenId))
      .where(
        and(eq(allergen.slug, "pescado"), eq(recipeAllergen.isOptional, false)),
      ),
    db
      .select({ id: recipeTag.recipeId })
      .from(recipeTag)
      .innerJoin(tag, eq(tag.id, recipeTag.tagId))
      .where(eq(tag.slug, "max-1-vez-por-semana")),
  ]);
  return {
    fish: new Set(fish.map((r) => r.id)),
    maxOnce: new Set(maxOnce.map((r) => r.id)),
  };
}

async function idsByCode(codes: string[]) {
  if (codes.length === 0)
    return new Map<string, { id: number; meal: string }>();
  const rows = await getDb()
    .select({ id: recipe.id, code: recipe.code, meal: recipe.mealType })
    .from(recipe)
    .where(inArray(recipe.code, codes));
  return new Map(rows.map((r) => [r.code, { id: r.id, meal: r.meal }]));
}

export const menuRepository = {
  // Recetas aptas: de la edad del bebé y sin ningún alérgeno que deba evitar (aunque sea opcional).
  candidates: async (
    ageMonths: number,
    avoid: string[],
  ): Promise<Candidate[]> => {
    const db = getDb();
    const flags = await flagSets();
    const rows = await db
      .select({
        id: recipe.id,
        code: recipe.code,
        meal: recipe.mealType,
        isIron: recipe.isIronSource,
      })
      .from(recipe)
      .where(
        and(
          ne(recipe.mealType, "base"),
          lte(recipe.minAgeMonths, ageMonths),
          avoid.length
            ? notExists(
                db
                  .select({ one: sql`1` })
                  .from(recipeAllergen)
                  .innerJoin(
                    allergen,
                    eq(allergen.id, recipeAllergen.allergenId),
                  )
                  .where(
                    and(
                      eq(recipeAllergen.recipeId, recipe.id),
                      inArray(allergen.slug, avoid),
                    ),
                  ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(recipe.sortOrder));
    return rows.map(({ id, ...r }) => ({
      ...r,
      meal: r.meal as MenuMeal,
      isFish: flags.fish.has(id),
      isMaxOnce: flags.maxOnce.has(id),
    }));
  },

  getWeek: async (
    householdId: string,
    weekStart: string,
  ): Promise<StoredEntry[]> => {
    const rows = await getDb()
      .select({
        day: householdMenuEntry.dayOfWeek,
        meal: householdMenuEntry.mealType,
        id: recipe.id,
        code: recipe.code,
        title: recipe.title,
        mealType: recipe.mealType,
        minAgeMonths: recipe.minAgeMonths,
        isIronSource: recipe.isIronSource,
        ironNote: recipe.ironNote,
      })
      .from(householdMenuEntry)
      .innerJoin(recipe, eq(recipe.id, householdMenuEntry.recipeId))
      .where(
        and(
          eq(householdMenuEntry.householdId, householdId),
          eq(householdMenuEntry.weekStart, weekStart),
        ),
      )
      .orderBy(asc(householdMenuEntry.dayOfWeek));
    const [allergens, flags] = await Promise.all([
      allergensByRecipeId(rows.map((r) => r.id)),
      flagSets(),
    ]);
    return rows.map(({ id, day, meal, ...r }) => ({
      day,
      meal: meal as MenuMeal,
      isFish: flags.fish.has(id),
      isMaxOnce: flags.maxOnce.has(id),
      recipe: { ...r, allergens: allergens.get(id) ?? [] },
    }));
  },

  // Guarda la semana nueva y descarta semanas anteriores: solo se conserva el menú actual.
  replaceWeek: async (
    householdId: string,
    weekStart: string,
    entries: EntryRef[],
  ) => {
    const ids = await idsByCode(entries.map((e) => e.recipe));
    await getDb().transaction(async (tx) => {
      await tx
        .delete(householdMenuEntry)
        .where(eq(householdMenuEntry.householdId, householdId));
      await tx.insert(householdMenuEntry).values(
        entries.map((e) => ({
          householdId,
          weekStart,
          dayOfWeek: e.day,
          mealType: e.meal,
          recipeId: ids.get(e.recipe)!.id,
        })),
      );
    });
  },

  setEntries: async (
    householdId: string,
    weekStart: string,
    entries: EntryRef[],
  ) => {
    const ids = await idsByCode(entries.map((e) => e.recipe));
    await getDb()
      .insert(householdMenuEntry)
      .values(
        entries.map((e) => ({
          householdId,
          weekStart,
          dayOfWeek: e.day,
          mealType: e.meal,
          recipeId: ids.get(e.recipe)!.id,
        })),
      )
      .onConflictDoUpdate({
        target: [
          householdMenuEntry.householdId,
          householdMenuEntry.weekStart,
          householdMenuEntry.dayOfWeek,
          householdMenuEntry.mealType,
        ],
        set: { recipeId: sql`excluded.recipe_id` },
      });
  },

  recipeMeals: async (codes: string[]) =>
    new Map([...(await idsByCode(codes))].map(([code, r]) => [code, r.meal])),
};
