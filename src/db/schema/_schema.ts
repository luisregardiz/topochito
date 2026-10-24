import { pgSchema } from "drizzle-orm/pg-core";

export const recetario = pgSchema("recetario");

export const mealType = recetario.enum("meal_type", [
  "base",
  "desayuno",
  "almuerzo",
  "merienda",
  "cena",
]);
