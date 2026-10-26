import { z } from "zod";

export const MEAL_TYPES = [
  "base",
  "desayuno",
  "almuerzo",
  "merienda",
  "cena",
] as const;
export type MealType = (typeof MEAL_TYPES)[number];

const slugList = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().regex(/^[a-z0-9_-]{1,40}$/)).max(20));

export const recipeListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  meal: z.enum(MEAL_TYPES).optional(),
  age: z.coerce.number().int().min(6).max(36).optional(), // meses del bebé
  exclude: slugList.optional(), // slugs de alérgenos a evitar
  tags: slugList.optional(), // todas las etiquetas indicadas
  iron: z.literal("1").optional(),
});
export type RecipeListQuery = z.infer<typeof recipeListQuery>;

export const recipeCodeParam = z.string().regex(/^[A-Za-z]\d{1,2}$/);

export type RecipeAllergen = {
  slug: string;
  name: string;
  isOptional: boolean;
  condition: string | null;
};

export type RecipeListItem = {
  code: string;
  title: string;
  mealType: MealType;
  minAgeMonths: number | null;
  isIronSource: boolean;
  ironNote: string | null;
  thumbUrl: string | null; // miniatura 1:1; null si la receta aún no tiene foto
  allergens: RecipeAllergen[];
};

export type RecipeDetail = RecipeListItem & {
  note: string | null;
  imageUrl: string | null; // imagen principal 4:3
  video: { src: string; poster: string } | null;
  ingredients: string[];
  steps: string[];
  ageAdaptations: {
    minAgeMonths: number;
    maxAgeMonths: number | null;
    instructions: string;
  }[];
  tags: { slug: string; label: string }[];
  uses: { code: string; title: string }[];
};

export type AllergenOption = { slug: string; name: string };
