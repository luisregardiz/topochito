"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Invite, Member } from "./members.schemas";

export const useMembers = () =>
  useQuery({
    queryKey: ["members"],
    queryFn: async ({ signal }) =>
      (await api.get<{ members: Member[] }>("/members", { signal })).data
        .members,
  });

export function useRevokeMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export const useInvites = () =>
  useQuery({
    queryKey: ["invites"],
    queryFn: async ({ signal }) =>
      (await api.get<{ invites: Invite[] }>("/invites", { signal })).data
        .invites,
  });

// El token solo llega en esta respuesta: quien lo pide arma el enlace y lo comparte.
export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ invite: Invite; token: string }>("/invites")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
}
