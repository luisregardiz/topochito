// Esquemas y comprobaciones del seed (puros, sin base de datos): los usa db/seed.ts y los tests.
// Todo es estricto (.strict()) para que una clave mal escrita en un archivo nuevo falle en vez de ignorarse.
import { z } from "zod";

export const FOOD_CATEGORIES = [
  "basicos",
  "proteinas",
  "lacteos",
  "verduras",
  "tuberculos",
  "frutas",
  "cereales",
  "legumbres",
  "semillas",
  "otros",
] as const;

const meal = z.enum(["base", "desayuno", "almuerzo", "merienda", "cena"]);
const nullableInt = z.number().int().nullable();
const foodSlug = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "slug en minúsculas y con guiones, p. ej. «queso-fresco»",
  );

export const foodSchema = z
  .object({
    slug: foodSlug,
    name: z.string().min(1),
    category: z.enum(FOOD_CATEGORIES),
    staple: z.boolean().optional(),
    // Alérgeno que contiene el alimento (slug de la lista de alérgenos): permite comprobar que cada receta lo declare.
    allergen: z.string().optional(),
  })
  .strict();
export type FoodSeed = z.infer<typeof foodSchema>;

// foods: lista de grupos. Los grupos son todos necesarios; dentro de un grupo, basta uno (alternativas).
// [] = sin alimento concreto (p. ej. «fruta madura de temporada»).
export const ingredientSchema = z
  .object({
    text: z.string().min(1),
    optional: z.boolean().default(false),
    foods: z.array(z.array(foodSlug).min(1)),
  })
  .strict();

export const recipeSchema = z
  .object({
    code: z.string().regex(/^[A-Z]\d{1,2}$/, "código como D1, A18 o P3"),
    title: z.string().min(1),
    mealType: meal,
    minAgeMonths: nullableInt,
    sortOrder: z.number().int(),
    iron: z
      .object({ isSource: z.boolean(), note: z.string().nullable() })
      .strict(),
    note: z.string().nullable(),
    allergens: z
      .array(
        z
          .object({
            slug: z.string(),
            optional: z.boolean(),
            condition: z.string().nullable(),
          })
          .strict(),
      )
      .default([]),
    tags: z
      .array(
        z
          .object({ slug: z.string(), name: z.string(), label: z.string() })
          .strict(),
      )
      .default([]),
    ingredients: z.array(ingredientSchema).min(1),
    steps: z.array(z.string().min(1)).min(1),
    ageAdaptations: z
      .array(
        z
          .object({
            minAgeMonths: z.number().int(),
            maxAgeMonths: nullableInt,
            instructions: z.string(),
          })
          .strict(),
      )
      .default([]),
    references: z.array(z.string()).default([]),
  })
  .strict();
export type RecipeSeed = z.infer<typeof recipeSchema>;

export const baseSchema = z.object({
  allergens: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      howToIntroduce: z.string(),
    }),
  ),
  recipes: z.array(recipeSchema),
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
export type BaseSeed = z.infer<typeof baseSchema>;

// Archivo de recetas nuevas (src/db/seed/recipes/*.json): recetas y, si hacen falta, alimentos nuevos.
export const extraSchema = z
  .object({
    foods: z.array(foodSchema).default([]),
    recipes: z.array(recipeSchema).min(1),
  })
  .strict();
export type ExtraSeed = z.infer<typeof extraSchema>;

export type Seed = { base: BaseSeed; foods: FoodSeed[]; recipes: RecipeSeed[] };

// Une el seed base, el catálogo de alimentos y los archivos nuevos. Devuelve también los problemas encontrados.
export function buildSeed(
  base: BaseSeed,
  catalog: FoodSeed[],
  extras: { file: string; data: ExtraSeed }[],
): { seed: Seed; problems: string[] } {
  const problems: string[] = [];
  const foods = new Map<string, FoodSeed>();
  const addFood = (f: FoodSeed, where: string) => {
    const prev = foods.get(f.slug);
    if (prev && JSON.stringify(prev) !== JSON.stringify(f)) {
      problems.push(
        `${where}: el alimento «${f.slug}» ya existe con otra definición`,
      );
    }
    foods.set(f.slug, prev ?? f);
  };
  for (const f of catalog) addFood(f, "foods.json");

  const recipes = new Map<string, RecipeSeed>();
  const origin = new Map<string, string>();
  for (const r of base.recipes) {
    recipes.set(r.code, r);
    origin.set(r.code, "recetario.json");
  }
  for (const { file, data } of extras) {
    for (const f of data.foods) addFood(f, file);
    for (const r of data.recipes) {
      if (recipes.has(r.code))
        problems.push(
          `${file}: la receta ${r.code} ya existe en ${origin.get(r.code)}`,
        );
      else {
        recipes.set(r.code, r);
        origin.set(r.code, file);
      }
    }
  }

  const all = [...recipes.values()];
  problems.push(...checkIntegrity(base, foods, all, origin));
  return { seed: { base, foods: [...foods.values()], recipes: all }, problems };
}

function checkIntegrity(
  base: BaseSeed,
  foods: Map<string, FoodSeed>,
  recipes: RecipeSeed[],
  origin: Map<string, string>,
) {
  const problems: string[] = [];
  const codes = new Set(recipes.map((r) => r.code));
  const allergens = new Set(base.allergens.map((a) => a.slug));

  for (const r of recipes) {
    const at = `${origin.get(r.code)}: ${r.code}`;
    const isBase = r.mealType === "base";
    if (isBase && r.minAgeMonths !== null)
      problems.push(`${at}: una preparación base no lleva edad mínima`);
    if (
      !isBase &&
      (r.minAgeMonths === null || r.minAgeMonths < 6 || r.minAgeMonths > 36)
    ) {
      problems.push(`${at}: edad mínima entre 6 y 36 meses`);
    }
    if (
      r.mealType === "cena" &&
      r.minAgeMonths !== null &&
      r.minAgeMonths < 8
    ) {
      problems.push(`${at}: la cena empieza a los 8 meses`);
    }
    r.ageAdaptations.forEach((a, i) => {
      if (a.maxAgeMonths !== null && a.maxAgeMonths < a.minAgeMonths) {
        problems.push(
          `${at}: adaptación ${i + 1} con edad máxima menor que la mínima`,
        );
      }
    });
    if (
      new Set(r.ageAdaptations.map((a) => a.minAgeMonths)).size !==
      r.ageAdaptations.length
    ) {
      problems.push(`${at}: dos adaptaciones empiezan en la misma edad`);
    }
    for (const a of r.allergens)
      if (!allergens.has(a.slug))
        problems.push(`${at}: alérgeno desconocido «${a.slug}»`);
    for (const c of r.references)
      if (!codes.has(c))
        problems.push(`${at}: referencia a la receta inexistente ${c}`);
    r.ingredients.forEach((ing, i) => {
      for (const slug of ing.foods.flat()) {
        if (!foods.has(slug))
          problems.push(
            `${at}: ingrediente ${i + 1} usa el alimento desconocido «${slug}»`,
          );
      }
      // Lo obligatorio con alérgeno debe declararse, y como no opcional: es lo que filtra el perfil del bebé.
      if (ing.optional) return;
      for (const group of ing.foods) {
        const kinds = new Set(group.map((slug) => foods.get(slug)?.allergen));
        const allergen = [...kinds][0];
        if (kinds.size !== 1 || !allergen) continue; // alternativas sin alérgeno o con alérgenos distintos
        const declared = r.allergens.find((a) => a.slug === allergen);
        const names = group.join(" o ");
        if (!declared) {
          problems.push(
            `${at}: ingrediente ${i + 1} exige «${names}» (${allergen}) pero la receta no declara el alérgeno «${allergen}»`,
          );
        } else if (declared.optional) {
          problems.push(
            `${at}: ingrediente ${i + 1} exige «${names}» (${allergen}) pero el alérgeno está declarado como opcional`,
          );
        }
      }
    });
    if (!r.iron.isSource && r.iron.note)
      problems.push(
        `${at}: nota de hierro en una receta que no es fuente de hierro`,
      );
  }

  for (const e of base.mealPlan) {
    if (!codes.has(e.recipeCode))
      problems.push(`mealPlan: receta inexistente ${e.recipeCode}`);
  }
  return problems;
}
