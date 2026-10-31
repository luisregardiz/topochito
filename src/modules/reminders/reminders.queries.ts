"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { CalendarStatus } from "./reminders.schemas";

export const useCalendar = () =>
  useQuery({
    queryKey: ["calendar"],
    queryFn: async ({ signal }) =>
      (await api.get<CalendarStatus>("/calendar", { signal })).data,
  });

export function useSaveCalendarAlarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alarmMinutes: number) =>
      (await api.put<CalendarStatus>("/calendar", { alarmMinutes })).data,
    onSuccess: (status) => qc.setQueryData(["calendar"], status),
  });
}

// El token solo llega en esta respuesta: la pantalla arma los enlaces con él.
export function useNewCalendarLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ token: string }>("/calendar")).data.token,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export const usePushKey = () =>
  useQuery({
    queryKey: ["push-key"],
    queryFn: async ({ signal }) =>
      (await api.get<{ publicKey: string | null }>("/push/key", { signal }))
        .data.publicKey,
    staleTime: Infinity,
  });

export const useMyPrefs = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: async ({ signal }) =>
      (await api.get<{ pushLeadMinutes: number }>("/members/me", { signal }))
        .data,
  });

export function useSaveLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pushLeadMinutes: number) =>
      (
        await api.put<{ pushLeadMinutes: number }>("/members/me", {
          pushLeadMinutes,
        })
      ).data,
    onSuccess: (prefs) => qc.setQueryData(["me"], prefs),
  });
}
