"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BabyInput, BabyProfile } from "./baby.schemas";

export const useBaby = () =>
  useQuery({
    queryKey: ["baby"],
    queryFn: async ({ signal }) =>
      (await api.get<{ baby: BabyProfile | null }>("/baby", { signal })).data
        .baby ?? null,
  });

export function useSaveBaby() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BabyInput) =>
      (await api.put<{ baby: BabyProfile }>("/baby", input)).data.baby,
    onSuccess: (baby) => {
      qc.setQueryData(["baby"], baby);
      // El menú guarda la edad y las recetas elegidas según el perfil anterior.
      void qc.invalidateQueries({ queryKey: ["menu"] });
    },
  });
}

// Alérgenos que la familia marcó como «evitar».
export const avoidedAllergens = (baby: BabyProfile | null | undefined) =>
  Object.entries(baby?.allergens ?? {})
    .filter(([, status]) => status === "avoid")
    .map(([slug]) => slug);
