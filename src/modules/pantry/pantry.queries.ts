"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PantryState } from "./pantry.schemas";

export const usePantry = () =>
  useQuery({
    queryKey: ["pantry"],
    queryFn: async ({ signal }) =>
      (await api.get<PantryState>("/pantry", { signal })).data,
  });

export function useSavePantry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unavailable: string[]) =>
      (await api.put<PantryState>("/pantry", { unavailable })).data,
    onSuccess: (state) => {
      qc.setQueryData(["pantry"], state);
      // Lo que se puede cocinar cambia: catálogo, detalle y menú se recalculan.
      for (const key of ["recipes", "recipe", "menu"])
        void qc.invalidateQueries({ queryKey: [key] });
    },
  });
}
