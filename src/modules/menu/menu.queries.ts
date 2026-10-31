"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { EntryRef, Menu, RegenerateInput, Today } from "./menu.schemas";

export const useMenu = () =>
  useQuery({
    queryKey: ["menu"],
    queryFn: async ({ signal }) =>
      (await api.get<{ menu: Menu | null }>("/menu", { signal })).data.menu,
  });

// Toda mutación devuelve el menú completo: se guarda en caché y la pantalla se actualiza sin otra petición.
function useMenuMutation<TVars, TData extends { menu: Menu }>(
  request: (vars: TVars) => Promise<TData>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (data) => {
      qc.setQueryData(["menu"], data.menu);
      void qc.invalidateQueries({ queryKey: ["today"] });
    },
  });
}

export const useGenerateMenu = () =>
  useMenuMutation(
    async () => (await api.post<{ menu: Menu }>("/menu/generate")).data,
  );

export const useRegenerate = () =>
  useMenuMutation(
    async (input: RegenerateInput) =>
      (
        await api.post<{ menu: Menu; previous: EntryRef[] }>(
          "/menu/regenerate",
          input,
        )
      ).data,
  );

export const useSetEntries = () =>
  useMenuMutation(
    async (entries: EntryRef[]) =>
      (await api.put<{ menu: Menu }>("/menu/entries", { entries })).data,
  );

export const useToday = () =>
  useQuery({
    queryKey: ["today"],
    queryFn: async ({ signal }) =>
      (await api.get<{ today: Today | null }>("/today", { signal })).data.today,
  });
