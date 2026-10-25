"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { FoodGuideItem, FruitCutItem } from "./guides.schemas";

export const useFoodGuide = () =>
  useQuery({
    queryKey: ["guides", "food"],
    queryFn: async ({ signal }) =>
      (await api.get<{ items: FoodGuideItem[] }>("/guides/food", { signal }))
        .data.items,
    staleTime: Infinity,
  });

export const useFruitGuide = () =>
  useQuery({
    queryKey: ["guides", "fruits"],
    queryFn: async ({ signal }) =>
      (await api.get<{ items: FruitCutItem[] }>("/guides/fruits", { signal }))
        .data.items,
    staleTime: Infinity,
  });
