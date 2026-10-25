// Carga idempotente de src/db/seed/recetario.json. Uso: pnpm db:seed (local o contra Neon según DATABASE_URL).
// No importa server-only ni lib/env: corre fuera de Next.
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray, sql } from "drizzle-orm";
import { Pool } from "pg";
import { z } from "zod";
import * as s from "./schema";

const meal = z.enum(["base", "desayuno", "almuerzo", "merienda", "cena"]);
const nullableInt = z.number().int().nullable();

const dataSchema = z.object({
  allergens: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      howToIntroduce: z.string(),
    }),
  ),
  recipes: z.array(
    z.object({
      code: z.string(),
      title: z.string(),
      mealType: meal,
      minAgeMonths: nullableInt,
      sortOrder: z.number().int(),
      iron: z.object({ isSource: z.boolean(), note: z.string().nullable() }),
      note: z.string().nullable(),
      allergens: z.array(
        z.object({
          slug: z.string(),
          optional: z.boolean(),
          condition: z.string().nullable(),
        }),
      ),
      tags: z.array(
        z.object({ slug: z.string(), name: z.string(), label: z.string() }),
      ),
      ingredients: z.array(z.string()),
      steps: z.array(z.string()),
      ageAdaptations: z.array(
        z.object({
          minAgeMonths: z.number().int(),
          maxAgeMonths: nullableInt,
          instructions: z.string(),
        }),
      ),
      references: z.array(z.string()),
    }),
  ),
  foodGuide: z.array(
    z.object({
      food: z.string(),
      fromAge: z.string(),
      preparation: z.string(),
      caution: z.string().nullable(),
      sortOrder: z.number().int(),
    }),
  ),
  fruitCutGuide: z.array(
    z.object({
      fruit: z.string(),
      age7to8: z.string(),
      age9to11: z.string(),
      caution: z.string().nullable(),
      sortOrder: z.number().int(),
    }),
  ),
  mealPlan: z.array(
    z.object({
      week: z.number().int(),
      dayOfWeek: z.number().int(),
      mealType: meal,
      recipeCode: z.string(),
      label: z.string(),
    }),
  ),
});

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const data = dataSchema.parse(
    JSON.parse(readFileSync("src/db/seed/recetario.json", "utf8")),
  );

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  await db.transaction(async (tx) => {
    // Catálogos por slug
    await tx
      .insert(s.allergen)
      .values(data.allergens)
      .onConflictDoUpdate({
        target: s.allergen.slug,
        set: {
          name: sql`excluded.name`,
          howToIntroduce: sql`excluded.how_to_introduce`,
        },
      });
    const tags = [
      ...new Map(
        data.recipes.flatMap((r) => r.tags).map((t) => [t.slug, t]),
      ).values(),
    ];
    await tx
      .insert(s.tag)
      .values(tags.map(({ slug, name }) => ({ slug, name })))
      .onConflictDoUpdate({
        target: s.tag.slug,
        set: { name: sql`excluded.name` },
      });

    // Recetas por code
    const recipes = await tx
      .insert(s.recipe)
      .values(
        data.recipes.map((r) => ({
          code: r.code,
          title: r.title,
          mealType: r.mealType,
          minAgeMonths: r.minAgeMonths,
          isIronSource: r.iron.isSource,
          ironNote: r.iron.note,
          note: r.note,
          sortOrder: r.sortOrder,
        })),
      )
      .onConflictDoUpdate({
        target: s.recipe.code,
        set: {
          title: sql`excluded.title`,
          mealType: sql`excluded.meal_type`,
          minAgeMonths: sql`excluded.min_age_months`,
          isIronSource: sql`excluded.is_iron_source`,
          ironNote: sql`excluded.iron_note`,
          note: sql`excluded.note`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: s.recipe.id, code: s.recipe.code });
    const recipeId = new Map(recipes.map((r) => [r.code, r.id]));
    const idOf = (code: string) => {
      const id = recipeId.get(code);
      if (id === undefined) throw new Error(`Receta desconocida: ${code}`);
      return id;
    };
    const allergenId = new Map(
      (
        await tx
          .select({ id: s.allergen.id, slug: s.allergen.slug })
          .from(s.allergen)
      ).map((a) => [a.slug, a.id]),
    );
    const tagId = new Map(
      (await tx.select({ id: s.tag.id, slug: s.tag.slug }).from(s.tag)).map(
        (t) => [t.slug, t.id],
      ),
    );

    // Hijos: borrar y reinsertar (refleja también filas eliminadas del JSON)
    const ids = [...recipeId.values()];
    await tx
      .delete(s.recipeIngredient)
      .where(inArray(s.recipeIngredient.recipeId, ids));
    await tx.delete(s.recipeStep).where(inArray(s.recipeStep.recipeId, ids));
    await tx
      .delete(s.recipeAgeAdaptation)
      .where(inArray(s.recipeAgeAdaptation.recipeId, ids));
    await tx
      .delete(s.recipeAllergen)
      .where(inArray(s.recipeAllergen.recipeId, ids));
    await tx.delete(s.recipeTag).where(inArray(s.recipeTag.recipeId, ids));
    await tx
      .delete(s.recipeReference)
      .where(inArray(s.recipeReference.recipeId, ids));

    const pos = (xs: string[]) => xs.map((v, i) => [i + 1, v] as const);
    await tx.insert(s.recipeIngredient).values(
      data.recipes.flatMap((r) =>
        pos(r.ingredients).map(([position, description]) => ({
          recipeId: idOf(r.code),
          position,
          description,
        })),
      ),
    );
    await tx.insert(s.recipeStep).values(
      data.recipes.flatMap((r) =>
        pos(r.steps).map(([position, instruction]) => ({
          recipeId: idOf(r.code),
          position,
          instruction,
        })),
      ),
    );
    await tx
      .insert(s.recipeAgeAdaptation)
      .values(
        data.recipes.flatMap((r) =>
          r.ageAdaptations.map((a) => ({ recipeId: idOf(r.code), ...a })),
        ),
      );
    await tx.insert(s.recipeAllergen).values(
      data.recipes.flatMap((r) =>
        r.allergens.map((a) => {
          const id = allergenId.get(a.slug);
          if (id === undefined)
            throw new Error(`Alérgeno desconocido: ${a.slug}`);
          return {
            recipeId: idOf(r.code),
            allergenId: id,
            isOptional: a.optional,
            condition: a.condition,
          };
        }),
      ),
    );
    await tx.insert(s.recipeTag).values(
      data.recipes.flatMap((r) =>
        r.tags.map((t) => ({
          recipeId: idOf(r.code),
          tagId: tagId.get(t.slug)!,
          label: t.label,
        })),
      ),
    );
    await tx.insert(s.recipeReference).values(
      data.recipes.flatMap((r) =>
        r.references.map((c) => ({
          recipeId: idOf(r.code),
          referencedRecipeId: idOf(c),
        })),
      ),
    );

    // Plan de ejemplo: upsert por (semana, día, comida)
    await tx
      .insert(s.mealPlanEntry)
      .values(
        data.mealPlan.map(({ recipeCode, ...e }) => ({
          ...e,
          recipeId: idOf(recipeCode),
        })),
      )
      .onConflictDoUpdate({
        target: [
          s.mealPlanEntry.week,
          s.mealPlanEntry.dayOfWeek,
          s.mealPlanEntry.mealType,
        ],
        set: { recipeId: sql`excluded.recipe_id`, label: sql`excluded.label` },
      });

    // Guías sin clave natural: se reemplazan completas
    await tx.delete(s.foodGuide);
    await tx.insert(s.foodGuide).values(data.foodGuide);
    await tx.delete(s.fruitCutGuide);
    await tx.insert(s.fruitCutGuide).values(
      data.fruitCutGuide.map(({ age7to8, age9to11, ...f }) => ({
        ...f,
        age78: age7to8,
        age911: age9to11,
      })),
    );
  });

  await pool.end();
  console.log("Seed aplicado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
