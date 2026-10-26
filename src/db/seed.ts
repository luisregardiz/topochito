// Carga idempotente del dataset. Uso: pnpm db:seed (local o contra Neon según DATABASE_URL).
//   pnpm db:check   valida los archivos sin tocar ninguna base de datos (no necesita DATABASE_URL).
// Archivos: recetario.json (base), foods.json (catálogo de alimentos), recipes/*.json (recetas nuevas) y media.json.
// No importa server-only ni lib/env: corre fuera de Next.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray, sql } from "drizzle-orm";
import { Pool } from "pg";
import { z } from "zod";
import { isValidPublicId } from "@/lib/cloudinary-url";
import {
  baseSchema,
  buildSeed,
  extraSchema,
  foodSchema,
  type ExtraSeed,
} from "./seed.schema";
import * as s from "./schema";

const DIR = "src/db/seed";
const readJson = (file: string) =>
  JSON.parse(readFileSync(`${DIR}/${file}`, "utf8"));

function parseFile<T>(file: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(readJson(file));
  if (!parsed.success)
    throw new Error(`${file}:\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

// Medios (opcional): src/db/seed/media.json → { "D10": { "image": "recetario/D10", "video": "recetario/D10-video" } }.
// Solo toca las recetas que aparecen; `null` borra el medio y omitir la clave lo deja como está.
const publicId = z
  .string()
  .refine(
    isValidPublicId,
    "public ID inválido (solo letras, números, _, - y /)",
  );
const mediaSchema = z.record(
  z.string().regex(/^[A-Za-z]\d{1,2}$/),
  z
    .object({
      image: publicId.nullable().optional(),
      video: publicId.nullable().optional(),
    })
    .strict(),
);
const loadMedia = () =>
  existsSync(`${DIR}/media.json`) ? parseFile("media.json", mediaSchema) : {};

function loadSeed() {
  const base = parseFile("recetario.json", baseSchema);
  const catalog = parseFile("foods.json", z.array(foodSchema));
  const extras = existsSync(`${DIR}/recipes`)
    ? readdirSync(`${DIR}/recipes`)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => ({
          file: `recipes/${f}`,
          data: parseFile<ExtraSeed>(`recipes/${f}`, extraSchema),
        }))
    : [];
  const { seed, problems } = buildSeed(base, catalog, extras);
  if (problems.length) {
    throw new Error(
      `Los archivos del seed tienen ${problems.length} problema(s):\n - ${problems.join("\n - ")}`,
    );
  }
  return { seed, extras };
}

async function main() {
  const { seed, extras } = loadSeed();
  const { base, foods, recipes } = seed;
  const media = loadMedia();

  if (process.argv.includes("--check")) {
    const staples = foods.filter((f) => f.staple).length;
    console.log(
      `Seed válido: ${recipes.length} recetas (${extras.reduce((n, e) => n + e.data.recipes.length, 0)} en recipes/), ` +
        `${foods.length} alimentos (${staples} básicos), ${Object.keys(media).length} con medios.`,
    );
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  await db.transaction(async (tx) => {
    // Catálogos por slug
    await tx
      .insert(s.allergen)
      .values(base.allergens)
      .onConflictDoUpdate({
        target: s.allergen.slug,
        set: {
          name: sql`excluded.name`,
          howToIntroduce: sql`excluded.how_to_introduce`,
        },
      });
    await tx
      .insert(s.food)
      .values(
        foods.map((f) => ({
          slug: f.slug,
          name: f.name,
          category: f.category,
          isStaple: f.staple ?? false,
        })),
      )
      .onConflictDoUpdate({
        target: s.food.slug,
        set: {
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          isStaple: sql`excluded.is_staple`,
        },
      });
    const tags = [
      ...new Map(
        recipes.flatMap((r) => r.tags).map((t) => [t.slug, t]),
      ).values(),
    ];
    if (tags.length) {
      await tx
        .insert(s.tag)
        .values(tags.map(({ slug, name }) => ({ slug, name })))
        .onConflictDoUpdate({
          target: s.tag.slug,
          set: { name: sql`excluded.name` },
        });
    }

    // Recetas por code
    const stored = await tx
      .insert(s.recipe)
      .values(
        recipes.map((r) => ({
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
    const recipeId = new Map(stored.map((r) => [r.code, r.id]));
    const idOf = (code: string) => {
      const id = recipeId.get(code);
      if (id === undefined) throw new Error(`Receta desconocida: ${code}`);
      return id;
    };
    const idsBySlug = async <T extends { id: number; slug: string }>(
      rows: Promise<T[]>,
    ) => new Map((await rows).map((r) => [r.slug, r.id]));
    const allergenId = await idsBySlug(
      tx.select({ id: s.allergen.id, slug: s.allergen.slug }).from(s.allergen),
    );
    const tagId = await idsBySlug(
      tx.select({ id: s.tag.id, slug: s.tag.slug }).from(s.tag),
    );
    const foodId = await idsBySlug(
      tx.select({ id: s.food.id, slug: s.food.slug }).from(s.food),
    );

    // Hijos: borrar y reinsertar (refleja también filas eliminadas del JSON).
    // Borrar los ingredientes arrastra, por cascada, sus vínculos con alimentos.
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

    const lines = recipes.flatMap((r) =>
      r.ingredients.map((ing, i) => ({
        recipeId: idOf(r.code),
        position: i + 1,
        ing,
      })),
    );
    const insertedIngredients = await tx
      .insert(s.recipeIngredient)
      .values(
        lines.map((l) => ({
          recipeId: l.recipeId,
          position: l.position,
          description: l.ing.text,
          isOptional: l.ing.optional,
        })),
      )
      .returning({
        id: s.recipeIngredient.id,
        recipeId: s.recipeIngredient.recipeId,
        position: s.recipeIngredient.position,
      });
    const ingredientId = new Map(
      insertedIngredients.map((i) => [`${i.recipeId}:${i.position}`, i.id]),
    );
    const links = lines.flatMap((l) =>
      l.ing.foods.flatMap((group, altGroup) =>
        group.map((slug) => ({
          ingredientId: ingredientId.get(`${l.recipeId}:${l.position}`)!,
          foodId: foodId.get(slug)!,
          altGroup,
        })),
      ),
    );
    if (links.length)
      await tx
        .insert(s.recipeIngredientFood)
        .values(links)
        .onConflictDoNothing();

    await tx.insert(s.recipeStep).values(
      recipes.flatMap((r) =>
        r.steps.map((instruction, i) => ({
          recipeId: idOf(r.code),
          position: i + 1,
          instruction,
        })),
      ),
    );
    const adaptations = recipes.flatMap((r) =>
      r.ageAdaptations.map((a) => ({ recipeId: idOf(r.code), ...a })),
    );
    if (adaptations.length)
      await tx.insert(s.recipeAgeAdaptation).values(adaptations);
    const recipeAllergens = recipes.flatMap((r) =>
      r.allergens.map((a) => ({
        recipeId: idOf(r.code),
        allergenId: allergenId.get(a.slug)!,
        isOptional: a.optional,
        condition: a.condition,
      })),
    );
    if (recipeAllergens.length)
      await tx.insert(s.recipeAllergen).values(recipeAllergens);
    const recipeTags = recipes.flatMap((r) =>
      r.tags.map((t) => ({
        recipeId: idOf(r.code),
        tagId: tagId.get(t.slug)!,
        label: t.label,
      })),
    );
    if (recipeTags.length) await tx.insert(s.recipeTag).values(recipeTags);
    const references = recipes.flatMap((r) =>
      r.references.map((c) => ({
        recipeId: idOf(r.code),
        referencedRecipeId: idOf(c),
      })),
    );
    if (references.length)
      await tx.insert(s.recipeReference).values(references);

    // Plan de ejemplo: upsert por (semana, día, comida)
    await tx
      .insert(s.mealPlanEntry)
      .values(
        base.mealPlan.map(({ recipeCode, ...e }) => ({
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

    // Medios de las recetas (imagen y video de Cloudinary)
    for (const [code, m] of Object.entries(media)) {
      const patch = {
        ...(m.image !== undefined && { imagePublicId: m.image }),
        ...(m.video !== undefined && { videoPublicId: m.video }),
      };
      if (Object.keys(patch).length === 0) continue;
      await tx
        .update(s.recipe)
        .set(patch)
        .where(eq(s.recipe.id, idOf(code.toUpperCase())));
    }

    // Guías sin clave natural: se reemplazan completas
    await tx.delete(s.foodGuide);
    await tx.insert(s.foodGuide).values(base.foodGuide);
    await tx.delete(s.fruitCutGuide);
    await tx.insert(s.fruitCutGuide).values(
      base.fruitCutGuide.map(({ age7to8, age9to11, ...f }) => ({
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
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
