import { relations } from "drizzle-orm";
import {
  allergen,
  mealPlanEntry,
  recipe,
  recipeAgeAdaptation,
  recipeAllergen,
  recipeIngredient,
  recipeReference,
  recipeStep,
  recipeTag,
  tag,
} from "./catalog";

export const recipeRelations = relations(recipe, ({ many }) => ({
  ingredients: many(recipeIngredient),
  steps: many(recipeStep),
  ageAdaptations: many(recipeAgeAdaptation),
  allergens: many(recipeAllergen),
  tags: many(recipeTag),
  uses: many(recipeReference, { relationName: "uses" }),
  usedBy: many(recipeReference, { relationName: "usedBy" }),
  planEntries: many(mealPlanEntry),
}));

export const recipeIngredientRelations = relations(
  recipeIngredient,
  ({ one }) => ({
    recipe: one(recipe, {
      fields: [recipeIngredient.recipeId],
      references: [recipe.id],
    }),
  }),
);

export const recipeStepRelations = relations(recipeStep, ({ one }) => ({
  recipe: one(recipe, {
    fields: [recipeStep.recipeId],
    references: [recipe.id],
  }),
}));

export const recipeAgeAdaptationRelations = relations(
  recipeAgeAdaptation,
  ({ one }) => ({
    recipe: one(recipe, {
      fields: [recipeAgeAdaptation.recipeId],
      references: [recipe.id],
    }),
  }),
);

export const allergenRelations = relations(allergen, ({ many }) => ({
  recipes: many(recipeAllergen),
}));

export const recipeAllergenRelations = relations(recipeAllergen, ({ one }) => ({
  recipe: one(recipe, {
    fields: [recipeAllergen.recipeId],
    references: [recipe.id],
  }),
  allergen: one(allergen, {
    fields: [recipeAllergen.allergenId],
    references: [allergen.id],
  }),
}));

export const tagRelations = relations(tag, ({ many }) => ({
  recipes: many(recipeTag),
}));

export const recipeTagRelations = relations(recipeTag, ({ one }) => ({
  recipe: one(recipe, {
    fields: [recipeTag.recipeId],
    references: [recipe.id],
  }),
  tag: one(tag, { fields: [recipeTag.tagId], references: [tag.id] }),
}));

export const recipeReferenceRelations = relations(
  recipeReference,
  ({ one }) => ({
    recipe: one(recipe, {
      fields: [recipeReference.recipeId],
      references: [recipe.id],
      relationName: "uses",
    }),
    referenced: one(recipe, {
      fields: [recipeReference.referencedRecipeId],
      references: [recipe.id],
      relationName: "usedBy",
    }),
  }),
);

export const mealPlanEntryRelations = relations(mealPlanEntry, ({ one }) => ({
  recipe: one(recipe, {
    fields: [mealPlanEntry.recipeId],
    references: [recipe.id],
  }),
}));
