"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { HouseholdSettings, SettingsInput } from "./households.schemas";

export const useSettings = () =>
  useQuery({
    queryKey: ["household"],
    queryFn: async ({ signal }) =>
      (await api.get<{ settings: HouseholdSettings }>("/household", { signal }))
        .data.settings,
  });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SettingsInput) =>
      (await api.put<{ settings: HouseholdSettings }>("/household", input)).data
        .settings,
    onSuccess: (settings) => {
      qc.setQueryData(["household"], settings);
      // La semana y el día se calculan en la zona horaria de la familia.
      void qc.invalidateQueries({ queryKey: ["menu"] });
      void qc.invalidateQueries({ queryKey: ["today"] });
    },
  });
}

export const useRegenerateCode = () =>
  useMutation({
    mutationFn: async () =>
      (await api.post<{ code: string }>("/household/code")).data.code,
  });
