"use client";

import { Copy, KeyRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { copyText } from "@/lib/clipboard";
import { useRegenerateCode } from "@/modules/households/households.queries";
import { ConfirmDialog } from "./confirm-dialog";

export function RecetarioActions({ code }: { code: string }) {
  const router = useRouter();
  const regenerate = useRegenerateCode();
  const [confirm, setConfirm] = useState<"leave" | "code" | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function copyCode() {
    await copyText(code);
    toast.success("Código copiado");
  }

  async function leave() {
    setLeaving(true);
    await api.post("/access/logout");
    router.replace("/acceso");
    router.refresh();
  }

  function newCode() {
    regenerate.mutate(undefined, {
      onSuccess: () => {
        setConfirm(null);
        toast.success("Listo, el código cambió", {
          description: "El anterior ya no sirve para entrar.",
        });
        router.refresh();
      },
      onError: () =>
        toast.error("No pudimos cambiar el código", {
          description: "Revisa tu conexión e inténtalo de nuevo.",
        }),
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Button size="lg" className="w-full" onClick={copyCode}>
          <Copy aria-hidden /> Copiar código
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={() => setConfirm("code")}
        >
          <KeyRound aria-hidden /> Cambiar el código
        </Button>
      </div>

      <Button
        variant="ghost"
        className="w-full"
        onClick={() => setConfirm("leave")}
      >
        <LogOut aria-hidden /> Salir
      </Button>

      <ConfirmDialog
        open={confirm === "leave"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Salir del recetario?"
        description="Para volver a entrar vas a necesitar el código o una invitación. Anótalo antes."
        confirmLabel="Salir"
        cancelLabel="Quedarme"
        destructive
        pending={leaving}
        onConfirm={leave}
      />
      <ConfirmDialog
        open={confirm === "code"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Cambiar el código?"
        description="El código actual y los enlaces que lo llevan dejan de servir. Quien ya está dentro sigue dentro."
        confirmLabel="Cambiar el código"
        pending={regenerate.isPending}
        onConfirm={newCode}
      />
    </>
  );
}
