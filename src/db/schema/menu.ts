import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  smallint,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { mealType, recetario } from "./_schema";
import { recipe } from "./catalog";
import { household } from "./households";

// Menú semanal de cada familia (distinto de meal_plan_entry, que es el plan de ejemplo del dataset).
export const householdMenuEntry = recetario.table(
  "household_menu_entry",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    weekStart: date("week_start", { mode: "string" }).notNull(), // lunes de la semana (YYYY-MM-DD)
    dayOfWeek: smallint("day_of_week").notNull(), // 1 = lunes
    mealType: mealType("meal_type").notNull(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipe.id),
  },
  (t) => [
    unique("household_menu_entry_slot_key").on(
      t.householdId,
      t.weekStart,
      t.dayOfWeek,
      t.mealType,
    ),
    index("household_menu_entry_week_idx").on(t.householdId, t.weekStart),
    check(
      "household_menu_entry_day_check",
      sql`${t.dayOfWeek} BETWEEN 1 AND 7`,
    ),
    check("household_menu_entry_meal_check", sql`${t.mealType} <> 'base'`),
  ],
);
