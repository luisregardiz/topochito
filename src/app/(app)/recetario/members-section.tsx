"use client";

import {
  Copy,
  LoaderCircle,
  MessageCircle,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  useCreateInvite,
  useInvites,
  useMembers,
  useRevokeInvite,
  useRevokeMember,
} from "@/modules/members/members.queries";
import type { Member } from "@/modules/members/members.schemas";
import { ConfirmDialog } from "./confirm-dialog";

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
function lastSeen(iso: string) {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (minutes > -60) return "hace un momento";
  const hours = Math.round(minutes / 60);
  if (hours > -24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("es", { day: "numeric", month: "long" }).format(
    new Date(iso),
  );

export function MembersSection({ familyName }: { familyName: string }) {
  const members = useMembers();
  const invites = useInvites();
  const revokeMember = useRevokeMember();
  const revokeInvite = useRevokeInvite();
  const createInvite = useCreateInvite();
  const [revoking, setRevoking] = useState<Member | null>(null);
  const [link, setLink] = useState<string | null>(null);

  function invite() {
    createInvite.mutate(undefined, {
      onSuccess: ({ token }) =>
        setLink(`${window.location.origin}/invitacion/${token}`),
      onError: () =>
        toast.error("No pudimos crear la invitación", {
          description: "Revisa tu conexión e inténtalo de nuevo.",
        }),
    });
  }

  const message = (url: string) =>
    `Te invito al recetario de ${familyName} en topochito: ${url}`;

  return (
    <section aria-labelledby="cuidadores" className="flex flex-col gap-3">
      <h2 id="cuidadores" className="text-[22px] font-bold xl:text-xl">
        Cuidadores
      </h2>
      <Card>
        <CardContent className="flex flex-col gap-4">
          {members.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : members.isError ? (
            <p className="text-muted-foreground">No pudimos cargar la lista.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {members.data.map((m) => (
                <li
                  key={m.id}
                  className="flex min-h-16 items-center gap-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-bold">
                      <span className="truncate">{m.label}</span>
                      {m.isMe && <Badge variant="secondary">Tú</Badge>}
                    </p>
                    <p className="text-base text-muted-foreground">
                      Entró {lastSeen(m.lastSeenAt)}
                    </p>
                  </div>
                  {!m.isMe && (
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => setRevoking(m)}
                      aria-label={`Quitar el acceso a ${m.label}`}
                    >
                      <UserMinus aria-hidden /> Quitar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={createInvite.isPending}
            onClick={invite}
          >
            {createInvite.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <UserPlus aria-hidden />
            )}
            Invitar a alguien
          </Button>
          <p className="text-base text-muted-foreground">
            El enlace sirve 7 días y para varias personas. Cada una entra con su
            propio acceso, que puedes quitar cuando quieras.
          </p>

          {!!invites.data?.length && (
            <ul className="flex flex-col gap-2">
              {invites.data.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2"
                >
                  <span className="text-base">
                    Invitación activa · vence el {shortDate(i.expiresAt)}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={revokeInvite.isPending}
                    onClick={() =>
                      revokeInvite.mutate(i.id, {
                        onSuccess: () =>
                          toast.success("Ese enlace ya no sirve"),
                      })
                    }
                  >
                    Desactivar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent className="p-5 text-base sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[26px] leading-tight font-bold">
              Invitación lista
            </DialogTitle>
            <DialogDescription className="text-lg text-foreground xl:text-base">
              Envíala a quien cuide al bebé. Solo se muestra ahora: si la
              pierdes, crea otra.
            </DialogDescription>
          </DialogHeader>
          {link && (
            <div className="flex flex-col gap-3">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message(link))}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                <MessageCircle aria-hidden /> Enviar por WhatsApp
              </a>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await copyText(link);
                  toast.success("¡Enlace copiado!");
                }}
              >
                <Copy aria-hidden /> Copiar enlace
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`¿Quitar el acceso a ${revoking?.label ?? ""}?`}
        description="Dejará de poder entrar desde ese dispositivo. Si quiere volver, necesitará una invitación nueva."
        confirmLabel="Quitar acceso"
        destructive
        pending={revokeMember.isPending}
        onConfirm={() =>
          revoking &&
          revokeMember.mutate(revoking.id, {
            onSuccess: () => {
              toast.success(`${revoking.label} ya no tiene acceso`);
              setRevoking(null);
            },
          })
        }
      />
    </section>
  );
}
