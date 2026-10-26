import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  baseSchema,
  buildSeed,
  extraSchema,
  foodSchema,
  recipeSchema,
  type BaseSeed,
  type ExtraSeed,
  type FoodSeed,
} from "./seed.schema";

const readJson = (f: string) =>
  JSON.parse(readFileSync(`src/db/seed/${f}`, "utf8"));

const FOODS: FoodSeed[] = [
  { slug: "pollo", name: "Pollo", category: "proteinas" },
  { slug: "papa", name: "Papa", category: "tuberculos" },
  { slug: "agua", name: "Agua", category: "basicos", staple: true },
  { slug: "queso", name: "Queso", category: "lacteos", allergen: "lacteos" },
  { slug: "yogur", name: "Yogur", category: "lacteos", allergen: "lacteos" },
  { slug: "huevo", name: "Huevo", category: "proteinas", allergen: "huevo" },
];
const recipe = (over: Record<string, unknown> = {}) => ({
  code: "A99",
  title: "Pollo con papa",
  mealType: "almuerzo",
  minAgeMonths: 7,
  sortOrder: 99,
  iron: { isSource: true, note: "muslo" },
  note: null,
  allergens: [],
  tags: [],
  ingredients: [
    { text: "1 muslo de pollo", foods: [["pollo"]] },
    { text: "1 papa", foods: [["papa"]] },
    { text: "Agua", foods: [["agua"]] },
  ],
  steps: ["Cocina todo."],
  ageAdaptations: [
    { minAgeMonths: 7, maxAgeMonths: null, instructions: "Desmenuzado." },
  ],
  references: [],
  ...over,
});
const parseRecipe = (over?: Record<string, unknown>) =>
  recipeSchema.parse(recipe(over));
const BASE: BaseSeed = baseSchema.parse({
  allergens: [
    { slug: "huevo", name: "Huevo", howToIntroduce: "Bien cocido" },
    { slug: "lacteos", name: "Lácteos", howToIntroduce: "Yogur natural" },
  ],
  recipes: [recipe({ code: "A1" })],
  foodGuide: [],
  fruitCutGuide: [],
  mealPlan: [],
});
const extra = (...recipes: unknown[]): ExtraSeed =>
  extraSchema.parse({ recipes });
const build = (extras: ExtraSeed[] = [], catalog = FOODS) =>
  buildSeed(
    BASE,
    catalog,
    extras.map((data, i) => ({ file: `recipes/lote-${i + 1}.json`, data })),
  );

describe("archivos reales del repo", () => {
  it("recetario.json, foods.json y recipes/*.json son válidos y consistentes", () => {
    const base = baseSchema.parse(readJson("recetario.json"));
    const catalog = z.array(foodSchema).parse(readJson("foods.json"));
    const { seed, problems } = buildSeed(base, catalog, []);
    expect(problems).toEqual([]);
    expect(seed.recipes).toHaveLength(71);
  });

  it("el catálogo tiene slugs únicos y todos los alimentos se usan en alguna receta", () => {
    const base = baseSchema.parse(readJson("recetario.json"));
    const catalog = z.array(foodSchema).parse(readJson("foods.json"));
    expect(new Set(catalog.map((f) => f.slug)).size).toBe(catalog.length);
    const used = new Set(
      base.recipes.flatMap((r) => r.ingredients.flatMap((i) => i.foods.flat())),
    );
    expect(catalog.filter((f) => !used.has(f.slug)).map((f) => f.slug)).toEqual(
      [],
    );
  });
});

describe("recetas nuevas", () => {
  it("acepta una receta bien formada", () => {
    const { seed, problems } = build([extra(recipe())]);
    expect(problems).toEqual([]);
    expect(seed.recipes.map((r) => r.code)).toEqual(["A1", "A99"]);
  });

  it("une alimentos nuevos del archivo con el catálogo", () => {
    const e = extraSchema.parse({
      foods: [{ slug: "yuca", name: "Yuca", category: "tuberculos" }],
      recipes: [recipe({ ingredients: [{ text: "yuca", foods: [["yuca"]] }] })],
    });
    const { seed, problems } = build([e]);
    expect(problems).toEqual([]);
    expect(seed.foods.map((f) => f.slug)).toContain("yuca");
  });

  it("detecta un alimento desconocido, con receta y número de ingrediente", () => {
    const e = extra(
      recipe({ ingredients: [{ text: "salmón", foods: [["salmon"]] }] }),
    );
    expect(build([e]).problems).toEqual([
      "recipes/lote-1.json: A99: ingrediente 1 usa el alimento desconocido «salmon»",
    ]);
  });

  it("detecta códigos repetidos con el seed base y entre archivos", () => {
    expect(build([extra(recipe({ code: "A1" }))]).problems[0]).toContain(
      "la receta A1 ya existe en recetario.json",
    );
    const dup = build([extra(recipe()), extra(recipe())]).problems;
    expect(dup).toEqual([
      "recipes/lote-2.json: la receta A99 ya existe en recipes/lote-1.json",
    ]);
  });

  it("detecta alérgenos y referencias inexistentes", () => {
    const e = extra(
      recipe({
        allergens: [{ slug: "kiwi", optional: false, condition: null }],
        references: ["P9"],
      }),
    );
    const p = build([e]).problems.join("\n");
    expect(p).toContain("alérgeno desconocido «kiwi»");
    expect(p).toContain("referencia a la receta inexistente P9");
  });

  it("valida las edades: base sin edad, resto entre 6 y 36, adaptaciones coherentes", () => {
    const bad = build([
      extra(
        recipe({ code: "P9", mealType: "base", minAgeMonths: 7 }),
        recipe({ code: "A98", minAgeMonths: 3 }),
        recipe({
          code: "A97",
          ageAdaptations: [
            { minAgeMonths: 9, maxAgeMonths: 8, instructions: "x" },
            { minAgeMonths: 9, maxAgeMonths: null, instructions: "y" },
          ],
        }),
      ),
    ]).problems.join("\n");
    expect(bad).toContain("P9: una preparación base no lleva edad mínima");
    expect(bad).toContain("A98: edad mínima entre 6 y 36 meses");
    expect(
      build([extra(recipe({ code: "C98", mealType: "cena", minAgeMonths: 7 }))])
        .problems,
    ).toEqual(["recipes/lote-1.json: C98: la cena empieza a los 8 meses"]);
    expect(
      build([extra(recipe({ code: "C99", mealType: "cena", minAgeMonths: 8 }))])
        .problems,
    ).toEqual([]);
    expect(bad).toContain(
      "A97: adaptación 1 con edad máxima menor que la mínima",
    );
    expect(bad).toContain("A97: dos adaptaciones empiezan en la misma edad");
  });

  it("un alimento definido distinto en dos archivos es un conflicto", () => {
    const e = extraSchema.parse({
      foods: [{ slug: "pollo", name: "Pollo orgánico", category: "proteinas" }],
      recipes: [recipe()],
    });
    expect(build([e]).problems[0]).toContain(
      "el alimento «pollo» ya existe con otra definición",
    );
  });
});

describe("alérgenos de los ingredientes", () => {
  const withIngredient = (
    line: Record<string, unknown>,
    allergens: unknown[] = [],
  ) =>
    build([
      extra(
        recipe({
          ingredients: [{ text: "x", optional: false, ...line }],
          allergens,
        }),
      ),
    ]).problems;
  const lacteos = (optional: boolean) => [
    { slug: "lacteos", optional, condition: optional ? "si usas queso" : null },
  ];

  it("lo obligatorio con alérgeno debe declararse", () => {
    expect(withIngredient({ foods: [["queso"]] })).toEqual([
      "recipes/lote-1.json: A99: ingrediente 1 exige «queso» (lacteos) pero la receta no declara el alérgeno «lacteos»",
    ]);
    expect(withIngredient({ foods: [["queso", "yogur"]] })[0]).toContain(
      "exige «queso o yogur» (lacteos)",
    );
  });

  it("declarado como opcional no basta cuando el ingrediente es obligatorio", () => {
    expect(withIngredient({ foods: [["queso"]] }, lacteos(true))).toEqual([
      "recipes/lote-1.json: A99: ingrediente 1 exige «queso» (lacteos) pero el alérgeno está declarado como opcional",
    ]);
  });

  it("bien declarado no da problemas", () => {
    expect(withIngredient({ foods: [["queso"]] }, lacteos(false))).toEqual([]);
  });

  it("las líneas opcionales y las alternativas sin alérgeno no obligan a declararlo", () => {
    expect(withIngredient({ optional: true, foods: [["queso"]] })).toEqual([]);
    expect(withIngredient({ foods: [["queso", "papa"]] })).toEqual([]); // se puede cocinar con papa
    expect(withIngredient({ foods: [["queso", "huevo"]] })).toEqual([]); // alérgenos distintos: se elige uno
  });
});

describe("formato estricto", () => {
  it("rechaza claves mal escritas en vez de ignorarlas", () => {
    expect(recipeSchema.safeParse(recipe({ ingridients: [] })).success).toBe(
      false,
    );
    expect(
      recipeSchema.safeParse(
        recipe({
          ingredients: [{ text: "x", foods: [["a"]], opcional: true }],
        }),
      ).success,
    ).toBe(false);
  });

  it("exige código, slugs y estructura de ingredientes válidos", () => {
    expect(() => parseRecipe({ code: "desayuno1" })).toThrow();
    expect(() =>
      parseRecipe({ ingredients: [{ text: "x", foods: [["Queso Fresco"]] }] }),
    ).toThrow();
    expect(() =>
      parseRecipe({ ingredients: [{ text: "x", foods: [[]] }] }),
    ).toThrow(); // grupo vacío
    expect(() => parseRecipe({ ingredients: [] })).toThrow();
    expect(() => parseRecipe({ steps: [] })).toThrow();
    // «sin alimento concreto» sí es válido (p. ej. «fruta madura de temporada»)
    expect(
      parseRecipe({ ingredients: [{ text: "Fruta de temporada", foods: [] }] })
        .ingredients[0]?.optional,
    ).toBe(false);
  });

  it("el archivo de recetas nuevas no admite claves extra", () => {
    expect(
      extraSchema.safeParse({ recipes: [recipe()], receta: [] }).success,
    ).toBe(false);
    expect(extraSchema.safeParse({ recipes: [] }).success).toBe(false);
  });
});
