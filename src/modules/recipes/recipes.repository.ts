import "server-only";
import {
  and,
  asc,
  eq,
  exists,
  inArray,
  isNull,
  lte,
  notExists,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  allergen,
  recipe,
  recipeAllergen,
  recipeIngredient,
  recipeTag,
  tag,
} from "@/db/schema";
import type {
  AllergenOption,
  RecipeAllergen,
  RecipeDetail,
  RecipeListItem,
  RecipeListQuery,
} from "./recipes.schemas";

// Mismo plegado que normalizeSearch() en el servicio.
const fold = (col: SQL | AnyColumn) =>
  sql`translate(lower(${col}), 'áéíóúü', 'aeiouu')`;
const one = sql`1`;

// Alérgenos de varias recetas en una sola consulta.
export async function allergensByRecipeId(ids: number[]) {
  const byRecipe = new Map<number, RecipeAllergen[]>();
  if (ids.length === 0) return byRecipe;
  const rows = await getDb()
    .select({
      recipeId: recipeAllergen.recipeId,
      slug: allergen.slug,
      name: allergen.name,
      isOptional: recipeAllergen.isOptional,
      condition: recipeAllergen.condition,
    })
    .from(recipeAllergen)
    .innerJoin(allergen, eq(allergen.id, recipeAllergen.allergenId))
    .where(inArray(recipeAllergen.recipeId, ids))
    .orderBy(asc(allergen.id));
  for (const { recipeId, ...a } of rows)
    byRecipe.set(recipeId, [...(byRecipe.get(recipeId) ?? []), a]);
  return byRecipe;
}

export const recipesRepository = {
  list: async (f: RecipeListQuery): Promise<RecipeListItem[]> => {
    const db = getDb();
    const where: (SQL | undefined)[] = [];

    if (f.q) {
      const like = `%${f.q}%`;
      where.push(
        or(
          sql`${fold(recipe.title)} like ${like}`,
          exists(
            db
              .select({ one })
              .from(recipeIngredient)
              .where(
                and(
                  eq(recipeIngredient.recipeId, recipe.id),
                  sql`${fold(recipeIngredient.description)} like ${like}`,
                ),
              ),
          ),
        ),
      );
    }
    if (f.meal) where.push(eq(recipe.mealType, f.meal));
    // Las preparaciones base no tienen edad mínima: siempre se muestran.
    if (f.age !== undefined)
      where.push(
        or(isNull(recipe.minAgeMonths), lte(recipe.minAgeMonths, f.age)),
      );
    if (f.iron) where.push(eq(recipe.isIronSource, true));
    // Evitar un alérgeno excluye también las recetas donde solo es opcional (más seguro).
    if (f.exclude?.length) {
      where.push(
        notExists(
          db
            .select({ one })
            .from(recipeAllergen)
            .innerJoin(allergen, eq(allergen.id, recipeAllergen.allergenId))
            .where(
              and(
                eq(recipeAllergen.recipeId, recipe.id),
                inArray(allergen.slug, f.exclude),
              ),
            ),
        ),
      );
    }
    for (const slug of f.tags ?? []) {
      where.push(
        exists(
          db
            .select({ one })
            .from(recipeTag)
            .innerJoin(tag, eq(tag.id, recipeTag.tagId))
            .where(and(eq(recipeTag.recipeId, recipe.id), eq(tag.slug, slug))),
        ),
      );
    }

    const rows = await db
      .select({
        id: recipe.id,
        code: recipe.code,
        title: recipe.title,
        mealType: recipe.mealType,
        minAgeMonths: recipe.minAgeMonths,
        isIronSource: recipe.isIronSource,
        ironNote: recipe.ironNote,
      })
      .from(recipe)
      .where(and(...where))
      .orderBy(asc(recipe.sortOrder));
    if (rows.length === 0) return [];

    const byRecipe = await allergensByRecipeId(rows.map((r) => r.id));

    return rows.map(({ id, ...r }) => ({
      ...r,
      allergens: byRecipe.get(id) ?? [],
    }));
  },

  findByCode: async (code: string): Promise<RecipeDetail | null> => {
    const r = await getDb().query.recipe.findFirst({
      where: eq(recipe.code, code),
      with: {
        ingredients: { orderBy: (t, { asc }) => asc(t.position) },
        steps: { orderBy: (t, { asc }) => asc(t.position) },
        ageAdaptations: { orderBy: (t, { asc }) => asc(t.minAgeMonths) },
        allergens: { with: { allergen: true } },
        tags: { with: { tag: true } },
        uses: { with: { referenced: true } },
      },
    });
    if (!r) return null;
    return {
      code: r.code,
      title: r.title,
      mealType: r.mealType,
      minAgeMonths: r.minAgeMonths,
      isIronSource: r.isIronSource,
      ironNote: r.ironNote,
      note: r.note,
      allergens: r.allergens
        .toSorted((a, b) => a.allergen.id - b.allergen.id)
        .map((x) => ({
          slug: x.allergen.slug,
          name: x.allergen.name,
          isOptional: x.isOptional,
          condition: x.condition,
        })),
      ingredients: r.ingredients.map((i) => i.description),
      steps: r.steps.map((s) => s.instruction),
      ageAdaptations: r.ageAdaptations.map((a) => ({
        minAgeMonths: a.minAgeMonths,
        maxAgeMonths: a.maxAgeMonths,
        instructions: a.instructions,
      })),
      tags: r.tags.map((t) => ({ slug: t.tag.slug, label: t.label })),
      uses: r.uses.map((u) => ({
        code: u.referenced.code,
        title: u.referenced.title,
      })),
    };
  },

  listAllergens: (): Promise<AllergenOption[]> =>
    getDb()
      .select({ slug: allergen.slug, name: allergen.name })
      .from(allergen)
      .orderBy(asc(allergen.id)),
};
