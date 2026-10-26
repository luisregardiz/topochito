import { z } from "zod";
import type { RecipeListItem } from "@/modules/recipes/recipes.schemas";

export const MENU_MEALS = ["desayuno", "almuerzo", "merienda", "cena"] as const;
export type MenuMeal = (typeof MENU_MEALS)[number];

const day = z.number().int().min(1).max(7); // 1 = lunes
const meal = z.enum(MENU_MEALS);

export const regenerateInput = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("day"), day }),
  z.object({ scope: z.literal("meal"), day, meal }),
]);
export type RegenerateInput = z.infer<typeof regenerateInput>;

export const entriesInput = z.object({
  entries: z
    .array(
      z.object({ day, meal, recipe: z.string().regex(/^[A-Za-z]\d{1,2}$/) }),
    )
    .min(1)
    .max(28),
});
export type EntriesInput = z.infer<typeof entriesInput>;

export type MenuCheck = {
  key: "iron" | "fish" | "liver";
  ok: boolean;
  title: string;
  detail: string;
  short: string;
};

export type MenuDay = {
  day: number;
  meals: { meal: MenuMeal; recipe: RecipeListItem }[];
};

export type Menu = {
  weekStart: string; // lunes, YYYY-MM-DD
  today: number; // 1–7, en la zona horaria de la app
  ageMonths: number;
  meals: MenuMeal[]; // huecos de cada día según la edad; un día puede tener alguno sin receta
  days: MenuDay[];
  checks: MenuCheck[];
};

export type EntryRef = { day: number; meal: MenuMeal; recipe: string };

// Fila del menú guardado, con las banderas que usan el generador y el resumen.
export type StoredEntry = {
  day: number;
  meal: MenuMeal;
  recipe: RecipeListItem;
  isFish: boolean;
  isMaxOnce: boolean;
};
