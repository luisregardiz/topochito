import { z } from "zod";

export const FOOD_CATEGORIES = [
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
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  proteinas: "Carnes, pescados y huevos",
  lacteos: "Lácteos",
  verduras: "Verduras",
  tuberculos: "Tubérculos y plátano",
  frutas: "Frutas",
  cereales: "Cereales, harinas y pan",
  legumbres: "Legumbres",
  semillas: "Semillas y cremas",
  otros: "Otros",
};

export const pantryInput = z.object({
  // Slugs de los alimentos que la familia NO consigue.
  unavailable: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).max(500),
});
export type PantryInput = z.infer<typeof pantryInput>;

export type FoodItem = { slug: string; name: string; category: FoodCategory };

export type PantryState = {
  foods: FoodItem[]; // todos los que se preguntan (sin los básicos)
  unavailable: string[];
  recipes: { cookable: number; total: number };
};
