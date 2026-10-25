"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  AllergenOption,
  MealType,
  RecipeDetail,
  RecipeListItem,
} from "./recipes.schemas";

export type RecipeFilters = {
  q: string;
  meal: MealType | "all";
  age: number | null;
  exclude: string[];
  iron: boolean;
  tags: string[];
};

export const EMPTY_FILTERS: RecipeFilters = {
  q: "",
  meal: "all",
  age: null,
  exclude: [],
  iron: false,
  tags: [],
};

// Filtros activos del Sheet (la búsqueda y la comida tienen su propio control).
export const activeFilterCount = (f: RecipeFilters) =>
  (f.age !== null ? 1 : 0) +
  f.exclude.length +
  (f.iron ? 1 : 0) +
  f.tags.length;

export function useRecipes(f: RecipeFilters) {
  return useQuery({
    queryKey: ["recipes", f],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ recipes: RecipeListItem[] }>("/recipes", {
          signal,
          params: {
            q: f.q.trim() || undefined,
            meal: f.meal === "all" ? undefined : f.meal,
            age: f.age ?? undefined,
            exclude: f.exclude.join(",") || undefined,
            tags: f.tags.join(",") || undefined,
            iron: f.iron ? "1" : undefined,
          },
        })
      ).data.recipes,
    placeholderData: keepPreviousData, // la lista no parpadea al teclear o cambiar filtros
  });
}

export const useRecipe = (code: string) =>
  useQuery({
    queryKey: ["recipe", code],
    queryFn: async ({ signal }) =>
      (
        await api.get<RecipeDetail>(`/recipes/${encodeURIComponent(code)}`, {
          signal,
        })
      ).data,
  });

export const useAllergens = () =>
  useQuery({
    queryKey: ["allergens"],
    queryFn: async ({ signal }) =>
      (await api.get<{ allergens: AllergenOption[] }>("/allergens", { signal }))
        .data.allergens,
    staleTime: Infinity,
  });
