import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { mealType, recetario } from "./_schema";

export const allergen = recetario.table("allergen", {
  id: smallint().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  howToIntroduce: text("how_to_introduce").notNull(),
});

export const tag = recetario.table("tag", {
  id: smallint().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  name: text().notNull(),
});

export const recipe = recetario.table(
  "recipe",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    code: varchar({ length: 4 }).notNull().unique(), // D1, A7, P3...
    title: text().notNull(),
    mealType: mealType("meal_type").notNull(),
    minAgeMonths: smallint("min_age_months"), // null en preparaciones base
    isIronSource: boolean("is_iron_source").notNull().default(false),
    ironNote: text("iron_note"),
    note: text(),
    sortOrder: smallint("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("recipe_meal_age_idx").on(t.mealType, t.minAgeMonths),
    index("recipe_title_fts_idx").using(
      "gin",
      sql`to_tsvector('spanish', ${t.title})`,
    ),
    check(
      "recipe_min_age_months_check",
      sql`${t.minAgeMonths} BETWEEN 6 AND 36`,
    ),
  ],
);

export const recipeIngredient = recetario.table(
  "recipe_ingredient",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    description: text().notNull(),
  },
  (t) => [
    unique("recipe_ingredient_recipe_id_position_key").on(
      t.recipeId,
      t.position,
    ),
    index("recipe_ingredient_fts_idx").using(
      "gin",
      sql`to_tsvector('spanish', ${t.description})`,
    ),
  ],
);

export const recipeStep = recetario.table(
  "recipe_step",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    instruction: text().notNull(),
  },
  (t) => [
    unique("recipe_step_recipe_id_position_key").on(t.recipeId, t.position),
  ],
);

export const recipeAgeAdaptation = recetario.table(
  "recipe_age_adaptation",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    minAgeMonths: smallint("min_age_months").notNull(),
    maxAgeMonths: smallint("max_age_months"), // null = en adelante
    instructions: text().notNull(),
  },
  (t) => [
    unique("recipe_age_adaptation_recipe_id_min_age_months_key").on(
      t.recipeId,
      t.minAgeMonths,
    ),
    check(
      "recipe_age_adaptation_max_check",
      sql`${t.maxAgeMonths} IS NULL OR ${t.maxAgeMonths} >= ${t.minAgeMonths}`,
    ),
  ],
);

export const recipeAllergen = recetario.table(
  "recipe_allergen",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    allergenId: smallint("allergen_id")
      .notNull()
      .references(() => allergen.id),
    isOptional: boolean("is_optional").notNull().default(false),
    condition: text(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.allergenId] }),
    index("recipe_allergen_allergen_idx").on(t.allergenId),
  ],
);

export const recipeTag = recetario.table(
  "recipe_tag",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    tagId: smallint("tag_id")
      .notNull()
      .references(() => tag.id),
    label: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.tagId] }),
    index("recipe_tag_tag_idx").on(t.tagId),
  ],
);

export const recipeReference = recetario.table(
  "recipe_reference",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    referencedRecipeId: integer("referenced_recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.referencedRecipeId] }),
    index("recipe_reference_ref_idx").on(t.referencedRecipeId),
    check(
      "recipe_reference_check",
      sql`${t.recipeId} <> ${t.referencedRecipeId}`,
    ),
  ],
);

// Plan de ejemplo del dataset (global). El plan por familia vendrá con el módulo de plan semanal.
export const mealPlanEntry = recetario.table(
  "meal_plan_entry",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    week: smallint().notNull(),
    dayOfWeek: smallint("day_of_week").notNull(), // 1 = lunes
    mealType: mealType("meal_type").notNull(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipe.id),
    label: text().notNull(),
  },
  (t) => [
    unique("meal_plan_entry_week_day_of_week_meal_type_key").on(
      t.week,
      t.dayOfWeek,
      t.mealType,
    ),
    index("meal_plan_recipe_idx").on(t.recipeId),
    check("meal_plan_entry_week_check", sql`${t.week} >= 1`),
    check("meal_plan_entry_day_check", sql`${t.dayOfWeek} BETWEEN 1 AND 7`),
    check("meal_plan_entry_meal_type_check", sql`${t.mealType} <> 'base'`),
  ],
);

export const foodGuide = recetario.table("food_guide", {
  id: smallint().primaryKey().generatedAlwaysAsIdentity(),
  food: text().notNull(),
  fromAge: text("from_age").notNull(), // '6 m', 'Con cautela', '—'
  preparation: text().notNull(),
  caution: text(),
  sortOrder: smallint("sort_order").notNull(),
});

export const fruitCutGuide = recetario.table("fruit_cut_guide", {
  id: smallint().primaryKey().generatedAlwaysAsIdentity(),
  fruit: text().notNull(),
  age78: text("age_7_8").notNull(),
  age911: text("age_9_11").notNull(),
  caution: text(),
  sortOrder: smallint("sort_order").notNull(),
});
